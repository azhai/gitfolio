package handlers

import (
	"context"
	"fmt"
	"time"

	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/gofiber/fiber/v3"
)

// SyncPullRepository 从远程仓库拉取更新，并同步 Issues 和 PR 数据
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
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
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

// SyncPushRepository 推送本地仓库到远程地址
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
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		result.Repo.LocalPath = localPath
		err = db.Repository.Save().One(result.Repo)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save local path"})
		}
	}

	syncSvc := services.NewSyncService(db)
	if err := syncSvc.PushRepository(result.Repo.LocalPath, req.RemoteURL); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Repository pushed successfully"})
}
