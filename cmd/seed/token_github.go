package seed

import (
	"fmt"
	"log"
	"os/exec"

	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
)

func AddGithubToken(username, token string) {
	if username == "" || token == "" {
		log.Println("Database already seeded, skipping...")
		return
	}

	db := models.GetDB()
	count, _ := db.User.Where("username = ?", username).Count("id")
	if count > 0 {
		log.Println("Database already seeded, skipping...")
		return
	}

	platform, apiURL := "github", "https://api.github.com"
	email, err := exec.Command("git", "config", "--get", "user.email").Output()
	accountService := services.NewAccountService(db)

	account, err := accountService.CreateOrUpdateAccount(
		platform,
		username,
		string(email),
		"",
		apiURL,
		1,
	)
	if err != nil {
		log.Fatalf("Failed to create/update account: %v", err)
	}
	fmt.Printf("Account created/updated: %s (%s)\n", account.Username, account.Platform)

	tokenName := "default"
	_, err = accountService.CreateOrUpdateToken(
		platform,
		tokenName,
		token,
		"",
		"Bearer",
		nil,
		"",
		account.ID,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to create/update token: %v", err)
	}

	fmt.Printf("Token created/updated: %s\n", tokenName)
	fmt.Println("✓ Account setup completed successfully!")
}
