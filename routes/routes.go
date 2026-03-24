package routes

import (
	"strings"

	"github.com/azhai/gitfolio/controllers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
)

func SetupRouter() *fiber.App {
	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Content-Length", "Accept-Encoding", "X-CSRF-Token", "Authorization", "accept", "origin", "Cache-Control", "X-Requested-With"},
	}))

	app.Get("/", func(c fiber.Ctx) error {
		return c.SendFile("./web/index-spa.html")
	})

	app.Get("/static/app-spa.js", func(c fiber.Ctx) error {
		return c.SendFile("./web/app-spa.js")
	})

	app.Get("/static/styles.css", func(c fiber.Ctx) error {
		return c.SendFile("./web/styles.css")
	})

	app.Get("/static/vendor/*", func(c fiber.Ctx) error {
		path := c.Params("*")
		c.Set("Cache-Control", "public, max-age=31536000")
		return c.SendFile("./web/vendor/" + path)
	})

	app.Get("/images/*", func(c fiber.Ctx) error {
		path := c.Params("*")
		return c.SendFile("./web/images/" + path)
	})

	app.Get("/api/v1/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	app.Get("/api/v1/stats", controllers.GetStats)

	app.Post("/api/v1/auth/register", controllers.Register)
	app.Post("/api/v1/auth/login", controllers.Login)

	app.Get("/api/v1/user/me", middleware.AuthMiddleware(), controllers.GetCurrentUser)
	app.Put("/api/v1/user/me", middleware.AuthMiddleware(), controllers.UpdateUser)

	app.Get("/api/v1/users/:username", middleware.OptionalAuth(), controllers.GetUser)
	app.Get("/api/v1/users/:username/repos", middleware.OptionalAuth(), controllers.GetUserRepositories)

	app.Get("/api/v1/repos", middleware.OptionalAuth(), controllers.ListRepositories)
	app.Post("/api/v1/repos", middleware.AuthMiddleware(), controllers.CreateRepository)

	app.Get("/api/v1/groups", controllers.ListGroups)
	app.Post("/api/v1/groups", middleware.AuthMiddleware(), controllers.CreateGroup)
	app.Get("/api/v1/groups/:name", controllers.GetGroup)

	app.Get("/api/v1/activities", controllers.ListActivities)
	app.Post("/api/v1/activities", middleware.AuthMiddleware(), controllers.CreateActivity)

	app.Get("/api/v1/snippets", controllers.ListSnippets)
	app.Post("/api/v1/snippets", middleware.AuthMiddleware(), controllers.CreateSnippet)
	app.Get("/api/v1/snippets/:id", controllers.GetSnippet)
	app.Put("/api/v1/snippets/:id", middleware.AuthMiddleware(), controllers.UpdateSnippet)
	app.Delete("/api/v1/snippets/:id", middleware.AuthMiddleware(), controllers.DeleteSnippet)

	app.Get("/api/v1/:owner/:repo/tasks", controllers.ListTasks)
	app.Post("/api/v1/:owner/:repo/tasks", middleware.AuthMiddleware(), controllers.CreateTask)
	app.Get("/api/v1/:owner/:repo/tasks/:id", controllers.GetTask)
	app.Put("/api/v1/:owner/:repo/tasks/:id", middleware.AuthMiddleware(), controllers.UpdateTask)
	app.Delete("/api/v1/:owner/:repo/tasks/:id", middleware.AuthMiddleware(), controllers.DeleteTask)
	app.Post("/api/v1/:owner/:repo/tasks/:id/attachments", middleware.AuthMiddleware(), controllers.UploadTaskAttachment)
	app.Delete("/api/v1/:owner/:repo/tasks/:id/attachments/:attachment_id", middleware.AuthMiddleware(), controllers.DeleteTaskAttachment)
	app.Post("/api/v1/:owner/:repo/tasks/:id/issues", middleware.AuthMiddleware(), controllers.AddIssueToTask)
	app.Delete("/api/v1/:owner/:repo/tasks/:id/issues/:issue_id", middleware.AuthMiddleware(), controllers.RemoveIssueFromTask)

	app.Get("/api/v1/:owner/:repo", middleware.OptionalAuth(), controllers.GetRepository)
	app.Put("/api/v1/:owner/:repo", middleware.AuthMiddleware(), controllers.UpdateRepository)
	app.Delete("/api/v1/:owner/:repo", middleware.AuthMiddleware(), controllers.DeleteRepository)

	app.Post("/api/v1/:owner/:repo/sync/pull", middleware.AuthMiddleware(), controllers.SyncPullRepository)
	app.Post("/api/v1/:owner/:repo/sync/push", middleware.AuthMiddleware(), controllers.SyncPushRepository)

	app.Get("/api/v1/:owner/:repo/tree", middleware.OptionalAuth(), controllers.GetRepositoryTree)
	app.Get("/api/v1/:owner/:repo/file", middleware.OptionalAuth(), controllers.GetRepositoryFile)
	app.Get("/api/v1/:owner/:repo/branches", middleware.OptionalAuth(), controllers.GetRepositoryBranches)

	app.Post("/api/v1/:owner/:repo/star", middleware.AuthMiddleware(), controllers.StarRepository)
	app.Delete("/api/v1/:owner/:repo/star", middleware.AuthMiddleware(), controllers.UnstarRepository)

	app.Post("/api/v1/:owner/:repo/watch", middleware.AuthMiddleware(), controllers.WatchRepository)
	app.Delete("/api/v1/:owner/:repo/watch", middleware.AuthMiddleware(), controllers.UnwatchRepository)

	app.Get("/api/v1/:owner/:repo/issues", controllers.ListIssues)
	app.Post("/api/v1/:owner/:repo/issues", middleware.AuthMiddleware(), controllers.CreateIssue)
	app.Get("/api/v1/:owner/:repo/issues/:number", controllers.GetIssue)
	app.Put("/api/v1/:owner/:repo/issues/:number", middleware.AuthMiddleware(), controllers.UpdateIssue)
	app.Get("/api/v1/:owner/:repo/issues/:number/comments", controllers.GetComments)
	app.Post("/api/v1/:owner/:repo/issues/:number/comments", middleware.AuthMiddleware(), controllers.CreateComment)

	app.Get("/api/v1/:owner/:repo/labels", controllers.ListLabels)

	app.Get("/api/v1/:owner/:repo/merge_requests", controllers.ListMergeRequests)
	app.Post("/api/v1/:owner/:repo/merge_requests", middleware.AuthMiddleware(), controllers.CreateMergeRequest)
	app.Get("/api/v1/:owner/:repo/merge_requests/:number", controllers.GetMergeRequest)
	app.Put("/api/v1/:owner/:repo/merge_requests/:number", middleware.AuthMiddleware(), controllers.UpdateMergeRequest)
	app.Post("/api/v1/:owner/:repo/merge_requests/:number/merge", middleware.AuthMiddleware(), controllers.MergeMergeRequest)
	app.Post("/api/v1/:owner/:repo/merge_requests/:number/close", middleware.AuthMiddleware(), controllers.CloseMergeRequest)
	app.Post("/api/v1/:owner/:repo/merge_requests/:number/reopen", middleware.AuthMiddleware(), controllers.ReopenMergeRequest)

	app.Get("/*", func(c fiber.Ctx) error {
		path := c.Path()
		if strings.HasPrefix(path, "/api/") {
			return c.Status(404).JSON(fiber.Map{"error": "API endpoint not found"})
		}
		return c.SendFile("./web/index-spa.html")
	})

	return app
}
