package helpers

import (
	"strings"

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

// 系统角色与团队成员角色
const (
	SysRoleAdmin = "admin"
	SysRoleGuest = "guest"
)

// 团队成员角色。GroupRoleLeader 是历史遗留值，等同于管理员。
const (
	GroupRoleOwner  = "owner"
	GroupRoleAdmin  = "admin"
	GroupRoleLeader = "leader"
	GroupRoleMember = "member"
)

// GroupAccess 描述当前用户在团队中的权限级别，级别越高权限越大。
type GroupAccess int

const (
	// GroupAccessNone 非团队成员
	GroupAccessNone GroupAccess = iota
	// GroupAccessMember 普通成员
	GroupAccessMember
	// GroupAccessAdmin 团队管理员或所有者
	GroupAccessAdmin
)

// groupMemberLevel 把成员角色字符串映射为权限级别，未知或空角色按普通成员处理。
func groupMemberLevel(role string) GroupAccess {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case GroupRoleOwner, GroupRoleAdmin, GroupRoleLeader:
		return GroupAccessAdmin
	default:
		return GroupAccessMember
	}
}

// CheckGroupAccess 返回当前用户在指定团队中的权限级别。
// 系统管理员始终为 Admin；游客与未登录用户为 None；
// 团队创建者（Group.OwnerID）即使没有成员记录也视为 Admin。
func CheckGroupAccess(c fiber.Ctx, groupID int64) GroupAccess {
	role := middleware.GetCurrentUserRole(c)
	if role == SysRoleAdmin {
		return GroupAccessAdmin
	}
	if role == SysRoleGuest {
		return GroupAccessNone
	}
	userID := middleware.GetCurrentUserID(c)
	if userID == 0 || groupID == 0 {
		return GroupAccessNone
	}
	db := models.GetDB()
	if group, err := db.Group.Select().Where("id = ?", groupID).One(); err == nil && group != nil && group.OwnerID == userID {
		return GroupAccessAdmin
	}
	member, err := db.GroupMember.Select().Where("group_id = ? AND user_id = ?", groupID, userID).One()
	if err != nil || member == nil {
		return GroupAccessNone
	}
	return groupMemberLevel(member.Role)
}

// CheckGroupMemberPermission 检查当前用户是否为团队成员
func CheckGroupMemberPermission(c fiber.Ctx, groupID int64) bool {
	return CheckGroupAccess(c, groupID) >= GroupAccessMember
}

// CheckGroupAdminPermission 检查当前用户是否为团队管理员或所有者
func CheckGroupAdminPermission(c fiber.Ctx, groupID int64) bool {
	return CheckGroupAccess(c, groupID) >= GroupAccessAdmin
}

// RequireGroupMember 要求当前用户为团队成员，否则返回 403
func RequireGroupMember(c fiber.Ctx, groupID int64) error {
	if !CheckGroupMemberPermission(c, groupID) {
		return JSONError(c, HTTPStatusForbidden, "Access denied")
	}
	return nil
}

// RequireGroupAdmin 要求当前用户为团队管理员或所有者，否则返回 403
func RequireGroupAdmin(c fiber.Ctx, groupID int64) error {
	if !CheckGroupAdminPermission(c, groupID) {
		return JSONError(c, HTTPStatusForbidden, "Access denied")
	}
	return nil
}

// RepoAccess 描述当前用户对仓库的权限级别。
type RepoAccess int

const (
	// RepoAccessNone 不可见
	RepoAccessNone RepoAccess = iota
	// RepoAccessRead 可浏览代码、议题与 PR
	RepoAccessRead
	// RepoAccessWrite 可提交代码与修改设置
	RepoAccessWrite
	// RepoAccessAdmin 可删除、转移与管理同步配置
	RepoAccessAdmin
)

// CheckRepoAccess 计算当前用户对仓库的权限级别。
//
//   - 系统管理员：Admin
//   - 游客：None
//   - 仓库所有者（个人为本人，团队为管理员/所有者）：Admin
//   - 私有项目：团队成员可读，其余不可见
//   - 公开项目（public/mirror）与本地项目：登录用户可读
//   - 本地项目不对匿名用户开放
func CheckRepoAccess(c fiber.Ctx, r *ResourceResult) RepoAccess {
	if r == nil || r.Repo == nil {
		return RepoAccessNone
	}
	role := middleware.GetCurrentUserRole(c)
	if role == SysRoleAdmin {
		return RepoAccessAdmin
	}
	if role == SysRoleGuest {
		return RepoAccessNone
	}
	userID := middleware.GetCurrentUserID(c)

	if isRepoOwner(c, r, userID) {
		return RepoAccessAdmin
	}

	if r.Repo.IsLocal() && userID == 0 {
		return RepoAccessNone
	}

	if r.Repo.IsPrivate() {
		if r.Repo.IsGroupOwned() && r.Group != nil &&
			CheckGroupAccess(c, r.Group.ID) >= GroupAccessMember {
			return RepoAccessRead
		}
		return RepoAccessNone
	}

	if userID == 0 {
		return RepoAccessRead
	}
	return RepoAccessRead
}

// isRepoOwner 判断当前用户是否为仓库的所有者（团队仓库要求管理员级别）。
func isRepoOwner(c fiber.Ctx, r *ResourceResult, userID int64) bool {
	if r.Repo.IsGroupOwned() {
		if r.Group != nil {
			return CheckGroupAccess(c, r.Group.ID) >= GroupAccessAdmin
		}
		return false
	}
	if r.Owner != nil {
		return userID != 0 && userID == r.Owner.ID
	}
	// 迁移前遗留的无归属仓库：登录用户按所有者处理，由管理员后续转移。
	return userID != 0
}

// CheckRepoReadPermission 检查当前用户是否可以浏览仓库
func CheckRepoReadPermission(c fiber.Ctx, r *ResourceResult) bool {
	return CheckRepoAccess(c, r) >= RepoAccessRead
}

// CheckRepoAdminPermission 检查当前用户是否可以管理仓库
func CheckRepoAdminPermission(c fiber.Ctx, r *ResourceResult) bool {
	return CheckRepoAccess(c, r) >= RepoAccessAdmin
}
