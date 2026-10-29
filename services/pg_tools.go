package services

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

// pgBinPatterns 是 PostgreSQL 客户端的常见安装位置。带版本号的目录会倒序
// 匹配，优先用较新的大版本。
var pgBinPatterns = []string{
	"/opt/homebrew/opt/postgresql@*/bin",
	"/usr/local/opt/postgresql@*/bin",
	"/opt/homebrew/bin",
	"/usr/local/bin",
	"/Applications/Postgres.app/Contents/Versions/latest/bin",
	"/Library/PostgreSQL/*/bin",
	"/usr/lib/postgresql/*/bin",
	"/usr/pgsql-*/bin",
}

var pgTools struct {
	once sync.Once
	dir  string
}

// EnsurePgTools 保证 pg_dump 和 psql 能从 PATH 找到。
// 备份引擎通过 exec.LookPath 调用这两个外部命令，而从 launchd 或 Finder
// 启动的进程 PATH 往往只有 /usr/bin:/bin，Homebrew 装的 PostgreSQL 不在里面，
// 备份就会一直报 “pg_dump not found in PATH”。这里先看 PG_BIN 环境变量，
// 再按常见安装位置查找，找到后把目录插到 PATH 最前面。
// 返回补进去的目录；本来就能找到时返回空字符串。
func EnsurePgTools() string {
	pgTools.once.Do(func() {
		if pgToolsFound("") {
			return
		}
		if dir := strings.TrimSpace(os.Getenv("PG_BIN")); dir != "" && pgToolsFound(dir) {
			pgTools.dir = prependPATH(dir)
			return
		}
		for _, pattern := range pgBinPatterns {
			matches, _ := filepath.Glob(pattern)
			for i := len(matches) - 1; i >= 0; i-- {
				if pgToolsFound(matches[i]) {
					pgTools.dir = prependPATH(matches[i])
					return
				}
			}
		}
	})
	return pgTools.dir
}

func pgToolsFound(dir string) bool {
	for _, name := range []string{"pg_dump", "psql"} {
		path := name
		if dir != "" {
			path = filepath.Join(dir, name)
		}
		if _, err := exec.LookPath(path); err != nil {
			return false
		}
	}
	return true
}

func prependPATH(dir string) string {
	current := os.Getenv("PATH")
	for _, p := range strings.Split(current, string(os.PathListSeparator)) {
		if p == dir {
			return ""
		}
	}
	if current == "" {
		os.Setenv("PATH", dir)
	} else {
		os.Setenv("PATH", dir+string(os.PathListSeparator)+current)
	}
	return dir
}
