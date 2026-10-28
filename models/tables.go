package models

import (
	"time"

	"github.com/azhai/goent"
	"golang.org/x/crypto/bcrypt"
)

type FolioSchema struct {
	Activity         *goent.Table[Activity]
	Backup           *goent.Table[Backup]
	Branch           *goent.Table[Branch]
	Comment          *goent.Table[Comment]
	Contributor      *goent.Table[Contributor]
	ETag             *goent.Table[ETag]
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

	IsActive bool   `goe:"default:true"`
	Role     string `goe:"default:user"`

	// RepoRoot 是账号的自有仓库目录（绝对路径）。
	// 非空：该账号的仓库以普通（带工作区）仓库存放在 <RepoRoot>/<name>。
	// 为空：仓库落到全局裸仓库目录下的 <账号名>/<name>.git。
	RepoRoot string `goe:"default:''"`
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
	OwnerID     int64  `goe:"index"`
	OwnerType   string `goe:"default:'user';index"`

	ProjectType string `goe:"default:'local';index"`
	IsFork      bool   `goe:"default:false"`

	MirrorURL  string
	LastSyncAt *time.Time
	LocalPath  string

	MigrateStatus string `goe:"default:'';index"`
	MigrateError  string `goe:"default:''"`

	DefaultBranch string `goe:"default:'main'"`
	LastCommitAt  *time.Time
}

// IsMirror 报告仓库是否为远程平台的只读镜像。
func (r *Repository) IsMirror() bool {
	return r.ProjectType == "mirror"
}

// IsPrivate 报告仓库是否为私有可见性。
func (r *Repository) IsPrivate() bool {
	return r.ProjectType == "private"
}

// IsPublic 报告仓库是否为公开可见性。
func (r *Repository) IsPublic() bool {
	return r.ProjectType == "public"
}

// IsLocal 报告仓库是否为本地自有项目（不绑定远程平台同步）。
//
// 注意：本地项目不等于非裸仓库。存储形态由所有者的自有仓库目录决定，
// 详见 services.RepoPath。
func (r *Repository) IsLocal() bool {
	return r.ProjectType == "local"
}

func (r *Repository) IsRemote() bool {
	return r.ProjectType == "mirror" || r.ProjectType == "public" || r.ProjectType == "private"
}

// HasRemote 报告仓库是否配置了远程地址（镜像或已推送的平台仓库）。
func (r *Repository) HasRemote() bool {
	return r.MirrorURL != ""
}

// CanPushRemote 报告是否允许向远程推送本地提交。
func (r *Repository) CanPushRemote() bool {
	return r.ProjectType == "public" || r.ProjectType == "private" || r.ProjectType == "local"
}

func (r *Repository) IsGroupOwned() bool {
	return r.OwnerType == "group"
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

	RepositoryID int64 `goe:"index;m2o"`

	AuthorID   int64  `goe:"index;m2o"`
	AssigneeID *int64 `goe:"m2o"`

	IsClosed      bool   `goe:"default:false;index"`
	IsLocked      bool   `goe:"default:false"`
	CommentsCount int    `goe:"default:0"`
	AuthorName    string `goe:"column:author_name"`
	Status        string `goe:"default:'open';index"` // open/closed/hidden

	// With 预加载挂载字段
	Repository *Repository   `goe:"-"`
	Author     *Contributor  `goe:"-"`
	Assignee   *Contributor  `goe:"-"`
	Comments   []*Comment    `goe:"o2m,fk:issue_id"`
	Labels     []*IssueLabel `goe:"o2m,fk:issue_id"`
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

	GitHubID      *int64 `goe:"column:github_id;index"`
	IssueID       *int64 `goe:"index;m2o"`
	PullRequestID *int64 `goe:"index;m2o"`
	TaskID        *int64 `goe:"index;m2o"`

	AuthorID   int64  `goe:"index;m2o"`
	AuthorName string `goe:"column:author_name"`

	// With 预加载挂载字段
	Issue       *Issue       `goe:"-"`
	PullRequest *PullRequest `goe:"-"`
	Task        *Task        `goe:"-"`
	Author      *Contributor `goe:"-"`
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

	RepositoryID int64 `goe:"index;m2o"`

	AuthorID   int64  `goe:"index;m2o"`
	AuthorName string `goe:"column:author_name"`

	SourceBranch string
	TargetBranch string `goe:"default:'main'"`

	AssigneeID *int64 `goe:"m2o"`

	Status string `goe:"default:'open';index"`

	IsMerged bool `goe:"default:false"`
	IsClosed bool `goe:"default:false"`
	IsLocked bool `goe:"default:false"`

	CommentsCount int `goe:"default:0"`

	// With 预加载挂载字段
	Repository *Repository  `goe:"-"`
	Author     *Contributor `goe:"-"`
	Assignee   *Contributor `goe:"-"`
	Comments   []*Comment   `goe:"o2m,fk:pull_request_id"`
}

type IssueLabel struct {
	ID        int64 `goe:"pk"`
	IssueID   int64 `goe:"index;m2o"`
	LabelID   int64 `goe:"index;m2o"`
	CreatedAt time.Time

	// With 预加载挂载字段
	Issue *Issue `goe:"-"`
	Label *Label `goe:"-"`
}

type PullRequestLabel struct {
	ID            int64 `goe:"pk"`
	PullRequestID int64 `goe:"index;m2o"`
	LabelID       int64 `goe:"index;m2o"`
	CreatedAt     time.Time

	// With 预加载挂载字段
	PullRequest *PullRequest `goe:"-"`
	Label       *Label       `goe:"-"`
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

// ProjectType 描述仓库与远程平台的关系以及可见性，与磁盘上的存储形态无关。
//
//   - local：本地自有项目，不做平台同步（用户可自行 git remote 推送）
//   - mirror：远程平台的只读镜像，从 MirrorURL 定期拉取
//   - public：已推送到远程平台并同步议题/PR，所有人可见
//   - private：同上，但仅所有者、团队成员和管理员可见
//
// 存储形态（裸仓库还是带工作区的普通仓库）由所有者的自有仓库目录决定，
// 见 services.RepoPath / services.ResolveRepoPath。
type ProjectType string

const (
	ProjectTypeLocal   ProjectType = "local"
	ProjectTypeMirror  ProjectType = "mirror"
	ProjectTypePublic  ProjectType = "public"
	ProjectTypePrivate ProjectType = "private"
)

// ValidProjectTypes 列出所有合法的项目类型值。
var ValidProjectTypes = []string{
	string(ProjectTypeLocal),
	string(ProjectTypeMirror),
	string(ProjectTypePublic),
	string(ProjectTypePrivate),
}

// IsValidProjectType 判断给定值是否为合法的项目类型。
func IsValidProjectType(v string) bool {
	for _, t := range ValidProjectTypes {
		if t == v {
			return true
		}
	}
	return false
}

// RepoStorage 描述仓库在磁盘上的存储形态。
type RepoStorage string

const (
	// RepoStorageBare 裸仓库，无工作区，不能直接编辑文件。
	RepoStorageBare RepoStorage = "bare"
	// RepoStorageWork 普通仓库，带工作区，可直接编辑文件。
	RepoStorageWork RepoStorage = "work"
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
	UserID    int64 `goe:"index;m2o"`

	// With 预加载挂载字段
	User   *User        `goe:"-"`
	Tokens []*SyncToken `goe:"o2m,fk:account_id"`
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
	CloneURL     string `db:"clone_url"`
	SSHURL       string `db:"sshurl"`
	APIURL       string `db:"apiurl"`
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
	LastIssueSyncAt *time.Time
	LastPRSyncAt    *time.Time
	LastETag        string `goe:"column:last_etag"`
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

	// RepoRoot 是团队的自有仓库目录，语义同 User.RepoRoot。
	// 为空时团队仓库落到全局裸仓库目录下的 <团队名>/<name>.git。
	RepoRoot string `goe:"default:''"`
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
	GitHubID     int64 `goe:"column:github_id;index"`
	RepositoryID int64 `goe:"index"`
	CommitsCount int   `goe:"default:0"`
}

type ETag struct {
	ID        int64     `goe:"pk"`
	CreatedAt time.Time `goe:"default:current_timestamp"`
	UpdatedAt time.Time

	URL  string `goe:"unique"`
	ETag string `goe:"column:etag"`
}

type Backup struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Name         string `goe:"index"`
	BackupType   string `goe:"index"` // full or incremental
	BaseBackupID *int64 `goe:"index"` // for incremental: the full backup it is based on
	Status       string `goe:"default:'running';index"`
	Size         int64
	Path         string
	Error        string
	StartedAt    *time.Time
	CompletedAt  *time.Time
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

	RepositoryID int64 `goe:"index;m2o"`

	InitiatorID int64  `goe:"index;m2o"`
	VerifierID  *int64 `goe:"index;m2o"`
	HandlerID   *int64 `goe:"index;m2o"`

	LastHandledAt *time.Time

	// With 预加载挂载字段
	Repository *Repository `goe:"-"`
	Initiator  *User       `goe:"-"`
	Verifier   *User       `goe:"-"`
	Handler    *User       `goe:"-"`
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

	TaskID int64 `goe:"index;m2o"`

	ScheduleType string `goe:"index"`

	PlanStartDate *time.Time
	PlanEndDate   *time.Time
	PlanStartNoon string
	PlanEndNoon   string

	ActualStartDate *time.Time
	ActualEndDate   *time.Time
	ActualStartNoon string
	ActualEndNoon   string

	User1ID *int64 `goe:"index;m2o"`
	User2ID *int64 `goe:"index;m2o"`
	User3ID *int64 `goe:"index;m2o"`

	// With 预加载挂载字段
	Task  *Task `goe:"-"`
	User1 *User `goe:"-"`
	User2 *User `goe:"-"`
	User3 *User `goe:"-"`
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
	TaskID     int64 `goe:"index;m2o"`
	FromStatus string
	ToStatus   string
	UserID     int64 `goe:"index;m2o"`
	Comment    string

	// With 预加载挂载字段
	Task *Task `goe:"-"`
	User *User `goe:"-"`
}

type TaskPullRequest struct {
	ID            int64 `goe:"pk"`
	CreatedAt     time.Time
	TaskID        int64 `goe:"index;m2o"`
	PullRequestID int64 `goe:"index;m2o"`

	// With 预加载挂载字段
	Task        *Task        `goe:"-"`
	PullRequest *PullRequest `goe:"-"`
}

type TaskTimeLog struct {
	ID        int64 `goe:"pk"`
	CreatedAt time.Time
	TaskID    int64 `goe:"index;m2o"`
	UserID    int64 `goe:"index;m2o"`
	StartTime time.Time
	EndTime   *time.Time
	Duration  int64
	Note      string

	// With 预加载挂载字段
	Task *Task `goe:"-"`
	User *User `goe:"-"`
}
