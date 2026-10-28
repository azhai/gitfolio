package models

import (
	"os"
	"path/filepath"
	"strings"
)

// RepoLocation 描述一个仓库在磁盘上的落盘位置与存储形态。
type RepoLocation struct {
	// Path 是仓库根目录：裸仓库为 <name> 目录本身（不带 .git 后缀），
	// 普通仓库为含 .git 的工作区目录。
	Path string
	// Storage 是存储形态：bare（无工作区）或 work（带工作区）。
	Storage RepoStorage
}

// IsBare 报告该位置是否为裸仓库。
func (l RepoLocation) IsBare() bool {
	return l.Storage == RepoStorageBare
}

// SanitizeDirName 把任意字符串规整成安全的单层目录名：
// 只保留字母、数字、点、下划线和连字符，其余字符（含路径分隔符）替换为下划线。
// 空结果或纯点号回退为 "_"，避免产生上级目录引用或空路径。
func SanitizeDirName(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return "_"
	}
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z',
			r >= 'A' && r <= 'Z',
			r >= '0' && r <= '9',
			r == '.', r == '_', r == '-':
			b.WriteRune(r)
		default:
			b.WriteRune('_')
		}
	}
	out := b.String()
	if out == "." || out == ".." {
		return "_"
	}
	return out
}

// CleanRepoRoot 规整自有仓库目录：去掉首尾空白，拒绝包含上级目录引用的路径。
// 返回清理后的路径与是否为可接受的值。
func CleanRepoRoot(root string) (string, bool) {
	root = strings.TrimSpace(root)
	if root == "" {
		return "", false
	}
	cleaned := filepath.Clean(root)
	for _, seg := range strings.Split(cleaned, string(filepath.Separator)) {
		if seg == ".." {
			return "", false
		}
	}
	return cleaned, true
}

// ResolveRepoLocationUnder 计算仓库应存放的位置。
//
// 规则：
//   - 镜像项目（projectType = mirror）始终是裸仓库，不受自有目录影响：
//     <globalRoot>/<account>/<name>
//   - 其余项目，repoRoot 非空（账号设置了自有仓库目录）：
//     <repoRoot>/<name>，普通仓库（带工作区）
//   - 其余项目，repoRoot 为空：<globalRoot>/<account>/<name>，裸仓库
//
// 裸仓库目录不带 .git 后缀。account 与 name 会被规整为安全目录名，
// repoRoot 中含 ".." 时回退到裸仓库布局。
func ResolveRepoLocationUnder(globalRoot, account, repoRoot, name, projectType string) RepoLocation {
	bare := RepoLocation{
		Path:    filepath.Join(absPath(globalRoot), SanitizeDirName(account), SanitizeDirName(name)),
		Storage: RepoStorageBare,
	}
	if projectType == string(ProjectTypeMirror) {
		return bare
	}
	if root, ok := CleanRepoRoot(repoRoot); ok {
		return RepoLocation{
			Path:    filepath.Join(absPath(root), SanitizeDirName(name)),
			Storage: RepoStorageWork,
		}
	}
	return bare
}

// absPath 把可能相对的工作目录转成绝对路径，避免结果依赖进程启动位置。
func absPath(p string) string {
	if abs, err := filepath.Abs(p); err == nil {
		return abs
	}
	return p
}

// StorageOfPath 根据磁盘现状判断仓库形态：存在 .git 子目录即为普通仓库，
// 否则（含目录尚不存在的情况）按裸仓库处理。
func StorageOfPath(path string) RepoStorage {
	if fi, err := os.Stat(filepath.Join(path, ".git")); err == nil && fi.IsDir() {
		return RepoStorageWork
	}
	return RepoStorageBare
}
