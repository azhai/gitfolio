package routes

import (
	"strings"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/handlers"
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

	setupAPIRoutes(app)

	app.Get("/*", func(c fiber.Ctx) error {
		path := c.Path()
		if strings.HasPrefix(path, "/api/") {
			return c.Status(404).JSON(fiber.Map{"error": "API endpoint not found"})
		}
		return c.SendFile("./web/index-spa.html")
	})

	return app
}

func setupAPIRoutes(app *fiber.App) {
	api := app.Group(config.APIBaseURL)

	api.Get("/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	api.Get("/stats", handlers.GetStats)

	api.Post("/auth/register", handlers.Register)
	api.Post("/auth/login", handlers.Login)
	api.Post("/auth/logout", handlers.Logout)

	api.Get("/user/me", middleware.AuthMiddleware(), handlers.GetCurrentUser)
	api.Put("/user/me", middleware.AuthMiddleware(), handlers.UpdateUser)

	api.Get("/users/:username", middleware.OptionalAuth(), handlers.GetUser)
	api.Get("/users/:username/repos", middleware.OptionalAuth(), handlers.GetUserRepositories)

	api.Get("/repos", middleware.OptionalAuth(), handlers.ListRepositories)
	api.Post("/repos", middleware.AuthMiddleware(), handlers.CreateRepository)
	api.Get("/repos/github-info", handlers.GetGitHubRepoInfo)

	api.Get("/groups", handlers.ListGroups)
	api.Post("/groups", middleware.AuthMiddleware(), handlers.CreateGroup)
	api.Get("/groups/:name", handlers.GetGroup)

	api.Get("/activities", handlers.ListActivities)
	api.Post("/activities", middleware.AuthMiddleware(), handlers.CreateActivity)

	api.Get("/snippets", handlers.ListSnippets)
	api.Post("/snippets", middleware.AuthMiddleware(), handlers.CreateSnippet)
	api.Get("/snippets/:id", handlers.GetSnippet)
	api.Put("/snippets/:id", middleware.AuthMiddleware(), handlers.UpdateSnippet)
	api.Delete("/snippets/:id", middleware.AuthMiddleware(), handlers.DeleteSnippet)

	setupRepositoryRoutes(api)
}

func setupRepositoryRoutes(api fiber.Router) {
	repo := api.Group("/:owner/:repo")

	repo.Get("", middleware.OptionalAuth(), handlers.GetRepository)
	repo.Put("", middleware.AuthMiddleware(), handlers.UpdateRepository)
	repo.Delete("", middleware.AuthMiddleware(), handlers.DeleteRepository)

	repo.Get("/tasks", handlers.ListTasks)
	repo.Post("/tasks", middleware.AuthMiddleware(), handlers.CreateTask)
	repo.Get("/tasks/:id", handlers.GetTask)
	repo.Put("/tasks/:id", middleware.AuthMiddleware(), handlers.UpdateTask)
	repo.Delete("/tasks/:id", middleware.AuthMiddleware(), handlers.DeleteTask)
	repo.Post("/tasks/:id/attachments", middleware.AuthMiddleware(), handlers.UploadTaskAttachment)
	repo.Delete("/tasks/:id/attachments/:attachment_id", middleware.AuthMiddleware(), handlers.DeleteTaskAttachment)
	repo.Post("/tasks/:id/issues", middleware.AuthMiddleware(), handlers.AddIssueToTask)
	repo.Delete("/tasks/:id/issues/:issue_id", middleware.AuthMiddleware(), handlers.RemoveIssueFromTask)

	repo.Post("/sync/pull", middleware.AuthMiddleware(), handlers.SyncPullRepository)
	repo.Post("/sync/push", middleware.AuthMiddleware(), handlers.SyncPushRepository)

	repo.Get("/tree", middleware.OptionalAuth(), handlers.GetRepositoryTree)
	repo.Get("/file", middleware.OptionalAuth(), handlers.GetRepositoryFile)
	repo.Get("/branches", middleware.OptionalAuth(), handlers.GetRepositoryBranches)
	repo.Get("/contributors", middleware.OptionalAuth(), handlers.GetRepositoryContributors)

	repo.Post("/star", middleware.AuthMiddleware(), handlers.StarRepository)
	repo.Delete("/star", middleware.AuthMiddleware(), handlers.UnstarRepository)

	repo.Post("/watch", middleware.AuthMiddleware(), handlers.WatchRepository)
	repo.Delete("/watch", middleware.AuthMiddleware(), handlers.UnwatchRepository)

	repo.Get("/issues", handlers.ListIssues)
	repo.Post("/issues", middleware.AuthMiddleware(), handlers.CreateIssue)
	repo.Get("/issues/:number", handlers.GetIssue)
	repo.Put("/issues/:number", middleware.AuthMiddleware(), handlers.UpdateIssue)
	repo.Get("/issues/:number/comments", handlers.GetComments)
	repo.Post("/issues/:number/comments", middleware.AuthMiddleware(), handlers.CreateComment)

	repo.Get("/labels", handlers.ListLabels)

	repo.Get("/pull_requests", handlers.ListPullRequests)
	repo.Post("/pull_requests", middleware.AuthMiddleware(), handlers.CreatePullRequest)
	repo.Get("/pull_requests/:number", handlers.GetPullRequest)
	repo.Put("/pull_requests/:number", middleware.AuthMiddleware(), handlers.UpdatePullRequest)
	repo.Post("/pull_requests/:number/merge", middleware.AuthMiddleware(), handlers.MergePullRequest)
	repo.Post("/pull_requests/:number/close", middleware.AuthMiddleware(), handlers.ClosePullRequest)
	repo.Post("/pull_requests/:number/reopen", middleware.AuthMiddleware(), handlers.ReopenPullRequest)
}
