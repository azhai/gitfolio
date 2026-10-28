//go:generate goent-gen fields --force ./

package models

import (
	"embed"
	"fmt"

	"github.com/azhai/goent"
	"github.com/azhai/goent/drivers"
	"github.com/azhai/goent/utils"
)

//go:embed goent-abbrs.json
var abbrsFS embed.FS

func init() {
	data, err := abbrsFS.ReadFile("goent-abbrs.json")
	if err == nil {
		_ = utils.LoadAbbreviationsFromData(data)
	}
}

var (
	db     *Database
	initDb = true
)

type Database struct {
	FolioSchema `goe:"folio"`
	*goent.DB
}

func GetDB() *Database {
	return db
}

func CloseDB() {
	if db != nil {
		_ = goent.Close(db)
	}
}

func OpenDB(cfg drivers.DatabaseConfig) (*Database, error) {
	drv, err := drivers.Connect(cfg)
	if err != nil {
		return nil, err
	}
	db, err = goent.Open[Database](drv)
	if err != nil {
		return nil, fmt.Errorf("Failed to connect database: %v", err)
	}
	if initDb {
		err = goent.AutoMigrate(db)
		if err != nil {
			return nil, fmt.Errorf("Failed to migrate database: %v", err)
		}
		if err := EnsureETagTable(db); err != nil {
			return nil, fmt.Errorf("Failed to ensure etag table: %v", err)
		}
		if err := EnsureSyncPointETagColumn(db); err != nil {
			return nil, fmt.Errorf("Failed to ensure sync_point.last_etag column: %v", err)
		}
		if err := EnsureContributorGitHubIDColumn(db); err != nil {
			return nil, fmt.Errorf("Failed to ensure contributor.github_id column: %v", err)
		}
		if err := EnsureCommentGitHubIDColumn(db); err != nil {
			return nil, fmt.Errorf("Failed to ensure comment.github_id column: %v", err)
		}
		if err := EnsureRepositoryStatsPRColumns(db); err != nil {
			return nil, fmt.Errorf("Failed to ensure repository_stats PR columns: %v", err)
		}
		if err := EnsureIssueStatusColumn(db); err != nil {
			return nil, fmt.Errorf("Failed to ensure issue.status column: %v", err)
		}
		if err := EnsureRepoRootColumns(db); err != nil {
			return nil, fmt.Errorf("Failed to ensure repo_root columns: %v", err)
		}
	}
	return db, nil
}
