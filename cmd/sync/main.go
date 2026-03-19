package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/database"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
)

var (
	platform   = flag.String("platform", "github", "Git platform (github, gitea)")
	owner      = flag.String("owner", "", "Repository owner")
	repo       = flag.String("repo", "", "Repository name")
	token      = flag.String("token", "", "Access token")
	syncIssues = flag.Bool("issues", true, "Sync issues")
	syncPRs    = flag.Bool("prs", true, "Sync pull requests")
	syncCode   = flag.Bool("code", false, "Sync repository code")
	repoRoot   = flag.String("root", "./repos", "Repository root directory")
)

func main() {
	flag.Parse()

	if *owner == "" || *repo == "" {
		fmt.Println("Error: owner and repo are required")
		fmt.Println("\nUsage:")
		fmt.Println("  sync -owner=azhai -repo=gitfolio -token=YOUR_TOKEN [options]")
		fmt.Println("\nOptions:")
		flag.PrintDefaults()
		os.Exit(1)
	}

	cfg := config.Load()

	if err := database.Init(&cfg.Database); err != nil {
		log.Fatalf("Failed to init database: %v", err)
	}

	db := database.GetDB()
	syncService := services.NewSyncService(db)

	ctx := context.Background()
	startTime := time.Now()

	fmt.Printf("=== Syncing %s/%s from %s ===\n", *owner, *repo, *platform)

	var repository *models.Repository
	var err2 error

	switch *platform {
	case "github":
		repository, err2 = syncService.SyncGitHubRepo(ctx, *owner, *repo, *token, 1)
	case "gitea":
		fmt.Println("Gitea sync not implemented yet")
		os.Exit(1)
	default:
		fmt.Printf("Unsupported platform: %s\n", *platform)
		os.Exit(1)
	}

	if err2 != nil {
		log.Fatalf("Failed to sync repository: %v", err2)
	}

	fmt.Printf("Repository synced: %s (ID: %d)\n", repository.Name, repository.ID)

	if *syncIssues {
		fmt.Println("\n=== Syncing Issues ===")
		if err := syncService.SyncGitHubIssues(ctx, repository.ID, *owner, *repo, *token); err != nil {
			log.Printf("Failed to sync issues: %v", err)
		} else {
			fmt.Println("Issues synced successfully")
		}
	}

	if *syncPRs {
		fmt.Println("\n=== Syncing Pull Requests ===")
		if err := syncService.SyncGitHubPRs(ctx, repository.ID, *owner, *repo, *token); err != nil {
			log.Printf("Failed to sync PRs: %v", err)
		} else {
			fmt.Println("Pull Requests synced successfully")
		}
	}

	if *syncCode {
		fmt.Println("\n=== Syncing Code ===")
		fmt.Printf("Code sync to %s not implemented yet\n", *repoRoot)
	}

	duration := time.Since(startTime)
	fmt.Printf("\n=== Sync Summary ===\n")
	fmt.Printf("Repository: %s\n", repository.Name)
	fmt.Printf("Duration: %v\n", duration)
	fmt.Println("✓ Sync completed successfully!")
}
