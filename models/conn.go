//go:generate goent-gen fields --force ./

package models

import (
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

func GetDB() *Database {
	return db
}

// Connect opens a database connection.
func Connect(dbType, dbDSN, logFile string) error {
	var drv model.Driver
	if dbType == "pgsql" || dbType == "postgres" {
		drv = pgsql.OpenDSN(dbDSN)
	} else if dbType == "" && strings.HasPrefix(dbDSN, "postgres://") {
		drv = pgsql.OpenDSN(dbDSN)
	} else {
		_ = utils.MakeDirForFile(dbDSN)
		drv = sqlite.OpenDSN(dbDSN)
	}
	var err error
	db, err = goent.Open[Database](drv, logFile)
	return err
}

// Disconnect closes the database connection.
func Disconnect() {
	if db == nil {
		return
	}
	err := goent.Close(db)
	if err != nil {
		panic(err)
	}
}
