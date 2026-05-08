package handlers

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/gofiber/fiber/v3"
)

func CreateAccount(c fiber.Ctx) error {
	var req struct {
		Platform  string `json:"platform"`
		Username  string `json:"username"`
		Email     string `json:"email"`
		AvatarURL string `json:"avatar_url"`
		Token     string `json:"token"`
		TokenName string `json:"token_name"`
		TokenType string `json:"token_type"`
		Scopes    string `json:"scopes"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.Platform == "" || req.Username == "" || req.Token == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "platform, username and token are required"})
	}

	if req.TokenName == "" {
		req.TokenName = "default"
	}
	if req.TokenType == "" {
		req.TokenType = "Bearer"
	}

	user, err := middleware.GetCurrentUser(c)
	if err != nil || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	db := models.GetDB()
	accountSvc := services.NewAccountService(db)

	var apiURL string
	switch req.Platform {
	case "github":
		apiURL = "https://api.github.com"
	case "gitea":
		apiURL = "https://gitea.com/api/v1"
	default:
		apiURL = ""
	}

	account, err := accountSvc.CreateOrUpdateAccount(
		req.Platform,
		req.Username,
		req.Email,
		req.AvatarURL,
		apiURL,
		user.ID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("Failed to create/update account: %v", err)})
	}

	token, err := accountSvc.CreateOrUpdateToken(
		req.Platform,
		req.TokenName,
		req.Token,
		"",
		req.TokenType,
		nil,
		req.Scopes,
		account.ID,
		nil,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("Failed to create/update token: %v", err)})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"account":    account,
		"token_name": token.Name,
		"platform":   account.Platform,
		"username":   account.Username,
	})
}

func ListAccounts(c fiber.Ctx) error {
	db := models.GetDB()
	platform := c.Query("platform", "")

	var accounts []*models.PlatformAccount
	var err error
	if platform != "" {
		accounts, err = db.PlatformAccount.Select().Where("platform = ?", platform).All()
	} else {
		accounts, err = db.PlatformAccount.Select().All()
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	type accountWithToken struct {
		Account *models.PlatformAccount `json:"account"`
		Tokens  []*models.SyncToken     `json:"tokens"`
	}

	results := make([]accountWithToken, 0, len(accounts))
	for _, acc := range accounts {
		tokens, _ := db.SyncToken.Select().Where("account_id = ?", acc.ID).All()
		results = append(results, accountWithToken{Account: acc, Tokens: tokens})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"accounts": results})
}

func DeleteAccount(c fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid account ID"})
	}

	db := models.GetDB()
	accountSvc := services.NewAccountService(db)

	if err := accountSvc.DeleteAccount(int64(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Account deleted"})
}

func CreateMirror(c fiber.Ctx) error {
	var req struct {
		Platform   string `json:"platform"`
		BaseURL    string `json:"base_url"`
		Owner      string `json:"owner"`
		Repo       string `json:"repo"`
		CloneURL   string `json:"clone_url"`
		SyncIssues bool   `json:"sync_issues"`
		SyncPRs    bool   `json:"sync_prs"`
		SyncCode   bool   `json:"sync_code"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.Owner == "" || req.Repo == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "owner and repo are required"})
	}

	if req.Platform == "" {
		if strings.Contains(req.CloneURL, "gitea.com") || strings.Contains(req.BaseURL, "gitea") {
			req.Platform = "gitea"
		} else {
			req.Platform = "github"
		}
	}

	if req.BaseURL == "" {
		switch req.Platform {
		case "github":
			req.BaseURL = "https://github.com"
		case "gitea":
			req.BaseURL = "https://gitea.com"
		}
	}

	if req.CloneURL == "" {
		req.CloneURL = fmt.Sprintf("%s/%s/%s.git", req.BaseURL, req.Owner, req.Repo)
	}

	user, err := middleware.GetCurrentUser(c)
	if err != nil || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	db := models.GetDB()
	syncSvc := services.NewSyncService(db)

	var owner models.Owner
	owners, err := db.Owner.Select().Where("username = ?", req.Owner).All()
	if err == nil && len(owners) > 0 {
		owner = *owners[0]
	} else {
		owner = models.Owner{
			Username: req.Owner,
			FullName: req.Owner,
		}
		if err := db.Owner.Insert().One(&owner); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("Failed to create owner: %v", err)})
		}
	}

	repos, _ := db.Repository.Select().Where("name = ? AND owner_id = ? AND owner_type = 'user'", req.Repo, owner.ID).All()
	var repo models.Repository
	now := time.Now()

	if len(repos) > 0 {
		repo = *repos[0]
		repo.MirrorURL = req.CloneURL
		repo.ProjectType = "mirror"
		repo.LastSyncAt = &now
		db.Repository.Save().One(&repo)
	} else {
		repo = models.Repository{
			Name:          req.Repo,
			OwnerID:       owner.ID,
			OwnerType:     "user",
			ProjectType:   "mirror",
			MirrorURL:     req.CloneURL,
			LastSyncAt:    &now,
			DefaultBranch: "main",
		}
		if err := db.Repository.Insert().One(&repo); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("Failed to create repository: %v", err)})
		}
	}

	syncSvc.CreateRemoteRepoFromMirrorURL(repo.ID, req.CloneURL)

	result := fiber.Map{
		"repository": repo,
		"owner":      owner.Username,
	}

	if req.SyncCode {
		gitSvc := services.NewGitService()
		localPath, err := gitSvc.CloneRepository(req.Owner, req.Repo, req.CloneURL, true)
		if err != nil {
			result["clone_error"] = err.Error()
		} else {
			repo.LocalPath = localPath
			db.Repository.Save().One(&repo)
			result["local_path"] = localPath
		}
	}

	if req.SyncIssues || req.SyncPRs {
		token := ""
		tokens, _ := db.SyncToken.Select().Where("platform = ? AND is_active = ?", req.Platform, true).All()
		if len(tokens) > 0 {
			token = tokens[0].AccessToken
		}

		ctx := context.Background()
		if syncResult, err := syncSvc.SyncRepositoryData(ctx, repo.ID, req.Platform, req.Owner, req.Repo, token); err != nil {
			result["sync_error"] = err.Error()
		} else {
			result["synced"] = true
			result["issues_inserted"] = syncResult.IssuesInserted
			result["issues_updated"] = syncResult.IssuesUpdated
			result["prs_inserted"] = syncResult.PRsInserted
			result["prs_updated"] = syncResult.PRsUpdated
		}
	}

	return c.Status(fiber.StatusOK).JSON(result)
}

func ImportFromRemote(c fiber.Ctx) error {
	var req struct {
		Platform           string `json:"platform"`
		Owner              string `json:"owner"`
		Repo               string `json:"repo"`
		Token              string `json:"token"`
		CleanData          bool   `json:"clean_data"`
		CloneRepo          bool   `json:"clone_repo"`
		ImportIssues       bool   `json:"import_issues"`
		ImportPRs          bool   `json:"import_prs"`
		ImportContributors bool   `json:"import_contributors"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.Owner == "" || req.Repo == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "owner and repo are required"})
	}

	if req.Platform == "" {
		req.Platform = "github"
	}

	user, err := middleware.GetCurrentUser(c)
	if err != nil || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	db := models.GetDB()
	syncSvc := services.NewSyncService(db)
	ctx := context.Background()

	if req.Token == "" {
		tokens, _ := db.SyncToken.Select().Where("platform = ? AND is_active = ?", req.Platform, true).All()
		if len(tokens) > 0 {
			req.Token = tokens[0].AccessToken
		}
	}

	result := fiber.Map{
		"platform": req.Platform,
		"owner":    req.Owner,
		"repo":     req.Repo,
	}

	var repository *models.Repository

	switch req.Platform {
	case "github":
		repository, err = syncSvc.SyncGitHubRepo(ctx, req.Owner, req.Repo, req.Token, user.ID)
	case "gitea":
		repos, dbErr := db.Repository.Select().Where("name = ?", req.Repo).All()
		if dbErr != nil || len(repos) == 0 {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found. Create a mirror first."})
		}
		repository = repos[0]
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Unsupported platform"})
	}

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("Failed to import repository: %v", err)})
	}

	result["repository_id"] = repository.ID

	if req.CleanData {
		db.IssueLabel.Delete().Where("issue_id IN (SELECT id FROM issues WHERE repository_id = ?)", repository.ID).Exec()
		db.Issue.Delete().Where("repository_id = ?", repository.ID).Exec()
		db.PullRequest.Delete().Where("repository_id = ?", repository.ID).Exec()
		db.Contributor.Delete().Where("repository_id = ?", repository.ID).Exec()
		result["cleaned"] = true
	}

	if req.CloneRepo && repository.LocalPath == "" {
		gitSvc := services.NewGitService()
		cloneURL := fmt.Sprintf("https://%s.com/%s/%s.git", req.Platform, req.Owner, req.Repo)
		localPath, cloneErr := gitSvc.CloneRepository(req.Owner, req.Repo, cloneURL, true)
		if cloneErr != nil {
			result["clone_error"] = cloneErr.Error()
		} else {
			repository.LocalPath = localPath
			db.Repository.Save().One(repository)
			result["local_path"] = localPath
		}
	}

	if req.ImportIssues {
		switch req.Platform {
		case "github":
			if syncResult, err := syncSvc.SyncGitHubIssues(ctx, repository.ID, req.Owner, req.Repo, req.Token); err != nil {
				result["issues_error"] = err.Error()
			} else {
				result["issues_inserted"] = syncResult.IssuesInserted
				result["issues_updated"] = syncResult.IssuesUpdated
			}
		case "gitea":
			if syncResult, err := syncSvc.SyncGiteaIssues(ctx, repository.ID, req.Owner, req.Repo, req.Token); err != nil {
				result["issues_error"] = err.Error()
			} else {
				result["issues_inserted"] = syncResult.IssuesInserted
				result["issues_updated"] = syncResult.IssuesUpdated
			}
		}
		result["issues_synced"] = true
	}

	if req.ImportPRs {
		switch req.Platform {
		case "github":
			if syncResult, err := syncSvc.SyncGitHubPRs(ctx, repository.ID, req.Owner, req.Repo, req.Token); err != nil {
				result["prs_error"] = err.Error()
			} else {
				result["prs_inserted"] = syncResult.PRsInserted
				result["prs_updated"] = syncResult.PRsUpdated
			}
		case "gitea":
			if syncResult, err := syncSvc.SyncGiteaPRs(ctx, repository.ID, req.Owner, req.Repo, req.Token); err != nil {
				result["prs_error"] = err.Error()
			} else {
				result["prs_inserted"] = syncResult.PRsInserted
				result["prs_updated"] = syncResult.PRsUpdated
			}
		}
		result["prs_synced"] = true
	}

	if req.ImportContributors {
		if err := syncSvc.SyncGitHubContributors(ctx, repository.ID, req.Owner, req.Repo, req.Token); err != nil {
			result["contributors_error"] = err.Error()
		}
		result["contributors_synced"] = true
	}

	return c.Status(fiber.StatusOK).JSON(result)
}

func UpdateCommitTimes(c fiber.Ctx) error {
	db := models.GetDB()

	repos, err := db.Repository.Select().All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	updated := 0
	skipped := 0
	errors := []string{}

	for _, repo := range repos {
		localPath := repo.LocalPath
		if localPath == "" || repo.IsMirror() {
			skipped++
			continue
		}

		if _, statErr := os.Stat(localPath); os.IsNotExist(statErr) {
			if strings.HasSuffix(localPath, ".git") {
				altPath := strings.TrimSuffix(localPath, ".git")
				if _, altErr := os.Stat(altPath); altErr == nil {
					localPath = altPath
				} else {
					skipped++
					continue
				}
			} else {
				skipped++
				continue
			}
		}

		if isBare, _ := isBareRepo(localPath); isBare {
			skipped++
			continue
		}

		cmd := exec.Command("git", "-C", localPath, "log", "-1", "--format=%ci")
		output, cmdErr := cmd.Output()
		if cmdErr != nil || len(strings.TrimSpace(string(output))) == 0 {
			skipped++
			continue
		}

		t, parseErr := time.Parse("2006-01-02 15:04:05 -0700", strings.TrimSpace(string(output)))
		if parseErr != nil {
			errors = append(errors, fmt.Sprintf("%s: parse time failed: %v", repo.Name, parseErr))
			continue
		}

		repo.LastCommitAt = &t
		if saveErr := db.Repository.Save().One(repo); saveErr != nil {
			errors = append(errors, fmt.Sprintf("%s: save failed: %v", repo.Name, saveErr))
			continue
		}
		updated++
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"updated": updated,
		"skipped": skipped,
		"errors":  errors,
		"total":   len(repos),
	})
}

func isBareRepo(path string) (bool, error) {
	cmd := exec.Command("git", "-C", path, "rev-parse", "--is-bare-repository")
	output, err := cmd.Output()
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(string(output)) == "true", nil
}
