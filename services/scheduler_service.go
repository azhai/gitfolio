package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
)

type SchedulerService struct {
	db      *models.Database
	mu      sync.Mutex
	running bool
	cancel  context.CancelFunc
	sem     chan struct{}
}

func NewSchedulerService(db *models.Database) *SchedulerService {
	return &SchedulerService{
		db:  db,
		sem: make(chan struct{}, 2),
	}
}

func (s *SchedulerService) getOwnerName(ownerID int64) string {
	owner, err := s.db.Owner.Select().Where("id = ?", ownerID).One()
	if err == nil && owner != nil {
		return owner.Username
	}
	user, err := s.db.User.Select().Where("id = ?", ownerID).One()
	if err == nil && user != nil {
		return user.Username
	}
	return "unknown"
}

func (s *SchedulerService) ensureSyncPoints() {
	repos, err := s.db.Repository.Select().All()
	if err != nil {
		log.Printf("[Scheduler] Error fetching repos for sync point init: %v", err)
		return
	}
	for _, repo := range repos {
		syncType := "stats"
		if repo.IsRemote() {
			syncType = "mirror"
		}
		s.GetOrCreateSyncPoint(repo.ID, syncType)
	}
}

func (s *SchedulerService) Start() {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return
	}
	s.running = true
	s.mu.Unlock()

	CleanupStaleSyncState(s.db)
	s.ensureSyncPoints()

	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel

	go s.run(ctx)
	log.Println("[Scheduler] Started sync scheduler")
}

func (s *SchedulerService) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancel != nil {
		s.cancel()
	}
	s.running = false
	log.Println("[Scheduler] Stopped sync scheduler")
}

func (s *SchedulerService) run(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	s.tick()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.tick()
		}
	}
}

func (s *SchedulerService) tick() {
	now := time.Now().UTC()

	repos, err := s.db.Repository.Select().All()
	if err != nil {
		log.Printf("[Scheduler] Error fetching repositories: %v", err)
		return
	}

	for _, repo := range repos {
		if repo.IsRemote() {
			s.checkMirrorSync(repo, now)
		} else {
			s.checkStatsRefresh(repo, now)
		}
	}
}

func (s *SchedulerService) checkMirrorSync(repo *models.Repository, now time.Time) {
	if IsSyncing(repo.ID) {
		return
	}

	syncPoints, err := s.db.SyncPoint.Select().Where("repository_id = ? AND sync_type = ?", repo.ID, "mirror").All()
	if err != nil || len(syncPoints) == 0 {
		return
	}

	sp := syncPoints[0]
	if sp.IsPaused {
		return
	}
	if sp.NextSyncAt != nil && now.Before(*sp.NextSyncAt) {
		return
	}

	ownerName := s.getOwnerName(repo.OwnerID)
	syncSvc := NewSyncService(s.db)
	remoteRepo, _ := syncSvc.GetRemoteRepoInfo(repo.ID)
	if remoteRepo == nil {
		return
	}

	token := ""
	if remoteRepo.AccountID != nil {
		t, err := syncSvc.GetSyncToken(*remoteRepo.AccountID)
		if err == nil && t != nil {
			token = t.AccessToken
		}
	}
	if token == "" {
		_, token = config.GetUserToken()
	}

	s.updateNextSyncAt(sp, now)

	if !TryLockSync(repo.ID) {
		return
	}
	select {
	case s.sem <- struct{}{}:
		go func() {
			defer func() { <-s.sem }()
			defer UnlockSync(repo.ID)

			log.Printf("[Scheduler] Syncing mirror repo %s/%s", ownerName, repo.Name)
			startTime := time.Now()
			ctx := context.Background()
			syncResult, err := syncSvc.SyncRepositoryData(ctx, repo.ID, remoteRepo.Platform, remoteRepo.Owner, remoteRepo.RepoName, token, sp.LastIssueSyncAt, sp.LastPRSyncAt, sp.LastIssueNumber, sp.LastPRNumber)
			duration := time.Since(startTime).Milliseconds()

			if err != nil {
				log.Printf("[Scheduler] Sync failed for %s/%s: %v", ownerName, repo.Name, err)
				syncSvc.UpdateSyncPoint(sp.ID, false, err.Error())
				syncSvc.LogSync(sp.ID, "mirror", "failure", err.Error(), duration, 0, 0, "")

				var rlErr *RateLimitError
				if errors.As(err, &rlErr) {
					resetTime := rlErr.ResetAt.Add(1 * time.Minute)
					sp.NextSyncAt = &resetTime
					s.db.SyncPoint.Save().One(sp)
					log.Printf("[Scheduler] Rate limited for %s/%s, next sync at %v", ownerName, repo.Name, resetTime.Format(time.RFC3339))
				}
			} else {
				log.Printf("[Scheduler] Sync succeeded for %s/%s", ownerName, repo.Name)
				syncSvc.UpdateSyncPoint(sp.ID, true, "")
				syncSvc.LogSync(sp.ID, "mirror", "success", "", duration, syncResult.IssuesInserted+syncResult.IssuesUpdated+syncResult.PRsInserted+syncResult.PRsUpdated, 0, "")

				if syncResult.MaxIssueNumber > sp.LastIssueNumber {
					sp.LastIssueNumber = syncResult.MaxIssueNumber
				}
				if syncResult.MaxPRNumber > sp.LastPRNumber {
					sp.LastPRNumber = syncResult.MaxPRNumber
				}
				now := time.Now().UTC()
				sp.LastIssueSyncAt = &now
				sp.LastPRSyncAt = &now
				s.db.SyncPoint.Save().One(sp)

				if repo.LocalPath != "" {
					syncSvc.SyncPullRepository(repo.LocalPath)
				}
			}
		}()
	default:
		UnlockSync(repo.ID)
		log.Printf("[Scheduler] Sync queue full, skipping %s/%s", ownerName, repo.Name)
	}
}

func (s *SchedulerService) checkStatsRefresh(repo *models.Repository, now time.Time) {
	syncPoints, err := s.db.SyncPoint.Select().Where("repository_id = ? AND sync_type = ?", repo.ID, "stats").All()
	if err != nil || len(syncPoints) == 0 {
		return
	}

	sp := syncPoints[0]
	if sp.IsPaused {
		return
	}
	if sp.NextSyncAt != nil && now.Before(*sp.NextSyncAt) {
		return
	}

	ownerName := s.getOwnerName(repo.OwnerID)

	log.Printf("[Scheduler] Refreshing stats for %s/%s", ownerName, repo.Name)

	statsSvc := NewStatsService(s.db)
	startTime := time.Now()
	err = statsSvc.UpdateRepositoryStats(repo.ID, ownerName, repo.Name)
	duration := time.Since(startTime).Milliseconds()

	if err != nil {
		log.Printf("[Scheduler] Stats refresh failed for %s/%s: %v", ownerName, repo.Name, err)
		syncSvc := NewSyncService(s.db)
		syncSvc.UpdateSyncPoint(sp.ID, false, err.Error())
		syncSvc.LogSync(sp.ID, "stats", "failure", err.Error(), duration, 0, 0, "")
	} else {
		syncSvc := NewSyncService(s.db)
		syncSvc.UpdateSyncPoint(sp.ID, true, "")
		syncSvc.LogSync(sp.ID, "stats", "success", "", duration, 0, 0, "")
	}

	s.updateNextSyncAt(sp, now)
}

func (s *SchedulerService) updateNextSyncAt(sp *models.SyncPoint, now time.Time) {
	if sp.SyncInterval <= 0 {
		sp.NextSyncAt = nil
		if err := s.db.SyncPoint.Save().One(sp); err != nil {
			log.Printf("[Scheduler] Error updating next sync time: %v", err)
		}
		return
	}
	next := now.Add(time.Duration(sp.SyncInterval) * time.Second)
	sp.NextSyncAt = &next
	if err := s.db.SyncPoint.Save().One(sp); err != nil {
		log.Printf("[Scheduler] Error updating next sync time: %v", err)
	}
}

func (s *SchedulerService) GetOrCreateSyncPoint(repoID int64, syncType string) (*models.SyncPoint, error) {
	syncPoints, err := s.db.SyncPoint.Select().Where("repository_id = ? AND sync_type = ?", repoID, syncType).All()
	if err != nil {
		return nil, err
	}
	if len(syncPoints) > 0 {
		return syncPoints[0], nil
	}

	sp := models.SyncPoint{
		RepositoryID: repoID,
		SyncType:     syncType,
		SyncInterval: 43200,
		IsPaused:     false,
	}
	now := time.Now().UTC()
	nextSync := now.Add(43200 * time.Second)
	sp.NextSyncAt = &nextSync
	if err := s.db.SyncPoint.Insert().One(&sp); err != nil {
		return nil, err
	}
	return &sp, nil
}

func (s *SchedulerService) UpdateSyncConfig(repoID int64, syncType string, interval int, paused bool) (*models.SyncPoint, error) {
	sp, err := s.GetOrCreateSyncPoint(repoID, syncType)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	sp.SyncInterval = interval
	sp.IsPaused = paused
	if !paused && interval > 0 {
		nextSync := now.Add(time.Duration(interval) * time.Second)
		sp.NextSyncAt = &nextSync
	} else if interval <= 0 {
		sp.NextSyncAt = nil
	}

	if err := s.db.SyncPoint.Save().One(sp); err != nil {
		return nil, fmt.Errorf("failed to update sync config: %w", err)
	}
	return sp, nil
}

func (s *SchedulerService) ListAllSyncPoints() ([]SyncPointInfo, error) {
	syncPoints, err := s.db.SyncPoint.Select().OrderBy("sync_interval DESC").All()
	if err != nil {
		return nil, err
	}

	var result []SyncPointInfo
	for _, sp := range syncPoints {
		repo, err := s.db.Repository.Select().Where("id = ?", sp.RepositoryID).One()
		if err != nil || repo == nil {
			continue
		}

		ownerName := s.getOwnerName(repo.OwnerID)

		info := SyncPointInfo{
			ID:            sp.ID,
			RepositoryID:  sp.RepositoryID,
			OwnerName:     ownerName,
			RepoName:      repo.Name,
			ProjectType:   repo.ProjectType,
			SyncType:      sp.SyncType,
			SyncInterval:  sp.SyncInterval,
			IsPaused:      sp.IsPaused,
			LastSyncAt:    nil,
			LastSuccessAt: nil,
			LastFailureAt: nil,
			NextSyncAt:    nil,
			FailureCount:  sp.FailureCount,
			LastError:     sp.LastError,
			CreatedAt:     sp.CreatedAt,
			UpdatedAt:     sp.UpdatedAt,
		}
		if sp.LastSyncAt != nil {
			info.LastSyncAt = sp.LastSyncAt
		}
		if sp.LastSuccessAt != nil {
			info.LastSuccessAt = sp.LastSuccessAt
		}
		if sp.LastFailureAt != nil {
			info.LastFailureAt = sp.LastFailureAt
		}
		if sp.NextSyncAt != nil {
			info.NextSyncAt = sp.NextSyncAt
		}
		result = append(result, info)
	}
	return result, nil
}

type SyncPointInfo struct {
	ID            int64      `json:"id"`
	RepositoryID  int64      `json:"repository_id"`
	OwnerName     string     `json:"owner_name"`
	RepoName      string     `json:"repo_name"`
	ProjectType   string     `json:"project_type"`
	SyncType      string     `json:"sync_type"`
	SyncInterval  int        `json:"sync_interval"`
	IsPaused      bool       `json:"is_paused"`
	LastSyncAt    *time.Time `json:"last_sync_at"`
	LastSuccessAt *time.Time `json:"last_success_at"`
	LastFailureAt *time.Time `json:"last_failure_at"`
	NextSyncAt    *time.Time `json:"next_sync_at"`
	FailureCount  int        `json:"failure_count"`
	LastError     string     `json:"last_error"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func (s *SchedulerService) GetSyncLogs(repoID int64, limit int) ([]models.SyncLog, error) {
	syncPoints, err := s.db.SyncPoint.Select().Where("repository_id = ?", repoID).All()
	if err != nil || len(syncPoints) == 0 {
		return []models.SyncLog{}, nil
	}

	var allLogs []*models.SyncLog
	for _, sp := range syncPoints {
		logs, err := s.db.SyncLog.Select().Where("sync_point_id = ?", sp.ID).OrderBy("created_at DESC").All()
		if err != nil {
			continue
		}
		allLogs = append(allLogs, logs...)
	}

	if len(allLogs) > limit {
		allLogs = allLogs[:limit]
	}
	result := make([]models.SyncLog, len(allLogs))
	for i, l := range allLogs {
		result[i] = *l
	}
	return result, nil
}

type SyncLogInfo struct {
	ID          int64     `json:"id"`
	SyncPointID int64     `json:"sync_point_id"`
	OwnerName   string    `json:"owner_name"`
	RepoName    string    `json:"repo_name"`
	SyncType    string    `json:"sync_type"`
	Status      string    `json:"status"`
	Message     string    `json:"message"`
	Duration    int64     `json:"duration"`
	ItemsSynced int       `json:"items_synced"`
	ItemsFailed int       `json:"items_failed"`
	CreatedAt   time.Time `json:"created_at"`
}

func (s *SchedulerService) ListAllSyncLogs(limit int) ([]SyncLogInfo, error) {
	logs, err := s.db.SyncLog.Select().OrderBy("created_at DESC").Skip(0).Take(limit).All()
	if err != nil {
		return nil, err
	}

	pointCache := make(map[int64]*models.SyncPoint)
	repoCache := make(map[int64]*models.Repository)

	var result []SyncLogInfo
	for _, l := range logs {
		var sp *models.SyncPoint
		var ok bool
		if sp, ok = pointCache[l.SyncPointID]; !ok {
			points, err := s.db.SyncPoint.Select().Where("id = ?", l.SyncPointID).All()
			if err != nil || len(points) == 0 {
				continue
			}
			sp = points[0]
			pointCache[l.SyncPointID] = sp
		}

		var repo *models.Repository
		if repo, ok = repoCache[sp.RepositoryID]; !ok {
			r, err := s.db.Repository.Select().Where("id = ?", sp.RepositoryID).One()
			if err != nil || r == nil {
				continue
			}
			repo = r
			repoCache[sp.RepositoryID] = repo
		}

		ownerName := s.getOwnerName(repo.OwnerID)
		result = append(result, SyncLogInfo{
			ID:          l.ID,
			SyncPointID: l.SyncPointID,
			OwnerName:   ownerName,
			RepoName:    repo.Name,
			SyncType:    l.SyncType,
			Status:      l.Status,
			Message:     l.Message,
			Duration:    l.Duration,
			ItemsSynced: l.ItemsSynced,
			ItemsFailed: l.ItemsFailed,
			CreatedAt:   l.CreatedAt,
		})
	}
	return result, nil
}
