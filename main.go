package main

import (
	"fmt"
	"log"
	"os"

	"github.com/azhai/gitfolio/cmd"
	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/routes"
	"github.com/azhai/goent/utils"
)

func main() {
	cfg := config.Load()
	env := utils.NewEnv()
	if _, err := models.OpenDB(env); err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer models.CloseDB()
	cmd.SeedUsers()
	cmd.AddGithubToken(cfg.Github.Username, cfg.Github.Token)

	if err := os.MkdirAll(cfg.Repository.Root, 0755); err != nil {
		log.Fatalf("Failed to create repository root: %v", err)
	}

	app := routes.SetupRouter()

	addr := fmt.Sprintf(":%s", cfg.Server.Port)
	log.Printf("Server starting on %s", addr)
	log.Printf("Visit %s", cfg.Server.BaseURL)

	if err := app.Listen(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
