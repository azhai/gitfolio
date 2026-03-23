package controllers

import (
	"strconv"

	"github.com/azhai/gitfolio/database"
	"github.com/azhai/gitfolio/helpers"
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

type IssueResponse struct {
	ID           uint   `json:"id"`
	Number       int    `json:"number"`
	Title        string `json:"title"`
	Body         string `json:"body"`
	RepositoryID uint   `json:"repository_id"`
	Author       string `json:"author"`
	AuthorID     uint   `json:"author_id"`
	Assignee     string `json:"assignee,omitempty"`
	AssigneeID   *uint  `json:"assignee_id,omitempty"`
	IsClosed     bool   `json:"is_closed"`
	IsLocked     bool   `json:"is_locked"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

func ToIssueResponse(issue *models.Issue, author *models.User, assignee *models.User) *IssueResponse {
	response := &IssueResponse{
		ID:           issue.ID,
		Number:       issue.Number,
		Title:        issue.Title,
		Body:         issue.Body,
		RepositoryID: issue.RepositoryID,
		Author:       author.Username,
		AuthorID:     issue.AuthorID,
		AssigneeID:   issue.AssigneeID,
		IsClosed:     issue.IsClosed,
		IsLocked:     issue.IsLocked,
		CreatedAt:    issue.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:    issue.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if assignee != nil {
		response.Assignee = assignee.Username
	}

	return response
}

func CreateIssue(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)

	var req CreateIssueRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	authorUser, err := db.User.Select().Where("id = ?", userID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Author not found"})
	}

	var assigneeUser *models.User
	issueModel := &models.Issue{
		Title:        req.Title,
		Body:         req.Body,
		RepositoryID: result.Repo.ID,
		AuthorID:     userID,
	}

	if req.Assignee != "" {
		assigneeUser, err = db.User.Select().Where("username = ?", req.Assignee).One()
		if err == nil {
			issueModel.AssigneeID = &assigneeUser.ID
		}
	}

	err = db.Issue.Insert().One(issueModel)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create issue"})
	}

	return c.Status(fiber.StatusCreated).JSON(ToIssueResponse(issueModel, authorUser, assigneeUser))
}

func GetIssue(c fiber.Ctx) error {
	issueNumber, _ := strconv.Atoi(c.Params("number"))

	result, err := helpers.GetOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	issueModel, err := db.Issue.Select().Where("repository_id = ? AND id = ?", result.Repo.ID, uint(issueNumber)).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Issue not found"})
	}

	authorUser, err := db.User.Select().Where("id = ?", issueModel.AuthorID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Author not found"})
	}

	var assigneeUser *models.User
	if issueModel.AssigneeID != nil {
		assigneeUser, _ = db.User.Select().Where("id = ?", *issueModel.AssigneeID).One()
	}

	return c.Status(fiber.StatusOK).JSON(ToIssueResponse(issueModel, authorUser, assigneeUser))
}

func ListIssues(c fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "30"))
	state := c.Query("state", "open")

	result, err := helpers.GetOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	query := db.Issue.Select().Where("repository_id = ?", result.Repo.ID)

	if state == "open" {
		query = query.Where("is_closed = ?", false)
	} else if state == "closed" {
		query = query.Where("is_closed = ?", true)
	}

	issues, err := query.Skip((page - 1) * perPage).Take(perPage).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch issues"})
	}

	userIDs := make(map[uint]bool)
	for _, issue := range issues {
		if issue.AuthorID != 0 {
			userIDs[issue.AuthorID] = true
		}
		if issue.AssigneeID != nil && *issue.AssigneeID != 0 {
			userIDs[*issue.AssigneeID] = true
		}
	}

	usersMap := make(map[uint]*models.User)
	for userID := range userIDs {
		user, err := db.User.Select().Where("id = ?", userID).One()
		if err == nil {
			usersMap[userID] = user
		}
	}

	var response []*IssueResponse
	for _, issue := range issues {
		authorUser := usersMap[issue.AuthorID]
		if authorUser == nil {
			continue
		}

		var assigneeUser *models.User
		if issue.AssigneeID != nil {
			assigneeUser = usersMap[*issue.AssigneeID]
		}

		response = append(response, ToIssueResponse(issue, authorUser, assigneeUser))
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":     response,
		"page":     page,
		"per_page": perPage,
	})
}

func UpdateIssue(c fiber.Ctx) error {
	issueNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	var req UpdateIssueRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	issueModel, err := db.Issue.Select().Where("repository_id = ? AND id = ?", result.Repo.ID, uint(issueNumber)).One()
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
	issueNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	var req CreateCommentRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	issueModel, err := db.Issue.Select().Where("repository_id = ? AND id = ?", result.Repo.ID, uint(issueNumber)).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Issue not found"})
	}

	issueID := issueModel.ID
	commentModel := &models.Comment{
		Body:     req.Body,
		IssueID:  &issueID,
		AuthorID: userID,
	}

	err = db.Comment.Insert().One(commentModel)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create comment"})
	}

	return c.Status(fiber.StatusCreated).JSON(commentModel)
}

func GetComments(c fiber.Ctx) error {
	issueNumber, _ := strconv.Atoi(c.Params("number"))

	result, err := helpers.GetOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	issueModel, err := db.Issue.Select().Where("repository_id = ? AND id = ?", result.Repo.ID, uint(issueNumber)).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Issue not found"})
	}

	comments, err := db.Comment.Select().Where("issue_id = ?", issueModel.ID).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch comments"})
	}

	return c.Status(fiber.StatusOK).JSON(comments)
}
