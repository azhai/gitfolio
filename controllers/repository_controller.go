package controllers

import (
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/azhai/gitfolio/database"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/gofiber/fiber/v3"
)

type CreateRepositoryRequest struct {
	Name        string `json:"name" validate:"required,min=1,max=255"`
	Description string `json:"description"`
	IsPrivate   bool   `json:"is_private"`
	CloneURL    string `json:"clone_url"`
}

type UpdateRepositoryRequest struct {
	Name          string `json:"name"`
	Description   string `json:"description"`
	IsPrivate     *bool  `json:"is_private"`
	DefaultBranch string `json:"default_branch"`
}

type RepositoryResponse struct {
	ID            uint   `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	Readme        string `json:"readme"`
	Owner         string `json:"owner"`
	OwnerID       uint   `json:"owner_id"`
	ProjectType   string `json:"project_type"`
	IsPrivate     bool   `json:"is_private"`
	IsFork        bool   `json:"is_fork"`
	IsMirror      bool   `json:"is_mirror"`
	MirrorURL     string `json:"mirror_url"`
	LocalPath     string `json:"local_path"`
	LastSyncAt    string `json:"last_sync_at"`
	StarsCount    int    `json:"stars_count"`
	ForksCount    int    `json:"forks_count"`
	WatchCount    int    `json:"watch_count"`
	DefaultBranch string `json:"default_branch"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
}

func ToRepositoryResponse(repo *models.Repository, owner *models.User) *RepositoryResponse {
	var lastSyncAt string
	if repo.LastSyncAt != nil {
		lastSyncAt = repo.LastSyncAt.Format("2006-01-02T15:04:05Z07:00")
	}

	return &RepositoryResponse{
		ID:            repo.ID,
		Name:          repo.Name,
		Description:   repo.Description,
		Readme:        repo.Readme,
		Owner:         owner.Username,
		OwnerID:       repo.OwnerID,
		ProjectType:   repo.ProjectType,
		IsPrivate:     repo.IsPrivate,
		IsFork:        repo.IsFork,
		IsMirror:      repo.IsMirror,
		MirrorURL:     repo.MirrorURL,
		LocalPath:     repo.LocalPath,
		LastSyncAt:    lastSyncAt,
		StarsCount:    repo.StarsCount,
		ForksCount:    repo.ForksCount,
		WatchCount:    repo.WatchCount,
		DefaultBranch: repo.DefaultBranch,
		CreatedAt:     repo.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:     repo.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func CreateRepository(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)
	var req CreateRepositoryRequest

	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := database.GetDB()

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
		OwnerID:       userID,
		IsPrivate:     req.IsPrivate,
		DefaultBranch: "main",
	}

	if req.CloneURL != "" {
		repo.IsMirror = true
		repo.MirrorURL = req.CloneURL
		repo.ProjectType = "mirror"

		reposDir := "repos"
		if _, err := os.Stat(reposDir); os.IsNotExist(err) {
			os.MkdirAll(reposDir, 0755)
		}

		localPath := filepath.Join(reposDir, ownerUser.Username, req.Name+".git")

		cmd := exec.Command("git", "clone", "--bare", req.CloneURL, localPath)
		output, err := cmd.CombinedOutput()
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "Failed to clone repository",
				"details": string(output),
			})
		}

		repo.LocalPath = localPath
	}

	err = db.Repository.Insert().One(repo)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create repository"})
	}

	return c.Status(fiber.StatusCreated).JSON(ToRepositoryResponse(repo, ownerUser))
}

func GetRepository(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	if repo.IsPrivate {
		userID := middleware.GetCurrentUserID(c)
		if userID == 0 || userID != repo.OwnerID {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
		}
	}

	return c.Status(fiber.StatusOK).JSON(ToRepositoryResponse(repo, ownerUser))
}

func ListRepositories(c fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "30"))

	db := database.GetDB()

	query := db.Repository.Select()

	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		query = query.Where("is_private = ?", false)
	}

	repos, err := query.Skip((page - 1) * perPage).Take(perPage).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch repositories"})
	}

	var response []*RepositoryResponse
	for _, repo := range repos {
		ownerUser, err := db.User.Select().Where("id = ?", repo.OwnerID).One()
		if err != nil {
			continue
		}
		response = append(response, ToRepositoryResponse(repo, ownerUser))
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":     response,
		"page":     page,
		"per_page": perPage,
	})
}

func UpdateRepository(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	userID := middleware.GetCurrentUserID(c)

	var req UpdateRepositoryRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	if repo.OwnerID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	if req.Name != "" {
		repo.Name = req.Name
	}
	if req.Description != "" {
		repo.Description = req.Description
	}
	if req.IsPrivate != nil {
		repo.IsPrivate = *req.IsPrivate
	}
	if req.DefaultBranch != "" {
		repo.DefaultBranch = req.DefaultBranch
	}

	err = db.Repository.Save().One(repo)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update repository"})
	}

	return c.Status(fiber.StatusOK).JSON(repo)
}

func DeleteRepository(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	userID := middleware.GetCurrentUserID(c)

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	if repo.OwnerID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	err = db.Repository.Delete().Where("id = ?", repo.ID).Exec()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete repository"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Repository deleted successfully"})
}

func StarRepository(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	userID := middleware.GetCurrentUserID(c)

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	existingStar, _ := db.Star.Select().Where("user_id = ? AND repository_id = ?", userID, repo.ID).One()
	if existingStar != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Already starred"})
	}

	star := &models.Star{
		UserID:       userID,
		RepositoryID: repo.ID,
	}

	err = db.Star.Insert().One(star)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to star repository"})
	}

	repo.StarsCount++
	err = db.Repository.Save().One(repo)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update stars count"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Repository starred successfully"})
}

func UnstarRepository(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	userID := middleware.GetCurrentUserID(c)

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	err = db.Star.Delete().Where("user_id = ? AND repository_id = ?", userID, repo.ID).Exec()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to unstar repository"})
	}

	repo.StarsCount--
	err = db.Repository.Save().One(repo)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update stars count"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Repository unstarred successfully"})
}

func WatchRepository(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	userID := middleware.GetCurrentUserID(c)

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	existingWatch, _ := db.Watch.Select().Where("user_id = ? AND repository_id = ?", userID, repo.ID).One()
	if existingWatch != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Already watching"})
	}

	watch := &models.Watch{
		UserID:       userID,
		RepositoryID: repo.ID,
	}

	err = db.Watch.Insert().One(watch)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to watch repository"})
	}

	repo.WatchCount++
	err = db.Repository.Save().One(repo)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update watch count"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Watching repository successfully"})
}

func UnwatchRepository(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	userID := middleware.GetCurrentUserID(c)

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	err = db.Watch.Delete().Where("user_id = ? AND repository_id = ?", userID, repo.ID).Exec()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to unwatch repository"})
	}

	repo.WatchCount--
	err = db.Repository.Save().One(repo)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update watch count"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Unwatched repository successfully"})
}

func SyncPullRepository(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	userID := middleware.GetCurrentUserID(c)

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	if repo.OwnerID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	if !repo.IsMirror || repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Not a mirror repository or local path not set"})
	}

	cmd := exec.Command("git", "-C", repo.LocalPath, "remote", "update")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to sync repository",
			"details": string(output),
		})
	}

	now := time.Now()
	repo.LastSyncAt = &now
	err = db.Repository.Save().One(repo)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update sync time"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":   "Repository synced successfully",
		"last_sync": now.Format("2006-01-02T15:04:05Z07:00"),
	})
}

func SyncPushRepository(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	userID := middleware.GetCurrentUserID(c)

	var req struct {
		RemoteURL string `json:"remote_url"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	if repo.OwnerID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	if repo.LocalPath == "" {
		reposDir := "repos"
		if _, err := os.Stat(reposDir); os.IsNotExist(err) {
			os.MkdirAll(reposDir, 0755)
		}
		localPath := filepath.Join(reposDir, ownerUser.Username, repoName)
		cmd := exec.Command("git", "init", "--bare", localPath)
		if output, err := cmd.CombinedOutput(); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "Failed to init repository",
				"details": string(output),
			})
		}
		repo.LocalPath = localPath
		err = db.Repository.Save().One(repo)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save local path"})
		}
	}

	if req.RemoteURL != "" {
		cmd := exec.Command("git", "-C", repo.LocalPath, "remote", "add", "push_target", req.RemoteURL)
		cmd.Run()
	}

	cmd := exec.Command("git", "-C", repo.LocalPath, "push", "push_target", "--all")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to push repository",
			"details": string(output),
		})
	}

	cmd = exec.Command("git", "-C", repo.LocalPath, "push", "push_target", "--tags")
	cmd.Run()

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Repository pushed successfully"})
}

func GetRepositoryTree(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	path := c.Query("path", "")
	ref := c.Query("ref", "HEAD")

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	if repo.IsPrivate {
		userID := middleware.GetCurrentUserID(c)
		if userID == 0 || userID != repo.OwnerID {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
		}
	}

	if repo.LocalPath == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var cmd *exec.Cmd
	if path == "" {
		cmd = exec.Command("git", "-C", repo.LocalPath, "ls-tree", "-l", ref)
	} else {
		cmd = exec.Command("git", "-C", repo.LocalPath, "ls-tree", "-l", ref, "--", path)
	}
	output, err := cmd.Output()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list tree"})
	}

	var entries []map[string]interface{}
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) >= 4 {
			mode := parts[0]
			objType := parts[1]
			objHash := parts[2]
			size := parts[3]
			name := strings.Join(parts[4:], " ")

			entry := map[string]interface{}{
				"mode": mode,
				"type": objType,
				"hash": objHash,
				"size": size,
				"name": name,
				"path": path + name,
			}
			entries = append(entries, entry)
		}
	}

	sort.Slice(entries, func(i, j int) bool {
		typeI := entries[i]["type"].(string)
		typeJ := entries[j]["type"].(string)
		if typeI != typeJ {
			return typeI == "tree"
		}
		nameI := entries[i]["name"].(string)
		nameJ := entries[j]["name"].(string)
		return nameI < nameJ
	})

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"path":    path,
		"ref":     ref,
		"entries": entries,
	})
}

func GetRepositoryFile(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")
	path := c.Query("path", "")
	ref := c.Query("ref", "HEAD")

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	if repo.IsPrivate {
		userID := middleware.GetCurrentUserID(c)
		if userID == 0 || userID != repo.OwnerID {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
		}
	}

	if repo.LocalPath == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	cmd := exec.Command("git", "-C", repo.LocalPath, "show", ref+":"+path)
	output, err := cmd.Output()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "File not found"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"path":    path,
		"ref":     ref,
		"content": string(output),
	})
}

func GetRepositoryBranches(c fiber.Ctx) error {
	owner := c.Params("owner")
	repoName := c.Params("repo")

	db := database.GetDB()

	ownerUser, err := db.User.Select().Where("username = ?", owner).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Owner not found"})
	}

	repo, err := db.Repository.Select().Where("owner_id = ? AND name = ?", ownerUser.ID, repoName).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not found"})
	}

	if repo.IsPrivate {
		userID := middleware.GetCurrentUserID(c)
		if userID == 0 || userID != repo.OwnerID {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
		}
	}

	if repo.LocalPath == "" {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"branches": []string{}})
	}

	cmd := exec.Command("git", "-C", repo.LocalPath, "branch", "-a", "--format=%(refname:short)")
	output, err := cmd.Output()
	if err != nil {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"branches": []string{}})
	}

	var branches []string
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			branches = append(branches, line)
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"branches": branches})
}
