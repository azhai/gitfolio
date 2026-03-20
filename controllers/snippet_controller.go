package controllers

import (
	"strconv"
	"time"

	"github.com/azhai/gitfolio/database"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/gofiber/fiber/v3"
)

type SnippetResponse struct {
	ID          uint   `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Language    string `json:"language"`
	Code        string `json:"code"`
	Visibility  string `json:"visibility"`
	UserID      *uint  `json:"user_id"`
	Username    string `json:"username"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

func ToSnippetResponse(snippet *models.Snippet, username string) *SnippetResponse {
	return &SnippetResponse{
		ID:          snippet.ID,
		Title:       snippet.Title,
		Description: snippet.Description,
		Language:    snippet.Language,
		Code:        snippet.Code,
		Visibility:  snippet.Visibility,
		UserID:      snippet.UserID,
		Username:    username,
		CreatedAt:   snippet.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   snippet.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func ListSnippets(c fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "30"))
	language := c.Query("language")
	visibility := c.Query("visibility", "public")

	db := database.GetDB()

	query := db.Snippet.Select()
	if language != "" {
		query = query.Where("language = ?", language)
	}
	if visibility != "" {
		query = query.Where("visibility = ?", visibility)
	}

	snippets, err := query.Skip((page - 1) * perPage).Take(perPage).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch snippets"})
	}

	response := make([]*SnippetResponse, 0)
	for _, snippet := range snippets {
		var username string
		if snippet.UserID != nil {
			user, _ := db.User.Select().Where("id = ?", *snippet.UserID).One()
			if user != nil {
				username = user.Username
			}
		}
		response = append(response, ToSnippetResponse(snippet, username))
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":     response,
		"page":     page,
		"per_page": perPage,
	})
}

func GetSnippet(c fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid snippet ID"})
	}

	db := database.GetDB()

	snippet, err := db.Snippet.Select().Where("id = ?", id).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Snippet not found"})
	}

	var username string
	if snippet.UserID != nil {
		user, _ := db.User.Select().Where("id = ?", *snippet.UserID).One()
		if user != nil {
			username = user.Username
		}
	}

	return c.Status(fiber.StatusOK).JSON(ToSnippetResponse(snippet, username))
}

func CreateSnippet(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Language    string `json:"language"`
		Code        string `json:"code"`
		Visibility  string `json:"visibility"`
	}

	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.Title == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Title is required"})
	}

	if req.Code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Code is required"})
	}

	if req.Visibility == "" {
		req.Visibility = "public"
	}

	db := database.GetDB()

	snippet := &models.Snippet{
		Title:       req.Title,
		Description: req.Description,
		Language:    req.Language,
		Code:        req.Code,
		Visibility:  req.Visibility,
		UserID:      &userID,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err := db.Snippet.Insert().One(snippet)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create snippet"})
	}

	user, _ := db.User.Select().Where("id = ?", userID).One()
	username := ""
	if user != nil {
		username = user.Username
	}

	return c.Status(fiber.StatusCreated).JSON(ToSnippetResponse(snippet, username))
}

func UpdateSnippet(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid snippet ID"})
	}

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Language    string `json:"language"`
		Code        string `json:"code"`
		Visibility  string `json:"visibility"`
	}

	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := database.GetDB()

	snippet, err := db.Snippet.Select().Where("id = ?", id).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Snippet not found"})
	}

	if snippet.UserID == nil || *snippet.UserID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	if req.Title != "" {
		snippet.Title = req.Title
	}
	if req.Description != "" {
		snippet.Description = req.Description
	}
	if req.Language != "" {
		snippet.Language = req.Language
	}
	if req.Code != "" {
		snippet.Code = req.Code
	}
	if req.Visibility != "" {
		snippet.Visibility = req.Visibility
	}
	snippet.UpdatedAt = time.Now()

	err = db.Snippet.Save().One(snippet)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update snippet"})
	}

	user, _ := db.User.Select().Where("id = ?", userID).One()
	username := ""
	if user != nil {
		username = user.Username
	}

	return c.Status(fiber.StatusOK).JSON(ToSnippetResponse(snippet, username))
}

func DeleteSnippet(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid snippet ID"})
	}

	db := database.GetDB()

	snippet, err := db.Snippet.Select().Where("id = ?", id).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Snippet not found"})
	}

	if snippet.UserID == nil || *snippet.UserID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	err = db.Snippet.Delete().Where("id = ?", id).Exec()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete snippet"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Snippet deleted successfully"})
}
