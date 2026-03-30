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

func (s *GitService) getRepoPath(owner, name string) string {
	return filepath.Join(s.repoRoot, owner, name+".git")
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

		var cmd *exec.Cmd
		if isMirror {
			cmd = exec.Command("git", "clone", "--bare", "--progress", cloneURL, localPath)
		} else {
			cmd = exec.Command("git", "clone", "--progress", cloneURL, localPath)
		}

		cmd.Env = append(os.Environ(),
			"GIT_HTTP_MAX_REQUESTS=1",
			"GIT_HTTP_LOW_SPEED_LIMIT=1000",
			"GIT_HTTP_LOW_SPEED_TIME=300",
		)

		output, err := cmd.CombinedOutput()
		if err == nil {
			return localPath, nil
		}

		lastErr = fmt.Errorf("failed to clone repository: %s", string(output))

		if strings.Contains(string(output), "HTTP2") || strings.Contains(string(output), "HTTP/2") {
			continue
		}

		break
	}

	return "", lastErr
}

func (s *GitService) configureGitHTTPVersion() error {
	cmd := exec.Command("git", "config", "--global", "http.version", "HTTP/1.1")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to set git http version: %w", err)
	}

	cmd = exec.Command("git", "config", "--global", "http.postBuffer", "524288000")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to set git http buffer: %w", err)
	}

	return nil
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

type GitContributor struct {
	Name  string
	Email string
	Count int
}

func (s *GitService) GetContributors(owner, name string) ([]GitContributor, error) {
	repoPath := s.getRepoPath(owner, name)

	cmd := exec.Command("git", "-C", repoPath, "shortlog", "-sne", "HEAD")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get contributors: %w", err)
	}

	return s.parseGitShortlog(string(output)), nil
}

func (s *GitService) parseGitShortlog(output string) []GitContributor {
	var contributors []GitContributor
	lines := strings.Split(output, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.SplitN(line, "\t", 2)
		if len(parts) != 2 {
			continue
		}

		count := 0
		fmt.Sscanf(parts[0], "%d", &count)

		nameEmail := strings.TrimSpace(parts[1])
		name := nameEmail
		email := ""

		if idx := strings.LastIndex(nameEmail, "<"); idx != -1 {
			name = strings.TrimSpace(nameEmail[:idx])
			if endIdx := strings.LastIndex(nameEmail, ">"); endIdx != -1 {
				email = nameEmail[idx+1 : endIdx]
			}
		}

		contributors = append(contributors, GitContributor{
			Name:  name,
			Email: email,
			Count: count,
		})
	}

	return contributors
}

func (s *GitService) FetchRepository(owner, name string) error {
	repoPath := s.getRepoPath(owner, name)

	cmd := exec.Command("git", "-C", repoPath, "fetch", "--all")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to fetch updates: %w", err)
	}

	return nil
}

func (s *GitService) PullRepository(owner, name string) error {
	repoPath := s.getRepoPath(owner, name)

	cmd := exec.Command("git", "-C", repoPath, "pull")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to pull updates: %w", err)
	}

	return nil
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

type TreeEntry struct {
	Mode              string `json:"mode"`
	Type              string `json:"type"`
	Hash              string `json:"hash"`
	Size              string `json:"size"`
	Name              string `json:"name"`
	Path              string `json:"path"`
	LastCommitMessage string `json:"last_commit_message"`
	LastCommitTime    string `json:"last_commit_time"`
}

func (s *GitService) GetTreeWithSize(owner, name, ref, path string) ([]TreeEntry, error) {
	repoPath := s.getRepoPath(owner, name)

	var cmd *exec.Cmd
	if path == "" {
		cmd = exec.Command("git", "-C", repoPath, "ls-tree", "-l", ref)
	} else {
		cmd = exec.Command("git", "-C", repoPath, "ls-tree", "-l", ref, path+"/")
	}
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list tree: %w", err)
	}

	lines := strings.Split(string(output), "\n")
	entries := make([]TreeEntry, 0, len(lines))

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
			fullName := strings.Join(parts[4:], " ")

			nameParts := strings.Split(fullName, "/")
			name := nameParts[len(nameParts)-1]

			entry := TreeEntry{
				Mode: mode,
				Type: objType,
				Hash: objHash,
				Size: size,
				Name: name,
				Path: fullName,
			}

			commitMsg, commitTime := s.getLastCommitInfo(repoPath, ref, fullName)
			entry.LastCommitMessage = commitMsg
			entry.LastCommitTime = commitTime

			entries = append(entries, entry)
		}
	}

	return entries, nil
}

func (s *GitService) getLastCommitInfo(repoPath, ref, path string) (string, string) {
	cmd := exec.Command("git", "-C", repoPath, "log", "-1", "--format=%s|%ci", "--", path)
	output, err := cmd.Output()
	if err != nil {
		return "", ""
	}

	parts := strings.Split(strings.TrimSpace(string(output)), "|")
	if len(parts) >= 2 {
		return parts[0], parts[1]
	}
	return strings.TrimSpace(string(output)), ""
}

func (s *GitService) GetFileContentByRef(owner, name, ref, path string) (string, error) {
	repoPath := s.getRepoPath(owner, name)

	cmd := exec.Command("git", "-C", repoPath, "show", ref+":"+path)
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get file content: %w", err)
	}

	return string(output), nil
}

func (s *GitService) GetAllBranches(owner, name string) ([]string, error) {
	repoPath := s.getRepoPath(owner, name)

	cmd := exec.Command("git", "-C", repoPath, "branch", "-a", "--format=%(refname:short)")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list branches: %w", err)
	}

	lines := strings.Split(string(output), "\n")
	branches := make([]string, 0, len(lines))

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			branches = append(branches, line)
		}
	}

	return branches, nil
}
