package models

import (
	"context"
	"fmt"
	"strings"

	"github.com/azhai/goent/rename"
)

// EnsureETagTable creates the etag table if it is missing.
// goent.AutoMigrate should normally create it, but older databases or failed
// migrations may leave it absent. This function fills that gap without
// depending on the full auto-migration pipeline.
func EnsureETagTable(db *Database) error {
	if db == nil || db.DB == nil {
		return fmt.Errorf("database not initialized")
	}

	driverName := strings.ToLower(db.Driver().Name())
	var sql string
	switch driverName {
	case "postgres", "postgresql":
		sql = `CREATE TABLE IF NOT EXISTS etag (
			id BIGSERIAL PRIMARY KEY,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			url TEXT UNIQUE NOT NULL,
			etag TEXT NOT NULL
		)`
	default: // sqlite and others
		sql = `CREATE TABLE IF NOT EXISTS etag (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			url TEXT UNIQUE NOT NULL,
			etag TEXT NOT NULL
		)`
	}

	err := db.RawExecContext(context.Background(), sql)
	if err != nil && !strings.Contains(err.Error(), "already exists") {
		return err
	}

	// Ensure created_at has a default for upserts that omit the column.
	// AutoMigrate may have created the table without the default before this
	// helper ran, so the ALTER is idempotent and repairs existing tables.
	// SQLite does not support ALTER COLUMN SET DEFAULT, but new SQLite tables
	// are already created with the default above.
	if driverName == "postgres" || driverName == "postgresql" {
		sql = `ALTER TABLE etag ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP`
		if err := db.RawExecContext(context.Background(), sql); err != nil {
			return err
		}
	}
	return nil
}

// EnsureSyncPointETagColumn ensures the sync_point table has a last_etag column.
// Older databases may use the legacy last_e_tag name; this migration renames it
// if present, or adds the column if neither exists.
func EnsureSyncPointETagColumn(db *Database) error {
	if db == nil || db.DB == nil {
		return fmt.Errorf("database not initialized")
	}
	return rename.Column{Table: "sync_point", OldName: "last_e_tag", NewName: "last_etag"}.Apply(db.DB)
}

// EnsureContributorGitHubIDColumn ensures the contributor table has a github_id
// column. Legacy databases may have created it as git_hub_id; this migration
// renames it when present and preserves existing data.
func EnsureContributorGitHubIDColumn(db *Database) error {
	if db == nil || db.DB == nil {
		return fmt.Errorf("database not initialized")
	}
	return rename.Column{Table: "contributor", OldName: "git_hub_id", NewName: "github_id"}.Apply(db.DB)
}

// EnsureCommentGitHubIDColumn ensures the comment table has a github_id column.
// Legacy databases may have created it as git_hub_id; this migration renames it
// when present and preserves existing data.
func EnsureCommentGitHubIDColumn(db *Database) error {
	if db == nil || db.DB == nil {
		return fmt.Errorf("database not initialized")
	}
	return rename.Column{Table: "comment", OldName: "git_hub_id", NewName: "github_id"}.Apply(db.DB)
}

// EnsureRepositoryStatsPRColumns ensures the repository_stats table uses the
// correct column names for PR counts. Without the "PR" abbreviation, older
// migrations may have created open_p_rs_count / closed_p_rs_count instead of
// open_prs_count / closed_prs_count. This migration renames them.
func EnsureRepositoryStatsPRColumns(db *Database) error {
	if db == nil || db.DB == nil {
		return fmt.Errorf("database not initialized")
	}
	openRen := rename.Column{Table: "repository_stats", OldName: "open_p_rs_count", NewName: "open_prs_count"}
	if err := openRen.Apply(db.DB); err != nil {
		return err
	}
	closedRen := rename.Column{Table: "repository_stats", OldName: "closed_p_rs_count", NewName: "closed_prs_count"}
	return closedRen.Apply(db.DB)
}

// EnsureIssueStatusColumn ensures the issue table has a status column.
// Used to mark issues as hidden when they are deleted on GitHub.
func EnsureIssueStatusColumn(db *Database) error {
	if db == nil || db.DB == nil {
		return fmt.Errorf("database not initialized")
	}
	driverName := strings.ToLower(db.Driver().Name())
	ctx := context.Background()

	// 检查列是否已存在：尝试查询，如果报错说明列不存在
	// 用 information_schema（postgres）或 pragma（sqlite）更可靠
	var colExists bool
	switch driverName {
	case "postgres", "postgresql":
		var cnt int
		if err := db.RawQueryRowContext(ctx,
			"SELECT count(*) FROM information_schema.columns WHERE table_name = 'issue' AND column_name = 'status'").Scan(&cnt); err == nil {
			colExists = cnt > 0
		}
	default:
		// SQLite: PRAGMA table_info
		var cnt int
		if err := db.RawQueryRowContext(ctx,
			"SELECT count(*) FROM pragma_table_info('issue') WHERE name = 'status'").Scan(&cnt); err == nil {
			colExists = cnt > 0
		}
	}
	if colExists {
		return nil
	}

	// 添加列
	var sql string
	switch driverName {
	case "postgres", "postgresql":
		sql = `ALTER TABLE issue ADD COLUMN status VARCHAR DEFAULT 'open'`
	default:
		sql = `ALTER TABLE issue ADD COLUMN status TEXT DEFAULT 'open'`
	}
	if err := db.RawExecContext(ctx, sql); err != nil {
		return fmt.Errorf("failed to add issue.status column: %w", err)
	}

	// 创建索引
	idxSQL := `CREATE INDEX IF NOT EXISTS idx_issue_status ON issue (status)`
	if err := db.RawExecContext(ctx, idxSQL); err != nil {
		// 索引创建失败不阻塞，只记录
		_ = err
	}

	// 回填：根据 is_closed 设置初始 status
	backfillSQL := `UPDATE issue SET status = CASE WHEN is_closed = true THEN 'closed' ELSE 'open' END`
	if err := db.RawExecContext(ctx, backfillSQL); err != nil {
		return fmt.Errorf("failed to backfill issue.status: %w", err)
	}
	return nil
}
