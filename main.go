package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"os"
	"strings"
	"time"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/routes"
	"github.com/azhai/gitfolio/services"
	"github.com/azhai/goent/utils"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/compress"
	cors "github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/static"
)

//go:embed web/dist web/landing.html web/images
var efs embed.FS

func subFS(prefix string) fs.FS {
	fsys, err := fs.Sub(efs, prefix)
	if err != nil {
		panic(err)
	}
	return fsys
}

var (
	distFS    = subFS("web/dist")
	assetsFS  = subFS("web/dist/assets")
	imagesFS  = subFS("web/images")
	landingFS = subFS("web")
)

func main() {
	cfg := config.Load(utils.NewEnv())
	if _, err := models.OpenDB(cfg.Database); err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer models.CloseDB()

	if err := os.MkdirAll(cfg.Repository.Root, 0755); err != nil {
		log.Fatalf("Failed to create repository root: %v", err)
	}

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
		AppName:       "GitFolio",
		ReadTimeout:   30 * time.Second,
		WriteTimeout:  30 * time.Second,
		StrictRouting: true,
		ErrorHandler:  ErrorHandler,
	})
	app.Use(compress.New(), cors.New(), logger.New())

	landingHTML, _ := fs.ReadFile(landingFS, "landing.html")
	spaIndex, _ := fs.ReadFile(distFS, "index.html")

	assetsHandler := static.New("", static.Config{FS: assetsFS})
	imagesHandler := static.New("", static.Config{FS: imagesFS})
	uploadsHandler := static.New("./uploads")

	app.Get("/", func(c fiber.Ctx) error {
		c.Set("Content-Type", "text/html; charset=utf-8")
		return c.Send(landingHTML)
	})
	app.Get("/assets/*", assetsHandler)
	app.Get("/images/*", imagesHandler)
	app.Get("/uploads/*", uploadsHandler)

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
