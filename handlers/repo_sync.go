package handlers

import (
	"context"
	"fmt"
	"log"
	"time"

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

	// 无论同步是从同步页还是其它入口触发，都先确保有同步点，否则本次结果
	// 没有地方落日志，页面上就会永远显示「暂无同步记录」。
	sp, spErr := services.NewSchedulerService(db).GetOrCreateSyncPoint(result.Repo.ID, "mirror")
	if spErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to prepare sync point"})
	}

	gitResult, err := syncSvc.SyncPullRepository(result.Repo.LocalPath)
	if err != nil {
		msg := fmt.Sprintf("Git pull failed: %v", err)
		gitInfo := fiber.Map{}
		var duration int64
		if gitResult != nil {
			duration = gitResult.DurationMs
			gitInfo = fiber.Map{
				"command":     gitResult.Command,
				"output":      gitResult.Output,
				"local_path":  gitResult.LocalPath,
				"proxy":       gitResult.ProxyURL,
				"duration_ms": gitResult.DurationMs,
				"log_id":      gitResult.LogID,
			}
		}
		syncSvc.LogSync(sp.ID, "mirror", "failure", msg, duration, 0, 0, "")
		syncSvc.UpdateSyncPoint(sp.ID, false, msg)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   msg,
			"details": err.Error(),
			"git":     gitInfo,
		})
	}

	now := time.Now().UTC()
	result.Repo.LastSyncAt = &now
	if err = db.Repository.Save().One(result.Repo); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update sync time"})
	}
	syncSvc.LogSync(sp.ID, "mirror", "success", "", gitResult.DurationMs, 0, 0, "")
	// 只写 LastSyncAt 会把失败计数和上次的报错留着，页面一直显示几个小时前的问题。
	syncSvc.UpdateSyncPoint(sp.ID, true, "")

	// 拉到新提交后刷新统计，否则提交数、贡献者要等到下一次议题同步才更新。
	statsSvc := services.NewStatsService(db)
	if err := statsSvc.UpdateRepositoryStats(result.Repo.ID, result.OwnerName(), result.Repo.Name); err != nil {
		log.Printf("failed to refresh stats after pulling %s/%s: %v", result.OwnerName(), result.Repo.Name, err)
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

	token := syncSvc.ResolveSyncToken(remoteRepo.Platform, remoteRepo.AccountID)

	// 同步点按需创建；没有同步点时既写不了 running 日志，也留不下最终结果。
	syncPoint, spErr := services.NewSchedulerService(db).GetOrCreateSyncPoint(result.Repo.ID, "mirror")
	if spErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to prepare sync point"})
	}
	syncPointID := syncPoint.ID
	lastIssueSyncAt := syncPoint.LastIssueSyncAt
	lastPRSyncAt := syncPoint.LastPRSyncAt
	lastIssueNumber := syncPoint.LastIssueNumber
	lastPRNumber := syncPoint.LastPRNumber

	repoID := result.Repo.ID
	platform := remoteRepo.Platform
	remoteOwner := remoteRepo.Owner
	remoteRepoName := remoteRepo.RepoName

	// 先拿锁再写 running 日志，否则并发的第二次请求会留下一条永远不会结束的
	// 「同步中」记录，页面轮询也就停不下来。
	if !services.TryLockSync(repoID) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Sync is already running for this repository"})
	}

	var runningLogID int64
	runningLog := &models.SyncLog{
		SyncPointID: syncPointID,
		SyncType:    "mirror",
		Status:      "running",
		CreatedAt:   time.Now().UTC(),
	}
	if err := db.SyncLog.Insert().One(runningLog); err == nil {
		runningLogID = runningLog.ID
	}

	go func() {
		defer services.UnlockSync(repoID)

		ctx := context.Background()
		startTime := time.Now()
		syncResult, err := syncSvc.SyncRepositoryData(ctx, repoID, platform, remoteOwner, remoteRepoName, token, lastIssueSyncAt, lastPRSyncAt, lastIssueNumber, lastPRNumber, nil)
		duration := time.Since(startTime).Milliseconds()

		if err != nil {
			if runningLogID > 0 {
				syncSvc.UpdateSyncLog(runningLogID, "failure", err.Error(), duration, 0, 0)
			} else if syncPointID > 0 {
				syncSvc.LogSync(syncPointID, "mirror", "failure", err.Error(), duration, 0, 0, "")
			}
			if syncPointID > 0 {
				syncSvc.UpdateSyncPoint(syncPointID, false, err.Error())
			}
			return
		}

		totalSynced := syncResult.IssuesInserted + syncResult.IssuesUpdated + syncResult.PRsInserted + syncResult.PRsUpdated
		if runningLogID > 0 {
			syncSvc.UpdateSyncLog(runningLogID, "success", syncResult.FailureNote, duration, int64(totalSynced), 0)
		} else if syncPointID > 0 {
			syncSvc.LogSync(syncPointID, "mirror", "success", syncResult.FailureNote, duration, totalSynced, 0, "")
		}
		// 手动同步也要清掉失败计数和错误，否则同步页会一直挂着几个小时前的报错。
		if syncPointID > 0 {
			syncSvc.UpdateSyncPoint(syncPointID, true, "")
		}

		now := time.Now().UTC()
		if repo, findErr := db.Repository.Select().Where("id = ?", repoID).One(); findErr == nil {
			repo.LastSyncAt = &now
			db.Repository.Save().One(repo)
		}

		if syncPointID > 0 {
			sp, findErr := db.SyncPoint.Select().Where("id = ?", syncPointID).One()
			if findErr == nil && sp != nil {
				sp.LastSyncAt = &now
				// 没有同步到数据时保留原水位，否则下一轮会跳过还没拉取的区间。
				if syncResult.MaxIssueUpdatedAt != nil {
					sp.LastIssueSyncAt = syncResult.MaxIssueUpdatedAt
				}
				if syncResult.MaxPRUpdatedAt != nil {
					sp.LastPRSyncAt = syncResult.MaxPRUpdatedAt
				}
				if syncResult.MaxIssueNumber > sp.LastIssueNumber {
					sp.LastIssueNumber = syncResult.MaxIssueNumber
				}
				if syncResult.MaxPRNumber > sp.LastPRNumber {
					sp.LastPRNumber = syncResult.MaxPRNumber
				}
				db.SyncPoint.Save().One(sp)
			}
		}
	}()

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"message": "Sync started",
	})
}

func SyncPushRepository(c fiber.Ctx) error {
	var req struct {
		RemoteURL  string `json:"remote_url"`
		RemoteName string `json:"remote_name"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if !result.Repo.CanPushRemote() {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only public, private or local projects can push to remote"})
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
	if req.RemoteName != "" {
		err = syncSvc.PushRepositoryByName(result.Repo.LocalPath, req.RemoteName)
	} else {
		err = syncSvc.PushRepository(result.Repo.LocalPath, req.RemoteURL)
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Repository pushed successfully"})
}
