package handlers

import (
	"fmt"
	"strconv"
	"time"

	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/gofiber/fiber/v3"
)

func GetSyncConfig(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()
	schedulerSvc := services.NewSchedulerService(db)

	syncType := "stats"
	if result.Repo.IsRemote() {
		syncType = "mirror"
	}

	sp, err := schedulerSvc.GetOrCreateSyncPoint(result.Repo.ID, syncType)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get sync config"})
	}

	resp := fiber.Map{
		"sync_type":     sp.SyncType,
		"sync_interval": sp.SyncInterval,
		"is_paused":     sp.IsPaused,
		"last_sync_at":  nil,
		"next_sync_at":  nil,
		"last_error":    sp.LastError,
		"failure_count": sp.FailureCount,
		"project_type":  result.Repo.ProjectType,
	}
	if sp.LastSyncAt != nil {
		resp["last_sync_at"] = helpers.FormatTime(*sp.LastSyncAt)
	}
	if sp.LastSuccessAt != nil {
		resp["last_success_at"] = helpers.FormatTime(*sp.LastSuccessAt)
	}
	if sp.NextSyncAt != nil {
		resp["next_sync_at"] = helpers.FormatTime(*sp.NextSyncAt)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

func UpdateSyncConfig(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	var req struct {
		SyncInterval int  `json:"sync_interval"`
		IsPaused     bool `json:"is_paused"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.SyncInterval < 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Sync interval cannot be negative"})
	}
	if req.SyncInterval > 3596400 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Sync interval must be at most 999 hours (3596400 seconds)"})
	}
	if req.SyncInterval > 0 && req.SyncInterval < 60 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Sync interval must be at least 60 seconds (1 minute) when not manual"})
	}

	db := models.GetDB()
	schedulerSvc := services.NewSchedulerService(db)

	syncType := "stats"
	if result.Repo.IsRemote() {
		syncType = "mirror"
	}

	sp, err := schedulerSvc.UpdateSyncConfig(result.Repo.ID, syncType, req.SyncInterval, req.IsPaused)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("Failed to update sync config: %v", err)})
	}

	resp := fiber.Map{
		"sync_type":     sp.SyncType,
		"sync_interval": sp.SyncInterval,
		"is_paused":     sp.IsPaused,
		"last_error":    sp.LastError,
		"failure_count": sp.FailureCount,
		"last_sync_at":  nil,
		"next_sync_at":  nil,
	}
	if sp.LastSyncAt != nil {
		resp["last_sync_at"] = helpers.FormatTime(*sp.LastSyncAt)
	}
	if sp.LastSuccessAt != nil {
		resp["last_success_at"] = helpers.FormatTime(*sp.LastSuccessAt)
	}
	if sp.NextSyncAt != nil {
		resp["next_sync_at"] = helpers.FormatTime(*sp.NextSyncAt)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

func GetSyncLogs(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()
	schedulerSvc := services.NewSchedulerService(db)

	logs, err := schedulerSvc.GetSyncLogs(result.Repo.ID, 20)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get sync logs"})
	}

	items := make([]fiber.Map, len(logs))
	for i, l := range logs {
		item := fiber.Map{
			"id":           l.ID,
			"sync_type":    l.SyncType,
			"status":       l.Status,
			"message":      l.Message,
			"duration":     l.Duration,
			"items_synced": l.ItemsSynced,
			"items_failed": l.ItemsFailed,
			"created_at":   helpers.FormatTime(l.CreatedAt),
		}
		items[i] = item
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"logs": items})
}

func ListAllSyncPoints(c fiber.Ctx) error {
	db := models.GetDB()
	schedulerSvc := services.NewSchedulerService(db)

	syncPoints, err := schedulerSvc.ListAllSyncPoints()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("Failed to list sync points: %v", err)})
	}

	items := make([]fiber.Map, len(syncPoints))
	for i, sp := range syncPoints {
		item := fiber.Map{
			"id":              sp.ID,
			"repository_id":   sp.RepositoryID,
			"owner_name":      sp.OwnerName,
			"repo_name":       sp.RepoName,
			"project_type":    sp.ProjectType,
			"sync_type":       sp.SyncType,
			"sync_interval":   sp.SyncInterval,
			"is_paused":       sp.IsPaused,
			"failure_count":   sp.FailureCount,
			"last_error":      sp.LastError,
			"last_sync_at":    nil,
			"last_success_at": nil,
			"next_sync_at":    nil,
		}
		if sp.LastSyncAt != nil {
			item["last_sync_at"] = helpers.FormatTime(*sp.LastSyncAt)
		}
		if sp.LastSuccessAt != nil {
			item["last_success_at"] = helpers.FormatTime(*sp.LastSuccessAt)
		}
		if sp.NextSyncAt != nil {
			item["next_sync_at"] = helpers.FormatTime(*sp.NextSyncAt)
		}
		items[i] = item
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"sync_points": items})
}

func AdminUpdateSyncPoint(c fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid sync point ID"})
	}

	var req struct {
		SyncInterval int  `json:"sync_interval"`
		IsPaused     bool `json:"is_paused"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.SyncInterval < 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Sync interval cannot be negative"})
	}
	if req.SyncInterval > 3596400 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Sync interval must be at most 999 hours (3596400 seconds)"})
	}
	if req.SyncInterval > 0 && req.SyncInterval < 60 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Sync interval must be at least 60 seconds (1 minute) when not manual"})
	}

	db := models.GetDB()
	syncPoints, err := db.SyncPoint.Select().Where("id = ?", id).All()
	if err != nil || len(syncPoints) == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Sync point not found"})
	}

	sp := syncPoints[0]
	sp.SyncInterval = req.SyncInterval
	sp.IsPaused = req.IsPaused
	if !req.IsPaused && req.SyncInterval > 0 {
		now := time.Now()
		nextSync := now.Add(time.Duration(req.SyncInterval) * time.Second)
		sp.NextSyncAt = &nextSync
	} else if req.SyncInterval <= 0 {
		sp.NextSyncAt = nil
	}

	if err := db.SyncPoint.Save().One(sp); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update sync point"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Sync point updated"})
}

func ListAllSyncLogs(c fiber.Ctx) error {
	limitStr := c.Query("limit", "50")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	db := models.GetDB()
	schedulerSvc := services.NewSchedulerService(db)

	logs, err := schedulerSvc.ListAllSyncLogs(limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list sync logs"})
	}

	items := make([]fiber.Map, len(logs))
	for i, l := range logs {
		items[i] = fiber.Map{
			"id":            l.ID,
			"sync_point_id": l.SyncPointID,
			"owner_name":    l.OwnerName,
			"repo_name":     l.RepoName,
			"sync_type":     l.SyncType,
			"status":        l.Status,
			"message":       l.Message,
			"duration":      l.Duration,
			"items_synced":  l.ItemsSynced,
			"items_failed":  l.ItemsFailed,
			"created_at":    helpers.FormatTime(l.CreatedAt),
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"logs": items})
}
