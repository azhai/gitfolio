package models

import (
	"time"

	"github.com/azhai/goent"
	"golang.org/x/crypto/bcrypt"
)

type FolioSchema struct {
	Activity         *goent.Table[Activity]
	Branch           *goent.Table[Branch]
	Comment          *goent.Table[Comment]
	Contributor      *goent.Table[Contributor]
	GitCommandLog    *goent.Table[GitCommandLog]
	Group            *goent.Table[Group]
	GroupMember      *goent.Table[GroupMember]
	Issue            *goent.Table[Issue]
	IssueLabel       *goent.Table[IssueLabel]
	Label            *goent.Table[Label]
	Milestone        *goent.Table[Milestone]
	Owner            *goent.Table[Owner]
	PlatformAccount  *goent.Table[PlatformAccount]
	PullRequest      *goent.Table[PullRequest]
	PullRequestLabel *goent.Table[PullRequestLabel]
	Release          *goent.Table[Release]
	RemoteRepository *goent.Table[RemoteRepository]
	Repository       *goent.Table[Repository]
	RepositoryStats  *goent.Table[RepositoryStats]
	Snippet          *goent.Table[Snippet]
	Star             *goent.Table[Star]
	SyncLog          *goent.Table[SyncLog]
	SyncPoint        *goent.Table[SyncPoint]
	SyncToken        *goent.Table[SyncToken]
	Task             *goent.Table[Task]
	TaskAttachment   *goent.Table[TaskAttachment]
	TaskSchedule     *goent.Table[TaskSchedule]
	TaskIssue        *goent.Table[TaskIssue]
	TaskTransition   *goent.Table[TaskTransition]
	TaskPullRequest  *goent.Table[TaskPullRequest]
	TaskTimeLog      *goent.Table[TaskTimeLog]
	CommitReference  *goent.Table[CommitReference]
	User             *goent.Table[User]
	Watch            *goent.Table[Watch]
	Webhook          *goent.Table[Webhook]
}

type User struct {
	ID        int64 `goe:"pk"`
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
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Name        string `goe:"index"`
	Description string
	Homepage    string
	Readme      string
	OwnerID     int64 `goe:"index"`

	ProjectType string `goe:"default:'local';index"`
	IsFork      bool   `goe:"default:false"`

	MirrorURL  string
	LastSyncAt *time.Time
	LocalPath  string

	DefaultBranch string `goe:"default:'main'"`
	LastCommitAt  *time.Time
}

func (r *Repository) IsMirror() bool {
	return r.ProjectType == "public" || r.ProjectType == "private" || r.ProjectType == "mirror"
}

func (r *Repository) IsPrivate() bool {
	return r.ProjectType == "private"
}

func (r *Repository) IsLocal() bool {
	return r.ProjectType == "local" || r.ProjectType == "owned"
}

type RepositoryStats struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	RepositoryID int64 `goe:"unique"`
	LastCommitAt *time.Time

	StarsCount        int `goe:"default:0"`
	ForksCount        int `goe:"default:0"`
	WatchCount        int `goe:"default:0"`
	CommitsCount      int `goe:"default:0"`
	BranchesCount     int `goe:"default:0"`
	TagsCount         int `goe:"default:0"`
	ContributorsCount int `goe:"default:0"`

	OpenIssuesCount   int `goe:"default:0"`
	ClosedIssuesCount int `goe:"default:0"`
	OpenPRsCount      int `goe:"default:0"`
	ClosedPRsCount    int `goe:"default:0"`
	MergedPRsCount    int `goe:"default:0"`
}

type Owner struct {
	ID       int64  `goe:"pk"`
	Username string `goe:"unique"`
	Email    string
	FullName string
	Avatar   string
}

type Branch struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Name         string
	RepositoryID int64 `goe:"index"`

	CommitHash string
	CommitMsg  string
}

type Issue struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Title  string
	Body   string
	Number int `goe:"index"`

	RepositoryID int64 `goe:"index"`

	AuthorID int64 `goe:"index"`

	AssigneeID *int64

	IsClosed bool `goe:"default:false;index"`
	IsLocked bool `goe:"default:false"`
}

type Label struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Name        string
	Color       string
	Description string

	RepositoryID int64
}

type Comment struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Body string

	IssueID       *int64 `goe:"index"`
	PullRequestID *int64 `goe:"index"`
	TaskID        *int64 `goe:"index"`

	AuthorID int64 `goe:"index"`
}

type Release struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	TagName string
	Title   string
	Body    string

	RepositoryID int64

	AuthorID int64

	IsDraft      bool `goe:"default:false"`
	IsPrerelease bool `goe:"default:false"`
}

type Star struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time

	UserID       int64 `goe:"unique"`
	RepositoryID int64 `goe:"unique"`
}

type Watch struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time

	UserID       int64 `goe:"unique"`
	RepositoryID int64 `goe:"unique"`
}

type PullRequest struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Title  string
	Body   string
	Number int `goe:"index"`

	RepositoryID int64 `goe:"index"`

	AuthorID int64 `goe:"index"`

	SourceBranch string
	TargetBranch string `goe:"default:'main'"`

	AssigneeID *int64

	Status string `goe:"default:'open';index"`

	IsMerged bool `goe:"default:false"`
	IsClosed bool `goe:"default:false"`
	IsLocked bool `goe:"default:false"`
}

type IssueLabel struct {
	ID        int64 `goe:"pk"`
	IssueID   int64 `goe:"index"`
	LabelID   int64 `goe:"index"`
	CreatedAt time.Time
}

type PullRequestLabel struct {
	ID            int64 `goe:"pk"`
	PullRequestID int64 `goe:"index"`
	LabelID       int64 `goe:"index"`
	CreatedAt     time.Time
}

type Webhook struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	RepositoryID int64 `goe:"index"`

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
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Platform  string `goe:"index"`
	Username  string `goe:"index"`
	Email     string
	AvatarURL string
	APIURL    string
	IsActive  bool  `goe:"default:true"`
	UserID    int64 `goe:"index"`
}

type SyncToken struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Platform     string `goe:"index"`
	Name         string
	AccessToken  string
	RefreshToken string
	TokenType    string
	ExpiresAt    *time.Time
	Scopes       string
	AccountID    int64  `goe:"index"`
	RepositoryID *int64 `goe:"index"`
	IsActive     bool   `goe:"default:true"`
}

type RemoteRepository struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Platform     string `goe:"index"`
	Owner        string `goe:"index"`
	RepoName     string `goe:"index"`
	CloneURL     string
	SSHURL       string
	APIURL       string
	WebURL       string
	RepositoryID int64  `goe:"index"`
	AccountID    *int64 `goe:"index"`
	IsPrimary    bool   `goe:"default:false"`
	Direction    string `goe:"default:'pull'"`
	LastSyncAt   *time.Time
	SyncEnabled  bool `goe:"default:true"`
}

type SyncPoint struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	RepositoryID    int64  `goe:"index"`
	RemoteRepoID    int64  `goe:"index"`
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
	ID        int64 `goe:"pk"`
	CreatedAt time.Time

	SyncPointID int64 `goe:"index"`
	SyncType    string
	Status      string
	Message     string
	Duration    int64
	ItemsSynced int
	ItemsFailed int
	Details     string
}

type GitCommandLog struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time

	Command      string
	WorkingDir   string
	Output       string
	Status       string `goe:"default:'pending'"`
	StartedAt    *time.Time
	FinishedAt   *time.Time
	DurationMs   int64
	ExitCode     int
	RepositoryID *int64 `goe:"index"`
	ErrorMsg     string
}

type Group struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Name        string `goe:"unique"`
	DisplayName string
	Description string
	Avatar      string
	Website     string
	Location    string

	OwnerID int64 `goe:"index"`
}

type GroupMember struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time

	GroupID int64 `goe:"unique"`
	UserID  int64 `goe:"unique"`
	Role    string
}

type Activity struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time

	UserID       *int64 `goe:"index"`
	RepositoryID *int64 `goe:"index"`
	GroupID      *int64 `goe:"index"`

	ActivityType string `goe:"index"`
	Title        string
	Content      string
	TargetID     *int64
	TargetType   string
}

type Milestone struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Title       string
	Description string
	DueDate     *time.Time

	RepositoryID int64 `goe:"index"`

	IsClosed bool `goe:"default:false;index"`
}

type Snippet struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Title       string
	Description string
	Language    string
	Code        string
	Visibility  string `goe:"default:'public';index"`
	Version     int    `goe:"default:1"`

	UserID       *int64 `goe:"index"`
	RepositoryID *int64 `goe:"index"`
}

type Contributor struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Name         string `goe:"index"`
	Email        string `goe:"index"`
	Avatar       string
	RepositoryID int64 `goe:"index"`
	CommitsCount int   `goe:"default:0"`
}

type Task struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Title        string
	Draft        string
	Goal         string
	PreviewImage string

	Status    string `goe:"default:'draft';index"`
	Priority  int    `goe:"default:3;index"`
	SortOrder int    `goe:"default:0;index"`

	RepositoryID int64 `goe:"index"`

	InitiatorID int64  `goe:"index"`
	VerifierID  *int64 `goe:"index"`
	HandlerID   *int64 `goe:"index"`

	LastHandledAt *time.Time
}

type TaskAttachment struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time

	TaskID int64 `goe:"index"`

	FileName string
	FilePath string
	FileSize int64
	FileType string
}

type TaskSchedule struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	TaskID int64 `goe:"index"`

	ScheduleType string `goe:"index"`

	PlanStartDate *time.Time
	PlanEndDate   *time.Time
	PlanStartNoon string
	PlanEndNoon   string

	ActualStartDate *time.Time
	ActualEndDate   *time.Time
	ActualStartNoon string
	ActualEndNoon   string

	User1ID *int64 `goe:"index"`
	User2ID *int64 `goe:"index"`
	User3ID *int64 `goe:"index"`
}

type TaskIssue struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time

	TaskID  int64 `goe:"index"`
	IssueID int64 `goe:"index"`
}

type CommitReference struct {
	ID           int64 `goe:"pk"`
	CreatedAt    time.Time
	CommitHash   string `goe:"index"`
	RepositoryID int64  `goe:"index"`
	TargetType   string `goe:"index"`
	TargetID     int64  `goe:"index"`
	Action       string
}

type TaskTransition struct {
	ID         int64 `goe:"pk"`
	CreatedAt  time.Time
	TaskID     int64 `goe:"index"`
	FromStatus string
	ToStatus   string
	UserID     int64 `goe:"index"`
	Comment    string
}

type TaskPullRequest struct {
	ID            int64 `goe:"pk"`
	CreatedAt     time.Time
	TaskID        int64 `goe:"index"`
	PullRequestID int64 `goe:"index"`
}

type TaskTimeLog struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	TaskID    int64 `goe:"index"`
	UserID    int64 `goe:"index"`
	StartTime time.Time
	EndTime   *time.Time
	Duration  int64
	Note      string
}
