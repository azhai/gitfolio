package services

import (
	"context"
	"fmt"
	"path/filepath"
	"time"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent/backup"
)

// BackupService handles full/incremental backups and restore.
type BackupService struct {
	db     *models.Database
	engine *backup.Engine
}

// NewBackupService creates a new backup service.
func NewBackupService(db *models.Database) *BackupService {
	cfg := backup.Config{
		Dir:                     backupDir(),
		DSN:                     config.GetConfig().Database.DSN,
		Schema:                  "folio",
		LogTables:               []string{"sync_log", "git_command_log"},
		ExcludedFromIncremental: []string{"backup", "sync_log", "git_command_log"},
	}
	if cfg.Dir == "" {
		cfg.Dir = "./backups"
	}
	return &BackupService{db: db, engine: backup.New(db.DB, cfg)}
}

func backupDir() string {
	root := config.GetRepoRoot()
	if root == "" {
		root = "./data"
	}
	return filepath.Join(root, "..", "backups")
}

// ListBackups returns all backups ordered by creation time desc.
func (s *BackupService) ListBackups(limit int) ([]*models.Backup, error) {
	q := s.db.Backup.Select().OrderBy("created_at DESC")
	if limit > 0 {
		q = q.Take(limit)
	}
	return q.All()
}

// GetBackup returns a backup by ID.
func (s *BackupService) GetBackup(id int64) (*models.Backup, error) {
	return s.db.Backup.Select().Where("id = ?", id).One()
}

// CreateFullBackup starts and completes a full backup.
func (s *BackupService) CreateFullBackup(ctx context.Context, name string) (*models.Backup, error) {
	backup := &models.Backup{
		Name:       name,
		BackupType: "full",
		Status:     "running",
		StartedAt:  timePtr(time.Now().UTC()),
	}
	if err := s.db.Backup.Insert().One(backup); err != nil {
		return nil, err
	}

	go s.runFullBackup(backup)
	return backup, nil
}

// CreateIncrementalBackup creates an incremental backup based on the most recent successful full backup.
func (s *BackupService) CreateIncrementalBackup(ctx context.Context, name string) (*models.Backup, error) {
	full, err := s.db.Backup.Select().
		Where("backup_type = ? AND status = ?", "full", "success").
		OrderBy("created_at DESC").One()
	if err != nil || full == nil {
		return nil, fmt.Errorf("no successful full backup found")
	}

	backup := &models.Backup{
		Name:         name,
		BackupType:   "incremental",
		BaseBackupID: &full.ID,
		Status:       "running",
		StartedAt:    timePtr(time.Now().UTC()),
	}
	if err := s.db.Backup.Insert().One(backup); err != nil {
		return nil, err
	}

	go s.runIncrementalBackup(backup, full)
	return backup, nil
}

// RestoreBackup restores from a full backup, or a full + incremental backup pair.
func (s *BackupService) RestoreBackup(ctx context.Context, backupID int64) error {
	backup, err := s.GetBackup(backupID)
	if err != nil {
		return err
	}
	if backup.Status != "success" {
		return fmt.Errorf("cannot restore from a non-successful backup")
	}

	baseID := backup.ID
	if backup.BackupType == "incremental" && backup.BaseBackupID != nil {
		baseID = *backup.BaseBackupID
	}

	base, err := s.GetBackup(baseID)
	if err != nil {
		return err
	}
	if base.Status != "success" {
		return fmt.Errorf("base full backup is not successful")
	}

	if err := s.engine.Restore(ctx, base.Path, false); err != nil {
		return fmt.Errorf("restore full backup failed: %w", err)
	}
	if backup.BackupType == "incremental" {
		if err := s.engine.Restore(ctx, backup.Path, true); err != nil {
			return fmt.Errorf("restore incremental backup failed: %w", err)
		}
	}
	return nil
}

func (s *BackupService) runFullBackup(backup *models.Backup) {
	res := s.engine.Full(context.Background(), backup.Name)
	s.finishBackup(backup, res)
}

func (s *BackupService) runIncrementalBackup(backup, base *models.Backup) {
	since := time.Time{}
	if base != nil && base.StartedAt != nil {
		since = *base.StartedAt
	}
	res := s.engine.Incremental(context.Background(), backup.Name, since)
	s.finishBackup(backup, res)
}

func (s *BackupService) finishBackup(backup *models.Backup, res backup.Result) {
	now := time.Now().UTC()
	backup.Path = res.Path
	backup.Size = res.Size
	backup.CompletedAt = timePtr(now)
	backup.UpdatedAt = now
	if res.Err != nil {
		backup.Status = "failure"
		backup.Error = res.Err.Error()
	} else {
		backup.Status = "success"
	}
	_ = s.db.Backup.Save().One(backup)
}

func timePtr(t time.Time) *time.Time {
	return &t
}
