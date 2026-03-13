package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
)

type GitService struct {
	repoRoot string
}

func NewGitService() *GitService {
	return &GitService{
		repoRoot: config.AppConfig.Repository.Root,
	}
}

func (s *GitService) InitRepository(owner string, repo *models.Repository) error {
	repoPath := s.getRepoPath(owner, repo.Name)

	if err := os.MkdirAll(repoPath, 0755); err != nil {
		return fmt.Errorf("failed to create repository directory: %w", err)
	}

	cmd := exec.Command("git", "init", "--bare", repoPath)
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

func (s *GitService) DeleteRepository(owner, name string) error {
	repoPath := s.getRepoPath(owner, name)
	return os.RemoveAll(repoPath)
}

func (s *GitService) GetBranches(owner, name string) ([]string, error) {
	repoPath := s.getRepoPath(owner, name)

	cmd := exec.Command("git", "-C", repoPath, "branch", "--list", "--format=%(refname:short)")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list branches: %w", err)
	}

	branches := strings.Split(strings.TrimSpace(string(output)), "\n")
	if len(branches) == 1 && branches[0] == "" {
		return []string{}, nil
	}

	return branches, nil
}

func (s *GitService) GetCommits(owner, name, branch string, limit int) ([]CommitInfo, error) {
	repoPath := s.getRepoPath(owner, name)

	if branch == "" {
		branch = "main"
	}

	cmd := exec.Command("git", "-C", repoPath, "log", branch,
		"--format=%H|%an|%ae|%at|%s",
		fmt.Sprintf("-%d", limit))
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get commits: %w", err)
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	commits := make([]CommitInfo, 0, len(lines))

	for _, line := range lines {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "|", 5)
		if len(parts) == 5 {
			commits = append(commits, CommitInfo{
				Hash:    parts[0][:7],
				Author:  parts[1],
				Email:   parts[2],
				Message: parts[4],
			})
		}
	}

	return commits, nil
}

func (s *GitService) GetFileContent(owner, name, branch, path string) (string, error) {
	repoPath := s.getRepoPath(owner, name)

	if branch == "" {
		branch = "main"
	}

	cmd := exec.Command("git", "-C", repoPath, "show", fmt.Sprintf("%s:%s", branch, path))
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get file content: %w", err)
	}

	return string(output), nil
}

func (s *GitService) GetTree(owner, name, branch, path string) ([]FileInfo, error) {
	repoPath := s.getRepoPath(owner, name)

	if branch == "" {
		branch = "main"
	}

	treePath := path
	if treePath != "" {
		treePath = branch + ":" + path
	} else {
		treePath = branch
	}

	cmd := exec.Command("git", "-C", repoPath, "ls-tree", treePath)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get tree: %w", err)
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	files := make([]FileInfo, 0, len(lines))

	for _, line := range lines {
		if line == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) >= 4 {
			fileType := "file"
			if parts[1] == "tree" {
				fileType = "dir"
			}
			files = append(files, FileInfo{
				Type: fileType,
				Name: strings.Join(parts[3:], " "),
				Hash: parts[2],
			})
		}
	}

	return files, nil
}

func (s *GitService) getRepoPath(owner, name string) string {
	return filepath.Join(s.repoRoot, owner, name+".git")
}

type CommitInfo struct {
	Hash    string `json:"hash"`
	Author  string `json:"author"`
	Email   string `json:"email"`
	Message string `json:"message"`
}

type FileInfo struct {
	Type string `json:"type"`
	Name string `json:"name"`
	Hash string `json:"hash"`
}
