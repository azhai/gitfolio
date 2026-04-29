package handlers

import (
	"github.com/azhai/gitfolio/models"
)

// CreateRepositoryRequest 创建仓库请求
type CreateRepositoryRequest struct {
	Name          string `json:"name" validate:"required,min=1,max=255"`
	Description   string `json:"description"`
	Homepage      string `json:"homepage"`
	IsPrivate     bool   `json:"is_private"`
	DefaultBranch string `json:"default_branch"`
	CloneURL      string `json:"clone_url"`
}

// UpdateRepositoryRequest 更新仓库请求
type UpdateRepositoryRequest struct {
	Name          string `json:"name"`
	Description   string `json:"description"`
	Homepage      string `json:"homepage"`
	IsPrivate     *bool  `json:"is_private"`
	DefaultBranch string `json:"default_branch"`
}

// RepositoryResponse 仓库详情响应，包含统计信息
type RepositoryResponse struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	Homepage      string `json:"homepage"`
	Readme        string `json:"readme"`
	Owner         string `json:"owner"`
	OwnerID       int64  `json:"owner_id"`
	ProjectType   string `json:"project_type"`
	IsPrivate     bool   `json:"is_private"`
	IsFork        bool   `json:"is_fork"`
	IsMirror      bool   `json:"is_mirror"`
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
	TagsCount         int    `json:"tags_count"`
	ContributorsCount int    `json:"contributors_count"`
	LastCommitAt      string `json:"last_commit_at"`
	OpenIssuesCount   int    `json:"open_issues_count"`
	ClosedIssuesCount int    `json:"closed_issues_count"`
	OpenPRsCount      int    `json:"open_prs_count"`
	ClosedPRsCount    int    `json:"closed_prs_count"`
	MergedPRsCount    int    `json:"merged_prs_count"`
}

// ContributorResponse 贡献者响应
type ContributorResponse struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	Avatar       string `json:"avatar"`
	CommitsCount int    `json:"commits_count"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

// ToRepositoryResponse 将仓库模型转换为 API 响应，自动填充统计数据
func ToRepositoryResponse(repo *models.Repository, owner *models.User) *RepositoryResponse {
	var lastSyncAt string
	if repo.LastSyncAt != nil {
		lastSyncAt = repo.LastSyncAt.Format("2006-01-02T15:04:05Z07:00")
	}

	response := &RepositoryResponse{
		ID:            repo.ID,
		Name:          repo.Name,
		Description:   repo.Description,
		Homepage:      repo.Homepage,
		Readme:        repo.Readme,
		Owner:         owner.Username,
		OwnerID:       repo.OwnerID,
		ProjectType:   repo.ProjectType,
		IsPrivate:     repo.IsPrivate,
		IsFork:        repo.IsFork,
		IsMirror:      repo.IsMirror,
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
