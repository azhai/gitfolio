package handlers

import (
	"strconv"
	"time"

	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/azhai/goent"
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

// buildPRResponse 构建 PR 响应，自动查询贡献者和评论数
func buildPRResponse(db *models.Database, mr *models.PullRequest) *PRResponse {
	authorContrib := helpers.GetContributor(db, mr.AuthorID)

	var assigneeContrib *models.Contributor
	if mr.AssigneeID != nil {
		assigneeContrib, _ = db.Contributor.Select().Where("id = ?", *mr.AssigneeID).One()
	}

	commentsCount, _ := db.Comment.Select().Filter(
		goent.Equals(db.Comment.Field("pull_request_id"), mr.ID),
	).Count("id")

	return ToPRResponse(mr, authorContrib, assigneeContrib, int(commentsCount), 0)
}

// findPRByNumber 根据仓库 ID 和 PR 编号查找 PR
func findPRByNumber(db *models.Database, repoID int64, number int) (*models.PullRequest, error) {
	return db.PullRequest.Select().Where("repository_id = ? AND number = ?", repoID, number).One()
}

// checkPRAccess 检查当前用户是否有权限修改 PR（作者或仓库所有者）
func checkPRAccess(c fiber.Ctx, mr *models.PullRequest, repoOwnerID int64) error {
	userID := middleware.GetCurrentUserID(c)
	if mr.AuthorID != userID && repoOwnerID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}
	return nil
}

func autoTransitionLinkedTasks(db *models.Database, prID int64, userID int64) {
	links, err := db.TaskPullRequest.Select().Where("pull_request_id = ?", prID).All()
	if err != nil || len(links) == 0 {
		return
	}

	for _, link := range links {
		task, err := db.Task.Select().Where("id = ?", link.TaskID).One()
		if err != nil || task == nil {
			continue
		}

		if task.Status != "progress" && task.Status != "review" {
			continue
		}

		transition := &models.TaskTransition{
			TaskID:     task.ID,
			FromStatus: task.Status,
			ToStatus:   "review",
			UserID:     userID,
			Comment:    "Auto-transitioned: linked PR was merged",
		}
		db.TaskTransition.Insert().One(transition)

		task.Status = "review"
		now := time.Now()
		task.LastHandledAt = &now
		db.Task.Save().One(task)
	}
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
		Number:       helpers.GetNextPRNumber(db, result.Repo.ID),
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

	mr, err := findPRByNumber(db, result.Repo.ID, mrNumber)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	return c.Status(fiber.StatusOK).JSON(buildPRResponse(db, mr))
}

func ListPullRequests(c fiber.Ctx) error {
	pagination := helpers.GetPagination(c)
	state := c.Query("state", "all")

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	conds := []goent.Condition{goent.Equals(db.PullRequest.Field("repository_id"), result.Repo.ID)}
	if state == "open" {
		conds = append(conds, goent.Equals(db.PullRequest.Field("is_closed"), false))
	} else if state == "closed" {
		conds = append(conds, goent.Equals(db.PullRequest.Field("is_closed"), true))
	}

	mrs, err := db.PullRequest.Select().Filter(conds...).
		With("author_id", "assignee_id").
		OrderBy("number DESC").
		Skip(helpers.GetOffset(pagination.Page, pagination.PerPage)).
		Take(pagination.PerPage).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch merge requests"})
	}

	total, _ := db.PullRequest.Select().Filter(conds...).Count("id")

	var prIDs []int64
	for _, mr := range mrs {
		prIDs = append(prIDs, mr.ID)
	}
	commentsCountMap := helpers.BatchGetCommentsCount(db, prIDs, "pull_request")

	var response []*PRResponse
	response = make([]*PRResponse, 0, len(mrs))
	for _, mr := range mrs {
		authorContrib := mr.Author
		if authorContrib == nil {
			authorContrib = &models.Contributor{Name: "Unknown"}
		}

		var assigneeContrib *models.Contributor
		if mr.Assignee != nil {
			assigneeContrib = mr.Assignee
		}

		commentsCount := commentsCountMap[mr.ID]
		response = append(response, ToPRResponse(mr, authorContrib, assigneeContrib, commentsCount, 0))
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":     response,
		"page":     pagination.Page,
		"per_page": pagination.PerPage,
		"total":    total,
	})
}

func UpdatePullRequest(c fiber.Ctx) error {
	mrNumber, _ := strconv.Atoi(c.Params("number"))

	var req UpdatePullRequestRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	mr, err := findPRByNumber(db, result.Repo.ID, mrNumber)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	if err := checkPRAccess(c, mr, result.Repo.OwnerID); err != nil {
		return err
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

	return c.Status(fiber.StatusOK).JSON(buildPRResponse(db, mr))
}

func MergePullRequest(c fiber.Ctx) error {
	mrNumber, _ := strconv.Atoi(c.Params("number"))
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	mr, err := findPRByNumber(db, result.Repo.ID, mrNumber)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	if result.Repo.IsGroupOwned() {
		if !helpers.CheckGroupLeaderPermission(c, result.Group.ID) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only group leader can merge"})
		}
	} else {
		if !helpers.CheckOwnerPermission(c, result.Repo.OwnerID) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only repository owner can merge"})
		}
	}

	if mr.IsClosed || mr.IsMerged {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Merge request is already closed or merged"})
	}

	mr.IsMerged = true
	mr.IsClosed = true
	mr.Status = "closed"

	err = db.PullRequest.Save().One(mr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to merge"})
	}

	autoTransitionLinkedTasks(db, mr.ID, userID)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Merge request merged successfully",
		"mr":      buildPRResponse(db, mr),
	})
}

func ClosePullRequest(c fiber.Ctx) error {
	mrNumber, _ := strconv.Atoi(c.Params("number"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	mr, err := findPRByNumber(db, result.Repo.ID, mrNumber)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	if err := checkPRAccess(c, mr, result.Repo.OwnerID); err != nil {
		return err
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

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Merge request closed successfully",
		"mr":      buildPRResponse(db, mr),
	})
}

func ReopenPullRequest(c fiber.Ctx) error {
	mrNumber, _ := strconv.Atoi(c.Params("number"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	mr, err := findPRByNumber(db, result.Repo.ID, mrNumber)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Merge request not found"})
	}

	if err := checkPRAccess(c, mr, result.Repo.OwnerID); err != nil {
		return err
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

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Merge request reopened successfully",
		"mr":      buildPRResponse(db, mr),
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

	mr, err := findPRByNumber(db, result.Repo.ID, prNumber)
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
		result.OwnerName(), result.Repo.Name,
		mr.SourceBranch, mr.TargetBranch,
		page, perPage,
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

	mr, err := findPRByNumber(db, result.Repo.ID, prNumber)
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
		result.OwnerName(), result.Repo.Name,
		mr.SourceBranch, mr.TargetBranch,
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
