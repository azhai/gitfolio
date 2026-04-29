//go:generate goent-gen fields --force ./

package models

import (
	"fmt"
	"strings"

	"github.com/azhai/goent"
	"github.com/azhai/goent/drivers/pgsql"
	"github.com/azhai/goent/drivers/sqlite"
	"github.com/azhai/goent/model"
	"github.com/azhai/goent/utils"
)

var db *Database

// Database represents the database connection.
type Database struct {
	FolioSchema `goe:"folio"`
	*goent.DB
}

// GetDB 获取全局数据库单例实例
func GetDB() *Database {
	return db
}

// CloseDB 关闭数据库连接
func CloseDB() {
	if db != nil {
		_ = goent.Close(db)
	}
}

// OpenDB 打开数据库连接并执行自动迁移和种子数据初始化
// 支持 PostgreSQL（pgsql/postgres://前缀）和 SQLite（默认）两种数据库
func OpenDB(env *utils.Environ) (*Database, error) {
	dbType, dbDSN := env.Get("DB_TYPE"), env.Get("DB_DSN")
	logFile := env.GetStr("LOG_FILE", "stdout")

	var err error
	db, err = Connect(dbType, dbDSN, logFile)
	if err != nil {
		return nil, fmt.Errorf("连接数据库失败: %v", err)
	}

	if err = goent.AutoMigrate(db); err != nil {
		return nil, fmt.Errorf("迁移失败: %v", err)
	}
	return db, nil
}

// Connect 根据数据库类型和 DSN 创建数据库连接
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
