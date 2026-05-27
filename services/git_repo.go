package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
)

// GitService 提供 Git 仓库操作服务
type GitService struct {
	repoRoot          string
	localRoot         string
	db                *models.Database
	localPathOverride string
}

// NewGitService 创建 GitService 实例，使用配置中的仓库根目录
func NewGitService() *GitService {
	return &GitService{
		repoRoot:  config.GetRepoRoot(),
		localRoot: config.GetLocalRoot(),
	}
}

// NewGitServiceWithDB 创建带数据库的 GitService 实例（用于需要日志记录的场景）
func NewGitServiceWithDB(db *models.Database) *GitService {
	return &GitService{
		repoRoot:  config.GetRepoRoot(),
		localRoot: config.GetLocalRoot(),
		db:        db,
	}
}

// WithLocalPath 设置本地路径覆盖，优先使用此路径
func (s *GitService) WithLocalPath(localPath string) *GitService {
	s.localPathOverride = localPath
	return s
}

// getRepoPath 返回仓库的本地磁盘路径
// 优先查找裸仓库（.git 后缀），不存在则查找非裸仓库（无后缀）
func (s *GitService) getRepoPath(owner, name string) string {
	if s.localPathOverride != "" {
		if _, err := os.Stat(s.localPathOverride); err == nil {
			return s.localPathOverride
		}
	}
	barePath := filepath.Join(s.repoRoot, owner, name+".git")
	if _, err := os.Stat(barePath); err == nil {
		return barePath
	}
	localPath := filepath.Join(s.localRoot, name)
	if _, err := os.Stat(localPath); err == nil {
		return localPath
	}
	return filepath.Join(s.repoRoot, owner, name)
}

// getNonBareRepoPath 返回本地仓库（非镜像）的磁盘路径
func (s *GitService) getNonBareRepoPath(owner, name string) string {
	return filepath.Join(s.localRoot, name)
}

// InitRepository 初始化一个非裸仓库，并生成 README.md
func (s *GitService) InitRepository(owner string, repo *models.Repository) error {
	repoPath := s.getNonBareRepoPath(owner, repo.Name)

	if err := os.MkdirAll(repoPath, 0755); err != nil {
		return fmt.Errorf("failed to create repository directory: %w", err)
	}

	cmd := exec.Command("git", "init", repoPath)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to initialize git repository: %w", err)
	}

	readmePath := filepath.Join(repoPath, "README.md")
	readmeContent := fmt.Sprintf("# %s\n\n%s", repo.Name, repo.Description)
	if err := os.WriteFile(readmePath, []byte(readmeContent), 0644); err != nil {
		return fmt.Errorf("failed to create README: %w", err)
	}

	return nil
}

// DeleteRepository 删除仓库的本地文件
func (s *GitService) DeleteRepository(owner, name string) error {
	repoPath := s.getRepoPath(owner, name)
	return os.RemoveAll(repoPath)
}

// CloneRepository 克隆远程仓库到本地，支持裸仓库镜像模式
// 遇到 HTTP/2 错误时自动降级到 HTTP/1.1 重试
func (s *GitService) CloneRepository(owner, name, cloneURL string, isMirror bool) (string, error) {
	reposDir := s.repoRoot
	if _, err := os.Stat(reposDir); os.IsNotExist(err) {
		os.MkdirAll(reposDir, 0755)
	}

	localPath := s.getRepoPath(owner, name)

	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		if attempt == 0 {
			if err := s.configureGitHTTPVersion(); err != nil {
				lastErr = err
				continue
			}
		}

		var cmdArgs []string
		if isMirror {
			cmdArgs = []string{"clone", "--bare", "--progress", cloneURL, localPath}
		} else {
			cmdArgs = []string{"clone", "--progress", cloneURL, localPath}
		}

		cmdStr := fmt.Sprintf("git %s", strings.Join(cmdArgs, " "))
		startTime := time.Now()

		cmd := exec.Command("git", cmdArgs...)
		cmd.Env = append(os.Environ(),
			"GIT_HTTP_MAX_REQUESTS=1",
			"GIT_HTTP_LOW_SPEED_LIMIT=1000",
			"GIT_HTTP_LOW_SPEED_TIME=300",
		)

		output, err := cmd.CombinedOutput()
		durationMs := time.Since(startTime).Milliseconds()
		outputStr := strings.TrimSpace(string(output))

		if err == nil {
			if s.db != nil {
				LogGitCommand(s.db, cmdStr, "", outputStr, "success", 0, durationMs, nil, "")
			}
			return localPath, nil
		}

		lastErr = fmt.Errorf("failed to clone repository: %s", outputStr)

		exitCode := 0
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		}
		if s.db != nil {
			LogGitCommand(s.db, cmdStr, "", outputStr, "failed", exitCode, durationMs, nil, err.Error())
		}

		if strings.Contains(string(output), "HTTP2") || strings.Contains(string(output), "HTTP/2") {
			continue
		}

		break
	}

	return "", lastErr
}

// configureGitHTTPVersion 设置 Git 使用 HTTP/1.1 并增大缓冲区，同时配置代理
func (s *GitService) configureGitHTTPVersion() error {
	cmd := exec.Command("git", "config", "--global", "http.version", "HTTP/1.1")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to set git http version: %w", err)
	}

	cmd = exec.Command("git", "config", "--global", "http.postBuffer", "524288000")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to set git http buffer: %w", err)
	}

	if err := ConfigureGitProxy(); err != nil {
		return err
	}

	return nil
}

// FetchRepository 从所有远程分支拉取更新
func (s *GitService) FetchRepository(owner, name string) error {
	repoPath := s.getRepoPath(owner, name)
	cmdArgs := []string{"-C", repoPath, "fetch", "--all"}
	cmdStr := fmt.Sprintf("git %s", strings.Join(cmdArgs, " "))
	startTime := time.Now()

	cmd := exec.Command("git", cmdArgs...)
	output, err := cmd.CombinedOutput()
	durationMs := time.Since(startTime).Milliseconds()
	outputStr := strings.TrimSpace(string(output))

	if err != nil {
		exitCode := 0
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		}
		if s.db != nil {
			LogGitCommand(s.db, cmdStr, repoPath, outputStr, "failed", exitCode, durationMs, nil, err.Error())
		}
		return fmt.Errorf("failed to fetch updates: %w", err)
	}

	if s.db != nil {
		LogGitCommand(s.db, cmdStr, repoPath, outputStr, "success", 0, durationMs, nil, "")
	}
	return nil
}

// PullRepository 拉取并合并当前分支的远程更新
func (s *GitService) PullRepository(owner, name string) error {
	repoPath := s.getRepoPath(owner, name)
	cmdArgs := []string{"-C", repoPath, "pull"}
	cmdStr := fmt.Sprintf("git %s", strings.Join(cmdArgs, " "))
	startTime := time.Now()

	cmd := exec.Command("git", cmdArgs...)
	output, err := cmd.CombinedOutput()
	durationMs := time.Since(startTime).Milliseconds()
	outputStr := strings.TrimSpace(string(output))

	if err != nil {
		exitCode := 0
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		}
		if s.db != nil {
			LogGitCommand(s.db, cmdStr, repoPath, outputStr, "failed", exitCode, durationMs, nil, err.Error())
		}
		return fmt.Errorf("failed to pull updates: %w", err)
	}

	if s.db != nil {
		LogGitCommand(s.db, cmdStr, repoPath, outputStr, "success", 0, durationMs, nil, "")
	}
	return nil
}

// RebaseCommits 通过交互式 rebase 删除指定提交，强制推送到远程
func (s *GitService) RebaseCommits(owner, repo string, commits []string) error {
	repoPath := s.getRepoPath(owner, repo)

	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	workDir, err := os.MkdirTemp("", "gitfolio-rebase-*")
	if err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer os.RemoveAll(workDir)

	cloneCmd := exec.Command("git", "clone", repoPath, workDir)
	if err := cloneCmd.Run(); err != nil {
		return fmt.Errorf("failed to clone repository: %w", err)
	}

	env := os.Environ()
	env = append(env, "GIT_SEQUENCE_EDITOR=cat")

	cmd := exec.Command("git", "rebase", "-i", "--root")
	cmd.Dir = workDir
	cmd.Env = env

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to start interactive rebase: %w", err)
	}

	pushCmd := exec.Command("git", "push", "-f", "origin", "HEAD")
	pushCmd.Dir = workDir
	if err := pushCmd.Run(); err != nil {
		return fmt.Errorf("failed to push changes: %w", err)
	}

	return nil
}

// SetDefaultBranch 设置仓库的默认分支（修改 HEAD 指向）
func (s *GitService) SetDefaultBranch(owner, name, branch string) error {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	cmd := exec.Command("git", "-C", repoPath, "symbolic-ref", "HEAD", "refs/heads/"+branch)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to set default branch: %s: %w", strings.TrimSpace(string(output)), err)
	}
	return nil
}

// CreateTag 在指定分支上创建标签
func (s *GitService) CreateTag(owner, name, tagName, branch string) error {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	cmd := exec.Command("git", "-C", repoPath, "tag", tagName, branch)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to create tag %s on branch %s: %s: %w", tagName, branch, strings.TrimSpace(string(output)), err)
	}

	if !s.isBareRepo(repoPath) {
		pushCmd := exec.Command("git", "-C", repoPath, "push", "origin", tagName)
		if output, err := pushCmd.CombinedOutput(); err != nil {
			fmt.Printf("Warning: failed to push tag %s: %s\n", tagName, strings.TrimSpace(string(output)))
		}
	}

	return nil
}

// DeleteTag 删除指定标签
func (s *GitService) DeleteTag(owner, name, tagName string) error {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	cmd := exec.Command("git", "-C", repoPath, "tag", "-d", tagName)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to delete tag %s: %s: %w", tagName, strings.TrimSpace(string(output)), err)
	}

	if !s.isBareRepo(repoPath) {
		pushCmd := exec.Command("git", "-C", repoPath, "push", "origin", ":"+tagName)
		if output, err := pushCmd.CombinedOutput(); err != nil {
			fmt.Printf("Warning: failed to delete remote tag %s: %s\n", tagName, strings.TrimSpace(string(output)))
		}
	}

	return nil
}

// DeleteCommitRange 删除从 fromSHA 到 toSHA 的连续提交（含两端）
func (s *GitService) DeleteCommitRange(owner, repo, fromSHA, toSHA string) error {
	repoPath := s.getRepoPath(owner, repo)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	workDir, err := os.MkdirTemp("", "gitfolio-delete-commits-*")
	if err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer os.RemoveAll(workDir)

	cloneCmd := exec.Command("git", "clone", repoPath, workDir)
	if output, err := cloneCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to clone repository: %s: %w", strings.TrimSpace(string(output)), err)
	}

	// 获取 toSHA 的父提交
	parentCmd := exec.Command("git", "-C", workDir, "rev-parse", toSHA+"^")
	parentOutput, err := parentCmd.Output()
	if err != nil {
		return fmt.Errorf("failed to get parent of %s: %w", toSHA[:7], err)
	}
	parentSHA := strings.TrimSpace(string(parentOutput))

	// 获取当前分支名
	branchCmd := exec.Command("git", "-C", workDir, "rev-parse", "--abbrev-ref", "HEAD")
	branchOutput, _ := branchCmd.Output()
	currentBranch := strings.TrimSpace(string(branchOutput))

	// git rebase --onto <parent-of-to> <to> <branch>
	// 跳过 from..to 范围内的提交
	rebaseCmd := exec.Command("git", "-C", workDir, "rebase", "--onto", parentSHA, toSHA, currentBranch)
	if output, err := rebaseCmd.CombinedOutput(); err != nil {
		abortCmd := exec.Command("git", "-C", workDir, "rebase", "--abort")
		abortCmd.Run()
		return fmt.Errorf("failed to rebase: %s: %w", strings.TrimSpace(string(output)), err)
	}

	pushCmd := exec.Command("git", "-C", workDir, "push", "-f", "origin", currentBranch)
	if output, err := pushCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to push changes: %s: %w", strings.TrimSpace(string(output)), err)
	}

	return nil
}

// isBareRepo 检查是否为裸仓库
func (s *GitService) isBareRepo(repoPath string) bool {
	cmd := exec.Command("git", "-C", repoPath, "rev-parse", "--is-bare-repository")
	output, err := cmd.Output()
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(output)) == "true"
}

// HasStagedOrWorkingChanges 检查是否有暂存区或工作区的未提交变更
func (s *GitService) HasStagedOrWorkingChanges(repoPath string) bool {
	cmd := exec.Command("git", "-C", repoPath, "status", "--porcelain")
	output, err := cmd.Output()
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(output)) != ""
}

// AutoCommitStaged 自动提交暂存区和工作区的所有变更
// 返回提交的 hash，如果没有变更则返回空字符串
func (s *GitService) AutoCommitStaged(repoPath string) (string, error) {
	if !s.HasStagedOrWorkingChanges(repoPath) {
		return "", nil
	}

	// 添加所有变更到暂存区
	addCmd := exec.Command("git", "-C", repoPath, "add", "-A")
	if output, err := addCmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("git add -A failed: %s: %w", strings.TrimSpace(string(output)), err)
	}

	// 提交
	commitCmd := exec.Command("git", "-C", repoPath, "commit", "-m", "auto: commit before operation")
	if output, err := commitCmd.CombinedOutput(); err != nil {
		// 可能没有实际变更需要提交
		if strings.Contains(string(output), "nothing to commit") {
			return "", nil
		}
		return "", fmt.Errorf("auto commit failed: %s: %w", strings.TrimSpace(string(output)), err)
	}

	// 获取提交 hash
	hashCmd := exec.Command("git", "-C", repoPath, "rev-parse", "HEAD")
	hashOutput, err := hashCmd.Output()
	if err != nil {
		return "", nil
	}
	return strings.TrimSpace(string(hashOutput)), nil
}

// RevertCommit 撤销指定提交（创建一个反向提交）
func (s *GitService) RevertCommit(owner, name, sha string) error {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	// 自动提交暂存区变更
	if _, err := s.AutoCommitStaged(repoPath); err != nil {
		return fmt.Errorf("failed to auto-commit staged changes: %w", err)
	}

	cmd := exec.Command("git", "-C", repoPath, "revert", "--no-edit", sha)
	output, err := cmd.CombinedOutput()
	if err != nil {
		errMsg := strings.TrimSpace(string(output))
		// 检查是否是冲突
		if strings.Contains(errMsg, "conflict") {
			return fmt.Errorf("CONFLICT: revert produced conflicts, please abort or resolve: %s", errMsg)
		}
		return fmt.Errorf("git revert failed: %s: %w", errMsg, err)
	}

	// 非裸仓库需要 push
	if !s.isBareRepo(repoPath) {
		pushCmd := exec.Command("git", "-C", repoPath, "push", "origin", "HEAD")
		if output, err := pushCmd.CombinedOutput(); err != nil {
			fmt.Printf("Warning: failed to push revert: %s\n", strings.TrimSpace(string(output)))
		}
	}

	return nil
}

// ResetCommits 删除最后 n 个提交（hard reset）
func (s *GitService) ResetCommits(owner, name string, count int) error {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	if count <= 0 {
		return fmt.Errorf("count must be positive")
	}

	// 自动提交暂存区变更
	if _, err := s.AutoCommitStaged(repoPath); err != nil {
		return fmt.Errorf("failed to auto-commit staged changes: %w", err)
	}

	// 获取当前分支
	branchCmd := exec.Command("git", "-C", repoPath, "rev-parse", "--abbrev-ref", "HEAD")
	branchOutput, _ := branchCmd.Output()
	currentBranch := strings.TrimSpace(string(branchOutput))

	// HEAD~n 回退
	ref := fmt.Sprintf("HEAD~%d", count)
	cmd := exec.Command("git", "-C", repoPath, "reset", "--hard", ref)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git reset --hard %s failed: %s: %w", ref, strings.TrimSpace(string(output)), err)
	}

	// 非裸仓库需要 force push
	if !s.isBareRepo(repoPath) {
		pushCmd := exec.Command("git", "-C", repoPath, "push", "-f", "origin", currentBranch)
		if output, err := pushCmd.CombinedOutput(); err != nil {
			return fmt.Errorf("failed to force push after reset: %s: %w", strings.TrimSpace(string(output)), err)
		}
	}

	return nil
}

// AbortOperation 中止当前进行中的 revert 或 rebase 操作
func (s *GitService) AbortOperation(owner, name, opType string) error {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	var cmd *exec.Cmd
	switch opType {
	case "revert":
		cmd = exec.Command("git", "-C", repoPath, "revert", "--abort")
	case "rebase":
		cmd = exec.Command("git", "-C", repoPath, "rebase", "--abort")
	case "merge":
		cmd = exec.Command("git", "-C", repoPath, "merge", "--abort")
	case "cherry-pick":
		cmd = exec.Command("git", "-C", repoPath, "cherry-pick", "--abort")
	default:
		return fmt.Errorf("unknown operation type: %s", opType)
	}

	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git %s --abort failed: %s: %w", opType, strings.TrimSpace(string(output)), err)
	}
	return nil
}

// GetRepoStatus 获取仓库当前状态（是否在 rebase/revert/merge 中）
func (s *GitService) GetRepoStatus(owner, name string) map[string]interface{} {
	repoPath := s.getRepoPath(owner, name)
	status := map[string]interface{}{
		"rebasing":  false,
		"reverting": false,
		"merging":   false,
	}

	// 检查 .git/rebase-merge 或 .git/rebase-apply
	gitDir := filepath.Join(repoPath, ".git")
	if _, err := os.Stat(filepath.Join(gitDir, "rebase-merge")); err == nil {
		status["rebasing"] = true
	}
	if _, err := os.Stat(filepath.Join(gitDir, "rebase-apply")); err == nil {
		status["rebasing"] = true
	}
	if _, err := os.Stat(filepath.Join(gitDir, "REVERT_HEAD")); err == nil {
		status["reverting"] = true
	}
	if _, err := os.Stat(filepath.Join(gitDir, "MERGE_HEAD")); err == nil {
		status["merging"] = true
	}

	return status
}

// CreateBranch 创建新分支（基于指定源分支）
func (s *GitService) CreateBranch(owner, name, branchName, sourceRef string) error {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	cmd := exec.Command("git", "-C", repoPath, "branch", branchName, sourceRef)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to create branch %s from %s: %s: %w", branchName, sourceRef, strings.TrimSpace(string(output)), err)
	}

	if !s.isBareRepo(repoPath) {
		pushCmd := exec.Command("git", "-C", repoPath, "push", "-u", "origin", branchName)
		if output, err := pushCmd.CombinedOutput(); err != nil {
			fmt.Printf("Warning: failed to push branch %s: %s\n", branchName, strings.TrimSpace(string(output)))
		}
	}

	return nil
}

// DeleteBranch 删除指定分支
func (s *GitService) DeleteBranch(owner, name, branchName string, force bool) error {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	flag := "-d"
	if force {
		flag = "-D"
	}

	cmd := exec.Command("git", "-C", repoPath, "branch", flag, branchName)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to delete branch %s: %s: %w", branchName, strings.TrimSpace(string(output)), err)
	}

	if !s.isBareRepo(repoPath) {
		pushCmd := exec.Command("git", "-C", repoPath, "push", "origin", ":"+branchName)
		if output, err := pushCmd.CombinedOutput(); err != nil {
			fmt.Printf("Warning: failed to delete remote branch %s: %s\n", branchName, strings.TrimSpace(string(output)))
		}
	}

	return nil
}

// RenameBranch 重命名分支
func (s *GitService) RenameBranch(owner, name, oldName, newName string) error {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	cmd := exec.Command("git", "-C", repoPath, "branch", "-m", oldName, newName)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to rename branch %s to %s: %s: %w", oldName, newName, strings.TrimSpace(string(output)), err)
	}

	if !s.isBareRepo(repoPath) {
		pushCmd := exec.Command("git", "-C", repoPath, "push", "origin", "-u", newName)
		if output, err := pushCmd.CombinedOutput(); err != nil {
			fmt.Printf("Warning: failed to push renamed branch %s: %s\n", newName, strings.TrimSpace(string(output)))
		}
		deleteCmd := exec.Command("git", "-C", repoPath, "push", "origin", ":"+oldName)
		if output, err := deleteCmd.CombinedOutput(); err != nil {
			fmt.Printf("Warning: failed to delete old remote branch %s: %s\n", oldName, strings.TrimSpace(string(output)))
		}
	}

	return nil
}

// MergeBranch 将源分支合并到当前分支（或指定目标分支）
func (s *GitService) MergeBranch(owner, name, sourceBranch, targetBranch string) error {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	// 自动提交暂存区变更
	if _, err := s.AutoCommitStaged(repoPath); err != nil {
		return fmt.Errorf("failed to auto-commit staged changes: %w", err)
	}

	// 如果指定了目标分支，先切换
	if targetBranch != "" {
		checkoutCmd := exec.Command("git", "-C", repoPath, "checkout", targetBranch)
		if output, err := checkoutCmd.CombinedOutput(); err != nil {
			return fmt.Errorf("failed to checkout target branch %s: %s: %w", targetBranch, strings.TrimSpace(string(output)), err)
		}
	}

	cmd := exec.Command("git", "-C", repoPath, "merge", sourceBranch)
	output, err := cmd.CombinedOutput()
	if err != nil {
		errMsg := strings.TrimSpace(string(output))
		if strings.Contains(errMsg, "CONFLICT") {
			return fmt.Errorf("CONFLICT: merge produced conflicts, please abort or resolve: %s", errMsg)
		}
		return fmt.Errorf("failed to merge %s: %s: %w", sourceBranch, errMsg, err)
	}

	if !s.isBareRepo(repoPath) {
		pushCmd := exec.Command("git", "-C", repoPath, "push", "origin", "HEAD")
		if output, err := pushCmd.CombinedOutput(); err != nil {
			fmt.Printf("Warning: failed to push merge: %s\n", strings.TrimSpace(string(output)))
		}
	}

	return nil
}

// CherryPick 将指定的提交拣选到当前分支
func (s *GitService) CherryPick(owner, name string, shas []string) error {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	// 自动提交暂存区变更
	if _, err := s.AutoCommitStaged(repoPath); err != nil {
		return fmt.Errorf("failed to auto-commit staged changes: %w", err)
	}

	args := append([]string{"-C", repoPath, "cherry-pick"}, shas...)
	cmd := exec.Command("git", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		errMsg := strings.TrimSpace(string(output))
		if strings.Contains(errMsg, "CONFLICT") {
			return fmt.Errorf("CONFLICT: cherry-pick produced conflicts, please abort or resolve: %s", errMsg)
		}
		return fmt.Errorf("failed to cherry-pick: %s: %w", errMsg, err)
	}

	if !s.isBareRepo(repoPath) {
		pushCmd := exec.Command("git", "-C", repoPath, "push", "origin", "HEAD")
		if output, err := pushCmd.CombinedOutput(); err != nil {
			fmt.Printf("Warning: failed to push cherry-pick: %s\n", strings.TrimSpace(string(output)))
		}
	}

	return nil
}

// EditFile 在线编辑文件并提交
func (s *GitService) EditFile(owner, name, filePath, content, message, authorName, authorEmail string) (string, error) {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return "", fmt.Errorf("repository not found")
	}

	if s.isBareRepo(repoPath) {
		return "", fmt.Errorf("cannot edit files in bare repository")
	}

	fullPath := filepath.Join(repoPath, filePath)
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}

	if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	addCmd := exec.Command("git", "-C", repoPath, "add", filePath)
	if output, err := addCmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("failed to stage file: %s: %w", strings.TrimSpace(string(output)), err)
	}

	commitCmd := exec.Command("git", "-C", repoPath, "commit", "-m", message,
		"--author", fmt.Sprintf("%s <%s>", authorName, authorEmail))
	if output, err := commitCmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("failed to commit: %s: %w", strings.TrimSpace(string(output)), err)
	}

	hashCmd := exec.Command("git", "-C", repoPath, "rev-parse", "HEAD")
	hashOutput, err := hashCmd.Output()
	if err != nil {
		return "", nil
	}

	if !s.isBareRepo(repoPath) {
		pushCmd := exec.Command("git", "-C", repoPath, "push", "origin", "HEAD")
		if output, err := pushCmd.CombinedOutput(); err != nil {
			fmt.Printf("Warning: failed to push edit: %s\n", strings.TrimSpace(string(output)))
		}
	}

	return strings.TrimSpace(string(hashOutput)), nil
}

// DeleteFile 删除文件并提交
func (s *GitService) DeleteFile(owner, name, filePath, message, authorName, authorEmail string) (string, error) {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return "", fmt.Errorf("repository not found")
	}

	if s.isBareRepo(repoPath) {
		return "", fmt.Errorf("cannot delete files in bare repository")
	}

	rmCmd := exec.Command("git", "-C", repoPath, "rm", filePath)
	if output, err := rmCmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("failed to remove file: %s: %w", strings.TrimSpace(string(output)), err)
	}

	commitCmd := exec.Command("git", "-C", repoPath, "commit", "-m", message,
		"--author", fmt.Sprintf("%s <%s>", authorName, authorEmail))
	if output, err := commitCmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("failed to commit: %s: %w", strings.TrimSpace(string(output)), err)
	}

	hashCmd := exec.Command("git", "-C", repoPath, "rev-parse", "HEAD")
	hashOutput, err := hashCmd.Output()
	if err != nil {
		return "", nil
	}

	if !s.isBareRepo(repoPath) {
		pushCmd := exec.Command("git", "-C", repoPath, "push", "origin", "HEAD")
		if output, err := pushCmd.CombinedOutput(); err != nil {
			fmt.Printf("Warning: failed to push delete: %s\n", strings.TrimSpace(string(output)))
		}
	}

	return strings.TrimSpace(string(hashOutput)), nil
}

// RemoteInfo 远程仓库信息
type RemoteInfo struct {
	Name     string   `json:"name"`
	FetchURL string   `json:"fetch_url"`
	PushURLs []string `json:"push_urls"`
}

// ListRemotes 列出所有远程仓库
func (s *GitService) ListRemotes(owner, name string) ([]RemoteInfo, error) {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("repository not found")
	}

	cmd := exec.Command("git", "-C", repoPath, "remote")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list remotes: %w", err)
	}

	var remotes []RemoteInfo
	for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		info := RemoteInfo{Name: line}

		fetchCmd := exec.Command("git", "-C", repoPath, "remote", "get-url", line)
		if fetchOutput, err := fetchCmd.Output(); err == nil {
			info.FetchURL = strings.TrimSpace(string(fetchOutput))
		}

		pushCmd := exec.Command("git", "-C", repoPath, "remote", "get-url", "--push", line)
		if pushOutput, err := pushCmd.Output(); err == nil {
			info.PushURLs = []string{strings.TrimSpace(string(pushOutput))}
		}

		// 检查是否有额外的 pushurl 配置
		pushUrlCmd := exec.Command("git", "-C", repoPath, "config", "--get-all", "remote."+line+".pushurl")
		if pushUrlOutput, err := pushUrlCmd.Output(); err == nil {
			urls := strings.Split(strings.TrimSpace(string(pushUrlOutput)), "\n")
			if len(urls) > 0 && urls[0] != "" {
				info.PushURLs = urls
			}
		}

		remotes = append(remotes, info)
	}

	return remotes, nil
}

// AddRemote 添加远程仓库
func (s *GitService) AddRemote(owner, name, remoteName, url string) error {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	cmd := exec.Command("git", "-C", repoPath, "remote", "add", remoteName, url)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to add remote %s: %s: %w", remoteName, strings.TrimSpace(string(output)), err)
	}
	return nil
}

// RemoveRemote 删除远程仓库
func (s *GitService) RemoveRemote(owner, name, remoteName string) error {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	cmd := exec.Command("git", "-C", repoPath, "remote", "remove", remoteName)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to remove remote %s: %s: %w", remoteName, strings.TrimSpace(string(output)), err)
	}
	return nil
}

// SetRemoteURL 设置远程仓库的 URL
func (s *GitService) SetRemoteURL(owner, name, remoteName, url string) error {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	cmd := exec.Command("git", "-C", repoPath, "remote", "set-url", remoteName, url)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to set remote URL for %s: %s: %w", remoteName, strings.TrimSpace(string(output)), err)
	}
	return nil
}

// AddRemotePushURL 为远程仓库添加额外的 push URL
func (s *GitService) AddRemotePushURL(owner, name, remoteName, pushURL string) error {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	cmd := exec.Command("git", "-C", repoPath, "remote", "set-url", "--add", "--push", remoteName, pushURL)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to add push URL for %s: %s: %w", remoteName, strings.TrimSpace(string(output)), err)
	}
	return nil
}

// RemoveRemotePushURL 删除远程仓库的指定 push URL
func (s *GitService) RemoveRemotePushURL(owner, name, remoteName, pushURL string) error {
	repoPath := s.getRepoPath(owner, name)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Errorf("repository not found")
	}

	cmd := exec.Command("git", "-C", repoPath, "remote", "set-url", "--delete", "--push", remoteName, pushURL)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to remove push URL for %s: %s: %w", remoteName, strings.TrimSpace(string(output)), err)
	}
	return nil
}
