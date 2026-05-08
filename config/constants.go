package config

// API 版本与基础路径
const (
	APIVersion = "v1"
	APIBaseURL = "/api/" + APIVersion
)

// 分页默认值
const (
	DefaultPage    = 1
	DefaultPerPage = 30
	DefaultBranch  = "main"

	MaxPerPage = 1000
)

// 项目类型
const (
	ProjectTypeLocal  = "local"
	ProjectTypeMirror = "mirror"
)

// 可见性
const (
	VisibilityPublic  = "public"
	VisibilityPrivate = "private"
)

// Issue 状态
const (
	IssueStateOpen   = "open"
	IssueStateClosed = "closed"
	IssueStateAll    = "all"
)

// PR 状态
const (
	PRStatusOpen   = "open"
	PRStatusClosed = "closed"
	PRStatusMerged = "merged"
)

// 同步方向
const (
	SyncDirectionPull = "pull"
	SyncDirectionPush = "push"
)

// SupportedLanguages 支持的编程语言列表
var SupportedLanguages = []string{
	"go", "javascript", "typescript", "python", "java", "c", "cpp",
	"csharp", "ruby", "php", "rust", "swift", "kotlin", "scala",
	"html", "css", "sql", "bash", "shell", "json", "yaml", "xml",
	"markdown", "dockerfile", "makefile",
}
