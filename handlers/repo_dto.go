package handlers

import (
	"github.com/azhai/gitfolio/models"
)

type CreateRepositoryRequest struct {
	Name          string `json:"name" validate:"required,min=1,max=255"`
	Description   string `json:"description"`
	Homepage      string `json:"homepage"`
	ProjectType   string `json:"project_type"`
	DefaultBranch string `json:"default_branch"`
	CloneURL      string `json:"clone_url"`
}

type UpdateRepositoryRequest struct {
	Name          string `json:"name"`
	Description   string `json:"description"`
	Homepage      string `json:"homepage"`
	ProjectType   string `json:"project_type"`
	DefaultBranch string `json:"default_branch"`
	MirrorURL     string `json:"mirror_url"`
}

type RepositoryResponse struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	Homepage      string `json:"homepage"`
	Readme        string `json:"readme"`
	Owner         string `json:"owner"`
	OwnerID       int64  `json:"owner_id"`
	OwnerType     string `json:"owner_type"`
	ProjectType   string `json:"project_type"`
	IsFork        bool   `json:"is_fork"`
	IsMirror      bool   `json:"is_mirror"`
	CanPushRemote bool   `json:"can_push_remote"`
	MirrorURL     string `json:"mirror_url"`
	LocalPath     string `json:"local_path"`
	LastSyncAt    string `json:"last_sync_at"`
	StarsCount    int    `json:"stars_count"`
	ForksCount    int    `json:"forks_count"`
	WatchCount    int    `json:"watch_count"`
	DefaultBranch string `json:"default_branch"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`

	CommitsCount      int    `json:"commits_count"`
	BranchesCount     int    `json:"branches_count"`
	TagsCount         int    `json:"tags_count"`
	ContributorsCount int    `json:"contributors_count"`
	LastCommitAt      string `json:"last_commit_at"`
	OpenIssuesCount   int    `json:"open_issues_count"`
	ClosedIssuesCount int    `json:"closed_issues_count"`
	OpenPRsCount      int    `json:"open_prs_count"`
	ClosedPRsCount    int    `json:"closed_prs_count"`
	MergedPRsCount    int    `json:"closed_prs_count"`
	IsStarred         bool   `json:"is_starred"`
	IsWatched         bool   `json:"is_watched"`
}

type ContributorResponse struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	Avatar       string `json:"avatar"`
	CommitsCount int    `json:"commits_count"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

func ToRepositoryResponse(repo *models.Repository, owner *models.User, group *models.Group) *RepositoryResponse {
	var lastSyncAt string
	if repo.LastSyncAt != nil {
		lastSyncAt = repo.LastSyncAt.Format("2006-01-02T15:04:05Z07:00")
	}

	ownerName := ""
	if repo.IsLocal() {
		ownerName = "local"
	} else if repo.OwnerType == "group" && group != nil {
		ownerName = group.Name
	} else if owner != nil {
		ownerName = owner.Username
	}

	response := &RepositoryResponse{
		ID:            repo.ID,
		Name:          repo.Name,
		Description:   repo.Description,
		Homepage:      repo.Homepage,
		Readme:        repo.Readme,
		Owner:         ownerName,
		OwnerID:       repo.OwnerID,
		OwnerType:     repo.OwnerType,
		ProjectType:   repo.ProjectType,
		IsFork:        repo.IsFork,
		IsMirror:      repo.IsMirror(),
		CanPushRemote: repo.CanPushRemote(),
		MirrorURL:     repo.MirrorURL,
		LocalPath:     repo.LocalPath,
		LastSyncAt:    lastSyncAt,
		DefaultBranch: repo.DefaultBranch,
		CreatedAt:     repo.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:     repo.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	db := models.GetDB()
	stats, err := db.RepositoryStats.Select().Where("repository_id = ?", repo.ID).One()
	if repo.LastCommitAt != nil {
		response.LastCommitAt = repo.LastCommitAt.Format("2006-01-02T15:04:05Z07:00")
	}
	if err == nil && stats != nil {
		response.StarsCount = stats.StarsCount
		response.ForksCount = stats.ForksCount
		response.WatchCount = stats.WatchCount
		response.CommitsCount = stats.CommitsCount
		response.BranchesCount = stats.BranchesCount
		response.TagsCount = stats.TagsCount
		response.ContributorsCount = stats.ContributorsCount
		response.OpenIssuesCount = stats.OpenIssuesCount
		response.ClosedIssuesCount = stats.ClosedIssuesCount
		response.OpenPRsCount = stats.OpenPRsCount
		response.ClosedPRsCount = stats.ClosedPRsCount
		response.MergedPRsCount = stats.MergedPRsCount
		if response.LastCommitAt == "" && stats.LastCommitAt != nil {
			response.LastCommitAt = stats.LastCommitAt.Format("2006-01-02T15:04:05Z07:00")
		}
	}

	return response
}
