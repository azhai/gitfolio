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
}

type Group struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Name        string `goe:"unique"`
	DisplayName string
	Description string
	Avatar      string
	Website     string
	Location    string

	OwnerID uint `goe:"index"`
}

type GroupMember struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time

	GroupID uint `goe:"uniqueIndex:idx_group_user"`
	UserID  uint `goe:"uniqueIndex:idx_group_user"`
	Role    string
}

type Activity struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time

	UserID       *uint `goe:"index"`
	RepositoryID *uint `goe:"index"`
	GroupID      *uint `goe:"index"`

	ActivityType string `goe:"index"`
	Title        string
	Content      string
	TargetID     *uint
	TargetType   string
}

type Milestone struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Title       string
	Description string
	DueDate     *time.Time

	RepositoryID uint `goe:"index"`

	IsClosed bool `goe:"default:false;index"`
}

type Snippet struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Title       string
	Description string
	Language    string
	Code        string
	Visibility  string `goe:"default:'public';index"`

	UserID       *uint `goe:"index"`
	RepositoryID *uint `goe:"index"`
}

type Contributor struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Name         string `goe:"index"`
	Email        string `goe:"index"`
	RepositoryID uint   `goe:"index"`
	CommitsCount int    `goe:"default:0"`
}

type Task struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Title        string
	Draft        string
	Goal         string
	PreviewImage string

	Status    string `goe:"default:'draft';index"`
	Priority  int    `goe:"default:3;index"`
	SortOrder int    `goe:"default:0;index"`

	RepositoryID uint `goe:"index"`

	InitiatorID uint  `goe:"index"`
	VerifierID  *uint `goe:"index"`
	HandlerID   *uint `goe:"index"`

	LastHandledAt *time.Time
}

type TaskAttachment struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time

	TaskID uint `goe:"index"`

	FileName string
	FilePath string
	FileSize int64
	FileType string
}

type TaskSchedule struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	TaskID uint `goe:"index"`

	ScheduleType string `goe:"index"`

	PlanStartDate *time.Time
	PlanEndDate   *time.Time
	PlanStartNoon string
	PlanEndNoon   string

	ActualStartDate *time.Time
	ActualEndDate   *time.Time
	ActualStartNoon string
	ActualEndNoon   string

	User1ID *uint `goe:"index"`
	User2ID *uint `goe:"index"`
	User3ID *uint `goe:"index"`
}

type TaskIssue struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time

	TaskID  uint `goe:"index"`
	IssueID uint `goe:"index"`
}
