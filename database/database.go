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
	Activity         *goent.Table[models.Activity]
	Branch           *goent.Table[models.Branch]
	Comment          *goent.Table[models.Comment]
	Contributor      *goent.Table[models.Contributor]
	Group            *goent.Table[models.Group]
	GroupMember      *goent.Table[models.GroupMember]
	Issue            *goent.Table[models.Issue]
	IssueLabel       *goent.Table[models.IssueLabel]
	Label            *goent.Table[models.Label]
	MergeRequest     *goent.Table[models.MergeRequest]
	Milestone        *goent.Table[models.Milestone]
	Owner            *goent.Table[models.Owner]
	PlatformAccount  *goent.Table[models.PlatformAccount]
	Release          *goent.Table[models.Release]
	RemoteRepository *goent.Table[models.RemoteRepository]
	Repository       *goent.Table[models.Repository]
	Snippet          *goent.Table[models.Snippet]
	Star             *goent.Table[models.Star]
	SyncLog          *goent.Table[models.SyncLog]
	SyncPoint        *goent.Table[models.SyncPoint]
	SyncToken        *goent.Table[models.SyncToken]
	User             *goent.Table[models.User]
	Watch            *goent.Table[models.Watch]
	Webhook          *goent.Table[models.Webhook]
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
