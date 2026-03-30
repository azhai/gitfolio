package handlers

import (
	"strconv"

	"github.com/azhai/gitfolio/config"
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
	ID        int64  `json:"id"`
	Body      string `json:"body"`
	Author    string `json:"author"`
	AuthorID  int64  `json:"author_id"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type IssueResponse struct {
	ID            int64   `json:"id"`
	Number        int     `json:"number"`
	Title         string  `json:"title"`
	Body          string  `json:"body"`
	RepositoryID  int64   `json:"repository_id"`
	Author        string  `json:"author"`
	AuthorID      int64   `json:"author_id"`
	Assignee      string  `json:"assignee,omitempty"`
	AssigneeID    *int64  `json:"assignee_id,omitempty"`
	Labels        []Label `json:"labels"`
	IsClosed      bool    `json:"is_closed"`
	IsLocked      bool    `json:"is_locked"`
	CommentsCount int     `json:"comments_count"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`
}

type Label struct {
	ID          int64  `json:"id"`
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

func ToIssueResponse(issue *models.Issue, author *models.Contributor, assignee *models.Contributor, labels []Label, commentsCount int) *IssueResponse {
	response := &IssueResponse{
		ID:            issue.ID,
		Number:        issue.Number,
		Title:         issue.Title,
		Body:          issue.Body,
		RepositoryID:  issue.RepositoryID,
		Author:        author.Name,
		AuthorID:      issue.AuthorID,
		AssigneeID:    issue.AssigneeID,
		Labels:        labels,
		IsClosed:      issue.IsClosed,
		IsLocked:      issue.IsLocked,
		CommentsCount: commentsCount,
		CreatedAt:     issue.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:     issue.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if assignee != nil {
		response.Assignee = assignee.Name
	}

	return response
}

func getIssueLabels(db *models.Database, issueID int64) []Label {
	issueLabels, err := db.IssueLabel.Select().Where("issue_id = ?", issueID).All()
	if err != nil {
		return []Label{}
	}

	var labelIDs []int64
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

func getIssueCommentsCount(db *models.Database, issueID int64) int {
	count, _ := db.Comment.Select().Where("issue_id = ?", issueID).Count("*")
	return int(count)
}

func ensureDefaultLabels(db *models.Database, repoID int64) error {
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

	db := models.GetDB()

	if err := ensureDefaultLabels(db, result.Repo.ID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to ensure default labels"})
	}

	authorUser, err := db.User.Select().Where("id = ?", userID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Author not found"})
	}

	var authorContrib *models.Contributor
	existingContribs, _ := db.Contributor.Select().Where("repository_id = ? AND name = ?", result.Repo.ID, authorUser.Username).All()
	if len(existingContribs) > 0 {
		authorContrib = existingContribs[0]
	} else {
		authorContrib = &models.Contributor{
			Name:         authorUser.Username,
			Email:        authorUser.Email,
			Avatar:       authorUser.Avatar,
			RepositoryID: result.Repo.ID,
			CommitsCount: 0,
		}
		db.Contributor.Insert().One(authorContrib)
	}

	var assigneeContrib *models.Contributor
	issueModel := &models.Issue{
		Title:        req.Title,
		Body:         req.Body,
		RepositoryID: result.Repo.ID,
		AuthorID:     authorContrib.ID,
	}

	if req.Assignee != "" {
		assigneeContribs, _ := db.Contributor.Select().Where("repository_id = ? AND name = ?", result.Repo.ID, req.Assignee).All()
		if len(assigneeContribs) > 0 {
			assigneeContrib = assigneeContribs[0]
			issueModel.AssigneeID = &assigneeContrib.ID
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

	return c.Status(fiber.StatusCreated).JSON(ToIssueResponse(issueModel, authorContrib, assigneeContrib, labels, 0))
}

func GetIssue(c fiber.Ctx) error {
	issueNumber, _ := strconv.Atoi(c.Params("number"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	issueModel, err := db.Issue.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, issueNumber).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Issue not found"})
	}

	if issueModel == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Issue not found"})
	}

	authorContrib, err := db.Contributor.Select().Where("id = ?", issueModel.AuthorID).One()
	if err != nil {
		authorContrib = &models.Contributor{Name: "Unknown"}
	}

	var assigneeContrib *models.Contributor
	if issueModel.AssigneeID != nil {
		assigneeContrib, _ = db.Contributor.Select().Where("id = ?", *issueModel.AssigneeID).One()
	}

	labels := getIssueLabels(db, issueModel.ID)
	commentsCount := getIssueCommentsCount(db, issueModel.ID)

	return c.Status(fiber.StatusOK).JSON(ToIssueResponse(issueModel, authorContrib, assigneeContrib, labels, commentsCount))
}

func ListIssues(c fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", strconv.Itoa(config.DefaultPage)))
	perPage, _ := strconv.Atoi(c.Query("per_page", strconv.Itoa(config.DefaultPerPage)))
	if perPage > config.MaxPerPage {
		perPage = config.MaxPerPage
	}
	state := c.Query("state", config.IssueStateOpen)
	labelFilter := c.Query("label", "")

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

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

	contributorIDs := make(map[int64]bool)
	for _, issue := range issues {
		if issue.AuthorID != 0 {
			contributorIDs[issue.AuthorID] = true
		}
		if issue.AssigneeID != nil && *issue.AssigneeID != 0 {
			contributorIDs[*issue.AssigneeID] = true
		}
	}

	contributorsMap := make(map[int64]*models.Contributor)
	for contributorID := range contributorIDs {
		contrib, err := db.Contributor.Select().Where("id = ?", contributorID).One()
		if err == nil {
			contributorsMap[contributorID] = contrib
		}
	}

	var response []*IssueResponse
	response = make([]*IssueResponse, 0)
	for _, issue := range issues {
		authorContrib := contributorsMap[issue.AuthorID]
		if authorContrib == nil {
			authorContrib = &models.Contributor{Name: "Unknown"}
		}

		var assigneeContrib *models.Contributor
		if issue.AssigneeID != nil {
			assigneeContrib = contributorsMap[*issue.AssigneeID]
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

		commentsCount := getIssueCommentsCount(db, issue.ID)
		response = append(response, ToIssueResponse(issue, authorContrib, assigneeContrib, labels, commentsCount))
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

	db := models.GetDB()

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
		assigneeContribs, _ := db.Contributor.Select().Where("repository_id = ? AND name = ?", result.Repo.ID, req.Assignee).All()
		if len(assigneeContribs) > 0 {
			issueModel.AssigneeID = &assigneeContribs[0].ID
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

	authorContrib, _ := db.Contributor.Select().Where("id = ?", issueModel.AuthorID).One()
	if authorContrib == nil {
		authorContrib = &models.Contributor{Name: "Unknown"}
	}
	var assigneeContrib *models.Contributor
	if issueModel.AssigneeID != nil {
		assigneeContrib, _ = db.Contributor.Select().Where("id = ?", *issueModel.AssigneeID).One()
	}
	labels := getIssueLabels(db, issueModel.ID)
	commentsCount := getIssueCommentsCount(db, issueModel.ID)

	return c.Status(fiber.StatusOK).JSON(ToIssueResponse(issueModel, authorContrib, assigneeContrib, labels, commentsCount))
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

	db := models.GetDB()

	issueModel, err := db.Issue.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, issueNumber).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Issue not found"})
	}

	authorUser, _ := db.User.Select().Where("id = ?", userID).One()
	var authorContrib *models.Contributor
	if authorUser != nil {
		existingContribs, _ := db.Contributor.Select().Where("repository_id = ? AND name = ?", result.Repo.ID, authorUser.Username).All()
		if len(existingContribs) > 0 {
			authorContrib = existingContribs[0]
		} else {
			authorContrib = &models.Contributor{
				Name:         authorUser.Username,
				Email:        authorUser.Email,
				Avatar:       authorUser.Avatar,
				RepositoryID: result.Repo.ID,
				CommitsCount: 0,
			}
			db.Contributor.Insert().One(authorContrib)
		}
	}

	issueID := issueModel.ID
	commentModel := &models.Comment{
		Body:     req.Body,
		IssueID:  &issueID,
		AuthorID: authorContrib.ID,
	}

	err = db.Comment.Insert().One(commentModel)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create comment"})
	}

	return c.Status(fiber.StatusCreated).JSON(&CommentResponse{
		ID:        commentModel.ID,
		Body:      commentModel.Body,
		Author:    authorContrib.Name,
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

	db := models.GetDB()

	issueModel, err := db.Issue.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, issueNumber).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Issue not found"})
	}

	comments, err := db.Comment.Select().Where("issue_id = ?", issueModel.ID).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch comments"})
	}

	contributorIDs := make(map[int64]bool)
	for _, comment := range comments {
		if comment.AuthorID != 0 {
			contributorIDs[comment.AuthorID] = true
		}
	}

	contributorsMap := make(map[int64]*models.Contributor)
	for contributorID := range contributorIDs {
		contrib, err := db.Contributor.Select().Where("id = ?", contributorID).One()
		if err == nil {
			contributorsMap[contributorID] = contrib
		}
	}

	var response []*CommentResponse
	response = make([]*CommentResponse, 0)
	for _, comment := range comments {
		authorContrib := contributorsMap[comment.AuthorID]
		authorName := ""
		if authorContrib != nil {
			authorName = authorContrib.Name
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

	db := models.GetDB()

	if err := ensureDefaultLabels(db, result.Repo.ID); err != nil {
	}

	labels, err := db.Label.Select().Where("repository_id = ?", result.Repo.ID).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch labels"})
	}

	var response []Label
	response = make([]Label, 0)
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
