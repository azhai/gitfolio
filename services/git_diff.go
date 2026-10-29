package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
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

	var output []byte
	var err error
	if path == "" {
		output, err = exec.Command("git", "-C", repoPath, "ls-tree", "-l", ref).Output()
	} else {
		output, err = exec.Command("git", "-C", repoPath, "ls-tree", "-l", ref, path+"/").Output()
		// 前端用 /tree/<path> 同时打开目录和文件。路径是文件时 "path/" 不会
		// 报错，但也没有输出，这里再按文件查一次，让前端识别为文件并打开。
		if err == nil && len(strings.TrimSpace(string(output))) == 0 {
			if fileOut, fileErr := exec.Command("git", "-C", repoPath, "ls-tree", "-l", ref, path).Output(); fileErr == nil {
				output = fileOut
			}
		}
	}
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

			entries = append(entries, TreeEntry{
				Mode: mode,
				Type: objType,
				Hash: objHash,
				Size: size,
				Name: name,
				Path: fullName,
			})
		}
	}

	// 每个条目的最后提交本来要单独跑一次 git log，几十个文件就是几百毫秒。
	// 先扫最近若干条提交的改动文件，把本层条目的最新提交一次取出来；没扫到
	// 的（很久没改过）再并发补查。大目录多扫一些，减少回退次数。
	scanLimit := 300
	if len(entries) > 100 {
		scanLimit = 800
	}
	known := s.collectRecentCommits(repoPath, ref, path, scanLimit)

	var wg sync.WaitGroup
	sem := make(chan struct{}, 8)
	for i := range entries {
		e := &entries[i]
		if info, ok := known[e.Path]; ok {
			e.LastCommitMessage, e.LastCommitTime = info[0], info[1]
			continue
		}
		wg.Add(1)
		go func(e *TreeEntry) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			e.LastCommitMessage, e.LastCommitTime = s.getLastCommitInfo(repoPath, ref, e.Path)
		}(e)
	}
	wg.Wait()

	return entries, nil
}

// collectRecentCommits 返回 base 目录下各条目最近一次提交的 [message, time]。
// 只保留每个条目第一次（也就是最近一次）出现的提交，键为条目在本层的完整路径。
func (s *GitService) collectRecentCommits(repoPath, ref, base string, limit int) map[string][2]string {
	result := make(map[string][2]string)
	cmd := exec.Command("git", "-C", repoPath, "log", "-n", strconv.Itoa(limit),
		"--format=%x1e%ci%x09%s", "--name-only", ref)
	output, err := cmd.Output()
	if err != nil {
		return result
	}

	prefix := ""
	if base != "" {
		prefix = base + "/"
	}
	chunks := strings.Split(string(output), "\x1e")
	for _, chunk := range chunks[1:] {
		lines := strings.Split(strings.TrimRight(chunk, "\n"), "\n")
		if len(lines) == 0 {
			continue
		}
		meta := strings.SplitN(lines[0], "\t", 2)
		commitTime, message := meta[0], ""
		if len(meta) > 1 {
			message = meta[1]
		}
		for _, file := range lines[1:] {
			if !strings.HasPrefix(file, prefix) {
				continue
			}
			seg := strings.SplitN(file[len(prefix):], "/", 2)[0]
			key := prefix + seg
			if _, seen := result[key]; !seen {
				result[key] = [2]string{message, commitTime}
			}
		}
	}
	return result
}

// GetFileContentByRef 获取指定引用下文件的内容
func (s *GitService) GetFileContentByRef(owner, name, ref, path string) (string, error) {
	repoPath := s.getRepoPath(owner, name)

	// __working__ 和 __staged__ 特殊引用：直接从工作区读取文件
	if ref == "__working__" || ref == "__staged__" {
		return s.readFileFromWorktree(repoPath, path)
	}

	cmd := exec.Command("git", "-C", repoPath, "show", ref+":"+path)
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get file content: %w", err)
	}

	return string(output), nil
}

// readFileFromWorktree 从工作区直接读取文件内容
func (s *GitService) readFileFromWorktree(repoPath, path string) (string, error) {
	fullPath := filepath.Join(repoPath, path)
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to read file from worktree: %w", err)
	}
	return string(data), nil
}

// GetFileHexDump 获取二进制文件的十六进制转储，最多显示 maxBytes 字节
func (s *GitService) GetFileHexDump(owner, name, ref, path string, maxBytes int) (string, int, error) {
	repoPath := s.getRepoPath(owner, name)

	var data []byte
	var err error

	if ref == "__working__" || ref == "__staged__" {
		fullPath := filepath.Join(repoPath, path)
		data, err = os.ReadFile(fullPath)
	} else {
		cmd := exec.Command("git", "-C", repoPath, "show", ref+":"+path)
		data, err = cmd.Output()
	}
	if err != nil {
		return "", 0, fmt.Errorf("failed to read file: %w", err)
	}

	totalSize := len(data)
	if maxBytes > 0 && len(data) > maxBytes {
		data = data[:maxBytes]
	}

	var sb strings.Builder
	for i := 0; i < len(data); i += 16 {
		sb.WriteString(fmt.Sprintf("%08x  ", i))
		for j := 0; j < 16; j++ {
			if i+j < len(data) {
				sb.WriteString(fmt.Sprintf("%02x ", data[i+j]))
			} else {
				sb.WriteString("   ")
			}
			if j == 7 {
				sb.WriteString(" ")
			}
		}
		sb.WriteString(" |")
		for j := 0; j < 16; j++ {
			if i+j < len(data) {
				b := data[i+j]
				if b >= 32 && b <= 126 {
					sb.WriteByte(b)
				} else {
					sb.WriteByte('.')
				}
			}
		}
		sb.WriteString("|\n")
	}

	return sb.String(), totalSize, nil
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

// DiffLine 单行差异信息
type DiffLine struct {
	Type      string `json:"type"`
	Content   string `json:"content"`
	OldLineNo int    `json:"old_line_no"`
	NewLineNo int    `json:"new_line_no"`
}

// DiffResult 文件差异结果
type DiffResult struct {
	FilePath  string     `json:"file_path"`
	Lines     []DiffLine `json:"lines"`
	IsBinary  bool       `json:"is_binary"`
	Additions int        `json:"additions"`
	Deletions int        `json:"deletions"`
}

// GetFileDiff 获取指定文件的差异，staged=true时获取暂存区差异
func (s *GitService) GetFileDiff(owner, name, filePath string, staged bool) (*DiffResult, error) {
	repoPath := s.getRepoPath(owner, name)

	binCmd := exec.Command("git", "-C", repoPath, "diff", "--numstat")
	if staged {
		binCmd.Args = append(binCmd.Args, "--cached")
	}
	binCmd.Args = append(binCmd.Args, "--", filePath)
	binOut, _ := binCmd.Output()
	if strings.Contains(string(binOut), "-\t-\t") {
		return &DiffResult{FilePath: filePath, IsBinary: true}, nil
	}

	var cmd *exec.Cmd
	if staged {
		cmd = exec.Command("git", "-C", repoPath, "diff", "--cached", "-U3", "--", filePath)
	} else {
		cmd = exec.Command("git", "-C", repoPath, "diff", "-U3", "--", filePath)
	}
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get diff: %w", err)
	}

	result := &DiffResult{
		FilePath: filePath,
		Lines:    make([]DiffLine, 0),
	}
	result.Lines, result.Additions, result.Deletions = parseUnifiedDiff(string(output))
	return result, nil
}

// GetCommitFileDiff 获取指定提交中某文件的差异
func (s *GitService) GetCommitFileDiff(owner, name, sha, filePath string) (*DiffResult, error) {
	repoPath := s.getRepoPath(owner, name)

	cmd := exec.Command("git", "-C", repoPath, "diff", sha+"~1", sha, "-U3", "--", filePath)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get commit diff: %w", err)
	}

	result := &DiffResult{
		FilePath: filePath,
		Lines:    make([]DiffLine, 0),
	}
	result.Lines, result.Additions, result.Deletions = parseUnifiedDiff(string(output))
	return result, nil
}

// parseUnifiedDiff 解析统一diff格式输出
func parseUnifiedDiff(diffText string) ([]DiffLine, int, int) {
	lines := strings.Split(diffText, "\n")
	result := make([]DiffLine, 0, len(lines))
	additions := 0
	deletions := 0
	oldLine := 0
	newLine := 0

	for _, line := range lines {
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "diff ") || strings.HasPrefix(line, "index ") || strings.HasPrefix(line, "--- ") || strings.HasPrefix(line, "+++ ") {
			continue
		}
		if strings.HasPrefix(line, "@@ ") {
			parts := strings.Split(line, " ")
			if len(parts) >= 3 {
				oldRange := strings.TrimPrefix(parts[1], "-")
				newRange := strings.TrimPrefix(parts[2], "+")
				if oParts := strings.Split(oldRange, ","); len(oParts) > 0 {
					fmt.Sscanf(oParts[0], "%d", &oldLine)
				}
				if nParts := strings.Split(newRange, ","); len(nParts) > 0 {
					fmt.Sscanf(nParts[0], "%d", &newLine)
				}
			}
			result = append(result, DiffLine{Type: "hunk", Content: line, OldLineNo: -1, NewLineNo: -1})
			continue
		}
		if strings.HasPrefix(line, "+") {
			result = append(result, DiffLine{Type: "added", Content: line[1:], OldLineNo: -1, NewLineNo: newLine})
			newLine++
			additions++
		} else if strings.HasPrefix(line, "-") {
			result = append(result, DiffLine{Type: "deleted", Content: line[1:], OldLineNo: oldLine, NewLineNo: -1})
			oldLine++
			deletions++
		} else {
			content := line
			if strings.HasPrefix(line, " ") {
				content = line[1:]
			}
			result = append(result, DiffLine{Type: "context", Content: content, OldLineNo: oldLine, NewLineNo: newLine})
			oldLine++
			newLine++
		}
	}
	return result, additions, deletions
}

// parseHunkHeader 取出 hunk 头里的起始行号，@@ -12,3 +12,4 @@ 这种形式。
func parseHunkHeader(header string) (oldStart, newStart int) {
	parts := strings.Split(header, " ")
	for i := 1; i < len(parts) && i < 3; i++ {
		switch {
		case strings.HasPrefix(parts[i], "-"):
			fmt.Sscanf(strings.TrimPrefix(parts[i], "-"), "%d", &oldStart)
		case strings.HasPrefix(parts[i], "+"):
			fmt.Sscanf(strings.TrimPrefix(parts[i], "+"), "%d", &newStart)
		}
	}
	return oldStart, newStart
}

// buildPartialPatch 按行选择重建补丁，没选中的行继续留在工作区。
//
// 下标就是 parseUnifiedDiff 给出的行下标，与 GET /diff 返回的 lines 一致
// （hunk 头也占一行）。重建规则与 git add -p 相同：
//   - 选中的新增行保留，未选中的整行丢掉——这样它不会进索引；
//   - 选中的删除行保留，未选中的改写成上下文行——索引里本来就有这一行；
//   - hunk 头按实际内容重算行数与起始行号。
//
// 返回空串表示没有任何行被选中（或不是文本补丁）。
func buildPartialPatch(diffText string, selected map[int]bool) string {
	raw := strings.Split(diffText, "\n")
	header := make([]string, 0, 4)
	for _, line := range raw {
		if line == "" || strings.HasPrefix(line, "@@ ") {
			break
		}
		if strings.HasPrefix(line, "GIT binary patch") || strings.HasPrefix(line, "Binary files ") {
			return ""
		}
		header = append(header, line)
	}
	if len(header) == 0 {
		return ""
	}

	lines, _, _ := parseUnifiedDiff(diffText)
	out := make([]string, 0, len(header)+len(lines))
	out = append(out, header...)

	var (
		body     []string
		oldStart int
		newStart int
		oldCount int
		newCount int
		inHunk   bool
		changed  bool
	)
	// 一个 hunk 里没有任何被选中的 +/- 行时整块丢掉：只剩上下文行的补丁
	// 什么也不做，留着只会让人以为暂存了东西。
	flush := func() {
		if !inHunk || !changed {
			return
		}
		out = append(out, fmt.Sprintf("@@ -%d,%d +%d,%d @@", oldStart, oldCount, newStart, newCount))
		out = append(out, body...)
	}

	for i, line := range lines {
		if line.Type == "hunk" {
			flush()
			oldStart, newStart = parseHunkHeader(line.Content)
			oldCount, newCount = 0, 0
			body = body[:0]
			inHunk = true
			changed = false
			continue
		}
		if !inHunk {
			continue
		}
		// "\ No newline at end of file" 这类标记原样带过，不参与行数统计。
		if strings.HasPrefix(line.Content, "\\") {
			body = append(body, line.Content)
			continue
		}
		switch line.Type {
		case "added":
			if selected[i] {
				body = append(body, "+"+line.Content)
				newCount++
				changed = true
			}
		case "deleted":
			if selected[i] {
				body = append(body, "-"+line.Content)
				oldCount++
				changed = true
			} else {
				body = append(body, " "+line.Content)
				oldCount++
				newCount++
			}
		default:
			body = append(body, " "+line.Content)
			oldCount++
			newCount++
		}
	}
	flush()

	if len(out) == len(header) {
		return ""
	}
	return strings.Join(out, "\n") + "\n"
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
