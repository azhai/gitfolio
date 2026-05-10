package handlers

import (
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/gofiber/fiber/v3"
)

// GetRepositoryTree 获取仓库目录树，目录排在前面，文件按名称排序
func GetRepositoryTree(c fiber.Ctx) error {
	path := c.Params("*", "")
	if path == "" {
		path = c.Query("path", "")
	}
	ref := c.Query("ref", "HEAD")

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	entries, err := gitSvc.GetTreeWithSize(result.Owner.Username, result.Repo.Name, ref, path)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Type != entries[j].Type {
			return entries[i].Type == "tree"
		}
		return entries[i].Name < entries[j].Name
	})

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"path": path, "ref": ref, "entries": entries})
}

// GetRepositoryFile 获取仓库中指定文件的内容
func GetRepositoryFile(c fiber.Ctx) error {
	path := c.Params("*", "")
	if path == "" {
		path = c.Query("path", "")
	}
	ref := c.Query("ref", "HEAD")

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	content, err := gitSvc.GetFileContentByRef(result.Owner.Username, result.Repo.Name, ref, path)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "File not found"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"path": path, "ref": ref, "content": content})
}

func GetRepositoryRawFile(c fiber.Ctx) error {
	path := c.Params("*", "")
	ref := c.Query("ref", "HEAD")

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusNotFound).SendString("Repository not initialized")
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	content, err := gitSvc.GetFileContentByRef(result.Owner.Username, result.Repo.Name, ref, path)
	if err != nil {
		return c.Status(fiber.StatusNotFound).SendString("File not found")
	}

	c.Set("Content-Type", getContentType(path))
	return c.Status(fiber.StatusOK).SendString(content)
}

// GetRepositoryBranches 获取仓库所有分支列表，非镜像项目额外返回暂存区和工作区状态
func GetRepositoryBranches(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"branches": []string{}})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	branches, err := gitSvc.GetAllBranches(result.Owner.Username, result.Repo.Name)
	if err != nil {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"branches": []string{}})
	}

	response := fiber.Map{"branches": branches}

	if !result.Repo.IsMirror() {
		isBare := gitSvc.IsBareRepository(result.Owner.Username, result.Repo.Name)
		if !isBare {
			stagedFiles, _ := gitSvc.GetStagedFiles(result.Owner.Username, result.Repo.Name)
			workingFiles, _ := gitSvc.GetWorkingTreeFiles(result.Owner.Username, result.Repo.Name)
			untrackedFiles, _ := gitSvc.GetUntrackedFiles(result.Owner.Username, result.Repo.Name)
			response["staged_files"] = stagedFiles
			response["working_files"] = workingFiles
			response["untracked_files"] = untrackedFiles
		}
	}

	return c.Status(fiber.StatusOK).JSON(response)
}

// GetRepositoryTags 获取仓库所有标签列表
func GetRepositoryTags(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"tags": []string{}})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	tags, err := gitSvc.GetAllTags(result.Owner.Username, result.Repo.Name)
	if err != nil {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"tags": []string{}})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"tags": tags})
}

// GetRepositoryLastCommit 获取仓库指定引用的最新提交信息
func GetRepositoryLastCommit(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	empty := fiber.Map{"message": "", "time": "", "author": "", "hash": ""}
	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusOK).JSON(empty)
	}

	ref := c.Query("ref", "HEAD")
	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	message, time, author, hash, err := gitSvc.GetLastCommitInfo(result.Owner.Username, result.Repo.Name, ref)
	if err != nil {
		return c.Status(fiber.StatusOK).JSON(empty)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": message, "time": time, "author": author, "hash": hash})
}

// GetRepositoryCommits 获取提交列表，支持单分支或全分支图模式
func GetRepositoryCommits(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	empty := fiber.Map{"commits": []interface{}{}, "total": 0, "page": 1, "per_page": 30}
	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusOK).JSON(empty)
	}

	ref := c.Query("ref", "HEAD")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "30"))
	allBranches := c.Query("all", "false") == "true"

	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 30
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)

	var commits interface{}
	var total int

	if allBranches {
		commits, total, err = gitSvc.GetCommitGraph(result.Owner.Username, result.Repo.Name, page, perPage)
	} else {
		commits, total, err = gitSvc.GetCommitList(result.Owner.Username, result.Repo.Name, ref, page, perPage)
	}

	if err != nil {
		return c.Status(fiber.StatusOK).JSON(empty)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"commits":  commits,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}

// GetRepositoryContributors 获取仓库贡献者列表，按提交数降序排列
func GetRepositoryContributors(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()
	contributors, err := db.Contributor.Select().
		Where("repository_id = ?", result.Repo.ID).
		OrderBy("commits_count DESC").All()
	if err != nil {
		return c.Status(fiber.StatusOK).JSON([]interface{}{})
	}

	responses := make([]*ContributorResponse, len(contributors))
	for i, contrib := range contributors {
		responses[i] = &ContributorResponse{
			ID:           contrib.ID,
			Name:         contrib.Name,
			Email:        contrib.Email,
			Avatar:       contrib.Avatar,
			CommitsCount: contrib.CommitsCount,
			CreatedAt:    contrib.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			UpdatedAt:    contrib.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
	}

	return c.Status(fiber.StatusOK).JSON(responses)
}

// GetCodeStats 获取仓库代码统计（行数、语言分布）
func GetCodeStats(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	stats, err := gitSvc.GetCodeStats(result.Owner.Username, result.Repo.Name)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get code stats: " + err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(stats)
}

// GetCommitActivity 获取提交活动统计，默认最近30天
func GetCommitActivity(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	days := 30
	if daysParam := c.Query("days"); daysParam != "" {
		if parsed, err := strconv.Atoi(daysParam); err == nil && parsed > 0 && parsed <= 365 {
			days = parsed
		}
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	activity, err := gitSvc.GetCommitActivity(result.Owner.Username, result.Repo.Name, days)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get commit activity: " + err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"activity": activity, "days": days})
}

// RebaseCommits 通过 rebase 删除指定的提交
func RebaseCommits(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		Commits []string `json:"commits"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if len(req.Commits) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No commits specified"})
	}

	gitSvc := services.NewGitService()
	if err := gitSvc.RebaseCommits(result.Owner.Username, result.Repo.Name, req.Commits); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Commits rebased successfully"})
}

// StageFiles 将文件添加到暂存区
func StageFiles(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		Files []string `json:"files"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	gitSvc := services.NewGitService()
	if err := gitSvc.StageFiles(result.Owner.Username, result.Repo.Name, req.Files); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	stagedFiles, _ := gitSvc.GetStagedFiles(result.Owner.Username, result.Repo.Name)
	workingFiles, _ := gitSvc.GetWorkingTreeFiles(result.Owner.Username, result.Repo.Name)
	untrackedFiles, _ := gitSvc.GetUntrackedFiles(result.Owner.Username, result.Repo.Name)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":         "Files staged successfully",
		"staged_files":    stagedFiles,
		"working_files":   workingFiles,
		"untracked_files": untrackedFiles,
	})
}

// UnstageFiles 将文件从暂存区移除
func UnstageFiles(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		Files []string `json:"files"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if len(req.Files) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No files specified"})
	}

	gitSvc := services.NewGitService()
	if err := gitSvc.UnstageFiles(result.Owner.Username, result.Repo.Name, req.Files); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	stagedFiles, _ := gitSvc.GetStagedFiles(result.Owner.Username, result.Repo.Name)
	workingFiles, _ := gitSvc.GetWorkingTreeFiles(result.Owner.Username, result.Repo.Name)
	untrackedFiles, _ := gitSvc.GetUntrackedFiles(result.Owner.Username, result.Repo.Name)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":         "Files unstaged successfully",
		"staged_files":    stagedFiles,
		"working_files":   workingFiles,
		"untracked_files": untrackedFiles,
	})
}

// CommitChanges 提交暂存区的变更
func CommitChanges(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		Message string `json:"message"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.Message == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Commit message is required"})
	}

	db := models.GetDB()
	user, err := db.User.Select().Where("id = ?", userID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	gitSvc := services.NewGitService()
	commitHash, err := gitSvc.CommitChangesWithHash(result.Owner.Username, result.Repo.Name, req.Message, user.Username, user.Email)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	helpers.CreateCommitReferences(db, commitHash, result.Repo.ID, req.Message)

	now := time.Now()
	result.Repo.LastCommitAt = &now
	db.Repository.Save().One(result.Repo)

	stagedFiles, _ := gitSvc.GetStagedFiles(result.Owner.Username, result.Repo.Name)
	workingFiles, _ := gitSvc.GetWorkingTreeFiles(result.Owner.Username, result.Repo.Name)
	untrackedFiles, _ := gitSvc.GetUntrackedFiles(result.Owner.Username, result.Repo.Name)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":         "Committed successfully",
		"commit_hash":     commitHash,
		"staged_files":    stagedFiles,
		"working_files":   workingFiles,
		"untracked_files": untrackedFiles,
	})
}

func GetCommitDetail(c fiber.Ctx) error {
	sha := c.Params("sha")
	if sha == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Commit SHA is required"})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	detail, err := gitSvc.GetCommitDetail(result.Owner.Username, result.Repo.Name, sha)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Commit not found"})
	}

	db := models.GetDB()
	refs := helpers.GetCommitReferences(db, detail.Hash)
	var refInfos []services.CommitRefInfo
	for _, r := range refs {
		refInfos = append(refInfos, services.CommitRefInfo{
			TargetType: r.TargetType,
			TargetID:   r.TargetID,
			Action:     r.Action,
		})
	}
	detail.References = refInfos

	return c.Status(fiber.StatusOK).JSON(detail)
}

func CompareCommits(c fiber.Ctx) error {
	baseHead := c.Params("basehead")
	if baseHead == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Base and head refs are required"})
	}

	parts := strings.SplitN(baseHead, "...", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid compare format, use base...head"})
	}
	base, head := parts[0], parts[1]

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	compareResult, err := gitSvc.CompareCommits(result.Owner.Username, result.Repo.Name, base, head)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(compareResult)
}

func getContentType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	contentTypes := map[string]string{
		".png":  "image/png",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".gif":  "image/gif",
		".svg":  "image/svg+xml",
		".webp": "image/webp",
		".bmp":  "image/bmp",
		".ico":  "image/x-icon",
		".avif": "image/avif",
	}
	if ct, ok := contentTypes[ext]; ok {
		return ct
	}
	return "application/octet-stream"
}
