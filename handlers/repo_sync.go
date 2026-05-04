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

// SyncPullRepository 推送本地仓库所有分支和标签到远程，并同步 Issues 和 PR 数据
func SyncPullRepository(c fiber.Ctx) error {
	var req struct {
		RemoteURL string `json:"remote_url"`
	}
	c.Bind().JSON(&req)

	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	if !result.Repo.IsMirror || result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Not a mirror repository or local path not set"})
	}

	syncSvc := services.NewSyncService(db)

	if req.RemoteURL != "" && req.RemoteURL != result.Repo.MirrorURL {
		result.Repo.MirrorURL = req.RemoteURL
		if err = db.Repository.Save().One(result.Repo); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update remote URL"})
		}
		syncSvc.SetRemoteURL(result.Repo.LocalPath, req.RemoteURL)
	}

	gitResult, err := syncSvc.SyncPushAll(result.Repo.LocalPath)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   fmt.Sprintf("Git push failed: %v", err),
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
	err = db.Repository.Save().One(result.Repo)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update sync time"})
	}

	remoteRepo, err := syncSvc.GetRemoteRepoInfo(result.Repo.ID)
	if err != nil || remoteRepo == nil {
		if result.Repo.MirrorURL != "" {
			remoteRepo = syncSvc.CreateRemoteRepoFromMirrorURL(result.Repo.ID, result.Repo.MirrorURL)
		}
	}

	var syncError string
	var syncResult services.SyncResult
	if remoteRepo != nil {
		token := ""
		if remoteRepo.AccountID != nil {
			t, err := syncSvc.GetSyncToken(*remoteRepo.AccountID)
			if err == nil && t != nil {
				token = t.AccessToken
			}
		}

		ctx := context.Background()
		syncResult, err = syncSvc.SyncRepositoryData(ctx, result.Repo.ID, remoteRepo.Platform, remoteRepo.Owner, remoteRepo.RepoName, token)
		if err != nil {
			syncError = err.Error()
		}
	} else {
		syncError = fmt.Sprintf("No remote repo found for repository ID %d", result.Repo.ID)
	}

	resp := fiber.Map{
		"message":         "Repository pushed successfully",
		"last_sync":       now.Format("2006-01-02T15:04:05Z07:00"),
		"issues_inserted": syncResult.IssuesInserted,
		"issues_updated":  syncResult.IssuesUpdated,
		"prs_inserted":    syncResult.PRsInserted,
		"prs_updated":     syncResult.PRsUpdated,
		"total_synced":    syncResult.IssuesInserted + syncResult.IssuesUpdated + syncResult.PRsInserted + syncResult.PRsUpdated,
		"git": fiber.Map{
			"command":     gitResult.Command,
			"output":      gitResult.Output,
			"success":     gitResult.Success,
			"local_path":  gitResult.LocalPath,
			"proxy":       gitResult.ProxyURL,
			"duration_ms": gitResult.DurationMs,
			"log_id":      gitResult.LogID,
		},
	}

	if syncError != "" {
		resp["warning"] = syncError
	}

	return c.Status(fiber.StatusOK).JSON(resp)
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
