package controllers

import (
	"strconv"
	"time"

	"github.com/azhai/gitfolio/database"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/gofiber/fiber/v3"
)

type GroupResponse struct {
	ID           uint   `json:"id"`
	Name         string `json:"name"`
	DisplayName  string `json:"display_name"`
	Description  string `json:"description"`
	Avatar       string `json:"avatar"`
	Website      string `json:"website"`
	Location     string `json:"location"`
	OwnerID      uint   `json:"owner_id"`
	MembersCount int    `json:"members_count"`
	CreatedAt    string `json:"created_at"`
}

func ToGroupResponse(group *models.Group, membersCount int) *GroupResponse {
	return &GroupResponse{
		ID:           group.ID,
		Name:         group.Name,
		DisplayName:  group.DisplayName,
		Description:  group.Description,
		Avatar:       group.Avatar,
		Website:      group.Website,
		Location:     group.Location,
		OwnerID:      group.OwnerID,
		MembersCount: membersCount,
		CreatedAt:    group.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func ListGroups(c fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "30"))

	db := database.GetDB()

	groups, err := db.Group.Select().Skip((page - 1) * perPage).Take(perPage).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch groups"})
	}

	response := make([]*GroupResponse, 0)
	for _, group := range groups {
		membersCount, _ := db.GroupMember.Select().Where("group_id = ?", group.ID).Count("")
		response = append(response, ToGroupResponse(group, int(membersCount)))
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":     response,
		"page":     page,
		"per_page": perPage,
	})
}

func GetGroup(c fiber.Ctx) error {
	name := c.Params("name")

	db := database.GetDB()

	group, err := db.Group.Select().Where("name = ?", name).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Group not found"})
	}

	membersCount, _ := db.GroupMember.Select().Where("group_id = ?", group.ID).Count("")
	return c.Status(fiber.StatusOK).JSON(ToGroupResponse(group, int(membersCount)))
}

func CreateGroup(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)

	var req struct {
		Name        string `json:"name"`
		DisplayName string `json:"display_name"`
		Description string `json:"description"`
		Website     string `json:"website"`
		Location    string `json:"location"`
	}

	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := database.GetDB()

	existingGroup, _ := db.Group.Select().Where("name = ?", req.Name).One()
	if existingGroup != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Group name already exists"})
	}

	group := &models.Group{
		Name:        req.Name,
		DisplayName: req.DisplayName,
		Description: req.Description,
		Website:     req.Website,
		Location:    req.Location,
		OwnerID:     userID,
	}

	err := db.Group.Insert().One(group)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create group"})
	}

	member := &models.GroupMember{
		GroupID: group.ID,
		UserID:  userID,
		Role:    "owner",
	}
	db.GroupMember.Insert().One(member)

	return c.Status(fiber.StatusCreated).JSON(ToGroupResponse(group, 1))
}

type ActivityResponse struct {
	ID           uint   `json:"id"`
	UserID       *uint  `json:"user_id"`
	Username     string `json:"username"`
	RepositoryID *uint  `json:"repository_id"`
	Repository   string `json:"repository"`
	ActivityType string `json:"activity_type"`
	Title        string `json:"title"`
	Content      string `json:"content"`
	CreatedAt    string `json:"created_at"`
}

func ToActivityResponse(activity *models.Activity, user *models.User, repoOwner, repoName string) *ActivityResponse {
	var username string
	if user != nil {
		username = user.Username
	}

	var repo string
	if repoOwner != "" && repoName != "" {
		repo = repoOwner + "/" + repoName
	}

	return &ActivityResponse{
		ID:           activity.ID,
		UserID:       activity.UserID,
		Username:     username,
		RepositoryID: activity.RepositoryID,
		Repository:   repo,
		ActivityType: activity.ActivityType,
		Title:        activity.Title,
		Content:      activity.Content,
		CreatedAt:    activity.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func ListActivities(c fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "30"))
	userID := c.Query("user_id")

	db := database.GetDB()

	query := db.Activity.Select()
	if userID != "" {
		uid, _ := strconv.ParseUint(userID, 10, 64)
		query = query.Where("user_id = ?", uid)
	}

	activities, err := query.Skip((page - 1) * perPage).Take(perPage).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch activities"})
	}

	response := make([]*ActivityResponse, 0)
	for _, activity := range activities {
		var user *models.User
		var repoOwner, repoName string

		if activity.UserID != nil {
			user, _ = db.User.Select().Where("id = ?", *activity.UserID).One()
		}
		if activity.RepositoryID != nil {
			repo, _ := db.Repository.Select().Where("id = ?", *activity.RepositoryID).One()
			if repo != nil {
				ownerUser, _ := db.User.Select().Where("id = ?", repo.OwnerID).One()
				if ownerUser != nil {
					repoOwner = ownerUser.Username
				}
				repoName = repo.Name
			}
		}

		response = append(response, ToActivityResponse(activity, user, repoOwner, repoName))
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":     response,
		"page":     page,
		"per_page": perPage,
	})
}

func CreateActivity(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)

	var req struct {
		RepositoryID *uint  `json:"repository_id"`
		GroupID      *uint  `json:"group_id"`
		ActivityType string `json:"activity_type"`
		Title        string `json:"title"`
		Content      string `json:"content"`
		TargetID     *uint  `json:"target_id"`
		TargetType   string `json:"target_type"`
	}

	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := database.GetDB()

	activity := &models.Activity{
		UserID:       &userID,
		RepositoryID: req.RepositoryID,
		GroupID:      req.GroupID,
		ActivityType: req.ActivityType,
		Title:        req.Title,
		Content:      req.Content,
		TargetID:     req.TargetID,
		TargetType:   req.TargetType,
	}

	err := db.Activity.Insert().One(activity)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create activity"})
	}

	var user *models.User
	var repoOwner, repoName string

	user, _ = db.User.Select().Where("id = ?", userID).One()
	if req.RepositoryID != nil {
		repo, _ := db.Repository.Select().Where("id = ?", *req.RepositoryID).One()
		if repo != nil {
			ownerUser, _ := db.User.Select().Where("id = ?", repo.OwnerID).One()
			if ownerUser != nil {
				repoOwner = ownerUser.Username
			}
			repoName = repo.Name
		}
	}

	return c.Status(fiber.StatusCreated).JSON(ToActivityResponse(activity, user, repoOwner, repoName))
}

type MilestoneResponse struct {
	ID           uint   `json:"id"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	DueDate      string `json:"due_date"`
	RepositoryID uint   `json:"repository_id"`
	IsClosed     bool   `json:"is_closed"`
	CreatedAt    string `json:"created_at"`
}

func ToMilestoneResponse(milestone *models.Milestone) *MilestoneResponse {
	var dueDate string
	if milestone.DueDate != nil {
		dueDate = milestone.DueDate.Format("2006-01-02")
	}

	return &MilestoneResponse{
		ID:           milestone.ID,
		Title:        milestone.Title,
		Description:  milestone.Description,
		DueDate:      dueDate,
		RepositoryID: milestone.RepositoryID,
		IsClosed:     milestone.IsClosed,
		CreatedAt:    milestone.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func ListMilestones(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	milestones, err := db.Milestone.Select().Where("repository_id = ?", repo.ID).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch milestones"})
	}

	response := make([]*MilestoneResponse, 0)
	for _, m := range milestones {
		response = append(response, ToMilestoneResponse(m))
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"data": response})
}

func CreateMilestone(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")

	var req struct {
		Title       string  `json:"title"`
		Description string  `json:"description"`
		DueDate     *string `json:"due_date"`
	}

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

	milestone := &models.Milestone{
		Title:        req.Title,
		Description:  req.Description,
		RepositoryID: repo.ID,
	}

	if req.DueDate != nil {
		t, err := time.Parse("2006-01-02", *req.DueDate)
		if err == nil {
			milestone.DueDate = &t
		}
	}

	err = db.Milestone.Insert().One(milestone)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create milestone"})
	}

	return c.Status(fiber.StatusCreated).JSON(ToMilestoneResponse(milestone))
}
