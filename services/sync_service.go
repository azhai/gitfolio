package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
	"github.com/google/go-github/v84/github"
)

type SyncService struct {
	db      *models.Database
	account *AccountService
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
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	ClosedAt  *time.Time `json:"closed_at"`
}

type GitHubPR struct {
	ID     int64         `json:"id"`
	Number int           `json:"number"`
	Title  string        `json:"title"`
	Body   string        `json:"body"`
	State  string        `json:"state"`
	User   GitHubUser    `json:"user"`
	Labels []GitHubLabel `json:"labels"`
	Head   struct {
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
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/vnd.github.v3+json")
	if token != "" {
		req.Header.Set("Authorization", fmt.Sprintf("token %s", token))
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == 403 && strings.Contains(string(body), "rate limit") {
			return nil, fmt.Errorf("GitHub API rate limit exceeded. Please add a GitHub token for higher limits. URL: %s", url)
		}
		return nil, fmt.Errorf("GitHub API returned status %d for URL %s: %s", resp.StatusCode, url, string(body))
	}

	return io.ReadAll(resp.Body)
}

func (s *SyncService) FetchGitHubRepoInfo(cloneURL string) (*GitHubRepo, error) {
	parts := strings.Split(strings.TrimSuffix(cloneURL, ".git"), "/")
	if len(parts) < 2 {
		return nil, fmt.Errorf("invalid GitHub URL")
	}
	owner := parts[len(parts)-2]
	repo := parts[len(parts)-1]

	var client *github.Client
	token := s.getGitHubToken()
	if token != "" {
		client = github.NewClient(nil).WithAuthToken(token)
	} else {
		client = github.NewClient(nil)
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
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	if token != "" {
		req.Header.Set("Authorization", "token "+token)
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Gitea API returned status %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

func (s *SyncService) SyncGiteaIssues(ctx context.Context, repoID int64, owner, repo, token string) error {
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
			return err
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
			return err
		}

		if len(giteaIssues) == 0 {
			break
		}

		for _, giteaIssue := range giteaIssues {
			contributor, err := s.getOrCreateContributor(repoID, giteaIssue.User.Login, fmt.Sprintf("%d+%s@users.noreply.gitea.com", giteaIssue.User.ID, giteaIssue.User.Login))
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
				s.db.Issue.Save().One(&issue)
			} else {
				s.db.Issue.Insert().One(&issue)
			}

			s.syncIssueLabels(repoID, issue.ID, giteaIssue.Labels)
		}

		page++
	}

	return nil
}

func (s *SyncService) SyncGiteaPRs(ctx context.Context, repoID int64, owner, repo, token string) error {
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
			return err
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
			return err
		}

		if len(giteaPRs) == 0 {
			break
		}

		for _, giteaPR := range giteaPRs {
			contributor, err := s.getOrCreateContributor(repoID, giteaPR.User.Login, fmt.Sprintf("%d+%s@users.noreply.gitea.com", giteaPR.User.ID, giteaPR.User.Login))
			if err != nil {
				continue
			}
			contributor.Avatar = giteaPR.User.AvatarURL
			s.db.Contributor.Save().One(contributor)

			isClosed := giteaPR.State == "closed"
			isMerged := giteaPR.MergedAt != nil
			status := "open"
			if isMerged {
				status = "merged"
			} else if isClosed {
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
				s.db.PullRequest.Save().One(&pr)
			} else {
				s.db.PullRequest.Insert().One(&pr)
			}

			s.syncPRLabels(repoID, pr.ID, giteaPR.Labels)
		}

		page++
	}

	return nil
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
	now := time.Now()

	if len(repos) > 0 {
		repository = *repos[0]
		repository.Description = ghRepo.Description
		repository.DefaultBranch = ghRepo.DefaultBranch
		repository.UpdatedAt = ghRepo.UpdatedAt
		repository.LastSyncAt = &now
		repository.ProjectType = "mirror"
		repository.IsMirror = true
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
			ProjectType:   "mirror",
			IsMirror:      true,
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

func (s *SyncService) SyncGitHubIssues(ctx context.Context, repoID int64, owner, repo, token string) error {
	page := 1
	perPage := 100

	for {
		url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues?state=all&per_page=%d&page=%d", owner, repo, perPage, page)
		data, err := s.makeGitHubRequest(url, token)
		if err != nil {
			return err
		}

		var ghIssues []GitHubIssue
		if err := json.Unmarshal(data, &ghIssues); err != nil {
			return err
		}

		if len(ghIssues) == 0 {
			break
		}

		var issuesToInsert []*models.Issue
		var issuesToUpdate []*models.Issue
		var labelLinks []struct {
			issueID int64
			labels  []GitHubLabel
		}
		var commentSyncs []struct {
			issueID     int64
			issueNumber int
		}

		for _, ghIssue := range ghIssues {
			if ghIssue.PullRequest != nil {
				continue
			}

			contributor, err := s.getOrCreateContributor(repoID, ghIssue.User.Login, fmt.Sprintf("%d+%s@users.noreply.github.com", ghIssue.User.ID, ghIssue.User.Login))
			if err != nil {
				fmt.Printf("Warning: failed to get/create contributor for Issue #%d: %v\n", ghIssue.Number, err)
				continue
			}
			contributor.Avatar = ghIssue.User.AvatarURL
			s.db.Contributor.Save().One(contributor)

			isClosed := ghIssue.State == "closed"
			existingIssues, _ := s.db.Issue.Select().Where("repository_id = ? AND number = ?", repoID, ghIssue.Number).All()

			if len(existingIssues) > 0 {
				issue := existingIssues[0]
				issue.Title = ghIssue.Title
				issue.Body = ghIssue.Body
				issue.IsClosed = isClosed
				issue.UpdatedAt = ghIssue.UpdatedAt
				issuesToUpdate = append(issuesToUpdate, issue)

				labelLinks = append(labelLinks, struct {
					issueID int64
					labels  []GitHubLabel
				}{issue.ID, ghIssue.Labels})

				commentSyncs = append(commentSyncs, struct {
					issueID     int64
					issueNumber int
				}{issue.ID, ghIssue.Number})
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
				for _, issue := range batch {
					if err := s.db.Issue.Insert().One(issue); err != nil {
						fmt.Printf("Warning: failed to insert Issue #%d: %v\n", issue.Number, err)
					}
				}
			}

			for _, issue := range issuesToInsert {
				labelLinks = append(labelLinks, struct {
					issueID int64
					labels  []GitHubLabel
				}{issue.ID, ghIssues[0].Labels})

				commentSyncs = append(commentSyncs, struct {
					issueID     int64
					issueNumber int
				}{issue.ID, issue.Number})
			}
		}

		if len(issuesToUpdate) > 0 {
			batchSize := 100
			for i := 0; i < len(issuesToUpdate); i += batchSize {
				end := i + batchSize
				if end > len(issuesToUpdate) {
					end = len(issuesToUpdate)
				}
				batch := issuesToUpdate[i:end]
				for _, issue := range batch {
					if err := s.db.Issue.Save().One(issue); err != nil {
						fmt.Printf("Warning: failed to update Issue #%d: %v\n", issue.Number, err)
					}
				}
			}
		}

		for _, link := range labelLinks {
			s.syncIssueLabels(repoID, link.issueID, link.labels)
		}

		for _, sync := range commentSyncs {
			s.syncIssueComments(ctx, repoID, sync.issueID, sync.issueNumber, owner, repo, token)
		}

		page++
	}

	return nil
}

func (s *SyncService) syncIssueLabels(repoID, issueID int64, ghLabels []GitHubLabel) {
	if len(ghLabels) == 0 {
		return
	}

	var labelsToInsert []*models.Label
	var labelIDs []int64

	for _, ghLabel := range ghLabels {
		labels, _ := s.db.Label.Select().Where("repository_id = ? AND name = ?", repoID, ghLabel.Name).All()
		if len(labels) > 0 {
			labelIDs = append(labelIDs, labels[0].ID)
		} else {
			label := &models.Label{
				RepositoryID: repoID,
				Name:         ghLabel.Name,
				Color:        ghLabel.Color,
				Description:  ghLabel.Description,
			}
			labelsToInsert = append(labelsToInsert, label)
		}
	}

	for _, label := range labelsToInsert {
		if err := s.db.Label.Insert().One(label); err == nil {
			labelIDs = append(labelIDs, label.ID)
		}
	}

	var issueLabelsToInsert []*models.IssueLabel
	for _, labelID := range labelIDs {
		issueLabels, _ := s.db.IssueLabel.Select().Where("issue_id = ? AND label_id = ?", issueID, labelID).All()
		if len(issueLabels) == 0 {
			issueLabel := &models.IssueLabel{
				IssueID: issueID,
				LabelID: labelID,
			}
			issueLabelsToInsert = append(issueLabelsToInsert, issueLabel)
		}
	}

	batchSize := 100
	for i := 0; i < len(issueLabelsToInsert); i += batchSize {
		end := i + batchSize
		if end > len(issueLabelsToInsert) {
			end = len(issueLabelsToInsert)
		}
		batch := issueLabelsToInsert[i:end]
		for _, issueLabel := range batch {
			s.db.IssueLabel.Insert().One(issueLabel)
		}
	}
}

func (s *SyncService) syncPRLabels(repoID, prID int64, ghLabels []GitHubLabel) {
	if len(ghLabels) == 0 {
		return
	}

	var labelsToInsert []*models.Label
	var labelIDs []int64

	for _, ghLabel := range ghLabels {
		labels, _ := s.db.Label.Select().Where("repository_id = ? AND name = ?", repoID, ghLabel.Name).All()
		if len(labels) > 0 {
			labelIDs = append(labelIDs, labels[0].ID)
		} else {
			label := &models.Label{
				RepositoryID: repoID,
				Name:         ghLabel.Name,
				Color:        ghLabel.Color,
				Description:  ghLabel.Description,
			}
			labelsToInsert = append(labelsToInsert, label)
		}
	}

	for _, label := range labelsToInsert {
		if err := s.db.Label.Insert().One(label); err == nil {
			labelIDs = append(labelIDs, label.ID)
		}
	}

	var prLabelsToInsert []*models.PullRequestLabel
	for _, labelID := range labelIDs {
		prLabels, _ := s.db.PullRequestLabel.Select().Where("pull_request_id = ? AND label_id = ?", prID, labelID).All()
		if len(prLabels) == 0 {
			prLabel := &models.PullRequestLabel{
				PullRequestID: prID,
				LabelID:       labelID,
			}
			prLabelsToInsert = append(prLabelsToInsert, prLabel)
		}
	}

	batchSize := 100
	for i := 0; i < len(prLabelsToInsert); i += batchSize {
		end := i + batchSize
		if end > len(prLabelsToInsert) {
			end = len(prLabelsToInsert)
		}
		batch := prLabelsToInsert[i:end]
		for _, prLabel := range batch {
			s.db.PullRequestLabel.Insert().One(prLabel)
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

func (s *SyncService) syncIssueComments(ctx context.Context, repoID, issueID int64, issueNumber int, owner, repo, token string) error {
	page := 1
	perPage := 100

	for {
		url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues/%d/comments?per_page=%d&page=%d", owner, repo, issueNumber, perPage, page)
		data, err := s.makeGitHubRequest(url, token)
		if err != nil {
			return err
		}

		var ghComments []GitHubComment
		if err := json.Unmarshal(data, &ghComments); err != nil {
			return err
		}

		if len(ghComments) == 0 {
			break
		}

		var commentsToInsert []*models.Comment
		var commentsToUpdate []*models.Comment

		for _, ghComment := range ghComments {
			contributor, err := s.getOrCreateContributor(repoID, ghComment.User.Login, fmt.Sprintf("%d+%s@users.noreply.github.com", ghComment.User.ID, ghComment.User.Login))
			if err != nil {
				fmt.Printf("Warning: failed to get/create contributor for comment %d: %v\n", ghComment.ID, err)
				continue
			}
			contributor.Avatar = ghComment.User.AvatarURL
			s.db.Contributor.Save().One(contributor)

			existingComments, _ := s.db.Comment.Select().Where("id = ?", ghComment.ID).All()
			if len(existingComments) > 0 {
				comment := existingComments[0]
				comment.Body = ghComment.Body
				comment.UpdatedAt = ghComment.UpdatedAt
				commentsToUpdate = append(commentsToUpdate, comment)
			} else {
				comment := &models.Comment{
					ID:        ghComment.ID,
					Body:      ghComment.Body,
					IssueID:   &issueID,
					AuthorID:  contributor.ID,
					CreatedAt: ghComment.CreatedAt,
					UpdatedAt: ghComment.UpdatedAt,
				}
				commentsToInsert = append(commentsToInsert, comment)
			}
		}

		if len(commentsToInsert) > 0 {
			batchSize := 100
			for i := 0; i < len(commentsToInsert); i += batchSize {
				end := i + batchSize
				if end > len(commentsToInsert) {
					end = len(commentsToInsert)
				}
				batch := commentsToInsert[i:end]
				for _, comment := range batch {
					if err := s.db.Comment.Insert().One(comment); err != nil {
						fmt.Printf("Warning: failed to insert comment %d: %v\n", comment.ID, err)
					}
				}
			}
		}

		if len(commentsToUpdate) > 0 {
			batchSize := 100
			for i := 0; i < len(commentsToUpdate); i += batchSize {
				end := i + batchSize
				if end > len(commentsToUpdate) {
					end = len(commentsToUpdate)
				}
				batch := commentsToUpdate[i:end]
				for _, comment := range batch {
					if err := s.db.Comment.Save().One(comment); err != nil {
						fmt.Printf("Warning: failed to update comment %d: %v\n", comment.ID, err)
					}
				}
			}
		}

		page++
	}

	return nil
}

func (s *SyncService) syncPRComments(ctx context.Context, repoID, prID int64, prNumber int, owner, repo, token string) error {
	page := 1
	perPage := 100

	for {
		url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls/%d/comments?per_page=%d&page=%d", owner, repo, prNumber, perPage, page)
		data, err := s.makeGitHubRequest(url, token)
		if err != nil {
			return err
		}

		var ghComments []GitHubComment
		if err := json.Unmarshal(data, &ghComments); err != nil {
			return err
		}

		if len(ghComments) == 0 {
			break
		}

		var commentsToInsert []*models.Comment
		var commentsToUpdate []*models.Comment

		for _, ghComment := range ghComments {
			contributor, err := s.getOrCreateContributor(repoID, ghComment.User.Login, fmt.Sprintf("%d+%s@users.noreply.github.com", ghComment.User.ID, ghComment.User.Login))
			if err != nil {
				fmt.Printf("Warning: failed to get/create contributor for PR comment %d: %v\n", ghComment.ID, err)
				continue
			}
			contributor.Avatar = ghComment.User.AvatarURL
			s.db.Contributor.Save().One(contributor)

			existingComments, _ := s.db.Comment.Select().Where("id = ?", ghComment.ID).All()
			if len(existingComments) > 0 {
				comment := existingComments[0]
				comment.Body = ghComment.Body
				comment.UpdatedAt = ghComment.UpdatedAt
				commentsToUpdate = append(commentsToUpdate, comment)
			} else {
				comment := &models.Comment{
					ID:            ghComment.ID,
					Body:          ghComment.Body,
					PullRequestID: &prID,
					AuthorID:      contributor.ID,
					CreatedAt:     ghComment.CreatedAt,
					UpdatedAt:     ghComment.UpdatedAt,
				}
				commentsToInsert = append(commentsToInsert, comment)
			}
		}

		if len(commentsToInsert) > 0 {
			batchSize := 100
			for i := 0; i < len(commentsToInsert); i += batchSize {
				end := i + batchSize
				if end > len(commentsToInsert) {
					end = len(commentsToInsert)
				}
				batch := commentsToInsert[i:end]
				for _, comment := range batch {
					if err := s.db.Comment.Insert().One(comment); err != nil {
						fmt.Printf("Warning: failed to insert PR comment %d: %v\n", comment.ID, err)
					}
				}
			}
		}

		if len(commentsToUpdate) > 0 {
			batchSize := 100
			for i := 0; i < len(commentsToUpdate); i += batchSize {
				end := i + batchSize
				if end > len(commentsToUpdate) {
					end = len(commentsToUpdate)
				}
				batch := commentsToUpdate[i:end]
				for _, comment := range batch {
					if err := s.db.Comment.Save().One(comment); err != nil {
						fmt.Printf("Warning: failed to update PR comment %d: %v\n", comment.ID, err)
					}
				}
			}
		}

		page++
	}

	return nil
}

func (s *SyncService) SyncGitHubPRs(ctx context.Context, repoID int64, owner, repo, token string) error {
	page := 1
	perPage := 100

	for {
		url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls?state=all&per_page=%d&page=%d", owner, repo, perPage, page)
		data, err := s.makeGitHubRequest(url, token)
		if err != nil {
			return err
		}

		var ghPRs []GitHubPR
		if err := json.Unmarshal(data, &ghPRs); err != nil {
			return err
		}

		if len(ghPRs) == 0 {
			break
		}

		var prsToInsert []*models.PullRequest
		var prsToUpdate []*models.PullRequest
		var labelLinks []struct {
			prID   int64
			labels []GitHubLabel
		}
		var commentSyncs []struct {
			prID     int64
			prNumber int
		}

		for _, ghPR := range ghPRs {
			contributor, err := s.getOrCreateContributor(repoID, ghPR.User.Login, fmt.Sprintf("%d+%s@users.noreply.github.com", ghPR.User.ID, ghPR.User.Login))
			if err != nil {
				fmt.Printf("Warning: failed to get/create contributor for PR #%d: %v\n", ghPR.Number, err)
				continue
			}
			contributor.Avatar = ghPR.User.AvatarURL
			s.db.Contributor.Save().One(contributor)

			isClosed := ghPR.State == "closed"
			isMerged := ghPR.MergedAt != nil
			status := "open"
			if isMerged {
				status = "merged"
			} else if isClosed {
				status = "closed"
			}

			existingPRs, _ := s.db.PullRequest.Select().Where("repository_id = ? AND number = ?", repoID, ghPR.Number).All()

			if len(existingPRs) > 0 {
				pr := existingPRs[0]
				pr.Title = ghPR.Title
				pr.Body = ghPR.Body
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

				commentSyncs = append(commentSyncs, struct {
					prID     int64
					prNumber int
				}{pr.ID, ghPR.Number})
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
				for _, pr := range batch {
					if err := s.db.PullRequest.Insert().One(pr); err != nil {
						fmt.Printf("Warning: failed to insert PR #%d: %v\n", pr.Number, err)
					}
				}
			}

			for _, pr := range prsToInsert {
				labelLinks = append(labelLinks, struct {
					prID   int64
					labels []GitHubLabel
				}{pr.ID, ghPRs[0].Labels})

				commentSyncs = append(commentSyncs, struct {
					prID     int64
					prNumber int
				}{pr.ID, pr.Number})
			}
		}

		if len(prsToUpdate) > 0 {
			batchSize := 100
			for i := 0; i < len(prsToUpdate); i += batchSize {
				end := i + batchSize
				if end > len(prsToUpdate) {
					end = len(prsToUpdate)
				}
				batch := prsToUpdate[i:end]
				for _, pr := range batch {
					if err := s.db.PullRequest.Save().One(pr); err != nil {
						fmt.Printf("Warning: failed to update PR #%d: %v\n", pr.Number, err)
					}
				}
			}
		}

		for _, link := range labelLinks {
			s.syncPRLabels(repoID, link.prID, link.labels)
		}

		for _, sync := range commentSyncs {
			s.syncPRComments(ctx, repoID, sync.prID, sync.prNumber, owner, repo, token)
		}

		page++
	}

	return nil
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

func (s *SyncService) getOrCreateContributor(repoID int64, username, email string) (*models.Contributor, error) {
	contributors, err := s.db.Contributor.Select().Where("repository_id = ? AND name = ?", repoID, username).All()
	if err != nil {
		return nil, err
	}

	if len(contributors) > 0 {
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
	now := time.Now()
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
	}

	return s.db.SyncLog.Insert().One(&log)
}

func (s *SyncService) getRepoRoot() string {
	return config.AppConfig.Repository.Root
}

func (s *SyncService) SyncPullRepository(localPath string) error {
	cmd := exec.Command("git", "-C", localPath, "remote", "update")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to sync repository: %s", string(output))
	}
	return nil
}

func (s *SyncService) InitBareRepository(owner, name string) (string, error) {
	reposDir := s.getRepoRoot()
	if _, err := os.Stat(reposDir); os.IsNotExist(err) {
		os.MkdirAll(reposDir, 0755)
	}

	localPath := filepath.Join(reposDir, owner, name+".git")
	cmd := exec.Command("git", "init", "--bare", localPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("failed to init repository: %s", string(output))
	}
	return localPath, nil
}

func (s *SyncService) PushRepository(localPath, remoteURL string) error {
	if remoteURL != "" {
		cmd := exec.Command("git", "-C", localPath, "remote", "add", "push_target", remoteURL)
		cmd.Run()
	}

	cmd := exec.Command("git", "-C", localPath, "push", "push_target", "--all")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to push repository: %s", string(output))
	}

	cmd = exec.Command("git", "-C", localPath, "push", "push_target", "--tags")
	cmd.Run()

	return nil
}

func (s *SyncService) SyncRepositoryData(ctx context.Context, repoID int64, platform, owner, repoName, token string) error {
	switch platform {
	case "github":
		if err := s.SyncGitHubIssues(ctx, repoID, owner, repoName, token); err != nil {
			return fmt.Errorf("failed to sync issues: %w", err)
		}
		if err := s.SyncGitHubPRs(ctx, repoID, owner, repoName, token); err != nil {
			return fmt.Errorf("failed to sync PRs: %w", err)
		}
		if err := s.SyncGitHubContributors(ctx, repoID, owner, repoName, token); err != nil {
			fmt.Printf("Warning: failed to sync contributors: %v\n", err)
		}
		if err := s.SyncGitHubRepoStats(ctx, repoID, owner, repoName, token); err != nil {
			fmt.Printf("Warning: failed to sync repo stats: %v\n", err)
		}
	case "gitea":
		if err := s.SyncGiteaIssues(ctx, repoID, owner, repoName, token); err != nil {
			return fmt.Errorf("failed to sync issues: %w", err)
		}
		if err := s.SyncGiteaPRs(ctx, repoID, owner, repoName, token); err != nil {
			return fmt.Errorf("failed to sync PRs: %w", err)
		}
	default:
		if err := s.SyncGitHubIssues(ctx, repoID, owner, repoName, token); err != nil {
			return fmt.Errorf("failed to sync issues: %w", err)
		}
		if err := s.SyncGitHubPRs(ctx, repoID, owner, repoName, token); err != nil {
			return fmt.Errorf("failed to sync PRs: %w", err)
		}
		if err := s.SyncGitHubContributors(ctx, repoID, owner, repoName, token); err != nil {
			fmt.Printf("Warning: failed to sync contributors: %v\n", err)
		}
		if err := s.SyncGitHubRepoStats(ctx, repoID, owner, repoName, token); err != nil {
			fmt.Printf("Warning: failed to sync repo stats: %v\n", err)
		}
	}

	statsSvc := NewStatsService(s.db)
	if err := statsSvc.UpdateRepositoryStats(repoID); err != nil {
		fmt.Printf("Warning: failed to update repository stats: %v\n", err)
	}

	return nil
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
	page := 1
	perPage := 100

	for {
		url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contributors?per_page=%d&page=%d", owner, repo, perPage, page)
		data, err := s.makeGitHubRequest(url, token)
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

		page++
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
	remoteRepo := &models.RemoteRepository{
		Platform:     platform,
		Owner:        owner,
		RepoName:     repoName,
		CloneURL:     mirrorURL + ".git",
		WebURL:       fmt.Sprintf("%s/%s/%s", baseURL, owner, repoName),
		RepositoryID: repoID,
		AccountID:    accountID,
		IsPrimary:    true,
		Direction:    "pull",
		LastSyncAt:   &now,
		SyncEnabled:  true,
	}

	if err := s.db.RemoteRepository.Insert().One(remoteRepo); err != nil {
		return nil
	}

	return remoteRepo
}
