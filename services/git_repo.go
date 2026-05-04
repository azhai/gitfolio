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
	repoRoot string
	db       *models.Database
}

// NewGitService 创建 GitService 实例，使用配置中的仓库根目录
func NewGitService() *GitService {
	return &GitService{
		repoRoot: config.GetRepoRoot(),
	}
}

// NewGitServiceWithDB 创建带数据库的 GitService 实例（用于需要日志记录的场景）
func NewGitServiceWithDB(db *models.Database) *GitService {
	return &GitService{
		repoRoot: config.GetRepoRoot(),
		db:       db,
	}
}

// getRepoPath 返回仓库的本地磁盘路径
// 优先查找裸仓库（.git 后缀），不存在则查找非裸仓库（无后缀）
func (s *GitService) getRepoPath(owner, name string) string {
	barePath := filepath.Join(s.repoRoot, owner, name+".git")
	if _, err := os.Stat(barePath); err == nil {
		return barePath
	}
	localPath := filepath.Join(s.repoRoot, "local", name)
	if _, err := os.Stat(localPath); err == nil {
		return localPath
	}
	return filepath.Join(s.repoRoot, owner, name)
}

// getNonBareRepoPath 返回本地仓库（非镜像）的磁盘路径
func (s *GitService) getNonBareRepoPath(owner, name string) string {
	return filepath.Join(s.repoRoot, "local", name)
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
