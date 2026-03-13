package controllers

import (
	"strconv"

	"github.com/azhai/gitfolio/database"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/gofiber/fiber/v3"
)

type CreateIssueRequest struct {
	Title    string   `json:"title" validate:"required,min=1,max=255"`
	Body     string   `json:"body"`
	Labels   []string `json:"labels"`
	Assignee string   `json:"assignee"`
}

type UpdateIssueRequest struct {
	Title    string   `json:"title"`
	Body     string   `json:"body"`
	Labels   []string `json:"labels"`
	Assignee string   `json:"assignee"`
	IsClosed *bool    `json:"is_closed"`
}

type CreateCommentRequest struct {
	Body string `json:"body" validate:"required"`
}

func CreateIssue(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	userID := middleware.GetCurrentUserID(c)

	var req CreateIssueRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	issueModel := &models.Issue{
		Title:        req.Title,
		Body:         req.Body,
		RepositoryID: repo.ID,
		AuthorID:     userID,
	}

	if req.Assignee != "" {
		assigneeUser, err := db.User.Select().Where("username = ?", req.Assignee).One()
		if err == nil {
			issueModel.AssigneeID = &assigneeUser.ID
		}
	}

	err = db.Issue.Insert().One(issueModel)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create issue"})
	}

	return c.Status(fiber.StatusCreated).JSON(issueModel)
}

func GetIssue(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	issueNumber, _ := strconv.Atoi(c.Params("number"))

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	issueModel, err := db.Issue.Select().Where("repository_id = ? AND id = ?", repo.ID, uint(issueNumber)).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Issue not found"})
	}

	return c.Status(fiber.StatusOK).JSON(issueModel)
}

func ListIssues(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "30"))
	state := c.Query("state", "open")

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	query := db.Issue.Select().Where("repository_id = ?", repo.ID)

	if state == "open" {
		query = query.Where("is_closed = ?", false)
	} else if state == "closed" {
		query = query.Where("is_closed = ?", true)
	}

	issues, err := query.Skip((page - 1) * perPage).Take(perPage).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch issues"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":     issues,
		"page":     page,
		"per_page": perPage,
	})
}

func UpdateIssue(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	issueNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	var req UpdateIssueRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	issueModel, err := db.Issue.Select().Where("repository_id = ? AND id = ?", repo.ID, uint(issueNumber)).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Issue not found"})
	}

	if issueModel.AuthorID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	if req.Title != "" {
		issueModel.Title = req.Title
	}
	if req.Body != "" {
		issueModel.Body = req.Body
	}
	if req.IsClosed != nil {
		issueModel.IsClosed = *req.IsClosed
	}
	if req.Assignee != "" {
		assigneeUser, err := db.User.Select().Where("username = ?", req.Assignee).One()
		if err == nil {
			issueModel.AssigneeID = &assigneeUser.ID
		}
	}

	err = db.Issue.Save().One(issueModel)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update issue"})
	}

	return c.Status(fiber.StatusOK).JSON(issueModel)
}

func CreateComment(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	issueNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	var req CreateCommentRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	issueModel, err := db.Issue.Select().Where("repository_id = ? AND id = ?", repo.ID, uint(issueNumber)).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Issue not found"})
	}

	commentModel := &models.Comment{
		Body:     req.Body,
		IssueID:  issueModel.ID,
		AuthorID: userID,
	}

	err = db.Comment.Insert().One(commentModel)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create comment"})
	}

	return c.Status(fiber.StatusCreated).JSON(commentModel)
}

func GetComments(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	issueNumber, _ := strconv.Atoi(c.Params("number"))

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	issueModel, err := db.Issue.Select().Where("repository_id = ? AND id = ?", repo.ID, uint(issueNumber)).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Issue not found"})
	}

	comments, err := db.Comment.Select().Where("issue_id = ?", issueModel.ID).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch comments"})
	}

	return c.Status(fiber.StatusOK).JSON(comments)
}
