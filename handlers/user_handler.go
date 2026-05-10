package handlers

import (
	"strconv"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/gofiber/fiber/v3"
)

// LoginRequest 登录请求
type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

// UpdateUserRequest 更新用户信息请求
type UpdateUserRequest struct {
	FullName string `json:"full_name"`
	Bio      string `json:"bio"`
	Website  string `json:"website"`
	Location string `json:"location"`
}

// UserResponse 用户信息响应
type UserResponse struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	Email     string `json:"email,omitempty"`
	FullName  string `json:"full_name"`
	Avatar    string `json:"avatar"`
	AvatarURL string `json:"avatar_url"`
	Bio       string `json:"bio"`
	Website   string `json:"website"`
	Location  string `json:"location"`
	IsActive  bool   `json:"is_active"`
	Role      string `json:"role"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// ToUserResponse 将用户模型转换为 API 响应，无头像时使用占位图
func ToUserResponse(user *models.User) *UserResponse {
	avatarURL := user.Avatar
	if avatarURL == "" {
		avatarURL = "https://via.placeholder.com/32?text=" + string(user.Username[0])
	}
	return &UserResponse{
		ID:        user.ID,
		Username:  user.Username,
		Email:     user.Email,
		FullName:  user.FullName,
		Avatar:    user.Avatar,
		AvatarURL: avatarURL,
		Bio:       user.Bio,
		Website:   user.Website,
		Location:  user.Location,
		IsActive:  user.IsActive,
		Role:      user.Role,
		CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt: user.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// Login 用户登录，验证凭据后返回 JWT 令牌
func Login(c fiber.Ctx) error {
	var req LoginRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := models.GetDB()

	userModel, err := db.User.Select().Where("username = ? OR email = ?", req.Username, req.Username).One()
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	if !userModel.CheckPassword(req.Password) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	if !userModel.IsActive {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Account is deactivated"})
	}

	token, err := middleware.GenerateToken(userModel)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"user":  ToUserResponse(userModel),
		"token": token,
	})
}

// GetCurrentUser 获取当前登录用户信息
func GetCurrentUser(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Not authenticated"})
	}

	db := models.GetDB()

	userModel, err := db.User.Select().Where("id = ?", userID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	return c.Status(fiber.StatusOK).JSON(ToUserResponse(userModel))
}

// GetUser 根据用户名获取用户公开信息
func GetUser(c fiber.Ctx) error {
	username := c.Params("username")

	db := models.GetDB()

	userModel, err := db.User.Select().Where("username = ?", username).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	return c.Status(fiber.StatusOK).JSON(ToUserResponse(userModel))
}

// UpdateUser 更新当前登录用户的个人信息
func UpdateUser(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)
	var req UpdateUserRequest

	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := models.GetDB()

	userModel, err := db.User.Select().Where("id = ?", userID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	if req.FullName != "" {
		userModel.FullName = req.FullName
	}
	if req.Bio != "" {
		userModel.Bio = req.Bio
	}
	if req.Website != "" {
		userModel.Website = req.Website
	}
	if req.Location != "" {
		userModel.Location = req.Location
	}

	err = db.User.Save().One(userModel)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update user"})
	}

	return c.Status(fiber.StatusOK).JSON(ToUserResponse(userModel))
}

// UpdateUserByUsername 管理员根据用户名更新用户信息
func UpdateUserByUsername(c fiber.Ctx) error {
	currentUserID := middleware.GetCurrentUserID(c)
	targetUsername := c.Params("username")

	var req struct {
		FullName string `json:"full_name"`
		Bio      string `json:"bio"`
		Website  string `json:"website"`
		Location string `json:"location"`
		Avatar   string `json:"avatar"`
		IsActive *bool  `json:"is_active"`
		Role     string `json:"role"`
	}

	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := models.GetDB()

	currentUser, err := db.User.Select().Where("id = ?", currentUserID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Current user not found"})
	}

	targetUser, err := db.User.Select().Where("username = ?", targetUsername).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Target user not found"})
	}

	if currentUser.Role != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only admins can update other users"})
	}

	if req.FullName != "" {
		targetUser.FullName = req.FullName
	}
	if req.Bio != "" {
		targetUser.Bio = req.Bio
	}
	if req.Website != "" {
		targetUser.Website = req.Website
	}
	if req.Location != "" {
		targetUser.Location = req.Location
	}
	if req.Avatar != "" {
		targetUser.Avatar = req.Avatar
	}
	if req.IsActive != nil {
		targetUser.IsActive = *req.IsActive
	}
	if req.Role != "" {
		targetUser.Role = req.Role
	}

	err = db.User.Save().One(targetUser)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update user"})
	}

	return c.Status(fiber.StatusOK).JSON(ToUserResponse(targetUser))
}

// GetUserRepositories 获取指定用户的仓库列表，非本人仅返回公开仓库
func GetUserRepositories(c fiber.Ctx) error {
	username := c.Params("username")
	page, _ := strconv.Atoi(c.Query("page", strconv.Itoa(config.DefaultPage)))
	perPage, _ := strconv.Atoi(c.Query("per_page", strconv.Itoa(config.DefaultPerPage)))
	if perPage > config.MaxPerPage {
		perPage = config.MaxPerPage
	}

	db := models.GetDB()

	userModel, err := db.User.Select().Where("username = ?", username).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	query := db.Repository.Select().Where("owner_id = ? AND owner_type = 'user'", userModel.ID)
	currentUserID := middleware.GetCurrentUserID(c)
	role := middleware.GetCurrentUserRole(c)
	if currentUserID != userModel.ID && role != "admin" && role != "guest" {
		query = query.Where("project_type = ?", "local")
	}

	repos, err := query.Skip((page - 1) * perPage).Take(perPage).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch repositories"})
	}

	response := make([]*RepositoryResponse, 0)
	for _, repo := range repos {
		response = append(response, ToRepositoryResponse(repo, userModel, nil))
	}

	return c.Status(fiber.StatusOK).JSON(response)
}

// ListUsers 获取所有用户列表
func ListUsers(c fiber.Ctx) error {
	db := models.GetDB()

	users, err := db.User.Select().All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch users"})
	}

	response := make([]*UserResponse, 0)
	for _, user := range users {
		response = append(response, ToUserResponse(user))
	}

	return c.Status(fiber.StatusOK).JSON(response)
}

// ChangePasswordRequest 修改密码请求
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=6"`
}

// ChangePassword 修改当前用户密码
func ChangePassword(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Not authenticated"})
	}

	var req ChangePasswordRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := models.GetDB()

	userModel, err := db.User.Select().Where("id = ?", userID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	if !userModel.CheckPassword(req.OldPassword) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Current password is incorrect"})
	}

	if err := userModel.SetPassword(req.NewPassword); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update password"})
	}

	err = db.User.Save().One(userModel)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save user"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Password changed successfully"})
}

// Logout 用户登出
func Logout(c fiber.Ctx) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Logged out successfully"})
}
