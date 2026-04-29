package services

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

// CommitGraphLine 提交图行，包含图形信息和父提交关系
type CommitGraphLine struct {
	Hash        string   `json:"hash"`
	ShortHash   string   `json:"short_hash"`
	Message     string   `json:"message"`
	Author      string   `json:"author"`
	AuthorEmail string   `json:"author_email"`
	Date        string   `json:"date"`
	Branches    []string `json:"branches,omitempty"`
	GraphLine   string   `json:"graph_line"`
	Parents     []string `json:"parents,omitempty"`
}

// GetCommitGraph 获取全分支提交图，包含分支归属和父提交信息
func (s *GitService) GetCommitGraph(owner, name string, page, perPage int) ([]CommitGraphLine, int, error) {
	repoPath := s.getRepoPath(owner, name)

	branches, err := s.GetBranches(owner, name)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get branches: %w", err)
	}

	countCmd := exec.Command("git", "-C", repoPath, "rev-list", "--all", "--count")
	countOutput, err := countCmd.Output()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count commits: %w", err)
	}
	total, err := strconv.Atoi(strings.TrimSpace(string(countOutput)))
	if err != nil {
		total = 0
	}

	commitBranchMap := make(map[string][]string)

	for _, branch := range branches {
		cmd := exec.Command("git", "-C", repoPath, "log", branch,
			"--format=%H",
			fmt.Sprintf("-n%d", perPage*2))
		output, err := cmd.Output()
		if err != nil {
			continue
		}

		lines := strings.Split(strings.TrimSpace(string(output)), "\n")
		for _, line := range lines {
			if line == "" {
				continue
			}
			if _, exists := commitBranchMap[line]; !exists {
				commitBranchMap[line] = []string{}
			}
			commitBranchMap[line] = append(commitBranchMap[line], branch)
		}
	}

	if len(commitBranchMap) == 0 {
		return []CommitGraphLine{}, total, nil
	}

	graphCmd := exec.Command("git", "-C", repoPath, "log", "--all", "--graph", "--color=always",
		"--format=%H|%h|%s|%an|%ae|%ai|%P",
		fmt.Sprintf("-n%d", perPage),
		fmt.Sprintf("--skip=%d", (page-1)*perPage))
	graphOutput, err := graphCmd.Output()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get commit graph: %w", err)
	}

	graphLines := strings.Split(strings.TrimSpace(string(graphOutput)), "\n")
	allCommits := make([]CommitGraphLine, 0, len(graphLines))

	for _, line := range graphLines {
		if line == "" {
			continue
		}

		graphPart := ""
		commitPart := line

		cleanLine := stripANSI(line)
		for i, ch := range cleanLine {
			if ch == '*' || ch == '|' || ch == '/' || ch == '\\' || ch == '_' || ch == ' ' ||
				ch == '│' || ch == '─' || ch == '┌' || ch == '┐' || ch == '└' || ch == '┘' ||
				ch == '├' || ch == '┤' || ch == '┬' || ch == '┴' || ch == '┼' ||
				ch == '╭' || ch == '╮' || ch == '╯' || ch == '╰' {
				continue
			}
			graphPart = line[:findOriginalIndex(line, i)]
			commitPart = cleanLine[i:]
			break
		}

		graphPart = convertToUnicodeGraph(graphPart)

		parts := strings.Split(commitPart, "|")
		if len(parts) >= 6 {
			hash := parts[0]
			branches := commitBranchMap[hash]
			var parentHashes []string
			if len(parts) >= 7 && parts[6] != "" {
				parentHashes = strings.Fields(parts[6])
			}
			allCommits = append(allCommits, CommitGraphLine{
				Hash:        hash,
				ShortHash:   parts[1],
				Message:     parts[2],
				Author:      parts[3],
				AuthorEmail: parts[4],
				Date:        parts[5],
				Branches:    branches,
				GraphLine:   graphPart,
				Parents:     parentHashes,
			})
		}
	}

	return allCommits, total, nil
}

// GetBranches 获取本地分支列表
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

// GetAllBranches 获取所有分支列表（含远程分支）
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

// IsBareRepository 检查仓库是否为裸仓库
func (s *GitService) IsBareRepository(owner, name string) bool {
	repoPath := s.getRepoPath(owner, name)
	cmd := exec.Command("git", "-C", repoPath, "rev-parse", "--is-bare-repository")
	output, err := cmd.Output()
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(output)) == "true"
}

// GetStagedFiles 获取暂存区中已暂存的文件列表
func (s *GitService) GetStagedFiles(owner, name string) ([]string, error) {
	repoPath := s.getRepoPath(owner, name)
	cmd := exec.Command("git", "-C", repoPath, "diff", "--cached", "--name-only")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	return parseLines(output), nil
}

// GetWorkingTreeFiles 获取工作区中已修改但未暂存的文件列表
func (s *GitService) GetWorkingTreeFiles(owner, name string) ([]string, error) {
	repoPath := s.getRepoPath(owner, name)
	cmd := exec.Command("git", "-C", repoPath, "diff", "--name-only")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	return parseLines(output), nil
}

// GetUntrackedFiles 获取工作区中未被跟踪的文件列表
func (s *GitService) GetUntrackedFiles(owner, name string) ([]string, error) {
	repoPath := s.getRepoPath(owner, name)
	cmd := exec.Command("git", "-C", repoPath, "ls-files", "--others", "--exclude-standard")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	return parseLines(output), nil
}

// StageFiles 将指定文件添加到暂存区，若 files 为空则添加所有变更
func (s *GitService) StageFiles(owner, name string, files []string) error {
	repoPath := s.getRepoPath(owner, name)
	var cmd *exec.Cmd
	if len(files) == 0 {
		cmd = exec.Command("git", "-C", repoPath, "add", "-A")
	} else {
		args := []string{"-C", repoPath, "add"}
		args = append(args, files...)
		cmd = exec.Command("git", args...)
	}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git add failed: %s", string(output))
	}
	return nil
}

// UnstageFiles 将指定文件从暂存区移除
func (s *GitService) UnstageFiles(owner, name string, files []string) error {
	repoPath := s.getRepoPath(owner, name)
	args := []string{"-C", repoPath, "reset", "HEAD", "--"}
	args = append(args, files...)
	cmd := exec.Command("git", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git reset failed: %s", string(output))
	}
	return nil
}

// CommitChanges 提交暂存区的变更，需提供提交者和提交信息
func (s *GitService) CommitChanges(owner, name, message, authorName, authorEmail string) error {
	repoPath := s.getRepoPath(owner, name)
	cmd := exec.Command("git", "-C", repoPath, "commit", "-m", message)
	if authorName != "" && authorEmail != "" {
		cmd.Env = append(os.Environ(),
			fmt.Sprintf("GIT_AUTHOR_NAME=%s", authorName),
			fmt.Sprintf("GIT_AUTHOR_EMAIL=%s", authorEmail),
			fmt.Sprintf("GIT_COMMITTER_NAME=%s", authorName),
			fmt.Sprintf("GIT_COMMITTER_EMAIL=%s", authorEmail),
		)
	}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git commit failed: %s", string(output))
	}
	return nil
}

// CommitChangesWithHash 提交暂存区的变更并返回提交哈希
func (s *GitService) CommitChangesWithHash(owner, name, message, authorName, authorEmail string) (string, error) {
	repoPath := s.getRepoPath(owner, name)
	cmd := exec.Command("git", "-C", repoPath, "commit", "-m", message)
	if authorName != "" && authorEmail != "" {
		cmd.Env = append(os.Environ(),
			fmt.Sprintf("GIT_AUTHOR_NAME=%s", authorName),
			fmt.Sprintf("GIT_AUTHOR_EMAIL=%s", authorEmail),
			fmt.Sprintf("GIT_COMMITTER_NAME=%s", authorName),
			fmt.Sprintf("GIT_COMMITTER_EMAIL=%s", authorEmail),
		)
	}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git commit failed: %s", string(output))
	}

	hashCmd := exec.Command("git", "-C", repoPath, "rev-parse", "HEAD")
	hashOutput, err := hashCmd.Output()
	if err != nil {
		return "", nil
	}
	return strings.TrimSpace(string(hashOutput)), nil
}

// parseLines 将命令输出按行分割为字符串切片
func parseLines(output []byte) []string {
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	result := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			result = append(result, line)
		}
	}
	return result
}

// GetAllTags 获取所有标签列表
func (s *GitService) GetAllTags(owner, name string) ([]string, error) {
	repoPath := s.getRepoPath(owner, name)

	cmd := exec.Command("git", "-C", repoPath, "tag", "-l")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list tags: %w", err)
	}

	lines := strings.Split(string(output), "\n")
	tags := make([]string, 0, len(lines))

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			tags = append(tags, line)
		}
	}

	return tags, nil
}

// stripANSI 去除字符串中的 ANSI 转义序列
func stripANSI(s string) string {
	var buf strings.Builder
	buf.Grow(len(s))

	for i := 0; i < len(s); i++ {
		if s[i] == '\x1b' {
			for i < len(s) && s[i] != 'm' {
				i++
			}
			continue
		}
		buf.WriteByte(s[i])
	}

	return buf.String()
}

// findOriginalIndex 根据 cleanIndex 在含 ANSI 序列的原始字符串中找到对应位置
func findOriginalIndex(original string, cleanIndex int) int {
	cleanCount := 0
	for i := 0; i < len(original); i++ {
		if original[i] == '\x1b' {
			for i < len(original) && original[i] != 'm' {
				i++
			}
			continue
		}
		if cleanCount == cleanIndex {
			return i
		}
		cleanCount++
	}
	return len(original)
}

// convertToUnicodeGraph 将 ASCII 图形字符转换为 Unicode 绘图字符
func convertToUnicodeGraph(asciiGraph string) string {
	var buf strings.Builder
	buf.Grow(len(asciiGraph))

	runes := []rune(asciiGraph)
	for i := 0; i < len(runes); i++ {
		if runes[i] == '\x1b' {
			for i < len(runes) {
				buf.WriteRune(runes[i])
				if runes[i] == 'm' {
					break
				}
				i++
			}
			continue
		}

		ch := runes[i]
		switch ch {
		case '|':
			buf.WriteString("│")
		case '-', '_':
			buf.WriteString("─")
		case '/':
			buf.WriteString("╱")
		case '\\':
			buf.WriteString("╲")
		case '┌', '┐', '└', '┘', '├', '┤', '┬', '┴', '┼':
			buf.WriteRune(ch)
		default:
			buf.WriteRune(ch)
		}
	}

	return buf.String()
}
