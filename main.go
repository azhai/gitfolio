package main

import (
	"fmt"
	"log"
	"os"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/database"
	"github.com/azhai/gitfolio/routes"
)

func main() {
	cfg := config.Load()

	if err := database.Init(&cfg.Database); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	database.SeedData()

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
