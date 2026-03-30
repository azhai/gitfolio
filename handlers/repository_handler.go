package handlers

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/gofiber/fiber/v3"
)

type CreateRepositoryRequest struct {
	Name        string `json:"name" validate:"required,min=1,max=255"`
	Description string `json:"description"`
	Homepage    string `json:"homepage"`
	IsPrivate   bool   `json:"is_private"`
	CloneURL    string `json:"clone_url"`
}

type UpdateRepositoryRequest struct {
	Name          string `json:"name"`
	Description   string `json:"description"`
	Homepage      string `json:"homepage"`
	IsPrivate     *bool  `json:"is_private"`
	DefaultBranch string `json:"default_branch"`
}

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
		if stats.LastCommitAt != nil {
			response.LastCommitAt = stats.LastCommitAt.Format("2006-01-02T15:04:05Z07:00")
		}
	}

	return response
}

func CreateRepository(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)
	var req CreateRepositoryRequest

	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := models.GetDB()

	ownerUser, err := db.User.Select().Where("id = ?", userID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	existingRepo, _ := db.Repository.Select().Where("owner_id = ? AND name = ?", userID, req.Name).One()
	if existingRepo != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Repository with this name already exists"})
	}

	repo := &models.Repository{
		Name:          req.Name,
		Description:   req.Description,
		Homepage:      req.Homepage,
		OwnerID:       userID,
		IsPrivate:     req.IsPrivate,
		DefaultBranch: "main",
	}

	if req.CloneURL != "" {
		repo.IsMirror = true
		repo.MirrorURL = req.CloneURL
		repo.ProjectType = "mirror"

		if strings.Contains(req.CloneURL, "github.com") {
			syncSvc := services.NewSyncService(db)
			if ghRepo, err := syncSvc.FetchGitHubRepoInfo(req.CloneURL); err == nil {
				if repo.Description == "" && ghRepo.Description != "" {
					repo.Description = ghRepo.Description
				}
				if repo.Homepage == "" && ghRepo.Homepage != "" {
					repo.Homepage = ghRepo.Homepage
				}
			}
		}

		gitSvc := services.NewGitService()
		localPath, err := gitSvc.CloneRepository(ownerUser.Username, req.Name, req.CloneURL, true)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		repo.LocalPath = localPath
	}

	err = db.Repository.Insert().One(repo)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create repository"})
	}

	stats := &models.RepositoryStats{
		RepositoryID: repo.ID,
	}
	if err := db.RepositoryStats.Insert().One(stats); err != nil {
		fmt.Printf("Warning: failed to create repository stats: %v\n", err)
	}

	return c.Status(fiber.StatusCreated).JSON(ToRepositoryResponse(repo, ownerUser))
}

func GetGitHubRepoInfo(c fiber.Ctx) error {
	cloneURL := c.Query("url")
	if cloneURL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "URL parameter is required"})
	}

	if !strings.Contains(cloneURL, "github.com") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Only GitHub URLs are supported"})
	}

	db := models.GetDB()
	syncSvc := services.NewSyncService(db)
	ghRepo, err := syncSvc.FetchGitHubRepoInfo(cloneURL)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"name":        ghRepo.Name,
		"description": ghRepo.Description,
		"homepage":    ghRepo.Homepage,
	})
}

func GetRepository(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	return c.Status(fiber.StatusOK).JSON(ToRepositoryResponse(result.Repo, result.Owner))
}

func ListRepositories(c fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", strconv.Itoa(config.DefaultPage)))
	perPage, _ := strconv.Atoi(c.Query("per_page", strconv.Itoa(config.DefaultPerPage)))
	if perPage > config.MaxPerPage {
		perPage = config.MaxPerPage
	}

	db := models.GetDB()

	query := db.Repository.Select()

	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		query = query.Where("is_private = ?", false)
	}

	repos, err := query.Skip((page - 1) * perPage).Take(perPage).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch repositories"})
	}

	var response []*RepositoryResponse
	response = make([]*RepositoryResponse, 0)
	for _, repo := range repos {
		ownerUser, err := db.User.Select().Where("id = ?", repo.OwnerID).One()
		if err != nil {
			continue
		}
		response = append(response, ToRepositoryResponse(repo, ownerUser))
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":     response,
		"page":     page,
		"per_page": perPage,
	})
}

func UpdateRepository(c fiber.Ctx) error {
	var req UpdateRepositoryRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	if req.Name != "" {
		result.Repo.Name = req.Name
	}
	if req.Description != "" {
		result.Repo.Description = req.Description
	}
	if req.Homepage != "" {
		result.Repo.Homepage = req.Homepage
	}
	if req.IsPrivate != nil {
		result.Repo.IsPrivate = *req.IsPrivate
	}
	if req.DefaultBranch != "" {
		result.Repo.DefaultBranch = req.DefaultBranch
	}

	err = db.Repository.Save().One(result.Repo)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update repository"})
	}

	return c.Status(fiber.StatusOK).JSON(result.Repo)
}

func DeleteRepository(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	err = db.Repository.Delete().Where("id = ?", result.Repo.ID).Exec()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete repository"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Repository deleted successfully"})
}

func StarRepository(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	existingStar, _ := db.Star.Select().Where("user_id = ? AND repository_id = ?", userID, result.Repo.ID).One()
	if existingStar != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Already starred"})
	}

	star := &models.Star{
		UserID:       userID,
		RepositoryID: result.Repo.ID,
	}

	err = db.Star.Insert().One(star)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to star repository"})
	}

	statsSvc := services.NewStatsService(db)
	stats, _ := statsSvc.GetRepositoryStats(result.Repo.ID)
	if stats != nil {
		stats.StarsCount++
		db.RepositoryStats.Save().One(stats)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Repository starred successfully"})
}

func UnstarRepository(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	err = db.Star.Delete().Where("user_id = ? AND repository_id = ?", userID, result.Repo.ID).Exec()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to unstar repository"})
	}

	statsSvc := services.NewStatsService(db)
	stats, _ := statsSvc.GetRepositoryStats(result.Repo.ID)
	if stats != nil && stats.StarsCount > 0 {
		stats.StarsCount--
		db.RepositoryStats.Save().One(stats)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Repository unstarred successfully"})
}

func WatchRepository(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	existingWatch, _ := db.Watch.Select().Where("user_id = ? AND repository_id = ?", userID, result.Repo.ID).One()
	if existingWatch != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Already watching"})
	}

	watch := &models.Watch{
		UserID:       userID,
		RepositoryID: result.Repo.ID,
	}

	err = db.Watch.Insert().One(watch)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to watch repository"})
	}

	statsSvc := services.NewStatsService(db)
	stats, _ := statsSvc.GetRepositoryStats(result.Repo.ID)
	if stats != nil {
		stats.WatchCount++
		db.RepositoryStats.Save().One(stats)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Watching repository successfully"})
}

func UnwatchRepository(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	err = db.Watch.Delete().Where("user_id = ? AND repository_id = ?", userID, result.Repo.ID).Exec()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to unwatch repository"})
	}

	statsSvc := services.NewStatsService(db)
	stats, _ := statsSvc.GetRepositoryStats(result.Repo.ID)
	if stats != nil && stats.WatchCount > 0 {
		stats.WatchCount--
		db.RepositoryStats.Save().One(stats)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Unwatched repository successfully"})
}

func SyncPullRepository(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	if !result.Repo.IsMirror || result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Not a mirror repository or local path not set"})
	}

	syncSvc := services.NewSyncService(db)
	if err := syncSvc.SyncPullRepository(result.Repo.LocalPath); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	now := time.Now()
	result.Repo.LastSyncAt = &now
	err = db.Repository.Save().One(result.Repo)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update sync time"})
	}

	syncedIssues := 0
	syncedPRs := 0

	remoteRepo, err := syncSvc.GetRemoteRepoInfo(result.Repo.ID)
	if err != nil || remoteRepo == nil {
		if result.Repo.MirrorURL != "" {
			remoteRepo = syncSvc.CreateRemoteRepoFromMirrorURL(result.Repo.ID, result.Repo.MirrorURL)
		}
	}

	if remoteRepo != nil {
		token := ""
		if remoteRepo.AccountID != nil {
			t, err := syncSvc.GetSyncToken(*remoteRepo.AccountID)
			if err == nil && t != nil {
				token = t.AccessToken
			}
		}

		ctx := context.Background()
		if err := syncSvc.SyncRepositoryData(ctx, result.Repo.ID, remoteRepo.Platform, remoteRepo.Owner, remoteRepo.RepoName, token); err != nil {
			fmt.Printf("Sync data error: %v\n", err)
		} else {
			syncedIssues = 1
			syncedPRs = 1
		}
	} else {
		fmt.Printf("No remote repo found for repository ID %d\n", result.Repo.ID)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":       "Repository synced successfully",
		"last_sync":     now.Format("2006-01-02T15:04:05Z07:00"),
		"synced_issues": syncedIssues,
		"synced_prs":    syncedPRs,
	})
}

func SyncPushRepository(c fiber.Ctx) error {
	var req struct {
		RemoteURL string `json:"remote_url"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	if result.Repo.LocalPath == "" {
		syncSvc := services.NewSyncService(db)
		localPath, err := syncSvc.InitBareRepository(result.Owner.Username, result.Repo.Name)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": err.Error(),
			})
		}
		result.Repo.LocalPath = localPath
		err = db.Repository.Save().One(result.Repo)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save local path"})
		}
	}

	syncSvc := services.NewSyncService(db)
	if err := syncSvc.PushRepository(result.Repo.LocalPath, req.RemoteURL); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Repository pushed successfully"})
}

func GetRepositoryTree(c fiber.Ctx) error {
	path := c.Query("path", "")
	ref := c.Query("ref", "HEAD")

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	gitSvc := services.NewGitService()
	entries, err := gitSvc.GetTreeWithSize(result.Owner.Username, result.Repo.Name, ref, path)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Type != entries[j].Type {
			return entries[i].Type == "tree"
		}
		return entries[i].Name < entries[j].Name
	})

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"path":    path,
		"ref":     ref,
		"entries": entries,
	})
}

func GetRepositoryFile(c fiber.Ctx) error {
	path := c.Query("path", "")
	ref := c.Query("ref", "HEAD")

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	gitSvc := services.NewGitService()
	content, err := gitSvc.GetFileContentByRef(result.Owner.Username, result.Repo.Name, ref, path)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "File not found"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"path":    path,
		"ref":     ref,
		"content": content,
	})
}

func GetRepositoryBranches(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"branches": []string{}})
	}

	gitSvc := services.NewGitService()
	branches, err := gitSvc.GetAllBranches(result.Owner.Username, result.Repo.Name)
	if err != nil {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"branches": []string{}})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"branches": branches})
}
