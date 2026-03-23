package constants

const (
	APIVersion = "v1"
	APIBaseURL = "/api/" + APIVersion

	DefaultPage    = 1
	DefaultPerPage = 30
	DefaultBranch  = "main"

	MaxPerPage = 100
)

const (
	ProjectTypeMirror = "mirror"
	ProjectTypeOwned  = "owned"
	ProjectTypeFork   = "fork"
)

const (
	VisibilityPublic  = "public"
	VisibilityPrivate = "private"
)

const (
	IssueStateOpen   = "open"
	IssueStateClosed = "closed"
	IssueStateAll    = "all"
)

const (
	MRStatusOpen   = "open"
	MRStatusClosed = "closed"
	MRStatusMerged = "merged"
)

const (
	SyncDirectionPull = "pull"
	SyncDirectionPush = "push"
)

var SupportedLanguages = []string{
	"go", "javascript", "typescript", "python", "java", "c", "cpp",
	"csharp", "ruby", "php", "rust", "swift", "kotlin", "scala",
	"html", "css", "sql", "bash", "shell", "json", "yaml", "xml",
	"markdown", "dockerfile", "makefile",
}
