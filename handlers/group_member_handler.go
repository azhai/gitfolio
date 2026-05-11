package handlers

import (
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent"
	"github.com/gofiber/fiber/v3"
)

// AddGroupMember 添加团队成员，仅所有者或管理员可操作
func AddGroupMember(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)
	name := c.Params("name")

	var req struct {
		Username string `json:"username"`
		Role     string `json:"role"`
	}

	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.Role == "" {
		req.Role = "member"
	}

	if req.Role != "member" && req.Role != "leader" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid role, must be member or leader"})
	}

	db := models.GetDB()

	group, err := db.Group.Select().Where("name = ?", name).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Group not found"})
	}

	currentMember, err := db.GroupMember.Select().Where("group_id = ? AND user_id = ?", group.ID, userID).One()
	if err != nil || currentMember.Role != "leader" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only group leaders can add members"})
	}

	newUser, err := db.User.Select().Where("username = ?", req.Username).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	existingMember, _ := db.GroupMember.Select().Where("group_id = ? AND user_id = ?", group.ID, newUser.ID).One()
	if existingMember != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "User is already a member"})
	}

	member := &models.GroupMember{
		GroupID: group.ID,
		UserID:  newUser.ID,
		Role:    req.Role,
	}

	err = db.GroupMember.Insert().One(member)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to add member"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Member added successfully",
		"user":    ToUserResponse(newUser),
		"role":    req.Role,
	})
}

// RemoveGroupMember 移除团队成员，不可移除所有者
func RemoveGroupMember(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)
	name := c.Params("name")
	targetUsername := c.Params("username")

	db := models.GetDB()

	group, err := db.Group.Select().Where("name = ?", name).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Group not found"})
	}

	currentMember, err := db.GroupMember.Select().Where("group_id = ? AND user_id = ?", group.ID, userID).One()
	if err != nil || currentMember.Role != "leader" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only group leaders can remove members"})
	}

	targetUser, err := db.User.Select().Where("username = ?", targetUsername).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	targetMember, err := db.GroupMember.Select().Where("group_id = ? AND user_id = ?", group.ID, targetUser.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User is not a member"})
	}

	if targetMember.Role == "leader" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Cannot remove the leader"})
	}

	err = db.GroupMember.Delete().Where("group_id = ? AND user_id = ?", group.ID, targetUser.ID).Exec()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to remove member"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Member removed successfully"})
}

// ListGroupMembers 获取团队成员列表，包含用户信息和角色
func ListGroupMembers(c fiber.Ctx) error {
	name := c.Params("name")

	db := models.GetDB()

	group, err := db.Group.Select().Where("name = ?", name).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Group not found"})
	}

	members, err := db.GroupMember.Select().Where("group_id = ?", group.ID).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch members"})
	}

	userIDs := make([]int64, 0, len(members))
	for _, member := range members {
		userIDs = append(userIDs, member.UserID)
	}

	usersMap := make(map[int64]*models.User)
	if len(userIDs) > 0 {
		users, err := db.User.Select().Filter(
			goent.In(db.User.Field("id"), userIDs),
		).All()
		if err == nil {
			for _, u := range users {
				usersMap[u.ID] = u
			}
		}
	}

	type MemberResponse struct {
		User     *UserResponse `json:"user"`
		Role     string        `json:"role"`
		JoinedAt string        `json:"joined_at"`
	}

	response := make([]MemberResponse, 0, len(members))
	for _, member := range members {
		user, ok := usersMap[member.UserID]
		if !ok {
			continue
		}

		response = append(response, MemberResponse{
			User:     ToUserResponse(user),
			Role:     member.Role,
			JoinedAt: member.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"data": response})
}
