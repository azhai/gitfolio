package handlers

import (
	"strconv"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/gofiber/fiber/v3"
)

type CreatePullRequestRequest struct {
	Title        string `json:"title" validate:"required,min=1,max=255"`
	Body         string `json:"body"`
	SourceBranch string `json:"source_branch" validate:"required"`
	TargetBranch string `json:"target_branch"`
	Assignee     string `json:"assignee"`
}

type UpdatePullRequestRequest struct {
	Title    string `json:"title"`
	Body     string `json:"body"`
	Assignee string `json:"assignee"`
	Status   string `json:"status"`
	IsMerged *bool  `json:"is_merged"`
	IsClosed *bool  `json:"is_closed"`
}

type PRResponse struct {
	ID            int64  `json:"id"`
	Number        int    `json:"number"`
	Title         string `json:"title"`
	Body          string `json:"body"`
	RepositoryID  int64  `json:"repository_id"`
	Author        string `json:"author"`
	AuthorID      int64  `json:"author_id"`
	Assignee      string `json:"assignee,omitempty"`
	AssigneeID    *int64 `json:"assignee_id,omitempty"`
	SourceBranch  string `json:"source_branch"`
	TargetBranch  string `json:"target_branch"`
	Status        string `json:"status"`
	IsMerged      bool   `json:"is_merged"`
	IsClosed      bool   `json:"is_closed"`
	IsLocked      bool   `json:"is_locked"`
	CommentsCount int    `json:"comments_count"`
	FilesCount    int    `json:"files_count"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
}

func ToPRResponse(mr *models.PullRequest, author *models.Contributor, assignee *models.Contributor, commentsCount, filesCount int) *PRResponse {
	response := &PRResponse{
		ID:            mr.ID,
		Number:        mr.Number,
		Title:         mr.Title,
		Body:          mr.Body,
		RepositoryID:  mr.RepositoryID,
		AuthorID:      mr.AuthorID,
		SourceBranch:  mr.SourceBranch,
		TargetBranch:  mr.TargetBranch,
		Status:        mr.Status,
		IsMerged:      mr.IsMerged,
		IsClosed:      mr.IsClosed,
		IsLocked:      mr.IsLocked,
		CommentsCount: commentsCount,
		FilesCount:    filesCount,
		CreatedAt:     mr.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:     mr.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if author != nil {
		response.Author = author.Name
	}
	if assignee != nil {
		response.Assignee = assignee.Name
		response.AssigneeID = mr.AssigneeID
	}
	return response
}

func getPRCommentsCount(db *models.Database, prID int64) int {
	count, _ := db.Comment.Select().Where("pull_request_id = ?", prID).Count("*")
	return int(count)
}

func getPRFilesCount(db *models.Database, prID int64) int {
	return 0
}

func CreatePullRequest(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)

	var req CreatePullRequestRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	targetBranch := req.TargetBranch
	if targetBranch == "" {
		targetBranch = result.Repo.DefaultBranch
	}

	mr := &models.PullRequest{
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

	err = db.PullRequest.Insert().One(mr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create merge request"})
	}

	return c.Status(fiber.StatusCreated).JSON(mr)
}

func GetPullRequest(c fiber.Ctx) error {
	mrNumber, _ := strconv.Atoi(c.Params("number"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	mr, err := db.PullRequest.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, mrNumber).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	if mr == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	authorContrib, _ := db.Contributor.Select().Where("id = ?", mr.AuthorID).One()
	if authorContrib == nil {
		authorContrib = &models.Contributor{Name: "Unknown"}
	}

	var assigneeContrib *models.Contributor
	if mr.AssigneeID != nil {
		assigneeContrib, _ = db.Contributor.Select().Where("id = ?", *mr.AssigneeID).One()
	}

	commentsCount := getPRCommentsCount(db, mr.ID)
	filesCount := getPRFilesCount(db, mr.ID)

	return c.Status(fiber.StatusOK).JSON(ToPRResponse(mr, authorContrib, assigneeContrib, commentsCount, filesCount))
}

func ListPullRequests(c fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", strconv.Itoa(config.DefaultPage)))
	perPage, _ := strconv.Atoi(c.Query("per_page", strconv.Itoa(config.DefaultPerPage)))
	if perPage > config.MaxPerPage {
		perPage = config.MaxPerPage
	}
	state := c.Query("state", config.PRStatusOpen)

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	query := db.PullRequest.Select(
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

	contributorIDs := make(map[int64]bool)
	for _, mr := range mrs {
		if mr.AuthorID != 0 {
			contributorIDs[mr.AuthorID] = true
		}
		if mr.AssigneeID != nil && *mr.AssigneeID != 0 {
			contributorIDs[*mr.AssigneeID] = true
		}
	}

	contributorsMap := make(map[int64]*models.Contributor)
	for contributorID := range contributorIDs {
		contrib, err := db.Contributor.Select().Where("id = ?", contributorID).One()
		if err == nil {
			contributorsMap[contributorID] = contrib
		}
	}

	var response []*PRResponse
	response = make([]*PRResponse, 0, len(mrs))
	for _, mr := range mrs {
		authorContrib := contributorsMap[mr.AuthorID]
		if authorContrib == nil {
			authorContrib = &models.Contributor{Name: "Unknown"}
		}

		var assigneeContrib *models.Contributor
		if mr.AssigneeID != nil {
			assigneeContrib = contributorsMap[*mr.AssigneeID]
		}

		commentsCount := getPRCommentsCount(db, mr.ID)
		filesCount := getPRFilesCount(db, mr.ID)

		response = append(response, ToPRResponse(mr, authorContrib, assigneeContrib, commentsCount, filesCount))
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":     response,
		"page":     page,
		"per_page": perPage,
	})
}

func UpdatePullRequest(c fiber.Ctx) error {
	mrNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	var req UpdatePullRequestRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	mr, err := db.PullRequest.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, mrNumber).One()
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

	err = db.PullRequest.Save().One(mr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update merge request"})
	}

	authorContrib, _ := db.Contributor.Select().Where("id = ?", mr.AuthorID).One()
	if authorContrib == nil {
		authorContrib = &models.Contributor{Name: "Unknown"}
	}
	var assigneeContrib *models.Contributor
	if mr.AssigneeID != nil {
		assigneeContrib, _ = db.Contributor.Select().Where("id = ?", *mr.AssigneeID).One()
	}

	commentsCount := getPRCommentsCount(db, mr.ID)
	filesCount := getPRFilesCount(db, mr.ID)

	return c.Status(fiber.StatusOK).JSON(ToPRResponse(mr, authorContrib, assigneeContrib, commentsCount, filesCount))
}

func MergePullRequest(c fiber.Ctx) error {
	mrNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	mr, err := db.PullRequest.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, mrNumber).One()
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

	err = db.PullRequest.Save().One(mr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to merge"})
	}

	authorContrib, _ := db.Contributor.Select().Where("id = ?", mr.AuthorID).One()
	if authorContrib == nil {
		authorContrib = &models.Contributor{Name: "Unknown"}
	}
	var assigneeContrib *models.Contributor
	if mr.AssigneeID != nil {
		assigneeContrib, _ = db.Contributor.Select().Where("id = ?", *mr.AssigneeID).One()
	}

	commentsCount := getPRCommentsCount(db, mr.ID)
	filesCount := getPRFilesCount(db, mr.ID)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Merge request merged successfully",
		"mr":      ToPRResponse(mr, authorContrib, assigneeContrib, commentsCount, filesCount),
	})
}

func ClosePullRequest(c fiber.Ctx) error {
	mrNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	mr, err := db.PullRequest.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, mrNumber).One()
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

	err = db.PullRequest.Save().One(mr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to close merge request"})
	}

	authorContrib, _ := db.Contributor.Select().Where("id = ?", mr.AuthorID).One()
	if authorContrib == nil {
		authorContrib = &models.Contributor{Name: "Unknown"}
	}
	var assigneeContrib *models.Contributor
	if mr.AssigneeID != nil {
		assigneeContrib, _ = db.Contributor.Select().Where("id = ?", *mr.AssigneeID).One()
	}

	commentsCount := getPRCommentsCount(db, mr.ID)
	filesCount := getPRFilesCount(db, mr.ID)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Merge request closed successfully",
		"mr":      ToPRResponse(mr, authorContrib, assigneeContrib, commentsCount, filesCount),
	})
}

func ReopenPullRequest(c fiber.Ctx) error {
	mrNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	mr, err := db.PullRequest.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, mrNumber).One()
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

	err = db.PullRequest.Save().One(mr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to reopen merge request"})
	}

	authorContrib, _ := db.Contributor.Select().Where("id = ?", mr.AuthorID).One()
	if authorContrib == nil {
		authorContrib = &models.Contributor{Name: "Unknown"}
	}
	var assigneeContrib *models.Contributor
	if mr.AssigneeID != nil {
		assigneeContrib, _ = db.Contributor.Select().Where("id = ?", *mr.AssigneeID).One()
	}

	commentsCount := getPRCommentsCount(db, mr.ID)
	filesCount := getPRFilesCount(db, mr.ID)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Merge request reopened successfully",
		"mr":      ToPRResponse(mr, authorContrib, assigneeContrib, commentsCount, filesCount),
	})
}

func GetPRCommits(c fiber.Ctx) error {
	prNumber, _ := strconv.Atoi(c.Params("number"))
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "30"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	mr, err := db.PullRequest.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, prNumber).One()
	if err != nil || mr == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Pull request not found"})
	}

	if mr.SourceBranch == "" || mr.TargetBranch == "" {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"commits":  []interface{}{},
			"total":    0,
			"page":     page,
			"per_page": perPage,
		})
	}

	gitSvc := services.NewGitService()
	commits, total, err := gitSvc.GetPRCommits(
		result.Owner.Username,
		result.Repo.Name,
		mr.SourceBranch,
		mr.TargetBranch,
		page,
		perPage,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get PR commits"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"commits":  commits,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}

func GetPRFiles(c fiber.Ctx) error {
	prNumber, _ := strconv.Atoi(c.Params("number"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	mr, err := db.PullRequest.Select().Where("repository_id = ? AND number = ?", result.Repo.ID, prNumber).One()
	if err != nil || mr == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Pull request not found"})
	}

	if mr.SourceBranch == "" || mr.TargetBranch == "" {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"files":           []interface{}{},
			"total_additions": 0,
			"total_deletions": 0,
		})
	}

	gitSvc := services.NewGitService()
	files, additions, deletions, err := gitSvc.GetPRFiles(
		result.Owner.Username,
		result.Repo.Name,
		mr.SourceBranch,
		mr.TargetBranch,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get PR files"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"files":           files,
		"total_additions": additions,
		"total_deletions": deletions,
	})
}
