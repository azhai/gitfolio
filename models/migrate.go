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

// EnsureRepoRootColumns ensures the user and group tables have a repo_root
// column. Databases created before the "own repository directory" feature do
// not have it, and AutoMigrate does not add columns to existing tables.
func EnsureRepoRootColumns(db *Database) error {
	if db == nil || db.DB == nil {
		return fmt.Errorf("database not initialized")
	}
	for _, table := range []string{"user", "group"} {
		if err := ensureColumn(db, table, "repo_root", "TEXT"); err != nil {
			return err
		}
	}
	return nil
}

// ensureColumn adds a column to a table when it is missing.
//
// 表名与列名全部来自代码内的常量，不拼接任何用户输入。
// 原生 SQL 里不能使用 "?" 占位符：驱动不会把它改写成 PostgreSQL 的 $1，
// 因此这里统一拼接字面量。
func ensureColumn(db *Database, table, column, colType string) error {
	ctx := context.Background()
	driverName := strings.ToLower(db.Driver().Name())

	var cnt int
	isPG := driverName == "postgres" || driverName == "postgresql"
	schema := ""
	if isPG {
		// 表可能不在默认 search_path 上（例如 folio schema），先定位它。
		schema = pgSchemaFor(db, table)
	}

	switch {
	case isPG:
		query := fmt.Sprintf(
			"SELECT count(*) FROM information_schema.columns WHERE table_name = '%s' AND column_name = '%s'",
			table, column)
		if schema != "" {
			query += fmt.Sprintf(" AND table_schema = '%s'", schema)
		}
		if err := db.RawQueryRowContext(ctx, query).Scan(&cnt); err != nil {
			return fmt.Errorf("failed to inspect %s.%s: %w", table, column, err)
		}
	default: // sqlite: PRAGMA table_info
		query := fmt.Sprintf("SELECT count(*) FROM pragma_table_info('%s') WHERE name = '%s'", table, column)
		if err := db.RawQueryRowContext(ctx, query).Scan(&cnt); err != nil {
			return fmt.Errorf("failed to inspect %s.%s: %w", table, column, err)
		}
	}
	if cnt > 0 {
		return nil
	}

	target := quoteIdent(table)
	if isPG && schema != "" {
		target = quoteIdent(schema) + "." + quoteIdent(table)
	}
	sql := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s DEFAULT ''", target, quoteIdent(column), colType)
	if err := db.RawExecContext(ctx, sql); err != nil {
		return fmt.Errorf("failed to add %s.%s column: %w", table, column, err)
	}
	// 把 NULL 归一化为默认空字符串，避免读取时出现 NULL 扫描错误。
	_ = db.RawExecContext(ctx,
		fmt.Sprintf("UPDATE %s SET %s = '' WHERE %s IS NULL", target, quoteIdent(column), quoteIdent(column)))
	return nil
}

// quoteIdent 用双引号包裹标识符，兼容 PostgreSQL 与 SQLite，
// 同时避免 user 这类保留字导致的语法错误。
func quoteIdent(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

// pgSchemaFor 返回表所在的 schema，优先当前 schema。
// 查不到时返回空字符串，调用方退化为依赖 search_path。
func pgSchemaFor(db *Database, table string) string {
	query := fmt.Sprintf(
		"SELECT table_schema FROM information_schema.tables WHERE table_name = '%s' "+
			"ORDER BY (table_schema = current_schema()) DESC LIMIT 1", table)
	var schema string
	if err := db.RawQueryRowContext(context.Background(), query).Scan(&schema); err != nil {
		return ""
	}
	return schema
}

// MigrateOrphanRepositories 迁移旧版本的本地仓库：
//   - OwnerID = 0 的仓库（旧代码创建本地项目时清空了归属）挂到第一个管理员账号；
//   - LocalPath 为空的仓库按当前存储规则回填落盘路径。
//
// globalRepoRoot 是全局裸仓库根目录。
func MigrateOrphanRepositories(db *Database, globalRepoRoot string) error {
	if db == nil || db.DB == nil {
		return fmt.Errorf("database not initialized")
	}

	repos, err := db.Repository.Select().All()
	if err != nil {
		return fmt.Errorf("failed to load repositories: %w", err)
	}
	if len(repos) == 0 {
		return nil
	}

	orphans := make([]*Repository, 0)
	for _, repo := range repos {
		if repo.OwnerID == 0 {
			orphans = append(orphans, repo)
		}
	}

	var fallbackOwnerID int64
	if len(orphans) > 0 {
		admin, err := db.User.Select().Where("role = ?", "admin").One()
		if err != nil || admin == nil {
			// 没有管理员时退化为第一个用户，避免仓库永远无主。
			user, err2 := db.User.Select().One()
			if err2 != nil || user == nil {
				return fmt.Errorf("no user available to own %d orphan repositories", len(orphans))
			}
			fallbackOwnerID = user.ID
		} else {
			fallbackOwnerID = admin.ID
		}
	}

	users := make(map[int64]*User)
	groups := make(map[int64]*Group)
	for _, repo := range repos {
		switch repo.OwnerType {
		case "group":
			if _, ok := groups[repo.OwnerID]; !ok && repo.OwnerID != 0 {
				if g, err := db.Group.Select().Where("id = ?", repo.OwnerID).One(); err == nil && g != nil {
					groups[repo.OwnerID] = g
				}
			}
		default:
			if _, ok := users[repo.OwnerID]; !ok && repo.OwnerID != 0 {
				if u, err := db.User.Select().Where("id = ?", repo.OwnerID).One(); err == nil && u != nil {
					users[repo.OwnerID] = u
				}
			}
		}
	}

	for _, repo := range repos {
		changed := false
		if repo.OwnerID == 0 && fallbackOwnerID != 0 {
			repo.OwnerID = fallbackOwnerID
			repo.OwnerType = "user"
			if _, ok := users[fallbackOwnerID]; !ok {
				if user, err := db.User.Select().Where("id = ?", fallbackOwnerID).One(); err == nil && user != nil {
					users[fallbackOwnerID] = user
				}
			}
			changed = true
		}

		account, repoRoot := accountAndRootFor(repo, users, groups)
		if strings.TrimSpace(repo.LocalPath) == "" {
			repo.LocalPath = ResolveRepoLocationUnder(globalRepoRoot, account, repoRoot, repo.Name).Path
			changed = true
		}
		if changed {
			if err := db.Repository.Save().One(repo); err != nil {
				return fmt.Errorf("failed to migrate repository %d (%s): %w", repo.ID, repo.Name, err)
			}
		}
	}

	return nil
}

// accountAndRootFor 返回仓库所属账号的名称与自有仓库目录。
func accountAndRootFor(repo *Repository, users map[int64]*User, groups map[int64]*Group) (string, string) {
	if repo.OwnerType == "group" {
		if g, ok := groups[repo.OwnerID]; ok && g != nil {
			return g.Name, g.RepoRoot
		}
	} else if u, ok := users[repo.OwnerID]; ok && u != nil {
		return u.Username, u.RepoRoot
	}
	return "local", ""
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
