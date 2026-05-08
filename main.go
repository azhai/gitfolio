package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"os"
	"strings"
	"time"

	"github.com/azhai/gitfolio/cmd/seed"
	"github.com/azhai/gitfolio/config"
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

func getEmbedFS(prefix string) fs.FS {
	if prefix == "" {
		return efs
	}
	fsys, err := fs.Sub(efs, prefix)
	if err != nil {
		panic(err)
	}
	return fsys
}

func main() {
	cfg := config.Load(utils.NewEnv())
	if _, err := models.OpenDB(cfg.Database); err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer models.CloseDB()
	seed.SeedUsers()
	user, token := config.GetUserToken()
	seed.AddGithubToken(user, token)

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

// CreateApp 创建并配置 Fiber 应用，注册所有路由
func CreateApp() *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:       "Weekly Admin API",
		ReadTimeout:   30 * time.Second,
		WriteTimeout:  30 * time.Second,
		StrictRouting: true,
		ErrorHandler:  ErrorHandler,
	})
	app.Use(compress.New(), cors.New(), logger.New())

	routes.SetupStaticFiles(app)
	routes.SetupAPIRoutes(app)

	// app.Use("/images", static.New("./images"))
	// embedCfg := static.Config{FS: getEmbedFS("public")}
	// app.Get("/*", static.New("./public", embedCfg))

	// app.Get("/*", static.New("./web/public"))

	staticHandler := static.New("./web/public")
	app.Get("/*", func(c fiber.Ctx) error {
		path := c.Path()
		if strings.HasPrefix(path, "/api/") {
			return c.Status(404).JSON(fiber.Map{"error": "API endpoint not found"})
		}
		if strings.HasSuffix(path, ".svg") || strings.HasSuffix(path, ".png") {
			return staticHandler(c)
		}
		return c.SendFile("./web/dist/index.html")
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
