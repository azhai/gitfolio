package handlers

import (
	"time"

	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent"
	"github.com/gofiber/fiber/v3"
)

// SnippetResponse 代码片段响应
type SnippetResponse struct {
	ID          int64  `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Language    string `json:"language"`
	Code        string `json:"code"`
	Visibility  string `json:"visibility"`
	Version     int    `json:"version"`
	UserID      *int64 `json:"user_id"`
	Username    string `json:"username"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

// ToSnippetResponse 将代码片段模型转换为 API 响应
func ToSnippetResponse(snippet *models.Snippet, username string) *SnippetResponse {
	return &SnippetResponse{
		ID:          snippet.ID,
		Title:       snippet.Title,
		Description: snippet.Description,
		Language:    snippet.Language,
		Code:        snippet.Code,
		Visibility:  snippet.Visibility,
		Version:     snippet.Version,
		UserID:      snippet.UserID,
		Username:    username,
		CreatedAt:   snippet.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   snippet.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// ListSnippets 分页获取代码片段列表
func ListSnippets(c fiber.Ctx) error {
	pagination := helpers.GetPagination(c)
	language := c.Query("language")
	visibility := c.Query("visibility", "public")

	db := models.GetDB()

	query := db.Snippet.Select()
	if language != "" {
		query = query.Where("language = ?", language)
	}
	if visibility != "" {
		query = query.Where("visibility = ?", visibility)
	}

	snippets, err := query.Skip(helpers.GetOffset(pagination.Page, pagination.PerPage)).Take(pagination.PerPage).All()
	if err != nil {
		return helpers.JSONError(c, helpers.HTTPStatusInternalServerError, "Failed to fetch snippets")
	}

	userIDs := make([]int64, 0)
	for _, snippet := range snippets {
		if snippet.UserID != nil {
			userIDs = append(userIDs, *snippet.UserID)
		}
	}

	usersMap := make(map[int64]string)
	if len(userIDs) > 0 {
		users, err := db.User.Select("id", "username").Filter(
			goent.In(db.User.Field("id"), userIDs),
		).All()
		if err == nil {
			for _, u := range users {
				usersMap[u.ID] = u.Username
			}
		}
	}

	response := make([]*SnippetResponse, 0)
	for _, snippet := range snippets {
		var username string
		if snippet.UserID != nil {
			username = usersMap[*snippet.UserID]
		}
		response = append(response, ToSnippetResponse(snippet, username))
	}

	return helpers.JSONSuccess(c, helpers.NewPaginatedResponse(response, pagination.Page, pagination.PerPage, 0))
}

// GetSnippet 获取单个代码片段详情
func GetSnippet(c fiber.Ctx) error {
	id, err := helpers.ParseUintParam(c, "id")
	if err != nil {
		return helpers.JSONError(c, helpers.HTTPStatusBadRequest, "Invalid snippet ID")
	}

	db := models.GetDB()

	snippet, err := db.Snippet.Select().Where("id = ?", id).One()
	if err != nil {
		return helpers.JSONError(c, helpers.HTTPStatusNotFound, "Snippet not found")
	}

	var username string
	if snippet.UserID != nil {
		user, _ := db.User.Select().Where("id = ?", *snippet.UserID).One()
		if user != nil {
			username = user.Username
		}
	}

	return helpers.JSONSuccess(c, ToSnippetResponse(snippet, username))
}

// CreateSnippet 创建代码片段
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
		return helpers.JSONError(c, helpers.HTTPStatusBadRequest, err.Error())
	}

	if req.Title == "" {
		return helpers.JSONError(c, helpers.HTTPStatusBadRequest, "Title is required")
	}

	if req.Code == "" {
		return helpers.JSONError(c, helpers.HTTPStatusBadRequest, "Code is required")
	}

	if req.Visibility == "" {
		req.Visibility = "public"
	}

	db := models.GetDB()

	snippet := &models.Snippet{
		Title:       req.Title,
		Description: req.Description,
		Language:    req.Language,
		Code:        req.Code,
		Visibility:  req.Visibility,
		Version:     1,
		UserID:      &userID,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err := db.Snippet.Insert().One(snippet)
	if err != nil {
		return helpers.JSONError(c, helpers.HTTPStatusInternalServerError, "Failed to create snippet")
	}

	return helpers.JSONCreated(c, ToSnippetResponse(snippet, ""))
}

// UpdateSnippet 更新代码片段
func UpdateSnippet(c fiber.Ctx) error {
	id, err := helpers.ParseUintParam(c, "id")
	if err != nil {
		return helpers.JSONError(c, helpers.HTTPStatusBadRequest, "Invalid snippet ID")
	}

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Language    string `json:"language"`
		Code        string `json:"code"`
		Visibility  string `json:"visibility"`
	}

	if err := c.Bind().JSON(&req); err != nil {
		return helpers.JSONError(c, helpers.HTTPStatusBadRequest, err.Error())
	}

	db := models.GetDB()

	snippet, err := db.Snippet.Select().Where("id = ?", id).One()
	if err != nil {
		return helpers.JSONError(c, helpers.HTTPStatusNotFound, "Snippet not found")
	}

	if err := helpers.RequireUser(c, snippet.UserID); err != nil {
		return err
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
	snippet.Version++

	err = db.Snippet.Save().One(snippet)
	if err != nil {
		return helpers.JSONError(c, helpers.HTTPStatusInternalServerError, "Failed to update snippet")
	}

	return helpers.JSONSuccess(c, ToSnippetResponse(snippet, ""))
}

// DeleteSnippet 删除代码片段
func DeleteSnippet(c fiber.Ctx) error {
	id, err := helpers.ParseUintParam(c, "id")
	if err != nil {
		return helpers.JSONError(c, helpers.HTTPStatusBadRequest, "Invalid snippet ID")
	}

	db := models.GetDB()

	snippet, err := db.Snippet.Select().Where("id = ?", id).One()
	if err != nil {
		return helpers.JSONError(c, helpers.HTTPStatusNotFound, "Snippet not found")
	}

	if err := helpers.RequireUser(c, snippet.UserID); err != nil {
		return err
	}

	err = db.Snippet.Delete().Where("id = ?", id).Exec()
	if err != nil {
		return helpers.JSONError(c, helpers.HTTPStatusInternalServerError, "Failed to delete snippet")
	}

	return helpers.JSONSuccess(c, fiber.Map{"message": "Snippet deleted successfully"})
}
