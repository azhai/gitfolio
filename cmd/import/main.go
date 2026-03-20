package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/database"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent"
	"github.com/azhai/goent/drivers/pgsql"
	"github.com/azhai/goent/drivers/sqlite"
	"github.com/azhai/goent/model"
)

type GitHubIssue struct {
	ID        int        `json:"id"`
	Number    int        `json:"number"`
	Title     string     `json:"title"`
	Body      string     `json:"body"`
	State     string     `json:"state"`
	User      GitHubUser `json:"user"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	ClosedAt  *time.Time `json:"closed_at"`
}

type GitHubPullRequest struct {
	ID        int        `json:"id"`
	Number    int        `json:"number"`
	Title     string     `json:"title"`
	Body      string     `json:"body"`
	State     string     `json:"state"`
	User      GitHubUser `json:"user"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	MergedAt  *time.Time `json:"merged_at"`
	ClosedAt  *time.Time `json:"closed_at"`
	Head      struct {
		Ref string `json:"ref"`
	} `json:"head"`
	Base struct {
		Ref string `json:"ref"`
	} `json:"base"`
}

type GitHubUser struct {
	ID        int    `json:"id"`
	Login     string `json:"login"`
	AvatarURL string `json:"avatar_url"`
}

type GiteaIssue struct {
	ID        int        `json:"id"`
	Number    int        `json:"number"`
	Title     string     `json:"title"`
	Body      string     `json:"body"`
	State     string     `json:"state"`
	User      GiteaUser  `json:"user"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	ClosedAt  *time.Time `json:"closed_at"`
}

type GiteaPullRequest struct {
	ID        int        `json:"id"`
	Number    int        `json:"number"`
	Title     string     `json:"title"`
	Body      string     `json:"body"`
	State     string     `json:"state"`
	User      GiteaUser  `json:"user"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	MergedAt  *time.Time `json:"merged_at"`
	ClosedAt  *time.Time `json:"closed_at"`
	Head      struct {
		Ref string `json:"ref"`
	} `json:"head"`
	Base struct {
		Ref string `json:"ref"`
	} `json:"base"`
}

type GiteaUser struct {
	ID        int    `json:"id"`
	Login     string `json:"login"`
	AvatarURL string `json:"avatar_url"`
}

type GitContributor struct {
	Name  string
	Email string
	Count int
}

func main() {
	cfg := config.Load()

	var drv model.Driver
	switch cfg.Database.Type {
	case "pgsql":
		drv = pgsql.OpenDSN(cfg.Database.GetDSN())
	case "sqlite":
		drv = sqlite.OpenDSN(cfg.Database.Name)
	default:
		log.Fatal("Unsupported database type:", cfg.Database.Type)
	}

	db, err := goent.Open[database.Database](drv, "stdout")
	if err != nil {
		log.Fatal("Failed to connect database:", err)
	}
	log.Println("Database connected successfully")

	ctx := context.Background()
	if err := goent.AutoMigrateContext(ctx, db); err != nil {
		log.Fatal("Failed to migrate database:", err)
	}
	log.Println("Database schema created successfully")

	log.Println("=== Step 1: Cleaning existing data ===")
	cleanData(db)

	log.Println("=== Step 2: Creating ryan user ===")
	ryan := createRyanUser(db)

	log.Println("=== Step 3: Creating mirror projects ===")
	repos := createMirrorProjects(db, ryan)

	log.Println("=== Step 4: Cloning repositories ===")
	cloneRepositories(repos)

	log.Println("=== Step 5: Importing issues and PRs ===")
	for _, repo := range repos {
		if strings.Contains(repo.MirrorURL, "github.com") {
			importGitHubData(db, repo, ryan)
		} else if strings.Contains(repo.MirrorURL, "gitea.com") {
			importGiteaData(db, repo, ryan)
		}
	}

	log.Println("=== Step 6: Importing contributors ===")
	for _, repo := range repos {
		importContributors(db, repo)
	}

	log.Println("=== Import completed successfully! ===")
}

func cleanData(db *database.Database) {
	log.Println("Cleaning contributors...")
	db.Contributor.Delete().Exec()

	log.Println("Cleaning snippets...")
	db.Snippet.Delete().Exec()

	log.Println("Cleaning milestones...")
	db.Milestone.Delete().Exec()

	log.Println("Cleaning activities...")
	db.Activity.Delete().Exec()

	log.Println("Cleaning group members...")
	db.GroupMember.Delete().Exec()

	log.Println("Cleaning groups...")
	db.Group.Delete().Exec()

	log.Println("Cleaning issue labels...")
	db.IssueLabel.Delete().Exec()

	log.Println("Cleaning comments...")
	db.Comment.Delete().Exec()

	log.Println("Cleaning merge requests...")
	db.MergeRequest.Delete().Exec()

	log.Println("Cleaning issues...")
	db.Issue.Delete().Exec()

	log.Println("Cleaning labels...")
	db.Label.Delete().Exec()

	log.Println("Cleaning releases...")
	db.Release.Delete().Exec()

	log.Println("Cleaning branches...")
	db.Branch.Delete().Exec()

	log.Println("Cleaning sync logs...")
	db.SyncLog.Delete().Exec()

	log.Println("Cleaning sync points...")
	db.SyncPoint.Delete().Exec()

	log.Println("Cleaning remote repositories...")
	db.RemoteRepository.Delete().Exec()

	log.Println("Cleaning sync tokens...")
	db.SyncToken.Delete().Exec()

	log.Println("Cleaning platform accounts...")
	db.PlatformAccount.Delete().Exec()

	log.Println("Cleaning webhooks...")
	db.Webhook.Delete().Exec()

	log.Println("Cleaning stars...")
	db.Star.Delete().Exec()

	log.Println("Cleaning watches...")
	db.Watch.Delete().Exec()

	log.Println("Cleaning repositories...")
	db.Repository.Delete().Exec()

	log.Println("Cleaning owners...")
	db.Owner.Delete().Exec()

	log.Println("Cleaning users (except ryan)...")
	db.User.Delete().Where("username != ?", "ryan").Exec()

	log.Println("Data cleaning completed")
}

func createRyanUser(db *database.Database) *models.User {
	ryan := &models.User{
		Username: "ryan",
		Email:    "ryan@example.com",
		FullName: "Ryan",
		IsActive: true,
		IsAdmin:  true,
	}
	ryan.SetPassword("password123")

	existingUser, _ := db.User.Select().Where("username = ?", "ryan").One()
	if existingUser != nil {
		log.Println("User ryan already exists")
		return existingUser
	}

	err := db.User.Insert().One(ryan)
	if err != nil {
		log.Fatal("Failed to create ryan user:", err)
	}
	log.Println("Created user:", ryan.Username)
	return ryan
}

func createMirrorProjects(db *database.Database, user *models.User) []*models.Repository {
	repos := []*models.Repository{
		{
			Name:          "go-redis",
			Description:   "Redis Go client",
			OwnerID:       user.ID,
			ProjectType:   string(models.ProjectTypeMirror),
			IsMirror:      true,
			MirrorURL:     "https://github.com/redis/go-redis.git",
			LocalPath:     "./repos/go-redis.git",
			DefaultBranch: "master",
			StarsCount:    19700,
			ForksCount:    2340,
			WatchCount:    19700,
		},
		{
			Name:          "builder",
			Description:   "SQL builder for Go",
			OwnerID:       user.ID,
			ProjectType:   string(models.ProjectTypeMirror),
			IsMirror:      true,
			MirrorURL:     "https://gitea.com/xorm/builder.git",
			LocalPath:     "./repos/builder.git",
			DefaultBranch: "master",
			StarsCount:    128,
			ForksCount:    32,
			WatchCount:    45,
		},
	}

	for _, repo := range repos {
		existingRepo, _ := db.Repository.Select().Where("owner_id = ? AND name = ?", user.ID, repo.Name).One()
		if existingRepo != nil {
			log.Printf("Repository %s already exists", repo.Name)
			repo = existingRepo
		} else {
			err := db.Repository.Insert().One(repo)
			if err != nil {
				log.Printf("Failed to create repository %s: %v", repo.Name, err)
				continue
			}
			log.Printf("Created repository: %s", repo.Name)
		}
	}

	return repos
}

func cloneRepositories(repos []*models.Repository) {
	for _, repo := range repos {
		if _, err := os.Stat(repo.LocalPath); os.IsNotExist(err) {
			log.Printf("Cloning %s to %s...", repo.MirrorURL, repo.LocalPath)

			os.MkdirAll(filepath.Dir(repo.LocalPath), 0755)

			cmd := exec.Command("git", "clone", "--bare", repo.MirrorURL, repo.LocalPath)
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr

			if err := cmd.Run(); err != nil {
				log.Printf("Failed to clone %s: %v", repo.MirrorURL, err)
			} else {
				log.Printf("Successfully cloned %s", repo.Name)
			}
		} else {
			log.Printf("Repository %s already exists at %s", repo.Name, repo.LocalPath)
		}
	}
}

func importGitHubData(db *database.Database, repo *models.Repository, user *models.User) {
	log.Printf("Importing GitHub data for %s...", repo.Name)

	client := &http.Client{Timeout: 30 * time.Second}

	parts := strings.Split(strings.TrimSuffix(strings.TrimPrefix(repo.MirrorURL, "https://github.com/"), ".git"), "/")
	if len(parts) != 2 {
		log.Printf("Invalid GitHub URL: %s", repo.MirrorURL)
		return
	}
	owner, repoName := parts[0], parts[1]

	importGitHubIssues(db, client, repo, user, owner, repoName)
	importGitHubPRs(db, client, repo, user, owner, repoName)
}

func importGitHubIssues(db *database.Database, client *http.Client, repo *models.Repository, user *models.User, owner, repoName string) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues?state=all&per_page=100", owner, repoName)

	resp, err := client.Get(url)
	if err != nil {
		log.Printf("Failed to fetch GitHub issues: %v", err)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read GitHub issues response: %v", err)
		return
	}

	var issues []GitHubIssue
	if err := json.Unmarshal(body, &issues); err != nil {
		log.Printf("Failed to parse GitHub issues: %v", err)
		return
	}

	count := 0
	for _, ghIssue := range issues {
		if ghIssue.Number == 0 {
			continue
		}

		issue := &models.Issue{
			Title:        ghIssue.Title,
			Body:         ghIssue.Body,
			Number:       ghIssue.Number,
			RepositoryID: repo.ID,
			AuthorID:     user.ID,
			IsClosed:     ghIssue.State == "closed",
			CreatedAt:    ghIssue.CreatedAt,
			UpdatedAt:    ghIssue.UpdatedAt,
		}

		if err := db.Issue.Insert().One(issue); err != nil {
			log.Printf("Failed to insert issue #%d: %v", ghIssue.Number, err)
		} else {
			count++
		}
	}
	log.Printf("Imported %d issues from GitHub", count)
}

func importGitHubPRs(db *database.Database, client *http.Client, repo *models.Repository, user *models.User, owner, repoName string) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls?state=all&per_page=100", owner, repoName)

	resp, err := client.Get(url)
	if err != nil {
		log.Printf("Failed to fetch GitHub PRs: %v", err)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read GitHub PRs response: %v", err)
		return
	}

	var prs []GitHubPullRequest
	if err := json.Unmarshal(body, &prs); err != nil {
		log.Printf("Failed to parse GitHub PRs: %v", err)
		return
	}

	count := 0
	for _, ghPR := range prs {
		if ghPR.Number == 0 {
			continue
		}

		status := "open"
		if ghPR.MergedAt != nil {
			status = "merged"
		} else if ghPR.ClosedAt != nil {
			status = "closed"
		}

		pr := &models.MergeRequest{
			Title:        ghPR.Title,
			Body:         ghPR.Body,
			Number:       ghPR.Number,
			RepositoryID: repo.ID,
			AuthorID:     user.ID,
			SourceBranch: ghPR.Head.Ref,
			TargetBranch: ghPR.Base.Ref,
			Status:       status,
			IsMerged:     ghPR.MergedAt != nil,
			IsClosed:     ghPR.State == "closed",
			CreatedAt:    ghPR.CreatedAt,
			UpdatedAt:    ghPR.UpdatedAt,
		}

		if err := db.MergeRequest.Insert().One(pr); err != nil {
			log.Printf("Failed to insert PR #%d: %v", ghPR.Number, err)
		} else {
			count++
		}
	}
	log.Printf("Imported %d PRs from GitHub", count)
}

func importGiteaData(db *database.Database, repo *models.Repository, user *models.User) {
	log.Printf("Importing Gitea data for %s...", repo.Name)

	client := &http.Client{Timeout: 30 * time.Second}

	parts := strings.Split(strings.TrimSuffix(strings.TrimPrefix(repo.MirrorURL, "https://gitea.com/"), ".git"), "/")
	if len(parts) != 2 {
		log.Printf("Invalid Gitea URL: %s", repo.MirrorURL)
		return
	}
	owner, repoName := parts[0], parts[1]

	importGiteaIssues(db, client, repo, user, owner, repoName)
	importGiteaPRs(db, client, repo, user, owner, repoName)
}

func importGiteaIssues(db *database.Database, client *http.Client, repo *models.Repository, user *models.User, owner, repoName string) {
	url := fmt.Sprintf("https://gitea.com/api/v1/repos/%s/%s/issues?state=all&limit=100", owner, repoName)

	resp, err := client.Get(url)
	if err != nil {
		log.Printf("Failed to fetch Gitea issues: %v", err)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read Gitea issues response: %v", err)
		return
	}

	var issues []GiteaIssue
	if err := json.Unmarshal(body, &issues); err != nil {
		log.Printf("Failed to parse Gitea issues: %v", err)
		return
	}

	count := 0
	for _, giteaIssue := range issues {
		if giteaIssue.Number == 0 {
			continue
		}

		issue := &models.Issue{
			Title:        giteaIssue.Title,
			Body:         giteaIssue.Body,
			Number:       giteaIssue.Number,
			RepositoryID: repo.ID,
			AuthorID:     user.ID,
			IsClosed:     giteaIssue.State == "closed",
			CreatedAt:    giteaIssue.CreatedAt,
			UpdatedAt:    giteaIssue.UpdatedAt,
		}

		if err := db.Issue.Insert().One(issue); err != nil {
			log.Printf("Failed to insert issue #%d: %v", giteaIssue.Number, err)
		} else {
			count++
		}
	}
	log.Printf("Imported %d issues from Gitea", count)
}

func importGiteaPRs(db *database.Database, client *http.Client, repo *models.Repository, user *models.User, owner, repoName string) {
	url := fmt.Sprintf("https://gitea.com/api/v1/repos/%s/%s/pulls?state=all&limit=100", owner, repoName)

	resp, err := client.Get(url)
	if err != nil {
		log.Printf("Failed to fetch Gitea PRs: %v", err)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read Gitea PRs response: %v", err)
		return
	}

	var prs []GiteaPullRequest
	if err := json.Unmarshal(body, &prs); err != nil {
		log.Printf("Failed to parse Gitea PRs: %v", err)
		return
	}

	count := 0
	for _, giteaPR := range prs {
		if giteaPR.Number == 0 {
			continue
		}

		status := "open"
		if giteaPR.MergedAt != nil {
			status = "merged"
		} else if giteaPR.ClosedAt != nil {
			status = "closed"
		}

		pr := &models.MergeRequest{
			Title:        giteaPR.Title,
			Body:         giteaPR.Body,
			Number:       giteaPR.Number,
			RepositoryID: repo.ID,
			AuthorID:     user.ID,
			SourceBranch: giteaPR.Head.Ref,
			TargetBranch: giteaPR.Base.Ref,
			Status:       status,
			IsMerged:     giteaPR.MergedAt != nil,
			IsClosed:     giteaPR.State == "closed",
			CreatedAt:    giteaPR.CreatedAt,
			UpdatedAt:    giteaPR.UpdatedAt,
		}

		if err := db.MergeRequest.Insert().One(pr); err != nil {
			log.Printf("Failed to insert PR #%d: %v", giteaPR.Number, err)
		} else {
			count++
		}
	}
	log.Printf("Imported %d PRs from Gitea", count)
}

func importContributors(db *database.Database, repo *models.Repository) {
	log.Printf("Importing contributors for %s...", repo.Name)

	if _, err := os.Stat(repo.LocalPath); os.IsNotExist(err) {
		log.Printf("Repository path does not exist: %s", repo.LocalPath)
		return
	}

	cmd := exec.Command("git", "-C", repo.LocalPath, "shortlog", "-sne", "HEAD")
	output, err := cmd.Output()
	if err != nil {
		log.Printf("Failed to get contributors: %v", err)
		return
	}

	contributors := parseGitShortlog(string(output))

	count := 0
	for _, c := range contributors {
		contributor := &models.Contributor{
			Name:         c.Name,
			Email:        c.Email,
			RepositoryID: repo.ID,
			CommitsCount: c.Count,
		}

		if err := db.Contributor.Insert().One(contributor); err != nil {
			log.Printf("Failed to insert contributor %s: %v", c.Name, err)
		} else {
			count++
		}
	}
	log.Printf("Imported %d contributors", count)
}

func parseGitShortlog(output string) []GitContributor {
	var contributors []GitContributor
	lines := strings.Split(output, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.SplitN(line, "\t", 2)
		if len(parts) != 2 {
			continue
		}

		var count int
		fmt.Sscanf(parts[0], "%d", &count)

		nameEmail := parts[1]
		idx := strings.LastIndex(nameEmail, "<")
		if idx == -1 {
			continue
		}

		name := strings.TrimSpace(nameEmail[:idx])
		email := strings.Trim(nameEmail[idx:], "<>")

		contributors = append(contributors, GitContributor{
			Name:  name,
			Email: email,
			Count: count,
		})
	}

	return contributors
}
