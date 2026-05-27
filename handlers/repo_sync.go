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

	if !result.Repo.IsRemote() || result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Not a remote repository or local path not set"})
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

	now := time.Now().UTC()
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

	if !result.Repo.IsRemote() {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Not a remote repository"})
	}

	if services.IsSyncing(result.Repo.ID) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Sync is already running for this repository"})
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

	syncPoints, _ := db.SyncPoint.Select().Where("repository_id = ? AND sync_type = ?", result.Repo.ID, "mirror").All()
	var syncPointID int64
	var lastIssueSyncAt *time.Time
	var lastPRSyncAt *time.Time
	var lastIssueNumber, lastPRNumber int
	if len(syncPoints) > 0 {
		syncPointID = syncPoints[0].ID
		lastIssueSyncAt = syncPoints[0].LastIssueSyncAt
		lastPRSyncAt = syncPoints[0].LastPRSyncAt
		lastIssueNumber = syncPoints[0].LastIssueNumber
		lastPRNumber = syncPoints[0].LastPRNumber
	}

	repoID := result.Repo.ID
	platform := remoteRepo.Platform
	remoteOwner := remoteRepo.Owner
	remoteRepoName := remoteRepo.RepoName

	var runningLogID int64
	if syncPointID > 0 {
		runningLog := &models.SyncLog{
			SyncPointID: syncPointID,
			SyncType:    "mirror",
			Status:      "running",
			CreatedAt:   time.Now().UTC(),
		}
		if err := db.SyncLog.Insert().One(runningLog); err == nil {
			runningLogID = runningLog.ID
		}
	}

	if !services.TryLockSync(repoID) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Sync is already running for this repository"})
	}

	go func() {
		defer services.UnlockSync(repoID)

		ctx := context.Background()
		startTime := time.Now()
		syncResult, err := syncSvc.SyncRepositoryData(ctx, repoID, platform, remoteOwner, remoteRepoName, token, lastIssueSyncAt, lastPRSyncAt, lastIssueNumber, lastPRNumber)
		duration := time.Since(startTime).Milliseconds()

		if err != nil {
			if runningLogID > 0 {
				syncSvc.UpdateSyncLog(runningLogID, "failure", err.Error(), duration, 0, 0)
			} else if syncPointID > 0 {
				syncSvc.LogSync(syncPointID, "mirror", "failure", err.Error(), duration, 0, 0, "")
			}
			return
		}

		totalSynced := syncResult.IssuesInserted + syncResult.IssuesUpdated + syncResult.PRsInserted + syncResult.PRsUpdated
		if runningLogID > 0 {
			syncSvc.UpdateSyncLog(runningLogID, "success", "", duration, int64(totalSynced), 0)
		} else if syncPointID > 0 {
			syncSvc.LogSync(syncPointID, "mirror", "success", "", duration, totalSynced, 0, "")
		}

		now := time.Now().UTC()
		if repo, findErr := db.Repository.Select().Where("id = ?", repoID).One(); findErr == nil {
			repo.LastSyncAt = &now
			db.Repository.Save().One(repo)
		}

		if syncPointID > 0 {
			sp := syncPoints[0]
			sp.LastSyncAt = &now
			sp.LastIssueSyncAt = &now
			sp.LastPRSyncAt = &now
			sp.LastIssueNumber = syncResult.IssuesInserted + syncResult.IssuesUpdated
			sp.LastPRNumber = syncResult.PRsInserted + syncResult.PRsUpdated
			db.SyncPoint.Save().One(sp)
		}
	}()

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"message": "Sync started",
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

	if !result.Repo.CanPushRemote() {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only public or private projects can push to remote"})
	}

	db := models.GetDB()

	if result.Repo.LocalPath == "" {
		syncSvc := services.NewSyncService(db)
		localPath, err := syncSvc.InitBareRepository(result.OwnerName(), result.Repo.Name)
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
