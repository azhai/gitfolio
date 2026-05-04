package main

import (
	"fmt"
	"log"
	"os"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/routes"
	"github.com/azhai/gitfolio/cmd/seed"
	"github.com/azhai/goent/utils"
)

func main() {
	cfg := config.Load(utils.NewEnv())
	if _, err := models.OpenDB(cfg.Database); err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer models.CloseDB()
	seed.SeedUsers()
	user, token := config.GetUserToken()
	seed.AddGithubToken(user, token)

	if err := os.MkdirAll(cfg.Repository.Root, 0755); err != nil {
		log.Fatalf("Failed to create repository root: %v", err)
	}

	app := routes.SetupRouter()

	port, url := config.GetServerInfo()
	addr := fmt.Sprintf(":%d", port)
	log.Printf("Server starting on %s", addr)
	log.Printf("Visit %s", url)

	if err := app.Listen(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
