package middleware

import (
	"strings"
	"time"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

// Claims JWT 令牌的自定义声明
type Claims struct {
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	IsAdmin  bool   `json:"is_admin"`
	jwt.RegisteredClaims
}

// GenerateToken 为用户生成 JWT 令牌，有效期 24 小时
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
	return token.SignedString([]byte(config.GetJWTSecret()))
}

// AuthMiddleware 要求请求携带有效 JWT 令牌，否则返回 401
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

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
			return []byte(config.GetJWTSecret()), nil
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

// OptionalAuth 可选认证中间件，令牌有效时注入用户信息，无效时继续放行
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

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
			return []byte(config.GetJWTSecret()), nil
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

// AdminOnly 要求当前用户为管理员，否则返回 403
func AdminOnly() fiber.Handler {
	return func(c fiber.Ctx) error {
		isAdmin := c.Locals("is_admin")
		if isAdmin == nil || !isAdmin.(bool) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Admin access required"})
		}
		return c.Next()
	}
}

// GetCurrentUser 从上下文中获取当前登录用户
func GetCurrentUser(c fiber.Ctx) (*models.User, error) {
	userID := c.Locals("user_id")
	if userID == nil {
		return nil, nil
	}

	db := models.GetDB()

	user, err := db.User.Select().Where("id = ?", userID.(int64)).One()
	if err != nil {
		return nil, err
	}

	return user, nil
}

// GetCurrentUserID 从上下文中获取当前登录用户 ID，未登录返回 0
func GetCurrentUserID(c fiber.Ctx) int64 {
	userID := c.Locals("user_id")
	if userID == nil {
		return 0
	}
	return userID.(int64)
}
