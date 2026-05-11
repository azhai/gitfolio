package handlers

import (
	"strconv"
	"time"

	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/gofiber/fiber/v3"
)

type TaskResponse struct {
	ID            int64                `json:"id"`
	Title         string               `json:"title"`
	Draft         string               `json:"draft"`
	Goal          string               `json:"goal"`
	PreviewImage  string               `json:"preview_image,omitempty"`
	Status        string               `json:"status"`
	Priority      int                  `json:"priority"`
	SortOrder     int                  `json:"sort_order"`
	RepositoryID  int64                `json:"repository_id"`
	Initiator     string               `json:"initiator"`
	InitiatorID   int64                `json:"initiator_id"`
	Verifier      string               `json:"verifier,omitempty"`
	VerifierID    *int64               `json:"verifier_id,omitempty"`
	Handler       string               `json:"handler,omitempty"`
	HandlerID     *int64               `json:"handler_id,omitempty"`
	Schedules     []TaskScheduleResp   `json:"schedules,omitempty"`
	Attachments   []TaskAttachmentResp `json:"attachments,omitempty"`
	Issues        []TaskIssueResp      `json:"issues,omitempty"`
	CreatedAt     string               `json:"created_at"`
	UpdatedAt     string               `json:"updated_at"`
	LastHandledAt string               `json:"last_handled_at,omitempty"`
}

type TaskIssueResp struct {
	ID     int64  `json:"id"`
	Title  string `json:"title"`
	Status string `json:"status"`
	Number int    `json:"number"`
}

type TaskScheduleResp struct {
	ID              int64  `json:"id"`
	ScheduleType    string `json:"schedule_type"`
	PlanStartDate   string `json:"plan_start_date,omitempty"`
	PlanEndDate     string `json:"plan_end_date,omitempty"`
	PlanStartNoon   string `json:"plan_start_noon,omitempty"`
	PlanEndNoon     string `json:"plan_end_noon,omitempty"`
	ActualStartDate string `json:"actual_start_date,omitempty"`
	ActualEndDate   string `json:"actual_end_date,omitempty"`
	ActualStartNoon string `json:"actual_start_noon,omitempty"`
	ActualEndNoon   string `json:"actual_end_noon,omitempty"`
	User1           string `json:"user1,omitempty"`
	User2           string `json:"user2,omitempty"`
	User3           string `json:"user3,omitempty"`
}

type TaskAttachmentResp struct {
	ID       int64  `json:"id"`
	FileName string `json:"file_name"`
	FilePath string `json:"file_path"`
	FileSize int64  `json:"file_size"`
	FileType string `json:"file_type"`
}

type CreateTaskRequest struct {
	Title        string          `json:"title"`
	Draft        string          `json:"draft"`
	Goal         string          `json:"goal"`
	PreviewImage string          `json:"preview_image"`
	Priority     int             `json:"priority"`
	SortOrder    int             `json:"sort_order"`
	Verifier     string          `json:"verifier"`
	Handler      string          `json:"handler"`
	Schedules    []ScheduleInput `json:"schedules"`
}

type ScheduleInput struct {
	ScheduleType  string `json:"schedule_type"`
	PlanStartDate string `json:"plan_start_date"`
	PlanEndDate   string `json:"plan_end_date"`
	PlanStartNoon string `json:"plan_start_noon"`
	PlanEndNoon   string `json:"plan_end_noon"`
	User1         string `json:"user1"`
	User2         string `json:"user2"`
	User3         string `json:"user3"`
}

type UpdateTaskRequest struct {
	Title        string          `json:"title"`
	Draft        string          `json:"draft"`
	Goal         string          `json:"goal"`
	PreviewImage string          `json:"preview_image"`
	Status       string          `json:"status"`
	Priority     int             `json:"priority"`
	SortOrder    int             `json:"sort_order"`
	Verifier     string          `json:"verifier"`
	Handler      string          `json:"handler"`
	Schedules    []ScheduleInput `json:"schedules"`
}

const (
	TaskStatusDraft     = "draft"
	TaskStatusProgress  = "progress"
	TaskStatusReview    = "review"
	TaskStatusCompleted = "completed"
)

var PriorityColors = map[int]string{
	1: "#ff0000",
	2: "#ff8c00",
	3: "#ffd700",
	4: "#90ee90",
	5: "#87ceeb",
}

func ToTaskResponse(task *models.Task, initiator *models.User, verifier *models.User, handler *models.User, schedules []TaskScheduleResp, attachments []TaskAttachmentResp, issues []TaskIssueResp) TaskResponse {
	response := TaskResponse{
		ID:           task.ID,
		Title:        task.Title,
		Draft:        task.Draft,
		Goal:         task.Goal,
		PreviewImage: task.PreviewImage,
		Status:       task.Status,
		Priority:     task.Priority,
		SortOrder:    task.SortOrder,
		RepositoryID: task.RepositoryID,
		InitiatorID:  task.InitiatorID,
		Schedules:    schedules,
		Attachments:  attachments,
		Issues:       issues,
		CreatedAt:    task.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:    task.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if initiator != nil {
		response.Initiator = initiator.Username
	}
	if verifier != nil {
		response.Verifier = verifier.Username
		response.VerifierID = task.VerifierID
	}
	if handler != nil {
		response.Handler = handler.Username
		response.HandlerID = task.HandlerID
	}
	if task.LastHandledAt != nil {
		response.LastHandledAt = task.LastHandledAt.Format("2006-01-02T15:04:05Z07:00")
	}

	return response
}

// collectTaskUserIDs 收集任务列表中所有关联用户 ID
func collectTaskUserIDs(tasks []*models.Task) []int64 {
	var initiatorIDs, verifierIDs, handlerIDs []int64
	for _, task := range tasks {
		if task.InitiatorID != 0 {
			initiatorIDs = append(initiatorIDs, task.InitiatorID)
		}
		if task.VerifierID != nil && *task.VerifierID != 0 {
			verifierIDs = append(verifierIDs, *task.VerifierID)
		}
		if task.HandlerID != nil && *task.HandlerID != 0 {
			handlerIDs = append(handlerIDs, *task.HandlerID)
		}
	}
	return helpers.CollectUniqueIDs(initiatorIDs, verifierIDs, handlerIDs)
}

// findUserByUsername 根据用户名查找用户，返回用户 ID 的指针
func findUserByUsername(db *models.Database, username string) *int64 {
	if username == "" {
		return nil
	}
	user, err := db.User.Select().Where("username = ?", username).One()
	if err != nil {
		return nil
	}
	return &user.ID
}

// createScheduleFromInput 根据输入创建排期记录
func createScheduleFromInput(db *models.Database, taskID int64, s ScheduleInput) {
	schedule := &models.TaskSchedule{
		TaskID:       taskID,
		ScheduleType: s.ScheduleType,
	}

	if s.PlanStartDate != "" {
		t, err := time.Parse("2006-01-02", s.PlanStartDate)
		if err == nil {
			schedule.PlanStartDate = &t
		}
	}
	if s.PlanEndDate != "" {
		t, err := time.Parse("2006-01-02", s.PlanEndDate)
		if err == nil {
			schedule.PlanEndDate = &t
		}
	}
	schedule.PlanStartNoon = s.PlanStartNoon
	schedule.PlanEndNoon = s.PlanEndNoon

	schedule.User1ID = findUserByUsername(db, s.User1)
	schedule.User2ID = findUserByUsername(db, s.User2)
	schedule.User3ID = findUserByUsername(db, s.User3)

	db.TaskSchedule.Insert().One(schedule)
}

// buildTaskFullResponse 构建包含排期、附件和关联 Issue 的完整任务响应
func buildTaskFullResponse(db *models.Database, task *models.Task) TaskResponse {
	initiator := helpers.GetUser(db, task.InitiatorID)

	var verifier *models.User
	if task.VerifierID != nil {
		verifier = helpers.GetUser(db, *task.VerifierID)
	}

	var handler *models.User
	if task.HandlerID != nil {
		handler = helpers.GetUser(db, *task.HandlerID)
	}

	schedules := getTaskSchedules(db, task.ID)
	attachments := getTaskAttachments(db, task.ID)
	issues := getTaskIssues(db, task.ID)

	return ToTaskResponse(task, initiator, verifier, handler, schedules, attachments, issues)
}

func ListTasks(c fiber.Ctx) error {
	pagination := helpers.GetPagination(c)
	status := c.Query("status", "")
	priority := c.Query("priority", "")

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	query := db.Task.Select().Where("repository_id = ?", result.Repo.ID)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if priority != "" {
		query = query.Where("priority = ?", priority)
	}

	countQuery := db.Task.Select().Where("repository_id = ?", result.Repo.ID)
	if status != "" {
		countQuery = countQuery.Where("status = ?", status)
	}
	if priority != "" {
		countQuery = countQuery.Where("priority = ?", priority)
	}
	total, _ := countQuery.Count("*")

	tasks, err := query.Skip(helpers.GetOffset(pagination.Page, pagination.PerPage)).Take(pagination.PerPage).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch tasks"})
	}

	userIDs := collectTaskUserIDs(tasks)
	usersMap := helpers.BatchGetUsers(db, userIDs)

	var response []TaskResponse
	response = make([]TaskResponse, 0)
	for _, task := range tasks {
		initiator := usersMap[task.InitiatorID]
		var verifier *models.User
		if task.VerifierID != nil {
			verifier = usersMap[*task.VerifierID]
		}
		var handler *models.User
		if task.HandlerID != nil {
			handler = usersMap[*task.HandlerID]
		}

		response = append(response, ToTaskResponse(task, initiator, verifier, handler, nil, nil, nil))
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":     response,
		"total":    total,
		"page":     pagination.Page,
		"per_page": pagination.PerPage,
	})
}

func GetTask(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	return c.Status(fiber.StatusOK).JSON(buildTaskFullResponse(db, task))
}

func getTaskSchedules(db *models.Database, taskID int64) []TaskScheduleResp {
	schedules, err := db.TaskSchedule.Select().Where("task_id = ?", taskID).All()
	if err != nil {
		return []TaskScheduleResp{}
	}

	var userIDs []int64
	for _, s := range schedules {
		if s.User1ID != nil && *s.User1ID != 0 {
			userIDs = append(userIDs, *s.User1ID)
		}
		if s.User2ID != nil && *s.User2ID != 0 {
			userIDs = append(userIDs, *s.User2ID)
		}
		if s.User3ID != nil && *s.User3ID != 0 {
			userIDs = append(userIDs, *s.User3ID)
		}
	}

	usersMap := helpers.BatchGetUsers(db, userIDs)

	var result []TaskScheduleResp
	for _, s := range schedules {
		resp := TaskScheduleResp{
			ID:           s.ID,
			ScheduleType: s.ScheduleType,
		}

		if s.PlanStartDate != nil {
			resp.PlanStartDate = s.PlanStartDate.Format("2006-01-02")
		}
		if s.PlanEndDate != nil {
			resp.PlanEndDate = s.PlanEndDate.Format("2006-01-02")
		}
		resp.PlanStartNoon = s.PlanStartNoon
		resp.PlanEndNoon = s.PlanEndNoon

		if s.ActualStartDate != nil {
			resp.ActualStartDate = s.ActualStartDate.Format("2006-01-02")
		}
		if s.ActualEndDate != nil {
			resp.ActualEndDate = s.ActualEndDate.Format("2006-01-02")
		}
		resp.ActualStartNoon = s.ActualStartNoon
		resp.ActualEndNoon = s.ActualEndNoon

		if s.User1ID != nil {
			if u := usersMap[*s.User1ID]; u != nil {
				resp.User1 = u.Username
			}
		}
		if s.User2ID != nil {
			if u := usersMap[*s.User2ID]; u != nil {
				resp.User2 = u.Username
			}
		}
		if s.User3ID != nil {
			if u := usersMap[*s.User3ID]; u != nil {
				resp.User3 = u.Username
			}
		}

		result = append(result, resp)
	}

	return result
}

func getTaskAttachments(db *models.Database, taskID int64) []TaskAttachmentResp {
	attachments, err := db.TaskAttachment.Select().Where("task_id = ?", taskID).All()
	if err != nil {
		return []TaskAttachmentResp{}
	}

	var result []TaskAttachmentResp
	for _, a := range attachments {
		result = append(result, TaskAttachmentResp{
			ID:       a.ID,
			FileName: a.FileName,
			FilePath: a.FilePath,
			FileSize: a.FileSize,
			FileType: a.FileType,
		})
	}

	return result
}

func getTaskIssues(db *models.Database, taskID int64) []TaskIssueResp {
	taskIssues, err := db.TaskIssue.Select().Where("task_id = ?", taskID).All()
	if err != nil {
		return []TaskIssueResp{}
	}

	var issueIDs []int64
	for _, ti := range taskIssues {
		issueIDs = append(issueIDs, ti.IssueID)
	}

	issues, err := db.Issue.Select().Where("id IN ?", issueIDs).All()
	if err != nil {
		return []TaskIssueResp{}
	}

	var result []TaskIssueResp
	for _, issue := range issues {
		status := "open"
		if issue.IsClosed {
			status = "closed"
		}
		result = append(result, TaskIssueResp{
			ID:     issue.ID,
			Title:  issue.Title,
			Status: status,
			Number: issue.Number,
		})
	}

	return result
}

func CreateTask(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)

	var req CreateTaskRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task := &models.Task{
		Title:        req.Title,
		Draft:        req.Draft,
		Goal:         req.Goal,
		PreviewImage: req.PreviewImage,
		Status:       TaskStatusDraft,
		Priority:     req.Priority,
		SortOrder:    req.SortOrder,
		RepositoryID: result.Repo.ID,
		InitiatorID:  userID,
	}

	if req.Priority < 1 || req.Priority > 5 {
		task.Priority = 3
	}

	task.VerifierID = findUserByUsername(db, req.Verifier)
	task.HandlerID = findUserByUsername(db, req.Handler)

	err = db.Task.Insert().One(task)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create task"})
	}

	for _, s := range req.Schedules {
		createScheduleFromInput(db, task.ID, s)
	}

	return c.Status(fiber.StatusCreated).JSON(buildTaskFullResponse(db, task))
}

func UpdateTask(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	userID := middleware.GetCurrentUserID(c)

	var req UpdateTaskRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	if task.InitiatorID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	if req.Title != "" {
		task.Title = req.Title
	}
	if req.Draft != "" {
		task.Draft = req.Draft
	}
	if req.Goal != "" {
		task.Goal = req.Goal
	}
	if req.PreviewImage != "" {
		task.PreviewImage = req.PreviewImage
	}
	if req.Status != "" {
		task.Status = req.Status
	}
	if req.Priority >= 1 && req.Priority <= 5 {
		task.Priority = req.Priority
	}
	if req.SortOrder != 0 {
		task.SortOrder = req.SortOrder
	}

	if req.Verifier != "" {
		task.VerifierID = findUserByUsername(db, req.Verifier)
	}
	if req.Handler != "" {
		task.HandlerID = findUserByUsername(db, req.Handler)
	}

	now := time.Now()
	task.LastHandledAt = &now

	err = db.Task.Save().One(task)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update task"})
	}

	if req.Schedules != nil {
		db.TaskSchedule.Delete().Where("task_id = ?", task.ID).Exec()
		for _, s := range req.Schedules {
			createScheduleFromInput(db, task.ID, s)
		}
	}

	return c.Status(fiber.StatusOK).JSON(buildTaskFullResponse(db, task))
}

func DeleteTask(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	if task.InitiatorID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	db.TaskSchedule.Delete().Where("task_id = ?", task.ID).Exec()
	db.TaskAttachment.Delete().Where("task_id = ?", task.ID).Exec()
	db.TaskIssue.Delete().Where("task_id = ?", task.ID).Exec()
	db.Task.Delete().Where("id = ?", task.ID).Exec()

	return c.Status(fiber.StatusNoContent).JSON(nil)
}

func AddIssueToTask(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	userID := middleware.GetCurrentUserID(c)

	var req struct {
		IssueID int64 `json:"issue_id"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	if task.InitiatorID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	issue, err := db.Issue.Select().Where("id = ? AND repository_id = ?", req.IssueID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Issue not found"})
	}

	existing, _ := db.TaskIssue.Select().Where("task_id = ? AND issue_id = ?", task.ID, issue.ID).One()
	if existing != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Issue already linked to this task"})
	}

	taskIssue := &models.TaskIssue{
		TaskID:  task.ID,
		IssueID: issue.ID,
	}

	if err := db.TaskIssue.Save().One(taskIssue); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Issue linked successfully"})
}

func RemoveIssueFromTask(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	issueID, _ := strconv.Atoi(c.Params("issue_id"))
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	if task.InitiatorID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	db.TaskIssue.Delete().Where("task_id = ? AND issue_id = ?", task.ID, issueID).Exec()

	return c.Status(fiber.StatusNoContent).JSON(nil)
}

func UploadTaskAttachment(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	if task.InitiatorID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No file uploaded"})
	}

	maxSize := int64(10 * 1024 * 1024)
	if file.Size > maxSize {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "File too large"})
	}

	filePath := "uploads/tasks/" + strconv.Itoa(int(task.ID)) + "/" + file.Filename

	if err := c.SaveFile(file, filePath); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save file"})
	}

	attachment := &models.TaskAttachment{
		TaskID:   task.ID,
		FileName: file.Filename,
		FilePath: filePath,
		FileSize: file.Size,
		FileType: file.Header.Get("Content-Type"),
	}

	if err := db.TaskAttachment.Insert().One(attachment); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save attachment"})
	}

	return c.Status(fiber.StatusCreated).JSON(TaskAttachmentResp{
		ID:       attachment.ID,
		FileName: attachment.FileName,
		FilePath: attachment.FilePath,
		FileSize: attachment.FileSize,
		FileType: attachment.FileType,
	})
}

func DeleteTaskAttachment(c fiber.Ctx) error {
	attachmentID, _ := strconv.Atoi(c.Params("attachment_id"))
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	attachment, err := db.TaskAttachment.Select().Where("id = ?", attachmentID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Attachment not found"})
	}

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", attachment.TaskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	if task.InitiatorID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	db.TaskAttachment.Delete().Where("id = ?", attachmentID).Exec()

	return c.Status(fiber.StatusNoContent).JSON(nil)
}

var validTransitions = map[string][]string{
	TaskStatusDraft:    {TaskStatusProgress},
	TaskStatusProgress: {TaskStatusReview},
	TaskStatusReview:   {TaskStatusCompleted, "rejected"},
	"rejected":         {TaskStatusProgress},
}

func isValidTransition(from, to string) bool {
	allowed, ok := validTransitions[from]
	if !ok {
		return false
	}
	for _, t := range allowed {
		if t == to {
			return true
		}
	}
	return false
}

type TransitionRequest struct {
	ToStatus string `json:"to_status"`
	Comment  string `json:"comment"`
}

func TransitionTask(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req TransitionRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	if !isValidTransition(task.Status, req.ToStatus) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid transition from " + task.Status + " to " + req.ToStatus,
		})
	}

	if req.ToStatus == TaskStatusCompleted && task.VerifierID != nil && *task.VerifierID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only the verifier can complete this task"})
	}

	transition := &models.TaskTransition{
		TaskID:     task.ID,
		FromStatus: task.Status,
		ToStatus:   req.ToStatus,
		UserID:     userID,
		Comment:    req.Comment,
	}
	db.TaskTransition.Insert().One(transition)

	task.Status = req.ToStatus
	now := time.Now()
	task.LastHandledAt = &now
	db.Task.Save().One(task)

	return c.Status(fiber.StatusOK).JSON(buildTaskFullResponse(db, task))
}

func GetTaskTransitions(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	transitions, err := db.TaskTransition.Select().Where("task_id = ?", task.ID).OrderBy("created_at DESC").All()
	if err != nil {
		return c.Status(fiber.StatusOK).JSON([]interface{}{})
	}

	var userIDs []int64
	for _, t := range transitions {
		if t.UserID != 0 {
			userIDs = append(userIDs, t.UserID)
		}
	}
	usersMap := helpers.BatchGetUsers(db, userIDs)

	type TransitionResponse struct {
		ID         int64  `json:"id"`
		FromStatus string `json:"from_status"`
		ToStatus   string `json:"to_status"`
		UserID     int64  `json:"user_id"`
		Username   string `json:"username"`
		Comment    string `json:"comment"`
		CreatedAt  string `json:"created_at"`
	}

	var response []TransitionResponse
	for _, t := range transitions {
		username := ""
		if u := usersMap[t.UserID]; u != nil {
			username = u.Username
		}
		response = append(response, TransitionResponse{
			ID:         t.ID,
			FromStatus: t.FromStatus,
			ToStatus:   t.ToStatus,
			UserID:     t.UserID,
			Username:   username,
			Comment:    t.Comment,
			CreatedAt:  t.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response)
}

func GetTaskComments(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	comments, err := db.Comment.Select().Where("task_id = ?", task.ID).OrderBy("created_at ASC").All()
	if err != nil {
		return c.Status(fiber.StatusOK).JSON([]interface{}{})
	}

	var authorIDs []int64
	for _, c := range comments {
		if c.AuthorID != 0 {
			authorIDs = append(authorIDs, c.AuthorID)
		}
	}
	usersMap := helpers.BatchGetUsers(db, authorIDs)

	type CommentResponse struct {
		ID        int64  `json:"id"`
		Body      string `json:"body"`
		AuthorID  int64  `json:"author_id"`
		Author    string `json:"author"`
		CreatedAt string `json:"created_at"`
		UpdatedAt string `json:"updated_at"`
	}

	var response []CommentResponse
	for _, c := range comments {
		author := ""
		if u := usersMap[c.AuthorID]; u != nil {
			author = u.Username
		}
		response = append(response, CommentResponse{
			ID:        c.ID,
			Body:      c.Body,
			AuthorID:  c.AuthorID,
			Author:    author,
			CreatedAt: c.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			UpdatedAt: c.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response)
}

func CreateTaskComment(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		Body string `json:"body"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.Body == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Comment body is required"})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	taskIDVal := task.ID
	comment := &models.Comment{
		Body:     req.Body,
		TaskID:   &taskIDVal,
		AuthorID: userID,
	}

	if err := db.Comment.Insert().One(comment); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create comment"})
	}

	user := helpers.GetUser(db, userID)
	username := ""
	if user != nil {
		username = user.Username
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":         comment.ID,
		"body":       comment.Body,
		"author_id":  comment.AuthorID,
		"author":     username,
		"created_at": comment.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		"updated_at": comment.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
}

func LinkTaskPullRequest(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		PullRequestID int64 `json:"pull_request_id"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	pr, err := db.PullRequest.Select().Where("id = ? AND repository_id = ?", req.PullRequestID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Pull request not found"})
	}

	existing, _ := db.TaskPullRequest.Select().Where("task_id = ? AND pull_request_id = ?", task.ID, pr.ID).One()
	if existing != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Pull request already linked"})
	}

	link := &models.TaskPullRequest{
		TaskID:        task.ID,
		PullRequestID: pr.ID,
	}
	db.TaskPullRequest.Insert().One(link)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Pull request linked successfully"})
}

func UnlinkTaskPullRequest(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	prID, _ := strconv.Atoi(c.Params("pr_id"))
	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	db.TaskPullRequest.Delete().Where("task_id = ? AND pull_request_id = ?", task.ID, prID).Exec()

	return c.Status(fiber.StatusNoContent).JSON(nil)
}

func GetTaskPullRequests(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	links, err := db.TaskPullRequest.Select().Where("task_id = ?", task.ID).All()
	if err != nil {
		return c.Status(fiber.StatusOK).JSON([]interface{}{})
	}

	var prIDs []int64
	for _, l := range links {
		prIDs = append(prIDs, l.PullRequestID)
	}

	var prs []*models.PullRequest
	if len(prIDs) > 0 {
		prs, _ = db.PullRequest.Select().Where("id IN ?", prIDs).All()
	}

	type PRSummary struct {
		ID           int64  `json:"id"`
		Number       int    `json:"number"`
		Title        string `json:"title"`
		Status       string `json:"status"`
		SourceBranch string `json:"source_branch"`
		TargetBranch string `json:"target_branch"`
		IsMerged     bool   `json:"is_merged"`
	}

	var response []PRSummary
	for _, pr := range prs {
		status := pr.Status
		if pr.IsMerged {
			status = "merged"
		}
		response = append(response, PRSummary{
			ID:           pr.ID,
			Number:       pr.Number,
			Title:        pr.Title,
			Status:       status,
			SourceBranch: pr.SourceBranch,
			TargetBranch: pr.TargetBranch,
			IsMerged:     pr.IsMerged,
		})
	}

	return c.Status(fiber.StatusOK).JSON(response)
}

func GetTaskCommits(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	refs, err := db.CommitReference.Select().Where("target_type = ? AND target_id = ?", "task", task.ID).All()
	if err != nil {
		return c.Status(fiber.StatusOK).JSON([]interface{}{})
	}

	gitSvc := services.NewGitService()
	type CommitSummary struct {
		Hash        string `json:"hash"`
		ShortHash   string `json:"short_hash"`
		Message     string `json:"message"`
		Author      string `json:"author"`
		AuthorEmail string `json:"author_email"`
		Date        string `json:"date"`
	}

	var response []CommitSummary
	for _, ref := range refs {
		detail, err := gitSvc.GetCommitDetail(result.OwnerName(), result.Repo.Name, ref.CommitHash)
		if err != nil {
			response = append(response, CommitSummary{
				Hash:    ref.CommitHash,
				Message: "Unable to load commit details",
			})
			continue
		}
		response = append(response, CommitSummary{
			Hash:        detail.Hash,
			ShortHash:   detail.ShortHash,
			Message:     detail.Message,
			Author:      detail.Author,
			AuthorEmail: detail.AuthorEmail,
			Date:        detail.Date,
		})
	}

	return c.Status(fiber.StatusOK).JSON(response)
}

func StartTimer(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		Note string `json:"note"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	active, _ := db.TaskTimeLog.Select().Where("task_id = ? AND user_id = ? AND end_time IS NULL", task.ID, userID).One()
	if active != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Timer already running for this task"})
	}

	timeLog := &models.TaskTimeLog{
		TaskID:    task.ID,
		UserID:    userID,
		StartTime: time.Now(),
		Note:      req.Note,
	}
	db.TaskTimeLog.Insert().One(timeLog)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":         timeLog.ID,
		"task_id":    timeLog.TaskID,
		"start_time": timeLog.StartTime.Format("2006-01-02T15:04:05Z07:00"),
		"note":       timeLog.Note,
	})
}

func StopTimer(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	active, err := db.TaskTimeLog.Select().Where("task_id = ? AND user_id = ? AND end_time IS NULL", task.ID, userID).One()
	if err != nil || active == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No active timer found"})
	}

	now := time.Now()
	active.EndTime = &now
	active.Duration = int64(now.Sub(active.StartTime).Seconds())
	db.TaskTimeLog.Save().One(active)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"id":         active.ID,
		"task_id":    active.TaskID,
		"start_time": active.StartTime.Format("2006-01-02T15:04:05Z07:00"),
		"end_time":   active.EndTime.Format("2006-01-02T15:04:05Z07:00"),
		"duration":   active.Duration,
		"note":       active.Note,
	})
}

func GetTaskTimeLogs(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	logs, err := db.TaskTimeLog.Select().Where("task_id = ?", task.ID).OrderBy("created_at DESC").All()
	if err != nil {
		return c.Status(fiber.StatusOK).JSON([]interface{}{})
	}

	var userIDs []int64
	for _, l := range logs {
		if l.UserID != 0 {
			userIDs = append(userIDs, l.UserID)
		}
	}
	usersMap := helpers.BatchGetUsers(db, userIDs)

	type TimeLogResponse struct {
		ID        int64  `json:"id"`
		UserID    int64  `json:"user_id"`
		Username  string `json:"username"`
		StartTime string `json:"start_time"`
		EndTime   string `json:"end_time,omitempty"`
		Duration  int64  `json:"duration"`
		Note      string `json:"note"`
	}

	var response []TimeLogResponse
	for _, l := range logs {
		username := ""
		if u := usersMap[l.UserID]; u != nil {
			username = u.Username
		}
		resp := TimeLogResponse{
			ID:        l.ID,
			UserID:    l.UserID,
			Username:  username,
			StartTime: l.StartTime.Format("2006-01-02T15:04:05Z07:00"),
			Duration:  l.Duration,
			Note:      l.Note,
		}
		if l.EndTime != nil {
			resp.EndTime = l.EndTime.Format("2006-01-02T15:04:05Z07:00")
		}
		response = append(response, resp)
	}

	return c.Status(fiber.StatusOK).JSON(response)
}

func GetTaskTimeSummary(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	logs, err := db.TaskTimeLog.Select().Where("task_id = ? AND duration > 0", task.ID).All()
	if err != nil {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"total_seconds": 0, "entries": 0})
	}

	var totalDuration int64
	for _, l := range logs {
		totalDuration += l.Duration
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"total_seconds": totalDuration,
		"entries":       len(logs),
	})
}
