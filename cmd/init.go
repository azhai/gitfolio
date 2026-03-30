package cmd

import (
	"context"
	"log"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent"
)

func InitDB() *config.Config {
	cfg := config.Load()
	ConnectDB(&cfg.Database)
	return cfg
}

func ConnectDB(dbCfg *config.DatabaseConfig) {
	dbType, dbDSN := dbCfg.Type, dbCfg.GetDSN()
	if err := models.Connect(dbType, dbDSN, "stderr"); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	ctx := context.Background()
	if err := goent.AutoMigrateContext(ctx, models.GetDB()); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
}
