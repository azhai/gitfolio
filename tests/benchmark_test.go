package tests

import (
	"testing"

	"github.com/azhai/gitfolio/database"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
)

func BenchmarkUserRegistration(b *testing.B) {
	router := SetupTestRouter()

	payload := map[string]string{
		"username": "benchuser",
		"email":    "bench@example.com",
		"password": "password123",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		payload["username"] = "benchuser" + string(rune(i))
		payload["email"] = "bench" + string(rune(i)) + "@example.com"
		MakeRequest(router, "POST", "/api/v1/auth/register", payload, nil)
	}
}

func BenchmarkUserLogin(b *testing.B) {
	router := SetupTestRouter()

	user := models.User{
		Username: "loginbench",
		Email:    "loginbench@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := database.GetDB()
	db.User.Insert().One(&user)

	payload := map[string]string{
		"username": "loginbench",
		"password": "password123",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		MakeRequest(router, "POST", "/api/v1/auth/login", payload, nil)
	}
}

func BenchmarkCreateRepository(b *testing.B) {
	router := SetupTestRouter()

	user := models.User{
		Username: "repobench",
		Email:    "repobench@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := database.GetDB()
	db.User.Insert().One(&user)

	token, _ := middleware.GenerateToken(&user)
	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	payload := map[string]interface{}{
		"name":        "bench-repo",
		"description": "Benchmark repository",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		payload["name"] = "bench-repo-" + string(rune(i))
		MakeRequest(router, "POST", "/api/v1/repos", payload, headers)
	}
}

func BenchmarkCreateIssue(b *testing.B) {
	router := SetupTestRouter()

	user := models.User{
		Username: "issuebench",
		Email:    "issuebench@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := database.GetDB()
	db.User.Insert().One(&user)

	repo := models.Repository{
		Name:      "bench-issue-repo",
		OwnerID:   user.ID,
		IsPrivate: false,
	}
	db.Repository.Insert().One(&repo)

	token, _ := middleware.GenerateToken(&user)
	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	payload := map[string]interface{}{
		"title": "Benchmark Issue",
		"body":  "Benchmark issue body",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		MakeRequest(router, "POST", "/api/v1/issuebench/bench-issue-repo/issues", payload, headers)
	}
}

func BenchmarkListRepositories(b *testing.B) {
	router := SetupTestRouter()

	user := models.User{
		Username: "listbench",
		Email:    "listbench@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := database.GetDB()
	db.User.Insert().One(&user)

	for i := 0; i < 100; i++ {
		repo := models.Repository{
			Name:      "repo" + string(rune(i)),
			OwnerID:   user.ID,
			IsPrivate: false,
		}
		db.Repository.Insert().One(&repo)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		MakeRequest(router, "GET", "/api/v1/repos?page=1&per_page=30", nil, nil)
	}
}
