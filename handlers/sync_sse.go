package handlers

import (
	"context"
	"fmt"
	"time"

	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/azhai/gobus"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/sse"
)

// syncSSEMessage is the JSON payload sent on each SSE event.
type syncSSEMessage struct {
	Topic   string `json:"topic"`
	Message string `json:"message"`
	RepoID  int64  `json:"repo_id"`
}

// syncSSEArgs bundles everything the streaming handler needs so it can live in
// its own function instead of a large closure.
type syncSSEArgs struct {
	bus             *gobus.EventBus
	db              *models.Database
	syncSvc         *services.SyncService
	repoID          int64
	platform        string
	remoteOwner     string
	remoteRepoName  string
	token           string
	syncPointID     int64
	syncPoints      []*models.SyncPoint
	lastIssueSyncAt *time.Time
	lastPRSyncAt    *time.Time
	lastIssueNumber int
	lastPRNumber    int
}

// SyncIssuesDataSSE streams sync progress to the client using Server-Sent Events.
// The client receives progress, warning, error and completion events in real time
// instead of polling a status endpoint. Short polling remains available as a fallback.
func SyncIssuesDataSSE(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()
	repo := result.Repo

	if !repo.IsRemote() {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Not a remote repository"})
	}

	if services.IsSyncing(repo.ID) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Sync is already running for this repository"})
	}

	bus := services.DefaultSyncBus()
	if bus == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Sync event bus not configured"})
	}

	syncSvc := services.NewSyncService(db).ForRepository(repo.ID)

	remoteRepo, err := syncSvc.GetRemoteRepoInfo(repo.ID)
	if err != nil || remoteRepo == nil {
		if repo.MirrorURL != "" {
			remoteRepo = syncSvc.CreateRemoteRepoFromMirrorURL(repo.ID, repo.MirrorURL)
		}
	}
	if remoteRepo == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fmt.Sprintf("No remote repo found for repository ID %d", repo.ID),
		})
	}

	token := syncSvc.ResolveSyncToken(remoteRepo.Platform, remoteRepo.AccountID)

	syncPoints, _ := db.SyncPoint.Select().Where("repository_id = ? AND sync_type = ?", repo.ID, "mirror").All()
	var syncPointID int64
	var lastIssueSyncAt, lastPRSyncAt *time.Time
	var lastIssueNumber, lastPRNumber int
	if len(syncPoints) > 0 {
		sp := syncPoints[0]
		syncPointID = sp.ID
		lastIssueSyncAt = sp.LastIssueSyncAt
		lastPRSyncAt = sp.LastPRSyncAt
		lastIssueNumber = sp.LastIssueNumber
		lastPRNumber = sp.LastPRNumber
	}

	args := syncSSEArgs{
		bus:             bus,
		db:              db,
		syncSvc:         syncSvc,
		repoID:          repo.ID,
		platform:        remoteRepo.Platform,
		remoteOwner:     remoteRepo.Owner,
		remoteRepoName:  remoteRepo.RepoName,
		token:           token,
		syncPointID:     syncPointID,
		syncPoints:      syncPoints,
		lastIssueSyncAt: lastIssueSyncAt,
		lastPRSyncAt:    lastPRSyncAt,
		lastIssueNumber: lastIssueNumber,
		lastPRNumber:    lastPRNumber,
	}

	return sse.New(sse.Config{
		HeartbeatInterval: 30 * time.Second,
		Handler:           runSyncSSEStream(args),
	})(c)
}

// runSyncSSEStream returns the SSE handler for a prepared sync job.
// It is kept separate from SyncIssuesDataSSE so the request validation/setup
// code and the streaming/event-forwarding logic can be read independently.
func runSyncSSEStream(args syncSSEArgs) sse.Handler {
	return func(c fiber.Ctx, stream *sse.Stream) error {
		done := make(chan struct{})
		var syncErr error

		subscriberID := fmt.Sprintf("sse:%d:%d", args.repoID, time.Now().UnixNano())

		sendEvent := func(topic, message string) error {
			return stream.Event(sse.Event{
				Name: topic,
				Data: syncSSEMessage{Topic: topic, Message: message, RepoID: args.repoID},
			})
		}

		subscribe := func(topic string) {
			args.bus.Subscribe(topic, gobus.Fanout, subscriberID+":"+topic, func(e *gobus.Event) {
				rid, ok := e.Data["repo_id"].(int64)
				if !ok || rid != args.repoID {
					return
				}
				msg, _ := e.Data["message"].(string)
				_ = sendEvent(e.Topic, msg)
			})
		}
		subscribe(services.SyncTopicProgress)
		subscribe(services.SyncTopicWarning)
		subscribe(services.SyncTopicError)
		subscribe(services.SyncTopicComplete)

		defer func() {
			args.bus.Unsubscribe(services.SyncTopicProgress, subscriberID+":"+services.SyncTopicProgress)
			args.bus.Unsubscribe(services.SyncTopicWarning, subscriberID+":"+services.SyncTopicWarning)
			args.bus.Unsubscribe(services.SyncTopicError, subscriberID+":"+services.SyncTopicError)
			args.bus.Unsubscribe(services.SyncTopicComplete, subscriberID+":"+services.SyncTopicComplete)
		}()

		if !services.TryLockSync(args.repoID) {
			return sendEvent(services.SyncTopicError, "Sync is already running for this repository")
		}

		var runningLogID int64
		if args.syncPointID > 0 {
			runningLog := &models.SyncLog{
				SyncPointID: args.syncPointID,
				SyncType:    "mirror",
				Status:      "running",
				CreatedAt:   time.Now().UTC(),
			}
			if err := args.db.SyncLog.Insert().One(runningLog); err == nil {
				runningLogID = runningLog.ID
			}
		}

		go func() {
			defer close(done)
			defer services.UnlockSync(args.repoID)

			startTime := time.Now()
			syncResult, err := args.syncSvc.SyncRepositoryData(context.Background(), args.repoID, args.platform,
				args.remoteOwner, args.remoteRepoName, args.token,
				args.lastIssueSyncAt, args.lastPRSyncAt, args.lastIssueNumber, args.lastPRNumber, nil)
			duration := time.Since(startTime).Milliseconds()

			if err != nil {
				syncErr = err
				if runningLogID > 0 {
					args.syncSvc.UpdateSyncLog(runningLogID, "failure", err.Error(), duration, 0, 0)
				} else if args.syncPointID > 0 {
					args.syncSvc.LogSync(args.syncPointID, "mirror", "failure", err.Error(), duration, 0, 0, "")
				}
				_ = sendEvent(services.SyncTopicError, err.Error())
				return
			}

			totalSynced := syncResult.IssuesInserted + syncResult.IssuesUpdated + syncResult.PRsInserted + syncResult.PRsUpdated
			if runningLogID > 0 {
				args.syncSvc.UpdateSyncLog(runningLogID, "success", "", duration, int64(totalSynced), 0)
			} else if args.syncPointID > 0 {
				args.syncSvc.LogSync(args.syncPointID, "mirror", "success", "", duration, totalSynced, 0, "")
			}

			now := time.Now().UTC()
			if r, findErr := args.db.Repository.Select().Where("id = ?", args.repoID).One(); findErr == nil {
				r.LastSyncAt = &now
				args.db.Repository.Save().One(r)
			}

			if args.syncPointID > 0 {
				sp := args.syncPoints[0]
				sp.LastSyncAt = &now
				if syncResult.MaxIssueUpdatedAt != nil {
					sp.LastIssueSyncAt = syncResult.MaxIssueUpdatedAt
				} else {
					sp.LastIssueSyncAt = &now
				}
				if syncResult.MaxPRUpdatedAt != nil {
					sp.LastPRSyncAt = syncResult.MaxPRUpdatedAt
				} else {
					sp.LastPRSyncAt = &now
				}
				sp.LastIssueNumber = syncResult.MaxIssueNumber
				sp.LastPRNumber = syncResult.MaxPRNumber
				args.db.SyncPoint.Save().One(sp)
			}

			_ = sendEvent(services.SyncTopicComplete, fmt.Sprintf("Sync completed: %d issues/prs updated", totalSynced))
		}()

		select {
		case <-done:
			return syncErr
		case <-stream.Context().Done():
			return nil
		}
	}
}
