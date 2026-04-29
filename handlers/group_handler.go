package handlers

import (
	"strconv"
	"time"

	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent"
	"github.com/gofiber/fiber/v3"
)

type GroupResponse struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	DisplayName  string `json:"display_name"`
	Description  string `json:"description"`
	Avatar       string `json:"avatar"`
	Website      string `json:"website"`
	Location     string `json:"location"`
	OwnerID      int64  `json:"owner_id"`
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

// findGroupByName 根据名称查找群组
func findGroupByName(db *models.Database, name string) (*models.Group, error) {
	return db.Group.Select().Filter(
		goent.Equals(db.Group.Field("name"), name),
	).One()
}

// getGroupMembersCount 查询群组成员数
func getGroupMembersCount(db *models.Database, groupID int64) int {
	count, _ := db.GroupMember.Select().Filter(
		goent.Equals(db.GroupMember.Field("group_id"), groupID),
	).Count("id")
	return int(count)
}

// batchGetGroupMembersCount 批量查询群组成员数
func batchGetGroupMembersCount(db *models.Database, groupIDs []int64) map[int64]int {
	result := make(map[int64]int)
	if len(groupIDs) == 0 {
		return result
	}

	members, err := db.GroupMember.Select("group_id").Filter(
		goent.In(db.GroupMember.Field("group_id"), groupIDs),
	).All()
	if err != nil {
		return result
	}

	for _, m := range members {
		result[m.GroupID]++
	}
	return result
}

// checkGroupAdmin 检查当前用户是否为群组管理员或所有者
func checkGroupAdmin(db *models.Database, groupID, userID int64) error {
	member, err := db.GroupMember.Select().Filter(
		goent.And(
			goent.Equals(db.GroupMember.Field("group_id"), groupID),
			goent.Equals(db.GroupMember.Field("user_id"), userID),
		),
	).One()
	if err != nil || (member.Role != "owner" && member.Role != "admin") {
		return fiber.NewError(fiber.StatusForbidden, "Only group owners or admins can perform this action")
	}
	return nil
}

func ListGroups(c fiber.Ctx) error {
	pagination := helpers.GetPagination(c)

	db := models.GetDB()

	groups, err := db.Group.Select().Skip(helpers.GetOffset(pagination.Page, pagination.PerPage)).Take(pagination.PerPage).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch groups"})
	}

	var groupIDs []int64
	for _, group := range groups {
		groupIDs = append(groupIDs, group.ID)
	}

	membersCountMap := batchGetGroupMembersCount(db, groupIDs)

	response := make([]*GroupResponse, 0, len(groups))
	for _, group := range groups {
		response = append(response, ToGroupResponse(group, membersCountMap[group.ID]))
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":     response,
		"page":     pagination.Page,
		"per_page": pagination.PerPage,
	})
}

func GetGroup(c fiber.Ctx) error {
	name := c.Params("name")

	db := models.GetDB()

	group, err := findGroupByName(db, name)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Group not found"})
	}

	return c.Status(fiber.StatusOK).JSON(ToGroupResponse(group, getGroupMembersCount(db, group.ID)))
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

	db := models.GetDB()

	existingGroup, _ := findGroupByName(db, req.Name)
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

func UpdateGroup(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)
	name := c.Params("name")

	var req struct {
		DisplayName string `json:"display_name"`
		Description string `json:"description"`
		Website     string `json:"website"`
		Location    string `json:"location"`
		Avatar      string `json:"avatar"`
	}

	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := models.GetDB()

	group, err := findGroupByName(db, name)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Group not found"})
	}

	if err := checkGroupAdmin(db, group.ID, userID); err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	if req.DisplayName != "" {
		group.DisplayName = req.DisplayName
	}
	if req.Description != "" {
		group.Description = req.Description
	}
	if req.Website != "" {
		group.Website = req.Website
	}
	if req.Location != "" {
		group.Location = req.Location
	}
	if req.Avatar != "" {
		group.Avatar = req.Avatar
	}

	err = db.Group.Save().One(group)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update group"})
	}

	return c.Status(fiber.StatusOK).JSON(ToGroupResponse(group, getGroupMembersCount(db, group.ID)))
}

type ActivityResponse struct {
	ID           int64  `json:"id"`
	UserID       *int64 `json:"user_id"`
	Username     string `json:"username"`
	RepositoryID *int64 `json:"repository_id"`
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

// collectActivityUserAndRepoIDs 从活动列表中收集用户 ID 和仓库 ID
func collectActivityUserAndRepoIDs(activities []*models.Activity) (userIDs, repoIDs []int64) {
	for _, activity := range activities {
		if activity.UserID != nil {
			userIDs = append(userIDs, *activity.UserID)
		}
		if activity.RepositoryID != nil {
			repoIDs = append(repoIDs, *activity.RepositoryID)
		}
	}
	return
}

// batchGetReposWithOwners 批量查询仓库及其所有者，返回仓库和所有者映射
func batchGetReposWithOwners(db *models.Database, repoIDs []int64) (map[int64]*models.Repository, map[int64]*models.User) {
	reposMap := make(map[int64]*models.Repository)
	ownersMap := make(map[int64]*models.User)
	if len(repoIDs) == 0 {
		return reposMap, ownersMap
	}

	repos, err := db.Repository.Select().Filter(
		goent.In(db.Repository.Field("id"), repoIDs),
	).All()
	if err != nil {
		return reposMap, ownersMap
	}

	var ownerIDs []int64
	for _, r := range repos {
		reposMap[r.ID] = r
		ownerIDs = append(ownerIDs, r.OwnerID)
	}

	ownersMap = helpers.BatchGetUsers(db, ownerIDs)
	return reposMap, ownersMap
}

func ListActivities(c fiber.Ctx) error {
	pagination := helpers.GetPagination(c)
	userID := c.Query("user_id")

	db := models.GetDB()

	conds := []goent.Condition{}
	if userID != "" {
		uid, _ := strconv.ParseUint(userID, 10, 64)
		conds = append(conds, goent.Equals(db.Activity.Field("user_id"), uid))
	}

	var activities []*models.Activity
	var err error
	if len(conds) > 0 {
		activities, err = db.Activity.Select().Filter(conds...).Skip(helpers.GetOffset(pagination.Page, pagination.PerPage)).Take(pagination.PerPage).All()
	} else {
		activities, err = db.Activity.Select().Skip(helpers.GetOffset(pagination.Page, pagination.PerPage)).Take(pagination.PerPage).All()
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch activities"})
	}

	userIDs, repoIDs := collectActivityUserAndRepoIDs(activities)
	usersMap := helpers.BatchGetUsers(db, userIDs)
	reposMap, ownersMap := batchGetReposWithOwners(db, repoIDs)

	response := make([]*ActivityResponse, 0, len(activities))
	for _, activity := range activities {
		var user *models.User
		var repoOwner, repoName string

		if activity.UserID != nil {
			user = usersMap[*activity.UserID]
		}
		if activity.RepositoryID != nil {
			repo := reposMap[*activity.RepositoryID]
			if repo != nil {
				ownerUser := ownersMap[repo.OwnerID]
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
		"page":     pagination.Page,
		"per_page": pagination.PerPage,
	})
}

func CreateActivity(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)

	var req struct {
		RepositoryID *int64 `json:"repository_id"`
		GroupID      *int64 `json:"group_id"`
		ActivityType string `json:"activity_type"`
		Title        string `json:"title"`
		Content      string `json:"content"`
		TargetID     *int64 `json:"target_id"`
		TargetType   string `json:"target_type"`
	}

	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := models.GetDB()

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

	user := helpers.GetUser(db, userID)

	var repoOwner, repoName string
	if req.RepositoryID != nil {
		reposMap, ownersMap := batchGetReposWithOwners(db, []int64{*req.RepositoryID})
		repo := reposMap[*req.RepositoryID]
		if repo != nil {
			ownerUser := ownersMap[repo.OwnerID]
			if ownerUser != nil {
				repoOwner = ownerUser.Username
			}
			repoName = repo.Name
		}
	}

	return c.Status(fiber.StatusCreated).JSON(ToActivityResponse(activity, user, repoOwner, repoName))
}

type MilestoneResponse struct {
	ID           int64  `json:"id"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	DueDate      string `json:"due_date"`
	RepositoryID int64  `json:"repository_id"`
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
	result, err := helpers.GetOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	milestones, err := db.Milestone.Select().Filter(
		goent.Equals(db.Milestone.Field("repository_id"), result.Repo.ID),
	).All()
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
	var req struct {
		Title       string  `json:"title"`
		Description string  `json:"description"`
		DueDate     *string `json:"due_date"`
	}

	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	milestone := &models.Milestone{
		Title:        req.Title,
		Description:  req.Description,
		RepositoryID: result.Repo.ID,
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
