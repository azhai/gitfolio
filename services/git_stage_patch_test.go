package services

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// stagePatchRepo 建一个只有 a.txt 的临时仓库，返回路径与清理函数。
func stagePatchRepo(t *testing.T, content string) (string, func()) {
	t.Helper()
	dir, err := os.MkdirTemp("", "gitfolio-patch-*")
	if err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	run := func(args ...string) {
		t.Helper()
		cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v: %s", args, err, out)
		}
	}
	run("init", "-q", "-b", "main")
	run("config", "user.name", "Test")
	run("config", "user.email", "test@example.com")
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte(content), 0644); err != nil {
		t.Fatalf("write: %v", err)
	}
	run("add", "a.txt")
	run("commit", "-q", "-m", "base")
	return dir, func() { os.RemoveAll(dir) }
}

func gitOut(t *testing.T, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v: %s", args, err, out)
	}
	return string(out)
}

// applySelection 用当前工作区的 diff 生成部分补丁并打进索引，返回暂存区内容。
func applySelection(t *testing.T, dir string, selected map[int]bool) string {
	t.Helper()
	diff := gitOut(t, dir, "diff", "-U3", "--", "a.txt")
	patch := buildPartialPatch(diff, selected)
	if strings.TrimSpace(patch) == "" {
		return ""
	}
	patchPath := filepath.Join(dir, ".partial.patch")
	if err := os.WriteFile(patchPath, []byte(patch), 0644); err != nil {
		t.Fatalf("write patch: %v", err)
	}
	defer os.Remove(patchPath)
	cmd := exec.Command("git", "-C", dir, "apply", "--cached", "--recount", patchPath)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git apply failed: %v\n%s\n--- patch ---\n%s", err, out, patch)
	}
	return gitOut(t, dir, "diff", "--cached", "--", "a.txt")
}

// 只暂存其中一行新增，索引里只应该有那一行。
func TestStagePatchStagesOnlySelectedAddition(t *testing.T) {
	dir, cleanup := stagePatchRepo(t, "one\ntwo\nthree\n")
	defer cleanup()

	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("one\nTWO\nthree\nfour\nfive\n"), 0644); err != nil {
		t.Fatalf("write: %v", err)
	}

	diff := gitOut(t, dir, "diff", "-U3", "--", "a.txt")
	lines, _, _ := parseUnifiedDiff(diff)
	addIdx := -1
	for i, line := range lines {
		if line.Type == "added" && line.Content == "four" {
			addIdx = i
		}
	}
	if addIdx < 0 {
		t.Fatalf("没有找到新增行 four：%+v", lines)
	}

	staged := applySelection(t, dir, map[int]bool{addIdx: true})
	if !strings.Contains(staged, "+four") {
		t.Fatalf("选中的新增行没有进索引：\n%s", staged)
	}
	// 未选中的新增行与未选中的修改都不能进索引。
	for _, unwanted := range []string{"+five", "+TWO", "-two"} {
		if strings.Contains(staged, unwanted) {
			t.Fatalf("未选中的 %q 也进了索引：\n%s", unwanted, staged)
		}
	}

	// 工作区仍然是完整的改动，暂存行不会从文件里消失。
	content, err := os.ReadFile(filepath.Join(dir, "a.txt"))
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if string(content) != "one\nTWO\nthree\nfour\nfive\n" {
		t.Fatalf("工作区内容被改动：%q", content)
	}
}

// 只暂存一行删除：索引里这一行消失，未选中的新增行仍然留在工作区。
func TestStagePatchStagesOnlySelectedDeletion(t *testing.T) {
	dir, cleanup := stagePatchRepo(t, "keep\ndrop\ntail\n")
	defer cleanup()

	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("keep\ntail\nadded\n"), 0644); err != nil {
		t.Fatalf("write: %v", err)
	}

	diff := gitOut(t, dir, "diff", "-U3", "--", "a.txt")
	lines, _, _ := parseUnifiedDiff(diff)
	delIdx := -1
	for i, line := range lines {
		if line.Type == "deleted" && line.Content == "drop" {
			delIdx = i
		}
	}
	if delIdx < 0 {
		t.Fatalf("没有找到删除行 drop：%+v", lines)
	}

	staged := applySelection(t, dir, map[int]bool{delIdx: true})
	if !strings.Contains(staged, "-drop") {
		t.Fatalf("选中的删除行没有进索引：\n%s", staged)
	}
	if strings.Contains(staged, "+added") {
		t.Fatalf("未选中的新增行进了索引：\n%s", staged)
	}
}

// 什么都没选时不该产生补丁。
func TestBuildPartialPatchEmptySelection(t *testing.T) {
	diff := `diff --git a/a.txt b/a.txt
index 1111111..2222222 100644
--- a/a.txt
+++ b/a.txt
@@ -1,2 +1,2 @@
 one
-two
+2
`
	if patch := buildPartialPatch(diff, map[int]bool{}); patch != "" {
		t.Fatalf("空选择生成了补丁：\n%s", patch)
	}
	// 选第二处（删除行）时，未选中的新增行要被丢掉。
	lines, _, _ := parseUnifiedDiff(diff)
	var idx int
	for i, line := range lines {
		if line.Type == "deleted" {
			idx = i
		}
	}
	patch := buildPartialPatch(diff, map[int]bool{idx: true})
	if strings.Contains(patch, "+2") {
		t.Fatalf("未选中的新增行泄漏进补丁：\n%s", patch)
	}
	if !strings.Contains(patch, "@@ -1,2 +1,1 @@") {
		t.Fatalf("hunk 头没有重算：\n%s", patch)
	}
}
