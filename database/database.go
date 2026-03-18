package database

import (
	"context"
	"fmt"
	"log"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent"
	"github.com/azhai/goent/drivers/pgsql"
	"github.com/azhai/goent/drivers/sqlite"
	"github.com/azhai/goent/model"
)

type FolioSchema struct {
	User         *goent.Table[models.User]
	Owner        *goent.Table[models.Owner]
	Repository   *goent.Table[models.Repository]
	Branch       *goent.Table[models.Branch]
	Issue        *goent.Table[models.Issue]
	Label        *goent.Table[models.Label]
	Comment      *goent.Table[models.Comment]
	Release      *goent.Table[models.Release]
	Star         *goent.Table[models.Star]
	Watch        *goent.Table[models.Watch]
	MergeRequest *goent.Table[models.MergeRequest]
	IssueLabel   *goent.Table[models.IssueLabel]
	Webhook      *goent.Table[models.Webhook]
}

type Database struct {
	FolioSchema `goe:"folio"`
	*goent.DB
}

var DB *Database

func Init(cfg *config.DatabaseConfig) error {
	var err error

	var drv model.Driver
	switch cfg.Type {
	case "pgsql":
		drv = pgsql.OpenDSN(cfg.GetDSN())
	case "sqlite":
		drv = sqlite.OpenDSN(cfg.Name)
	default:
		return fmt.Errorf("unsupported database type: %s", cfg.Type)
	}

	DB, err = goent.Open[Database](drv, "stdout")
	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}

	log.Println("Database connected successfully")

	ctx := context.Background()
	if err := goent.AutoMigrateContext(ctx, DB); err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	log.Println("Database schema created successfully")
	return nil
}

func GetDB() *Database {
	return DB
}
