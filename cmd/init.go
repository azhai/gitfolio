package cmd

import (
	"log"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent/utils"
)

func InitDB() *config.Config {
	cfg := config.Load()
	env := utils.NewEnv()
	if _, err := models.OpenDB(env); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	return cfg
}