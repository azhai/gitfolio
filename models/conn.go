//go:generate goent-gen fields --force ./

package models

import (
	"fmt"

	"github.com/azhai/goent"
	"github.com/azhai/goent/drivers"
)

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
	}
	if err != nil {
		return nil, fmt.Errorf("Failed to migrate database: %v", err)
	}
	return db, nil
}
