package services

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
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
	"github.com/google/go-github/v84/github"
)

type contributorCache struct {
	mu    sync.RWMutex
	items map[string]*models.Contributor
}

func newContributorCache() *contributorCache {
	return &contributorCache{items: make(map[string]*models.Contributor)}
}

var (
	globalSyncMu  sync.Mutex
	globalSyncing = make(map[int64]bool)
)

func TryLockSync(repoID int64) bool {
	globalSyncMu.Lock()
	defer globalSyncMu.Unlock()
	if globalSyncing[repoID] {
		return false
	}
	globalSyncing[repoID] = true
	return true
}

func UnlockSync(repoID int64) {
	globalSyncMu.Lock()
	defer globalSyncMu.Unlock()
	delete(globalSyncing, repoID)
}

func IsSyncing(repoID int64) bool {
	globalSyncMu.Lock()
	defer globalSyncMu.Unlock()
	return globalSyncing[repoID]
}

func CleanupStaleSyncState(db *models.Database) {
	runningLogs, _ := db.SyncLog.Select().Where("status = ?", "running").All()
	for _, log := range runningLogs {
		log.Status = "interrupted"
		log.Message = "Server restarted, sync interrupted"
		db.SyncLog.Save().One(log)
	}
}

func (c *contributorCache) Get(key string) (*models.Contributor, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	v, ok := c.items[key]
	return v, ok
}

func (c *contributorCache) Set(key string, contrib *models.Contributor) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = contrib
}

type SyncService struct {
	db      *models.Database
	account *AccountService
}

type SyncResult struct {
	IssuesInserted int
	IssuesUpdated  int
	PRsInserted    int
	PRsUpdated     int
	MaxIssueNumber int
	MaxPRNumber    int
}

func (r *SyncResult) Add(other SyncResult) {
	r.IssuesInserted += other.IssuesInserted
	r.IssuesUpdated += other.IssuesUpdated
	r.PRsInserted += other.PRsInserted
	r.PRsUpdated += other.PRsUpdated
	if other.MaxIssueNumber > r.MaxIssueNumber {
		r.MaxIssueNumber = other.MaxIssueNumber
	}
	if other.MaxPRNumber > r.MaxPRNumber {
		r.MaxPRNumber = other.MaxPRNumber
	}
}

func NewSyncService(db *models.Database) *SyncService {
	return &SyncService{
		db:      db,
		account: NewAccountService(db),
	}
}

func (s *SyncService) getGitHubToken() string {
	tokens, err := s.db.SyncToken.Select().Where("platform = ? AND is_active = ?", "github", true).All()
	if err != nil || len(tokens) == 0 {
		return ""
	}
	return tokens[0].AccessToken
}

type GitHubUser struct {
	Login     string `json:"login"`
	ID        int64  `json:"id"`
	AvatarURL string `json:"avatar_url"`
	Email     string `json:"email"`
	Name      string `json:"name"`
}

type GitHubRepo struct {
	ID               int64      `json:"id"`
	Name             string     `json:"name"`
	FullName         string     `json:"full_name"`
	Description      string     `json:"description"`
	Homepage         string     `json:"homepage"`
	Private          bool       `json:"private"`
	Fork             bool       `json:"fork"`
	CloneURL         string     `json:"clone_url"`
	SSHURL           string     `json:"ssh_url"`
	HTMLURL          string     `json:"html_url"`
	Owner            GitHubUser `json:"owner"`
	StargazersCount  int        `json:"stargazers_count"`
	ForksCount       int        `json:"forks_count"`
	WatchersCount    int        `json:"watchers_count"`
	SubscribersCount int        `json:"subscribers_count"`
	DefaultBranch    string     `json:"default_branch"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type GitHubLabel struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Color       string `json:"color"`
	Description string `json:"description"`
}

type GitHubIssue struct {
	ID          int64         `json:"id"`
	Number      int           `json:"number"`
	Title       string        `json:"title"`
	Body        string        `json:"body"`
	State       string        `json:"state"`
	User        GitHubUser    `json:"user"`
	Labels      []GitHubLabel `json:"labels"`
	PullRequest *struct {
		URL string `json:"url"`
	} `json:"pull_request"`
	Comments  int        `json:"comments"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	ClosedAt  *time.Time `json:"closed_at"`
}

type GitHubPR struct {
	ID       int64         `json:"id"`
	Number   int           `json:"number"`
	Title    string        `json:"title"`
	Body     string        `json:"body"`
	State    string        `json:"state"`
	User     GitHubUser    `json:"user"`
	Labels   []GitHubLabel `json:"labels"`
	Comments int           `json:"comments"`
	Head     struct {
		Ref  string `json:"ref"`
		Sha  string `json:"sha"`
		Repo struct {
			Name string `json:"name"`
		} `json:"repo"`
	} `json:"head"`
	Base struct {
		Ref string `json:"ref"`
		Sha string `json:"sha"`
	} `json:"base"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	ClosedAt  *time.Time `json:"closed_at"`
	MergedAt  *time.Time `json:"merged_at"`
}

func (s *SyncService) makeGitHubRequest(url string, token string) ([]byte, error) {
	data, _, err := s.makeGitHubRequestWithHeaders(url, token)
	return data, err
}

func (s *SyncService) makeGitHubRequestWithHeaders(url string, token string) ([]byte, http.Header, error) {
	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(attempt*attempt) * time.Second
			fmt.Printf("Retry %d/2 after %v: %v\n", attempt+1, backoff, lastErr)
			time.Sleep(backoff)
		}

		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			return nil, nil, err
		}

		req.Header.Set("Accept", "application/vnd.github.v3+json")
		if token != "" {
			req.Header.Set("Authorization", fmt.Sprintf("token %s", token))
		}

		client := NewHTTPClient(60 * time.Second)
		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			if resp.StatusCode == 403 || resp.StatusCode == 429 {
				resetStr := resp.Header.Get("X-RateLimit-Reset")
				if resetStr != "" {
					if resetUnix, err2 := strconv.ParseInt(resetStr, 10, 64); err2 == nil {
						resetTime := time.Unix(resetUnix, 0)
						return nil, resp.Header, &RateLimitError{ResetAt: resetTime, URL: url}
					}
				}
				return nil, resp.Header, fmt.Errorf("GitHub API returned status %d: %s", resp.StatusCode, string(body)[:min(len(body), 200)])
			}
			return nil, resp.Header, fmt.Errorf("GitHub API returned status %d for URL %s: %s", resp.StatusCode, url, string(body)[:min(len(body), 200)])
		}

		data, err := io.ReadAll(resp.Body)
		return data, resp.Header, err
	}
	return nil, nil, fmt.Errorf("failed after 2 retries: %w", lastErr)
}

type RateLimitError struct {
	ResetAt time.Time
	URL     string
}

// getNextPageURL parses the Link header and returns the "next" page URL.
// Returns empty string if no next page exists.
func getNextPageURL(header http.Header) string {
	linkHeader := header.Get("Link")
	if linkHeader == "" {
		return ""
	}
	for _, part := range strings.Split(linkHeader, ",") {
		part = strings.TrimSpace(part)
		if strings.HasSuffix(part, `; rel="next"`) {
			url := strings.TrimPrefix(part, "<")
			url = strings.TrimSuffix(url, `>; rel="next"`)
			return url
		}
	}
	return ""
}

func (e *RateLimitError) Error() string {
	return fmt.Sprintf("GitHub API rate limit exceeded (reset at %s)", e.ResetAt.Format(time.RFC3339))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (s *SyncService) FetchGitHubRepoInfo(cloneURL string) (*GitHubRepo, error) {
	parts := strings.Split(strings.TrimSuffix(cloneURL, ".git"), "/")
	if len(parts) < 2 {
		return nil, fmt.Errorf("invalid GitHub URL")
	}
	owner := parts[len(parts)-2]
	repo := parts[len(parts)-1]

	var client *github.Client
	httpClient := NewHTTPClient(30 * time.Second)
	token := s.getGitHubToken()
	if token != "" {
		client = github.NewClient(httpClient).WithAuthToken(token)
	} else {
		client = github.NewClient(httpClient)
	}

	ctx := context.Background()
	ghRepo, _, err := client.Repositories.Get(ctx, owner, repo)
	if err != nil {
		return nil, err
	}

	result := &GitHubRepo{
		ID:              ghRepo.GetID(),
		Name:            ghRepo.GetName(),
		FullName:        ghRepo.GetFullName(),
		Description:     ghRepo.GetDescription(),
		Homepage:        ghRepo.GetHomepage(),
		Private:         ghRepo.GetPrivate(),
		Fork:            ghRepo.GetFork(),
		CloneURL:        ghRepo.GetCloneURL(),
		SSHURL:          ghRepo.GetSSHURL(),
		HTMLURL:         ghRepo.GetHTMLURL(),
		StargazersCount: ghRepo.GetStargazersCount(),
		ForksCount:      ghRepo.GetForksCount(),
		WatchersCount:   ghRepo.GetWatchersCount(),
		DefaultBranch:   ghRepo.GetDefaultBranch(),
	}

	if ghRepo.Owner != nil {
		result.Owner = GitHubUser{
			ID:        ghRepo.Owner.GetID(),
			Login:     ghRepo.Owner.GetLogin(),
			AvatarURL: ghRepo.Owner.GetAvatarURL(),
		}
	}

	if !ghRepo.GetCreatedAt().IsZero() {
		result.CreatedAt = ghRepo.GetCreatedAt().Time
	}
	if !ghRepo.GetUpdatedAt().IsZero() {
		result.UpdatedAt = ghRepo.GetUpdatedAt().Time
	}

	return result, nil
}

func (s *SyncService) makeGiteaRequest(baseURL, path, token string) ([]byte, error) {
	url := fmt.Sprintf("%s/api/v1/%s", baseURL, path)
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * 2 * time.Second)
		}

		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			return nil, err
		}

		if token != "" {
			req.Header.Set("Authorization", "token "+token)
		}

		client := NewHTTPClient(30 * time.Second)
		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("Gitea API returned status %d", resp.StatusCode)
		}

		return io.ReadAll(resp.Body)
	}
	return nil, fmt.Errorf("failed after 3 retries: %w", lastErr)
}

func (s *SyncService) SyncGiteaIssues(ctx context.Context, repoID int64, owner, repo, token string) (SyncResult, error) {
	result := SyncResult{}
	remoteRepo, _ := s.GetRemoteRepoInfo(repoID)
	baseURL := "https://gitea.com"
	if remoteRepo != nil && remoteRepo.WebURL != "" {
		idx := strings.Index(remoteRepo.WebURL, "/"+owner+"/"+repo)
		if idx > 0 {
			baseURL = remoteRepo.WebURL[:idx]
		}
	}

	page := 1
	limit := 100

	for {
		url := fmt.Sprintf("repos/%s/%s/issues?state=all&limit=%d&page=%d", owner, repo, limit, page)
		data, err := s.makeGiteaRequest(baseURL, url, token)
		if err != nil {
			return result, err
		}

		var giteaIssues []struct {
			ID        int64         `json:"id"`
			Number    int           `json:"number"`
			Title     string        `json:"title"`
			Body      string        `json:"body"`
			State     string        `json:"state"`
			User      GitHubUser    `json:"user"`
			Labels    []GitHubLabel `json:"labels"`
			CreatedAt time.Time     `json:"created_at"`
			UpdatedAt time.Time     `json:"updated_at"`
		}
		if err := json.Unmarshal(data, &giteaIssues); err != nil {
			return result, err
		}

		if len(giteaIssues) == 0 {
			break
		}

		for _, giteaIssue := range giteaIssues {
			contributor, err := s.getOrCreateContributor(repoID, giteaIssue.User.Login, fmt.Sprintf("%d+%s@users.noreply.gitea.com", giteaIssue.User.ID, giteaIssue.User.Login), nil)
			if err != nil {
				continue
			}
			contributor.Avatar = giteaIssue.User.AvatarURL
			s.db.Contributor.Save().One(contributor)

			isClosed := giteaIssue.State == "closed"
			issue := models.Issue{
				Title:        giteaIssue.Title,
				Body:         giteaIssue.Body,
				Number:       giteaIssue.Number,
				RepositoryID: repoID,
				AuthorID:     contributor.ID,
				IsClosed:     isClosed,
				CreatedAt:    giteaIssue.CreatedAt,
				UpdatedAt:    giteaIssue.UpdatedAt,
			}

			existingIssues, _ := s.db.Issue.Select().Where("repository_id = ? AND number = ?", repoID, giteaIssue.Number).All()
			if len(existingIssues) > 0 {
				issue = *existingIssues[0]
				issue.Title = giteaIssue.Title
				issue.Body = giteaIssue.Body
				issue.IsClosed = isClosed
				issue.UpdatedAt = giteaIssue.UpdatedAt
				if err := s.db.Issue.Save().One(&issue); err == nil {
					result.IssuesUpdated++
				}
			} else {
				if err := s.db.Issue.Insert().One(&issue); err == nil {
					result.IssuesInserted++
				}
			}

			s.syncIssueLabels(repoID, issue.ID, giteaIssue.Labels)
		}

		page++
	}

	return result, nil
}

func (s *SyncService) SyncGiteaPRs(ctx context.Context, repoID int64, owner, repo, token string) (SyncResult, error) {
	result := SyncResult{}
	remoteRepo, _ := s.GetRemoteRepoInfo(repoID)
	baseURL := "https://gitea.com"
	if remoteRepo != nil && remoteRepo.WebURL != "" {
		idx := strings.Index(remoteRepo.WebURL, "/"+owner+"/"+repo)
		if idx > 0 {
			baseURL = remoteRepo.WebURL[:idx]
		}
	}

	page := 1
	limit := 100

	for {
		url := fmt.Sprintf("repos/%s/%s/pulls?state=all&limit=%d&page=%d", owner, repo, limit, page)
		data, err := s.makeGiteaRequest(baseURL, url, token)
		if err != nil {
			return result, err
		}

		var giteaPRs []struct {
			ID     int64         `json:"id"`
			Number int           `json:"number"`
			Title  string        `json:"title"`
			Body   string        `json:"body"`
			State  string        `json:"state"`
			User   GitHubUser    `json:"user"`
			Labels []GitHubLabel `json:"labels"`
			Head   struct {
				Ref string `json:"ref"`
			} `json:"head"`
			Base struct {
				Ref string `json:"ref"`
			} `json:"base"`
			CreatedAt time.Time  `json:"created_at"`
			UpdatedAt time.Time  `json:"updated_at"`
			MergedAt  *time.Time `json:"merged_at"`
		}
		if err := json.Unmarshal(data, &giteaPRs); err != nil {
			return result, err
		}

		if len(giteaPRs) == 0 {
			break
		}

		for _, giteaPR := range giteaPRs {
			contributor, err := s.getOrCreateContributor(repoID, giteaPR.User.Login, fmt.Sprintf("%d+%s@users.noreply.gitea.com", giteaPR.User.ID, giteaPR.User.Login), nil)
			if err != nil {
				continue
			}
			contributor.Avatar = giteaPR.User.AvatarURL
			s.db.Contributor.Save().One(contributor)

			isClosed := giteaPR.State == "closed"
			isMerged := giteaPR.MergedAt != nil
			status := "open"
			if isClosed {
				status = "closed"
			}

			pr := models.PullRequest{
				Title:        giteaPR.Title,
				Body:         giteaPR.Body,
				Number:       giteaPR.Number,
				RepositoryID: repoID,
				AuthorID:     contributor.ID,
				SourceBranch: giteaPR.Head.Ref,
				TargetBranch: giteaPR.Base.Ref,
				Status:       status,
				IsMerged:     isMerged,
				IsClosed:     isClosed,
				CreatedAt:    giteaPR.CreatedAt,
				UpdatedAt:    giteaPR.UpdatedAt,
			}

			existingPRs, _ := s.db.PullRequest.Select().Where("repository_id = ? AND number = ?", repoID, giteaPR.Number).All()
			if len(existingPRs) > 0 {
				pr = *existingPRs[0]
				pr.Title = giteaPR.Title
				pr.Body = giteaPR.Body
				pr.SourceBranch = giteaPR.Head.Ref
				pr.TargetBranch = giteaPR.Base.Ref
				pr.Status = status
				pr.IsMerged = isMerged
				pr.IsClosed = isClosed
				pr.UpdatedAt = giteaPR.UpdatedAt
				if err := s.db.PullRequest.Save().One(&pr); err == nil {
					result.PRsUpdated++
				}
			} else {
				if err := s.db.PullRequest.Insert().One(&pr); err == nil {
					result.PRsInserted++
				}
			}

			s.syncPRLabels(repoID, pr.ID, giteaPR.Labels)
		}

		page++
	}

	return result, nil
}

func (s *SyncService) SyncGitHubRepo(ctx context.Context, owner, repo string, token string, userID int64) (*models.Repository, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s", owner, repo)
	data, err := s.makeGitHubRequest(url, token)
	if err != nil {
		return nil, err
	}

	var ghRepo GitHubRepo
	if err := json.Unmarshal(data, &ghRepo); err != nil {
		return nil, err
	}

	account, err := s.account.CreateOrUpdateAccount(
		"github",
		ghRepo.Owner.Login,
		"",
		ghRepo.Owner.AvatarURL,
		"https://api.github.com",
		userID,
	)
	if err != nil {
		return nil, err
	}

	owners, err := s.db.Owner.Select().Where("username = ?", ghRepo.Owner.Login).All()
	var repoOwner models.Owner
	if len(owners) > 0 {
		repoOwner = *owners[0]
	} else {
		repoOwner = models.Owner{
			Username: ghRepo.Owner.Login,
			Email:    "",
			FullName: ghRepo.Owner.Login,
			Avatar:   ghRepo.Owner.AvatarURL,
		}
		if err := s.db.Owner.Insert().One(&repoOwner); err != nil {
			return nil, err
		}
	}

	repos, err := s.db.Repository.Select().Where("name = ? AND owner_id = ?", ghRepo.Name, repoOwner.ID).All()
	var repository models.Repository
	now := time.Now().UTC()

	if len(repos) > 0 {
		repository = *repos[0]
		repository.Description = ghRepo.Description
		repository.DefaultBranch = ghRepo.DefaultBranch
		repository.UpdatedAt = ghRepo.UpdatedAt
		repository.LastSyncAt = &now
		repository.ProjectType = "mirror"
		repository.MirrorURL = ghRepo.HTMLURL
		if err := s.db.Repository.Save().One(&repository); err != nil {
			return nil, err
		}
	} else {
		repository = models.Repository{
			Name:          ghRepo.Name,
			Description:   ghRepo.Description,
			Homepage:      ghRepo.Homepage,
			OwnerID:       repoOwner.ID,
			OwnerType:     "user",
			ProjectType:   "mirror",
			MirrorURL:     ghRepo.HTMLURL,
			LastSyncAt:    &now,
			DefaultBranch: ghRepo.DefaultBranch,
			CreatedAt:     ghRepo.CreatedAt,
			UpdatedAt:     ghRepo.UpdatedAt,
		}
		if err := s.db.Repository.Insert().One(&repository); err != nil {
			return nil, err
		}
	}

	repoStats, _ := s.db.RepositoryStats.Select().Where("repository_id = ?", repository.ID).One()
	if repoStats == nil {
		repoStats = &models.RepositoryStats{
			RepositoryID: repository.ID,
			StarsCount:   ghRepo.StargazersCount,
			ForksCount:   ghRepo.ForksCount,
			WatchCount:   ghRepo.SubscribersCount,
		}
		s.db.RepositoryStats.Insert().One(repoStats)
	} else {
		repoStats.StarsCount = ghRepo.StargazersCount
		repoStats.ForksCount = ghRepo.ForksCount
		repoStats.WatchCount = ghRepo.SubscribersCount
		s.db.RepositoryStats.Save().One(repoStats)
	}

	remoteRepo := models.RemoteRepository{
		Platform:     "github",
		Owner:        ghRepo.Owner.Login,
		RepoName:     ghRepo.Name,
		CloneURL:     ghRepo.CloneURL,
		SSHURL:       ghRepo.SSHURL,
		APIURL:       url,
		WebURL:       ghRepo.HTMLURL,
		RepositoryID: repository.ID,
		AccountID:    &account.ID,
		IsPrimary:    true,
		Direction:    "pull",
		LastSyncAt:   &now,
		SyncEnabled:  true,
	}

	existingRemotes, _ := s.db.RemoteRepository.Select().Where("repository_id = ? AND platform = ?", repository.ID, "github").All()
	if len(existingRemotes) > 0 {
		remoteRepo = *existingRemotes[0]
		remoteRepo.CloneURL = ghRepo.CloneURL
		remoteRepo.SSHURL = ghRepo.SSHURL
		remoteRepo.LastSyncAt = &now
		s.db.RemoteRepository.Save().One(&remoteRepo)
	} else {
		s.db.RemoteRepository.Insert().One(&remoteRepo)
	}

	return &repository, nil
}

func (s *SyncService) SyncGitHubIssues(ctx context.Context, repoID int64, owner, repo, token string, since *time.Time, lastNumber int) (SyncResult, error) {
	result := SyncResult{}
	cache := newContributorCache()

	existingCount, _ := s.db.Issue.Select().Where("repository_id = ?", repoID).Count("id")
	if existingCount == 0 {
		since = nil
		lastNumber = 0
	}

	// Resume from the max synced issue number to skip already-fetched pages
	if lastNumber == 0 && existingCount > 0 {
		if maxNum, err := s.db.Issue.Select().Where("repository_id = ?", repoID).Max("number"); err == nil && maxNum > 0 {
			lastNumber = int(maxNum)
		}
	}

	perPage := 100
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues?state=all&per_page=%d&sort=created&direction=asc", owner, repo, perPage)
	if since != nil {
		url += "&since=" + since.UTC().Format("2006-01-02T15:04:05Z")
	}

	for {
		data, headers, err := s.makeGitHubRequestWithHeaders(url, token)
		if err != nil {
			return result, err
		}

		var ghIssues []GitHubIssue
		if err := json.Unmarshal(data, &ghIssues); err != nil {
			return result, err
		}

		if len(ghIssues) == 0 {
			break
		}

		var issuesToInsert []*models.Issue
		var issueLabelsToInsert [][]GitHubLabel
		var issueCommentsCount []int
		var issuesToUpdate []*models.Issue
		var labelLinks []struct {
			issueID int64
			labels  []GitHubLabel
		}
		type commentTask struct {
			issueID       int64
			issueNumber   int
			commentsCount int
		}
		var commentTasks []commentTask

		allSkipped := true
		for _, ghIssue := range ghIssues {
			if ghIssue.PullRequest != nil {
				continue
			}
			if lastNumber > 0 && ghIssue.Number < lastNumber && since == nil {
				continue
			}
			if since != nil && ghIssue.UpdatedAt.Before(*since) {
				continue
			}
			allSkipped = false

			if ghIssue.Number > result.MaxIssueNumber {
				result.MaxIssueNumber = ghIssue.Number
			}

			contributor, err := s.getOrCreateContributor(repoID, ghIssue.User.Login, fmt.Sprintf("%d+%s@users.noreply.github.com", ghIssue.User.ID, ghIssue.User.Login), cache)
			if err != nil {
				fmt.Printf("Warning: failed to get/create contributor for Issue #%d: %v\n", ghIssue.Number, err)
				continue
			}
			if contributor.Avatar != ghIssue.User.AvatarURL {
				contributor.Avatar = ghIssue.User.AvatarURL
				s.db.Contributor.Save().One(contributor)
			}

			isClosed := ghIssue.State == "closed"
			existingIssues, _ := s.db.Issue.Select().Where("repository_id = ? AND number = ?", repoID, ghIssue.Number).All()

			if len(existingIssues) > 0 {
				issue := existingIssues[0]
				issue.Title = ghIssue.Title
				issue.Body = ghIssue.Body
				issue.AuthorID = contributor.ID
				issue.IsClosed = isClosed
				issue.UpdatedAt = ghIssue.UpdatedAt
				issuesToUpdate = append(issuesToUpdate, issue)

				labelLinks = append(labelLinks, struct {
					issueID int64
					labels  []GitHubLabel
				}{issue.ID, ghIssue.Labels})

				// Re-sync comments for updated issues (may be incomplete from previous interrupted sync)
				if ghIssue.Comments > 0 {
					commentTasks = append(commentTasks, commentTask{issue.ID, issue.Number, ghIssue.Comments})
				}
			} else {
				issue := &models.Issue{
					Title:        ghIssue.Title,
					Body:         ghIssue.Body,
					Number:       ghIssue.Number,
					RepositoryID: repoID,
					AuthorID:     contributor.ID,
					IsClosed:     isClosed,
					CreatedAt:    ghIssue.CreatedAt,
					UpdatedAt:    ghIssue.UpdatedAt,
				}
				issuesToInsert = append(issuesToInsert, issue)
				issueLabelsToInsert = append(issueLabelsToInsert, ghIssue.Labels)
				issueCommentsCount = append(issueCommentsCount, ghIssue.Comments)
			}
		}

		if len(issuesToInsert) > 0 {
			batchSize := 100
			for i := 0; i < len(issuesToInsert); i += batchSize {
				end := i + batchSize
				if end > len(issuesToInsert) {
					end = len(issuesToInsert)
				}
				batch := issuesToInsert[i:end]
				if err := s.db.Issue.Insert().All(true, batch); err != nil {
					for _, issue := range batch {
						if err2 := s.db.Issue.Insert().One(issue); err2 != nil {
							fmt.Printf("Warning: failed to insert Issue #%d: %v\n", issue.Number, err2)
						} else {
							result.IssuesInserted++
						}
					}
				} else {
					result.IssuesInserted += len(batch)
				}
			}

			for idx, issue := range issuesToInsert {
				var labels []GitHubLabel
				if idx < len(issueLabelsToInsert) {
					labels = issueLabelsToInsert[idx]
				}
				labelLinks = append(labelLinks, struct {
					issueID int64
					labels  []GitHubLabel
				}{issue.ID, labels})

				if idx < len(issueCommentsCount) && issueCommentsCount[idx] > 0 {
					commentTasks = append(commentTasks, commentTask{issue.ID, issue.Number, issueCommentsCount[idx]})
				}
			}
		}

		if len(issuesToUpdate) > 0 {
			for _, issue := range issuesToUpdate {
				if err := s.db.Issue.Save().One(issue); err != nil {
					fmt.Printf("Warning: failed to update Issue #%d: %v\n", issue.Number, err)
				} else {
					result.IssuesUpdated++
				}
			}
		}

		s.batchSyncIssueLabels(repoID, labelLinks)

		if len(commentTasks) > 0 {
			type commentResult struct {
				issueID  int64
				comments []GitHubComment
			}
			results := make([]commentResult, len(commentTasks))
			sem := make(chan struct{}, 10)
			var wg sync.WaitGroup
			for i, task := range commentTasks {
				wg.Add(1)
				sem <- struct{}{}
				go func(idx int, issueID int64, issueNumber int) {
					defer wg.Done()
					defer func() { <-sem }()
					comments, err := s.fetchIssueComments(ctx, repoID, issueID, issueNumber, owner, repo, token)
					if err != nil {
						fmt.Printf("Warning: failed to fetch comments for Issue #%d: %v\n", issueNumber, err)
						return
					}
					results[idx] = commentResult{issueID: issueID, comments: comments}
				}(i, task.issueID, task.issueNumber)
			}
			wg.Wait()

			var allCommentsToInsert []*models.Comment
			var allCommentsToUpdate []*models.Comment
			for _, cr := range results {
				if len(cr.comments) == 0 {
					continue
				}
				inserts, updates := s.prepareIssueComments(repoID, cr.issueID, cr.comments, cache)
				allCommentsToInsert = append(allCommentsToInsert, inserts...)
				allCommentsToUpdate = append(allCommentsToUpdate, updates...)
			}
			s.batchSaveComments(allCommentsToInsert, allCommentsToUpdate)
		}

		if allSkipped && since == nil {
			// All issues on this page were already synced (by number), no need to fetch more pages.
			// When since != nil, we can't break early because later pages may have updated issues.
			break
		}

		nextURL := getNextPageURL(headers)
		if nextURL == "" {
			break
		}
		url = nextURL
	}

	return result, nil
}

func (s *SyncService) batchSyncIssueLabels(repoID int64, links []struct {
	issueID int64
	labels  []GitHubLabel
}) {
	if len(links) == 0 {
		return
	}

	allLabelNames := make(map[string]bool)
	for _, link := range links {
		for _, l := range link.labels {
			allLabelNames[l.Name] = true
		}
	}
	if len(allLabelNames) == 0 {
		return
	}

	labelNameSlice := make([]string, 0, len(allLabelNames))
	for name := range allLabelNames {
		labelNameSlice = append(labelNameSlice, name)
	}
	existingLabels, _ := s.db.Label.Select().Where("repository_id = ? AND name IN ?", repoID, labelNameSlice).All()
	existingLabelMap := make(map[string]*models.Label)
	for _, l := range existingLabels {
		existingLabelMap[l.Name] = l
	}

	ghLabelMap := make(map[string]*GitHubLabel)
	var labelsToInsert []*models.Label
	for _, link := range links {
		for i := range link.labels {
			ghLabelMap[link.labels[i].Name] = &link.labels[i]
			if _, ok := existingLabelMap[link.labels[i].Name]; !ok {
				label := &models.Label{
					RepositoryID: repoID,
					Name:         link.labels[i].Name,
					Color:        link.labels[i].Color,
					Description:  link.labels[i].Description,
				}
				labelsToInsert = append(labelsToInsert, label)
				existingLabelMap[link.labels[i].Name] = label
			}
		}
	}

	if len(labelsToInsert) > 0 {
		if err := s.db.Label.Insert().All(true, labelsToInsert); err != nil {
			for _, label := range labelsToInsert {
				if err2 := s.db.Label.Insert().One(label); err2 != nil {
					delete(existingLabelMap, label.Name)
				}
			}
		}
	}

	issueIDs := make([]int64, len(links))
	for i, link := range links {
		issueIDs[i] = link.issueID
	}
	existingIssueLabels, _ := s.db.IssueLabel.Select().Where("issue_id IN ?", issueIDs).All()
	existingILSet := make(map[int64]map[int64]bool)
	for _, il := range existingIssueLabels {
		if existingILSet[il.IssueID] == nil {
			existingILSet[il.IssueID] = make(map[int64]bool)
		}
		existingILSet[il.IssueID][il.LabelID] = true
	}

	var allToInsert []*models.IssueLabel
	now := time.Now()
	for _, link := range links {
		for _, ghLabel := range link.labels {
			label, ok := existingLabelMap[ghLabel.Name]
			if !ok {
				continue
			}
			if existingILSet[link.issueID] != nil && existingILSet[link.issueID][label.ID] {
				continue
			}
			allToInsert = append(allToInsert, &models.IssueLabel{
				IssueID:   link.issueID,
				LabelID:   label.ID,
				CreatedAt: now,
			})
		}
	}

	if len(allToInsert) > 0 {
		if err := s.db.IssueLabel.Insert().All(false, allToInsert); err != nil {
			for _, il := range allToInsert {
				s.db.IssueLabel.Insert().One(il)
			}
		}
	}
}

func (s *SyncService) syncIssueLabels(repoID, issueID int64, ghLabels []GitHubLabel) {
	s.batchSyncIssueLabels(repoID, []struct {
		issueID int64
		labels  []GitHubLabel
	}{{issueID: issueID, labels: ghLabels}})
}

func (s *SyncService) syncPRLabels(repoID, prID int64, ghLabels []GitHubLabel) {
	s.batchSyncPRLabels(repoID, []struct {
		prID   int64
		labels []GitHubLabel
	}{{prID: prID, labels: ghLabels}})
}

func (s *SyncService) batchSyncPRLabels(repoID int64, links []struct {
	prID   int64
	labels []GitHubLabel
}) {
	if len(links) == 0 {
		return
	}

	allLabelNames := make(map[string]bool)
	for _, link := range links {
		for _, l := range link.labels {
			allLabelNames[l.Name] = true
		}
	}
	if len(allLabelNames) == 0 {
		return
	}

	labelNameSlice := make([]string, 0, len(allLabelNames))
	for name := range allLabelNames {
		labelNameSlice = append(labelNameSlice, name)
	}
	existingLabels, _ := s.db.Label.Select().Where("repository_id = ? AND name IN ?", repoID, labelNameSlice).All()
	existingLabelMap := make(map[string]*models.Label)
	for _, l := range existingLabels {
		existingLabelMap[l.Name] = l
	}

	ghLabelMap := make(map[string]*GitHubLabel)
	var labelsToInsert []*models.Label
	for _, link := range links {
		for i := range link.labels {
			ghLabelMap[link.labels[i].Name] = &link.labels[i]
			if _, ok := existingLabelMap[link.labels[i].Name]; !ok {
				label := &models.Label{
					RepositoryID: repoID,
					Name:         link.labels[i].Name,
					Color:        link.labels[i].Color,
					Description:  link.labels[i].Description,
				}
				labelsToInsert = append(labelsToInsert, label)
				existingLabelMap[link.labels[i].Name] = label
			}
		}
	}

	if len(labelsToInsert) > 0 {
		if err := s.db.Label.Insert().All(true, labelsToInsert); err != nil {
			for _, label := range labelsToInsert {
				if err2 := s.db.Label.Insert().One(label); err2 != nil {
					delete(existingLabelMap, label.Name)
				}
			}
		}
	}

	prIDs := make([]int64, len(links))
	for i, link := range links {
		prIDs[i] = link.prID
	}
	existingPRLabels, _ := s.db.PullRequestLabel.Select().Where("pull_request_id IN ?", prIDs).All()
	existingPLSet := make(map[int64]map[int64]bool)
	for _, pl := range existingPRLabels {
		if existingPLSet[pl.PullRequestID] == nil {
			existingPLSet[pl.PullRequestID] = make(map[int64]bool)
		}
		existingPLSet[pl.PullRequestID][pl.LabelID] = true
	}

	var allToInsert []*models.PullRequestLabel
	now := time.Now()
	for _, link := range links {
		for _, ghLabel := range link.labels {
			label, ok := existingLabelMap[ghLabel.Name]
			if !ok {
				continue
			}
			if existingPLSet[link.prID] != nil && existingPLSet[link.prID][label.ID] {
				continue
			}
			allToInsert = append(allToInsert, &models.PullRequestLabel{
				PullRequestID: link.prID,
				LabelID:       label.ID,
				CreatedAt:     now,
			})
		}
	}

	if len(allToInsert) > 0 {
		if err := s.db.PullRequestLabel.Insert().All(false, allToInsert); err != nil {
			for _, pl := range allToInsert {
				s.db.PullRequestLabel.Insert().One(pl)
			}
		}
	}
}

type GitHubComment struct {
	ID        int64      `json:"id"`
	Body      string     `json:"body"`
	User      GitHubUser `json:"user"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

func (s *SyncService) fetchIssueComments(ctx context.Context, repoID, issueID int64, issueNumber int, owner, repo, token string) ([]GitHubComment, error) {
	var allComments []GitHubComment
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues/%d/comments?per_page=100", owner, repo, issueNumber)
	for {
		data, headers, err := s.makeGitHubRequestWithHeaders(url, token)
		if err != nil {
			return nil, err
		}
		var ghComments []GitHubComment
		if err := json.Unmarshal(data, &ghComments); err != nil {
			return nil, err
		}
		if len(ghComments) == 0 {
			break
		}
		allComments = append(allComments, ghComments...)
		nextURL := getNextPageURL(headers)
		if nextURL == "" {
			break
		}
		url = nextURL
	}
	return allComments, nil
}

func (s *SyncService) fetchPRComments(ctx context.Context, repoID, prID int64, prNumber int, owner, repo, token string) ([]GitHubComment, error) {
	var allComments []GitHubComment
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls/%d/comments?per_page=100", owner, repo, prNumber)
	for {
		data, headers, err := s.makeGitHubRequestWithHeaders(url, token)
		if err != nil {
			return nil, err
		}
		var ghComments []GitHubComment
		if err := json.Unmarshal(data, &ghComments); err != nil {
			return nil, err
		}
		if len(ghComments) == 0 {
			break
		}
		allComments = append(allComments, ghComments...)
		nextURL := getNextPageURL(headers)
		if nextURL == "" {
			break
		}
		url = nextURL
	}
	return allComments, nil
}

func (s *SyncService) prepareIssueComments(repoID, issueID int64, ghComments []GitHubComment, cache *contributorCache) ([]*models.Comment, []*models.Comment) {
	var commentsToInsert []*models.Comment
	var commentsToUpdate []*models.Comment

	existingGitHubIDs := make(map[int64]*models.Comment)
	if len(ghComments) > 0 {
		ids := make([]int64, len(ghComments))
		for i, c := range ghComments {
			ids[i] = c.ID
		}
		existing, _ := s.db.Comment.Select().Where("github_id IN ?", ids).All()
		for _, c := range existing {
			if c.GitHubID != nil {
				existingGitHubIDs[*c.GitHubID] = c
			}
		}
	}

	for _, ghComment := range ghComments {
		contributor, err := s.getOrCreateContributor(repoID, ghComment.User.Login, fmt.Sprintf("%d+%s@users.noreply.github.com", ghComment.User.ID, ghComment.User.Login), cache)
		if err != nil {
			fmt.Printf("Warning: failed to get/create contributor for comment %d: %v\n", ghComment.ID, err)
			continue
		}
		if contributor.Avatar != ghComment.User.AvatarURL {
			contributor.Avatar = ghComment.User.AvatarURL
			s.db.Contributor.Save().One(contributor)
		}

		if existing, ok := existingGitHubIDs[ghComment.ID]; ok {
			existing.Body = ghComment.Body
			existing.IssueID = &issueID
			existing.AuthorID = contributor.ID
			existing.UpdatedAt = ghComment.UpdatedAt
			commentsToUpdate = append(commentsToUpdate, existing)
		} else {
			githubID := ghComment.ID
			comment := &models.Comment{
				GitHubID:  &githubID,
				Body:      ghComment.Body,
				IssueID:   &issueID,
				AuthorID:  contributor.ID,
				CreatedAt: ghComment.CreatedAt,
				UpdatedAt: ghComment.UpdatedAt,
			}
			commentsToInsert = append(commentsToInsert, comment)
		}
	}

	return commentsToInsert, commentsToUpdate
}

func (s *SyncService) preparePRComments(repoID, prID int64, ghComments []GitHubComment, cache *contributorCache) ([]*models.Comment, []*models.Comment) {
	var commentsToInsert []*models.Comment
	var commentsToUpdate []*models.Comment

	existingGitHubIDs := make(map[int64]*models.Comment)
	if len(ghComments) > 0 {
		ids := make([]int64, len(ghComments))
		for i, c := range ghComments {
			ids[i] = c.ID
		}
		existing, _ := s.db.Comment.Select().Where("github_id IN ?", ids).All()
		for _, c := range existing {
			if c.GitHubID != nil {
				existingGitHubIDs[*c.GitHubID] = c
			}
		}
	}

	for _, ghComment := range ghComments {
		contributor, err := s.getOrCreateContributor(repoID, ghComment.User.Login, fmt.Sprintf("%d+%s@users.noreply.github.com", ghComment.User.ID, ghComment.User.Login), cache)
		if err != nil {
			fmt.Printf("Warning: failed to get/create contributor for PR comment %d: %v\n", ghComment.ID, err)
			continue
		}
		if contributor.Avatar != ghComment.User.AvatarURL {
			contributor.Avatar = ghComment.User.AvatarURL
			s.db.Contributor.Save().One(contributor)
		}

		if existing, ok := existingGitHubIDs[ghComment.ID]; ok {
			existing.Body = ghComment.Body
			existing.PullRequestID = &prID
			existing.AuthorID = contributor.ID
			existing.UpdatedAt = ghComment.UpdatedAt
			commentsToUpdate = append(commentsToUpdate, existing)
		} else {
			githubID := ghComment.ID
			comment := &models.Comment{
				GitHubID:      &githubID,
				Body:          ghComment.Body,
				PullRequestID: &prID,
				AuthorID:      contributor.ID,
				CreatedAt:     ghComment.CreatedAt,
				UpdatedAt:     ghComment.UpdatedAt,
			}
			commentsToInsert = append(commentsToInsert, comment)
		}
	}

	return commentsToInsert, commentsToUpdate
}

func (s *SyncService) batchSaveComments(commentsToInsert, commentsToUpdate []*models.Comment) {
	if len(commentsToInsert) > 0 {
		batchSize := 100
		for i := 0; i < len(commentsToInsert); i += batchSize {
			end := i + batchSize
			if end > len(commentsToInsert) {
				end = len(commentsToInsert)
			}
			batch := commentsToInsert[i:end]
			if err := s.db.Comment.Insert().All(false, batch); err != nil {
				for _, comment := range batch {
					if err2 := s.db.Comment.Insert().One(comment); err2 != nil {
						ghID := int64(0)
						if comment.GitHubID != nil {
							ghID = *comment.GitHubID
						}
						fmt.Printf("Warning: failed to insert comment (github_id=%d): %v\n", ghID, err2)
					}
				}
			}
		}
	}

	if len(commentsToUpdate) > 0 {
		for _, comment := range commentsToUpdate {
			if err := s.db.Comment.Save().One(comment); err != nil {
				fmt.Printf("Warning: failed to update comment %d: %v\n", comment.ID, err)
			}
		}
	}
}

func (s *SyncService) SyncGitHubPRs(ctx context.Context, repoID int64, owner, repo, token string, since *time.Time, lastNumber int) (SyncResult, error) {
	result := SyncResult{}
	cache := newContributorCache()

	existingCount, _ := s.db.PullRequest.Select().Where("repository_id = ?", repoID).Count("id")
	if existingCount == 0 {
		since = nil
		lastNumber = 0
	}

	// Resume from the max synced PR number to skip already-fetched pages
	if lastNumber == 0 && existingCount > 0 {
		if maxNum, err := s.db.PullRequest.Select().Where("repository_id = ?", repoID).Max("number"); err == nil && maxNum > 0 {
			lastNumber = int(maxNum)
		}
	}

	perPage := 100
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls?state=all&per_page=%d&sort=created&direction=asc", owner, repo, perPage)

	for {
		data, headers, err := s.makeGitHubRequestWithHeaders(url, token)
		if err != nil {
			return result, err
		}

		var ghPRs []GitHubPR
		if err := json.Unmarshal(data, &ghPRs); err != nil {
			return result, err
		}

		if len(ghPRs) == 0 {
			break
		}

		var prsToInsert []*models.PullRequest
		var prLabelsToInsert [][]GitHubLabel
		var prCommentsCount []int
		var prsToUpdate []*models.PullRequest
		var labelLinks []struct {
			prID   int64
			labels []GitHubLabel
		}
		type commentTask struct {
			prID          int64
			prNumber      int
			commentsCount int
		}
		var commentTasks []commentTask

		allSkipped := true
		for _, ghPR := range ghPRs {
			if lastNumber > 0 && ghPR.Number < lastNumber && since == nil {
				continue
			}
			if since != nil && ghPR.UpdatedAt.Before(*since) {
				continue
			}
			allSkipped = false

			if ghPR.Number > result.MaxPRNumber {
				result.MaxPRNumber = ghPR.Number
			}

			contributor, err := s.getOrCreateContributor(repoID, ghPR.User.Login, fmt.Sprintf("%d+%s@users.noreply.github.com", ghPR.User.ID, ghPR.User.Login), cache)
			if err != nil {
				fmt.Printf("Warning: failed to get/create contributor for PR #%d: %v\n", ghPR.Number, err)
				continue
			}
			if contributor.Avatar != ghPR.User.AvatarURL {
				contributor.Avatar = ghPR.User.AvatarURL
				s.db.Contributor.Save().One(contributor)
			}

			isClosed := ghPR.State == "closed"
			isMerged := ghPR.MergedAt != nil
			status := "open"
			if isClosed {
				status = "closed"
			}

			existingPRs, _ := s.db.PullRequest.Select().Where("repository_id = ? AND number = ?", repoID, ghPR.Number).All()

			if len(existingPRs) > 0 {
				pr := existingPRs[0]
				pr.Title = ghPR.Title
				pr.Body = ghPR.Body
				pr.AuthorID = contributor.ID
				pr.SourceBranch = ghPR.Head.Ref
				pr.TargetBranch = ghPR.Base.Ref
				pr.Status = status
				pr.IsMerged = isMerged
				pr.IsClosed = isClosed
				pr.UpdatedAt = ghPR.UpdatedAt
				prsToUpdate = append(prsToUpdate, pr)

				labelLinks = append(labelLinks, struct {
					prID   int64
					labels []GitHubLabel
				}{pr.ID, ghPR.Labels})

				// Re-sync comments for updated PRs (may be incomplete from previous interrupted sync)
				if ghPR.Comments > 0 {
					commentTasks = append(commentTasks, commentTask{pr.ID, ghPR.Number, ghPR.Comments})
				}
			} else {
				pr := &models.PullRequest{
					Title:        ghPR.Title,
					Body:         ghPR.Body,
					Number:       ghPR.Number,
					RepositoryID: repoID,
					AuthorID:     contributor.ID,
					SourceBranch: ghPR.Head.Ref,
					TargetBranch: ghPR.Base.Ref,
					Status:       status,
					IsMerged:     isMerged,
					IsClosed:     isClosed,
					CreatedAt:    ghPR.CreatedAt,
					UpdatedAt:    ghPR.UpdatedAt,
				}
				prsToInsert = append(prsToInsert, pr)
				prLabelsToInsert = append(prLabelsToInsert, ghPR.Labels)
				prCommentsCount = append(prCommentsCount, ghPR.Comments)
			}
		}

		if len(prsToInsert) > 0 {
			batchSize := 100
			for i := 0; i < len(prsToInsert); i += batchSize {
				end := i + batchSize
				if end > len(prsToInsert) {
					end = len(prsToInsert)
				}
				batch := prsToInsert[i:end]
				if err := s.db.PullRequest.Insert().All(true, batch); err != nil {
					for _, pr := range batch {
						if err2 := s.db.PullRequest.Insert().One(pr); err2 != nil {
							fmt.Printf("Warning: failed to insert PR #%d: %v\n", pr.Number, err2)
						} else {
							result.PRsInserted++
						}
					}
				} else {
					result.PRsInserted += len(batch)
				}
			}

			for idx, pr := range prsToInsert {
				var labels []GitHubLabel
				if idx < len(prLabelsToInsert) {
					labels = prLabelsToInsert[idx]
				}
				labelLinks = append(labelLinks, struct {
					prID   int64
					labels []GitHubLabel
				}{pr.ID, labels})

				if idx < len(prCommentsCount) && prCommentsCount[idx] > 0 {
					commentTasks = append(commentTasks, commentTask{pr.ID, pr.Number, prCommentsCount[idx]})
				}
			}
		}

		if len(prsToUpdate) > 0 {
			for _, pr := range prsToUpdate {
				if err := s.db.PullRequest.Save().One(pr); err != nil {
					fmt.Printf("Warning: failed to update PR #%d: %v\n", pr.Number, err)
				} else {
					result.PRsUpdated++
				}
			}
		}

		s.batchSyncPRLabels(repoID, labelLinks)

		if len(commentTasks) > 0 {
			type commentResult struct {
				prID     int64
				comments []GitHubComment
			}
			results := make([]commentResult, len(commentTasks))
			sem := make(chan struct{}, 10)
			var wg sync.WaitGroup
			for i, task := range commentTasks {
				wg.Add(1)
				sem <- struct{}{}
				go func(idx int, prID int64, prNumber int) {
					defer wg.Done()
					defer func() { <-sem }()
					comments, err := s.fetchPRComments(ctx, repoID, prID, prNumber, owner, repo, token)
					if err != nil {
						fmt.Printf("Warning: failed to fetch comments for PR #%d: %v\n", prNumber, err)
						return
					}
					results[idx] = commentResult{prID: prID, comments: comments}
				}(i, task.prID, task.prNumber)
			}
			wg.Wait()

			var allCommentsToInsert []*models.Comment
			var allCommentsToUpdate []*models.Comment
			for _, cr := range results {
				if len(cr.comments) == 0 {
					continue
				}
				inserts, updates := s.preparePRComments(repoID, cr.prID, cr.comments, cache)
				allCommentsToInsert = append(allCommentsToInsert, inserts...)
				allCommentsToUpdate = append(allCommentsToUpdate, updates...)
			}
			s.batchSaveComments(allCommentsToInsert, allCommentsToUpdate)
		}

		if allSkipped && since == nil {
			// All PRs on this page were already synced (by number), no need to fetch more pages.
			// When since != nil, we can't break early because later pages may have updated PRs.
			break
		}

		nextURL := getNextPageURL(headers)
		if nextURL == "" {
			break
		}
		url = nextURL
	}

	return result, nil
}

func (s *SyncService) getOrCreateUser(user *models.User) (*models.User, bool, error) {
	users, err := s.db.User.Select().Where("username = ?", user.Username).All()
	if err != nil {
		return nil, false, err
	}

	if len(users) > 0 {
		return users[0], false, nil
	}

	if err := s.db.User.Insert().One(user); err != nil {
		return nil, false, err
	}

	return user, true, nil
}

func (s *SyncService) getOrCreateContributor(repoID int64, username, email string, cache *contributorCache) (*models.Contributor, error) {
	cacheKey := fmt.Sprintf("%d:%s", repoID, username)
	if cache != nil {
		if c, ok := cache.Get(cacheKey); ok {
			return c, nil
		}
	}

	contributors, err := s.db.Contributor.Select().Where("repository_id = ? AND name = ?", repoID, username).All()
	if err != nil {
		return nil, err
	}

	if len(contributors) > 0 {
		if cache != nil {
			cache.Set(cacheKey, contributors[0])
		}
		return contributors[0], nil
	}

	contributor := &models.Contributor{
		Name:         username,
		Email:        email,
		RepositoryID: repoID,
		CommitsCount: 0,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.db.Contributor.Insert().One(contributor); err != nil {
		return nil, err
	}

	if cache != nil {
		cache.Set(cacheKey, contributor)
	}
	return contributor, nil
}

func (s *SyncService) CreateSyncPoint(repoID, remoteRepoID int64, syncType string) (*models.SyncPoint, error) {
	syncPoint := models.SyncPoint{
		RepositoryID: repoID,
		RemoteRepoID: remoteRepoID,
		SyncType:     syncType,
		SyncInterval: 3600,
	}

	if err := s.db.SyncPoint.Insert().One(&syncPoint); err != nil {
		return nil, err
	}

	return &syncPoint, nil
}

func (s *SyncService) UpdateSyncPoint(syncPointID int64, success bool, message string) error {
	syncPoints, err := s.db.SyncPoint.Select().Where("id = ?", syncPointID).All()
	if err != nil {
		return err
	}

	if len(syncPoints) == 0 {
		return fmt.Errorf("sync point not found")
	}

	syncPoint := *syncPoints[0]
	now := time.Now().UTC()
	syncPoint.LastSyncAt = &now

	if success {
		syncPoint.LastSuccessAt = &now
		syncPoint.FailureCount = 0
	} else {
		syncPoint.LastFailureAt = &now
		syncPoint.FailureCount++
		syncPoint.LastError = message
	}

	return s.db.SyncPoint.Save().One(&syncPoint)
}

func (s *SyncService) LogSync(syncPointID int64, syncType, status, message string, duration int64, itemsSynced, itemsFailed int, details string) error {
	log := models.SyncLog{
		SyncPointID: syncPointID,
		SyncType:    syncType,
		Status:      status,
		Message:     message,
		Duration:    duration,
		ItemsSynced: itemsSynced,
		ItemsFailed: itemsFailed,
		Details:     details,
		CreatedAt:   time.Now().UTC(),
	}

	return s.db.SyncLog.Insert().One(&log)
}

func (s *SyncService) UpdateSyncLog(logID int64, status, message string, duration, itemsSynced, itemsFailed int64) error {
	existing, err := s.db.SyncLog.Select().Where("id = ?", logID).One()
	if err != nil {
		return err
	}
	existing.Status = status
	existing.Message = message
	existing.Duration = duration
	existing.ItemsSynced = int(itemsSynced)
	existing.ItemsFailed = int(itemsFailed)
	return s.db.SyncLog.Save().One(existing)
}

func (s *SyncService) getRepoRoot() string {
	return config.GetRepoRoot()
}

type GitSyncResult struct {
	Command    string
	Output     string
	Success    bool
	ProxyURL   string
	LocalPath  string
	DurationMs int64
	LogID      int64
}

func LogGitCommand(db *models.Database, command, workingDir, output string, status string, exitCode int, durationMs int64, repoID *int64, errMsg string) (int64, error) {
	logEntry := models.GitCommandLog{
		Command:      command,
		WorkingDir:   workingDir,
		Output:       output,
		Status:       status,
		ExitCode:     exitCode,
		DurationMs:   durationMs,
		RepositoryID: repoID,
		ErrorMsg:     errMsg,
	}
	if err := db.GitCommandLog.Insert().One(&logEntry); err != nil {
		return 0, fmt.Errorf("[GIT-LOG] failed to save log entry: %w", err)
	}
	return logEntry.ID, nil
}

func (s *SyncService) RunGitCommand(args []string, workingDir string, repoID *int64) (*GitSyncResult, error) {
	logEntry := models.GitCommandLog{
		Command:      fmt.Sprintf("git %s", strings.Join(args, " ")),
		WorkingDir:   workingDir,
		Status:       "running",
		RepositoryID: repoID,
	}

	now := time.Now()
	logEntry.StartedAt = &now

	if err := s.db.GitCommandLog.Insert().One(&logEntry); err != nil {
		fmt.Printf("[GIT-LOG] Warning: failed to create log entry: %v\n", err)
	}

	result := &GitSyncResult{
		Command:   logEntry.Command,
		LocalPath: workingDir,
		LogID:     logEntry.ID,
	}

	startTime := time.Now()
	fmt.Printf("[GIT-CMD] [%d] >>> %s (dir=%s)\n", logEntry.ID, logEntry.Command, workingDir)

	var cmd *exec.Cmd
	if workingDir != "" {
		cmd = exec.Command("git", args...)
		cmd.Dir = workingDir
	} else {
		cmd = exec.Command("git", args...)
	}

	output, err := cmd.CombinedOutput()
	result.Output = strings.TrimSpace(string(output))
	result.DurationMs = time.Since(startTime).Milliseconds()

	finishTime := time.Now()
	logEntry.FinishedAt = &finishTime
	logEntry.DurationMs = result.DurationMs
	logEntry.Output = result.Output

	if err != nil {
		result.Success = false
		logEntry.Status = "failed"
		logEntry.ErrorMsg = err.Error()
		if exitErr, ok := err.(*exec.ExitError); ok {
			logEntry.ExitCode = exitErr.ExitCode()
		}
		fmt.Printf("[GIT-CMD] [%d] <<< FAILED (%dms) exit=%d\n  Error: %v\n  Output: %s\n",
			logEntry.ID, result.DurationMs, logEntry.ExitCode, err, truncateOutput(result.Output, 500))
	} else {
		result.Success = true
		logEntry.Status = "success"
		logEntry.ExitCode = 0
		fmt.Printf("[GIT-CMD] [%d] <<< OK (%dms) output:\n%s\n", logEntry.ID, result.DurationMs, truncateOutput(result.Output, 500))
	}

	if saveErr := s.db.GitCommandLog.Save().One(&logEntry); saveErr != nil {
		fmt.Printf("[GIT-LOG] Warning: failed to update log entry %d: %v\n", logEntry.ID, saveErr)
	}

	return result, err
}

func truncateOutput(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "...(truncated)"
}

func (s *SyncService) SyncPullRepository(localPath string) (*GitSyncResult, error) {
	proxyURL := config.GetProxyURL()

	if err := ConfigureGitProxy(); err != nil {
		fmt.Printf("[SYNC] Warning: failed to configure git proxy: %v\n", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	args := []string{"-C", localPath, "remote", "update"}
	cmdStr := fmt.Sprintf("git %s", strings.Join(args, " "))
	startTime := time.Now()
	fmt.Printf("[GIT-CMD] >>> %s (dir=%s)\n", cmdStr, localPath)

	cmd := exec.CommandContext(ctx, "git", args...)
	output, err := cmd.CombinedOutput()
	durationMs := time.Since(startTime).Milliseconds()
	outputStr := strings.TrimSpace(string(output))

	result := &GitSyncResult{
		Command:    cmdStr,
		Output:     outputStr,
		LocalPath:  localPath,
		ProxyURL:   proxyURL,
		DurationMs: durationMs,
	}

	logEntry := models.GitCommandLog{
		Command:    cmdStr,
		WorkingDir: localPath,
		Output:     outputStr,
		DurationMs: durationMs,
	}

	if err != nil {
		result.Success = false
		logEntry.Status = "failed"
		logEntry.ErrorMsg = err.Error()
		if exitErr, ok := err.(*exec.ExitError); ok {
			logEntry.ExitCode = exitErr.ExitCode()
		}
		if ctx.Err() == context.DeadlineExceeded {
			logEntry.ErrorMsg = "git remote update timed out after 5 minutes"
			s.db.GitCommandLog.Insert().One(&logEntry)
			result.LogID = logEntry.ID
			return result, fmt.Errorf("git remote update timed out after 5 minutes")
		}
	} else {
		result.Success = true
		logEntry.Status = "success"
		logEntry.ExitCode = 0
	}

	if saveErr := s.db.GitCommandLog.Insert().One(&logEntry); saveErr != nil {
		fmt.Printf("[GIT-LOG] Warning: failed to save log entry: %v\n", saveErr)
	}
	result.LogID = logEntry.ID

	fmt.Printf("[GIT-CMD] <<< [%s] (%dms) log_id=%d output:\n%s\n",
		logEntry.Status, durationMs, logEntry.ID, truncateOutput(outputStr, 500))

	if err != nil {
		return result, fmt.Errorf("failed to sync repository: %s", result.Output)
	}

	fetchArgs := []string{"-C", localPath, "fetch", "origin", "+refs/heads/*:refs/heads/*"}
	fetchCmdStr := fmt.Sprintf("git %s", strings.Join(fetchArgs, " "))
	fmt.Printf("[GIT-CMD] >>> Updating local branch refs: %s\n", fetchCmdStr)

	fetchCmd := exec.CommandContext(ctx, "git", fetchArgs...)
	fetchOutput, fetchErr := fetchCmd.CombinedOutput()
	fetchOutputStr := strings.TrimSpace(string(fetchOutput))

	if fetchErr != nil {
		fmt.Printf("[GIT-CMD] Warning: failed to update local branch refs: %s\n", fetchOutputStr)
		result.Output = result.Output + "\n[branch-update] " + fetchOutputStr
	} else {
		fmt.Printf("[GIT-CMD] <<< Branch refs updated: %s\n", truncateOutput(fetchOutputStr, 200))
		result.Output = result.Output + "\n[branch-updated] " + fetchOutputStr
	}

	fetchLogEntry := models.GitCommandLog{
		Command:    fetchCmdStr,
		WorkingDir: localPath,
		Output:     fetchOutputStr,
		DurationMs: time.Since(startTime).Milliseconds(),
	}
	if fetchErr != nil {
		fetchLogEntry.Status = "failed"
		fetchLogEntry.ErrorMsg = fetchErr.Error()
	} else {
		fetchLogEntry.Status = "success"
		fetchLogEntry.ExitCode = 0
	}
	s.db.GitCommandLog.Insert().One(&fetchLogEntry)

	return result, nil
}

func (s *SyncService) SyncPushAll(localPath string) (*GitSyncResult, error) {
	proxyURL := config.GetProxyURL()

	if err := ConfigureGitProxy(); err != nil {
		fmt.Printf("[SYNC] Warning: failed to configure git proxy: %v\n", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	result := &GitSyncResult{
		LocalPath: localPath,
		ProxyURL:  proxyURL,
		Output:    "",
		Success:   true,
	}

	totalStart := time.Now()

	pushSteps := []struct {
		name string
		args []string
	}{
		{"push-all", []string{"-C", localPath, "push", "origin", "--all"}},
		{"push-tags", []string{"-C", localPath, "push", "origin", "--tags"}},
	}

	for _, step := range pushSteps {
		stepStart := time.Now()
		cmdStr := fmt.Sprintf("git %s", strings.Join(step.args, " "))
		fmt.Printf("[GIT-CMD] >>> [%s] %s (dir=%s)\n", step.name, cmdStr, localPath)

		cmd := exec.CommandContext(ctx, "git", step.args...)
		output, err := cmd.CombinedOutput()
		durationMs := time.Since(stepStart).Milliseconds()
		outputStr := strings.TrimSpace(string(output))

		logEntry := models.GitCommandLog{
			Command:    cmdStr,
			WorkingDir: localPath,
			Output:     outputStr,
			DurationMs: durationMs,
		}

		if err != nil {
			result.Success = false
			logEntry.Status = "failed"
			logEntry.ErrorMsg = err.Error()
			if exitErr, ok := err.(*exec.ExitError); ok {
				logEntry.ExitCode = exitErr.ExitCode()
			}
			fmt.Printf("[GIT-CMD] <<< [%s] FAILED (%dms) exit=%d\n  Error: %v\n  Output: %s\n",
				step.name, durationMs, logEntry.ExitCode, err, truncateOutput(outputStr, 500))
		} else {
			logEntry.Status = "success"
			logEntry.ExitCode = 0
			fmt.Printf("[GIT-CMD] <<< [%s] OK (%dms)\n%s\n", step.name, durationMs, truncateOutput(outputStr, 500))
		}

		s.db.GitCommandLog.Insert().One(&logEntry)

		if result.Output != "" {
			result.Output += "\n"
		}
		result.Output += fmt.Sprintf("[%s] %s", step.name, outputStr)
		if result.Command == "" {
			result.Command = cmdStr
		} else {
			result.Command += " && " + step.name
		}
	}

	result.DurationMs = time.Since(totalStart).Milliseconds()

	return result, nil
}

func (s *SyncService) SetRemoteURL(localPath, remoteURL string) error {
	_, err := s.RunGitCommand([]string{"-C", localPath, "remote", "set-url", "origin", remoteURL}, "", nil)
	return err
}

func (s *SyncService) InitBareRepository(owner, name string) (string, error) {
	reposDir := s.getRepoRoot()
	if _, err := os.Stat(reposDir); os.IsNotExist(err) {
		os.MkdirAll(reposDir, 0755)
	}

	localPath := filepath.Join(reposDir, owner, name+".git")
	if _, err := s.RunGitCommand([]string{"init", "--bare", localPath}, "", nil); err != nil {
		return "", fmt.Errorf("failed to init repository: %v", err)
	}
	return localPath, nil
}

func (s *SyncService) PushRepository(localPath, remoteURL string) error {
	ConfigureGitProxy()

	if remoteURL != "" {
		s.RunGitCommand([]string{"-C", localPath, "remote", "add", "push_target", remoteURL}, "", nil)
	}

	if _, err := s.RunGitCommand([]string{"-C", localPath, "push", "push_target", "--all"}, "", nil); err != nil {
		return fmt.Errorf("failed to push repository: %v", err)
	}

	s.RunGitCommand([]string{"-C", localPath, "push", "push_target", "--tags"}, "", nil)

	return nil
}

func (s *SyncService) SyncRepositoryData(ctx context.Context, repoID int64, platform, owner, repoName, token string, issueSince, prSince *time.Time, lastIssueNumber, lastPRNumber int) (SyncResult, error) {
	result := SyncResult{}
	var firstErr error

	switch platform {
	case "gitea":
		issueResult, err := s.SyncGiteaIssues(ctx, repoID, owner, repoName, token)
		if err != nil {
			fmt.Printf("Warning: failed to sync issues: %v\n", err)
			if firstErr == nil {
				firstErr = err
			}
		} else {
			result.Add(issueResult)
		}

		prResult, err := s.SyncGiteaPRs(ctx, repoID, owner, repoName, token)
		if err != nil {
			fmt.Printf("Warning: failed to sync PRs: %v\n", err)
			if firstErr == nil {
				firstErr = err
			}
		} else {
			result.Add(prResult)
		}
	default:
		issueResult, err := s.SyncGitHubIssues(ctx, repoID, owner, repoName, token, issueSince, lastIssueNumber)
		if err != nil {
			fmt.Printf("Warning: failed to sync issues: %v\n", err)
			if firstErr == nil {
				firstErr = err
			}
		} else {
			result.Add(issueResult)
		}

		prResult, err := s.SyncGitHubPRs(ctx, repoID, owner, repoName, token, prSince, lastPRNumber)
		if err != nil {
			fmt.Printf("Warning: failed to sync PRs: %v\n", err)
			if firstErr == nil {
				firstErr = err
			}
		} else {
			result.Add(prResult)
		}

		if err := s.SyncGitHubContributors(ctx, repoID, owner, repoName, token); err != nil {
			fmt.Printf("Warning: failed to sync contributors: %v\n", err)
		}
		if err := s.SyncGitHubRepoStats(ctx, repoID, owner, repoName, token); err != nil {
			fmt.Printf("Warning: failed to sync repo stats: %v\n", err)
		}
	}

	statsSvc := NewStatsService(s.db)
	if err := statsSvc.UpdateRepositoryStats(repoID, owner, repoName); err != nil {
		fmt.Printf("Warning: failed to update repository stats: %v\n", err)
	}

	return result, firstErr
}

func (s *SyncService) GetRemoteRepoInfo(repoID int64) (*models.RemoteRepository, error) {
	remotes, err := s.db.RemoteRepository.Select().Where("repository_id = ?", repoID).All()
	if err != nil {
		return nil, err
	}
	if len(remotes) == 0 {
		return nil, nil
	}
	return remotes[0], nil
}

func (s *SyncService) GetSyncToken(accountID int64) (*models.SyncToken, error) {
	tokens, err := s.db.SyncToken.Select().Where("account_id = ? AND is_active = ?", accountID, true).All()
	if err != nil {
		return nil, err
	}
	if len(tokens) == 0 {
		return nil, nil
	}
	return tokens[0], nil
}

func (s *SyncService) SyncGitHubContributors(ctx context.Context, repoID int64, owner, repo, token string) error {
	perPage := 100
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contributors?per_page=%d", owner, repo, perPage)

	for {
		data, headers, err := s.makeGitHubRequestWithHeaders(url, token)
		if err != nil {
			return err
		}

		var ghContributors []struct {
			Login         string `json:"login"`
			ID            int64  `json:"id"`
			AvatarURL     string `json:"avatar_url"`
			Contributions int    `json:"contributions"`
		}
		if err := json.Unmarshal(data, &ghContributors); err != nil {
			return err
		}

		if len(ghContributors) == 0 {
			break
		}

		for _, ghContrib := range ghContributors {
			existingContribs, _ := s.db.Contributor.Select().Where("repository_id = ? AND name = ?", repoID, ghContrib.Login).All()

			if len(existingContribs) > 0 {
				contrib := existingContribs[0]
				contrib.CommitsCount = ghContrib.Contributions
				contrib.Avatar = ghContrib.AvatarURL
				contrib.UpdatedAt = time.Now()
				s.db.Contributor.Save().One(contrib)
			} else {
				contrib := &models.Contributor{
					Name:         ghContrib.Login,
					Email:        fmt.Sprintf("%d+%s@users.noreply.github.com", ghContrib.ID, ghContrib.Login),
					Avatar:       ghContrib.AvatarURL,
					RepositoryID: repoID,
					CommitsCount: ghContrib.Contributions,
					CreatedAt:    time.Now(),
					UpdatedAt:    time.Now(),
				}
				s.db.Contributor.Insert().One(contrib)
			}
		}

		nextURL := getNextPageURL(headers)
		if nextURL == "" {
			break
		}
		url = nextURL
	}

	return nil
}

func (s *SyncService) SyncGitHubRepoStats(ctx context.Context, repoID int64, owner, repo, token string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s", owner, repo)
	data, err := s.makeGitHubRequest(url, token)
	if err != nil {
		return err
	}

	var ghRepo GitHubRepo
	if err := json.Unmarshal(data, &ghRepo); err != nil {
		return err
	}

	repoStats, _ := s.db.RepositoryStats.Select().Where("repository_id = ?", repoID).One()
	if repoStats == nil {
		repoStats = &models.RepositoryStats{
			RepositoryID: repoID,
			StarsCount:   ghRepo.StargazersCount,
			ForksCount:   ghRepo.ForksCount,
			WatchCount:   ghRepo.SubscribersCount,
		}
		s.db.RepositoryStats.Insert().One(repoStats)
	} else {
		repoStats.StarsCount = ghRepo.StargazersCount
		repoStats.ForksCount = ghRepo.ForksCount
		repoStats.WatchCount = ghRepo.SubscribersCount
		repoStats.UpdatedAt = time.Now()
		s.db.RepositoryStats.Save().One(repoStats)
	}

	return nil
}

func (s *SyncService) CreateRemoteRepoFromMirrorURL(repoID int64, mirrorURL string) *models.RemoteRepository {
	platform := "github"
	baseURL := "https://github.com"

	if strings.Contains(mirrorURL, "gitea.com") {
		platform = "gitea"
		baseURL = "https://gitea.com"
	} else if strings.Contains(mirrorURL, "gitlab.com") {
		platform = "gitlab"
		baseURL = "https://gitlab.com"
	}

	parts := strings.Split(strings.TrimSuffix(mirrorURL, ".git"), "/")
	if len(parts) < 2 {
		return nil
	}
	owner := parts[len(parts)-2]
	repoName := parts[len(parts)-1]

	var accountID *int64
	accounts, err := s.db.PlatformAccount.Select().Where("platform = ?", platform).All()
	if err == nil && len(accounts) > 0 {
		accountID = &accounts[0].ID
	}

	now := time.Now()
	apiURL := fmt.Sprintf("%s/api/v3/repos/%s/%s", baseURL, owner, repoName)
	if platform == "gitlab" {
		apiURL = fmt.Sprintf("%s/api/v4/projects/%s%%2F%s", baseURL, owner, repoName)
	}
	sshURL := fmt.Sprintf("git@github.com:%s/%s.git", owner, repoName)
	if platform == "gitlab" {
		sshURL = fmt.Sprintf("git@gitlab.com:%s/%s.git", owner, repoName)
	} else if platform == "gitea" {
		sshURL = fmt.Sprintf("git@gitea.com:%s/%s.git", owner, repoName)
	}
	remoteRepo := &models.RemoteRepository{
		Platform:     platform,
		Owner:        owner,
		RepoName:     repoName,
		CloneURL:     mirrorURL,
		SSHURL:       sshURL,
		APIURL:       apiURL,
		WebURL:       fmt.Sprintf("%s/%s/%s", baseURL, owner, repoName),
		RepositoryID: repoID,
		AccountID:    accountID,
		IsPrimary:    true,
		Direction:    "pull",
		LastSyncAt:   &now,
		SyncEnabled:  true,
	}

	if err := s.db.RemoteRepository.Insert().One(remoteRepo); err != nil {
		log.Printf("Failed to create remote repo from mirror URL %s: %v", mirrorURL, err)
		return nil
	}

	return remoteRepo
}
