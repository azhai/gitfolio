package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/azhai/gitfolio/database"
	"github.com/azhai/gitfolio/models"
)

type SyncService struct {
	db      *database.Database
	account *AccountService
}

func NewSyncService(db *database.Database) *SyncService {
	return &SyncService{
		db:      db,
		account: NewAccountService(db),
	}
}

type GitHubUser struct {
	Login     string `json:"login"`
	ID        uint   `json:"id"`
	AvatarURL string `json:"avatar_url"`
	Email     string `json:"email"`
	Name      string `json:"name"`
}

type GitHubRepo struct {
	ID              uint       `json:"id"`
	Name            string     `json:"name"`
	FullName        string     `json:"full_name"`
	Description     string     `json:"description"`
	Private         bool       `json:"private"`
	Fork            bool       `json:"fork"`
	CloneURL        string     `json:"clone_url"`
	SSHURL          string     `json:"ssh_url"`
	HTMLURL         string     `json:"html_url"`
	Owner           GitHubUser `json:"owner"`
	StargazersCount int        `json:"stargazers_count"`
	ForksCount      int        `json:"forks_count"`
	WatchersCount   int        `json:"watchers_count"`
	DefaultBranch   string     `json:"default_branch"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type GitHubIssue struct {
	ID          uint       `json:"id"`
	Number      int        `json:"number"`
	Title       string     `json:"title"`
	Body        string     `json:"body"`
	State       string     `json:"state"`
	User        GitHubUser `json:"user"`
	PullRequest *struct {
		URL string `json:"url"`
	} `json:"pull_request"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	ClosedAt  *time.Time `json:"closed_at"`
}

type GitHubPR struct {
	ID     uint       `json:"id"`
	Number int        `json:"number"`
	Title  string     `json:"title"`
	Body   string     `json:"body"`
	State  string     `json:"state"`
	User   GitHubUser `json:"user"`
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

	req.Header.Set("Authorization", fmt.Sprintf("token %s", token))
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API returned status %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

func (s *SyncService) SyncGitHubRepo(ctx context.Context, owner, repo string, token string, userID uint) (*models.Repository, error) {
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
		repository.StarsCount = ghRepo.StargazersCount
		repository.ForksCount = ghRepo.ForksCount
		repository.WatchCount = ghRepo.WatchersCount
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
			OwnerID:       repoOwner.ID,
			ProjectType:   "mirror",
			IsMirror:      true,
			MirrorURL:     ghRepo.HTMLURL,
			LastSyncAt:    &now,
			StarsCount:    ghRepo.StargazersCount,
			ForksCount:    ghRepo.ForksCount,
			WatchCount:    ghRepo.WatchersCount,
			DefaultBranch: ghRepo.DefaultBranch,
			CreatedAt:     ghRepo.CreatedAt,
			UpdatedAt:     ghRepo.UpdatedAt,
		}
		if err := s.db.Repository.Insert().One(&repository); err != nil {
			return nil, err
		}
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

func (s *SyncService) SyncGitHubIssues(ctx context.Context, repoID uint, owner, repo, token string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues?state=all&per_page=100", owner, repo)
	data, err := s.makeGitHubRequest(url, token)
	if err != nil {
		return err
	}

	var ghIssues []GitHubIssue
	if err := json.Unmarshal(data, &ghIssues); err != nil {
		return err
	}

	for _, ghIssue := range ghIssues {
		if ghIssue.PullRequest != nil {
			continue
		}

		user, _, err := s.getOrCreateUser(&models.User{
			Username: ghIssue.User.Login,
			Email:    fmt.Sprintf("%d+%s@users.noreply.github.com", ghIssue.User.ID, ghIssue.User.Login),
			Avatar:   ghIssue.User.AvatarURL,
			IsActive: true,
		})
		if err != nil {
			continue
		}

		isClosed := ghIssue.State == "closed"
		issue := models.Issue{
			Title:        ghIssue.Title,
			Body:         ghIssue.Body,
			Number:       ghIssue.Number,
			RepositoryID: repoID,
			AuthorID:     user.ID,
			IsClosed:     isClosed,
			CreatedAt:    ghIssue.CreatedAt,
			UpdatedAt:    ghIssue.UpdatedAt,
		}

		existingIssues, _ := s.db.Issue.Select().Where("repository_id = ? AND number = ?", repoID, ghIssue.Number).All()
		if len(existingIssues) > 0 {
			issue = *existingIssues[0]
			issue.Title = ghIssue.Title
			issue.Body = ghIssue.Body
			issue.IsClosed = isClosed
			issue.UpdatedAt = ghIssue.UpdatedAt
			s.db.Issue.Save().One(&issue)
		} else {
			s.db.Issue.Insert().One(&issue)
		}
	}

	return nil
}

func (s *SyncService) SyncGitHubPRs(ctx context.Context, repoID uint, owner, repo, token string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls?state=all&per_page=100", owner, repo)
	data, err := s.makeGitHubRequest(url, token)
	if err != nil {
		return err
	}

	var ghPRs []GitHubPR
	if err := json.Unmarshal(data, &ghPRs); err != nil {
		return err
	}

	for _, ghPR := range ghPRs {
		user, _, err := s.getOrCreateUser(&models.User{
			Username: ghPR.User.Login,
			Email:    fmt.Sprintf("%d+%s@users.noreply.github.com", ghPR.User.ID, ghPR.User.Login),
			Avatar:   ghPR.User.AvatarURL,
			IsActive: true,
		})
		if err != nil {
			continue
		}

		isClosed := ghPR.State == "closed"
		isMerged := ghPR.MergedAt != nil
		status := "open"
		if isMerged {
			status = "merged"
		} else if isClosed {
			status = "closed"
		}

		pr := models.MergeRequest{
			Title:        ghPR.Title,
			Body:         ghPR.Body,
			Number:       ghPR.Number,
			RepositoryID: repoID,
			AuthorID:     user.ID,
			SourceBranch: ghPR.Head.Ref,
			TargetBranch: ghPR.Base.Ref,
			Status:       status,
			IsMerged:     isMerged,
			IsClosed:     isClosed,
			CreatedAt:    ghPR.CreatedAt,
			UpdatedAt:    ghPR.UpdatedAt,
		}

		existingPRs, _ := s.db.MergeRequest.Select().Where("repository_id = ? AND number = ?", repoID, ghPR.Number).All()
		if len(existingPRs) > 0 {
			pr = *existingPRs[0]
			pr.Title = ghPR.Title
			pr.Body = ghPR.Body
			pr.SourceBranch = ghPR.Head.Ref
			pr.TargetBranch = ghPR.Base.Ref
			pr.Status = status
			pr.IsMerged = isMerged
			pr.IsClosed = isClosed
			pr.UpdatedAt = ghPR.UpdatedAt
			s.db.MergeRequest.Save().One(&pr)
		} else {
			s.db.MergeRequest.Insert().One(&pr)
		}
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

func (s *SyncService) CreateSyncPoint(repoID, remoteRepoID uint, syncType string) (*models.SyncPoint, error) {
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

func (s *SyncService) UpdateSyncPoint(syncPointID uint, success bool, message string) error {
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

func (s *SyncService) LogSync(syncPointID uint, syncType, status, message string, duration int64, itemsSynced, itemsFailed int, details string) error {
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
