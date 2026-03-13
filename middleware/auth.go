package middleware

import (
	"strings"
	"time"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/database"
	"github.com/azhai/gitfolio/models"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	IsAdmin  bool   `json:"is_admin"`
	jwt.RegisteredClaims
}

func GenerateToken(user *models.User) (string, error) {
	claims := Claims{
		UserID:   user.ID,
		Username: user.Username,
		Email:    user.Email,
		IsAdmin:  user.IsAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.Auth.JWTSecret))
}

func AuthMiddleware() fiber.Handler {
	return func(c fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Authorization header required"})
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid authorization header format"})
		}

		tokenString := parts[1]
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(config.AppConfig.Auth.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid token"})
		}

		c.Locals("user_id", claims.UserID)
		c.Locals("username", claims.Username)
		c.Locals("email", claims.Email)
		c.Locals("is_admin", claims.IsAdmin)

		return c.Next()
	}
}

func OptionalAuth() fiber.Handler {
	return func(c fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Next()
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			return c.Next()
		}

		tokenString := parts[1]
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(config.AppConfig.Auth.JWTSecret), nil
		})

		if err == nil && token.Valid {
			c.Locals("user_id", claims.UserID)
			c.Locals("username", claims.Username)
			c.Locals("email", claims.Email)
			c.Locals("is_admin", claims.IsAdmin)
		}

		return c.Next()
	}
}

func AdminOnly() fiber.Handler {
	return func(c fiber.Ctx) error {
		isAdmin := c.Locals("is_admin")
		if isAdmin == nil || !isAdmin.(bool) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Admin access required"})
		}
		return c.Next()
	}
}

func GetCurrentUser(c fiber.Ctx) (*models.User, error) {
	userID := c.Locals("user_id")
	if userID == nil {
		return nil, nil
	}

	db := database.GetDB()

	user, err := db.User.Select().Where("id = ?", userID.(uint)).One()
	if err != nil {
		return nil, err
	}

	return user, nil
}

func GetCurrentUserID(c fiber.Ctx) uint {
	userID := c.Locals("user_id")
	if userID == nil {
		return 0
	}
	return userID.(uint)
}
