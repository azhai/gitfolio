package helpers

import (
	"github.com/azhai/gitfolio/models"
	"github.com/gofiber/fiber/v3"
)

// ResourceResult 资源查找结果，包含仓库所有者和仓库实体
type ResourceResult struct {
	Owner *models.User
	Group *models.Group
	Repo  *models.Repository
}

// GetOwnerAndRepo 根据用户名或团队名和仓库名查找所有者和仓库
func GetOwnerAndRepo(c fiber.Ctx, ownerName, repoName string) (*ResourceResult, error) {
	db := models.GetDB()

	ownerUser, _ := db.User.Select().Where("username = ?", ownerName).One()
	if ownerUser != nil {
		repo, err := db.Repository.Select().Where("owner_id = ? AND owner_type = 'user' AND name = ?", ownerUser.ID, repoName).One()
		if err != nil {
			return nil, JSONError(c, HTTPStatusNotFound, "Repository not found")
		}
		return &ResourceResult{
			Owner: ownerUser,
			Repo:  repo,
		}, nil
	}

	group, _ := db.Group.Select().Where("name = ?", ownerName).One()
	if group != nil {
		repo, err := db.Repository.Select().Where("owner_id = ? AND owner_type = 'group' AND name = ?", group.ID, repoName).One()
		if err != nil {
			return nil, JSONError(c, HTTPStatusNotFound, "Repository not found")
		}
		return &ResourceResult{
			Group: group,
			Repo:  repo,
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

	if result.Repo.IsGroupOwned() {
		if err := RequireGroupAdmin(c, result.Group.ID); err != nil {
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

	if result.Repo.IsMirror() {
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
