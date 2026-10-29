package models

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/azhai/goent/drivers"
)

// openTestDB creates a temporary SQLite database for migration tests.
func openTestDB(t *testing.T) *Database {
	t.Helper()
	dir := t.TempDir()
	cfg := drivers.DatabaseConfig{
		Type: "sqlite",
		DSN:  filepath.Join(dir, "test.db"),
	}
	db, err := OpenDB(cfg)
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	return db
}

func TestEnsureSyncPointETagColumn_AddsColumn(t *testing.T) {
	db := openTestDB(t)
	defer CloseDB()

	// Drop the column if it exists so we simulate an old database.
	_ = db.RawExecContext(context.Background(), "ALTER TABLE sync_point DROP COLUMN last_etag")

	if err := EnsureSyncPointETagColumn(db); err != nil {
		t.Fatalf("ensure column: %v", err)
	}

	var name string
	err := db.RawQueryRowContext(context.Background(),
		"SELECT name FROM pragma_table_info('sync_point') WHERE name = 'last_etag'").Scan(&name)
	if err != nil {
		t.Fatalf("check column: %v", err)
	}
	if name != "last_etag" {
		t.Fatalf("expected last_etag column, got %s", name)
	}
}

func TestEnsureSyncPointETagColumn_RenamesLegacyColumn(t *testing.T) {
	db := openTestDB(t)
	defer CloseDB()

	// Start from a clean state: drop last_etag and create legacy last_e_tag.
	_ = db.RawExecContext(context.Background(), "ALTER TABLE sync_point DROP COLUMN last_etag")
	_ = db.RawExecContext(context.Background(), "ALTER TABLE sync_point ADD COLUMN last_e_tag TEXT")

	if err := EnsureSyncPointETagColumn(db); err != nil {
		t.Fatalf("ensure column: %v", err)
	}

	var name string
	err := db.RawQueryRowContext(context.Background(),
		"SELECT name FROM pragma_table_info('sync_point') WHERE name = 'last_etag'").Scan(&name)
	if err != nil {
		t.Fatalf("check new column: %v", err)
	}
	if name != "last_etag" {
		t.Fatalf("expected last_etag column, got %s", name)
	}
}

func TestEnsureContributorGitHubIDColumn_RenamesLegacyColumn(t *testing.T) {
	db := openTestDB(t)
	defer CloseDB()

	_ = db.RawExecContext(context.Background(), "ALTER TABLE contributor DROP COLUMN github_id")
	_ = db.RawExecContext(context.Background(), "ALTER TABLE contributor ADD COLUMN git_hub_id INTEGER")

	if err := EnsureContributorGitHubIDColumn(db); err != nil {
		t.Fatalf("ensure column: %v", err)
	}

	var name string
	err := db.RawQueryRowContext(context.Background(),
		"SELECT name FROM pragma_table_info('contributor') WHERE name = 'github_id'").Scan(&name)
	if err != nil {
		t.Fatalf("check github_id: %v", err)
	}
	if name != "github_id" {
		t.Fatalf("expected github_id column, got %s", name)
	}
}

func TestEnsureCommentGitHubIDColumn_RenamesLegacyColumn(t *testing.T) {
	db := openTestDB(t)
	defer CloseDB()

	_ = db.RawExecContext(context.Background(), "ALTER TABLE comment DROP COLUMN github_id")
	_ = db.RawExecContext(context.Background(), "ALTER TABLE comment ADD COLUMN git_hub_id INTEGER")

	if err := EnsureCommentGitHubIDColumn(db); err != nil {
		t.Fatalf("ensure column: %v", err)
	}

	var name string
	err := db.RawQueryRowContext(context.Background(),
		"SELECT name FROM pragma_table_info('comment') WHERE name = 'github_id'").Scan(&name)
	if err != nil {
		t.Fatalf("check github_id: %v", err)
	}
	if name != "github_id" {
		t.Fatalf("expected github_id column, got %s", name)
	}
}

func TestEnsureETagTable_CreatesTable(t *testing.T) {
	db := openTestDB(t)
	defer CloseDB()

	// Remove the table if AutoMigrate already created it.
	_ = db.RawExecContext(context.Background(), "DROP TABLE IF EXISTS etag")

	if err := EnsureETagTable(db); err != nil {
		t.Fatalf("ensure etag table: %v", err)
	}

	var count int
	err := db.RawQueryRowContext(context.Background(), "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='etag'").Scan(&count)
	if err != nil {
		t.Fatalf("check etag table: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected etag table to exist, got count %d", count)
	}
}

func TestEnsureRepoRootColumns_AddsColumns(t *testing.T) {
	db := openTestDB(t)
	defer CloseDB()

	for _, table := range []string{"user", "group"} {
		// 模拟旧数据库：SQLite 3.35+ 支持 DROP COLUMN
		_ = db.RawExecContext(context.Background(), "ALTER TABLE "+table+" DROP COLUMN repo_root")

		if err := EnsureRepoRootColumns(db); err != nil {
			t.Fatalf("ensure repo_root for %s: %v", table, err)
		}

		var name string
		err := db.RawQueryRowContext(context.Background(),
			"SELECT name FROM pragma_table_info(?) WHERE name = 'repo_root'", table).Scan(&name)
		if err != nil {
			t.Fatalf("check repo_root on %s: %v", table, err)
		}
		if name != "repo_root" {
			t.Fatalf("expected repo_root column on %s, got %s", table, name)
		}
	}
}

func TestDropDuplicateURLColumns_BackfillsAndDrops(t *testing.T) {
	db := openTestDB(t)
	defer CloseDB()
	ctx := context.Background()

	// 模拟旧库：规范列是空的，值只存在同义的重复列里。
	if err := db.RawExecContext(ctx, "ALTER TABLE remote_repository ADD COLUMN sshurl TEXT NOT NULL DEFAULT ''"); err != nil {
		t.Fatalf("add duplicate column: %v", err)
	}
	if err := db.RawExecContext(ctx, `INSERT INTO remote_repository
		(created_at, updated_at, platform, owner, repo_name, clone_url, ssh_url, api_url, web_url, repository_id, is_primary, direction, sync_enabled, sshurl)
		VALUES (datetime('now'), datetime('now'), 'github', 'avelino', 'awesome-go', '', '', '', '', 1, 0, 'pull', 1, 'git@github.com:avelino/awesome-go.git')`); err != nil {
		t.Fatalf("insert row: %v", err)
	}

	if err := DropDuplicateURLColumns(db); err != nil {
		t.Fatalf("drop duplicates: %v", err)
	}

	if columnExists(db, "remote_repository", "sshurl") {
		t.Fatal("expected sshurl column to be dropped")
	}
	var sshURL string
	if err := db.RawQueryRowContext(ctx, "SELECT ssh_url FROM remote_repository WHERE repository_id = 1").Scan(&sshURL); err != nil {
		t.Fatalf("read ssh_url: %v", err)
	}
	if sshURL != "git@github.com:avelino/awesome-go.git" {
		t.Fatalf("expected ssh_url backfilled, got %q", sshURL)
	}

	// 再跑一次不应该因为列已经没了而报错。
	if err := DropDuplicateURLColumns(db); err != nil {
		t.Fatalf("drop duplicates second run: %v", err)
	}
}

func TestMigrateOrphanRepositories(t *testing.T) {
	db := openTestDB(t)
	defer CloseDB()

	admin := &User{Username: "root-admin", Email: "admin@example.com", Role: "admin"}
	if err := db.User.Insert().One(admin); err != nil {
		t.Fatalf("insert admin: %v", err)
	}

	// 旧版本创建的本地项目：无归属、无落盘记录
	orphan := &Repository{Name: "legacy-repo", ProjectType: "local"}
	if err := db.Repository.Insert().One(orphan); err != nil {
		t.Fatalf("insert orphan repo: %v", err)
	}

	globalRoot := t.TempDir()
	if err := MigrateOrphanRepositories(db, globalRoot); err != nil {
		t.Fatalf("migrate orphan repositories: %v", err)
	}

	got, err := db.Repository.Select().Where("id = ?", orphan.ID).One()
	if err != nil {
		t.Fatalf("reload repo: %v", err)
	}
	if got.OwnerID != admin.ID {
		t.Errorf("OwnerID = %d, want admin %d", got.OwnerID, admin.ID)
	}
	if got.OwnerType != "user" {
		t.Errorf("OwnerType = %q, want user", got.OwnerType)
	}
	// 管理员未设置自有目录：落到全局裸仓库目录下的账号子目录
	want := filepath.Join(globalRoot, admin.Username, "legacy-repo")
	if got.LocalPath != want {
		t.Errorf("LocalPath = %q, want %q", got.LocalPath, want)
	}
}

func TestMigrateOrphanRepositoriesUsesOwnRoot(t *testing.T) {
	db := openTestDB(t)
	defer CloseDB()

	workRoot := t.TempDir()
	admin := &User{Username: "root-admin", Email: "admin@example.com", Role: "admin", RepoRoot: workRoot}
	if err := db.User.Insert().One(admin); err != nil {
		t.Fatalf("insert admin: %v", err)
	}

	orphan := &Repository{Name: "legacy-repo", ProjectType: "local"}
	if err := db.Repository.Insert().One(orphan); err != nil {
		t.Fatalf("insert orphan repo: %v", err)
	}

	if err := MigrateOrphanRepositories(db, t.TempDir()); err != nil {
		t.Fatalf("migrate orphan repositories: %v", err)
	}

	got, err := db.Repository.Select().Where("id = ?", orphan.ID).One()
	if err != nil {
		t.Fatalf("reload repo: %v", err)
	}
	// 管理员设置了自有目录：落到 <repo_root>/<仓库名>
	want := filepath.Join(workRoot, "legacy-repo")
	if got.LocalPath != want {
		t.Errorf("LocalPath = %q, want %q", got.LocalPath, want)
	}
}
