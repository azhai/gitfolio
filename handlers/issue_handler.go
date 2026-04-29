package handlers

import (
	"strconv"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent"
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
	ID            int64              `json:"id"`
	Number        int                `json:"number"`
	Title         string             `json:"title"`
	Body          string             `json:"body"`
	RepositoryID  int64              `json:"repository_id"`
	Author        string             `json:"author"`
	AuthorID      int64              `json:"author_id"`
	Assignee      string             `json:"assignee,omitempty"`
	AssigneeID    *int64             `json:"assignee_id,omitempty"`
	Labels        []helpers.LabelInfo `json:"labels"`
	IsClosed      bool               `json:"is_closed"`
	IsLocked      bool               `json:"is_locked"`
	CommentsCount int                `json:"comments_count"`
	CreatedAt     string             `json:"created_at"`
	UpdatedAt     string             `json:"updated_at"`
}

func ToIssueResponse(issue *models.Issue, author *models.Contributor, assignee *models.Contributor, labels []helpers.LabelInfo, commentsCount int) *IssueResponse {
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

	if err := helpers.EnsureDefaultLabels(db, result.Repo.ID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to ensure default labels"})
	}

	authorUser, err := db.User.Select().Filter(
		goent.Equals(db.User.Field("id"), userID),
	).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Author not found"})
	}

	authorContrib := helpers.FindOrCreateContributor(db, result.Repo.ID, authorUser.Username, authorUser.Email, authorUser.Avatar)

	var assigneeContrib *models.Contributor
	issueModel := &models.Issue{
		Title:        req.Title,
		Body:         req.Body,
		RepositoryID: result.Repo.ID,
		AuthorID:     authorContrib.ID,
	}

	if req.Assignee != "" {
		assigneeContribs, _ := db.Contributor.Select().Filter(
			goent.And(
				goent.Equals(db.Contributor.Field("repository_id"), result.Repo.ID),
				goent.Equals(db.Contributor.Field("name"), req.Assignee),
			),
		).All()
		if len(assigneeContribs) > 0 {
			assigneeContrib = assigneeContribs[0]
			issueModel.AssigneeID = &assigneeContrib.ID
		}
	}

	err = db.Issue.Insert().One(issueModel)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create issue"})
	}

	labels := helpers.AttachLabelsToIssue(db, result.Repo.ID, issueModel.ID, req.Labels)

	return c.Status(fiber.StatusCreated).JSON(ToIssueResponse(issueModel, authorContrib, assigneeContrib, labels, 0))
}

func GetIssue(c fiber.Ctx) error {
	issueNumber, _ := strconv.Atoi(c.Params("number"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	issueModel, err := db.Issue.Select().Filter(
		goent.And(
			goent.Equals(db.Issue.Field("repository_id"), result.Repo.ID),
			goent.Equals(db.Issue.Field("number"), issueNumber),
		),
	).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Issue not found"})
	}

	authorContrib := helpers.GetContributor(db, issueModel.AuthorID)

	var assigneeContrib *models.Contributor
	if issueModel.AssigneeID != nil {
		assigneeContrib, _ = db.Contributor.Select().Where("id = ?", *issueModel.AssigneeID).One()
	}

	labels := helpers.GetIssueLabels(db, issueModel.ID)
	commentsCount, _ := db.Comment.Select().Filter(
		goent.Equals(db.Comment.Field("issue_id"), issueModel.ID),
	).Count("id")

	return c.Status(fiber.StatusOK).JSON(ToIssueResponse(issueModel, authorContrib, assigneeContrib, labels, int(commentsCount)))
}

func ListIssues(c fiber.Ctx) error {
	pagination := helpers.GetPagination(c)
	state := c.Query("state", config.IssueStateOpen)
	labelFilter := c.Query("label", "")

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()
	_ = helpers.EnsureDefaultLabels(db, result.Repo.ID)

	conds := []goent.Condition{goent.Equals(db.Issue.Field("repository_id"), result.Repo.ID)}
	if state == "open" {
		conds = append(conds, goent.Equals(db.Issue.Field("is_closed"), false))
	} else if state == "closed" {
		conds = append(conds, goent.Equals(db.Issue.Field("is_closed"), true))
	}

	issues, err := db.Issue.Select().Filter(conds...).
		Skip(helpers.GetOffset(pagination.Page, pagination.PerPage)).
		Take(pagination.PerPage).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch issues"})
	}

	contributorIDs := helpers.CollectContributorIDs(issues)
	contributorsMap := helpers.BatchGetContributors(db, contributorIDs)

	var issueIDs []int64
	for _, issue := range issues {
		issueIDs = append(issueIDs, issue.ID)
	}
	labelsMap := helpers.BatchGetIssueLabels(db, issueIDs)
	commentsCountMap := helpers.BatchGetCommentsCount(db, issueIDs, "issue")

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

		labels := labelsMap[issue.ID]
		if labels == nil {
			labels = []helpers.LabelInfo{}
		}

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

		commentsCount := commentsCountMap[issue.ID]
		response = append(response, ToIssueResponse(issue, authorContrib, assigneeContrib, labels, commentsCount))
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":     response,
		"page":     pagination.Page,
		"per_page": pagination.PerPage,
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
	_ = helpers.EnsureDefaultLabels(db, result.Repo.ID)

	issueModel, err := db.Issue.Select().Filter(
		goent.And(
			goent.Equals(db.Issue.Field("repository_id"), result.Repo.ID),
			goent.Equals(db.Issue.Field("number"), issueNumber),
		),
	).One()
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
		assigneeContribs, _ := db.Contributor.Select().Filter(
			goent.And(
				goent.Equals(db.Contributor.Field("repository_id"), result.Repo.ID),
				goent.Equals(db.Contributor.Field("name"), req.Assignee),
			),
		).All()
		if len(assigneeContribs) > 0 {
			issueModel.AssigneeID = &assigneeContribs[0].ID
		}
	}

	err = db.Issue.Save().One(issueModel)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update issue"})
	}

	var labels []helpers.LabelInfo
	if req.Labels != nil {
		labels = helpers.ReplaceIssueLabels(db, result.Repo.ID, issueModel.ID, req.Labels)
	} else {
		labels = helpers.GetIssueLabels(db, issueModel.ID)
	}

	authorContrib := helpers.GetContributor(db, issueModel.AuthorID)

	var assigneeContrib *models.Contributor
	if issueModel.AssigneeID != nil {
		assigneeContrib, _ = db.Contributor.Select().Where("id = ?", *issueModel.AssigneeID).One()
	}

	commentsCount, _ := db.Comment.Select().Filter(
		goent.Equals(db.Comment.Field("issue_id"), issueModel.ID),
	).Count("id")

	return c.Status(fiber.StatusOK).JSON(ToIssueResponse(issueModel, authorContrib, assigneeContrib, labels, int(commentsCount)))
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

	issueModel, err := db.Issue.Select().Filter(
		goent.And(
			goent.Equals(db.Issue.Field("repository_id"), result.Repo.ID),
			goent.Equals(db.Issue.Field("number"), issueNumber),
		),
	).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Issue not found"})
	}

	authorUser, _ := db.User.Select().Where("id = ?", userID).One()
	var authorContrib *models.Contributor
	if authorUser != nil {
		authorContrib = helpers.FindOrCreateContributor(db, result.Repo.ID, authorUser.Username, authorUser.Email, authorUser.Avatar)
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

	issueModel, err := db.Issue.Select().Filter(
		goent.And(
			goent.Equals(db.Issue.Field("repository_id"), result.Repo.ID),
			goent.Equals(db.Issue.Field("number"), issueNumber),
		),
	).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Issue not found"})
	}

	comments, err := db.Comment.Select().Filter(
		goent.Equals(db.Comment.Field("issue_id"), issueModel.ID),
	).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch comments"})
	}

	var contributorIDs []int64
	for _, comment := range comments {
		if comment.AuthorID != 0 {
			contributorIDs = append(contributorIDs, comment.AuthorID)
		}
	}

	contributorsMap := helpers.BatchGetContributors(db, contributorIDs)

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
	_ = helpers.EnsureDefaultLabels(db, result.Repo.ID)

	labels, err := db.Label.Select().Filter(
		goent.Equals(db.Label.Field("repository_id"), result.Repo.ID),
	).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch labels"})
	}

	var response []helpers.LabelInfo
	response = make([]helpers.LabelInfo, 0)
	for _, l := range labels {
		response = append(response, helpers.ModelToLabelInfo(l))
	}

	return c.Status(fiber.StatusOK).JSON(response)
}
