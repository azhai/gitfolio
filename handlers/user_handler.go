package handlers

import (
	"strconv"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/gofiber/fiber/v3"
)

type RegisterRequest struct {
	Username string `json:"username" validate:"required,min=3,max=64"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
}

type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type UpdateUserRequest struct {
	FullName string `json:"full_name"`
	Bio      string `json:"bio"`
	Website  string `json:"website"`
	Location string `json:"location"`
}

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
	IsAdmin   bool   `json:"is_admin"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

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
		IsAdmin:   user.IsAdmin,
		CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt: user.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func Register(c fiber.Ctx) error {
	var req RegisterRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := models.GetDB()

	existingUser, _ := db.User.Select().Where("username = ?", req.Username).One()
	if existingUser != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Username already exists"})
	}

	existingUser, _ = db.User.Select().Where("email = ?", req.Email).One()
	if existingUser != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Email already exists"})
	}

	userModel := &models.User{
		Username: req.Username,
		Email:    req.Email,
	}

	if err := userModel.SetPassword(req.Password); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to hash password"})
	}

	err := db.User.Insert().One(userModel)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create user"})
	}

	token, err := middleware.GenerateToken(userModel)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"user":  ToUserResponse(userModel),
		"token": token,
	})
}

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

func GetUser(c fiber.Ctx) error {
	username := c.Params("username")

	db := models.GetDB()

	userModel, err := db.User.Select().Where("username = ?", username).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	return c.Status(fiber.StatusOK).JSON(ToUserResponse(userModel))
}

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

	query := db.Repository.Select().Where("owner_id = ?", userModel.ID)
	currentUserID := middleware.GetCurrentUserID(c)
	if currentUserID != userModel.ID {
		query = query.Where("is_private = ?", false)
	}

	repos, err := query.Skip((page - 1) * perPage).Take(perPage).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch repositories"})
	}

	return c.Status(fiber.StatusOK).JSON(repos)
}

func Logout(c fiber.Ctx) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Logged out successfully"})
}
