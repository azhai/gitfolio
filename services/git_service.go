package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

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

func (s *GitService) GetCommitCount(owner, name, ref string) (int, error) {
	repoPath := s.getRepoPath(owner, name)

	if ref == "" || ref == "HEAD" {
		ref = "main"
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

func (s *GitService) GetTagCount(owner, name string) (int, error) {
	repoPath := s.getRepoPath(owner, name)

	cmd := exec.Command("git", "-C", repoPath, "tag")
	output, err := cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("failed to list tags: %w", err)
	}

	if strings.TrimSpace(string(output)) == "" {
		return 0, nil
	}

	tags := strings.Split(strings.TrimSpace(string(output)), "\n")
	return len(tags), nil
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

type Commit struct {
	Hash        string   `json:"hash"`
	ShortHash   string   `json:"short_hash"`
	Message     string   `json:"message"`
	Author      string   `json:"author"`
	AuthorEmail string   `json:"author_email"`
	Date        string   `json:"date"`
	Branches    []string `json:"branches,omitempty"`
}

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

func (s *GitService) GetLastCommitInfo(owner, name, ref string) (message, time, author string, err error) {
	repoPath := s.getRepoPath(owner, name)

	cmd := exec.Command("git", "-C", repoPath, "log", "-1", "--format=%s|%ci|%an", ref)
	output, err := cmd.Output()
	if err != nil {
		return "", "", "", fmt.Errorf("failed to get last commit info: %w", err)
	}

	parts := strings.Split(strings.TrimSpace(string(output)), "|")
	if len(parts) >= 3 {
		return parts[0], parts[1], parts[2], nil
	}
	return strings.TrimSpace(string(output)), "", "", nil
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

type PRCommit struct {
	Hash        string `json:"hash"`
	ShortHash   string `json:"short_hash"`
	Message     string `json:"message"`
	Author      string `json:"author"`
	AuthorEmail string `json:"author_email"`
	Date        string `json:"date"`
}

type PRFileChange struct {
	Filename  string `json:"filename"`
	Status    string `json:"status"` // added, modified, deleted, renamed
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
	Patch     string `json:"patch,omitempty"`
}

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

type CodeStats struct {
	TotalLines   int64            `json:"total_lines"`
	CodeLines    int64            `json:"code_lines"`
	CommentLines int64            `json:"comment_lines"`
	BlankLines   int64            `json:"blank_lines"`
	Languages    map[string]int64 `json:"languages,omitempty"`
}

type CommitActivity struct {
	Date      string `json:"date"`
	Count     int    `json:"count"`
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
}

func (s *GitService) GetCodeStats(owner, name string) (*CodeStats, error) {
	repoPath := s.getRepoPath(owner, name)

	stats := &CodeStats{
		Languages: make(map[string]int64),
	}

	cmd := exec.Command("git", "-C", repoPath, "ls-files")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list files: %w", err)
	}

	files := strings.Split(strings.TrimSpace(string(output)), "\n")

	for _, file := range files {
		if file == "" {
			continue
		}

		contentCmd := exec.Command("git", "-C", repoPath, "cat-file", "-p", "HEAD:"+file)
		contentOutput, err := contentCmd.Output()
		if err != nil {
			continue
		}

		content := string(contentOutput)
		lines := strings.Split(content, "\n")

		var codeLines, commentLines, blankLines int64

		ext := strings.ToLower(s.getExtension(file))
		for _, line := range lines {
			trimmedLine := strings.TrimSpace(line)
			if trimmedLine == "" {
				blankLines++
			} else if isCommentLine(trimmedLine, ext) {
				commentLines++
			} else {
				codeLines++
			}
		}

		stats.TotalLines += int64(len(lines))
		stats.CodeLines += codeLines
		stats.CommentLines += commentLines
		stats.BlankLines += blankLines

		lang := getLanguage(ext)
		stats.Languages[lang] += codeLines
	}

	return stats, nil
}

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

func (s *GitService) getExtension(filename string) string {
	parts := strings.Split(filename, ".")
	if len(parts) > 1 {
		return parts[len(parts)-1]
	}
	return ""
}

func matchesDatePattern(line string) bool {
	match, _ := regexp.MatchString(`^\d{4}-\d{2}-\d{2}$`, line)
	return match
}

func isNumstatLine(line string) bool {
	match, _ := regexp.MatchString(`^[\d-]+\t[\d-]+\t`, line)
	return match
}

func isCommentLine(line, ext string) bool {
	commentPrefixes := map[string][]string{
		"go":     {"//"},
		"js":     {"//", "/*", "*"},
		"ts":     {"//", "/*", "*"},
		"py":     {"#"},
		"rb":     {"#"},
		"java":   {"//", "/*", "*"},
		"c":      {"//", "/*", "*"},
		"cpp":    {"//", "/*", "*"},
		"h":      {"//", "/*", "*"},
		"cs":     {"//", "/*", "*"},
		"php":    {"//", "#", "/*", "*"},
		"html":   {"<!--"},
		"css":    {"/*", "*"},
		"scss":   {"//", "/*", "*"},
		"less":   {"//", "/*", "*"},
		"rust":   {"//", "/*", "*"},
		"swift":  {"//", "/*", "*"},
		"kotlin": {"//", "/*", "*"},
		"scala":  {"//", "/*", "*"},
		"lua":    {"--"},
		"sql":    {"--"},
		"sh":     {"#"},
		"bash":   {"#"},
		"yaml":   {"#"},
		"yml":    {"#"},
		"toml":   {"#"},
		"ini":    {";", "#"},
		"conf":   {"#", ";"},
		"xml":    {"<!--"},
		"svg":    {"<!--"},
		"md":     {},
		"txt":    {},
		"json":   {},
	}

	prefixes, ok := commentPrefixes[ext]
	if !ok || len(prefixes) == 0 {
		return false
	}

	for _, prefix := range prefixes {
		if strings.HasPrefix(line, prefix) {
			return true
		}
	}

	return false
}

func getLanguage(ext string) string {
	languageMap := map[string]string{
		"go":     "Go",
		"js":     "JavaScript",
		"ts":     "TypeScript",
		"py":     "Python",
		"rb":     "Ruby",
		"java":   "Java",
		"c":      "C",
		"cpp":    "C++",
		"h":      "C/C++ Header",
		"cs":     "C#",
		"php":    "PHP",
		"html":   "HTML",
		"css":    "CSS",
		"scss":   "SCSS",
		"less":   "Less",
		"rust":   "Rust",
		"swift":  "Swift",
		"kotlin": "Kotlin",
		"scala":  "Scala",
		"lua":    "Lua",
		"sql":    "SQL",
		"sh":     "Shell",
		"bash":   "Bash",
		"yaml":   "YAML",
		"yml":    "YAML",
		"toml":   "TOML",
		"ini":    "INI",
		"conf":   "Config",
		"xml":    "XML",
		"svg":    "SVG",
		"md":     "Markdown",
		"txt":    "Text",
		"json":   "JSON",
	}

	if lang, ok := languageMap[ext]; ok {
		return lang
	}
	return "Other"
}

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

	commitSet := make(map[string]bool)
	for _, commit := range commits {
		commitSet[commit] = true
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
