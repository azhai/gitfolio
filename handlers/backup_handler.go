package handlers

import (
	"context"
	"strconv"

	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/gofiber/fiber/v3"
)

// BackupResponse 是备份记录对外输出的字段。直接序列化 models.Backup 会用 Go 的
// 字段名（ID/CreatedAt/…），前端按 snake_case 取不到值。
type BackupResponse struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	BackupType string `json:"backup_type"`
	Status     string `json:"status"`
	SizeBytes  int64  `json:"size_bytes"`
	Error      string `json:"error"`
	StartedAt  string `json:"started_at"`
	FinishedAt string `json:"finished_at"`
}

func ToBackupResponse(b *models.Backup) *BackupResponse {
	if b == nil {
		return nil
	}
	res := &BackupResponse{
		ID:         b.ID,
		Name:       b.Name,
		BackupType: b.BackupType,
		Status:     b.Status,
		SizeBytes:  b.Size,
		Error:      b.Error,
	}
	if b.StartedAt != nil {
		res.StartedAt = helpers.FormatTime(*b.StartedAt)
	}
	if b.CompletedAt != nil {
		res.FinishedAt = helpers.FormatTime(*b.CompletedAt)
	}
	return res
}

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
	items := make([]*BackupResponse, len(backups))
	for i, b := range backups {
		items[i] = ToBackupResponse(b)
	}
	return c.JSON(fiber.Map{"backups": items})
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
		req.Name = helpers.DisplayNow().Format("2006-01-02 15:04:05")
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
	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{"backup": ToBackupResponse(backup)})
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
	name := helpers.DisplayNow().Format("cron-full-2006-01-02_15-04-05")
	backup, err := bs.CreateFullBackup(context.Background(), name)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{"backup": ToBackupResponse(backup)})
}

// CronIncrementalBackup is meant to be called by an external system cron to create an incremental backup.
func CronIncrementalBackup(c fiber.Ctx) error {
	db := models.GetDB()
	bs := services.NewBackupService(db)
	name := helpers.DisplayNow().Format("cron-incr-2006-01-02_15-04-05")
	backup, err := bs.CreateIncrementalBackup(context.Background(), name)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{"backup": ToBackupResponse(backup)})
}
