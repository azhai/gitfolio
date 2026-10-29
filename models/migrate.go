package models

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

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
	if columnExists(db, table, column) {
		return nil
	}

	target := tableTarget(db, table)
	sql := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s DEFAULT ''", target, quoteIdent(column), colType)
	if err := db.RawExecContext(context.Background(), sql); err != nil {
		return fmt.Errorf("failed to add %s.%s column: %w", table, column, err)
	}
	// 把 NULL 归一化为默认空字符串，避免读取时出现 NULL 扫描错误。
	_ = db.RawExecContext(context.Background(),
		fmt.Sprintf("UPDATE %s SET %s = '' WHERE %s IS NULL", target, quoteIdent(column), quoteIdent(column)))
	return nil
}

// columnExists 判断表里是否已经有某一列。
func columnExists(db *Database, table, column string) bool {
	ctx := context.Background()
	driverName := strings.ToLower(db.Driver().Name())
	isPG := driverName == "postgres" || driverName == "postgresql"

	var query string
	if isPG {
		schema := pgSchemaFor(db, table)
		query = fmt.Sprintf(
			"SELECT count(*) FROM information_schema.columns WHERE table_name = '%s' AND column_name = '%s'",
			table, column)
		if schema != "" {
			query += fmt.Sprintf(" AND table_schema = '%s'", schema)
		}
	} else { // sqlite: PRAGMA table_info
		query = fmt.Sprintf("SELECT count(*) FROM pragma_table_info('%s') WHERE name = '%s'", table, column)
	}

	var cnt int
	if err := db.RawQueryRowContext(ctx, query).Scan(&cnt); err != nil {
		return false
	}
	return cnt > 0
}

// tableTarget 返回可直接用于 SQL 的表名；PostgreSQL 的表可能不在默认 search_path 上。
func tableTarget(db *Database, table string) string {
	driverName := strings.ToLower(db.Driver().Name())
	if driverName == "postgres" || driverName == "postgresql" {
		if schema := pgSchemaFor(db, table); schema != "" {
			return quoteIdent(schema) + "." + quoteIdent(table)
		}
	}
	return quoteIdent(table)
}

// duplicateURLColumns 是历史遗留的重复列：模型字段 SSHURL/APIURL 曾经带上
// db:"sshurl"/db:"apiurl" 标签，AutoMigrate 于是又建了一遍同义的列。两边都 NOT NULL
// 且没有默认值，只有一边会被写入，另一边的插入就会直接失败。数据在规范列上。
var duplicateURLColumns = []struct{ table, dup, canonical string }{
	{"remote_repository", "sshurl", "ssh_url"},
	{"remote_repository", "apiurl", "api_url"},
	{"platform_account", "apiurl", "api_url"},
}

// DropDuplicateURLColumns 删掉这些同义列，删之前把只在旧列里的值补到规范列上。
func DropDuplicateURLColumns(db *Database) error {
	if db == nil || db.DB == nil {
		return fmt.Errorf("database not initialized")
	}
	ctx := context.Background()

	for _, c := range duplicateURLColumns {
		if !columnExists(db, c.table, c.dup) {
			continue
		}
		target := tableTarget(db, c.table)
		if columnExists(db, c.table, c.canonical) {
			if err := db.RawExecContext(ctx, fmt.Sprintf(
				"UPDATE %s SET %s = %s WHERE %s = '' AND %s <> ''",
				target, quoteIdent(c.canonical), quoteIdent(c.dup),
				quoteIdent(c.canonical), quoteIdent(c.dup))); err != nil {
				return fmt.Errorf("failed to backfill %s.%s: %w", c.table, c.canonical, err)
			}
		}
		if err := db.RawExecContext(ctx, fmt.Sprintf("ALTER TABLE %s DROP COLUMN %s",
			target, quoteIdent(c.dup))); err != nil {
			return fmt.Errorf("failed to drop %s.%s: %w", c.table, c.dup, err)
		}
	}
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
		if resolved := resolveStoredPath(globalRepoRoot, account, repoRoot, repo); resolved != repo.LocalPath {
			repo.LocalPath = resolved
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

// resolveStoredPath 返回仓库实际可用的绝对落盘路径。
//
// 依次尝试：记录值（相对路径按进程工作目录绝对化，并校验存在）>
// 按当前规则计算的路径 > 旧命名的 <name>.git。都找不到时返回规则路径，
// 供后续重新克隆或初始化时使用。
func resolveStoredPath(globalRoot, account, repoRoot string, repo *Repository) string {
	if p := strings.TrimSpace(repo.LocalPath); p != "" {
		abs := p
		if !filepath.IsAbs(abs) {
			if a, err := filepath.Abs(abs); err == nil {
				abs = a
			}
		}
		if dirExists(abs) {
			return abs
		}
	}

	loc := ResolveRepoLocationUnder(globalRoot, account, repoRoot, repo.Name, repo.ProjectType)
	if dirExists(loc.Path) {
		return loc.Path
	}
	if legacy := loc.Path + ".git"; dirExists(legacy) {
		return legacy
	}
	return loc.Path
}

// dirExists 报告路径是否为已存在的目录。
func dirExists(path string) bool {
	fi, err := os.Stat(path)
	return err == nil && fi.IsDir()
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

// CleanupDuplicateRepositoryNumbers collapses duplicate issue / pull_request
// rows that share the same repository and number. It is a one-off repair for
// databases written by older sync runs that inserted without an existence
// check: those copies inflate counters, return duplicate list rows and make
// x-for keys collide in the UI. Comments and labels attached to a removed copy
// are moved to the row that is kept (the most recently updated one, newest id
// as tie-breaker), because they carry user-visible content.
//
// A unique index would express this invariant better, but goent's PostgreSQL
// migrator drops any unique index that covers a foreign-key column it does not
// declare (it mistakes it for an o2o constraint) and its model tags cannot
// reference repository_id because that field is declared m2o. Uniqueness is
// therefore enforced by the sync paths (existence check before insert, plus a
// per-repository "already syncing" guard in the scheduler); this function
// only repairs data left over from before those guards existed.
func CleanupDuplicateRepositoryNumbers(db *Database) error {
	if db == nil || db.DB == nil {
		return fmt.Errorf("database not initialized")
	}
	ctx := context.Background()

	targets := []struct {
		table  string
		refs   []string // table.column pairs pointing at the row id
		dedupe []string // cleanup statements, run after refs are moved
	}{
		{
			table: "issue",
			refs:  []string{"comment.issue_id", "issue_label.issue_id", "task_issue.issue_id", "commit_reference.target_id"},
			dedupe: []string{
				`DELETE FROM comment WHERE issue_id IS NOT NULL AND github_id > 0 AND id NOT IN (SELECT MIN(id) FROM comment WHERE issue_id IS NOT NULL AND github_id > 0 GROUP BY issue_id, github_id)`,
				`DELETE FROM issue_label WHERE id NOT IN (SELECT MIN(id) FROM issue_label GROUP BY issue_id, label_id)`,
				`DELETE FROM task_issue WHERE id NOT IN (SELECT MIN(id) FROM task_issue GROUP BY task_id, issue_id)`,
			},
		},
		{
			table: "pull_request",
			refs:  []string{"comment.pull_request_id", "pull_request_label.pull_request_id", "task_pull_request.pull_request_id"},
			dedupe: []string{
				`DELETE FROM comment WHERE pull_request_id IS NOT NULL AND github_id > 0 AND id NOT IN (SELECT MIN(id) FROM comment WHERE pull_request_id IS NOT NULL AND github_id > 0 GROUP BY pull_request_id, github_id)`,
				`DELETE FROM pull_request_label WHERE id NOT IN (SELECT MIN(id) FROM pull_request_label GROUP BY pull_request_id, label_id)`,
				`DELETE FROM task_pull_request WHERE id NOT IN (SELECT MIN(id) FROM task_pull_request GROUP BY task_id, pull_request_id)`,
			},
		},
	}

	for _, target := range targets {
		tableCreated, err := tableExists(db, target.table)
		if err != nil {
			return err
		}
		if !tableCreated {
			// Fresh database: AutoMigrate creates the table after this runs.
			continue
		}

		dups, err := duplicateRepositoryNumbers(db, target.table)
		if err != nil {
			return err
		}
		if len(dups) == 0 {
			continue
		}
		for _, dup := range dups {
			for _, ref := range target.refs {
				pieces := strings.SplitN(ref, ".", 2)
				table, column := pieces[0], pieces[1]
				// commit_reference only stores issue rows under target_type='issue'.
				extra := ""
				if table == "commit_reference" {
					extra = " AND target_type = 'issue'"
				}
				sql := fmt.Sprintf("UPDATE %s SET %s = %d WHERE %s = %d%s",
					quoteIdent(table), quoteIdent(column), dup.keepID, quoteIdent(column), dup.dupID, extra)
				if err := db.RawExecContext(ctx, sql); err != nil {
					return fmt.Errorf("failed to move %s rows from %s %d to %d: %w", ref, target.table, dup.dupID, dup.keepID, err)
				}
			}
			sql := fmt.Sprintf("DELETE FROM %s WHERE id = %d", quoteIdent(target.table), dup.dupID)
			if err := db.RawExecContext(ctx, sql); err != nil {
				return fmt.Errorf("failed to delete duplicate %s %d: %w", target.table, dup.dupID, err)
			}
		}

		// Moving rows can leave two copies of the same comment (both rows were
		// synced) or the same label link; keep the oldest of each pair.
		for _, sql := range target.dedupe {
			if err := db.RawExecContext(ctx, sql); err != nil {
				return fmt.Errorf("failed to clean up duplicate %s rows: %w", target.table, err)
			}
		}

		if target.table == "issue" {
			// Cached counters in repository_stats still include the removed rows.
			if err := db.RawExecContext(ctx, `UPDATE repository_stats SET
				open_issues_count = COALESCE((SELECT count(*) FROM issue WHERE issue.repository_id = repository_stats.repository_id AND issue.is_closed = false), 0),
				closed_issues_count = COALESCE((SELECT count(*) FROM issue WHERE issue.repository_id = repository_stats.repository_id AND issue.is_closed = true), 0)`); err != nil {
				return fmt.Errorf("failed to refresh issue counters: %w", err)
			}
		}
	}
	return nil
}

type duplicateNumber struct {
	dupID  int64
	keepID int64
}

// duplicateRepositoryNumbers returns every row that shares its
// (repository_id, number) pair with a newer row of the same table.
func duplicateRepositoryNumbers(db *Database, table string) ([]duplicateNumber, error) {
	ctx := context.Background()
	rows, err := db.RawQueryContext(ctx,
		fmt.Sprintf("SELECT id, repository_id, number, updated_at FROM %s ORDER BY repository_id, number, updated_at DESC, id DESC",
			quoteIdent(table)))
	if err != nil {
		return nil, fmt.Errorf("failed to inspect %s: %w", table, err)
	}
	defer rows.Close()

	type key struct {
		repoID int64
		number int64
	}
	seen := make(map[key]int64)
	var dups []duplicateNumber
	for rows.Next() {
		var id, repoID int64
		var number int64
		var updatedAt time.Time
		if err := rows.Scan(&id, &repoID, &number, &updatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan %s row: %w", table, err)
		}
		k := key{repoID: repoID, number: number}
		if keep, ok := seen[k]; ok {
			dups = append(dups, duplicateNumber{dupID: id, keepID: keep})
			continue
		}
		seen[k] = id
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to read %s rows: %w", table, err)
	}
	return dups, nil
}

// 需要回填时间戳的表及各自的列。只有部分模型带 updated_at，
// 枚举清楚可以避免对不存在的列执行更新。
var timestampBackfillTargets = []struct {
	table   string
	columns []string
}{
	{"user", []string{"created_at", "updated_at"}},
	{"group", []string{"created_at", "updated_at"}},
	{"repository", []string{"created_at", "updated_at"}},
	{"issue", []string{"created_at", "updated_at"}},
	{"pull_request", []string{"created_at", "updated_at"}},
	{"comment", []string{"created_at", "updated_at"}},
	{"label", []string{"created_at", "updated_at"}},
	{"milestone", []string{"created_at", "updated_at"}},
	{"task", []string{"created_at", "updated_at"}},
	{"snippet", []string{"created_at", "updated_at"}},
	{"group_member", []string{"created_at"}},
	{"activity", []string{"created_at"}},
	{"task_attachment", []string{"created_at"}},
	// 同步链路上的表早期完全没有写时间戳。备份列表按 created_at 排序，
	// 零值会让最新的备份排到最后，界面也只能显示占位符。
	{"backup", []string{"created_at", "updated_at"}},
	{"branch", []string{"created_at", "updated_at"}},
	{"contributor", []string{"created_at", "updated_at"}},
	{"git_command_log", []string{"created_at"}},
	{"issue_label", []string{"created_at"}},
	{"platform_account", []string{"created_at", "updated_at"}},
	{"pull_request_label", []string{"created_at"}},
	{"release", []string{"created_at", "updated_at"}},
	{"remote_repository", []string{"created_at", "updated_at"}},
	{"repository_stats", []string{"created_at", "updated_at"}},
	{"sync_log", []string{"created_at"}},
	{"sync_point", []string{"created_at", "updated_at"}},
	{"sync_token", []string{"created_at", "updated_at"}},
	{"task_schedule", []string{"created_at", "updated_at"}},
	{"task_transition", []string{"created_at"}},
	{"task_issue", []string{"created_at"}},
	{"task_pull_request", []string{"created_at"}},
	{"task_time_log", []string{"created_at"}},
	{"commit_reference", []string{"created_at"}},
	{"star", []string{"created_at"}},
	{"watch", []string{"created_at"}},
	{"webhook", []string{"created_at", "updated_at"}},
	{"etag", []string{"created_at", "updated_at"}},
}

// BackfillTimestamps 把时间戳为零值（0001-01-01）的行改成当前时间。
//
// goent 原样写入 created_at/updated_at，早期版本的插入语句没有带时间戳，
// 这些行在界面上会显示成 0001-01-01。插入路径现在统一走 Stamp()，
// 这里只修复历史数据，重复执行无副作用。
func BackfillTimestamps(db *Database) error {
	if db == nil || db.DB == nil {
		return fmt.Errorf("database not initialized")
	}
	ctx := context.Background()
	driverName := strings.ToLower(db.Driver().Name())
	isPG := driverName == "postgres" || driverName == "postgresql"

	// 时间列是 timestamp without time zone，入库必须是 UTC 墙钟；CURRENT_TIMESTAMP
	// 会按会话时区（东八区）落成局部时间，界面于是多出 8 小时。
	now := "datetime('now')"
	if isPG {
		now = "(now() at time zone 'utc')"
	}

	for _, target := range timestampBackfillTargets {
		exists, err := tableExists(db, target.table)
		if err != nil {
			return err
		}
		if !exists {
			continue
		}
		qualified := quoteIdent(target.table)
		if isPG {
			if schema := pgSchemaFor(db, target.table); schema != "" {
				qualified = quoteIdent(schema) + "." + quoteIdent(target.table)
			}
		}
		for _, column := range target.columns {
			// 1970 之前的任何值都只可能是未填充的零值时间。
			sql := fmt.Sprintf("UPDATE %s SET %s = %s WHERE %s IS NULL OR %s < '1970-01-01'",
				qualified, quoteIdent(column), now, quoteIdent(column), quoteIdent(column))
			if err := db.RawExecContext(ctx, sql); err != nil {
				return fmt.Errorf("failed to backfill %s.%s: %w", target.table, column, err)
			}
		}
	}
	return nil
}

func tableExists(db *Database, name string) (bool, error) {
	ctx := context.Background()
	driverName := strings.ToLower(db.Driver().Name())
	var cnt int
	var err error
	if driverName == "postgres" || driverName == "postgresql" {
		err = db.RawQueryRowContext(ctx,
			"SELECT count(*) FROM information_schema.tables WHERE table_name = '"+name+"'").Scan(&cnt)
	} else {
		err = db.RawQueryRowContext(ctx,
			"SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = '"+name+"'").Scan(&cnt)
	}
	if err != nil {
		return false, fmt.Errorf("failed to inspect table %s: %w", name, err)
	}
	return cnt > 0, nil
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
