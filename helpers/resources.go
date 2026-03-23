package helpers

import (
	"github.com/azhai/gitfolio/database"
	"github.com/azhai/gitfolio/models"
	"github.com/gofiber/fiber/v3"
)

type ResourceResult struct {
	Owner *models.User
	Repo  *models.Repository
}

func GetOwnerAndRepo(c fiber.Ctx, ownerUsername, repoName string) (*ResourceResult, error) {
	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", ownerUsername).One()
	if err != nil {
		return nil, JSONError(c, HTTPStatusNotFound, "Owner not found")
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return nil, JSONError(c, HTTPStatusNotFound, "Repository not found")
	}

	return &ResourceResult{
		Owner: ownerUser,
		Repo:  repo,
	}, nil
}

func GetOwnerAndRepoFromParams(c fiber.Ctx) (*ResourceResult, error) {
	owner := c.Params("owner")
	repoName := c.Params("repo")

	if owner == "" || repoName == "" {
		return nil, JSONError(c, HTTPStatusNotFound, "Owner or repository not specified")
	}

	return GetOwnerAndRepo(c, owner, repoName)
}

func RequireOwnerAndRepo(c fiber.Ctx, ownerUsername, repoName string) (*ResourceResult, error) {
	result, err := GetOwnerAndRepo(c, ownerUsername, repoName)
	if err != nil {
		return nil, err
	}

	if err := RequireOwner(c, result.Repo.OwnerID); err != nil {
		return nil, err
	}

	return result, nil
}

func RequireOwnerAndRepoFromParams(c fiber.Ctx) (*ResourceResult, error) {
	owner := c.Params("owner")
	repoName := c.Params("repo")

	if owner == "" || repoName == "" {
		return nil, JSONError(c, HTTPStatusNotFound, "Owner or repository not specified")
	}

	return RequireOwnerAndRepo(c, owner, repoName)
}

func GetOwnerAndRepoWithPrivateAccess(c fiber.Ctx, ownerUsername, repoName string) (*ResourceResult, error) {
	result, err := GetOwnerAndRepo(c, ownerUsername, repoName)
	if err != nil {
		return nil, err
	}

	if err := RequirePrivateAccess(c, result.Repo.IsPrivate, result.Repo.OwnerID); err != nil {
		return nil, err
	}

	return result, nil
}

func GetOwnerAndRepoWithPrivateAccessFromParams(c fiber.Ctx) (*ResourceResult, error) {
	owner := c.Params("owner")
	repoName := c.Params("repo")

	if owner == "" || repoName == "" {
		return nil, JSONError(c, HTTPStatusNotFound, "Owner or repository not specified")
	}

	return GetOwnerAndRepoWithPrivateAccess(c, owner, repoName)
}
