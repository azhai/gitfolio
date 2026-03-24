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

type CommentResponse struct {
	ID        uint   `json:"id"`
	Body      string `json:"body"`
	Author    string `json:"author"`
	AuthorID  uint   `json:"author_id"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type IssueResponse struct {
	ID           uint    `json:"id"`
	Number       int     `json:"number"`
	Title        string  `json:"title"`
	Body         string  `json:"body"`
	RepositoryID uint    `json:"repository_id"`
	Author       string  `json:"author"`
	AuthorID     uint    `json:"author_id"`
	Assignee     string  `json:"assignee,omitempty"`
	AssigneeID   *uint   `json:"assignee_id,omitempty"`
	Labels       []Label `json:"labels"`
	IsClosed     bool    `json:"is_closed"`
	IsLocked     bool    `json:"is_locked"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
}

type Label struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Color       string `json:"color"`
	Description string `json:"description,omitempty"`
}

var DefaultLabels = []struct {
	Name        string
	Color       string
	Description string
}{
	{"Bug", "#d73a4a", "Something isn't working"},
	{"Feat", "#a2eeef", "New feature or request"},
	{"WIP", "#fbca04", "Work in progress"},
}

func ToIssueResponse(issue *models.Issue, author *models.User, assignee *models.User, labels []Label) *IssueResponse {
	response := &IssueResponse{
		ID:           issue.ID,
		Number:       issue.Number,
		Title:        issue.Title,
		Body:         issue.Body,
		RepositoryID: issue.RepositoryID,
		Author:       author.Username,
		AuthorID:     issue.AuthorID,
		AssigneeID:   issue.AssigneeID,
		Labels:       labels,
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

func getIssueLabels(db *database.Database, issueID uint) []Label {
	issueLabels, err := db.IssueLabel.Select().Where("issue_id = ?", issueID).All()
	if err != nil {
		return []Label{}
	}

	var labelIDs []uint
	for _, il := range issueLabels {
		labelIDs = append(labelIDs, il.LabelID)
	}

	if len(labelIDs) == 0 {
		return []Label{}
	}

	labels, err := db.Label.Select().Where("id IN (?)", labelIDs).All()
	if err != nil {
		return []Label{}
	}

	var result []Label
	for _, l := range labels {
		result = append(result, Label{
			ID:          l.ID,
			Name:        l.Name,
			Color:       l.Color,
			Description: l.Description,
		})
	}

	return result
}

func ensureDefaultLabels(db *database.Database, repoID uint) error {
	for _, dl := range DefaultLabels {
		count, _ := db.Label.Select().Where("repository_id = ? AND name = ?", repoID, dl.Name).Count("*")
		if count == 0 {
			newLabel := &models.Label{
				Name:         dl.Name,
				Color:        dl.Color,
				Description:  dl.Description,
				RepositoryID: repoID,
			}
			if err := db.Label.Insert().One(newLabel); err != nil {
				return err
			}
		}
	}
	return nil
}

func CreateIssue(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)

	var req CreateIssueRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	if err := ensureDefaultLabels(db, result.Repo.ID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to ensure default labels"})
	}

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

	var labels []Label
	if len(req.Labels) > 0 {
		dbLabels, err := db.Label.Select().Where("repository_id = ? AND name IN (?)", result.Repo.ID, req.Labels).All()
		if err == nil {
			for _, l := range dbLabels {
				issueLabel := &models.IssueLabel{
					IssueID: issueModel.ID,
					LabelID: l.ID,
				}
				db.IssueLabel.Insert().One(issueLabel)
				labels = append(labels, Label{
					ID:          l.ID,
					Name:        l.Name,
					Color:       l.Color,
					Description: l.Description,
				})
			}
		}
	}

	return c.Status(fiber.StatusCreated).JSON(ToIssueResponse(issueModel, authorUser, assigneeUser, labels))
}

func GetIssue(c fiber.Ctx) error {
	issueNumber, _ := strconv.Atoi(c.Params("number"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	issueModel, err := db.Issue.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, issueNumber).One()
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

	labels := getIssueLabels(db, issueModel.ID)

	return c.Status(fiber.StatusOK).JSON(ToIssueResponse(issueModel, authorUser, assigneeUser, labels))
}

func ListIssues(c fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "30"))
	state := c.Query("state", "open")
	labelFilter := c.Query("label", "")

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	if err := ensureDefaultLabels(db, result.Repo.ID); err != nil {
	}

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

		labels := getIssueLabels(db, issue.ID)

		if labelFilter != "" {
			hasLabel := false
			for _, l := range labels {
				if l.Name == labelFilter {
					hasLabel = true
					break
				}
			}
			if !hasLabel {
				continue
			}
		}

		response = append(response, ToIssueResponse(issue, authorUser, assigneeUser, labels))
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

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	if err := ensureDefaultLabels(db, result.Repo.ID); err != nil {
	}

	issueModel, err := db.Issue.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, issueNumber).One()
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

	if req.Labels != nil {
		db.IssueLabel.Delete().Where("issue_id = ?", issueModel.ID).Exec()

		if len(req.Labels) > 0 {
			dbLabels, err := db.Label.Select().Where("repository_id = ? AND name IN (?)", result.Repo.ID, req.Labels).All()
			if err == nil {
				for _, l := range dbLabels {
					issueLabel := &models.IssueLabel{
						IssueID: issueModel.ID,
						LabelID: l.ID,
					}
					db.IssueLabel.Insert().One(issueLabel)
				}
			}
		}
	}

	authorUser, _ := db.User.Select().Where("id = ?", issueModel.AuthorID).One()
	var assigneeUser *models.User
	if issueModel.AssigneeID != nil {
		assigneeUser, _ = db.User.Select().Where("id = ?", *issueModel.AssigneeID).One()
	}
	labels := getIssueLabels(db, issueModel.ID)

	return c.Status(fiber.StatusOK).JSON(ToIssueResponse(issueModel, authorUser, assigneeUser, labels))
}

func CreateComment(c fiber.Ctx) error {
	issueNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	var req CreateCommentRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	issueModel, err := db.Issue.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, issueNumber).One()
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

	authorUser, _ := db.User.Select().Where("id = ?", userID).One()

	return c.Status(fiber.StatusCreated).JSON(&CommentResponse{
		ID:        commentModel.ID,
		Body:      commentModel.Body,
		Author:    authorUser.Username,
		AuthorID:  commentModel.AuthorID,
		CreatedAt: commentModel.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt: commentModel.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
}

func GetComments(c fiber.Ctx) error {
	issueNumber, _ := strconv.Atoi(c.Params("number"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	issueModel, err := db.Issue.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, issueNumber).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Issue not found"})
	}

	comments, err := db.Comment.Select().Where("issue_id = ?", issueModel.ID).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch comments"})
	}

	userIDs := make(map[uint]bool)
	for _, comment := range comments {
		if comment.AuthorID != 0 {
			userIDs[comment.AuthorID] = true
		}
	}

	usersMap := make(map[uint]*models.User)
	for userID := range userIDs {
		user, err := db.User.Select().Where("id = ?", userID).One()
		if err == nil {
			usersMap[userID] = user
		}
	}

	var response []*CommentResponse
	for _, comment := range comments {
		authorUser := usersMap[comment.AuthorID]
		authorName := ""
		if authorUser != nil {
			authorName = authorUser.Username
		}
		response = append(response, &CommentResponse{
			ID:        comment.ID,
			Body:      comment.Body,
			Author:    authorName,
			AuthorID:  comment.AuthorID,
			CreatedAt: comment.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			UpdatedAt: comment.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response)
}

func ListLabels(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	if err := ensureDefaultLabels(db, result.Repo.ID); err != nil {
	}

	labels, err := db.Label.Select().Where("repository_id = ?", result.Repo.ID).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch labels"})
	}

	var response []Label
	for _, l := range labels {
		response = append(response, Label{
			ID:          l.ID,
			Name:        l.Name,
			Color:       l.Color,
			Description: l.Description,
		})
	}

	return c.Status(fiber.StatusOK).JSON(response)
}
