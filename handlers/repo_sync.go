package handlers

import (
	"context"
	"fmt"
	"time"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/gofiber/fiber/v3"
)

func SyncPullRepository(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	if !result.Repo.IsMirror() || result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Not a mirror repository or local path not set"})
	}

	syncSvc := services.NewSyncService(db)

	gitResult, err := syncSvc.SyncPullRepository(result.Repo.LocalPath)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   fmt.Sprintf("Git pull failed: %v", err),
			"details": err.Error(),
			"git": fiber.Map{
				"command":     gitResult.Command,
				"output":      gitResult.Output,
				"local_path":  gitResult.LocalPath,
				"proxy":       gitResult.ProxyURL,
				"duration_ms": gitResult.DurationMs,
				"log_id":      gitResult.LogID,
			},
		})
	}

	now := time.Now()
	result.Repo.LastSyncAt = &now
	if err = db.Repository.Save().One(result.Repo); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update sync time"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":   "Code pulled successfully",
		"last_sync": helpers.FormatTime(now),
		"git": fiber.Map{
			"command":     gitResult.Command,
			"output":      gitResult.Output,
			"success":     gitResult.Success,
			"local_path":  gitResult.LocalPath,
			"proxy":       gitResult.ProxyURL,
			"duration_ms": gitResult.DurationMs,
			"log_id":      gitResult.LogID,
		},
	})
}

func SyncIssuesData(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	if !result.Repo.IsMirror() {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Not a mirror repository"})
	}

	syncSvc := services.NewSyncService(db)

	remoteRepo, err := syncSvc.GetRemoteRepoInfo(result.Repo.ID)
	if err != nil || remoteRepo == nil {
		if result.Repo.MirrorURL != "" {
			remoteRepo = syncSvc.CreateRemoteRepoFromMirrorURL(result.Repo.ID, result.Repo.MirrorURL)
		}
	}

	if remoteRepo == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fmt.Sprintf("No remote repo found for repository ID %d", result.Repo.ID),
		})
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

	ctx := context.Background()
	startTime := time.Now()
	syncResult, err := syncSvc.SyncRepositoryData(ctx, result.Repo.ID, remoteRepo.Platform, remoteRepo.Owner, remoteRepo.RepoName, token)
	duration := time.Since(startTime).Milliseconds()

	syncPoints, _ := db.SyncPoint.Select().Where("repository_id = ? AND sync_type = ?", result.Repo.ID, "mirror").All()
	var syncPointID int64
	if len(syncPoints) > 0 {
		syncPointID = syncPoints[0].ID
	}

	if err != nil {
		if syncPointID > 0 {
			syncSvc.LogSync(syncPointID, "mirror", "failure", err.Error(), duration, 0, 0, "")
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   fmt.Sprintf("Failed to sync issues: %v", err),
			"details": err.Error(),
		})
	}

	if syncPointID > 0 {
		syncSvc.LogSync(syncPointID, "mirror", "success", "", duration, syncResult.IssuesInserted+syncResult.IssuesUpdated+syncResult.PRsInserted+syncResult.PRsUpdated, 0, "")
	}

	now := time.Now()
	result.Repo.LastSyncAt = &now
	db.Repository.Save().One(result.Repo)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":         "Issues synced successfully",
		"last_sync":       helpers.FormatTime(now),
		"issues_inserted": syncResult.IssuesInserted,
		"issues_updated":  syncResult.IssuesUpdated,
		"prs_inserted":    syncResult.PRsInserted,
		"prs_updated":     syncResult.PRsUpdated,
		"total_synced":    syncResult.IssuesInserted + syncResult.IssuesUpdated + syncResult.PRsInserted + syncResult.PRsUpdated,
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
