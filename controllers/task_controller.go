package controllers

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"

	"github.com/azhai/gitfolio/database"
	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
)

type TaskResponse struct {
	ID            uint                 `json:"id"`
	Title         string               `json:"title"`
	Draft         string               `json:"draft"`
	Goal          string               `json:"goal"`
	PreviewImage  string               `json:"preview_image,omitempty"`
	Status        string               `json:"status"`
	Priority      int                  `json:"priority"`
	SortOrder     int                  `json:"sort_order"`
	RepositoryID  uint                 `json:"repository_id"`
	Initiator     string               `json:"initiator"`
	InitiatorID   uint                 `json:"initiator_id"`
	Verifier      string               `json:"verifier,omitempty"`
	VerifierID    *uint                `json:"verifier_id,omitempty"`
	Handler       string               `json:"handler,omitempty"`
	HandlerID     *uint                `json:"handler_id,omitempty"`
	Schedules     []TaskScheduleResp   `json:"schedules,omitempty"`
	Attachments   []TaskAttachmentResp `json:"attachments,omitempty"`
	Issues        []TaskIssueResp      `json:"issues,omitempty"`
	CreatedAt     string               `json:"created_at"`
	UpdatedAt     string               `json:"updated_at"`
	LastHandledAt string               `json:"last_handled_at,omitempty"`
}

type TaskIssueResp struct {
	ID     uint   `json:"id"`
	Title  string `json:"title"`
	Status string `json:"status"`
	Number int    `json:"number"`
}

type TaskScheduleResp struct {
	ID              uint   `json:"id"`
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
	ID       uint   `json:"id"`
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

func ListTasks(c fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "30"))
	status := c.Query("status", "")
	priority := c.Query("priority", "")

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	query := db.Task.Select().Where("repository_id = ?", result.Repo.ID)

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if priority != "" {
		query = query.Where("priority = ?", priority)
	}

	tasks, err := query.Skip((page - 1) * perPage).Take(perPage).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch tasks"})
	}

	userIDs := make(map[uint]bool)
	for _, task := range tasks {
		if task.InitiatorID != 0 {
			userIDs[task.InitiatorID] = true
		}
		if task.VerifierID != nil && *task.VerifierID != 0 {
			userIDs[*task.VerifierID] = true
		}
		if task.HandlerID != nil && *task.HandlerID != 0 {
			userIDs[*task.HandlerID] = true
		}
	}

	usersMap := make(map[uint]*models.User)
	for userID := range userIDs {
		user, err := db.User.Select().Where("id = ?", userID).One()
		if err == nil {
			usersMap[userID] = user
		}
	}

	var response []TaskResponse
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
		"page":     page,
		"per_page": perPage,
	})
}

func GetTask(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	initiator, _ := db.User.Select().Where("id = ?", task.InitiatorID).One()

	var verifier *models.User
	if task.VerifierID != nil {
		verifier, _ = db.User.Select().Where("id = ?", *task.VerifierID).One()
	}

	var handler *models.User
	if task.HandlerID != nil {
		handler, _ = db.User.Select().Where("id = ?", *task.HandlerID).One()
	}

	schedules := getTaskSchedules(db, task.ID)
	attachments := getTaskAttachments(db, task.ID)
	issues := getTaskIssues(db, task.ID)

	return c.Status(fiber.StatusOK).JSON(ToTaskResponse(task, initiator, verifier, handler, schedules, attachments, issues))
}

func getTaskSchedules(db *database.Database, taskID uint) []TaskScheduleResp {
	schedules, err := db.TaskSchedule.Select().Where("task_id = ?", taskID).All()
	if err != nil {
		return []TaskScheduleResp{}
	}

	userIDs := make(map[uint]bool)
	for _, s := range schedules {
		if s.User1ID != nil && *s.User1ID != 0 {
			userIDs[*s.User1ID] = true
		}
		if s.User2ID != nil && *s.User2ID != 0 {
			userIDs[*s.User2ID] = true
		}
		if s.User3ID != nil && *s.User3ID != 0 {
			userIDs[*s.User3ID] = true
		}
	}

	usersMap := make(map[uint]*models.User)
	for userID := range userIDs {
		user, err := db.User.Select().Where("id = ?", userID).One()
		if err == nil {
			usersMap[userID] = user
		}
	}

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

func getTaskAttachments(db *database.Database, taskID uint) []TaskAttachmentResp {
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

func getTaskIssues(db *database.Database, taskID uint) []TaskIssueResp {
	taskIssues, err := db.TaskIssue.Select().Where("task_id = ?", taskID).All()
	if err != nil {
		return []TaskIssueResp{}
	}

	var issueIDs []uint
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

	db := database.GetDB()

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

	if req.Verifier != "" {
		verifierUser, err := db.User.Select().Where("username = ?", req.Verifier).One()
		if err == nil {
			task.VerifierID = &verifierUser.ID
		}
	}

	if req.Handler != "" {
		handlerUser, err := db.User.Select().Where("username = ?", req.Handler).One()
		if err == nil {
			task.HandlerID = &handlerUser.ID
		}
	}

	err = db.Task.Insert().One(task)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create task"})
	}

	for _, s := range req.Schedules {
		schedule := &models.TaskSchedule{
			TaskID:       task.ID,
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

		if s.User1 != "" {
			u, err := db.User.Select().Where("username = ?", s.User1).One()
			if err == nil {
				schedule.User1ID = &u.ID
			}
		}
		if s.User2 != "" {
			u, err := db.User.Select().Where("username = ?", s.User2).One()
			if err == nil {
				schedule.User2ID = &u.ID
			}
		}
		if s.User3 != "" {
			u, err := db.User.Select().Where("username = ?", s.User3).One()
			if err == nil {
				schedule.User3ID = &u.ID
			}
		}

		db.TaskSchedule.Insert().One(schedule)
	}

	initiator, _ := db.User.Select().Where("id = ?", task.InitiatorID).One()

	var verifier *models.User
	if task.VerifierID != nil {
		verifier, _ = db.User.Select().Where("id = ?", *task.VerifierID).One()
	}

	var handler *models.User
	if task.HandlerID != nil {
		handler, _ = db.User.Select().Where("id = ?", *task.HandlerID).One()
	}

	schedules := getTaskSchedules(db, task.ID)
	issues := getTaskIssues(db, task.ID)

	return c.Status(fiber.StatusCreated).JSON(ToTaskResponse(task, initiator, verifier, handler, schedules, nil, issues))
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

	db := database.GetDB()

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
		verifierUser, err := db.User.Select().Where("username = ?", req.Verifier).One()
		if err == nil {
			task.VerifierID = &verifierUser.ID
		}
	}

	if req.Handler != "" {
		handlerUser, err := db.User.Select().Where("username = ?", req.Handler).One()
		if err == nil {
			task.HandlerID = &handlerUser.ID
		}
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
			schedule := &models.TaskSchedule{
				TaskID:       task.ID,
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

			if s.User1 != "" {
				u, err := db.User.Select().Where("username = ?", s.User1).One()
				if err == nil {
					schedule.User1ID = &u.ID
				}
			}
			if s.User2 != "" {
				u, err := db.User.Select().Where("username = ?", s.User2).One()
				if err == nil {
					schedule.User2ID = &u.ID
				}
			}
			if s.User3 != "" {
				u, err := db.User.Select().Where("username = ?", s.User3).One()
				if err == nil {
					schedule.User3ID = &u.ID
				}
			}

			db.TaskSchedule.Insert().One(schedule)
		}
	}

	initiator, _ := db.User.Select().Where("id = ?", task.InitiatorID).One()

	var verifier *models.User
	if task.VerifierID != nil {
		verifier, _ = db.User.Select().Where("id = ?", *task.VerifierID).One()
	}

	var handler *models.User
	if task.HandlerID != nil {
		handler, _ = db.User.Select().Where("id = ?", *task.HandlerID).One()
	}

	schedules := getTaskSchedules(db, task.ID)
	attachments := getTaskAttachments(db, task.ID)
	issues := getTaskIssues(db, task.ID)

	return c.Status(fiber.StatusOK).JSON(ToTaskResponse(task, initiator, verifier, handler, schedules, attachments, issues))
}

func DeleteTask(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

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
		IssueID uint `json:"issue_id"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := database.GetDB()

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

	db := database.GetDB()

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

	db := database.GetDB()

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

	db := database.GetDB()

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
