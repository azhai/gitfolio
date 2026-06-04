package routes

import (
	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/handlers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/gofiber/fiber/v3"
)

func SetupAPIRoutes(app *fiber.App) {
	api := app.Group(config.APIBaseURL, middleware.RequireAuth())

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
	api.Get("/user/me", handlers.GetCurrentUser)
	api.Put("/user/me", middleware.GuestReadOnly(), handlers.UpdateUser)
	api.Post("/user/me/password", middleware.GuestReadOnly(), handlers.ChangePassword)
	api.Get("/users", handlers.ListUsers)
	api.Post("/users", middleware.AdminOnly(), handlers.CreateUser)
	api.Get("/users/:username", handlers.GetUser)
	api.Get("/users/:username/repos", handlers.GetUserRepositories)
	api.Put("/users/:username", middleware.GuestReadOnly(), handlers.UpdateUserByUsername)
	api.Post("/users/:username/avatar", middleware.GuestReadOnly(), handlers.UploadUserAvatar)
}

func setupRepoListRoutes(api fiber.Router) {
	api.Get("/repos", handlers.ListRepositories)
	api.Post("/repos", middleware.GuestReadOnly(), handlers.CreateRepository)
	api.Get("/repos/github-info", handlers.GetGitHubRepoInfo)
}

func setupGroupRoutes(api fiber.Router) {
	api.Get("/groups", handlers.ListGroups)
	api.Post("/groups", middleware.GuestReadOnly(), handlers.CreateGroup)
	api.Get("/groups/:name", handlers.GetGroup)
	api.Put("/groups/:name", middleware.GuestReadOnly(), handlers.UpdateGroup)
	api.Post("/groups/:name/avatar", middleware.GuestReadOnly(), handlers.UploadGroupAvatar)
	api.Get("/groups/:name/members", handlers.ListGroupMembers)
	api.Post("/groups/:name/members", middleware.GuestReadOnly(), handlers.AddGroupMember)
	api.Delete("/groups/:name/members/:username", middleware.GuestReadOnly(), handlers.RemoveGroupMember)
}

func setupActivityRoutes(api fiber.Router) {
	api.Get("/activities", handlers.ListActivities)
	api.Post("/activities", middleware.GuestReadOnly(), handlers.CreateActivity)
}

func setupSnippetRoutes(api fiber.Router) {
	api.Get("/snippets", handlers.ListSnippets)
	api.Post("/snippets", middleware.GuestReadOnly(), handlers.CreateSnippet)
	api.Get("/snippets/:id", handlers.GetSnippet)
	api.Put("/snippets/:id", middleware.GuestReadOnly(), handlers.UpdateSnippet)
	api.Delete("/snippets/:id", middleware.GuestReadOnly(), handlers.DeleteSnippet)
}

func setupAdminRoutes(api fiber.Router) {
	admin := api.Group("/system/admin", middleware.AdminOnly())

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
	repo.Get("", handlers.GetRepository)
	repo.Put("", middleware.GuestReadOnly(), handlers.UpdateRepository)
	repo.Delete("", middleware.GuestReadOnly(), handlers.DeleteRepository)
	repo.Post("/transfer", middleware.GuestReadOnly(), handlers.TransferRepository)
	repo.Post("/retry-migrate", middleware.GuestReadOnly(), handlers.RetryMigrate)
}

func setupRepoGitRoutes(repo fiber.Router) {
	repo.Get("/tree", handlers.GetRepositoryTree)
	repo.Get("/tree/*", handlers.GetRepositoryTree)
	repo.Get("/file", handlers.GetRepositoryFile)
	repo.Get("/file/*", handlers.GetRepositoryFile)
	repo.Get("/raw/*", handlers.GetRepositoryRawFile)
	repo.Get("/branches", handlers.GetRepositoryBranches)
	repo.Get("/tags", handlers.GetRepositoryTags)
	repo.Get("/commits", handlers.GetRepositoryCommits)
	repo.Get("/last-commit", handlers.GetRepositoryLastCommit)
	repo.Get("/contributors", handlers.GetRepositoryContributors)
	repo.Get("/code-stats", handlers.GetCodeStats)
	repo.Get("/commit-activity", handlers.GetCommitActivity)
	repo.Post("/rebase", middleware.GuestReadOnly(), handlers.RebaseCommits)
	repo.Put("/default-branch", middleware.GuestReadOnly(), handlers.SetDefaultBranch)
	repo.Post("/tags", middleware.GuestReadOnly(), handlers.CreateTag)
	repo.Delete("/tags/:name", middleware.GuestReadOnly(), handlers.DeleteTag)
	repo.Post("/branches", middleware.GuestReadOnly(), handlers.CreateBranch)
	repo.Delete("/branches/:name", middleware.GuestReadOnly(), handlers.DeleteBranch)
	repo.Post("/branches/rename", middleware.GuestReadOnly(), handlers.RenameBranch)
	repo.Post("/merge", middleware.GuestReadOnly(), handlers.MergeBranch)
	repo.Post("/cherry-pick", middleware.GuestReadOnly(), handlers.CherryPick)
	repo.Post("/delete-commits", middleware.GuestReadOnly(), handlers.DeleteCommitRange)
	repo.Post("/revert", middleware.GuestReadOnly(), handlers.RevertCommit)
	repo.Post("/reset", middleware.GuestReadOnly(), handlers.ResetCommits)
	repo.Post("/abort", middleware.GuestReadOnly(), handlers.AbortOperation)
	repo.Get("/git-status", handlers.GetRepoStatus)
	repo.Get("/diff", handlers.GetFileDiff)
	repo.Get("/commit-diff", handlers.GetCommitFileDiff)
	repo.Post("/stage-patch", middleware.GuestReadOnly(), handlers.StagePatch)
	repo.Post("/discard", middleware.GuestReadOnly(), handlers.DiscardFileChanges)
	repo.Post("/checkout", middleware.GuestReadOnly(), handlers.CheckoutBranch)
	repo.Post("/rebase-interactive", middleware.GuestReadOnly(), handlers.RebaseInteractive)
	repo.Get("/stash-list", handlers.GetStashList)
	repo.Post("/stash", middleware.GuestReadOnly(), handlers.StashSave)
	repo.Post("/stash-pop", middleware.GuestReadOnly(), handlers.StashPop)
	repo.Post("/stash-apply", middleware.GuestReadOnly(), handlers.StashApply)
	repo.Post("/stash-drop", middleware.GuestReadOnly(), handlers.StashDrop)
	repo.Post("/stage", middleware.GuestReadOnly(), handlers.StageFiles)
	repo.Post("/unstage", middleware.GuestReadOnly(), handlers.UnstageFiles)
	repo.Post("/commit", middleware.GuestReadOnly(), handlers.CommitChanges)
	repo.Post("/edit-file", middleware.GuestReadOnly(), handlers.EditFile)
	repo.Delete("/file", middleware.GuestReadOnly(), handlers.DeleteFile)
	repo.Get("/remotes", handlers.ListRemotes)
	repo.Post("/remotes", middleware.GuestReadOnly(), handlers.AddRemote)
	repo.Delete("/remotes/:name", middleware.GuestReadOnly(), handlers.RemoveRemote)
	repo.Put("/remotes/:name/url", middleware.GuestReadOnly(), handlers.SetRemoteURL)
	repo.Post("/remotes/:name/push-url", middleware.GuestReadOnly(), handlers.AddRemotePushURL)
	repo.Delete("/remotes/:name/push-url", middleware.GuestReadOnly(), handlers.RemoveRemotePushURL)
	repo.Get("/commits/:sha", handlers.GetCommitDetail)
	repo.Get("/compare/:basehead", handlers.CompareCommits)
	repo.Post("/refresh-stats", middleware.GuestReadOnly(), handlers.RefreshRepositoryStats)
}

func setupRepoSyncRoutes(repo fiber.Router) {
	repo.Post("/sync/pull", middleware.GuestReadOnly(), handlers.SyncPullRepository)
	repo.Post("/sync/issues", middleware.GuestReadOnly(), handlers.SyncIssuesData)
	repo.Post("/sync/push", middleware.GuestReadOnly(), handlers.SyncPushRepository)
	repo.Get("/sync/config", handlers.GetSyncConfig)
	repo.Put("/sync/config", middleware.GuestReadOnly(), handlers.UpdateSyncConfig)
	repo.Get("/sync/logs", handlers.GetSyncLogs)
}

func setupRepoStarRoutes(repo fiber.Router) {
	repo.Post("/star", middleware.GuestReadOnly(), handlers.StarRepository)
	repo.Delete("/star", middleware.GuestReadOnly(), handlers.UnstarRepository)
	repo.Post("/watch", middleware.GuestReadOnly(), handlers.WatchRepository)
	repo.Delete("/watch", middleware.GuestReadOnly(), handlers.UnwatchRepository)
}

func setupIssueRoutes(repo fiber.Router) {
	repo.Get("/issues", handlers.ListIssues)
	repo.Post("/issues", middleware.GuestReadOnly(), handlers.CreateIssue)
	repo.Get("/issues/:number", handlers.GetIssue)
	repo.Put("/issues/:number", middleware.GuestReadOnly(), handlers.UpdateIssue)
	repo.Get("/issues/:number/comments", handlers.GetComments)
	repo.Post("/issues/:number/comments", middleware.GuestReadOnly(), handlers.CreateComment)
	repo.Get("/labels", handlers.ListLabels)
}

func setupPullRequestRoutes(repo fiber.Router) {
	repo.Get("/pull_requests", handlers.ListPullRequests)
	repo.Post("/pull_requests", middleware.GuestReadOnly(), handlers.CreatePullRequest)
	repo.Get("/pull_requests/:number", handlers.GetPullRequest)
	repo.Get("/pull_requests/:number/commits", handlers.GetPRCommits)
	repo.Get("/pull_requests/:number/files", handlers.GetPRFiles)
	repo.Put("/pull_requests/:number", middleware.GuestReadOnly(), handlers.UpdatePullRequest)
	repo.Post("/pull_requests/:number/merge", middleware.GuestReadOnly(), handlers.MergePullRequest)
	repo.Post("/pull_requests/:number/close", middleware.GuestReadOnly(), handlers.ClosePullRequest)
	repo.Post("/pull_requests/:number/reopen", middleware.GuestReadOnly(), handlers.ReopenPullRequest)
}

func setupTaskRoutes(repo fiber.Router) {
	repo.Get("/tasks", handlers.ListTasks)
	repo.Post("/tasks", middleware.GuestReadOnly(), handlers.CreateTask)
	repo.Get("/tasks/:id", handlers.GetTask)
	repo.Put("/tasks/:id", middleware.GuestReadOnly(), handlers.UpdateTask)
	repo.Delete("/tasks/:id", middleware.GuestReadOnly(), handlers.DeleteTask)
	repo.Post("/tasks/:id/attachments", middleware.GuestReadOnly(), handlers.UploadTaskAttachment)
	repo.Delete("/tasks/:id/attachments/:attachment_id", middleware.GuestReadOnly(), handlers.DeleteTaskAttachment)
	repo.Post("/tasks/:id/issues", middleware.GuestReadOnly(), handlers.AddIssueToTask)
	repo.Delete("/tasks/:id/issues/:issue_id", middleware.GuestReadOnly(), handlers.RemoveIssueFromTask)
	repo.Get("/tasks/:id/comments", handlers.GetTaskComments)
	repo.Post("/tasks/:id/comments", middleware.GuestReadOnly(), handlers.CreateTaskComment)
	repo.Post("/tasks/:id/transition", middleware.GuestReadOnly(), handlers.TransitionTask)
	repo.Get("/tasks/:id/transitions", handlers.GetTaskTransitions)
	repo.Post("/tasks/:id/pull_requests", middleware.GuestReadOnly(), handlers.LinkTaskPullRequest)
	repo.Delete("/tasks/:id/pull_requests/:pr_id", middleware.GuestReadOnly(), handlers.UnlinkTaskPullRequest)
	repo.Get("/tasks/:id/pull_requests", handlers.GetTaskPullRequests)
	repo.Get("/tasks/:id/commits", handlers.GetTaskCommits)
	repo.Post("/tasks/:id/timer/start", middleware.GuestReadOnly(), handlers.StartTimer)
	repo.Post("/tasks/:id/timer/stop", middleware.GuestReadOnly(), handlers.StopTimer)
	repo.Get("/tasks/:id/time-logs", handlers.GetTaskTimeLogs)
	repo.Get("/tasks/:id/time-summary", handlers.GetTaskTimeSummary)
}

func setupReleaseRoutes(repo fiber.Router) {
	repo.Get("/releases", handlers.ListReleases)
	repo.Get("/releases/:tag", handlers.GetRelease)
	repo.Post("/releases/sync", middleware.GuestReadOnly(), handlers.SyncReleases)
}
