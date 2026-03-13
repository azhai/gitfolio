package routes

import (
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
		return c.SendFile("./web/index.html")
	})
	app.Get("/projects", func(c fiber.Ctx) error {
		return c.SendFile("./web/projects.html")
	})
	app.Get("/project-detail", func(c fiber.Ctx) error {
		return c.SendFile("./web/project-detail.html")
	})
	app.Get("/issues", func(c fiber.Ctx) error {
		return c.SendFile("./web/issues.html")
	})

	app.Get("/static/*", func(c fiber.Ctx) error {
		return c.SendFile("./web/" + c.Params("*"))
	})

	api := app.Group("/api/v1")
	{
		api.Get("/health", func(c fiber.Ctx) error {
			return c.JSON(fiber.Map{"status": "ok"})
		})

		auth := api.Group("/auth")
		{
			auth.Post("/register", controllers.Register)
			auth.Post("/login", controllers.Login)
		}

		user := api.Group("/user")
		{
			user.Get("/me", middleware.AuthMiddleware(), controllers.GetCurrentUser)
			user.Put("/me", middleware.AuthMiddleware(), controllers.UpdateUser)
		}

		users := api.Group("/users")
		{
			users.Get("/:username", middleware.OptionalAuth(), controllers.GetUser)
			users.Get("/:username/repos", middleware.OptionalAuth(), controllers.GetUserRepositories)
		}

		repos := api.Group("/repos")
		{
			repos.Get("", middleware.OptionalAuth(), controllers.ListRepositories)
			repos.Post("", middleware.AuthMiddleware(), controllers.CreateRepository)
		}

		repo := api.Group("/:owner/:repo")
		{
			repo.Get("", middleware.OptionalAuth(), controllers.GetRepository)
			repo.Put("", middleware.AuthMiddleware(), controllers.UpdateRepository)
			repo.Delete("", middleware.AuthMiddleware(), controllers.DeleteRepository)

			repo.Post("/star", middleware.AuthMiddleware(), controllers.StarRepository)
			repo.Delete("/star", middleware.AuthMiddleware(), controllers.UnstarRepository)
			repo.Post("/watch", middleware.AuthMiddleware(), controllers.WatchRepository)
			repo.Delete("/watch", middleware.AuthMiddleware(), controllers.UnwatchRepository)

			issues := repo.Group("/issues")
			{
				issues.Get("", controllers.ListIssues)
				issues.Post("", middleware.AuthMiddleware(), controllers.CreateIssue)
				issues.Get("/:number", controllers.GetIssue)
				issues.Put("/:number", middleware.AuthMiddleware(), controllers.UpdateIssue)

				issues.Get("/:number/comments", controllers.GetComments)
				issues.Post("/:number/comments", middleware.AuthMiddleware(), controllers.CreateComment)
			}
		}
	}

	app.Use(func(c fiber.Ctx) error {
		return c.SendFile("./web/index.html")
	})

	return app
}
