package handlers

import (
	"context"
	"strconv"
	"time"

	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/gofiber/fiber/v3"
)

// ListBackups returns the backup history.
func ListBackups(c fiber.Ctx) error {
	db := models.GetDB()
	limit := 50
	if n := c.Query("limit"); n != "" {
		if v, err := strconv.Atoi(n); err == nil && v > 0 {
			limit = v
		}
	}

	bs := services.NewBackupService(db)
	backups, err := bs.ListBackups(limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"backups": backups})
}

// CreateBackup starts a full or incremental backup.
func CreateBackup(c fiber.Ctx) error {
	var req struct {
		Name       string `json:"name"`
		BackupType string `json:"backup_type"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.BackupType != "full" && req.BackupType != "incremental" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "backup_type must be full or incremental"})
	}
	if req.Name == "" {
		req.Name = time.Now().UTC().Format("2006-01-02 15:04:05")
	}

	db := models.GetDB()
	bs := services.NewBackupService(db)
	ctx := context.Background()

	var backup *models.Backup
	var err error
	if req.BackupType == "full" {
		backup, err = bs.CreateFullBackup(ctx, req.Name)
	} else {
		backup, err = bs.CreateIncrementalBackup(ctx, req.Name)
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{"backup": backup})
}

// RestoreBackup restores data from a backup.
func RestoreBackup(c fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid backup id"})
	}

	db := models.GetDB()
	bs := services.NewBackupService(db)
	if err := bs.RestoreBackup(context.Background(), id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "restore completed"})
}

// CronFullBackup is meant to be called by an external system cron to create a full backup.
func CronFullBackup(c fiber.Ctx) error {
	db := models.GetDB()
	bs := services.NewBackupService(db)
	name := time.Now().UTC().Format("cron-full-2006-01-02_15-04-05")
	backup, err := bs.CreateFullBackup(context.Background(), name)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{"backup": backup})
}

// CronIncrementalBackup is meant to be called by an external system cron to create an incremental backup.
func CronIncrementalBackup(c fiber.Ctx) error {
	db := models.GetDB()
	bs := services.NewBackupService(db)
	name := time.Now().UTC().Format("cron-incr-2006-01-02_15-04-05")
	backup, err := bs.CreateIncrementalBackup(context.Background(), name)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{"backup": backup})
}
