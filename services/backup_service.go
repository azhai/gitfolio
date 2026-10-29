package services

import (
	"context"
	"fmt"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent/backup"
)

// libpqBackupDSN 去掉连接串里的 search_path。libpq 不认这个参数，pg_dump 和 psql 会
// 直接拒绝整个 URI；驱动却接受它，所以应用的 DSN 一直带着。备份和恢复的每条语句都写了
// schema 限定名，不依赖 search_path，去掉是安全的。
func libpqBackupDSN(dsn string) string {
	if !strings.HasPrefix(dsn, "postgres://") && !strings.HasPrefix(dsn, "postgresql://") {
		return dsn
	}
	u, err := url.Parse(dsn)
	if err != nil || !u.Query().Has("search_path") {
		return dsn
	}

	q := u.Query()
	q.Del("search_path")
	u.RawQuery = q.Encode()

	return u.String()
}

// BackupService handles full/incremental backups and restore.
type BackupService struct {
	db     *models.Database
	engine *backup.Engine
}

// NewBackupService creates a new backup service.
func NewBackupService(db *models.Database) *BackupService {
	cfg := backup.Config{
		Dir:                     backupDir(),
		DSN:                     libpqBackupDSN(config.GetConfig().Database.DSN),
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

// ListBackups returns all backups newest first.
// 用 id 而不是 created_at 排序：回填过的历史行共享同一个时间戳，按时间排序会给出随机顺序。
func (s *BackupService) ListBackups(limit int) ([]*models.Backup, error) {
	q := s.db.Backup.Select().OrderBy("id DESC")
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
	}
	backup.Stamp()
	backup.StartedAt = timePtr(backup.CreatedAt)
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
		OrderBy("id DESC").One()
	if err != nil || full == nil {
		return nil, fmt.Errorf("no successful full backup found")
	}

	backup := &models.Backup{
		Name:         name,
		BackupType:   "incremental",
		BaseBackupID: &full.ID,
		Status:       "running",
	}
	backup.Stamp()
	backup.StartedAt = timePtr(backup.CreatedAt)
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
