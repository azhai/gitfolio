package services

import (
	"log"
	"time"

	"github.com/azhai/gitfolio/models"
)

type StatsService struct {
	db *models.Database
}

func NewStatsService(db *models.Database) *StatsService {
	return &StatsService{db: db}
}

func (s *StatsService) UpdateRepositoryStats(repoID int64, owner, name string) error {
	stats, err := s.getOrCreateStats(repoID)
	if err != nil {
		return err
	}

	openIssues, _ := s.db.Issue.Select().Where("repository_id = ? AND is_closed = ?", repoID, false).Count("*")
	closedIssues, _ := s.db.Issue.Select().Where("repository_id = ? AND is_closed = ?", repoID, true).Count("*")
	openPRs, _ := s.db.PullRequest.Select().Where("repository_id = ? AND is_closed = ?", repoID, false).Count("*")
	closedPRs, _ := s.db.PullRequest.Select().Where("repository_id = ? AND is_closed = ?", repoID, true).Count("*")

	repo, _ := s.db.Repository.Select().Where("id = ?", repoID).One()
	gitSvc := NewGitService()
	if repo != nil && repo.LocalPath != "" {
		gitSvc = gitSvc.WithLocalPath(repo.LocalPath)
	}
	commitsCount, _ := gitSvc.GetCommitCount(owner, name, "")
	branchesCount, _ := gitSvc.GetBranchCount(owner, name)
	tagsCount, _ := gitSvc.GetTagCount(owner, name)

	contributorsCount := s.refreshContributors(repoID, gitSvc, owner, name)

	// 建项目时把 default_branch 写死成 main，只有 master 的镜像就会在顶部分支标签
	// 和分支列表的「默认」标记上出错，以 HEAD 为准纠正一次。
	if repo != nil {
		if head := gitSvc.GetHeadBranch(owner, name); head != "" && head != repo.DefaultBranch {
			repo.DefaultBranch = head
			if err := s.db.Repository.Save().One(repo); err != nil {
				log.Printf("[Stats] failed to set default branch %s: %v", head, err)
			}
		}
	}

	if commitsCount > 0 {
		_, commitTimeStr, _, _, err := gitSvc.GetLastCommitInfo(owner, name, "")
		if err == nil && commitTimeStr != "" {
			if commitTime, err := time.Parse("2006-01-02 15:04:05 -0700", commitTimeStr); err == nil {
				if repo != nil {
					repo.LastCommitAt = &commitTime
					s.db.Repository.Save().One(repo)
				}
			}
		}
	}

	stats.OpenIssuesCount = int(openIssues)
	stats.ClosedIssuesCount = int(closedIssues)
	stats.OpenPRsCount = int(openPRs)
	stats.ClosedPRsCount = int(closedPRs)
	stats.ContributorsCount = contributorsCount
	stats.CommitsCount = commitsCount
	stats.BranchesCount = branchesCount
	stats.TagsCount = tagsCount
	stats.UpdatedAt = time.Now().UTC()

	return s.db.RepositoryStats.Save().One(stats)
}

// refreshContributors 用 git shortlog 回填每个贡献者的提交数，返回仓库的贡献者总数。
// 贡献者表原来只在 Issue/PR 同步时按 GitHub 用户名查缓存、从不写入，所以列表和
// contributors_count 一直是 0。
func (s *StatsService) refreshContributors(repoID int64, gitSvc *GitService, owner, name string) int {
	gitContributors, err := gitSvc.GetContributors(owner, name)
	if err != nil {
		log.Printf("[Stats] failed to list contributors for %s/%s: %v", owner, name, err)
		count, _ := s.db.Contributor.Select().Where("repository_id = ?", repoID).Count("*")
		return int(count)
	}

	existing, err := s.db.Contributor.Select().Where("repository_id = ?", repoID).All()
	if err != nil {
		log.Printf("[Stats] failed to load contributors for %s/%s: %v", owner, name, err)
		return len(gitContributors)
	}

	byName := make(map[string]*models.Contributor, len(existing))
	for _, c := range existing {
		if _, dup := byName[c.Name]; !dup {
			byName[c.Name] = c
		}
	}

	now := time.Now().UTC()
	for _, gc := range gitContributors {
		if c, ok := byName[gc.Name]; ok {
			if c.CommitsCount == gc.Count && (c.Email != "" || gc.Email == "") {
				continue
			}
			c.CommitsCount = gc.Count
			if c.Email == "" {
				c.Email = gc.Email
			}
			c.UpdatedAt = now
			if err := s.db.Contributor.Save().One(c); err != nil {
				log.Printf("[Stats] failed to update contributor %s: %v", gc.Name, err)
			}
			continue
		}

		c := &models.Contributor{
			Name:         gc.Name,
			Email:        gc.Email,
			RepositoryID: repoID,
			CommitsCount: gc.Count,
			CreatedAt:    now,
			UpdatedAt:    now,
		}
		if err := s.db.Contributor.Insert().One(c); err != nil {
			log.Printf("[Stats] failed to insert contributor %s: %v", gc.Name, err)
			continue
		}
		byName[gc.Name] = c
	}

	return len(byName)
}

func (s *StatsService) getOrCreateStats(repoID int64) (*models.RepositoryStats, error) {
	stats, err := s.db.RepositoryStats.Select().Where("repository_id = ?", repoID).One()
	if err == nil {
		return stats, nil
	}

	stats = &models.RepositoryStats{
		RepositoryID:      repoID,
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
		StarsCount:        0,
		ForksCount:        0,
		WatchCount:        0,
		CommitsCount:      0,
		TagsCount:         0,
		ContributorsCount: 0,
		OpenIssuesCount:   0,
		ClosedIssuesCount: 0,
		OpenPRsCount:      0,
		ClosedPRsCount:    0,
	}

	if err := s.db.RepositoryStats.Insert().One(stats); err != nil {
		return nil, err
	}

	return stats, nil
}

func (s *StatsService) UpdateStarsCount(repoID int64, count int) error {
	stats, err := s.getOrCreateStats(repoID)
	if err != nil {
		return err
	}

	stats.StarsCount = count
	stats.UpdatedAt = time.Now().UTC()

	return s.db.RepositoryStats.Save().One(stats)
}

func (s *StatsService) UpdateForksCount(repoID int64, count int) error {
	stats, err := s.getOrCreateStats(repoID)
	if err != nil {
		return err
	}

	stats.ForksCount = count
	stats.UpdatedAt = time.Now().UTC()

	return s.db.RepositoryStats.Save().One(stats)
}

func (s *StatsService) UpdateWatchCount(repoID int64, count int) error {
	stats, err := s.getOrCreateStats(repoID)
	if err != nil {
		return err
	}

	stats.WatchCount = count
	stats.UpdatedAt = time.Now().UTC()

	return s.db.RepositoryStats.Save().One(stats)
}

func (s *StatsService) UpdateCommitsCount(repoID int64, count int) error {
	stats, err := s.getOrCreateStats(repoID)
	if err != nil {
		return err
	}

	stats.CommitsCount = count
	stats.UpdatedAt = time.Now().UTC()

	return s.db.RepositoryStats.Save().One(stats)
}

func (s *StatsService) UpdateLastCommitAt(repoID int64, t *time.Time) error {
	stats, err := s.getOrCreateStats(repoID)
	if err != nil {
		return err
	}

	stats.LastCommitAt = t
	stats.UpdatedAt = time.Now().UTC()

	return s.db.RepositoryStats.Save().One(stats)
}

func (s *StatsService) GetRepositoryStats(repoID int64) (*models.RepositoryStats, error) {
	return s.getOrCreateStats(repoID)
}
