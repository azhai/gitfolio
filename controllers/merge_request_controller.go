package controllers

import (
	"strconv"

	"github.com/azhai/gitfolio/database"
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

func CreateMergeRequest(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	userID := middleware.GetCurrentUserID(c)

	var req CreateMergeRequestRequest
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

	targetBranch := req.TargetBranch
	if targetBranch == "" {
		targetBranch = repo.DefaultBranch
	}

	mr := &models.MergeRequest{
		Title:        req.Title,
		Body:         req.Body,
		RepositoryID: repo.ID,
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
	owner := c.Params("owner")
	repoName := c.Params("repo")
	mrNumber, _ := strconv.Atoi(c.Params("number"))

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	mr, err := db.MergeRequest.Select().Where("repository_id = ? AND number = ?", repo.ID, mrNumber).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	return c.Status(fiber.StatusOK).JSON(mr)
}

func ListMergeRequests(c fiber.Ctx) error {
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

	query := db.MergeRequest.Select().Where("repository_id = ?", repo.ID)

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
	owner := c.Params("owner")
	repoName := c.Params("repo")
	mrNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	var req UpdateMergeRequestRequest
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

	mr, err := db.MergeRequest.Select().Where("repository_id = ? AND number = ?", repo.ID, mrNumber).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	if mr.AuthorID != userID && repo.OwnerID != userID {
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

	return c.Status(fiber.StatusOK).JSON(mr)
}

func MergeMergeRequest(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	mrNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	mr, err := db.MergeRequest.Select().Where("repository_id = ? AND number = ?", repo.ID, mrNumber).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	if repo.OwnerID != userID {
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

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Merge request merged successfully",
		"mr":      mr,
	})
}

func CloseMergeRequest(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	mrNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	mr, err := db.MergeRequest.Select().Where("repository_id = ? AND number = ?", repo.ID, mrNumber).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	if mr.AuthorID != userID && repo.OwnerID != userID {
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

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Merge request closed successfully",
		"mr":      mr,
	})
}

func ReopenMergeRequest(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	mrNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	mr, err := db.MergeRequest.Select().Where("repository_id = ? AND number = ?", repo.ID, mrNumber).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	if mr.AuthorID != userID && repo.OwnerID != userID {
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

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Merge request reopened successfully",
		"mr":      mr,
	})
}
