package services

import (
	"fmt"
	"os/exec"
	"strings"
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

// GetCodeStats 统计仓库代码行数和语言分布
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
