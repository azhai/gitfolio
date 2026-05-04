package seed

import (
	"log"

	"github.com/azhai/gitfolio/models"
	"golang.org/x/crypto/bcrypt"
)

func SeedUsers() {
	db := models.GetDB()

	count, _ := db.User.Count("*")
	if count > 0 {
		log.Println("Database already seeded, skipping...")
		return
	}

	log.Println("Seeding database with real repository data...")

	users := []*models.User{
		{
			Username: "admin",
			Email:    "admin@gitfolio.com",
			FullName: "System Admin",
			Bio:      "GitFolio administrator",
			IsActive: true,
			IsAdmin:  true,
		},
		{
			Username: "ryan",
			Email:    "ryan@home504.io",
			FullName: "Ryan",
			Bio:      "Developer and open source enthusiast",
			Website:  "https://git.home504.io/ryan",
			Location: "China",
			IsActive: true,
			IsAdmin:  false,
		},
	}

	for _, user := range users {
		password, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user.Password = string(password)
		err := db.User.Insert().One(user)
		if err != nil {
			log.Printf("Failed to create user %s: %v", user.Username, err)
		} else {
			log.Printf("Created user: %s", user.Username)
		}
	}
}
