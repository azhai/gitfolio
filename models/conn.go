//go:generate goent-gen fields --force ./

package models

import (
	"fmt"
	"strings"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/goent"
	"github.com/azhai/goent/drivers/pgsql"
	"github.com/azhai/goent/drivers/sqlite"
	"github.com/azhai/goent/model"
	"github.com/azhai/goent/utils"
)

var db *Database

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

func OpenDB(cfg config.DatabaseConfig) (*Database, error) {
	// 连接数据库
	var err error
	db, err = Connect(cfg.Type, cfg.DSN, cfg.LogFile)
	if err != nil {
		return nil, fmt.Errorf("连接数据库失败: %v", err)
	}

	if err = goent.AutoMigrate(db); err != nil {
		return nil, fmt.Errorf("迁移失败: %v", err)
	}
	return db, nil
}

func Connect(dbType, dbDSN, logFile string) (*Database, error) {
	var drv model.Driver
	if dbType == "pgsql" || dbType == "postgres" {
		drv = pgsql.OpenDSN(dbDSN)
	} else if dbType == "" && strings.HasPrefix(dbDSN, "postgres://") {
		drv = pgsql.OpenDSN(dbDSN)
	} else {
		_ = utils.MakeDirForFile(dbDSN)
		drv = sqlite.OpenDSN(dbDSN)
	}
	return goent.Open[Database](drv, logFile)
}
