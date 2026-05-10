package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"
)

func setupTestApp(handler fiber.Handler, role string, userID int64) *fiber.App {
	app := fiber.New()
	app.Use(func(c fiber.Ctx) error {
		if role != "" {
			c.Locals("role", role)
		}
		if userID != 0 {
			c.Locals("user_id", userID)
		}
		return c.Next()
	})
	app.Use(handler)
	app.Get("/test", func(c fiber.Ctx) error {
		return c.SendString("ok")
	})
	return app
}

func TestGuestReadOnly(t *testing.T) {
	tests := []struct {
		name       string
		role       string
		userID     int64
		wantStatus int
	}{
		{"guest is blocked", "guest", 1, fiber.StatusForbidden},
		{"user passes", "user", 1, fiber.StatusOK},
		{"admin passes", "admin", 1, fiber.StatusOK},
		{"leader passes", "leader", 1, fiber.StatusOK},
		{"no role passes", "", 0, fiber.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := setupTestApp(GuestReadOnly(), tt.role, tt.userID)
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			resp, err := app.Test(req)
			if err != nil {
				t.Fatalf("app.Test() error = %v", err)
			}
			if resp.StatusCode != tt.wantStatus {
				t.Errorf("GuestReadOnly() status = %v, want %v", resp.StatusCode, tt.wantStatus)
			}
		})
	}
}

func TestAdminOnly(t *testing.T) {
	tests := []struct {
		name       string
		role       string
		userID     int64
		wantStatus int
	}{
		{"admin passes", "admin", 1, fiber.StatusOK},
		{"user blocked", "user", 1, fiber.StatusForbidden},
		{"guest blocked", "guest", 1, fiber.StatusForbidden},
		{"leader blocked", "leader", 1, fiber.StatusForbidden},
		{"no role blocked", "", 0, fiber.StatusForbidden},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := setupTestApp(AdminOnly(), tt.role, tt.userID)
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			resp, err := app.Test(req)
			if err != nil {
				t.Fatalf("app.Test() error = %v", err)
			}
			if resp.StatusCode != tt.wantStatus {
				t.Errorf("AdminOnly() status = %v, want %v", resp.StatusCode, tt.wantStatus)
			}
		})
	}
}

func TestLeaderOrAdmin(t *testing.T) {
	tests := []struct {
		name       string
		role       string
		userID     int64
		wantStatus int
	}{
		{"admin passes", "admin", 1, fiber.StatusOK},
		{"leader passes", "leader", 1, fiber.StatusOK},
		{"user blocked", "user", 1, fiber.StatusForbidden},
		{"guest blocked", "guest", 1, fiber.StatusForbidden},
		{"no role blocked", "", 0, fiber.StatusForbidden},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := setupTestApp(LeaderOrAdmin(), tt.role, tt.userID)
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			resp, err := app.Test(req)
			if err != nil {
				t.Fatalf("app.Test() error = %v", err)
			}
			if resp.StatusCode != tt.wantStatus {
				t.Errorf("LeaderOrAdmin() status = %v, want %v", resp.StatusCode, tt.wantStatus)
			}
		})
	}
}

func TestGetCurrentUserID(t *testing.T) {
	tests := []struct {
		name   string
		userID int64
		want   int64
	}{
		{"returns user ID", 42, 42},
		{"returns 0 when not set", 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := fiber.New()
			var got int64
			app.Use(func(c fiber.Ctx) error {
				if tt.userID != 0 {
					c.Locals("user_id", tt.userID)
				}
				got = GetCurrentUserID(c)
				return c.Next()
			})
			app.Get("/test", func(c fiber.Ctx) error {
				return c.SendString("ok")
			})
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			_, _ = app.Test(req)
			if got != tt.want {
				t.Errorf("GetCurrentUserID() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestGetCurrentUserRole(t *testing.T) {
	tests := []struct {
		name string
		role string
		want string
	}{
		{"returns role", "admin", "admin"},
		{"returns empty when not set", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := fiber.New()
			var got string
			app.Use(func(c fiber.Ctx) error {
				if tt.role != "" {
					c.Locals("role", tt.role)
				}
				got = GetCurrentUserRole(c)
				return c.Next()
			})
			app.Get("/test", func(c fiber.Ctx) error {
				return c.SendString("ok")
			})
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			_, _ = app.Test(req)
			if got != tt.want {
				t.Errorf("GetCurrentUserRole() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsCurrentUserAdmin(t *testing.T) {
	tests := []struct {
		name string
		role string
		want bool
	}{
		{"admin is admin", "admin", true},
		{"user is not admin", "user", false},
		{"guest is not admin", "guest", false},
		{"leader is not admin", "leader", false},
		{"no role is not admin", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := fiber.New()
			var got bool
			app.Use(func(c fiber.Ctx) error {
				if tt.role != "" {
					c.Locals("role", tt.role)
				}
				got = IsCurrentUserAdmin(c)
				return c.Next()
			})
			app.Get("/test", func(c fiber.Ctx) error {
				return c.SendString("ok")
			})
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			_, _ = app.Test(req)
			if got != tt.want {
				t.Errorf("IsCurrentUserAdmin() = %v, want %v", got, tt.want)
			}
		})
	}
}
