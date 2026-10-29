package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"os"
	"strings"
	"time"

	"github.com/VictoriaMetrics/fastcache"
	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/routes"
	"github.com/azhai/gitfolio/services"
	"github.com/azhai/gobus"
	"github.com/azhai/gobus/environ"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/compress"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/static"
)

func subFS(parent fs.FS, prefix string) fs.FS {
	fsys, err := fs.Sub(parent, prefix)
	if err != nil {
		panic(err)
	}
	return fsys
}

var (
	// The Alpine frontend is served straight from its sources; there is no
	// bundling or copy step before embedding.
	//go:embed web/pages web/assets web/public web/landing.html
	webFS    embed.FS
	pagesFS  = subFS(webFS, "web/pages")
	assetsFS = subFS(webFS, "web/assets")
	publicFS = subFS(webFS, "web/public")

	etagCacheSize = 32 * 1024 * 1024 // 32MB

	// 嵌入文件的 mtime 是零值，浏览器会把启发式新鲜度算成“还能用几十年”，
	// 发版后继续跑缓存里的旧脚本。静态响应改用启动时间做时间戳。
	processStart = time.Now()
)

func main() {
	cfg := config.Load(environ.NewEnv())
	if _, err := models.OpenDB(cfg.Database); err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer models.CloseDB()

	// Share sync progress/warning/error events across the application.
	services.SetDefaultSyncBus(gobus.NewEventBus(0))
	// Cache ETag values in memory to avoid a database round-trip per GitHub API request.
	services.SetDefaultETagCache(fastcache.New(etagCacheSize))

	if err := os.MkdirAll(cfg.Repository.Root, 0755); err != nil {
		log.Fatalf("Failed to create repository root: %v", err)
	}

	if cfg.Admin.Username == "" || cfg.Admin.Password == "" {
		log.Fatalf("Admin username or password is empty, please set them in the environment variables")
	}
	seedUsers(cfg.Admin.Username, cfg.Admin.Password)

	// 迁移旧版本遗留的本地仓库：补齐归属账号并回填落盘路径。
	if err := models.MigrateOrphanRepositories(models.GetDB(), cfg.Repository.Root); err != nil {
		log.Printf("Warning: failed to migrate orphan repositories: %v", err)
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

// pageRoutes maps public URLs to the static HTML file that renders them.
// Sub-paths (e.g. /snippets/12/edit) share one document; the page script reads
// the remaining segments from the location.
var pageRoutes = []struct{ prefix, file string }{
	{"/login", "login.html"},
	{"/home", "home.html"},
	{"/projects", "projects.html"},
	{"/groups", "groups.html"},
	{"/activity", "activity.html"},
	{"/snippets", "snippets.html"},
	{"/users", "users.html"},
	{"/admin", "admin.html"},
	{"/settings", "settings.html"},
}

// pageFor resolves a request path to a document. Anything with an owner and a
// repository segment (/owner/repo/...) is served by the project workspace shell.
func pageFor(path string) string {
	segs := strings.Split(strings.Trim(path, "/"), "/")
	isRepoPath := len(segs) >= 2 && segs[0] != "" && segs[0] != "api" && segs[0] != "uploads"

	// 先按仓库查：内置管理员账号就叫 admin，/admin/<repo> 必须落到项目页，
	// 不能被 /admin 这条页面路由吃掉。/users/azhai 之类的路径在这里查不到，
	// 自然会继续走下面的路由表。
	if isRepoPath {
		if res := helpers.FindOwnerAndRepo(segs[0], segs[1]); res != nil && res.Repo != nil {
			return "project.html"
		}
		// 账号存在但仓库不存在：同样交给项目页，由它返回 404，
		// 而不是让 /admin/<不存在的仓库> 落到管理后台。
		if helpers.HasOwner(segs[0]) {
			return "project.html"
		}
	}

	for _, route := range pageRoutes {
		if path == route.prefix || strings.HasPrefix(path, route.prefix+"/") {
			return route.file
		}
	}
	if isRepoPath {
		// 仓库不存在也交给项目页外壳，由它返回 404。
		return "project.html"
	}
	return ""
}

func CreateApp() *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:      "GitFolio",
		ErrorHandler: ErrorHandler,
	})
	app.Use(compress.New(), cors.New(), logger.New())

	landingHTML, _ := fs.ReadFile(webFS, "web/landing.html")

	assetsHandler := static.New("", static.Config{FS: assetsFS})
	publicHandler := static.New("", static.Config{FS: publicFS})
	uploadsHandler := static.New("./uploads")

	app.Get("/", func(c fiber.Ctx) error {
		c.Set("Content-Type", "text/html; charset=utf-8")
		return c.Send(landingHTML)
	})
	app.Use("/uploads", uploadsHandler)

	// Embedded files have a zero modification time, so browsers heuristically
	// treat them as fresh forever and keep running an old frontend after a
	// deploy. Require revalidation for documents and assets instead. The
	// validators are dropped too: the embedded file server answers any
	// If-Modified-Since with 304 because that zero mtime predates every date a
	// browser could send, which would hand back the stale body it cached.
	app.Use(func(c fiber.Ctx) error {
		path := c.Path()
		if strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/uploads/") {
			return c.Next()
		}
		c.Request().Header.Del(fiber.HeaderIfModifiedSince)
		c.Request().Header.Del(fiber.HeaderIfNoneMatch)
		c.Set(fiber.HeaderCacheControl, "no-cache")
		err := c.Next()
		c.Set(fiber.HeaderLastModified, processStart.UTC().Format("Mon, 02 Jan 2006 15:04:05 GMT"))
		return err
	})
	app.Use("/assets", assetsHandler)
	app.Use("/", publicHandler)

	routes.SetupAPIRoutes(app)

	app.Use(middleware.OptionalAuth())
	app.Get("/*", func(c fiber.Ctx) error {
		path := c.Path()
		if strings.HasPrefix(path, "/api/") {
			return c.Status(404).JSON(fiber.Map{"error": "API endpoint not found"})
		}
		file := pageFor(path)
		if file == "" {
			return serveNotFound(c)
		}
		// The workspace shell asks the API for the repository as soon as it
		// mounts, so only hand it out when that repository exists.
		if file == "project.html" {
			segs := strings.Split(strings.Trim(path, "/"), "/")
			if len(segs) < 2 {
				return serveNotFound(c)
			}
			if res := helpers.FindOwnerAndRepo(segs[0], segs[1]); res == nil || res.Repo == nil {
				return serveNotFound(c)
			}
		}
		body, err := fs.ReadFile(pagesFS, file)
		if err != nil {
			return serveNotFound(c)
		}
		c.Set("Content-Type", "text/html; charset=utf-8")
		return c.Send(body)
	})

	return app
}

func serveNotFound(c fiber.Ctx) error {
	body, err := fs.ReadFile(pagesFS, "404.html")
	if err != nil {
		return c.Status(fiber.StatusNotFound).SendString("Not found")
	}
	c.Set("Content-Type", "text/html; charset=utf-8")
	return c.Status(fiber.StatusNotFound).Send(body)
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
