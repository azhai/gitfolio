package helpers

import (
	"github.com/azhai/gitfolio/models"
	"github.com/gofiber/fiber/v3"
)

// ResourceResult 资源查找结果，包含仓库所有者和仓库实体
type ResourceResult struct {
	Owner *models.User
	Repo  *models.Repository
}

// GetOwnerAndRepo 根据用户名和仓库名查找所有者和仓库
func GetOwnerAndRepo(c fiber.Ctx, ownerUsername, repoName string) (*ResourceResult, error) {
	db := models.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", ownerUsername).One()
	if err != nil {
		return nil, JSONError(c, HTTPStatusNotFound, "Owner not found")
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return nil, JSONError(c, HTTPStatusNotFound, "Repository not found")
	}

	if ownerUser == nil || repo == nil {
		return nil, JSONError(c, HTTPStatusNotFound, "Owner or repository not found")
	}

	return &ResourceResult{
		Owner: ownerUser,
		Repo:  repo,
	}, nil
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

// RequireOwnerAndRepo 查找仓库并验证当前用户为仓库所有者
func RequireOwnerAndRepo(c fiber.Ctx, ownerUsername, repoName string) (*ResourceResult, error) {
	result, err := GetOwnerAndRepo(c, ownerUsername, repoName)
	if err != nil {
		return nil, err
	}

	if result == nil || result.Repo == nil {
		return nil, JSONError(c, HTTPStatusNotFound, "Repository not found")
	}

	if err := RequireOwner(c, result.Repo.OwnerID); err != nil {
		return nil, err
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
func GetOwnerAndRepoWithPrivateAccess(c fiber.Ctx, ownerUsername, repoName string) (*ResourceResult, error) {
	result, err := GetOwnerAndRepo(c, ownerUsername, repoName)
	if err != nil {
		return nil, err
	}

	if result == nil || result.Repo == nil {
		return nil, JSONError(c, HTTPStatusNotFound, "Repository not found")
	}

	if err := RequirePrivateAccess(c, result.Repo.IsPrivate(), result.Repo.OwnerID); err != nil {
		return nil, err
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
