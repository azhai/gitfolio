package services

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// historyRepo 建一个有四个提交的仓库，每个提交写一个独立文件（避免 rebase 冲突）。
// 返回仓库路径、提交列表（从新到旧）与清理函数。
func historyRepo(t *testing.T) (string, []string, func()) {
	t.Helper()
	dir, err := os.MkdirTemp("", "gitfolio-history-*")
	if err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	run := func(args ...string) string {
		t.Helper()
		out := gitOut(t, dir, args...)
		return out
	}
	run("init", "-q", "-b", "main")
	run("config", "user.name", "Test")
	run("config", "user.email", "test@example.com")
	for i, name := range []string{"c1", "c2", "c3", "c4"} {
		path := filepath.Join(dir, name+".txt")
		if err := os.WriteFile(path, []byte(name+"\n"), 0644); err != nil {
			t.Fatalf("write: %v", err)
		}
		run("add", "-A")
		run("commit", "-q", "-m", name)
		_ = i
	}
	shas := strings.Fields(gitOut(t, dir, "log", "--format=%H"))
	return dir, shas, func() { os.RemoveAll(dir) }
}

func logMessages(t *testing.T, dir string) []string {
	t.Helper()
	return strings.Fields(gitOut(t, dir, "log", "--format=%s"))
}

// 删除范围：from..to 两端都消失，范围外的提交保留。
func TestDeleteCommitRangeDropsInclusiveRange(t *testing.T) {
	dir, shas, cleanup := historyRepo(t)
	defer cleanup()

	// shas 从新到旧：c4 c3 c2 c1
	// 直接构造，避免 NewGitService 依赖已加载的全局配置。
	svc := &GitService{localPathOverride: dir}
	if err := svc.DeleteCommitRange("owner", "repo", shas[2], shas[1]); err != nil {
		t.Fatalf("DeleteCommitRange: %v", err)
	}

	got := strings.Join(logMessages(t, dir), ",")
	if got != "c4,c1" {
		t.Fatalf("删除 c2..c3 后的历史是 %q，期望 c4,c1", got)
	}
}

// 交互式 rebase：drop 掉中间那一个，其余按给定顺序重放。
func TestRebaseInteractiveDrop(t *testing.T) {
	dir, shas, cleanup := historyRepo(t)
	defer cleanup()

	// shas 从新到旧：c4 c3 c2 c1
	todos := []RebaseTodoItem{
		{Action: "pick", Hash: shas[2], Message: "c2"},
		{Action: "drop", Hash: shas[1], Message: "c3"},
		{Action: "pick", Hash: shas[0], Message: "c4"},
	}
	// 直接构造，避免 NewGitService 依赖已加载的全局配置。
	svc := &GitService{localPathOverride: dir}
	if err := svc.RebaseInteractive("owner", "repo", shas[3], todos); err != nil {
		t.Fatalf("RebaseInteractive: %v", err)
	}

	got := strings.Join(logMessages(t, dir), ",")
	if got != "c4,c2,c1" {
		t.Fatalf("drop 掉 c3 后的历史是 %q，期望 c4,c2,c1", got)
	}
}

// squash 会再触发一次提交信息编辑，没有 GIT_EDITOR=true 时这里会挂住。
func TestRebaseInteractiveSquash(t *testing.T) {
	dir, shas, cleanup := historyRepo(t)
	defer cleanup()

	todos := []RebaseTodoItem{
		{Action: "pick", Hash: shas[2], Message: "c2"},
		{Action: "squash", Hash: shas[1], Message: "c3"},
		{Action: "pick", Hash: shas[0], Message: "c4"},
	}
	// 直接构造，避免 NewGitService 依赖已加载的全局配置。
	svc := &GitService{localPathOverride: dir}
	if err := svc.RebaseInteractive("owner", "repo", shas[3], todos); err != nil {
		t.Fatalf("RebaseInteractive squash: %v", err)
	}

	// c2 与 c3 合成一个提交，历史变成 c4、合并后的提交、c1。
	if n := len(strings.Fields(gitOut(t, dir, "log", "--format=%s"))); n != 3 {
		t.Fatalf("squash 后应有 3 个提交，实际 %d：%v", n, logMessages(t, dir))
	}
}

// 本地仓库没有 origin，重置不应该因为「推送失败」而报错。
func TestResetCommitsWithoutRemote(t *testing.T) {
	dir, _, cleanup := historyRepo(t)
	defer cleanup()

	svc := &GitService{localPathOverride: dir}
	if err := svc.ResetCommits("owner", "repo", 1); err != nil {
		t.Fatalf("ResetCommits: %v", err)
	}
	got := strings.Join(logMessages(t, dir), ",")
	if got != "c3,c2,c1" {
		t.Fatalf("reset 掉 c4 后的历史是 %q，期望 c3,c2,c1", got)
	}
}
