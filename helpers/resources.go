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

// OwnerName 返回仓库所有者的名称，local 项目返回 "local"
func (r *ResourceResult) OwnerName() string {
	if r.Owner != nil {
		return r.Owner.Username
	}
	if r.Group != nil {
		return r.Group.Name
	}
	return "local"
}

// GetOwnerAndRepo 根据用户名或团队名和仓库名查找所有者和仓库
func GetOwnerAndRepo(c fiber.Ctx, ownerName, repoName string) (*ResourceResult, error) {
	db := models.GetDB()

	ownerUser, _ := db.User.Select().Where("username = ?", ownerName).One()
	if ownerUser != nil {
		repo, err := db.Repository.Select().Where("owner_id = ? AND owner_type = 'user' AND name = ?", ownerUser.ID, repoName).One()
		if err == nil {
			return &ResourceResult{
				Owner: ownerUser,
				Repo:  repo,
			}, nil
		}
	}

	group, _ := db.Group.Select().Where("name = ?", ownerName).One()
	if group != nil {
		repo, err := db.Repository.Select().Where("owner_id = ? AND owner_type = 'group' AND name = ?", group.ID, repoName).One()
		if err == nil {
			return &ResourceResult{
				Group: group,
				Repo:  repo,
			}, nil
		}
	}

	repo, _ := db.Repository.Select().Where("project_type = 'local' AND name = ?", repoName).One()
	if repo != nil {
		return &ResourceResult{
			Repo: repo,
		}, nil
	}

	return nil, JSONError(c, HTTPStatusNotFound, "Owner not found")
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

// RequireOwnerAndRepo 查找仓库并验证当前用户为仓库所有者或团队管理员
func RequireOwnerAndRepo(c fiber.Ctx, ownerName, repoName string) (*ResourceResult, error) {
	result, err := GetOwnerAndRepo(c, ownerName, repoName)
	if err != nil {
		return nil, err
	}

	if result == nil || result.Repo == nil {
		return nil, JSONError(c, HTTPStatusNotFound, "Repository not found")
	}

	if result.Repo.IsLocal() {
		role := middleware.GetCurrentUserRole(c)
		if role == "guest" {
			return nil, JSONError(c, HTTPStatusForbidden, "Guest users cannot manage this project")
		}
	} else if result.Repo.IsGroupOwned() {
		if err := RequireGroupLeader(c, result.Group.ID); err != nil {
			return nil, err
		}
	} else {
		if err := RequireOwner(c, result.Repo.OwnerID); err != nil {
			return nil, err
		}
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

	if result.Repo.IsPrivate() {
		role := middleware.GetCurrentUserRole(c)
		if role == "admin" {
			return result, nil
		}
		if role == "guest" {
			return nil, JSONError(c, HTTPStatusForbidden, "Guest users cannot access this project")
		}
		if result.Repo.IsGroupOwned() {
			if err := RequireGroupMember(c, result.Group.ID); err != nil {
				return nil, err
			}
		} else {
			if err := RequireOwner(c, result.Repo.OwnerID); err != nil {
				return nil, err
			}
		}
	}

	if result.Repo.ProjectType == "local" {
		userID := middleware.GetCurrentUserID(c)
		role := middleware.GetCurrentUserRole(c)
		if userID == 0 {
			return nil, JSONError(c, HTTPStatusForbidden, "Login required to access this project")
		}
		if role == "guest" {
			return nil, JSONError(c, HTTPStatusForbidden, "Guest users cannot access this project")
		}
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
