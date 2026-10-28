//go:build pgintegration

package models

import (
	"context"
	"os"
	"testing"

	"github.com/azhai/goent/drivers"
)

// 手动验证用（默认不参与 CI）：
//   PGTEST_DSN='postgres://ryan@127.0.0.1:5432/gitfolio_mig_test?sslmode=disable' \
//   go test -tags pgintegration -run TestPGMigrations ./models/
func TestPGMigrations(t *testing.T) {
	dsn := os.Getenv("PGTEST_DSN")
	if dsn == "" {
		t.Skip("PGTEST_DSN not set")
	}
	db, err := OpenDB(drivers.DatabaseConfig{Type: "postgres", DSN: dsn})
	if err != nil {
		t.Fatalf("OpenDB: %v", err)
	}
	defer CloseDB()

	ctx := context.Background()
	for _, table := range []string{"user", "group"} {
		// 先删掉列，模拟老数据库
		_ = db.RawExecContext(ctx, `ALTER TABLE "`+table+`" DROP COLUMN IF EXISTS repo_root`)
		if err := ensureColumn(db, table, "repo_root", "TEXT"); err != nil {
			t.Fatalf("ensureColumn %s: %v", table, err)
		}
		var cnt int
		q := "SELECT count(*) FROM information_schema.columns WHERE table_name = '" + table + "' AND column_name = 'repo_root'"
		if err := db.RawQueryRowContext(ctx, q).Scan(&cnt); err != nil {
			t.Fatalf("check %s: %v", table, err)
		}
		if cnt != 1 {
			t.Fatalf("%s.repo_root missing", table)
		}
	}

	// 幂等：重复执行不应报错
	if err := EnsureRepoRootColumns(db); err != nil {
		t.Fatalf("EnsureRepoRootColumns second run: %v", err)
	}
	if err := MigrateOrphanRepositories(db, "/tmp/gitfolio-pg-repos", "/tmp/gitfolio-pg-legacy"); err != nil {
		t.Fatalf("MigrateOrphanRepositories: %v", err)
	}
}
