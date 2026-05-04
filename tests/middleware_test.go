package tests

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

func TestGenerateToken(t *testing.T) {
	user := &models.User{
		ID:       1,
		Username: "testuser",
		Email:    "test@example.com",
		IsAdmin:  false,
	}

	token, err := middleware.GenerateToken(user)
	if err != nil {
		t.Errorf("Failed to generate token: %v", err)
	}

	if token == "" {
		t.Error("Token is empty")
	}
}

func TestAuthMiddleware(t *testing.T) {
	tests := []struct {
		name       string
		setupAuth  func(req *http.Request)
		wantStatus int
	}{
		{
			name: "Valid token",
			setupAuth: func(req *http.Request) {
				user := &models.User{
					ID:       1,
					Username: "testuser",
					Email:    "test@example.com",
					IsAdmin:  false,
				}
				token, _ := middleware.GenerateToken(user)
				req.Header.Set("Authorization", "Bearer "+token)
			},
			wantStatus: http.StatusOK,
		},
		{
			name: "Missing authorization header",
			setupAuth: func(req *http.Request) {
			},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name: "Invalid authorization format",
			setupAuth: func(req *http.Request) {
				req.Header.Set("Authorization", "InvalidFormat")
			},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name: "Invalid token",
			setupAuth: func(req *http.Request) {
				req.Header.Set("Authorization", "Bearer invalid-token")
			},
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := fiber.New()
			app.Use(middleware.AuthMiddleware())
			app.Get("/test", func(c fiber.Ctx) error {
				return c.JSON(fiber.Map{"message": "success"})
			})

			req := httptest.NewRequest("GET", "/test", nil)
			tt.setupAuth(req)

			resp, _ := app.Test(req)
			AssertStatus(t, tt.wantStatus, resp.StatusCode)
		})
	}
}

func TestOptionalAuth(t *testing.T) {
	app := fiber.New()
	app.Use(middleware.OptionalAuth())
	app.Get("/test", func(c fiber.Ctx) error {
		userID := c.Locals("user_id")
		if userID != nil {
			return c.JSON(fiber.Map{"user_id": userID})
		}
		return c.JSON(fiber.Map{"message": "no auth"})
	})

	t.Run("With valid token", func(t *testing.T) {
		user := &models.User{
			ID:       1,
			Username: "testuser",
			Email:    "test@example.com",
		}
		token, _ := middleware.GenerateToken(user)

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+token)

		resp, _ := app.Test(req)
		AssertStatus(t, http.StatusOK, resp.StatusCode)
		AssertJSONHasKey(t, ReadBody(resp), "user_id")
	})

	t.Run("Without token", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)

		resp, _ := app.Test(req)
		AssertStatus(t, http.StatusOK, resp.StatusCode)
		AssertJSONHasKey(t, ReadBody(resp), "message")
	})
}

func TestAdminOnly(t *testing.T) {
	tests := []struct {
		name       string
		isAdmin    bool
		wantStatus int
	}{
		{
			name:       "Admin user",
			isAdmin:    true,
			wantStatus: http.StatusOK,
		},
		{
			name:       "Non-admin user",
			isAdmin:    false,
			wantStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := fiber.New()
			app.Use(func(c fiber.Ctx) error {
				c.Locals("user_id", int64(1))
				c.Locals("is_admin", tt.isAdmin)
				return c.Next()
			})
			app.Use(middleware.AdminOnly())
			app.Get("/admin", func(c fiber.Ctx) error {
				return c.JSON(fiber.Map{"message": "admin access"})
			})

			req := httptest.NewRequest("GET", "/admin", nil)
			resp, _ := app.Test(req)
			AssertStatus(t, tt.wantStatus, resp.StatusCode)
		})
	}
}

func TestTokenExpiration(t *testing.T) {
	claims := &middleware.Claims{
		UserID:   1,
		Username: "testuser",
		Email:    "test@example.com",
		IsAdmin:  false,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString([]byte(config.GetJWTSecret()))

	app := fiber.New()
	app.Use(middleware.AuthMiddleware())
	app.Get("/test", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "success"})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)

	resp, _ := app.Test(req)
	AssertStatus(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestGetCurrentUserID(t *testing.T) {
	t.Run("With user ID in context", func(t *testing.T) {
		app := fiber.New()
		app.Use(func(c fiber.Ctx) error {
			c.Locals("user_id", int64(123))
			return c.Next()
		})
		app.Get("/test", func(c fiber.Ctx) error {
			userID := middleware.GetCurrentUserID(c)
			return c.JSON(fiber.Map{"user_id": userID})
		})

		req := httptest.NewRequest("GET", "/test", nil)
		resp, _ := app.Test(req)
		AssertStatus(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Without user ID in context", func(t *testing.T) {
		app := fiber.New()
		app.Get("/test", func(c fiber.Ctx) error {
			userID := middleware.GetCurrentUserID(c)
			return c.JSON(fiber.Map{"user_id": userID})
		})

		req := httptest.NewRequest("GET", "/test", nil)
		resp, _ := app.Test(req)
		AssertStatus(t, http.StatusOK, resp.StatusCode)
	})
}
