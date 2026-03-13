package database

import (
	"context"
	"fmt"
	"log"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent"
	"github.com/azhai/goent/drivers/sqlite"
)

type PublicSchema struct {
	User       *goent.Table[models.User]
	Repository *goent.Table[models.Repository]
	Branch     *goent.Table[models.Branch]
	Issue      *goent.Table[models.Issue]
	Label      *goent.Table[models.Label]
	Comment    *goent.Table[models.Comment]
	Release    *goent.Table[models.Release]
	Star       *goent.Table[models.Star]
	Watch      *goent.Table[models.Watch]
}

type Database struct {
	PublicSchema `goe:"public"`
	*goent.DB
}

var DB *Database

func Init(cfg *config.DatabaseConfig) error {
	var err error

	var driver *sqlite.Driver
	switch cfg.Type {
	case "sqlite":
		driver = sqlite.OpenDSN(cfg.Name)
	default:
		return fmt.Errorf("unsupported database type: %s", cfg.Type)
	}

	DB, err = goent.Open[Database](driver, "stdout")
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
