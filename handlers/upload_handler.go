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

// UploadGroupAvatar 上传团队头像，仅团队所有者或管理员可操作
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

// UploadUserAvatar 上传用户头像，仅本人或管理员可操作
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

	if currentUser.Role != "admin" && currentUser.ID != targetUser.ID {
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

// isValidImageFile 校验上传文件是否为合法图片格式
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
