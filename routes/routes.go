package routes

import (
	"strings"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/handlers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/static"
)

// SetupRouter 创建并配置 Fiber 应用，注册所有路由
func SetupRouter() *fiber.App {
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			msg := "Internal Server Error"
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
				msg = e.Message
			}
			return c.Status(code).JSON(fiber.Map{"error": msg})
		},
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Content-Length", "Accept-Encoding", "X-CSRF-Token", "Authorization", "accept", "origin", "Cache-Control", "X-Requested-With"},
	}))

	setupStaticFiles(app)
	setupAPIRoutes(app)

	app.Get("/*", func(c fiber.Ctx) error {
		path := c.Path()
		if strings.HasPrefix(path, "/api/") {
			return c.Status(404).JSON(fiber.Map{"error": "API endpoint not found"})
		}
		return c.SendFile("./web/dist/index.html")
	})

	return app
}

// setupStaticFiles 注册静态文件和 SPA 入口路由
func setupStaticFiles(app *fiber.App) {
	app.Get("/", func(c fiber.Ctx) error {
		return c.SendFile("./web/dist/index.html")
	})
	app.Get("/assets/*", static.New("./web/dist/assets"))
	app.Get("/uploads/*", static.New("./uploads"))
	app.Get("/images/*", func(c fiber.Ctx) error {
		path := c.Params("*")
		return c.SendFile("./web/images/" + path)
	})
}

// setupAPIRoutes 注册 API 路由组
func setupAPIRoutes(app *fiber.App) {
	api := app.Group(config.APIBaseURL)

	api.Get("/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	api.Get("/stats", handlers.GetStats)

	setupAuthRoutes(api)
	setupUserRoutes(api)
	setupRepoListRoutes(api)
	setupGroupRoutes(api)
	setupActivityRoutes(api)
	setupSnippetRoutes(api)
	setupAdminRoutes(api)
	setupRepositoryRoutes(api)
}

// setupAuthRoutes 注册认证相关路由
func setupAuthRoutes(api fiber.Router) {
	api.Post("/auth/register", handlers.Register)
	api.Post("/auth/login", handlers.Login)
	api.Post("/auth/logout", handlers.Logout)
}

// setupUserRoutes 注册用户相关路由
func setupUserRoutes(api fiber.Router) {
	api.Get("/user/me", middleware.AuthMiddleware(), handlers.GetCurrentUser)
	api.Put("/user/me", middleware.AuthMiddleware(), handlers.UpdateUser)
	api.Post("/user/me/password", middleware.AuthMiddleware(), handlers.ChangePassword)
	api.Get("/users", middleware.OptionalAuth(), handlers.ListUsers)
	api.Get("/users/:username", middleware.OptionalAuth(), handlers.GetUser)
	api.Get("/users/:username/repos", middleware.OptionalAuth(), handlers.GetUserRepositories)
	api.Put("/users/:username", middleware.AuthMiddleware(), handlers.UpdateUserByUsername)
	api.Post("/users/:username/avatar", middleware.AuthMiddleware(), handlers.UploadUserAvatar)
}

// setupRepoListRoutes 注册仓库列表和创建路由
func setupRepoListRoutes(api fiber.Router) {
	api.Get("/repos", middleware.OptionalAuth(), handlers.ListRepositories)
	api.Post("/repos", middleware.AuthMiddleware(), handlers.CreateRepository)
	api.Get("/repos/github-info", handlers.GetGitHubRepoInfo)
}

// setupGroupRoutes 注册团队相关路由
func setupGroupRoutes(api fiber.Router) {
	api.Get("/groups", handlers.ListGroups)
	api.Post("/groups", middleware.AuthMiddleware(), handlers.CreateGroup)
	api.Get("/groups/:name", handlers.GetGroup)
	api.Put("/groups/:name", middleware.AuthMiddleware(), handlers.UpdateGroup)
	api.Post("/groups/:name/avatar", middleware.AuthMiddleware(), handlers.UploadGroupAvatar)
	api.Get("/groups/:name/members", handlers.ListGroupMembers)
	api.Post("/groups/:name/members", middleware.AuthMiddleware(), handlers.AddGroupMember)
	api.Delete("/groups/:name/members/:username", middleware.AuthMiddleware(), handlers.RemoveGroupMember)
}

// setupActivityRoutes 注册活动相关路由
func setupActivityRoutes(api fiber.Router) {
	api.Get("/activities", handlers.ListActivities)
	api.Post("/activities", middleware.AuthMiddleware(), handlers.CreateActivity)
}

// setupSnippetRoutes 注册代码片段相关路由
func setupSnippetRoutes(api fiber.Router) {
	api.Get("/snippets", handlers.ListSnippets)
	api.Post("/snippets", middleware.AuthMiddleware(), handlers.CreateSnippet)
	api.Get("/snippets/:id", handlers.GetSnippet)
	api.Put("/snippets/:id", middleware.AuthMiddleware(), handlers.UpdateSnippet)
	api.Delete("/snippets/:id", middleware.AuthMiddleware(), handlers.DeleteSnippet)
}

func setupAdminRoutes(api fiber.Router) {
	admin := api.Group("/admin", middleware.AuthMiddleware(), middleware.AdminOnly())

	admin.Get("/accounts", handlers.ListAccounts)
	admin.Post("/accounts", handlers.CreateAccount)
	admin.Delete("/accounts/:id", handlers.DeleteAccount)

	admin.Post("/mirror", handlers.CreateMirror)
	admin.Post("/import", handlers.ImportFromRemote)

	admin.Post("/maintenance/update-commit-times", handlers.UpdateCommitTimes)
}

// setupRepositoryRoutes 注册仓库资源路由（含子模块）
func setupRepositoryRoutes(api fiber.Router) {
	repo := api.Group("/:owner/:repo")

	setupRepoCRUDRoutes(repo)
	setupRepoGitRoutes(repo)
	setupRepoSyncRoutes(repo)
	setupRepoStarRoutes(repo)
	setupIssueRoutes(repo)
	setupPullRequestRoutes(repo)
	setupTaskRoutes(repo)
	setupReleaseRoutes(repo)
}

// setupRepoCRUDRoutes 注册仓库增删改查路由
func setupRepoCRUDRoutes(repo fiber.Router) {
	repo.Get("", middleware.OptionalAuth(), handlers.GetRepository)
	repo.Put("", middleware.AuthMiddleware(), handlers.UpdateRepository)
	repo.Delete("", middleware.AuthMiddleware(), handlers.DeleteRepository)
}

// setupRepoGitRoutes 注册仓库 Git 操作路由（目录树、提交、分支等）
func setupRepoGitRoutes(repo fiber.Router) {
	repo.Get("/tree", middleware.OptionalAuth(), handlers.GetRepositoryTree)
	repo.Get("/tree/*", middleware.OptionalAuth(), handlers.GetRepositoryTree)
	repo.Get("/file", middleware.OptionalAuth(), handlers.GetRepositoryFile)
	repo.Get("/file/*", middleware.OptionalAuth(), handlers.GetRepositoryFile)
	repo.Get("/raw/*", middleware.OptionalAuth(), handlers.GetRepositoryRawFile)
	repo.Get("/branches", middleware.OptionalAuth(), handlers.GetRepositoryBranches)
	repo.Get("/tags", middleware.OptionalAuth(), handlers.GetRepositoryTags)
	repo.Get("/commits", middleware.OptionalAuth(), handlers.GetRepositoryCommits)
	repo.Get("/last-commit", middleware.OptionalAuth(), handlers.GetRepositoryLastCommit)
	repo.Get("/contributors", middleware.OptionalAuth(), handlers.GetRepositoryContributors)
	repo.Get("/code-stats", middleware.OptionalAuth(), handlers.GetCodeStats)
	repo.Get("/commit-activity", middleware.OptionalAuth(), handlers.GetCommitActivity)
	repo.Post("/rebase", middleware.AuthMiddleware(), handlers.RebaseCommits)
	repo.Post("/stage", middleware.AuthMiddleware(), handlers.StageFiles)
	repo.Post("/unstage", middleware.AuthMiddleware(), handlers.UnstageFiles)
	repo.Post("/commit", middleware.AuthMiddleware(), handlers.CommitChanges)
	repo.Get("/commits/:sha", middleware.OptionalAuth(), handlers.GetCommitDetail)
	repo.Get("/compare/:basehead", middleware.OptionalAuth(), handlers.CompareCommits)
	repo.Post("/refresh-stats", middleware.AuthMiddleware(), handlers.RefreshRepositoryStats)
}

// setupRepoSyncRoutes 注册仓库同步路由
func setupRepoSyncRoutes(repo fiber.Router) {
	repo.Post("/sync/pull", middleware.AuthMiddleware(), handlers.SyncPullRepository)
	repo.Post("/sync/push", middleware.AuthMiddleware(), handlers.SyncPushRepository)
}

// setupRepoStarRoutes 注册仓库收藏和关注路由
func setupRepoStarRoutes(repo fiber.Router) {
	repo.Post("/star", middleware.AuthMiddleware(), handlers.StarRepository)
	repo.Delete("/star", middleware.AuthMiddleware(), handlers.UnstarRepository)
	repo.Post("/watch", middleware.AuthMiddleware(), handlers.WatchRepository)
	repo.Delete("/watch", middleware.AuthMiddleware(), handlers.UnwatchRepository)
}

// setupIssueRoutes 注册 Issue 相关路由
func setupIssueRoutes(repo fiber.Router) {
	repo.Get("/issues", handlers.ListIssues)
	repo.Post("/issues", middleware.AuthMiddleware(), handlers.CreateIssue)
	repo.Get("/issues/:number", handlers.GetIssue)
	repo.Put("/issues/:number", middleware.AuthMiddleware(), handlers.UpdateIssue)
	repo.Get("/issues/:number/comments", handlers.GetComments)
	repo.Post("/issues/:number/comments", middleware.AuthMiddleware(), handlers.CreateComment)
	repo.Get("/labels", handlers.ListLabels)
}

// setupPullRequestRoutes 注册 PR 相关路由
func setupPullRequestRoutes(repo fiber.Router) {
	repo.Get("/pull_requests", handlers.ListPullRequests)
	repo.Post("/pull_requests", middleware.AuthMiddleware(), handlers.CreatePullRequest)
	repo.Get("/pull_requests/:number", handlers.GetPullRequest)
	repo.Get("/pull_requests/:number/commits", handlers.GetPRCommits)
	repo.Get("/pull_requests/:number/files", handlers.GetPRFiles)
	repo.Put("/pull_requests/:number", middleware.AuthMiddleware(), handlers.UpdatePullRequest)
	repo.Post("/pull_requests/:number/merge", middleware.AuthMiddleware(), handlers.MergePullRequest)
	repo.Post("/pull_requests/:number/close", middleware.AuthMiddleware(), handlers.ClosePullRequest)
	repo.Post("/pull_requests/:number/reopen", middleware.AuthMiddleware(), handlers.ReopenPullRequest)
}

// setupTaskRoutes 注册任务管理路由
func setupTaskRoutes(repo fiber.Router) {
	repo.Get("/tasks", handlers.ListTasks)
	repo.Post("/tasks", middleware.AuthMiddleware(), handlers.CreateTask)
	repo.Get("/tasks/:id", handlers.GetTask)
	repo.Put("/tasks/:id", middleware.AuthMiddleware(), handlers.UpdateTask)
	repo.Delete("/tasks/:id", middleware.AuthMiddleware(), handlers.DeleteTask)
	repo.Post("/tasks/:id/attachments", middleware.AuthMiddleware(), handlers.UploadTaskAttachment)
	repo.Delete("/tasks/:id/attachments/:attachment_id", middleware.AuthMiddleware(), handlers.DeleteTaskAttachment)
	repo.Post("/tasks/:id/issues", middleware.AuthMiddleware(), handlers.AddIssueToTask)
	repo.Delete("/tasks/:id/issues/:issue_id", middleware.AuthMiddleware(), handlers.RemoveIssueFromTask)
	repo.Get("/tasks/:id/comments", handlers.GetTaskComments)
	repo.Post("/tasks/:id/comments", middleware.AuthMiddleware(), handlers.CreateTaskComment)
	repo.Post("/tasks/:id/transition", middleware.AuthMiddleware(), handlers.TransitionTask)
	repo.Get("/tasks/:id/transitions", handlers.GetTaskTransitions)
	repo.Post("/tasks/:id/pull_requests", middleware.AuthMiddleware(), handlers.LinkTaskPullRequest)
	repo.Delete("/tasks/:id/pull_requests/:pr_id", middleware.AuthMiddleware(), handlers.UnlinkTaskPullRequest)
	repo.Get("/tasks/:id/pull_requests", handlers.GetTaskPullRequests)
	repo.Get("/tasks/:id/commits", handlers.GetTaskCommits)
	repo.Post("/tasks/:id/timer/start", middleware.AuthMiddleware(), handlers.StartTimer)
	repo.Post("/tasks/:id/timer/stop", middleware.AuthMiddleware(), handlers.StopTimer)
	repo.Get("/tasks/:id/time-logs", handlers.GetTaskTimeLogs)
	repo.Get("/tasks/:id/time-summary", handlers.GetTaskTimeSummary)
}

// setupReleaseRoutes 注册发布版本路由
func setupReleaseRoutes(repo fiber.Router) {
	repo.Get("/releases", handlers.ListReleases)
	repo.Get("/releases/:tag", handlers.GetRelease)
	repo.Post("/releases/sync", middleware.AuthMiddleware(), handlers.SyncReleases)
}
