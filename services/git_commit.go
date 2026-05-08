package services

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// CommitInfo 简要提交信息
type CommitInfo struct {
	Hash    string `json:"hash"`
	Author  string `json:"author"`
	Email   string `json:"email"`
	Message string `json:"message"`
}

// Commit 提交详情，含分支信息
type Commit struct {
	Hash        string   `json:"hash"`
	ShortHash   string   `json:"short_hash"`
	Message     string   `json:"message"`
	Author      string   `json:"author"`
	AuthorEmail string   `json:"author_email"`
	Date        string   `json:"date"`
	Branches    []string `json:"branches,omitempty"`
}

// PRCommit PR 提交信息
type PRCommit struct {
	Hash        string `json:"hash"`
	ShortHash   string `json:"short_hash"`
	Message     string `json:"message"`
	Author      string `json:"author"`
	AuthorEmail string `json:"author_email"`
	Date        string `json:"date"`
}

// CommitActivity 每日提交活动统计
type CommitActivity struct {
	Date      string `json:"date"`
	Count     int    `json:"count"`
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
}

// GetCommits 获取指定分支最近 N 条提交
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

// GetCommitCount 获取指定引用的提交总数
func (s *GitService) GetCommitCount(owner, name, ref string) (int, error) {
	repoPath := s.getRepoPath(owner, name)

	if ref == "" {
		ref = "HEAD"
	}

	cmd := exec.Command("git", "-C", repoPath, "rev-list", "--count", ref)
	output, err := cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("failed to count commits: %w", err)
	}

	count := 0
	fmt.Sscanf(strings.TrimSpace(string(output)), "%d", &count)
	return count, nil
}

// GetCommitList 分页获取提交列表
func (s *GitService) GetCommitList(owner, name, ref string, page, perPage int) ([]Commit, int, error) {
	repoPath := s.getRepoPath(owner, name)

	if ref == "" || ref == "HEAD" {
		ref = "HEAD"
	}

	countCmd := exec.Command("git", "-C", repoPath, "rev-list", "--count", ref)
	countOutput, err := countCmd.Output()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count commits: %w", err)
	}
	totalCommits := 0
	fmt.Sscanf(strings.TrimSpace(string(countOutput)), "%d", &totalCommits)

	skip := (page - 1) * perPage
	cmd := exec.Command("git", "-C", repoPath, "log", ref,
		"--format=%H|%h|%s|%an|%ae|%ai",
		fmt.Sprintf("--skip=%d", skip),
		fmt.Sprintf("-n%d", perPage))
	output, err := cmd.Output()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list commits: %w", err)
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	commits := make([]Commit, 0, len(lines))

	for _, line := range lines {
		if line == "" {
			continue
		}
		parts := strings.Split(line, "|")
		if len(parts) >= 6 {
			commits = append(commits, Commit{
				Hash:        parts[0],
				ShortHash:   parts[1],
				Message:     parts[2],
				Author:      parts[3],
				AuthorEmail: parts[4],
				Date:        parts[5],
			})
		}
	}

	return commits, totalCommits, nil
}

// GetLastCommitInfo 获取指定引用的最新提交信息（消息、时间、作者）
func (s *GitService) GetLastCommitInfo(owner, name, ref string) (message, time, author, hash string, err error) {
	repoPath := s.getRepoPath(owner, name)

	cmd := exec.Command("git", "-C", repoPath, "log", "-1", "--format=%s|%ci|%an|%h", ref)
	output, err := cmd.Output()
	if err != nil {
		return "", "", "", "", fmt.Errorf("failed to get last commit info: %w", err)
	}

	parts := strings.Split(strings.TrimSpace(string(output)), "|")
	if len(parts) >= 4 {
		return parts[0], parts[1], parts[2], parts[3], nil
	}
	return strings.TrimSpace(string(output)), "", "", "", nil
}

// GetPRCommits 分页获取 PR 源分支相对于目标分支的提交
func (s *GitService) GetPRCommits(owner, name, sourceBranch, targetBranch string, page, perPage int) ([]PRCommit, int, error) {
	repoPath := s.getRepoPath(owner, name)

	countCmd := exec.Command("git", "-C", repoPath, "rev-list", "--count", fmt.Sprintf("%s..%s", targetBranch, sourceBranch))
	countOutput, err := countCmd.Output()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count PR commits: %w", err)
	}
	totalCommits := 0
	fmt.Sscanf(strings.TrimSpace(string(countOutput)), "%d", &totalCommits)

	skip := (page - 1) * perPage
	cmd := exec.Command("git", "-C", repoPath, "log",
		fmt.Sprintf("%s..%s", targetBranch, sourceBranch),
		"--format=%H|%h|%s|%an|%ae|%ai",
		fmt.Sprintf("--skip=%d", skip),
		fmt.Sprintf("-n%d", perPage))
	output, err := cmd.Output()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get PR commits: %w", err)
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	commits := make([]PRCommit, 0, len(lines))

	for _, line := range lines {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "|", 6)
		if len(parts) >= 6 {
			commits = append(commits, PRCommit{
				Hash:        parts[0],
				ShortHash:   parts[1],
				Message:     parts[2],
				Author:      parts[3],
				AuthorEmail: parts[4],
				Date:        parts[5],
			})
		}
	}

	return commits, totalCommits, nil
}

// GetCommitActivity 获取最近 N 天的提交活动统计（含增删行数）
func (s *GitService) GetCommitActivity(owner, name string, days int) ([]CommitActivity, error) {
	repoPath := s.getRepoPath(owner, name)

	sinceDate := time.Now().AddDate(0, 0, -days).Format("2006-01-02")

	cmd := exec.Command("git", "-C", repoPath, "log",
		"--since="+sinceDate,
		"--format=%ad",
		"--date=short",
		"--numstat",
		"HEAD")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get commit activity: %w", err)
	}

	activityMap := make(map[string]*CommitActivity)
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	currentDate := ""

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if matchesDatePattern(line) {
			currentDate = line
			if _, exists := activityMap[currentDate]; !exists {
				activityMap[currentDate] = &CommitActivity{
					Date:      currentDate,
					Count:     0,
					Additions: 0,
					Deletions: 0,
				}
			}
			activityMap[currentDate].Count++
		} else if currentDate != "" && isNumstatLine(line) {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				additions := 0
				deletions := 0
				fmt.Sscanf(parts[0], "%d", &additions)
				fmt.Sscanf(parts[1], "%d", &deletions)

				if activityMap[currentDate] != nil {
					activityMap[currentDate].Additions += additions
					activityMap[currentDate].Deletions += deletions
				}
			}
		}
	}

	var activities []CommitActivity
	for i := days - 1; i >= 0; i-- {
		date := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		if act, exists := activityMap[date]; exists {
			activities = append(activities, *act)
		} else {
			activities = append(activities, CommitActivity{
				Date:      date,
				Count:     0,
				Additions: 0,
				Deletions: 0,
			})
		}
	}

	return activities, nil
}

// GetContributors 获取仓库贡献者列表（基于 git shortlog）
func (s *GitService) GetContributors(owner, name string) ([]GitContributor, error) {
	repoPath := s.getRepoPath(owner, name)

	cmd := exec.Command("git", "-C", repoPath, "shortlog", "-sne", "HEAD")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get contributors: %w", err)
	}

	return s.parseGitShortlog(string(output)), nil
}

// parseGitShortlog 解析 git shortlog 输出为贡献者列表
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

// GetBranchCount 获取仓库分支总数
func (s *GitService) GetBranchCount(owner, name string) (int, error) {
	repoPath := s.getRepoPath(owner, name)

	cmd := exec.Command("git", "-C", repoPath, "branch", "--list")
	output, err := cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("failed to list branches: %w", err)
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	count := 0
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		trimmed = strings.TrimPrefix(trimmed, "* ")
		if trimmed != "" {
			count++
		}
	}
	return count, nil
}

// GetTagCount 获取仓库标签总数
func (s *GitService) GetTagCount(owner, name string) (int, error) {
	repoPath := s.getRepoPath(owner, name)

	cmd := exec.Command("git", "-C", repoPath, "tag", "--list")
	output, err := cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("failed to list tags: %w", err)
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	count := 0
	for _, line := range lines {
		if strings.TrimSpace(line) != "" {
			count++
		}
	}
	return count, nil
}

// matchesDatePattern 检查字符串是否为 YYYY-MM-DD 日期格式
func matchesDatePattern(line string) bool {
	if len(line) != 10 {
		return false
	}
	for i, ch := range line {
		if i == 4 || i == 7 {
			if ch != '-' {
				return false
			}
		} else if ch < '0' || ch > '9' {
			return false
		}
	}
	return true
}

type CommitDetail struct {
	Hash               string             `json:"hash"`
	ShortHash          string             `json:"short_hash"`
	Message            string             `json:"message"`
	Author             string             `json:"author"`
	AuthorEmail        string             `json:"author_email"`
	Committer          string             `json:"committer"`
	CommitterEmail     string             `json:"committer_email"`
	Date               string             `json:"date"`
	VerificationStatus string             `json:"verification_status"`
	Parents            []string           `json:"parents"`
	Files              []CommitFileChange `json:"files"`
	Stats              CommitStatsSummary `json:"stats"`
	References         []CommitRefInfo    `json:"references,omitempty"`
}

type CommitFileChange struct {
	Filename  string `json:"filename"`
	Status    string `json:"status"`
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
	Patch     string `json:"patch,omitempty"`
}

type CommitStatsSummary struct {
	TotalAdditions int `json:"total_additions"`
	TotalDeletions int `json:"total_deletions"`
	FilesChanged   int `json:"files_changed"`
}

type CommitRefInfo struct {
	TargetType string `json:"target_type"`
	TargetID   int64  `json:"target_id"`
	Action     string `json:"action"`
}

func (s *GitService) GetCommitDetail(owner, name, sha string) (*CommitDetail, error) {
	repoPath := s.getRepoPath(owner, name)

	logCmd := exec.Command("git", "-C", repoPath, "log", "-1",
		"--format=%H|%h|%s|%an|%ae|%cn|%ce|%ai|%P", sha)
	logOutput, err := logCmd.Output()
	if err != nil {
		return nil, fmt.Errorf("commit not found: %w", err)
	}

	parts := strings.Split(strings.TrimSpace(string(logOutput)), "|")
	if len(parts) < 8 {
		return nil, fmt.Errorf("invalid commit log format")
	}

	var parentHashes []string
	if len(parts) >= 9 && parts[8] != "" {
		parentHashes = strings.Fields(parts[8])
	}

	verificationStatus := s.verifyCommitSignature(repoPath, sha)

	numstatCmd := exec.Command("git", "-C", repoPath, "diff-tree", "--no-commit-id",
		"-r", "--numstat", sha)
	numstatOutput, err := numstatCmd.Output()
	if err != nil {
		return &CommitDetail{
			Hash:               parts[0],
			ShortHash:          parts[1],
			Message:            parts[2],
			Author:             parts[3],
			AuthorEmail:        parts[4],
			Committer:          parts[5],
			CommitterEmail:     parts[6],
			Date:               parts[7],
			VerificationStatus: verificationStatus,
			Parents:            parentHashes,
			Files:              []CommitFileChange{},
			Stats:              CommitStatsSummary{},
		}, nil
	}

	files := s.parseCommitFiles(repoPath, sha, string(numstatOutput))

	totalAdditions := 0
	totalDeletions := 0
	for _, f := range files {
		totalAdditions += f.Additions
		totalDeletions += f.Deletions
	}

	return &CommitDetail{
		Hash:               parts[0],
		ShortHash:          parts[1],
		Message:            parts[2],
		Author:             parts[3],
		AuthorEmail:        parts[4],
		Committer:          parts[5],
		CommitterEmail:     parts[6],
		Date:               parts[7],
		VerificationStatus: verificationStatus,
		Parents:            parentHashes,
		Files:              files,
		Stats: CommitStatsSummary{
			TotalAdditions: totalAdditions,
			TotalDeletions: totalDeletions,
			FilesChanged:   len(files),
		},
	}, nil
}

func (s *GitService) parseCommitFiles(repoPath, sha, numstatOutput string) []CommitFileChange {
	lines := strings.Split(strings.TrimSpace(numstatOutput), "\n")
	files := make([]CommitFileChange, 0, len(lines))

	for _, line := range lines {
		if line == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 3 {
			continue
		}

		additions := 0
		deletions := 0
		if parts[0] != "-" {
			fmt.Sscanf(parts[0], "%d", &additions)
		}
		if parts[1] != "-" {
			fmt.Sscanf(parts[1], "%d", &deletions)
		}

		filename := strings.Join(parts[2:], " ")

		status := "modified"
		if additions > 0 && deletions == 0 {
			status = "added"
		} else if additions == 0 && deletions > 0 {
			status = "deleted"
		}

		patch := s.getCommitFilePatch(repoPath, sha, filename)

		files = append(files, CommitFileChange{
			Filename:  filename,
			Status:    status,
			Additions: additions,
			Deletions: deletions,
			Patch:     patch,
		})
	}
	return files
}

func (s *GitService) getCommitFilePatch(repoPath, sha, filename string) string {
	cmd := exec.Command("git", "-C", repoPath, "diff-tree", "-p", sha, "--", filename)
	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	return string(output)
}

func (s *GitService) verifyCommitSignature(repoPath, sha string) string {
	cmd := exec.Command("git", "-C", repoPath, "verify-commit", sha, "--raw")
	output, err := cmd.CombinedOutput()
	if err != nil {
		outputStr := string(output)
		if strings.Contains(outputStr, "no signature") || strings.Contains(outputStr, "not signed") {
			return "no_signature"
		}
		return "no_signature"
	}
	if strings.Contains(string(output), "GOODSIG") || strings.Contains(string(output), "VALIDSIG") {
		return "verified"
	}
	return "unverified"
}

type CompareResult struct {
	BaseCommit     *CommitInfo    `json:"base_commit"`
	HeadCommit     *CommitInfo    `json:"head_commit"`
	AheadBy        int            `json:"ahead_by"`
	BehindBy       int            `json:"behind_by"`
	Commits        []Commit       `json:"commits"`
	Files          []PRFileChange `json:"files"`
	TotalAdditions int            `json:"total_additions"`
	TotalDeletions int            `json:"total_deletions"`
}

func (s *GitService) CompareCommits(owner, name, base, head string) (*CompareResult, error) {
	repoPath := s.getRepoPath(owner, name)

	aheadCmd := exec.Command("git", "-C", repoPath, "rev-list", "--count",
		fmt.Sprintf("%s..%s", base, head))
	aheadOutput, err := aheadCmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to count ahead commits: %w", err)
	}
	aheadBy := 0
	fmt.Sscanf(strings.TrimSpace(string(aheadOutput)), "%d", &aheadBy)

	behindCmd := exec.Command("git", "-C", repoPath, "rev-list", "--count",
		fmt.Sprintf("%s..%s", head, base))
	behindOutput, err := behindCmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to count behind commits: %w", err)
	}
	behindBy := 0
	fmt.Sscanf(strings.TrimSpace(string(behindOutput)), "%d", &behindBy)

	baseInfo := s.getCommitInfo(repoPath, base)
	headInfo := s.getCommitInfo(repoPath, head)

	logCmd := exec.Command("git", "-C", repoPath, "log",
		fmt.Sprintf("%s..%s", base, head),
		"--format=%H|%h|%s|%an|%ae|%ai")
	logOutput, err := logCmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list commits: %w", err)
	}

	var commits []Commit
	lines := strings.Split(strings.TrimSpace(string(logOutput)), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}
		parts := strings.Split(line, "|")
		if len(parts) >= 6 {
			commits = append(commits, Commit{
				Hash:        parts[0],
				ShortHash:   parts[1],
				Message:     parts[2],
				Author:      parts[3],
				AuthorEmail: parts[4],
				Date:        parts[5],
			})
		}
	}

	files, totalAdditions, totalDeletions, err := s.GetPRFiles(owner, name, head, base)
	if err != nil {
		files = nil
		totalAdditions = 0
		totalDeletions = 0
	}

	return &CompareResult{
		BaseCommit:     baseInfo,
		HeadCommit:     headInfo,
		AheadBy:        aheadBy,
		BehindBy:       behindBy,
		Commits:        commits,
		Files:          files,
		TotalAdditions: totalAdditions,
		TotalDeletions: totalDeletions,
	}, nil
}

func (s *GitService) getCommitInfo(repoPath, ref string) *CommitInfo {
	cmd := exec.Command("git", "-C", repoPath, "log", "-1",
		"--format=%H|%an|%ae|%s", ref)
	output, err := cmd.Output()
	if err != nil {
		return nil
	}
	parts := strings.SplitN(strings.TrimSpace(string(output)), "|", 4)
	if len(parts) < 4 {
		return nil
	}
	return &CommitInfo{
		Hash:    parts[0][:7],
		Author:  parts[1],
		Email:   parts[2],
		Message: parts[3],
	}
}

// isNumstatLine 检查行是否为 git numstat 格式（增删行数 + 文件名）
func isNumstatLine(line string) bool {
	parts := strings.Fields(line)
	if len(parts) < 3 {
		return false
	}
	for _, p := range parts[:2] {
		if p != "-" {
			if _, err := strconv.Atoi(p); err != nil {
				return false
			}
		}
	}
	return true
}
