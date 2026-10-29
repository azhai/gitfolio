package services

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// GitContributor Git 贡献者
type GitContributor struct {
	Name  string
	Email string
	Count int
}

// CodeStats 代码统计，含总行数、代码行、注释行、空行和语言分布
type CodeStats struct {
	TotalLines   int64            `json:"total_lines"`
	CodeLines    int64            `json:"code_lines"`
	CommentLines int64            `json:"comment_lines"`
	BlankLines   int64            `json:"blank_lines"`
	Languages    map[string]int64 `json:"languages,omitempty"`
}

// statsFileMaxSize 是参与统计的单个 blob 上限。锁文件、压缩包这类巨型文件读进内存
// 只会拖慢接口，行数也没有统计意义。
const statsFileMaxSize = 1 << 20

// treeFile 是 HEAD 树里的一个普通 blob。
type treeFile struct {
	sha string
	ext string
}

// listTreeFiles 从 HEAD 的树里列出文件。裸仓库没有工作区索引，git ls-files 返回空，
// 镜像仓库的代码统计于是全成了 0。
func (s *GitService) listTreeFiles(repoPath string) ([]treeFile, error) {
	cmd := exec.Command("git", "-C", repoPath, "ls-tree", "-r", "-l", "HEAD")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list files: %w", err)
	}

	var files []treeFile
	for _, line := range strings.Split(string(output), "\n") {
		// <mode> <type> <sha> <size>\t<path>
		parts := strings.SplitN(line, "\t", 2)
		if len(parts) != 2 {
			continue
		}
		meta := strings.Fields(parts[0])
		// mode 120000 是符号链接，内容只是一个路径而不是代码。
		if len(meta) < 4 || meta[1] != "blob" || meta[0] == "120000" {
			continue
		}
		if size, err := strconv.ParseInt(meta[3], 10, 64); err == nil && size > statsFileMaxSize {
			continue
		}
		files = append(files, treeFile{
			sha: meta[2],
			ext: strings.ToLower(s.getExtension(parts[1])),
		})
	}

	return files, nil
}

// countTreeBlobs 用一个 git cat-file --batch 进程读完所有 blob 并累计行数。
// 逐个文件起子进程在大仓库上要多等几十秒。
func (s *GitService) countTreeBlobs(repoPath string, files []treeFile, stats *CodeStats) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, "git", "-C", repoPath, "cat-file", "--batch")
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}

	go func() {
		defer stdin.Close()
		w := bufio.NewWriter(stdin)
		for _, f := range files {
			if _, err := w.WriteString(f.sha + "\n"); err != nil {
				return
			}
		}
		_ = w.Flush()
	}()

	reader := bufio.NewReader(stdout)
	for _, f := range files {
		header, err := reader.ReadString('\n')
		if err != nil {
			break
		}
		// <sha> blob <size>；对象缺失时是 <sha> missing
		fields := strings.Fields(header)
		if len(fields) != 3 || fields[1] != "blob" {
			continue
		}
		size, err := strconv.ParseInt(fields[2], 10, 64)
		if err != nil {
			continue
		}
		content := make([]byte, size)
		if _, err := io.ReadFull(reader, content); err != nil {
			break
		}
		// blob 内容后面紧跟一个换行分隔符
		if _, err := reader.Discard(1); err != nil {
			break
		}
		stats.addFile(f.ext, string(content))
	}

	_ = cmd.Wait()
	return ctx.Err()
}

// addFile 累计一个文件的总行数、代码行、注释行、空行和语言占比。
func (c *CodeStats) addFile(ext, content string) {
	lines := strings.Split(content, "\n")

	var codeLines, commentLines, blankLines int64
	for _, line := range lines {
		trimmedLine := strings.TrimSpace(line)
		switch {
		case trimmedLine == "":
			blankLines++
		case isCommentLine(trimmedLine, ext):
			commentLines++
		default:
			codeLines++
		}
	}

	c.TotalLines += int64(len(lines))
	c.CodeLines += codeLines
	c.CommentLines += commentLines
	c.BlankLines += blankLines

	if c.Languages == nil {
		c.Languages = make(map[string]int64)
	}
	c.Languages[getLanguage(ext)] += codeLines
}

// GetCodeStats 统计仓库代码行数和语言分布
func (s *GitService) GetCodeStats(owner, name string) (*CodeStats, error) {
	repoPath := s.getRepoPath(owner, name)

	stats := &CodeStats{
		Languages: make(map[string]int64),
	}

	files, err := s.listTreeFiles(repoPath)
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return stats, nil
	}

	if err := s.countTreeBlobs(repoPath, files, stats); err != nil {
		return nil, err
	}

	return stats, nil
}

// getExtension 从文件名中提取扩展名（不含点）
func (s *GitService) getExtension(filename string) string {
	parts := strings.Split(filename, ".")
	if len(parts) > 1 {
		return parts[len(parts)-1]
	}
	return ""
}

// isCommentLine 判断一行代码是否为注释行
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

// getLanguage 根据文件扩展名映射为编程语言名称
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
