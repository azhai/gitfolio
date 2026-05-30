package services

import (
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
	contributors, _ := s.db.Contributor.Select().Where("repository_id = ?", repoID).Count("*")

	gitSvc := NewGitService()
	commitsCount, _ := gitSvc.GetCommitCount(owner, name, "")
	branchesCount, _ := gitSvc.GetBranchCount(owner, name)
	tagsCount, _ := gitSvc.GetTagCount(owner, name)

	if commitsCount > 0 {
		_, commitTimeStr, _, _, err := gitSvc.GetLastCommitInfo(owner, name, "")
		if err == nil && commitTimeStr != "" {
			if commitTime, err := time.Parse("2006-01-02 15:04:05 -0700", commitTimeStr); err == nil {
				repo, repoErr := s.db.Repository.Select().Where("id = ?", repoID).One()
				if repoErr == nil {
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
	stats.ContributorsCount = int(contributors)
	stats.CommitsCount = commitsCount
	stats.BranchesCount = branchesCount
	stats.TagsCount = tagsCount
	stats.UpdatedAt = time.Now()

	return s.db.RepositoryStats.Save().One(stats)
}

func (s *StatsService) getOrCreateStats(repoID int64) (*models.RepositoryStats, error) {
	stats, err := s.db.RepositoryStats.Select().Where("repository_id = ?", repoID).One()
	if err == nil {
		return stats, nil
	}

	stats = &models.RepositoryStats{
		RepositoryID:      repoID,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
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
	stats.UpdatedAt = time.Now()

	return s.db.RepositoryStats.Save().One(stats)
}

func (s *StatsService) UpdateForksCount(repoID int64, count int) error {
	stats, err := s.getOrCreateStats(repoID)
	if err != nil {
		return err
	}

	stats.ForksCount = count
	stats.UpdatedAt = time.Now()

	return s.db.RepositoryStats.Save().One(stats)
}

func (s *StatsService) UpdateWatchCount(repoID int64, count int) error {
	stats, err := s.getOrCreateStats(repoID)
	if err != nil {
		return err
	}

	stats.WatchCount = count
	stats.UpdatedAt = time.Now()

	return s.db.RepositoryStats.Save().One(stats)
}

func (s *StatsService) UpdateCommitsCount(repoID int64, count int) error {
	stats, err := s.getOrCreateStats(repoID)
	if err != nil {
		return err
	}

	stats.CommitsCount = count
	stats.UpdatedAt = time.Now()

	return s.db.RepositoryStats.Save().One(stats)
}

func (s *StatsService) UpdateLastCommitAt(repoID int64, t *time.Time) error {
	stats, err := s.getOrCreateStats(repoID)
	if err != nil {
		return err
	}

	stats.LastCommitAt = t
	stats.UpdatedAt = time.Now()

	return s.db.RepositoryStats.Save().One(stats)
}

func (s *StatsService) GetRepositoryStats(repoID int64) (*models.RepositoryStats, error) {
	return s.getOrCreateStats(repoID)
}
