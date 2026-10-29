package services

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// setupBareClone 先建一个有提交内容的普通仓库，再克隆成裸仓库。
// 裸仓库没有工作区索引，正好用来验证统计不依赖 git ls-files。
func setupBareClone(t *testing.T) (string, func()) {
	t.Helper()

	tmpDir, err := os.MkdirTemp("", "gitfolio-stats-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	workPath := filepath.Join(tmpDir, "work")
	if err := exec.Command("git", "init", workPath).Run(); err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("failed to init repo: %v", err)
	}
	exec.Command("git", "-C", workPath, "config", "user.name", "Test User").Run()
	exec.Command("git", "-C", workPath, "config", "user.email", "test@example.com").Run()

	goSrc := "package main\n\n// 注释\nfunc main() {\n}\n\n"
	files := map[string]string{
		"main.go":    goSrc,
		"app.py":     "# comment\nprint(1)\n",
		"README.md":  "# Title\n\nbody\n",
		"big.json":   "[1, 2, 3]\n",
		"binary.png": "\x89PNG\r\n\x1a\n\x00\x01\x02\xff",
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(workPath, name), []byte(content), 0644); err != nil {
			os.RemoveAll(tmpDir)
			t.Fatalf("failed to write %s: %v", name, err)
		}
	}
	if err := exec.Command("git", "-C", workPath, "add", "-A").Run(); err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("failed to stage: %v", err)
	}
	if err := exec.Command("git", "-C", workPath, "commit", "-m", "initial").Run(); err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("failed to commit: %v", err)
	}

	barePath := filepath.Join(tmpDir, "bare")
	if err := exec.Command("git", "clone", "--bare", workPath, barePath).Run(); err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("failed to clone bare: %v", err)
	}

	return barePath, func() { os.RemoveAll(tmpDir) }
}

func TestGitService_GetCodeStats_BareRepo(t *testing.T) {
	barePath, cleanup := setupBareClone(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(barePath)

	stats, err := svc.GetCodeStats("owner", "repo")
	if err != nil {
		t.Fatalf("GetCodeStats() error = %v", err)
	}

	// 裸仓库的 git ls-files 返回空，统计曾经全是 0。
	if stats.TotalLines == 0 || stats.CodeLines == 0 {
		t.Errorf("GetCodeStats() on bare repo = %+v, want non-zero line counts", stats)
	}
	if stats.Languages["Go"] == 0 {
		t.Errorf("GetCodeStats() languages = %+v, want Go lines", stats.Languages)
	}
	if stats.Languages["Python"] != 1 {
		t.Errorf("GetCodeStats() Python = %d, want 1 code line", stats.Languages["Python"])
	}
	if stats.CommentLines == 0 {
		t.Error("GetCodeStats() should count comment lines")
	}
}

func TestGitService_GetCodeStats_WorkTreeRepo(t *testing.T) {
	barePath, cleanup := setupBareClone(t)
	defer cleanup()

	workPath := filepath.Join(filepath.Dir(barePath), "work")
	svc := newTestGitService().WithLocalPath(workPath)

	stats, err := svc.GetCodeStats("owner", "repo")
	if err != nil {
		t.Fatalf("GetCodeStats() error = %v", err)
	}
	if stats.TotalLines == 0 {
		t.Errorf("GetCodeStats() on work tree repo = %+v, want non-zero", stats)
	}
}

func TestGitService_GetContributors_BareRepo(t *testing.T) {
	barePath, cleanup := setupBareClone(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(barePath)

	contributors, err := svc.GetContributors("owner", "repo")
	if err != nil {
		t.Fatalf("GetContributors() error = %v", err)
	}
	if len(contributors) != 1 {
		t.Fatalf("GetContributors() = %+v, want exactly one contributor", contributors)
	}
	if contributors[0].Name != "Test User" || contributors[0].Email != "test@example.com" {
		t.Errorf("GetContributors() = %+v, want Test User <test@example.com>", contributors[0])
	}
	if contributors[0].Count != 1 {
		t.Errorf("GetContributors() count = %d, want 1", contributors[0].Count)
	}
}
