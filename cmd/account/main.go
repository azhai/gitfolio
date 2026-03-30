package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/azhai/gitfolio/cmd"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
)

var (
	platform  = flag.String("platform", "", "Platform (github, gitea, gitfolio)")
	username  = flag.String("username", "", "Platform username")
	email     = flag.String("email", "", "Email address")
	avatarURL = flag.String("avatar", "", "Avatar URL")
	token     = flag.String("token", "", "Access token")
	tokenName = flag.String("name", "default", "Token name")
	tokenType = flag.String("type", "Bearer", "Token type")
	scopes    = flag.String("scopes", "", "Token scopes")
)

func main() {
	flag.Parse()

	if *platform == "" || *username == "" || *token == "" {
		fmt.Println("Error: platform, username, and token are required")
		fmt.Println("\nUsage:")
		fmt.Println("  account -platform=github -username=azhai -token=YOUR_TOKEN [options]")
		fmt.Println("\nOptions:")
		flag.PrintDefaults()
		fmt.Println("\nExamples:")
		fmt.Println("  # Add GitHub account")
		fmt.Println("  account -platform=github -username=azhai -token=ghp_xxx")
		fmt.Println("\n  # Add Gitea account")
		fmt.Println("  account -platform=gitea -username=azhai -token=b0c475xxx")
		os.Exit(1)
	}

	cfg := cmd.InitDB()
	defer models.Disconnect()
	db := models.GetDB()
	accountService := services.NewAccountService(db)

	var apiURL string
	switch *platform {
	case "github":
		apiURL = "https://api.github.com"
	case "gitea":
		apiURL = "https://gitea.com/api/v1"
	case "gitfolio":
		apiURL = cfg.Server.BaseURL + "/api/v1"
	default:
		log.Fatalf("Unsupported platform: %s", *platform)
	}

	account, err := accountService.CreateOrUpdateAccount(
		*platform,
		*username,
		*email,
		*avatarURL,
		apiURL,
		1,
	)
	if err != nil {
		log.Fatalf("Failed to create/update account: %v", err)
	}

	fmt.Printf("Account created/updated: %s (%s)\n", account.Username, account.Platform)

	_, err = accountService.CreateOrUpdateToken(
		*platform,
		*tokenName,
		*token,
		"",
		*tokenType,
		nil,
		*scopes,
		account.ID,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to create/update token: %v", err)
	}

	fmt.Printf("Token created/updated: %s\n", *tokenName)
	fmt.Println("✓ Account setup completed successfully!")
}
