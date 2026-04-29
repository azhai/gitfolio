package handlers

import (
	"time"

	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/azhai/goent"
	"github.com/gofiber/fiber/v3"
)

// ReleaseAuthorResponse 发布作者响应
type ReleaseAuthorResponse struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	FullName string `json:"full_name"`
	Avatar   string `json:"avatar"`
}

// ReleaseResponse 发布版本响应
type ReleaseResponse struct {
	ID           int64                 `json:"id"`
	TagName      string                `json:"tag_name"`
	Title        string                `json:"title"`
	Body         string                `json:"body"`
	Author       ReleaseAuthorResponse `json:"author"`
	IsDraft      bool                  `json:"is_draft"`
	IsPrerelease bool                  `json:"is_prerelease"`
	CreatedAt    time.Time             `json:"created_at"`
	UpdatedAt    time.Time             `json:"updated_at"`
	Assets       []AssetResponse       `json:"assets"`
	TarballURL   string                `json:"tarball_url"`
	ZipballURL   string                `json:"zipball_url"`
	HTMLURL      string                `json:"html_url"`
}

// AssetResponse 发布附件响应
type AssetResponse struct {
	ID                 int64     `json:"id"`
	Name               string    `json:"name"`
	Label              string    `json:"label"`
	ContentType        string    `json:"content_type"`
	Size               int64     `json:"size"`
	DownloadCount      int       `json:"download_count"`
	BrowserDownloadURL string    `json:"browser_download_url"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// ListReleases 获取仓库发布版本列表
func ListReleases(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	releases, err := db.Release.Select().Where("repository_id = ?", result.Repo.ID).
		OrderBy("created_at DESC").
		All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch releases",
		})
	}

	authorIDs := make([]int64, 0)
	for _, release := range releases {
		if release.AuthorID > 0 {
			authorIDs = append(authorIDs, release.AuthorID)
		}
	}

	usersMap := make(map[int64]*models.User)
	if len(authorIDs) > 0 {
		users, err := db.User.Select().Filter(
			goent.In(db.User.Field("id"), authorIDs),
		).All()
		if err == nil {
			for _, u := range users {
				usersMap[u.ID] = u
			}
		}
	}

	defaultAuthor := ReleaseAuthorResponse{
		ID:       0,
		Username: "unknown",
		Email:    "",
		FullName: "",
		Avatar:   "",
	}

	response := make([]ReleaseResponse, 0, len(releases))
	for _, release := range releases {
		author := defaultAuthor
		if user, ok := usersMap[release.AuthorID]; ok {
			author = ReleaseAuthorResponse{
				ID:       user.ID,
				Username: user.Username,
				Email:    user.Email,
				FullName: user.FullName,
				Avatar:   user.Avatar,
			}
		}

		response = append(response, ReleaseResponse{
			ID:           release.ID,
			TagName:      release.TagName,
			Title:        release.Title,
			Body:         release.Body,
			Author:       author,
			IsDraft:      release.IsDraft,
			IsPrerelease: release.IsPrerelease,
			CreatedAt:    release.CreatedAt,
			UpdatedAt:    release.UpdatedAt,
			Assets:       []AssetResponse{},
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":  response,
		"total": len(response),
	})
}

// GetRelease 获取单个发布版本详情
func GetRelease(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	tag := c.Params("tag")
	if tag == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Tag is required",
		})
	}

	db := models.GetDB()

	release, err := db.Release.Select().Where("repository_id = ? AND tag_name = ?", result.Repo.ID, tag).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Release not found",
		})
	}

	author := ReleaseAuthorResponse{
		ID:       0,
		Username: "unknown",
		Email:    "",
		FullName: "",
		Avatar:   "",
	}

	if release.AuthorID > 0 {
		user, err := db.User.Select().Where("id = ?", release.AuthorID).One()
		if err == nil {
			author = ReleaseAuthorResponse{
				ID:       user.ID,
				Username: user.Username,
				Email:    user.Email,
				FullName: user.FullName,
				Avatar:   user.Avatar,
			}
		}
	}

	response := ReleaseResponse{
		ID:           release.ID,
		TagName:      release.TagName,
		Title:        release.Title,
		Body:         release.Body,
		Author:       author,
		IsDraft:      release.IsDraft,
		IsPrerelease: release.IsPrerelease,
		CreatedAt:    release.CreatedAt,
		UpdatedAt:    release.UpdatedAt,
		Assets:       []AssetResponse{},
	}

	return c.Status(fiber.StatusOK).JSON(response)
}

// SyncReleases 从远程仓库同步发布版本数据
func SyncReleases(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if !result.Repo.IsMirror {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Only mirror repositories can sync releases",
		})
	}

	db := models.GetDB()

	remoteRepo, err := db.RemoteRepository.Select().Where("repository_id = ?", result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Remote repository not found",
		})
	}

	var token string
	if remoteRepo.AccountID != nil {
		syncToken, err := db.SyncToken.Select().Where("account_id = ?", *remoteRepo.AccountID).One()
		if err == nil {
			token = syncToken.AccessToken
		}
	}

	githubSvc := services.NewGitHubService(token)

	releases, err := githubSvc.GetReleases(remoteRepo.Owner, remoteRepo.RepoName)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch releases from GitHub: " + err.Error(),
		})
	}

	userID := helpers.GetCurrentUserID(c)

	syncedCount := 0
	for _, ghRelease := range releases {
		existingRelease, err := db.Release.Select().Where("repository_id = ? AND tag_name = ?", result.Repo.ID, ghRelease.TagName).One()

		if err != nil {
			newRelease := &models.Release{
				TagName:      ghRelease.TagName,
				Title:        ghRelease.Name,
				Body:         ghRelease.Body,
				RepositoryID: result.Repo.ID,
				AuthorID:     userID,
				IsDraft:      ghRelease.Draft,
				IsPrerelease: ghRelease.Prerelease,
				CreatedAt:    ghRelease.CreatedAt,
				UpdatedAt:    ghRelease.PublishedAt,
			}

			if err := db.Release.Insert().One(newRelease); err == nil {
				syncedCount++
			}
		} else {
			existingRelease.Title = ghRelease.Name
			existingRelease.Body = ghRelease.Body
			existingRelease.IsDraft = ghRelease.Draft
			existingRelease.IsPrerelease = ghRelease.Prerelease
			existingRelease.UpdatedAt = ghRelease.PublishedAt

			if err := db.Release.Save().One(existingRelease); err == nil {
				syncedCount++
			}
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Releases synced successfully",
		"synced":  syncedCount,
		"total":   len(releases),
	})
}
