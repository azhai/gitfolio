package controllers

import (
	"strconv"

	"github.com/azhai/gitfolio/database"
	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/gofiber/fiber/v3"
)

type CreateMergeRequestRequest struct {
	Title        string `json:"title" validate:"required,min=1,max=255"`
	Body         string `json:"body"`
	SourceBranch string `json:"source_branch" validate:"required"`
	TargetBranch string `json:"target_branch"`
	Assignee     string `json:"assignee"`
}

type UpdateMergeRequestRequest struct {
	Title    string `json:"title"`
	Body     string `json:"body"`
	Assignee string `json:"assignee"`
	Status   string `json:"status"`
	IsMerged *bool  `json:"is_merged"`
	IsClosed *bool  `json:"is_closed"`
}

type MRResponse struct {
	ID           uint   `json:"id"`
	Number       int    `json:"number"`
	Title        string `json:"title"`
	Body         string `json:"body"`
	RepositoryID uint   `json:"repository_id"`
	Author       string `json:"author"`
	AuthorID     uint   `json:"author_id"`
	Assignee     string `json:"assignee,omitempty"`
	AssigneeID   *uint  `json:"assignee_id,omitempty"`
	SourceBranch string `json:"source_branch"`
	TargetBranch string `json:"target_branch"`
	Status       string `json:"status"`
	IsMerged     bool   `json:"is_merged"`
	IsClosed     bool   `json:"is_closed"`
	IsLocked     bool   `json:"is_locked"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

func ToMRResponse(mr *models.MergeRequest, author *models.User, assignee *models.User) *MRResponse {
	response := &MRResponse{
		ID:           mr.ID,
		Number:       mr.Number,
		Title:        mr.Title,
		Body:         mr.Body,
		RepositoryID: mr.RepositoryID,
		AuthorID:     mr.AuthorID,
		SourceBranch: mr.SourceBranch,
		TargetBranch: mr.TargetBranch,
		Status:       mr.Status,
		IsMerged:     mr.IsMerged,
		IsClosed:     mr.IsClosed,
		IsLocked:     mr.IsLocked,
		CreatedAt:    mr.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:    mr.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if author != nil {
		response.Author = author.Username
	}
	if assignee != nil {
		response.Assignee = assignee.Username
		response.AssigneeID = mr.AssigneeID
	}
	return response
}

func CreateMergeRequest(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)

	var req CreateMergeRequestRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	targetBranch := req.TargetBranch
	if targetBranch == "" {
		targetBranch = result.Repo.DefaultBranch
	}

	mr := &models.MergeRequest{
		Title:        req.Title,
		Body:         req.Body,
		RepositoryID: result.Repo.ID,
		AuthorID:     userID,
		SourceBranch: req.SourceBranch,
		TargetBranch: targetBranch,
		Status:       "open",
	}

	if req.Assignee != "" {
		assigneeUser, err := db.User.Select().Where("username = ?", req.Assignee).One()
		if err == nil {
			mr.AssigneeID = &assigneeUser.ID
		}
	}

	err = db.MergeRequest.Insert().One(mr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create merge request"})
	}

	return c.Status(fiber.StatusCreated).JSON(mr)
}

func GetMergeRequest(c fiber.Ctx) error {
	mrNumber, _ := strconv.Atoi(c.Params("number"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	mr, err := db.MergeRequest.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, mrNumber).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	authorUser, _ := db.User.Select().Where("id = ?", mr.AuthorID).One()

	var assigneeUser *models.User
	if mr.AssigneeID != nil {
		assigneeUser, _ = db.User.Select().Where("id = ?", *mr.AssigneeID).One()
	}

	return c.Status(fiber.StatusOK).JSON(ToMRResponse(mr, authorUser, assigneeUser))
}

func ListMergeRequests(c fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "30"))
	state := c.Query("state", "open")

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	query := db.MergeRequest.Select(
		"id", "created_at", "updated_at", "title", "body", "number",
		"repository_id", "author_id", "source_branch", "target_branch",
		"assignee_id", "status", "is_merged", "is_closed", "is_locked",
	).Where("repository_id = ?", result.Repo.ID)

	switch state {
	case "open":
		query = query.Where("is_closed = ? AND is_merged = ?", false, false)
	case "closed":
		query = query.Where("is_closed = ?", true)
	case "merged":
		query = query.Where("is_merged = ?", true)
	}

	mrs, err := query.Skip((page - 1) * perPage).Take(perPage).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch merge requests"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":     mrs,
		"page":     page,
		"per_page": perPage,
	})
}

func UpdateMergeRequest(c fiber.Ctx) error {
	mrNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	var req UpdateMergeRequestRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	mr, err := db.MergeRequest.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, mrNumber).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	if mr.AuthorID != userID && result.Repo.OwnerID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	if req.Title != "" {
		mr.Title = req.Title
	}
	if req.Body != "" {
		mr.Body = req.Body
	}
	if req.Status != "" {
		mr.Status = req.Status
	}
	if req.IsMerged != nil {
		mr.IsMerged = *req.IsMerged
		if *req.IsMerged {
			mr.IsClosed = true
		}
	}
	if req.IsClosed != nil {
		mr.IsClosed = *req.IsClosed
	}
	if req.Assignee != "" {
		assigneeUser, err := db.User.Select().Where("username = ?", req.Assignee).One()
		if err == nil {
			mr.AssigneeID = &assigneeUser.ID
		}
	}

	err = db.MergeRequest.Save().One(mr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update merge request"})
	}

	authorUser, _ := db.User.Select().Where("id = ?", mr.AuthorID).One()
	var assigneeUser *models.User
	if mr.AssigneeID != nil {
		assigneeUser, _ = db.User.Select().Where("id = ?", *mr.AssigneeID).One()
	}

	return c.Status(fiber.StatusOK).JSON(ToMRResponse(mr, authorUser, assigneeUser))
}

func MergeMergeRequest(c fiber.Ctx) error {
	mrNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	mr, err := db.MergeRequest.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, mrNumber).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	if result.Repo.OwnerID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only repository owner can merge"})
	}

	if mr.IsClosed || mr.IsMerged {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Merge request is already closed or merged"})
	}

	mr.IsMerged = true
	mr.IsClosed = true
	mr.Status = "merged"

	err = db.MergeRequest.Save().One(mr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to merge"})
	}

	authorUser, _ := db.User.Select().Where("id = ?", mr.AuthorID).One()
	var assigneeUser *models.User
	if mr.AssigneeID != nil {
		assigneeUser, _ = db.User.Select().Where("id = ?", *mr.AssigneeID).One()
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Merge request merged successfully",
		"mr":      ToMRResponse(mr, authorUser, assigneeUser),
	})
}

func CloseMergeRequest(c fiber.Ctx) error {
	mrNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	mr, err := db.MergeRequest.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, mrNumber).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	if mr.AuthorID != userID && result.Repo.OwnerID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	if mr.IsClosed {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Merge request is already closed"})
	}

	mr.IsClosed = true
	mr.Status = "closed"

	err = db.MergeRequest.Save().One(mr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to close merge request"})
	}

	authorUser, _ := db.User.Select().Where("id = ?", mr.AuthorID).One()
	var assigneeUser *models.User
	if mr.AssigneeID != nil {
		assigneeUser, _ = db.User.Select().Where("id = ?", *mr.AssigneeID).One()
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Merge request closed successfully",
		"mr":      ToMRResponse(mr, authorUser, assigneeUser),
	})
}

func ReopenMergeRequest(c fiber.Ctx) error {
	mrNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	mr, err := db.MergeRequest.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, mrNumber).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	if mr.AuthorID != userID && result.Repo.OwnerID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	if !mr.IsClosed {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Merge request is not closed"})
	}

	if mr.IsMerged {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot reopen a merged request"})
	}

	mr.IsClosed = false
	mr.Status = "open"

	err = db.MergeRequest.Save().One(mr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to reopen merge request"})
	}

	authorUser, _ := db.User.Select().Where("id = ?", mr.AuthorID).One()
	var assigneeUser *models.User
	if mr.AssigneeID != nil {
		assigneeUser, _ = db.User.Select().Where("id = ?", *mr.AssigneeID).One()
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Merge request reopened successfully",
		"mr":      ToMRResponse(mr, authorUser, assigneeUser),
	})
}
