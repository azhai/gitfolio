package handlers

import (
	"fmt"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/azhai/goent"
	"github.com/gofiber/fiber/v3"
)

// CreateRepository 创建仓库，支持新建空仓库或克隆远程仓库
func CreateRepository(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)
	var req CreateRepositoryRequest

	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := models.GetDB()

	ownerUser, err := db.User.Select().Where("id = ?", userID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	existingRepo, _ := db.Repository.Select().Where("owner_id = ? AND name = ?", userID, req.Name).One()
	if existingRepo != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Repository with this name already exists"})
	}

	repo := &models.Repository{
		Name:          req.Name,
		Description:   req.Description,
		Homepage:      req.Homepage,
		OwnerID:       userID,
		IsPrivate:     req.IsPrivate,
		DefaultBranch: "main",
	}

	if req.DefaultBranch != "" {
		repo.DefaultBranch = req.DefaultBranch
	}

	if req.CloneURL != "" {
		repo.IsMirror = true
		repo.MirrorURL = req.CloneURL
		repo.ProjectType = "mirror"

		if strings.Contains(req.CloneURL, "github.com") {
			syncSvc := services.NewSyncService(db)
			if ghRepo, err := syncSvc.FetchGitHubRepoInfo(req.CloneURL); err == nil {
				if repo.Description == "" && ghRepo.Description != "" {
					repo.Description = ghRepo.Description
				}
				if repo.Homepage == "" && ghRepo.Homepage != "" {
					repo.Homepage = ghRepo.Homepage
				}
			}
		}

		gitSvc := services.NewGitService()
		localPath, err := gitSvc.CloneRepository(ownerUser.Username, req.Name, req.CloneURL, true)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		repo.LocalPath = localPath
	} else {
		gitSvc := services.NewGitService()
		if err := gitSvc.InitRepository(ownerUser.Username, repo); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": fmt.Sprintf("Failed to initialize repository: %v", err),
			})
		}
		repo.LocalPath = filepath.Join(config.AppConfig.Repository.Root, "local", req.Name)
	}

	err = db.Repository.Insert().One(repo)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create repository"})
	}

	stats := &models.RepositoryStats{RepositoryID: repo.ID}
	if err := db.RepositoryStats.Insert().One(stats); err != nil {
		fmt.Printf("Warning: failed to create repository stats: %v\n", err)
	}

	return c.Status(fiber.StatusCreated).JSON(ToRepositoryResponse(repo, ownerUser))
}

// GetGitHubRepoInfo 获取 GitHub 仓库信息（名称、描述、主页）
func GetGitHubRepoInfo(c fiber.Ctx) error {
	cloneURL := c.Query("url")
	if cloneURL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "URL parameter is required"})
	}

	if !strings.Contains(cloneURL, "github.com") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Only GitHub URLs are supported"})
	}

	db := models.GetDB()
	syncSvc := services.NewSyncService(db)
	ghRepo, err := syncSvc.FetchGitHubRepoInfo(cloneURL)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"name":        ghRepo.Name,
		"description": ghRepo.Description,
		"homepage":    ghRepo.Homepage,
	})
}

// GetRepository 获取仓库详情
func GetRepository(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusOK).JSON(ToRepositoryResponse(result.Repo, result.Owner))
}

// ListRepositories 分页获取仓库列表，未登录用户仅可见公开仓库
func ListRepositories(c fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", strconv.Itoa(config.DefaultPage)))
	perPage, _ := strconv.Atoi(c.Query("per_page", strconv.Itoa(config.DefaultPerPage)))
	if perPage > config.MaxPerPage {
		perPage = config.MaxPerPage
	}

	db := models.GetDB()
	query := db.Repository.Select()

	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		query = query.Where("is_private = ?", false)
	}

	repos, err := query.All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch repositories"})
	}

	sort.Slice(repos, func(i, j int) bool {
		ti, tj := repos[i].LastCommitAt, repos[j].LastCommitAt
		if ti == nil && tj == nil {
			return repos[i].UpdatedAt.After(repos[j].UpdatedAt)
		}
		if ti == nil {
			return false
		}
		if tj == nil {
			return true
		}
		return ti.After(*tj)
	})

	total := len(repos)
	start := (page - 1) * perPage
	if start >= total {
		repos = []*models.Repository{}
	} else {
		end := start + perPage
		if end > total {
			end = total
		}
		repos = repos[start:end]
	}

	response := make([]*RepositoryResponse, 0, len(repos))
	if len(repos) > 0 {
		ownerIDs := make([]int64, 0, len(repos))
		for _, repo := range repos {
			ownerIDs = append(ownerIDs, repo.OwnerID)
		}

		ownersMap := make(map[int64]*models.User)
		users, err := db.User.Select().Filter(
			goent.In(db.User.Field("id"), ownerIDs),
		).All()
		if err == nil {
			for _, u := range users {
				ownersMap[u.ID] = u
			}
		}

		for _, repo := range repos {
			ownerUser, ok := ownersMap[repo.OwnerID]
			if !ok {
				continue
			}
			response = append(response, ToRepositoryResponse(repo, ownerUser))
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":     response,
		"page":     page,
		"per_page": perPage,
	})
}

// UpdateRepository 更新仓库信息
func UpdateRepository(c fiber.Ctx) error {
	var req UpdateRepositoryRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if req.Name != "" {
		result.Repo.Name = req.Name
	}
	if req.Description != "" {
		result.Repo.Description = req.Description
	}
	if req.Homepage != "" {
		result.Repo.Homepage = req.Homepage
	}
	if req.IsPrivate != nil {
		result.Repo.IsPrivate = *req.IsPrivate
	}
	if req.DefaultBranch != "" {
		result.Repo.DefaultBranch = req.DefaultBranch
	}

	db := models.GetDB()
	err = db.Repository.Save().One(result.Repo)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update repository"})
	}

	return c.Status(fiber.StatusOK).JSON(result.Repo)
}

// DeleteRepository 删除仓库
func DeleteRepository(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()
	err = db.Repository.Delete().Where("id = ?", result.Repo.ID).Exec()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete repository"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Repository deleted successfully"})
}
