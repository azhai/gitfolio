package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Username string `goe:"unique"`
	Email    string `goe:"unique"`
	Password string
	FullName string
	Avatar   string
	Bio      string
	Website  string
	Location string

	IsActive bool `goe:"default:true"`
	IsAdmin  bool `goe:"default:false"`

	Repositories []*Repository `goe:"rel:hasMany;field:owner_id"`
	Issues       []*Issue      `goe:"rel:hasMany;field:author_id"`
	Comments     []*Comment    `goe:"rel:hasMany;field:author_id"`
	Stars        []*Star       `goe:"rel:hasMany;field:user_id"`
	Watches      []*Watch      `goe:"rel:hasMany;field:user_id"`
}

func (u *User) SetPassword(password string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(hashedPassword)
	return nil
}

func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	return err == nil
}

type Repository struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Name        string `goe:"index"`
	Description string
	Readme      string
	OwnerID     uint `goe:"index"`

	ProjectType string `goe:"default:'owned';index"`
	IsPrivate   bool   `goe:"default:false"`
	IsFork      bool   `goe:"default:false"`
	IsMirror    bool   `goe:"default:false"`

	MirrorURL  string
	LastSyncAt *time.Time
	LocalPath  string

	StarsCount int `goe:"default:0"`
	ForksCount int `goe:"default:0"`
	WatchCount int `goe:"default:0"`

	DefaultBranch string `goe:"default:'main'"`

	Owner         *Owner              `goe:"rel:belongsTo;field:owner_id"`
	Branches      []*Branch           `goe:"rel:hasMany;field:repository_id"`
	Issues        []*Issue            `goe:"rel:hasMany;field:repository_id"`
	Labels        []*Label            `goe:"rel:hasMany;field:repository_id"`
	Releases      []*Release          `goe:"rel:hasMany;field:repository_id"`
	MergeRequests []*MergeRequest     `goe:"rel:hasMany;field:repository_id"`
	RemoteRepos   []*RemoteRepository `goe:"rel:hasMany;field:repository_id"`
	SyncPoints    []*SyncPoint        `goe:"rel:hasMany;field:repository_id"`
}

type Owner struct {
	ID       uint   `goe:"primaryKey"`
	Username string `goe:"unique"`
	Email    string
	FullName string
	Avatar   string
}

type Branch struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Name         string
	RepositoryID uint `goe:"index"`

	CommitHash string
	CommitMsg  string
}

type Issue struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Title  string
	Body   string
	Number int `goe:"index"`

	RepositoryID uint `goe:"index"`

	AuthorID uint `goe:"index"`

	AssigneeID *uint

	IsClosed bool `goe:"default:false;index"`
	IsLocked bool `goe:"default:false"`

	Repository *Repository `goe:"rel:belongsTo;field:repository_id"`
	Author     *User       `goe:"rel:belongsTo;field:author_id"`
	Assignee   *User       `goe:"rel:belongsTo;field:assignee_id"`
	Comments   []*Comment  `goe:"rel:hasMany;field:issue_id"`
	Labels     []*Label    `goe:"rel:belongsToMany;table:issue_labels"`
}

type Label struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Name        string
	Color       string
	Description string

	RepositoryID uint
}

type Comment struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Body string

	IssueID        *uint `goe:"index"`
	MergeRequestID *uint `goe:"index"`

	AuthorID uint `goe:"index"`

	Issue        *Issue        `goe:"rel:belongsTo;field:issue_id"`
	MergeRequest *MergeRequest `goe:"rel:belongsTo;field:merge_request_id"`
	Author       *User         `goe:"rel:belongsTo;field:author_id"`
}

type Release struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	TagName string
	Title   string
	Body    string

	RepositoryID uint

	AuthorID uint

	IsDraft      bool `goe:"default:false"`
	IsPrerelease bool `goe:"default:false"`
}

type Star struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time

	UserID       uint `goe:"uniqueIndex:idx_user_repo"`
	RepositoryID uint `goe:"uniqueIndex:idx_user_repo"`
}

type Watch struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time

	UserID       uint `goe:"uniqueIndex:idx_user_repo_watch"`
	RepositoryID uint `goe:"uniqueIndex:idx_user_repo_watch"`

	User       *User       `goe:"rel:belongsTo;field:user_id"`
	Repository *Repository `goe:"rel:belongsTo;field:repository_id"`
}

type MergeRequest struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Title  string
	Body   string
	Number int `goe:"index"`

	RepositoryID uint `goe:"index"`

	AuthorID uint `goe:"index"`

	SourceBranch string
	TargetBranch string `goe:"default:'main'"`

	AssigneeID *uint

	Status string `goe:"default:'open';index"`

	IsMerged bool `goe:"default:false"`
	IsClosed bool `goe:"default:false"`
	IsLocked bool `goe:"default:false"`

	Repository *Repository `goe:"rel:belongsTo;field:repository_id"`
	Author     *User       `goe:"rel:belongsTo;field:author_id"`
	Assignee   *User       `goe:"rel:belongsTo;field:assignee_id"`
	Comments   []*Comment  `goe:"rel:hasMany;field:merge_request_id"`
}

type IssueLabel struct {
	ID        uint `goe:"primaryKey"`
	IssueID   uint `goe:"uniqueIndex:idx_issue_label"`
	LabelID   uint `goe:"uniqueIndex:idx_issue_label"`
	CreatedAt time.Time
}

type Webhook struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	RepositoryID uint `goe:"index"`

	URL      string
	Secret   string
	IsActive bool `goe:"default:true"`
	Events   string

	Repository *Repository `goe:"rel:belongsTo;field:repository_id"`
}

type ProjectType string

const (
	ProjectTypeMirror ProjectType = "mirror"
	ProjectTypeOwned  ProjectType = "owned"
	ProjectTypeFork   ProjectType = "fork"
)

type PlatformType string

const (
	PlatformGitHub   PlatformType = "github"
	PlatformGitea    PlatformType = "gitea"
	PlatformGitFolio PlatformType = "gitfolio"
	PlatformGitLab   PlatformType = "gitlab"
)

type PlatformAccount struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Platform  string `goe:"index"`
	Username  string `goe:"index"`
	Email     string
	AvatarURL string
	APIURL    string
	IsActive  bool `goe:"default:true"`
	UserID    uint `goe:"index"`

	User *User `goe:"rel:belongsTo;field:user_id"`
}

type SyncToken struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Platform     string `goe:"index"`
	Name         string
	AccessToken  string
	RefreshToken string
	TokenType    string
	ExpiresAt    *time.Time
	Scopes       string
	AccountID    uint  `goe:"index"`
	RepositoryID *uint `goe:"index"`
	IsActive     bool  `goe:"default:true"`

	Account    *PlatformAccount `goe:"rel:belongsTo;field:account_id"`
	Repository *Repository      `goe:"rel:belongsTo;field:repository_id"`
}

type RemoteRepository struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Platform     string `goe:"index"`
	Owner        string `goe:"index"`
	RepoName     string `goe:"index"`
	CloneURL     string
	SSHURL       string
	APIURL       string
	WebURL       string
	RepositoryID uint   `goe:"index"`
	AccountID    *uint  `goe:"index"`
	IsPrimary    bool   `goe:"default:false"`
	Direction    string `goe:"default:'pull'"`
	LastSyncAt   *time.Time
	SyncEnabled  bool `goe:"default:true"`

	Repository *Repository      `goe:"rel:belongsTo;field:repository_id"`
	Account    *PlatformAccount `goe:"rel:belongsTo;field:account_id"`
}

type SyncPoint struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	RepositoryID    uint   `goe:"index"`
	RemoteRepoID    uint   `goe:"index"`
	SyncType        string `goe:"index"`
	LastSyncAt      *time.Time
	LastSuccessAt   *time.Time
	LastFailureAt   *time.Time
	FailureCount    int `goe:"default:0"`
	LastCommitHash  string
	LastIssueNumber int
	LastPRNumber    int
	LastETag        string
	LastModified    string
	NextSyncAt      *time.Time
	SyncInterval    int `goe:"default:3600"`
	LastError       string
	IsPaused        bool `goe:"default:false"`

	Repository *Repository       `goe:"rel:belongsTo;field:repository_id"`
	RemoteRepo *RemoteRepository `goe:"rel:belongsTo;field:remote_repo_id"`
}

type SyncLog struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time

	SyncPointID uint `goe:"index"`
	SyncType    string
	Status      string
	Message     string
	Duration    int64
	ItemsSynced int
	ItemsFailed int
	Details     string

	SyncPoint *SyncPoint `goe:"rel:belongsTo;field:sync_point_id"`
}
