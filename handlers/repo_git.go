package handlers

import (
	"fmt"
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
	entries, err := gitSvc.GetTreeWithSize(result.OwnerName(), result.Repo.Name, ref, path)
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
	content, err := gitSvc.GetFileContentByRef(result.OwnerName(), result.Repo.Name, ref, path)
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
	content, err := gitSvc.GetFileContentByRef(result.OwnerName(), result.Repo.Name, ref, path)
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
	branches, err := gitSvc.GetAllBranches(result.OwnerName(), result.Repo.Name)
	if err != nil {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"branches": []string{}})
	}

	response := fiber.Map{"branches": branches, "is_local": result.Repo.IsLocal()}

	if result.Repo.IsLocal() {
		isBare := gitSvc.IsBareRepository(result.OwnerName(), result.Repo.Name)
		if !isBare {
			stagedFiles, _ := gitSvc.GetStagedFiles(result.OwnerName(), result.Repo.Name)
			workingFiles, _ := gitSvc.GetWorkingTreeFiles(result.OwnerName(), result.Repo.Name)
			untrackedFiles, _ := gitSvc.GetUntrackedFiles(result.OwnerName(), result.Repo.Name)
			unpushedCommits, _ := gitSvc.GetUnpushedCommits(result.OwnerName(), result.Repo.Name)
			response["staged_files"] = stagedFiles
			response["working_files"] = workingFiles
			response["untracked_files"] = untrackedFiles
			response["unpushed_commits"] = unpushedCommits
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
	tags, err := gitSvc.GetAllTags(result.OwnerName(), result.Repo.Name)
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
	message, time, author, hash, err := gitSvc.GetLastCommitInfo(result.OwnerName(), result.Repo.Name, ref)
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
		commits, total, err = gitSvc.GetCommitGraph(result.OwnerName(), result.Repo.Name, page, perPage)
	} else {
		commits, total, err = gitSvc.GetCommitList(result.OwnerName(), result.Repo.Name, ref, page, perPage)
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
	stats, err := gitSvc.GetCodeStats(result.OwnerName(), result.Repo.Name)
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
	activity, err := gitSvc.GetCommitActivity(result.OwnerName(), result.Repo.Name, days)
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
	if err := gitSvc.RebaseCommits(result.OwnerName(), result.Repo.Name, req.Commits); err != nil {
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
	if err := gitSvc.StageFiles(result.OwnerName(), result.Repo.Name, req.Files); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	stagedFiles, _ := gitSvc.GetStagedFiles(result.OwnerName(), result.Repo.Name)
	workingFiles, _ := gitSvc.GetWorkingTreeFiles(result.OwnerName(), result.Repo.Name)
	untrackedFiles, _ := gitSvc.GetUntrackedFiles(result.OwnerName(), result.Repo.Name)

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
	if err := gitSvc.UnstageFiles(result.OwnerName(), result.Repo.Name, req.Files); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	stagedFiles, _ := gitSvc.GetStagedFiles(result.OwnerName(), result.Repo.Name)
	workingFiles, _ := gitSvc.GetWorkingTreeFiles(result.OwnerName(), result.Repo.Name)
	untrackedFiles, _ := gitSvc.GetUntrackedFiles(result.OwnerName(), result.Repo.Name)

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
	commitHash, err := gitSvc.CommitChangesWithHash(result.OwnerName(), result.Repo.Name, req.Message, user.Username, user.Email)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	helpers.CreateCommitReferences(db, commitHash, result.Repo.ID, req.Message)

	now := time.Now()
	result.Repo.LastCommitAt = &now
	db.Repository.Save().One(result.Repo)

	stagedFiles, _ := gitSvc.GetStagedFiles(result.OwnerName(), result.Repo.Name)
	workingFiles, _ := gitSvc.GetWorkingTreeFiles(result.OwnerName(), result.Repo.Name)
	untrackedFiles, _ := gitSvc.GetUntrackedFiles(result.OwnerName(), result.Repo.Name)

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
	detail, err := gitSvc.GetCommitDetail(result.OwnerName(), result.Repo.Name, sha)
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
	compareResult, err := gitSvc.CompareCommits(result.OwnerName(), result.Repo.Name, base, head)
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
	textExts := map[string]bool{
		".go": true, ".rs": true, ".py": true, ".rb": true,
		".js": true, ".jsx": true, ".mjs": true, ".cjs": true,
		".ts": true, ".tsx": true,
		".java": true, ".kt": true, ".kts": true, ".scala": true,
		".c": true, ".h": true, ".cpp": true, ".cc": true, ".cxx": true, ".hpp": true, ".hh": true,
		".cs": true, ".fs": true,
		".html": true, ".htm": true, ".xml": true, ".xsl": true, ".xslt": true,
		".css": true, ".scss": true, ".sass": true, ".less": true,
		".json": true, ".jsonc": true,
		".yaml": true, ".yml": true,
		".toml": true, ".ini": true, ".cfg": true, ".conf": true,
		".md": true, ".markdown": true,
		".sql": true,
		".sh":  true, ".bash": true, ".zsh": true, ".fish": true,
		".php": true, ".phtml": true,
		".swift": true, ".m": true, ".mm": true,
		".r": true, ".lua": true, ".vim": true,
		".dart": true, ".groovy": true, ".gradle": true,
		".ex": true, ".exs": true, ".erl": true, ".hrl": true,
		".hs": true, ".lhs": true,
		".ml": true, ".mli": true,
		".clj": true, ".cljs": true,
		".proto": true, ".thrift": true,
		".tf": true, ".hcl": true,
		".vue": true, ".svelte": true,
		".pl": true, ".pm": true,
		".tcl": true, ".nim": true, ".zig": true,
		".sol": true,
		".asm": true, ".s": true,
		".mk": true, ".cmake": true,
		".diff": true, ".patch": true,
		".log": true, ".txt": true,
		".env": true, ".gitignore": true, ".dockerignore": true,
		".lock": true, ".mod": true, ".sum": true,
		".csv": true, ".tsv": true,
	}
	base := strings.ToLower(filepath.Base(path))
	if base == "dockerfile" || base == "makefile" || base == "gnumakefile" ||
		base == "cmakelists.txt" || base == "jenkinsfile" || base == "vagrantfile" ||
		base == "gemfile" || base == "rakefile" || base == "license" || base == "readme" {
		return "text/plain; charset=utf-8"
	}
	if textExts[ext] {
		return "text/plain; charset=utf-8"
	}
	return "application/octet-stream"
}

// SetDefaultBranch 设置仓库的默认分支
func SetDefaultBranch(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Branch string `json:"branch"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.Branch == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Branch name is required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.SetDefaultBranch(result.OwnerName(), result.Repo.Name, req.Branch); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// 更新数据库中的默认分支
	db := models.GetDB()
	result.Repo.DefaultBranch = req.Branch
	db.Repository.Save().One(result.Repo)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Default branch updated", "default_branch": req.Branch})
}

// CreateTag 在指定分支上创建标签
func CreateTag(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Name   string `json:"name"`
		Branch string `json:"branch"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Tag name is required"})
	}
	if req.Branch == "" {
		req.Branch = result.Repo.DefaultBranch
		if req.Branch == "" {
			req.Branch = "main"
		}
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.CreateTag(result.OwnerName(), result.Repo.Name, req.Name, req.Branch); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Tag created", "tag": req.Name, "branch": req.Branch})
}

// DeleteTag 删除指定标签
func DeleteTag(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	tagName := c.Params("name")
	if tagName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Tag name is required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.DeleteTag(result.OwnerName(), result.Repo.Name, tagName); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Tag deleted", "tag": tagName})
}

// DeleteCommitRange 删除连续范围的提交
func DeleteCommitRange(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		FromSHA string `json:"from_sha"`
		ToSHA   string `json:"to_sha"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.FromSHA == "" || req.ToSHA == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Both from_sha and to_sha are required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.DeleteCommitRange(result.OwnerName(), result.Repo.Name, req.FromSHA, req.ToSHA); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Commits deleted"})
}

// RevertCommit 撤销指定提交（创建反向提交）
func RevertCommit(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		SHA string `json:"sha"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.SHA == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Commit SHA is required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.RevertCommit(result.OwnerName(), result.Repo.Name, req.SHA); err != nil {
		// 检查是否是冲突错误
		if strings.HasPrefix(err.Error(), "CONFLICT:") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error(), "conflict": true})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Commit reverted"})
}

// ResetCommits 删除最后 n 个提交
func ResetCommits(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Count int `json:"count"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.Count <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Count must be positive"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.ResetCommits(result.OwnerName(), result.Repo.Name, req.Count); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Commits reset"})
}

// AbortOperation 中止当前进行中的 git 操作（revert/rebase/merge）
func AbortOperation(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Type string `json:"type"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.Type == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Operation type is required (revert/rebase/merge/cherry-pick)"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.AbortOperation(result.OwnerName(), result.Repo.Name, req.Type); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Operation aborted"})
}

// GetRepoStatus 获取仓库当前操作状态
func GetRepoStatus(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"rebasing": false, "reverting": false, "merging": false})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	status := gitSvc.GetRepoStatus(result.OwnerName(), result.Repo.Name)
	return c.Status(fiber.StatusOK).JSON(status)
}

// CreateBranch 创建新分支
func CreateBranch(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Name      string `json:"name"`
		SourceRef string `json:"source_ref"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Branch name is required"})
	}
	if req.SourceRef == "" {
		req.SourceRef = "HEAD"
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.CreateBranch(result.OwnerName(), result.Repo.Name, req.Name, req.SourceRef); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Branch created", "branch": req.Name})
}

// DeleteBranch 删除分支
func DeleteBranch(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	branchName := c.Params("name")
	if branchName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Branch name is required"})
	}

	force := c.Query("force", "false") == "true"

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.DeleteBranch(result.OwnerName(), result.Repo.Name, branchName, force); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Branch deleted", "branch": branchName})
}

// RenameBranch 重命名分支
func RenameBranch(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		OldName string `json:"old_name"`
		NewName string `json:"new_name"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.OldName == "" || req.NewName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Both old_name and new_name are required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.RenameBranch(result.OwnerName(), result.Repo.Name, req.OldName, req.NewName); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Branch renamed", "old_name": req.OldName, "new_name": req.NewName})
}

// MergeBranch 合并分支
func MergeBranch(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		SourceBranch string `json:"source_branch"`
		TargetBranch string `json:"target_branch"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.SourceBranch == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "source_branch is required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.MergeBranch(result.OwnerName(), result.Repo.Name, req.SourceBranch, req.TargetBranch); err != nil {
		if strings.HasPrefix(err.Error(), "CONFLICT:") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error(), "conflict": true})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Branch merged", "source": req.SourceBranch})
}

// CherryPick 拣选提交
func CherryPick(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Shas []string `json:"shas"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if len(req.Shas) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "At least one commit SHA is required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.CherryPick(result.OwnerName(), result.Repo.Name, req.Shas); err != nil {
		if strings.HasPrefix(err.Error(), "CONFLICT:") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error(), "conflict": true})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Cherry-pick completed"})
}

// EditFile 在线编辑文件
func EditFile(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
		Message string `json:"message"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.Path == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "File path is required"})
	}
	if req.Message == "" {
		req.Message = fmt.Sprintf("Update %s", req.Path)
	}

	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	db := models.GetDB()
	user, err := db.User.Select().Where("id = ?", userID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	commitHash, err := gitSvc.EditFile(result.OwnerName(), result.Repo.Name, req.Path, req.Content, req.Message, user.Username, user.Email)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	helpers.CreateCommitReferences(db, commitHash, result.Repo.ID, req.Message)

	now := time.Now()
	result.Repo.LastCommitAt = &now
	db.Repository.Save().One(result.Repo)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":     "File updated",
		"commit_hash": commitHash,
		"path":        req.Path,
	})
}

// DeleteFile 删除文件
func DeleteFile(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Path    string `json:"path"`
		Message string `json:"message"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.Path == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "File path is required"})
	}
	if req.Message == "" {
		req.Message = fmt.Sprintf("Delete %s", req.Path)
	}

	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	db := models.GetDB()
	user, err := db.User.Select().Where("id = ?", userID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	commitHash, err := gitSvc.DeleteFile(result.OwnerName(), result.Repo.Name, req.Path, req.Message, user.Username, user.Email)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	helpers.CreateCommitReferences(db, commitHash, result.Repo.ID, req.Message)

	now := time.Now()
	result.Repo.LastCommitAt = &now
	db.Repository.Save().One(result.Repo)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":     "File deleted",
		"commit_hash": commitHash,
		"path":        req.Path,
	})
}

// ListRemotes 列出所有远程仓库
func ListRemotes(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"remotes": []interface{}{}})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	remotes, err := gitSvc.ListRemotes(result.OwnerName(), result.Repo.Name)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"remotes": remotes})
}

// AddRemote 添加远程仓库
func AddRemote(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Name string `json:"name"`
		URL  string `json:"url"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.Name == "" || req.URL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Remote name and URL are required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.AddRemote(result.OwnerName(), result.Repo.Name, req.Name, req.URL); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Remote added", "name": req.Name})
}

// RemoveRemote 删除远程仓库
func RemoveRemote(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	remoteName := c.Params("name")
	if remoteName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Remote name is required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.RemoveRemote(result.OwnerName(), result.Repo.Name, remoteName); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Remote removed", "name": remoteName})
}

// SetRemoteURL 设置远程仓库 URL
func SetRemoteURL(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	remoteName := c.Params("name")
	if remoteName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Remote name is required"})
	}

	var req struct {
		URL string `json:"url"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.URL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "URL is required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.SetRemoteURL(result.OwnerName(), result.Repo.Name, remoteName, req.URL); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Remote URL updated", "name": remoteName})
}

// AddRemotePushURL 添加远程仓库的 push URL
func AddRemotePushURL(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	remoteName := c.Params("name")
	if remoteName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Remote name is required"})
	}

	var req struct {
		URL string `json:"url"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.URL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Push URL is required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.AddRemotePushURL(result.OwnerName(), result.Repo.Name, remoteName, req.URL); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Push URL added", "name": remoteName})
}

// RemoveRemotePushURL 删除远程仓库的指定 push URL
func RemoveRemotePushURL(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	remoteName := c.Params("name")
	if remoteName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Remote name is required"})
	}

	var req struct {
		URL string `json:"url"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.URL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Push URL is required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.RemoveRemotePushURL(result.OwnerName(), result.Repo.Name, remoteName, req.URL); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Push URL removed", "name": remoteName})
}

// GetFileDiff 获取文件差异
func GetFileDiff(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	filePath := c.Query("path", "")
	staged := c.Query("staged", "false") == "true"

	if filePath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "File path is required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	diffResult, err := gitSvc.GetFileDiff(result.OwnerName(), result.Repo.Name, filePath, staged)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(diffResult)
}

// GetCommitFileDiff 获取提交中指定文件的差异
func GetCommitFileDiff(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	sha := c.Query("sha", "")
	filePath := c.Query("path", "")
	if sha == "" || filePath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "sha and path are required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	diffResult, err := gitSvc.GetCommitFileDiff(result.OwnerName(), result.Repo.Name, sha, filePath)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(diffResult)
}

// StagePatch 行级暂存
func StagePatch(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Path        string `json:"path"`
		LineIndices []int  `json:"line_indices"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.Path == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "File path is required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.StagePatch(result.OwnerName(), result.Repo.Name, req.Path, req.LineIndices); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Lines staged successfully"})
}

// DiscardFileChanges 丢弃文件变更
func DiscardFileChanges(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Path        string `json:"path"`
		IsUntracked bool   `json:"is_untracked"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.Path == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "File path is required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.DiscardFileChanges(result.OwnerName(), result.Repo.Name, req.Path, req.IsUntracked); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Changes discarded", "path": req.Path})
}

// CheckoutBranch 切换分支
func CheckoutBranch(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Branch string `json:"branch"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.Branch == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Branch name is required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.CheckoutBranch(result.OwnerName(), result.Repo.Name, req.Branch); err != nil {
		if strings.HasPrefix(err.Error(), "CONFLICT:") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error(), "conflict": true})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Branch switched", "branch": req.Branch})
}

// RebaseInteractive 交互式rebase
func RebaseInteractive(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Base  string                    `json:"base"`
		Todos []services.RebaseTodoItem `json:"todos"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.Base == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Base is required"})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.RebaseInteractive(result.OwnerName(), result.Repo.Name, req.Base, req.Todos); err != nil {
		if strings.HasPrefix(err.Error(), "CONFLICT:") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error(), "conflict": true})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Interactive rebase completed"})
}

// GetStashList 获取stash列表
func GetStashList(c fiber.Ctx) error {
	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"stashes": []interface{}{}})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	entries, err := gitSvc.GetStashList(result.OwnerName(), result.Repo.Name)
	if err != nil {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"stashes": []interface{}{}})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"stashes": entries})
}

// StashSave 保存变更到stash
func StashSave(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Message string `json:"message"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.StashSave(result.OwnerName(), result.Repo.Name, req.Message); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Stash saved"})
}

// StashPop 恢复并删除stash
func StashPop(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Index int `json:"index"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		req.Index = 0
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.StashPop(result.OwnerName(), result.Repo.Name, req.Index); err != nil {
		if strings.HasPrefix(err.Error(), "CONFLICT:") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error(), "conflict": true})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Stash popped"})
}

// StashApply 恢复但保留stash
func StashApply(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Index int `json:"index"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		req.Index = 0
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.StashApply(result.OwnerName(), result.Repo.Name, req.Index); err != nil {
		if strings.HasPrefix(err.Error(), "CONFLICT:") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error(), "conflict": true})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Stash applied"})
}

// StashDrop 删除stash
func StashDrop(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	var req struct {
		Index int `json:"index"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		req.Index = 0
	}

	gitSvc := services.NewGitService().WithLocalPath(result.Repo.LocalPath)
	if err := gitSvc.StashDrop(result.OwnerName(), result.Repo.Name, req.Index); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Stash dropped"})
}
