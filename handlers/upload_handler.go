package handlers

import (
	"fmt"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/gofiber/fiber/v3"
)

func UploadGroupAvatar(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)
	name := c.Params("name")

	file, err := c.FormFile("avatar")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No file uploaded"})
	}

	if !isValidImageFile(file) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid file type. Only images are allowed"})
	}

	db := models.GetDB()

	group, err := db.Group.Select().Where("name = ?", name).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Group not found"})
	}

	member, err := db.GroupMember.Select().Where("group_id = ? AND user_id = ?", group.ID, userID).One()
	if err != nil || (member.Role != "owner" && member.Role != "admin") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only group owners or admins can upload avatar"})
	}

	uploadDir := "./uploads/avatars/groups"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create upload directory"})
	}

	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%s_%d%s", name, time.Now().Unix(), ext)
	filepath := filepath.Join(uploadDir, filename)

	if err := c.SaveFile(file, filepath); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save file"})
	}

	avatarURL := fmt.Sprintf("/uploads/avatars/groups/%s", filename)
	group.Avatar = avatarURL

	err = db.Group.Save().One(group)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update group"})
	}

	membersCount, _ := db.GroupMember.Select().Where("group_id = ?", group.ID).Count("")
	return c.Status(fiber.StatusOK).JSON(ToGroupResponse(group, int(membersCount)))
}

func UploadUserAvatar(c fiber.Ctx) error {
	currentUserID := middleware.GetCurrentUserID(c)
	targetUsername := c.Params("username")

	file, err := c.FormFile("avatar")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No file uploaded"})
	}

	if !isValidImageFile(file) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid file type. Only images are allowed"})
	}

	db := models.GetDB()

	currentUser, err := db.User.Select().Where("id = ?", currentUserID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Current user not found"})
	}

	targetUser, err := db.User.Select().Where("username = ?", targetUsername).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Target user not found"})
	}

	if !currentUser.IsAdmin && currentUser.ID != targetUser.ID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only admins can update other users' avatar"})
	}

	uploadDir := "./uploads/avatars/users"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create upload directory"})
	}

	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%s_%d%s", targetUsername, time.Now().Unix(), ext)
	filepath := filepath.Join(uploadDir, filename)

	if err := c.SaveFile(file, filepath); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save file"})
	}

	avatarURL := fmt.Sprintf("/uploads/avatars/users/%s", filename)
	targetUser.Avatar = avatarURL

	err = db.User.Save().One(targetUser)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update user"})
	}

	return c.Status(fiber.StatusOK).JSON(ToUserResponse(targetUser))
}

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

	if req.Role != "member" && req.Role != "admin" && req.Role != "owner" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid role"})
	}

	db := models.GetDB()

	group, err := db.Group.Select().Where("name = ?", name).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Group not found"})
	}

	currentMember, err := db.GroupMember.Select().Where("group_id = ? AND user_id = ?", group.ID, userID).One()
	if err != nil || (currentMember.Role != "owner" && currentMember.Role != "admin") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only group owners or admins can add members"})
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
	if err != nil || (currentMember.Role != "owner" && currentMember.Role != "admin") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only group owners or admins can remove members"})
	}

	targetUser, err := db.User.Select().Where("username = ?", targetUsername).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	targetMember, err := db.GroupMember.Select().Where("group_id = ? AND user_id = ?", group.ID, targetUser.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User is not a member"})
	}

	if targetMember.Role == "owner" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Cannot remove the owner"})
	}

	err = db.GroupMember.Delete().Where("group_id = ? AND user_id = ?", group.ID, targetUser.ID).Exec()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to remove member"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Member removed successfully"})
}

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

	type MemberResponse struct {
		User     *UserResponse `json:"user"`
		Role     string        `json:"role"`
		JoinedAt string        `json:"joined_at"`
	}

	response := make([]MemberResponse, 0, len(members))
	for _, member := range members {
		user, err := db.User.Select().Where("id = ?", member.UserID).One()
		if err != nil {
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

func isValidImageFile(file *multipart.FileHeader) bool {
	ext := strings.ToLower(filepath.Ext(file.Filename))
	validExts := map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".gif":  true,
		".webp": true,
	}
	return validExts[ext]
}
