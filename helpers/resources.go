package helpers

import (
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/gofiber/fiber/v3"
)

// ResourceResult 资源查找结果，包含仓库所有者和仓库实体
type ResourceResult struct {
	Owner *models.User
	Group *models.Group
	Repo  *models.Repository
}

// OwnerName 返回仓库所有者的名称，无归属的项目返回 "local"
func (r *ResourceResult) OwnerName() string {
	if r.Owner != nil {
		return r.Owner.Username
	}
	if r.Group != nil {
		return r.Group.Name
	}
	return "local"
}

// OwnerID 返回仓库所有者的账号 ID，无归属时返回 0
func (r *ResourceResult) OwnerID() int64 {
	if r.Owner != nil {
		return r.Owner.ID
	}
	if r.Group != nil {
		return r.Group.ID
	}
	return 0
}

// RepoRoot 返回所有者的自有仓库目录，未设置时返回空字符串
// （此时仓库落在全局裸仓库目录下）。
func (r *ResourceResult) RepoRoot() string {
	if r.Owner != nil {
		return r.Owner.RepoRoot
	}
	if r.Group != nil {
		return r.Group.RepoRoot
	}
	return ""
}

// FindOwnerAndRepo resolves an owner/repo pair without touching the request
// context. It returns nil when either side is missing, so callers that have no
// response to write (the page router, background jobs) can test for existence.
func FindOwnerAndRepo(ownerName, repoName string) *ResourceResult {
	db := models.GetDB()
	if db == nil || ownerName == "" || repoName == "" {
		return nil
	}

	// 用户名和团队名共享同一个命名空间，但仓库归属不同（owner_type）。
	ownerUser, _ := db.User.Select().Where("username = ?", ownerName).One()
	if ownerUser != nil {
		repo, err := db.Repository.Select().Where("owner_id = ? AND owner_type = 'user' AND name = ?", ownerUser.ID, repoName).One()
		if err == nil && repo != nil {
			return &ResourceResult{Owner: ownerUser, Repo: repo}
		}
	} else {
		ownerUser = nil
	}

	group, _ := db.Group.Select().Where("name = ?", ownerName).One()
	if group != nil {
		repo, err := db.Repository.Select().Where("owner_id = ? AND owner_type = 'group' AND name = ?", group.ID, repoName).One()
		if err == nil && repo != nil {
			return &ResourceResult{Group: group, Repo: repo}
		}
	}

	// 只允许用 "local" 这个展示名访问没有归属的遗留仓库。
	// 之前这里按仓库名匹配任意 local 项目，导致 /任意用户名/仓库名 能拿到别人的仓库。
	if ownerName == "local" {
		repo, err := db.Repository.Select().Where("owner_id = 0 AND project_type = 'local' AND name = ?", repoName).One()
		if err == nil && repo != nil {
			return &ResourceResult{Repo: repo}
		}
	}
	return nil
}

// GetOwnerAndRepo 根据用户名或团队名和仓库名查找所有者和仓库
func GetOwnerAndRepo(c fiber.Ctx, ownerName, repoName string) (*ResourceResult, error) {
	if ownerName == "" {
		return nil, JSONError(c, HTTPStatusNotFound, "Owner not found")
	}

	if result := FindOwnerAndRepo(ownerName, repoName); result != nil {
		return result, nil
	}

	db := models.GetDB()
	ownerUser, _ := db.User.Select().Where("username = ?", ownerName).One()
	group, _ := db.Group.Select().Where("name = ?", ownerName).One()
	if ownerUser == nil && group == nil {
		return nil, JSONError(c, HTTPStatusNotFound, "Owner not found")
	}
	return nil, JSONError(c, HTTPStatusNotFound, "Repository not found")
}

// GetOwnerAndRepoFromParams 从 URL 路径参数中提取所有者和仓库名并查找
func GetOwnerAndRepoFromParams(c fiber.Ctx) (*ResourceResult, error) {
	owner := c.Params("owner")
	repoName := c.Params("repo")

	if owner == "" || repoName == "" {
		return nil, JSONError(c, HTTPStatusNotFound, "Owner or repository not specified")
	}

	return GetOwnerAndRepo(c, owner, repoName)
}

// RequireOwnerAndRepo 查找仓库并验证当前用户有管理权限（所有者或团队管理员）
func RequireOwnerAndRepo(c fiber.Ctx, ownerName, repoName string) (*ResourceResult, error) {
	result, err := GetOwnerAndRepo(c, ownerName, repoName)
	if err != nil {
		return nil, err
	}

	if result == nil || result.Repo == nil {
		return nil, JSONError(c, HTTPStatusNotFound, "Repository not found")
	}

	if !CheckRepoAdminPermission(c, result) {
		if middleware.GetCurrentUserRole(c) == SysRoleGuest {
			return nil, JSONError(c, HTTPStatusForbidden, "Guest users cannot manage this project")
		}
		return nil, JSONError(c, HTTPStatusForbidden, "Access denied")
	}

	return result, nil
}

// RequireOwnerAndRepoFromParams 从 URL 路径参数中提取信息并验证所有者权限
func RequireOwnerAndRepoFromParams(c fiber.Ctx) (*ResourceResult, error) {
	owner := c.Params("owner")
	repoName := c.Params("repo")

	if owner == "" || repoName == "" {
		return nil, JSONError(c, HTTPStatusNotFound, "Owner or repository not specified")
	}

	return RequireOwnerAndRepo(c, owner, repoName)
}

// GetOwnerAndRepoWithPrivateAccess 查找仓库，私有仓库需验证访问权限
func GetOwnerAndRepoWithPrivateAccess(c fiber.Ctx, ownerName, repoName string) (*ResourceResult, error) {
	result, err := GetOwnerAndRepo(c, ownerName, repoName)
	if err != nil {
		return nil, err
	}

	if result == nil || result.Repo == nil {
		return nil, JSONError(c, HTTPStatusNotFound, "Repository not found")
	}

	access := CheckRepoAccess(c, result)
	if access == RepoAccessNone {
		if middleware.GetCurrentUserRole(c) == SysRoleGuest {
			return nil, JSONError(c, HTTPStatusForbidden, "Guest users cannot access this project")
		}
		if middleware.GetCurrentUserID(c) == 0 {
			return nil, JSONError(c, HTTPStatusUnauthorized, "Login required to access this project")
		}
		return nil, JSONError(c, HTTPStatusForbidden, "Access denied")
	}

	return result, nil
}

// GetOwnerAndRepoWithPrivateAccessFromParams 从 URL 路径参数中提取信息并验证私有仓库访问权限
func GetOwnerAndRepoWithPrivateAccessFromParams(c fiber.Ctx) (*ResourceResult, error) {
	owner := c.Params("owner")
	repoName := c.Params("repo")

	if owner == "" || repoName == "" {
		return nil, JSONError(c, HTTPStatusNotFound, "Owner or repository not specified")
	}

	return GetOwnerAndRepoWithPrivateAccess(c, owner, repoName)
}
