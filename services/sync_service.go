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
	"strings"
	"sync"
	"time"

	"github.com/VictoriaMetrics/fastcache"
	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gobus"
	"github.com/google/go-github/v88/github"
)

const (
	GitHubAPIBaseURL = "https://api.github.com"

	GitHubRepoPath = "repos/%s/%s"

	GitHubWebURL      = "https://github.com"
	GitLabWebURL      = "https://gitlab.com"
	GitHubAPIRepoPath = "%s/api/v3/repos/%s/%s"
	GitLabAPIRepoPath = "%s/api/v4/projects/%s%%2F%s"

	GiteaWebURL           = "https://gitea.com"
	GiteaAPIPath          = "%s/api/v1/%s"
	GiteaIssuesPath       = "repos/%s/%s/issues?state=all&limit=%d&page=%d"
	GiteaPullRequestsPath = "repos/%s/%s/pulls?state=all&limit=%d&page=%d"

	GitHubSSHURLTemplate = "git@github.com:%s/%s.git"
	GitLabSSHURLTemplate = "git@gitlab.com:%s/%s.git"
	GiteaSSHURLTemplate  = "git@gitea.com:%s/%s.git"
)

var (
	globalSyncMu  sync.Mutex
	globalSyncing = make(map[int64]bool)
	// defaultSyncBus is a package-level event bus used by all SyncService
	// instances that do not have their own bus attached.
	defaultSyncBus *gobus.EventBus
	// defaultETagCache is a package-level in-memory cache for ETag values,
	// avoiding a database round-trip on every GitHub API request.
	defaultETagCache *fastcache.Cache
)

// SetDefaultSyncBus sets the package-level event bus and registers the
// default stdout loggers. All SyncService instances will publish to it.
func SetDefaultSyncBus(bus *gobus.EventBus) {
	defaultSyncBus = bus
	SubscribeSyncLoggers(bus)
}

// DefaultSyncBus returns the package-level event bus, or nil if not set.
func DefaultSyncBus() *gobus.EventBus {
	return defaultSyncBus
}

// SetDefaultETagCache sets the package-level ETag cache used by all
// SyncService instances that do not have their own cache attached.
func SetDefaultETagCache(cache *fastcache.Cache) {
	defaultETagCache = cache
}

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

type contributorCache struct {
	mu    sync.RWMutex
	items map[string]*models.Contributor
}

func newContributorCache() *contributorCache {
	return &contributorCache{items: make(map[string]*models.Contributor)}
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

// preloadContributors loads all contributors for a repository into an in-memory cache.
func (s *SyncService) preloadContributors(repoID int64) (*contributorCache, error) {
	cache := newContributorCache()
	contributors, err := s.db.Contributor.Select().Where("repository_id = ?", repoID).All()
	if err != nil {
		return nil, err
	}
	for _, c := range contributors {
		if c.GitHubID > 0 {
			cache.Set(fmt.Sprintf("%d:%d", repoID, c.GitHubID), c)
		}
		cache.Set(fmt.Sprintf("%d:%s", repoID, c.Name), c)
	}
	return cache, nil
}

// findContributor looks up an existing contributor from the cache without creating one.
// It returns nil when no matching contributor exists.
func (s *SyncService) findContributor(repoID int64, username string, githubID int64, cache *contributorCache) *models.Contributor {
	if cache != nil {
		if githubID > 0 {
			if c, ok := cache.Get(fmt.Sprintf("%d:%d", repoID, githubID)); ok {
				return c
			}
		}
		if c, ok := cache.Get(fmt.Sprintf("%d:%s", repoID, username)); ok {
			return c
		}
	}
	return nil
}

type SyncService struct {
	db        *models.Database
	account   *AccountService
	bus       *gobus.EventBus
	etagCache *fastcache.Cache
	repoID    int64 // optional: scope emitted events to a repository
}

// Sync event topics used by SyncService to publish progress/warnings/errors.
const (
	SyncTopicProgress = "sync:progress"
	SyncTopicWarning  = "sync:warning"
	SyncTopicError    = "sync:error"
	SyncTopicComplete = "sync:complete"
)

// emit publishes a sync event to the attached bus or the package-level default bus.
// It is a no-op if no bus is configured, keeping the service usable in tests.
func (s *SyncService) emit(topic string, data map[string]any) {
	bus := s.bus
	if bus == nil {
		bus = defaultSyncBus
	}
	if bus == nil {
		return
	}
	if data == nil {
		data = make(map[string]any)
	}
	if s.repoID > 0 {
		data["repo_id"] = s.repoID
	}
	_, _ = bus.Publish(topic, data, 3, false)
}

// warnf logs a warning to stdout and emits a SyncTopicWarning event when a bus is available.
func (s *SyncService) warnf(format string, args ...any) {
	msg := fmt.Sprintf(format, args...)
	fmt.Println("Warning:", msg)
	s.emit(SyncTopicWarning, map[string]any{"message": msg})
}

// errorf logs an error to stdout and emits a SyncTopicError event when a bus is available.
func (s *SyncService) errorf(format string, args ...any) {
	msg := fmt.Sprintf(format, args...)
	fmt.Println("Error:", msg)
	s.emit(SyncTopicError, map[string]any{"message": msg})
}

type SyncResult struct {
	IssuesInserted    int
	IssuesUpdated     int
	IssuesDeleted     int
	PRsInserted       int
	PRsUpdated        int
	PRsDeleted        int
	MaxIssueNumber    int
	MaxPRNumber       int
	MaxIssueUpdatedAt *time.Time
	MaxPRUpdatedAt    *time.Time
}

// SyncProgressSaver is called periodically during a sync so that progress
// can be persisted before the full sync finishes. issueSince/prSince may be
// nil when no items have been synced yet.
type SyncProgressSaver func(issueNumber, prNumber int, issueSince, prSince *time.Time) error

func (r *SyncResult) Add(other SyncResult) {
	r.IssuesInserted += other.IssuesInserted
	r.IssuesUpdated += other.IssuesUpdated
	r.PRsInserted += other.PRsInserted
	r.PRsUpdated += other.PRsUpdated
	r.MaxIssueNumber = max(r.MaxIssueNumber, other.MaxIssueNumber)
	r.MaxPRNumber = max(r.MaxPRNumber, other.MaxPRNumber)
	if other.MaxIssueUpdatedAt != nil && (r.MaxIssueUpdatedAt == nil || other.MaxIssueUpdatedAt.After(*r.MaxIssueUpdatedAt)) {
		r.MaxIssueUpdatedAt = other.MaxIssueUpdatedAt
	}
	if other.MaxPRUpdatedAt != nil && (r.MaxPRUpdatedAt == nil || other.MaxPRUpdatedAt.After(*r.MaxPRUpdatedAt)) {
		r.MaxPRUpdatedAt = other.MaxPRUpdatedAt
	}
}

func NewSyncService(db *models.Database) *SyncService {
	svc := &SyncService{
		db:        db,
		account:   NewAccountService(db),
		etagCache: defaultETagCache,
	}
	return svc
}

// WithEventBus attaches an event bus to the sync service.
// Callers can subscribe to SyncTopic* to receive progress, warnings, errors and completion events.
func (s *SyncService) WithEventBus(bus *gobus.EventBus) *SyncService {
	s.bus = bus
	return s
}

// ForRepository scopes emitted sync events to the given repository ID.
func (s *SyncService) ForRepository(repoID int64) *SyncService {
	s.repoID = repoID
	return s
}

// SubscribeSyncLoggers registers default stdout loggers for sync events.
// It keeps existing console output behavior while allowing additional subscribers.
func SubscribeSyncLoggers(bus *gobus.EventBus) {
	bus.Subscribe(SyncTopicProgress, gobus.Fanout, "sync:logger:progress", func(e *gobus.Event) {
		msg, _ := e.Data["message"].(string)
		fmt.Println(msg)
	})
	bus.Subscribe(SyncTopicWarning, gobus.Fanout, "sync:logger:warning", func(e *gobus.Event) {
		msg, _ := e.Data["message"].(string)
		fmt.Println("Warning:", msg)
	})
	bus.Subscribe(SyncTopicError, gobus.Fanout, "sync:logger:error", func(e *gobus.Event) {
		msg, _ := e.Data["message"].(string)
		fmt.Println("Error:", msg)
	})
	bus.Subscribe(SyncTopicComplete, gobus.Fanout, "sync:logger:complete", func(e *gobus.Event) {
		msg, _ := e.Data["message"].(string)
		fmt.Println(msg)
	})
}

// NotModifiedError indicates the server returned 304 Not Modified.
type NotModifiedError struct {
	URL string
}

func (e *NotModifiedError) Error() string {
	return fmt.Sprintf("GitHub API returned 304 Not Modified for URL %s", e.URL)
}

func (s *SyncService) getETag(url string) string {
	if s.etagCache != nil {
		if v, ok := s.etagCache.HasGet(nil, []byte(url)); ok && len(v) > 0 {
			return string(v)
		}
	}
	etag, err := s.db.ETag.Where("url = ?", url).Select().One()
	if err != nil || etag == nil {
		return ""
	}
	if s.etagCache != nil {
		s.etagCache.Set([]byte(url), []byte(etag.ETag))
	}
	return etag.ETag
}

func (s *SyncService) setETag(url, etag string) {
	if etag == "" {
		return
	}
	_ = s.db.Upsert("etag", []string{"url", "etag", "updated_at"}, []string{"url"},
		url, etag, time.Now().UTC())
	if s.etagCache != nil {
		s.etagCache.Set([]byte(url), []byte(etag))
	}
}

func commentCountsFromIssues(issues []*models.Issue) map[int64]int {
	counts := make(map[int64]int, len(issues))
	for _, issue := range issues {
		counts[issue.ID] = issue.CommentsCount
	}
	return counts
}

func commentCountsFromPRs(prs []*models.PullRequest) map[int64]int {
	counts := make(map[int64]int, len(prs))
	for _, pr := range prs {
		counts[pr.ID] = pr.CommentsCount
	}
	return counts
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

type RateLimitError struct {
	ResetAt time.Time
	URL     string
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

	token := s.getGitHubToken()
	opts := []github.ClientOptionsFunc{github.WithHTTPClient(NewHTTPClient(30 * time.Second))}
	if token != "" {
		opts = append(opts, github.WithAuthToken(token))
	}
	client, err := github.NewClient(opts...)
	if err != nil {
		return nil, err
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
	url := fmt.Sprintf(GiteaAPIPath, baseURL, path)
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
	cache, err := s.preloadContributors(repoID)
	if err != nil {
		return result, err
	}
	remoteRepo, _ := s.GetRemoteRepoInfo(repoID)
	baseURL := GiteaWebURL
	if remoteRepo != nil && remoteRepo.WebURL != "" {
		idx := strings.Index(remoteRepo.WebURL, "/"+owner+"/"+repo)
		if idx > 0 {
			baseURL = remoteRepo.WebURL[:idx]
		}
	}

	page := 1
	limit := 100

	for {
		url := fmt.Sprintf(GiteaIssuesPath, owner, repo, limit, page)
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
			Comments  int           `json:"comments"`
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
			contributor := s.findContributor(repoID, giteaIssue.User.Login, giteaIssue.User.ID, cache)
			if contributor != nil {
				contributor.Avatar = giteaIssue.User.AvatarURL
				s.db.Contributor.Save().One(contributor)
			}
			authorID := int64(0)
			if contributor != nil {
				authorID = contributor.ID
			}

			isClosed := giteaIssue.State == "closed"
			issue := models.Issue{
				Title:         giteaIssue.Title,
				Body:          giteaIssue.Body,
				Number:        giteaIssue.Number,
				RepositoryID:  repoID,
				AuthorID:      authorID,
				AuthorName:    giteaIssue.User.Login,
				IsClosed:      isClosed,
				CommentsCount: giteaIssue.Comments,
				CreatedAt:     giteaIssue.CreatedAt,
				UpdatedAt:     giteaIssue.UpdatedAt,
			}

			existingIssues, _ := s.db.Issue.Select().Where("repository_id = ? AND number = ?", repoID, giteaIssue.Number).All()
			if len(existingIssues) > 0 {
				issue = *existingIssues[0]
				issue.Title = giteaIssue.Title
				issue.Body = giteaIssue.Body
				issue.AuthorName = giteaIssue.User.Login
				issue.IsClosed = isClosed
				issue.CommentsCount = giteaIssue.Comments
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
	cache, err := s.preloadContributors(repoID)
	if err != nil {
		return result, err
	}
	remoteRepo, _ := s.GetRemoteRepoInfo(repoID)
	baseURL := GiteaWebURL
	if remoteRepo != nil && remoteRepo.WebURL != "" {
		idx := strings.Index(remoteRepo.WebURL, "/"+owner+"/"+repo)
		if idx > 0 {
			baseURL = remoteRepo.WebURL[:idx]
		}
	}

	page := 1
	limit := 100

	for {
		url := fmt.Sprintf(GiteaPullRequestsPath, owner, repo, limit, page)
		data, err := s.makeGiteaRequest(baseURL, url, token)
		if err != nil {
			return result, err
		}

		var giteaPRs []struct {
			ID       int64         `json:"id"`
			Number   int           `json:"number"`
			Title    string        `json:"title"`
			Body     string        `json:"body"`
			State    string        `json:"state"`
			User     GitHubUser    `json:"user"`
			Labels   []GitHubLabel `json:"labels"`
			Comments int           `json:"comments"`
			Head     struct {
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
			contributor := s.findContributor(repoID, giteaPR.User.Login, giteaPR.User.ID, cache)
			if contributor != nil {
				contributor.Avatar = giteaPR.User.AvatarURL
				s.db.Contributor.Save().One(contributor)
			}
			authorID := int64(0)
			if contributor != nil {
				authorID = contributor.ID
			}

			isClosed := giteaPR.State == "closed"
			isMerged := giteaPR.MergedAt != nil
			status := "open"
			if isClosed {
				status = "closed"
			}

			pr := models.PullRequest{
				Title:         giteaPR.Title,
				Body:          giteaPR.Body,
				Number:        giteaPR.Number,
				RepositoryID:  repoID,
				AuthorID:      authorID,
				AuthorName:    giteaPR.User.Login,
				SourceBranch:  giteaPR.Head.Ref,
				TargetBranch:  giteaPR.Base.Ref,
				Status:        status,
				IsMerged:      isMerged,
				IsClosed:      isClosed,
				CommentsCount: giteaPR.Comments,
				CreatedAt:     giteaPR.CreatedAt,
				UpdatedAt:     giteaPR.UpdatedAt,
			}

			existingPRs, _ := s.db.PullRequest.Select().Where("repository_id = ? AND number = ?", repoID, giteaPR.Number).All()
			if len(existingPRs) > 0 {
				pr = *existingPRs[0]
				pr.Title = giteaPR.Title
				pr.Body = giteaPR.Body
				pr.AuthorName = giteaPR.User.Login
				pr.SourceBranch = giteaPR.Head.Ref
				pr.TargetBranch = giteaPR.Base.Ref
				pr.Status = status
				pr.IsMerged = isMerged
				pr.IsClosed = isClosed
				pr.CommentsCount = giteaPR.Comments
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
	client, err := newGitHubClient(token)
	if err != nil {
		return nil, err
	}
	urlStr := fmt.Sprintf(GitHubRepoPath, owner, repo)
	var ghRepoRaw *github.Repository
	if _, err := s.doGitHubRequest(ctx, client, "GET", urlStr, nil, &ghRepoRaw); err != nil {
		if isGitHubNotModified(err) {
			repository, _ := s.db.Repository.Select().Where("owner = ? AND name = ?", owner, repo).One()
			if repository != nil {
				return repository, nil
			}
		}
		return nil, parseGitHubError(err, urlStr)
	}

	ghRepo := toGitHubRepo(ghRepoRaw)

	account, err := s.account.CreateOrUpdateAccount(
		"github",
		ghRepo.Owner.Login,
		"",
		ghRepo.Owner.AvatarURL,
		GitHubAPIBaseURL,
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
		APIURL:       GitHubAPIBaseURL + "/" + urlStr,
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

func (s *SyncService) prepareIssueComments(repoID, issueID int64, ghComments []GitHubComment) ([]*models.Comment, []*models.Comment) {
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
		authorID := int64(0)
		authorName := ""
		if ghComment.User.Login != "" {
			authorName = ghComment.User.Login
		}

		if existing, ok := existingGitHubIDs[ghComment.ID]; ok {
			existing.Body = ghComment.Body
			existing.IssueID = &issueID
			existing.AuthorID = authorID
			existing.AuthorName = authorName
			existing.UpdatedAt = ghComment.UpdatedAt
			commentsToUpdate = append(commentsToUpdate, existing)
		} else {
			githubID := ghComment.ID
			comment := &models.Comment{
				GitHubID:   &githubID,
				Body:       ghComment.Body,
				IssueID:    &issueID,
				AuthorID:   authorID,
				AuthorName: authorName,
				CreatedAt:  ghComment.CreatedAt,
				UpdatedAt:  ghComment.UpdatedAt,
			}
			commentsToInsert = append(commentsToInsert, comment)
		}
	}

	return commentsToInsert, commentsToUpdate
}

func (s *SyncService) preparePRComments(repoID, prID int64, ghComments []GitHubComment) ([]*models.Comment, []*models.Comment) {
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
		authorID := int64(0)
		authorName := ""
		if ghComment.User.Login != "" {
			authorName = ghComment.User.Login
		}

		if existing, ok := existingGitHubIDs[ghComment.ID]; ok {
			existing.Body = ghComment.Body
			existing.PullRequestID = &prID
			existing.AuthorID = authorID
			existing.AuthorName = authorName
			existing.UpdatedAt = ghComment.UpdatedAt
			commentsToUpdate = append(commentsToUpdate, existing)
		} else {
			githubID := ghComment.ID
			comment := &models.Comment{
				GitHubID:      &githubID,
				Body:          ghComment.Body,
				PullRequestID: &prID,
				AuthorID:      authorID,
				AuthorName:    authorName,
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
						s.warnf("failed to insert comment (github_id=%d): %v", ghID, err2)
					}
				}
			}
		}
	}

	if len(commentsToUpdate) > 0 {
		for _, comment := range commentsToUpdate {
			if err := s.db.Comment.Save().One(comment); err != nil {
				s.warnf("failed to update comment %d: %v", comment.ID, err)
			}
		}
	}
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
		s.warnf("failed to configure git proxy: %v", err)
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
		s.warnf("failed to configure git proxy: %v", err)
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

func (s *SyncService) PushRepositoryByName(localPath, remoteName string) error {
	ConfigureGitProxy()

	if _, err := s.RunGitCommand([]string{"-C", localPath, "push", remoteName, "--all"}, "", nil); err != nil {
		return fmt.Errorf("failed to push repository: %v", err)
	}

	s.RunGitCommand([]string{"-C", localPath, "push", remoteName, "--tags"}, "", nil)

	return nil
}

func (s *SyncService) SyncRepositoryData(ctx context.Context, repoID int64, platform, owner, repoName, token string, issueSince, prSince *time.Time, lastIssueNumber, lastPRNumber int, saveProgress SyncProgressSaver) (SyncResult, error) {
	result := SyncResult{}
	var firstErr error

	switch platform {
	case "gitea":
		issueResult, err := s.SyncGiteaIssues(ctx, repoID, owner, repoName, token)
		if err != nil {
			s.warnf("failed to sync issues: %v", err)
			if firstErr == nil {
				firstErr = err
			}
		} else {
			result.Add(issueResult)
		}

		prResult, err := s.SyncGiteaPRs(ctx, repoID, owner, repoName, token)
		if err != nil {
			s.warnf("failed to sync PRs: %v", err)
			if firstErr == nil {
				firstErr = err
			}
		} else {
			result.Add(prResult)
		}
	default:
		// GitHub: 使用 GraphQL API 同步 Issue/PR
		// 同步策略：updatedAt DESC 倒序
		//   首次同步（since == nil）：最近 365 天或 20 页，取范围更大者
		//   增量同步（since != nil）：从上次同步点往前推 30 天
		issueProgress := func(number int, updatedAt *time.Time) error {
			if saveProgress == nil {
				return nil
			}
			return saveProgress(number, result.MaxPRNumber, updatedAt, result.MaxPRUpdatedAt)
		}
		// lastNumber 不再参与同步逻辑判断，仅保留以兼容进度保存
		issueResult, err := s.SyncGitHubIssuesGraphQL(ctx, repoID, owner, repoName, token, issueSince, lastIssueNumber, issueProgress)
		if err != nil {
			s.warnf("failed to sync issues: %v", err)
			if firstErr == nil {
				firstErr = err
			}
		} else {
			result.Add(issueResult)
		}

		prProgress := func(number int, updatedAt *time.Time) error {
			if saveProgress == nil {
				return nil
			}
			return saveProgress(result.MaxIssueNumber, number, result.MaxIssueUpdatedAt, updatedAt)
		}
		// lastNumber 不再参与同步逻辑判断，仅保留以兼容进度保存
		prResult, err := s.SyncGitHubPRsGraphQL(ctx, repoID, owner, repoName, token, prSince, lastPRNumber, prProgress)
		if err != nil {
			s.warnf("failed to sync PRs: %v", err)
			if firstErr == nil {
				firstErr = err
			}
		} else {
			result.Add(prResult)
		}

		if err := s.SyncGitHubRepoStats(ctx, repoID, owner, repoName, token); err != nil {
			s.warnf("failed to sync repo stats: %v", err)
		}
	}

	statsSvc := NewStatsService(s.db)
	if err := statsSvc.UpdateRepositoryStats(repoID, owner, repoName); err != nil {
		s.warnf("failed to update repository stats: %v", err)
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

// ResolveSyncToken returns the best available token for a platform.
// It first tries the token attached to accountID, then any active token for the
// platform, and finally falls back to the global GitHub token from config.
func (s *SyncService) ResolveSyncToken(platform string, accountID *int64) string {
	if accountID != nil {
		t, err := s.GetSyncToken(*accountID)
		if err == nil && t != nil && t.AccessToken != "" {
			return t.AccessToken
		}
	}
	tokens, err := s.db.SyncToken.Select().Where("platform = ? AND is_active = ?", platform, true).All()
	if err == nil && len(tokens) > 0 && tokens[0].AccessToken != "" {
		return tokens[0].AccessToken
	}
	if platform == "github" {
		_, token := config.GetUserToken()
		return token
	}
	return ""
}

func (s *SyncService) SyncGitHubRepoStats(ctx context.Context, repoID int64, owner, repo, token string) error {
	client, err := newGitHubClient(token)
	if err != nil {
		return err
	}
	urlStr := fmt.Sprintf(GitHubRepoPath, owner, repo)
	var ghRepoRaw *github.Repository
	if _, err := s.doGitHubRequest(ctx, client, "GET", urlStr, nil, &ghRepoRaw); err != nil {
		if isGitHubNotModified(err) {
			return nil
		}
		return parseGitHubError(err, urlStr)
	}

	ghRepo := toGitHubRepo(ghRepoRaw)

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
	baseURL := GitHubWebURL

	if strings.Contains(mirrorURL, "gitea.com") {
		platform = "gitea"
		baseURL = GiteaWebURL
	} else if strings.Contains(mirrorURL, "gitlab.com") {
		platform = "gitlab"
		baseURL = GitLabWebURL
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
	apiURL := fmt.Sprintf(GitHubAPIRepoPath, baseURL, owner, repoName)
	sshURL := fmt.Sprintf(GitHubSSHURLTemplate, owner, repoName)
	if platform == "gitlab" {
		apiURL = fmt.Sprintf(GitLabAPIRepoPath, baseURL, owner, repoName)
		sshURL = fmt.Sprintf(GitLabSSHURLTemplate, owner, repoName)
	} else if platform == "gitea" {
		sshURL = fmt.Sprintf(GiteaSSHURLTemplate, owner, repoName)
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
