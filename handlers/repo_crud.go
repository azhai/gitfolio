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

	existingRepo, _ := db.Repository.Select().Where("owner_id = ? AND owner_type = 'user' AND name = ?", userID, req.Name).One()
	if existingRepo != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Repository with this name already exists"})
	}

	repo := &models.Repository{
		Name:          req.Name,
		Description:   req.Description,
		Homepage:      req.Homepage,
		OwnerID:       userID,
		OwnerType:     "user",
		ProjectType:   req.ProjectType,
		DefaultBranch: "main",
	}

	if req.DefaultBranch != "" {
		repo.DefaultBranch = req.DefaultBranch
	}

	if req.CloneURL != "" {
		repo.MirrorURL = req.CloneURL
		if repo.ProjectType != "public" && repo.ProjectType != "private" {
			repo.ProjectType = "mirror"
		}

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
		repo.ProjectType = "local"
		repo.OwnerID = 0
		repo.OwnerType = "user"
		gitSvc := services.NewGitService()
		if err := gitSvc.InitRepository(ownerUser.Username, repo); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": fmt.Sprintf("Failed to initialize repository: %v", err),
			})
		}
		repo.LocalPath = filepath.Join(config.GetRepoRoot(), "local", req.Name)
	}

	err = db.Repository.Insert().One(repo)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create repository"})
	}

	stats := &models.RepositoryStats{RepositoryID: repo.ID}
	if err := db.RepositoryStats.Insert().One(stats); err != nil {
		fmt.Printf("Warning: failed to create repository stats: %v\n", err)
	}

	schedulerSvc := services.NewSchedulerService(db)
	syncType := "stats"
	if repo.IsRemote() {
		syncType = "mirror"
	}
	schedulerSvc.GetOrCreateSyncPoint(repo.ID, syncType)

	return c.Status(fiber.StatusCreated).JSON(ToRepositoryResponse(repo, ownerUser, nil))
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
	response := ToRepositoryResponse(result.Repo, result.Owner, result.Group)

	userID := middleware.GetCurrentUserID(c)
	if userID > 0 {
		db := models.GetDB()
		star, _ := db.Star.Select().Where("user_id = ? AND repository_id = ?", userID, result.Repo.ID).One()
		response.IsStarred = star != nil
		watch, _ := db.Watch.Select().Where("user_id = ? AND repository_id = ?", userID, result.Repo.ID).One()
		response.IsWatched = watch != nil
	}

	return c.Status(fiber.StatusOK).JSON(response)
}

// ListRepositories 分页获取仓库列表
func ListRepositories(c fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", strconv.Itoa(config.DefaultPage)))
	perPage, _ := strconv.Atoi(c.Query("per_page", strconv.Itoa(config.DefaultPerPage)))
	if perPage > config.MaxPerPage {
		perPage = config.MaxPerPage
	}

	db := models.GetDB()
	query := db.Repository.Select()

	userID := middleware.GetCurrentUserID(c)
	role := middleware.GetCurrentUserRole(c)

	if role == "admin" {
	} else if role == "guest" {
		query = query.Where("project_type IN ?", []string{"public", "mirror"})
	} else if userID == 0 {
		query = query.Where("project_type IN ?", []string{"public", "mirror"})
	} else {
		groupIDs := getUserGroupIDs(db, userID)
		if len(groupIDs) > 0 {
			query = query.Filter(
				goent.Or(
					goent.In(db.Repository.Field("project_type"), []interface{}{"local", "public", "mirror"}),
					goent.And(
						goent.Equals(db.Repository.Field("project_type"), "private"),
						goent.Or(
							goent.And(
								goent.Equals(db.Repository.Field("owner_type"), "user"),
								goent.Equals(db.Repository.Field("owner_id"), userID),
							),
							goent.And(
								goent.Equals(db.Repository.Field("owner_type"), "group"),
								goent.In(db.Repository.Field("owner_id"), groupIDs),
							),
						),
					),
				),
			)
		} else {
			query = query.Filter(
				goent.Or(
					goent.In(db.Repository.Field("project_type"), []interface{}{"local", "public", "mirror"}),
					goent.And(
						goent.Equals(db.Repository.Field("project_type"), "private"),
						goent.Equals(db.Repository.Field("owner_type"), "user"),
						goent.Equals(db.Repository.Field("owner_id"), userID),
					),
				),
			)
		}
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
		userOwnerIDs := make([]int64, 0)
		groupOwnerIDs := make([]int64, 0)
		for _, repo := range repos {
			if repo.OwnerType == "group" {
				groupOwnerIDs = append(groupOwnerIDs, repo.OwnerID)
			} else {
				userOwnerIDs = append(userOwnerIDs, repo.OwnerID)
			}
		}

		ownersMap := make(map[int64]*models.User)
		if len(userOwnerIDs) > 0 {
			users, err := db.User.Select().Filter(
				goent.In(db.User.Field("id"), userOwnerIDs),
			).All()
			if err == nil {
				for _, u := range users {
					ownersMap[u.ID] = u
				}
			}
		}

		groupsMap := make(map[int64]*models.Group)
		if len(groupOwnerIDs) > 0 {
			groups, err := db.Group.Select().Filter(
				goent.In(db.Group.Field("id"), groupOwnerIDs),
			).All()
			if err == nil {
				for _, g := range groups {
					groupsMap[g.ID] = g
				}
			}
		}

		for _, repo := range repos {
			var ownerUser *models.User
			var ownerGroup *models.Group
			if repo.IsLocal() {
				response = append(response, ToRepositoryResponse(repo, nil, nil))
				continue
			}
			if repo.OwnerType == "group" {
				ownerGroup = groupsMap[repo.OwnerID]
				if ownerGroup == nil {
					continue
				}
			} else {
				ownerUser = ownersMap[repo.OwnerID]
				if ownerUser == nil {
					continue
				}
			}
			response = append(response, ToRepositoryResponse(repo, ownerUser, ownerGroup))
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
	if req.ProjectType != "" {
		oldType := result.Repo.ProjectType
		newType := req.ProjectType
		validTypes := map[string]bool{"local": true, "mirror": true, "public": true, "private": true}
		if !validTypes[newType] {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid project type"})
		}
		if oldType == "local" && newType != "local" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Local projects cannot be converted to remote types"})
		}
		if newType == "local" && oldType != "local" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Remote projects cannot be converted to local"})
		}
		if oldType == "mirror" && newType != "mirror" && newType != "public" && newType != "private" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Mirror projects can only be converted to public or private"})
		}
		result.Repo.ProjectType = req.ProjectType
	}
	if req.DefaultBranch != "" {
		result.Repo.DefaultBranch = req.DefaultBranch
	}
	if req.MirrorURL != "" {
		result.Repo.MirrorURL = req.MirrorURL
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

type TransferRepositoryRequest struct {
	NewOwner string `json:"new_owner"`
}

func getUserGroupIDs(db *models.Database, userID int64) []int64 {
	members, err := db.GroupMember.Select("group_id").Where("user_id = ?", userID).All()
	if err != nil {
		return nil
	}
	ids := make([]int64, 0, len(members))
	for _, m := range members {
		ids = append(ids, m.GroupID)
	}
	return ids
}

// TransferRepository 转移仓库所有权
func TransferRepository(c fiber.Ctx) error {
	var req TransferRepositoryRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.NewOwner == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "new_owner is required"})
	}

	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	user, err := db.User.Select().Where("username = ?", req.NewOwner).One()
	if err == nil && user != nil {
		result.Repo.OwnerID = user.ID
		result.Repo.OwnerType = "user"
	} else {
		group, err := db.Group.Select().Where("name = ?", req.NewOwner).One()
		if err != nil || group == nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Target user or group not found"})
		}
		result.Repo.OwnerID = group.ID
		result.Repo.OwnerType = "group"
	}

	if err := db.Repository.Save().One(result.Repo); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to transfer repository"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Repository transferred successfully"})
}
