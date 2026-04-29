package services

import (
	"fmt"
	"os/exec"
	"strings"
)

// FileInfo 文件基本信息
type FileInfo struct {
	Type string `json:"type"`
	Name string `json:"name"`
	Hash string `json:"hash"`
}

// TreeEntry 目录树条目，含文件大小和最后提交信息
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

// PRFileChange PR 文件变更信息
type PRFileChange struct {
	Filename  string `json:"filename"`
	Status    string `json:"status"`
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
	Patch     string `json:"patch,omitempty"`
}

// GetFileContent 获取指定分支下文件的内容
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

// GetTree 获取指定分支的目录树
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

// GetTreeWithSize 获取目录树（含文件大小和最后提交信息）
func (s *GitService) GetTreeWithSize(owner, name, ref, path string) ([]TreeEntry, error) {
	repoPath := s.getRepoPath(owner, name)

	if ref == "" || ref == "HEAD" {
		ref = "HEAD"
	}

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

// GetFileContentByRef 获取指定引用下文件的内容
func (s *GitService) GetFileContentByRef(owner, name, ref, path string) (string, error) {
	repoPath := s.getRepoPath(owner, name)

	cmd := exec.Command("git", "-C", repoPath, "show", ref+":"+path)
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get file content: %w", err)
	}

	return string(output), nil
}

// GetPRFiles 获取 PR 的文件变更列表，含增删行数和补丁
func (s *GitService) GetPRFiles(owner, name, sourceBranch, targetBranch string) ([]PRFileChange, int, int, error) {
	repoPath := s.getRepoPath(owner, name)

	cmd := exec.Command("git", "-C", repoPath, "diff",
		"--numstat",
		fmt.Sprintf("%s...%s", targetBranch, sourceBranch))
	output, err := cmd.Output()
	if err != nil {
		return nil, 0, 0, fmt.Errorf("failed to get PR files: %w", err)
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	files := make([]PRFileChange, 0, len(lines))
	totalAdditions := 0
	totalDeletions := 0

	for _, line := range lines {
		if line == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) >= 3 {
			additions := 0
			deletions := 0
			fmt.Sscanf(parts[0], "%d", &additions)
			fmt.Sscanf(parts[1], "%d", &deletions)

			filename := strings.Join(parts[2:], " ")
			status := "modified"
			if additions == 0 && deletions > 0 {
				status = "deleted"
			} else if additions > 0 && deletions == 0 {
				status = "added"
			}

			patch := s.getFilePatch(repoPath, filename, targetBranch, sourceBranch)

			files = append(files, PRFileChange{
				Filename:  filename,
				Status:    status,
				Additions: additions,
				Deletions: deletions,
				Patch:     patch,
			})
			totalAdditions += additions
			totalDeletions += deletions
		}
	}

	return files, totalAdditions, totalDeletions, nil
}

// getFilePatch 获取指定文件在两个分支间的差异补丁
func (s *GitService) getFilePatch(repoPath, filename, targetBranch, sourceBranch string) string {
	cmd := exec.Command("git", "-C", repoPath, "diff",
		"-p",
		"--",
		filename,
		fmt.Sprintf("%s...%s", targetBranch, sourceBranch))
	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	return string(output)
}

// getLastCommitInfo 获取指定路径下最后一条提交的消息和时间
func (s *GitService) getLastCommitInfo(repoPath, ref, path string) (string, string) {
	cmd := exec.Command("git", "-C", repoPath, "log", "-1", ref, "--format=%s|%ci", "--", path)
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
