package routes

import (
	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/handlers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/gofiber/fiber/v3"
)

func SetupAPIRoutes(app *fiber.App) {
	api := app.Group(config.APIBaseURL)

	api.Get("/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	api.Get("/stats", handlers.GetStats)
	api.Get("/recent-issues", handlers.GetRecentIssues)
	api.Get("/recent-tasks", handlers.GetRecentTasks)

	setupAuthRoutes(api)
	setupUserRoutes(api)
	setupRepoListRoutes(api)
	setupGroupRoutes(api)
	setupActivityRoutes(api)
	setupSnippetRoutes(api)
	setupAdminRoutes(api)
	setupRepositoryRoutes(api)
}

func setupAuthRoutes(api fiber.Router) {
	api.Post("/auth/login", handlers.Login)
	api.Post("/auth/logout", handlers.Logout)
}

func setupUserRoutes(api fiber.Router) {
	api.Get("/user/me", middleware.AuthMiddleware(), handlers.GetCurrentUser)
	api.Put("/user/me", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.UpdateUser)
	api.Post("/user/me/password", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.ChangePassword)
	api.Get("/users", middleware.OptionalAuth(), handlers.ListUsers)
	api.Get("/users/:username", middleware.OptionalAuth(), handlers.GetUser)
	api.Get("/users/:username/repos", middleware.OptionalAuth(), handlers.GetUserRepositories)
	api.Put("/users/:username", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.UpdateUserByUsername)
	api.Post("/users/:username/avatar", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.UploadUserAvatar)
}

func setupRepoListRoutes(api fiber.Router) {
	api.Get("/repos", middleware.OptionalAuth(), handlers.ListRepositories)
	api.Post("/repos", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.CreateRepository)
	api.Get("/repos/github-info", handlers.GetGitHubRepoInfo)
}

func setupGroupRoutes(api fiber.Router) {
	api.Get("/groups", handlers.ListGroups)
	api.Post("/groups", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.CreateGroup)
	api.Get("/groups/:name", handlers.GetGroup)
	api.Put("/groups/:name", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.UpdateGroup)
	api.Post("/groups/:name/avatar", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.UploadGroupAvatar)
	api.Get("/groups/:name/members", handlers.ListGroupMembers)
	api.Post("/groups/:name/members", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.AddGroupMember)
	api.Delete("/groups/:name/members/:username", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.RemoveGroupMember)
}

func setupActivityRoutes(api fiber.Router) {
	api.Get("/activities", handlers.ListActivities)
	api.Post("/activities", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.CreateActivity)
}

func setupSnippetRoutes(api fiber.Router) {
	api.Get("/snippets", handlers.ListSnippets)
	api.Post("/snippets", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.CreateSnippet)
	api.Get("/snippets/:id", handlers.GetSnippet)
	api.Put("/snippets/:id", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.UpdateSnippet)
	api.Delete("/snippets/:id", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.DeleteSnippet)
}

func setupAdminRoutes(api fiber.Router) {
	admin := api.Group("/admin", middleware.AuthMiddleware(), middleware.AdminOnly())

	admin.Get("/accounts", handlers.ListAccounts)
	admin.Post("/accounts", handlers.CreateAccount)
	admin.Delete("/accounts/:id", handlers.DeleteAccount)

	admin.Post("/mirror", handlers.CreateMirror)
	admin.Post("/import", handlers.ImportFromRemote)

	admin.Post("/maintenance/update-commit-times", handlers.UpdateCommitTimes)

	admin.Get("/sync-points", handlers.ListAllSyncPoints)
	admin.Put("/sync-points/:id", handlers.AdminUpdateSyncPoint)
	admin.Get("/sync-logs", handlers.ListAllSyncLogs)
}

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

func setupRepoCRUDRoutes(repo fiber.Router) {
	repo.Get("", middleware.OptionalAuth(), handlers.GetRepository)
	repo.Put("", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.UpdateRepository)
	repo.Delete("", middleware.AuthMiddleware(), middleware.GuestReadOnly(), middleware.LeaderOrAdmin(), handlers.DeleteRepository)
	repo.Post("/transfer", middleware.AuthMiddleware(), middleware.GuestReadOnly(), middleware.LeaderOrAdmin(), handlers.TransferRepository)
}

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
	repo.Post("/rebase", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.RebaseCommits)
	repo.Post("/stage", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.StageFiles)
	repo.Post("/unstage", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.UnstageFiles)
	repo.Post("/commit", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.CommitChanges)
	repo.Get("/commits/:sha", middleware.OptionalAuth(), handlers.GetCommitDetail)
	repo.Get("/compare/:basehead", middleware.OptionalAuth(), handlers.CompareCommits)
	repo.Post("/refresh-stats", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.RefreshRepositoryStats)
}

func setupRepoSyncRoutes(repo fiber.Router) {
	repo.Post("/sync/pull", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.SyncPullRepository)
	repo.Post("/sync/issues", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.SyncIssuesData)
	repo.Post("/sync/push", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.SyncPushRepository)
	repo.Get("/sync/config", middleware.AuthMiddleware(), handlers.GetSyncConfig)
	repo.Put("/sync/config", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.UpdateSyncConfig)
	repo.Get("/sync/logs", middleware.AuthMiddleware(), handlers.GetSyncLogs)
}

func setupRepoStarRoutes(repo fiber.Router) {
	repo.Post("/star", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.StarRepository)
	repo.Delete("/star", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.UnstarRepository)
	repo.Post("/watch", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.WatchRepository)
	repo.Delete("/watch", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.UnwatchRepository)
}

func setupIssueRoutes(repo fiber.Router) {
	repo.Get("/issues", middleware.OptionalAuth(), handlers.ListIssues)
	repo.Post("/issues", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.CreateIssue)
	repo.Get("/issues/:number", middleware.OptionalAuth(), handlers.GetIssue)
	repo.Put("/issues/:number", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.UpdateIssue)
	repo.Get("/issues/:number/comments", middleware.OptionalAuth(), handlers.GetComments)
	repo.Post("/issues/:number/comments", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.CreateComment)
	repo.Get("/labels", middleware.OptionalAuth(), handlers.ListLabels)
}

func setupPullRequestRoutes(repo fiber.Router) {
	repo.Get("/pull_requests", middleware.OptionalAuth(), handlers.ListPullRequests)
	repo.Post("/pull_requests", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.CreatePullRequest)
	repo.Get("/pull_requests/:number", middleware.OptionalAuth(), handlers.GetPullRequest)
	repo.Get("/pull_requests/:number/commits", middleware.OptionalAuth(), handlers.GetPRCommits)
	repo.Get("/pull_requests/:number/files", middleware.OptionalAuth(), handlers.GetPRFiles)
	repo.Put("/pull_requests/:number", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.UpdatePullRequest)
	repo.Post("/pull_requests/:number/merge", middleware.AuthMiddleware(), middleware.GuestReadOnly(), middleware.LeaderOrAdmin(), handlers.MergePullRequest)
	repo.Post("/pull_requests/:number/close", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.ClosePullRequest)
	repo.Post("/pull_requests/:number/reopen", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.ReopenPullRequest)
}

func setupTaskRoutes(repo fiber.Router) {
	repo.Get("/tasks", middleware.OptionalAuth(), handlers.ListTasks)
	repo.Post("/tasks", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.CreateTask)
	repo.Get("/tasks/:id", middleware.OptionalAuth(), handlers.GetTask)
	repo.Put("/tasks/:id", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.UpdateTask)
	repo.Delete("/tasks/:id", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.DeleteTask)
	repo.Post("/tasks/:id/attachments", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.UploadTaskAttachment)
	repo.Delete("/tasks/:id/attachments/:attachment_id", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.DeleteTaskAttachment)
	repo.Post("/tasks/:id/issues", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.AddIssueToTask)
	repo.Delete("/tasks/:id/issues/:issue_id", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.RemoveIssueFromTask)
	repo.Get("/tasks/:id/comments", middleware.OptionalAuth(), handlers.GetTaskComments)
	repo.Post("/tasks/:id/comments", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.CreateTaskComment)
	repo.Post("/tasks/:id/transition", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.TransitionTask)
	repo.Get("/tasks/:id/transitions", middleware.OptionalAuth(), handlers.GetTaskTransitions)
	repo.Post("/tasks/:id/pull_requests", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.LinkTaskPullRequest)
	repo.Delete("/tasks/:id/pull_requests/:pr_id", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.UnlinkTaskPullRequest)
	repo.Get("/tasks/:id/pull_requests", middleware.OptionalAuth(), handlers.GetTaskPullRequests)
	repo.Get("/tasks/:id/commits", middleware.OptionalAuth(), handlers.GetTaskCommits)
	repo.Post("/tasks/:id/timer/start", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.StartTimer)
	repo.Post("/tasks/:id/timer/stop", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.StopTimer)
	repo.Get("/tasks/:id/time-logs", middleware.OptionalAuth(), handlers.GetTaskTimeLogs)
	repo.Get("/tasks/:id/time-summary", middleware.OptionalAuth(), handlers.GetTaskTimeSummary)
}

func setupReleaseRoutes(repo fiber.Router) {
	repo.Get("/releases", middleware.OptionalAuth(), handlers.ListReleases)
	repo.Get("/releases/:tag", middleware.OptionalAuth(), handlers.GetRelease)
	repo.Post("/releases/sync", middleware.AuthMiddleware(), middleware.GuestReadOnly(), handlers.SyncReleases)
}
