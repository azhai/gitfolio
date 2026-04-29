package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/azhai/goent/utils"
)

type MirrorConfig struct {
	Platform     string
	BaseURL      string
	Owner        string
	Repo         string
	SyncIssues   bool
	SyncPRs      bool
	SyncWiki     bool
	SyncReleases bool
}

type GiteaUser struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	FullName  string `json:"full_name"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
}

type GiteaRepository struct {
	ID            int64     `json:"id"`
	Owner         GiteaUser `json:"owner"`
	Name          string    `json:"name"`
	FullName      string    `json:"full_name"`
	Description   string    `json:"description"`
	Homepage      string    `json:"html_url"`
	Private       bool      `json:"private"`
	Fork          bool      `json:"fork"`
	StarsCount    int       `json:"stars_count"`
	ForksCount    int       `json:"forks_count"`
	Watchers      int       `json:"watchers_count"`
	OpenIssues    int       `json:"open_issues_count"`
	DefaultBranch string    `json:"default_branch"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type GiteaIssue struct {
	ID          int64      `json:"id"`
	Number      int        `json:"number"`
	Title       string     `json:"title"`
	Body        string     `json:"body"`
	User        GiteaUser  `json:"user"`
	State       string     `json:"state"`
	IsLocked    bool       `json:"is_locked"`
	Comments    int        `json:"comments"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	ClosedAt    *time.Time `json:"closed_at"`
	PullRequest *struct {
		Merged bool `json:"merged"`
	} `json:"pull_request"`
}

type GiteaPullRequest struct {
	ID        int64         `json:"id"`
	Number    int           `json:"number"`
	Title     string        `json:"title"`
	Body      string        `json:"body"`
	User      GiteaUser     `json:"user"`
	State     string        `json:"state"`
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
	ClosedAt  *time.Time    `json:"closed_at"`
	MergedAt  *time.Time    `json:"merged_at"`
	Head      GiteaPRBranch `json:"head"`
	Base      GiteaPRBranch `json:"base"`
}

type GiteaPRBranch struct {
	Label string `json:"label"`
	Ref   string `json:"ref"`
	Sha   string `json:"sha"`
}

type MirrorStats struct {
	RepoCreated   bool
	IssuesSynced  int
	IssuesUpdated int
	PRsSynced     int
	PRsUpdated    int
	UsersCreated  int
	CodeSynced    bool
	Errors        []string
}

var (
	platform     = flag.String("platform", "gitea", "Git platform (gitea, github)")
	baseURL      = flag.String("url", "https://gitea.com", "Base URL of the platform")
	owner        = flag.String("owner", "", "Repository owner")
	repo         = flag.String("repo", "", "Repository name")
	syncIssues   = flag.Bool("issues", true, "Sync issues")
	syncPRs      = flag.Bool("prs", false, "Sync pull requests")
	syncWiki     = flag.Bool("wiki", false, "Sync wiki")
	syncReleases = flag.Bool("releases", false, "Sync releases")
	syncCode     = flag.Bool("code", false, "Sync repository code")
	repoRoot     = flag.String("root", "./repos", "Repository root directory")
	configFile   = flag.String("config", "", "Config file path")
	verbose      = flag.Bool("verbose", false, "Verbose output")
)

func main() {
	flag.Parse()

	if *owner == "" || *repo == "" {
		fmt.Println("Error: owner and repo are required")
		fmt.Println("\nUsage:")
		fmt.Println("  mirror -owner=xorm -repo=builder [options]")
		fmt.Println("\nOptions:")
		flag.PrintDefaults()
		fmt.Println("\nExamples:")
		fmt.Println("  # Sync xorm/builder from Gitea")
		fmt.Println("  mirror -owner=xorm -repo=builder")
		fmt.Println("\n  # Sync with pull requests")
		fmt.Println("  mirror -owner=xorm -repo=builder -prs=true")
		fmt.Println("\n  # Sync from custom Gitea instance")
		fmt.Println("  mirror -owner=myorg -repo=myrepo -url=https://git.example.com")
		os.Exit(1)
	}

	cfg := &MirrorConfig{
		Platform:     *platform,
		BaseURL:      *baseURL,
		Owner:        *owner,
		Repo:         *repo,
		SyncIssues:   *syncIssues,
		SyncPRs:      *syncPRs,
		SyncWiki:     *syncWiki,
		SyncReleases: *syncReleases,
	}

	if *configFile != "" {
		if err := loadConfigFile(*configFile, cfg); err != nil {
			log.Fatalf("Failed to load config file: %v", err)
		}
	}

	fmt.Printf("=== Mirroring %s/%s from %s ===\n", cfg.Owner, cfg.Repo, cfg.Platform)
	fmt.Printf("Base URL: %s\n", cfg.BaseURL)
	fmt.Printf("Sync Issues: %v\n", cfg.SyncIssues)
	fmt.Printf("Sync PRs: %v\n", cfg.SyncPRs)
	fmt.Println()

	env := utils.NewEnv()
	models.OpenDB(env)
	defer models.CloseDB()
	db := models.GetDB()

	stats, err := mirrorRepository(db, cfg)
	if err != nil {
		log.Fatalf("Mirror failed: %v", err)
	}

	printStats(stats)
}

func loadConfigFile(path string, cfg *MirrorConfig) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	return decoder.Decode(cfg)
}

func fetchFromAPI(baseURL, path string) ([]byte, error) {
	url := fmt.Sprintf("%s/api/v1/%s", baseURL, path)

	if *verbose {
		fmt.Printf("Fetching: %s\n", url)
	}

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

func mirrorRepository(db *models.Database, cfg *MirrorConfig) (*MirrorStats, error) {
	stats := &MirrorStats{}

	fmt.Println("Fetching repository info...")
	data, err := fetchFromAPI(cfg.BaseURL, fmt.Sprintf("repos/%s/%s", cfg.Owner, cfg.Repo))
	if err != nil {
		return nil, fmt.Errorf("failed to fetch repository: %v", err)
	}

	var giteaRepo GiteaRepository
	if err := json.Unmarshal(data, &giteaRepo); err != nil {
		return nil, fmt.Errorf("failed to parse repository: %v", err)
	}

	fmt.Printf("Repository: %s\n", giteaRepo.FullName)
	fmt.Printf("Description: %s\n", giteaRepo.Description)
	fmt.Printf("Stars: %d, Forks: %d, Issues: %d\n",
		giteaRepo.StarsCount, giteaRepo.ForksCount, giteaRepo.OpenIssues)

	var owner models.Owner
	owners, err := db.Owner.Select().Where("username = ?", giteaRepo.Owner.Login).All()
	if err == nil && len(owners) > 0 {
		owner = *owners[0]
		if *verbose {
			fmt.Printf("Found existing owner: %s\n", owner.Username)
		}
	} else {
		owner = models.Owner{
			Username: giteaRepo.Owner.Login,
			Email:    giteaRepo.Owner.Email,
			FullName: giteaRepo.Owner.FullName,
			Avatar:   giteaRepo.Owner.AvatarURL,
		}
		if err := db.Owner.Insert().One(&owner); err != nil {
			return nil, fmt.Errorf("failed to create owner: %v", err)
		}
		stats.UsersCreated++
		fmt.Printf("Created owner: %s\n", owner.Username)
	}

	repos, err := db.Repository.Select().Where("name = ? AND owner_id = ?", giteaRepo.Name, owner.ID).All()
	var repo models.Repository

	now := time.Now()
	mirrorURL := fmt.Sprintf("%s/%s/%s", cfg.BaseURL, cfg.Owner, cfg.Repo)

	if err == nil && len(repos) > 0 {
		repo = *repos[0]
		repo.Description = giteaRepo.Description
		repo.UpdatedAt = giteaRepo.UpdatedAt
		repo.IsMirror = true
		repo.MirrorURL = mirrorURL
		repo.LastSyncAt = &now
		if err := db.Repository.Save().One(&repo); err != nil {
			return nil, fmt.Errorf("failed to update repository: %v", err)
		}
		fmt.Printf("Updated repository: %s\n", repo.Name)
	} else {
		repo = models.Repository{
			Name:          giteaRepo.Name,
			Description:   giteaRepo.Description,
			Homepage:      giteaRepo.Homepage,
			OwnerID:       owner.ID,
			IsPrivate:     giteaRepo.Private,
			IsFork:        giteaRepo.Fork,
			IsMirror:      true,
			MirrorURL:     mirrorURL,
			LastSyncAt:    &now,
			DefaultBranch: giteaRepo.DefaultBranch,
			CreatedAt:     giteaRepo.CreatedAt,
			UpdatedAt:     giteaRepo.UpdatedAt,
		}
		if err := db.Repository.Insert().One(&repo); err != nil {
			return nil, fmt.Errorf("failed to create repository: %v", err)
		}
		stats.RepoCreated = true
		fmt.Printf("Created repository: %s\n", repo.Name)
	}

	repoStats, _ := db.RepositoryStats.Select().Where("repository_id = ?", repo.ID).One()
	if repoStats == nil {
		repoStats = &models.RepositoryStats{
			RepositoryID: repo.ID,
			StarsCount:   giteaRepo.StarsCount,
			ForksCount:   giteaRepo.ForksCount,
			WatchCount:   giteaRepo.Watchers,
		}
		db.RepositoryStats.Insert().One(repoStats)
	} else {
		repoStats.StarsCount = giteaRepo.StarsCount
		repoStats.ForksCount = giteaRepo.ForksCount
		repoStats.WatchCount = giteaRepo.Watchers
		db.RepositoryStats.Save().One(repoStats)
	}

	remoteRepo := models.RemoteRepository{
		Platform:     cfg.Platform,
		Owner:        cfg.Owner,
		RepoName:     cfg.Repo,
		CloneURL:     fmt.Sprintf("%s/%s/%s.git", cfg.BaseURL, cfg.Owner, cfg.Repo),
		WebURL:       fmt.Sprintf("%s/%s/%s", cfg.BaseURL, cfg.Owner, cfg.Repo),
		RepositoryID: repo.ID,
		IsPrimary:    true,
		Direction:    "pull",
		LastSyncAt:   &now,
		SyncEnabled:  true,
	}
	existingRemotes, _ := db.RemoteRepository.Select().Where("repository_id = ? AND platform = ?", repo.ID, cfg.Platform).All()
	if len(existingRemotes) > 0 {
		remoteRepo = *existingRemotes[0]
		remoteRepo.LastSyncAt = &now
		db.RemoteRepository.Save().One(&remoteRepo)
	} else {
		db.RemoteRepository.Insert().One(&remoteRepo)
	}

	if cfg.SyncIssues {
		if err := syncIssuesData(db, &repo, cfg, stats); err != nil {
			stats.Errors = append(stats.Errors, fmt.Sprintf("Issues sync: %v", err))
		}
	}

	if cfg.SyncPRs {
		if err := syncPullRequests(db, &repo, cfg, stats); err != nil {
			stats.Errors = append(stats.Errors, fmt.Sprintf("PRs sync: %v", err))
		}
	}

	if *syncCode {
		if err := syncRepositoryCode(db, &repo, cfg, stats); err != nil {
			stats.Errors = append(stats.Errors, fmt.Sprintf("Code sync: %v", err))
		}
	}

	return stats, nil
}

func syncIssuesData(db *models.Database, repo *models.Repository, cfg *MirrorConfig, stats *MirrorStats) error {
	fmt.Println("\n=== Syncing Issues ===")

	page := 1
	limit := 50

	for {
		path := fmt.Sprintf("repos/%s/%s/issues?state=all&page=%d&limit=%d",
			cfg.Owner, cfg.Repo, page, limit)
		data, err := fetchFromAPI(cfg.BaseURL, path)
		if err != nil {
			return fmt.Errorf("failed to fetch issues: %v", err)
		}

		var giteaIssues []GiteaIssue
		if err := json.Unmarshal(data, &giteaIssues); err != nil {
			return fmt.Errorf("failed to parse issues: %v", err)
		}

		if len(giteaIssues) == 0 {
			break
		}

		for _, giteaIssue := range giteaIssues {
			if giteaIssue.PullRequest != nil {
				continue
			}

			user, created, err := getOrCreateUser(db, &giteaIssue.User)
			if err != nil {
				if *verbose {
					fmt.Printf("Warning: failed to create user %s: %v\n", giteaIssue.User.Login, err)
				}
				continue
			}
			if created {
				stats.UsersCreated++
			}

			issues, err := db.Issue.Select().Where("repository_id = ? AND number = ?", repo.ID, giteaIssue.Number).All()
			var issue models.Issue

			isClosed := giteaIssue.State == "closed"

			if err == nil && len(issues) > 0 {
				issue = *issues[0]
				issue.Title = giteaIssue.Title
				issue.Body = giteaIssue.Body
				issue.IsClosed = isClosed
				issue.IsLocked = giteaIssue.IsLocked
				issue.UpdatedAt = giteaIssue.UpdatedAt
				if err := db.Issue.Save().One(&issue); err != nil {
					if *verbose {
						fmt.Printf("Warning: failed to update issue #%d: %v\n", giteaIssue.Number, err)
					}
					continue
				}
				stats.IssuesUpdated++
			} else {
				issue = models.Issue{
					Title:        giteaIssue.Title,
					Body:         giteaIssue.Body,
					Number:       giteaIssue.Number,
					RepositoryID: repo.ID,
					AuthorID:     user.ID,
					IsClosed:     isClosed,
					IsLocked:     giteaIssue.IsLocked,
					CreatedAt:    giteaIssue.CreatedAt,
					UpdatedAt:    giteaIssue.UpdatedAt,
				}
				if err := db.Issue.Insert().One(&issue); err != nil {
					if *verbose {
						fmt.Printf("Warning: failed to create issue #%d: %v\n", giteaIssue.Number, err)
					}
					continue
				}
				stats.IssuesSynced++
			}
		}

		fmt.Printf("Processed page %d (%d items)\n", page, len(giteaIssues))
		page++
	}

	fmt.Printf("Issues synced: %d, updated: %d\n", stats.IssuesSynced, stats.IssuesUpdated)
	return nil
}

func syncPullRequests(db *models.Database, repo *models.Repository, cfg *MirrorConfig, stats *MirrorStats) error {
	fmt.Println("\n=== Syncing Pull Requests ===")

	page := 1
	limit := 50

	for {
		path := fmt.Sprintf("repos/%s/%s/pulls?state=all&page=%d&limit=%d",
			cfg.Owner, cfg.Repo, page, limit)
		data, err := fetchFromAPI(cfg.BaseURL, path)
		if err != nil {
			return fmt.Errorf("failed to fetch PRs: %v", err)
		}

		var giteaPRs []GiteaPullRequest
		if err := json.Unmarshal(data, &giteaPRs); err != nil {
			return fmt.Errorf("failed to parse PRs: %v", err)
		}

		if len(giteaPRs) == 0 {
			break
		}

		for _, giteaPR := range giteaPRs {
			user, created, err := getOrCreateUser(db, &GiteaUser{
				ID:        giteaPR.User.ID,
				Login:     giteaPR.User.Login,
				FullName:  giteaPR.User.FullName,
				Email:     giteaPR.User.Email,
				AvatarURL: giteaPR.User.AvatarURL,
			})
			if err != nil {
				if *verbose {
					fmt.Printf("Warning: failed to create user %s: %v\n", giteaPR.User.Login, err)
				}
				continue
			}
			if created {
				stats.UsersCreated++
			}

			mrs, err := db.PullRequest.Select().Where("repository_id = ? AND number = ?", repo.ID, giteaPR.Number).All()
			var pr models.PullRequest

			isClosed := giteaPR.State == "closed"
			isMerged := giteaPR.MergedAt != nil

			status := "open"
			if isMerged {
				status = "merged"
			} else if isClosed {
				status = "closed"
			}

			sourceBranch := "unknown"
			targetBranch := "main"
			if giteaPR.Head.Ref != "" {
				sourceBranch = giteaPR.Head.Ref
			}
			if giteaPR.Base.Ref != "" {
				targetBranch = giteaPR.Base.Ref
			}

			if err == nil && len(mrs) > 0 {
				pr = *mrs[0]
				pr.Title = giteaPR.Title
				pr.Body = giteaPR.Body
				pr.IsClosed = isClosed
				pr.IsMerged = isMerged
				pr.Status = status
				pr.SourceBranch = sourceBranch
				pr.TargetBranch = targetBranch
				pr.UpdatedAt = giteaPR.UpdatedAt
				if err := db.PullRequest.Save().One(&pr); err != nil {
					if *verbose {
						fmt.Printf("Warning: failed to update PR #%d: %v\n", giteaPR.Number, err)
					}
					continue
				}
				stats.PRsUpdated++
			} else {
				pr = models.PullRequest{
					Title:        giteaPR.Title,
					Body:         giteaPR.Body,
					Number:       giteaPR.Number,
					RepositoryID: repo.ID,
					AuthorID:     user.ID,
					SourceBranch: sourceBranch,
					TargetBranch: targetBranch,
					IsClosed:     isClosed,
					IsMerged:     isMerged,
					Status:       status,
					CreatedAt:    giteaPR.CreatedAt,
					UpdatedAt:    giteaPR.UpdatedAt,
				}
				if err := db.PullRequest.Insert().One(&pr); err != nil {
					if *verbose {
						fmt.Printf("Warning: failed to create PR #%d: %v\n", giteaPR.Number, err)
					}
					continue
				}
				stats.PRsSynced++
			}
		}

		fmt.Printf("Processed page %d (%d items)\n", page, len(giteaPRs))
		page++
	}

	fmt.Printf("PRs synced: %d, updated: %d\n", stats.PRsSynced, stats.PRsUpdated)
	return nil
}

func getOrCreateUser(db *models.Database, giteaUser *GiteaUser) (*models.User, bool, error) {
	users, err := db.User.Select().Where("username = ?", giteaUser.Login).All()
	if err == nil && len(users) > 0 {
		return users[0], false, nil
	}

	user := models.User{
		Username: giteaUser.Login,
		Email:    giteaUser.Email,
		FullName: giteaUser.FullName,
		Avatar:   giteaUser.AvatarURL,
		IsActive: true,
	}

	if err := db.User.Insert().One(&user); err != nil {
		return nil, false, err
	}

	return &user, true, nil
}

func syncRepositoryCode(db *models.Database, repo *models.Repository, cfg *MirrorConfig, stats *MirrorStats) error {
	fmt.Println("\n=== Syncing Repository Code ===")

	gitSvc := services.NewGitService()
	gitURL := fmt.Sprintf("%s/%s/%s.git", cfg.BaseURL, cfg.Owner, cfg.Repo)

	if _, err := os.Stat(fmt.Sprintf("%s/%s/%s.git", *repoRoot, cfg.Owner, cfg.Repo)); os.IsNotExist(err) {
		fmt.Printf("Cloning repository from %s\n", gitURL)
		_, err := gitSvc.CloneRepository(cfg.Owner, cfg.Repo, gitURL, false)
		if err != nil {
			return fmt.Errorf("failed to clone repository: %v", err)
		}
		fmt.Printf("Repository cloned\n")
	} else {
		fmt.Printf("Updating repository\n")
		if err := gitSvc.FetchRepository(cfg.Owner, cfg.Repo); err != nil {
			return fmt.Errorf("failed to fetch updates: %v", err)
		}

		if err := gitSvc.PullRepository(cfg.Owner, cfg.Repo); err != nil {
			fmt.Printf("Warning: failed to pull updates: %v\n", err)
		}
		fmt.Printf("Repository updated\n")
	}

	stats.CodeSynced = true
	return nil
}

func printStats(stats *MirrorStats) {
	fmt.Println("\n=== Mirror Summary ===")
	fmt.Printf("Repository: %s\n", map[bool]string{true: "Created", false: "Updated"}[stats.RepoCreated])
	fmt.Printf("Issues: %d synced, %d updated\n", stats.IssuesSynced, stats.IssuesUpdated)
	fmt.Printf("Pull Requests: %d synced, %d updated\n", stats.PRsSynced, stats.PRsUpdated)
	fmt.Printf("Users created: %d\n", stats.UsersCreated)
	if stats.CodeSynced {
		fmt.Println("Code: Synced")
	}

	if len(stats.Errors) > 0 {
		fmt.Println("\nErrors:")
		for _, err := range stats.Errors {
			fmt.Printf("  - %s\n", err)
		}
	}

	fmt.Println("\n✓ Mirror completed successfully!")
}
