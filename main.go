package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"os"
	"strings"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/routes"
	"github.com/azhai/gitfolio/services"
	"github.com/azhai/goent/utils"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/compress"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/static"
)

//go:embed web/dist
var efs embed.FS

func subFS(prefix string) fs.FS {
	fsys, err := fs.Sub(efs, prefix)
	if err != nil {
		panic(err)
	}
	return fsys
}

var distFS = subFS("web/dist")

func main() {
	cfg := config.Load(utils.NewEnv())
	if _, err := models.OpenDB(cfg.Database); err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer models.CloseDB()

	if err := os.MkdirAll(cfg.Repository.Root, 0755); err != nil {
		log.Fatalf("Failed to create repository root: %v", err)
	}

	if cfg.Admin.Username == "" || cfg.Admin.Password == "" {
		log.Fatalf("Admin username or password is empty, please set them in the environment variables")
	}
	seedUsers(cfg.Admin.Username, cfg.Admin.Password)

	app := CreateApp()
	scheduler := services.NewSchedulerService(models.GetDB())
	scheduler.Start()
	defer scheduler.Stop()

	port, url := config.GetServerInfo()
	addr := fmt.Sprintf(":%d", port)
	log.Printf("Server starting on %s", addr)
	log.Printf("Visit %s", url)

	if err := app.Listen(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func CreateApp() *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:      "GitFolio",
		ErrorHandler: ErrorHandler,
	})
	app.Use(compress.New(), cors.New(), logger.New())

	spaIndex, _ := fs.ReadFile(distFS, "index.html")
	landingHTML, _ := fs.ReadFile(distFS, "landing.html")

	distHandler := static.New("", static.Config{FS: distFS})
	uploadsHandler := static.New("./uploads")

	app.Get("/", func(c fiber.Ctx) error {
		c.Set("Content-Type", "text/html; charset=utf-8")
		return c.Send(landingHTML)
	})
	app.Use("/uploads", uploadsHandler)
	app.Use("/", distHandler)

	routes.SetupAPIRoutes(app)

	app.Use(middleware.OptionalAuth())
	app.Get("/*", func(c fiber.Ctx) error {
		path := c.Path()
		if strings.HasPrefix(path, "/api/") {
			return c.Status(404).JSON(fiber.Map{"error": "API endpoint not found"})
		}
		c.Set("Content-Type", "text/html; charset=utf-8")
		return c.Send(spaIndex)
	})

	return app
}

func ErrorHandler(c fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	msg := "Internal Server Error"
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
		msg = e.Message
	}
	return c.Status(code).JSON(fiber.Map{"error": msg})
}

func seedUsers(username, password string) {
	db := models.GetDB()

	users := []struct {
		Email    string
		Username string
		Password string
		FullName string
		Role     string
	}{
		{"admin@gitfolio.local", username, password, "管理员", "admin"},
		{"demo@gitfolio.local", "demo", "demo123", "游客", "guest"},
	}

	for _, u := range users {
		existing, err := db.User.Select().Where("username = ?", u.Username).One()
		if err == nil && existing != nil {
			if existing.Role != u.Role {
				existing.Role = u.Role
				if saveErr := db.User.Save().One(existing); saveErr != nil {
					log.Printf("Failed to update role for %s: %v", u.Username, saveErr)
				} else {
					log.Printf("Updated role for %s: %s", u.Username, u.Role)
				}
			}
			continue
		}

		user := &models.User{
			Username: u.Username,
			Email:    u.Email,
			FullName: u.FullName,
			IsActive: true,
			Role:     u.Role,
		}
		if err := user.SetPassword(u.Password); err != nil {
			log.Printf("Failed to set password for %s: %v", u.Username, err)
			continue
		}

		if err := db.User.Save().One(user); err != nil {
			log.Printf("Failed to seed user %s: %v", u.Username, err)
		} else {
			log.Printf("Seeded user: %s (role: %s)", u.Username, u.Role)
		}
	}
}
