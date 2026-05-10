package helpers

import (
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/gofiber/fiber/v3"
)

// CheckOwnerPermission 检查当前用户是否为资源所有者
func CheckOwnerPermission(c fiber.Ctx, ownerID int64) bool {
	role := middleware.GetCurrentUserRole(c)
	if role == "admin" {
		return true
	}
	if role == "guest" {
		return false
	}
	userID := middleware.GetCurrentUserID(c)
	return userID != 0 && userID == ownerID
}

// RequireOwner 要求当前用户为资源所有者，否则返回 403
func RequireOwner(c fiber.Ctx, ownerID int64) error {
	if !CheckOwnerPermission(c, ownerID) {
		return JSONError(c, HTTPStatusForbidden, "Access denied")
	}
	return nil
}

// CheckUserPermission 检查当前用户是否为指定用户
func CheckUserPermission(c fiber.Ctx, userID *int64) bool {
	role := middleware.GetCurrentUserRole(c)
	if role == "admin" {
		return true
	}
	if role == "guest" {
		return false
	}
	if userID == nil {
		return false
	}
	currentUserID := middleware.GetCurrentUserID(c)
	return currentUserID != 0 && currentUserID == *userID
}

// RequireUser 要求当前用户为指定用户，否则返回 403
func RequireUser(c fiber.Ctx, userID *int64) error {
	if !CheckUserPermission(c, userID) {
		return JSONError(c, HTTPStatusForbidden, "Access denied")
	}
	return nil
}

// CheckPrivateAccess 检查私有资源访问权限，公开资源直接放行
func CheckPrivateAccess(c fiber.Ctx, isPrivate bool, ownerID int64) bool {
	if !isPrivate {
		return true
	}
	return CheckOwnerPermission(c, ownerID)
}

// RequirePrivateAccess 要求私有资源访问权限，公开资源直接放行
func RequirePrivateAccess(c fiber.Ctx, isPrivate bool, ownerID int64) error {
	if !CheckPrivateAccess(c, isPrivate, ownerID) {
		return JSONError(c, HTTPStatusForbidden, "Access denied")
	}
	return nil
}

// GetCurrentUserID 获取当前登录用户 ID，未登录返回 0
func GetCurrentUserID(c fiber.Ctx) int64 {
	return middleware.GetCurrentUserID(c)
}

// IsAuthenticated 检查当前请求是否已认证
func IsAuthenticated(c fiber.Ctx) bool {
	return middleware.GetCurrentUserID(c) != 0
}

// RequireAuth 要求请求已认证，否则返回 401
func RequireAuth(c fiber.Ctx) error {
	if !IsAuthenticated(c) {
		return JSONError(c, HTTPStatusUnauthorized, "Authentication required")
	}
	return nil
}

// CheckGroupAdminPermission 检查当前用户是否为团队管理员或所有者
func CheckGroupAdminPermission(c fiber.Ctx, groupID int64) bool {
	role := middleware.GetCurrentUserRole(c)
	if role == "admin" {
		return true
	}
	if role == "guest" {
		return false
	}
	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return false
	}
	db := models.GetDB()
	member, err := db.GroupMember.Select().Where("group_id = ? AND user_id = ?", groupID, userID).One()
	if err != nil || member == nil {
		return false
	}
	return member.Role == "owner" || member.Role == "admin"
}

// RequireGroupAdmin 要求当前用户为团队管理员或所有者，否则返回 403
func RequireGroupAdmin(c fiber.Ctx, groupID int64) error {
	if !CheckGroupAdminPermission(c, groupID) {
		return JSONError(c, HTTPStatusForbidden, "Access denied")
	}
	return nil
}

// CheckGroupMemberPermission 检查当前用户是否为团队成员
func CheckGroupMemberPermission(c fiber.Ctx, groupID int64) bool {
	role := middleware.GetCurrentUserRole(c)
	if role == "admin" {
		return true
	}
	if role == "guest" {
		return false
	}
	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return false
	}
	db := models.GetDB()
	member, err := db.GroupMember.Select().Where("group_id = ? AND user_id = ?", groupID, userID).One()
	return err == nil && member != nil
}

// RequireGroupMember 要求当前用户为团队成员，否则返回 403
func RequireGroupMember(c fiber.Ctx, groupID int64) error {
	if !CheckGroupMemberPermission(c, groupID) {
		return JSONError(c, HTTPStatusForbidden, "Access denied")
	}
	return nil
}
