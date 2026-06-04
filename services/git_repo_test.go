package services

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/azhai/gitfolio/models"
)

// setupTestRepo 创建一个临时的 git 仓库用于测试
func setupTestRepo(t *testing.T) (string, func()) {
	t.Helper()

	tmpDir, err := os.MkdirTemp("", "gitfolio-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	// 初始化 git 仓库
	cmd := exec.Command("git", "init", tmpDir)
	if err := cmd.Run(); err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("failed to init git repo: %v", err)
	}

	// 配置 git 用户
	exec.Command("git", "-C", tmpDir, "config", "user.name", "Test User").Run()
	exec.Command("git", "-C", tmpDir, "config", "user.email", "test@example.com").Run()

	// 创建初始提交
	readmePath := filepath.Join(tmpDir, "README.md")
	if err := os.WriteFile(readmePath, []byte("# Test Repo\n"), 0644); err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("failed to create README: %v", err)
	}

	exec.Command("git", "-C", tmpDir, "add", "README.md").Run()
	exec.Command("git", "-C", tmpDir, "commit", "-m", "Initial commit").Run()

	cleanup := func() {
		os.RemoveAll(tmpDir)
	}

	return tmpDir, cleanup
}

// setupTestBareRepo 创建一个临时的裸仓库用于测试
func setupTestBareRepo(t *testing.T) (string, func()) {
	t.Helper()

	tmpDir, err := os.MkdirTemp("", "gitfolio-bare-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	barePath := filepath.Join(tmpDir, "repo.git")
	cmd := exec.Command("git", "init", "--bare", barePath)
	if err := cmd.Run(); err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("failed to init bare repo: %v", err)
	}

	cleanup := func() {
		os.RemoveAll(tmpDir)
	}

	return barePath, cleanup
}

func newTestGitService() *GitService {
	return &GitService{
		repoRoot:  "/tmp/gitfolio-test/repos",
		localRoot: "/tmp/gitfolio-test/local",
	}
}

func TestGitService_WithLocalPath(t *testing.T) {
	svc := newTestGitService()
	result := svc.WithLocalPath("/some/path")

	if result != svc {
		t.Error("WithLocalPath() should return the same service instance")
	}
	if svc.localPathOverride != "/some/path" {
		t.Errorf("localPathOverride = %q, want '/some/path'", svc.localPathOverride)
	}
}

func TestGitService_getRepoPath_LocalPathOverride(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)
	result := svc.getRepoPath("owner", "repo")

	if result != tmpDir {
		t.Errorf("getRepoPath() = %q, want %q", result, tmpDir)
	}
}

func TestGitService_isBareRepo(t *testing.T) {
	t.Run("non-bare repo", func(t *testing.T) {
		tmpDir, cleanup := setupTestRepo(t)
		defer cleanup()

		svc := newTestGitService().WithLocalPath(tmpDir)
		if svc.isBareRepo(tmpDir) {
			t.Error("isBareRepo() should return false for non-bare repo")
		}
	})

	t.Run("bare repo", func(t *testing.T) {
		barePath, cleanup := setupTestBareRepo(t)
		defer cleanup()

		svc := newTestGitService().WithLocalPath(barePath)
		if !svc.isBareRepo(barePath) {
			t.Error("isBareRepo() should return true for bare repo")
		}
	})
}

func TestGitService_HasStagedOrWorkingChanges(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	t.Run("no changes", func(t *testing.T) {
		if svc.HasStagedOrWorkingChanges(tmpDir) {
			t.Error("HasStagedOrWorkingChanges() should return false when no changes")
		}
	})

	t.Run("with untracked file", func(t *testing.T) {
		newFile := filepath.Join(tmpDir, "newfile.txt")
		os.WriteFile(newFile, []byte("hello"), 0644)

		if !svc.HasStagedOrWorkingChanges(tmpDir) {
			t.Error("HasStagedOrWorkingChanges() should return true for untracked file")
		}
		os.Remove(newFile)
	})

	t.Run("with modified file", func(t *testing.T) {
		readmePath := filepath.Join(tmpDir, "README.md")
		os.WriteFile(readmePath, []byte("# Modified\n"), 0644)

		if !svc.HasStagedOrWorkingChanges(tmpDir) {
			t.Error("HasStagedOrWorkingChanges() should return true for modified file")
		}
	})
}

func TestGitService_AutoCommitStaged(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	t.Run("no changes returns empty", func(t *testing.T) {
		hash, err := svc.AutoCommitStaged(tmpDir)
		if err != nil {
			t.Errorf("AutoCommitStaged() error = %v", err)
		}
		if hash != "" {
			t.Errorf("AutoCommitStaged() hash = %q, want empty when no changes", hash)
		}
	})

	t.Run("commits changes and returns hash", func(t *testing.T) {
		newFile := filepath.Join(tmpDir, "feature.txt")
		os.WriteFile(newFile, []byte("new feature"), 0644)

		hash, err := svc.AutoCommitStaged(tmpDir)
		if err != nil {
			t.Errorf("AutoCommitStaged() error = %v", err)
		}
		if hash == "" {
			t.Error("AutoCommitStaged() should return non-empty hash after commit")
		}
		if len(hash) != 40 {
			t.Errorf("AutoCommitStaged() hash length = %d, want 40", len(hash))
		}
	})
}

func TestGitService_CreateBranch(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	err := svc.CreateBranch("owner", "repo", "feature/test", "HEAD")
	if err != nil {
		t.Errorf("CreateBranch() error = %v", err)
	}

	// 验证分支已创建
	cmd := exec.Command("git", "-C", tmpDir, "branch", "--list", "feature/test")
	output, _ := cmd.Output()
	if len(output) == 0 {
		t.Error("CreateBranch() should create the branch")
	}
}

func TestGitService_DeleteBranch(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	// 先创建分支
	exec.Command("git", "-C", tmpDir, "branch", "to-delete").Run()

	err := svc.DeleteBranch("owner", "repo", "to-delete", false)
	if err != nil {
		t.Errorf("DeleteBranch() error = %v", err)
	}

	// 验证分支已删除
	cmd := exec.Command("git", "-C", tmpDir, "branch", "--list", "to-delete")
	output, _ := cmd.Output()
	if len(output) > 0 {
		t.Error("DeleteBranch() should delete the branch")
	}
}

func TestGitService_DeleteBranch_Force(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	// 创建分支并添加一个未合并的提交
	exec.Command("git", "-C", tmpDir, "branch", "unmerged").Run()
	exec.Command("git", "-C", tmpDir, "checkout", "unmerged").Run()
	newFile := filepath.Join(tmpDir, "unmerged.txt")
	os.WriteFile(newFile, []byte("unmerged change"), 0644)
	exec.Command("git", "-C", tmpDir, "add", "-A").Run()
	exec.Command("git", "-C", tmpDir, "commit", "-m", "unmerged commit").Run()
	exec.Command("git", "-C", tmpDir, "checkout", "main").Run() // 切回 main

	// 普通删除应该失败
	err := svc.DeleteBranch("owner", "repo", "unmerged", false)
	if err == nil {
		t.Error("DeleteBranch() with force=false should fail for unmerged branch")
	}

	// 强制删除应该成功
	err = svc.DeleteBranch("owner", "repo", "unmerged", true)
	if err != nil {
		t.Errorf("DeleteBranch() with force=true error = %v", err)
	}
}

func TestGitService_RenameBranch(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	exec.Command("git", "-C", tmpDir, "branch", "old-name").Run()

	err := svc.RenameBranch("owner", "repo", "old-name", "new-name")
	if err != nil {
		t.Errorf("RenameBranch() error = %v", err)
	}

	// 验证新分支存在
	cmd := exec.Command("git", "-C", tmpDir, "branch", "--list", "new-name")
	output, _ := cmd.Output()
	if len(output) == 0 {
		t.Error("RenameBranch() should create the new branch name")
	}

	// 验证旧分支不存在
	cmd = exec.Command("git", "-C", tmpDir, "branch", "--list", "old-name")
	output, _ = cmd.Output()
	if len(output) > 0 {
		t.Error("RenameBranch() should remove the old branch name")
	}
}

func TestGitService_EditFile(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	hash, err := svc.EditFile("owner", "repo", "hello.txt", "Hello World", "Add hello.txt", "Test", "test@example.com")
	if err != nil {
		t.Errorf("EditFile() error = %v", err)
	}
	if hash == "" {
		t.Error("EditFile() should return a commit hash")
	}

	// 验证文件内容
	content, err := os.ReadFile(filepath.Join(tmpDir, "hello.txt"))
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}
	if string(content) != "Hello World" {
		t.Errorf("file content = %q, want 'Hello World'", string(content))
	}
}

func TestGitService_EditFile_UpdateExisting(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	// 先创建文件
	svc.EditFile("owner", "repo", "update.txt", "v1", "Add file", "Test", "test@example.com")

	// 再更新
	hash, err := svc.EditFile("owner", "repo", "update.txt", "v2", "Update file", "Test", "test@example.com")
	if err != nil {
		t.Errorf("EditFile() update error = %v", err)
	}
	if hash == "" {
		t.Error("EditFile() update should return a commit hash")
	}

	content, _ := os.ReadFile(filepath.Join(tmpDir, "update.txt"))
	if string(content) != "v2" {
		t.Errorf("file content = %q, want 'v2'", string(content))
	}
}

func TestGitService_DeleteFile(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	// 先创建文件
	svc.EditFile("owner", "repo", "to-delete.txt", "content", "Add file", "Test", "test@example.com")

	// 删除文件
	hash, err := svc.DeleteFile("owner", "repo", "to-delete.txt", "Delete file", "Test", "test@example.com")
	if err != nil {
		t.Errorf("DeleteFile() error = %v", err)
	}
	if hash == "" {
		t.Error("DeleteFile() should return a commit hash")
	}

	// 验证文件已删除
	if _, err := os.Stat(filepath.Join(tmpDir, "to-delete.txt")); !os.IsNotExist(err) {
		t.Error("DeleteFile() should remove the file")
	}
}

func TestGitService_RemoteOperations(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	t.Run("list remotes initially empty", func(t *testing.T) {
		remotes, err := svc.ListRemotes("owner", "repo")
		if err != nil {
			t.Errorf("ListRemotes() error = %v", err)
		}
		// 新仓库没有 remote
		if len(remotes) != 0 {
			t.Errorf("ListRemotes() = %d remotes, want 0", len(remotes))
		}
	})

	t.Run("add remote", func(t *testing.T) {
		err := svc.AddRemote("owner", "repo", "origin", "https://github.com/test/repo.git")
		if err != nil {
			t.Errorf("AddRemote() error = %v", err)
		}

		remotes, _ := svc.ListRemotes("owner", "repo")
		if len(remotes) != 1 {
			t.Fatalf("ListRemotes() = %d remotes, want 1", len(remotes))
		}
		if remotes[0].Name != "origin" {
			t.Errorf("remote name = %q, want 'origin'", remotes[0].Name)
		}
		if remotes[0].FetchURL != "https://github.com/test/repo.git" {
			t.Errorf("remote fetch URL = %q, want 'https://github.com/test/repo.git'", remotes[0].FetchURL)
		}
	})

	t.Run("add second remote", func(t *testing.T) {
		err := svc.AddRemote("owner", "repo", "upstream", "https://github.com/upstream/repo.git")
		if err != nil {
			t.Errorf("AddRemote() error = %v", err)
		}

		remotes, _ := svc.ListRemotes("owner", "repo")
		if len(remotes) != 2 {
			t.Errorf("ListRemotes() = %d remotes, want 2", len(remotes))
		}
	})

	t.Run("set remote url", func(t *testing.T) {
		err := svc.SetRemoteURL("owner", "repo", "origin", "https://github.com/test/new-repo.git")
		if err != nil {
			t.Errorf("SetRemoteURL() error = %v", err)
		}

		remotes, _ := svc.ListRemotes("owner", "repo")
		for _, r := range remotes {
			if r.Name == "origin" && r.FetchURL != "https://github.com/test/new-repo.git" {
				t.Errorf("origin fetch URL = %q, want 'https://github.com/test/new-repo.git'", r.FetchURL)
			}
		}
	})

	t.Run("add push url", func(t *testing.T) {
		err := svc.AddRemotePushURL("owner", "repo", "origin", "https://github.com/test/push-repo.git")
		if err != nil {
			t.Errorf("AddRemotePushURL() error = %v", err)
		}

		remotes, _ := svc.ListRemotes("owner", "repo")
		for _, r := range remotes {
			if r.Name == "origin" {
				found := false
				for _, u := range r.PushURLs {
					if u == "https://github.com/test/push-repo.git" {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("origin push URLs = %v, should contain 'https://github.com/test/push-repo.git'", r.PushURLs)
				}
			}
		}
	})

	t.Run("remove push url", func(t *testing.T) {
		err := svc.RemoveRemotePushURL("owner", "repo", "origin", "https://github.com/test/push-repo.git")
		if err != nil {
			t.Errorf("RemoveRemotePushURL() error = %v", err)
		}
	})

	t.Run("remove remote", func(t *testing.T) {
		err := svc.RemoveRemote("owner", "repo", "upstream")
		if err != nil {
			t.Errorf("RemoveRemote() error = %v", err)
		}

		remotes, _ := svc.ListRemotes("owner", "repo")
		if len(remotes) != 1 {
			t.Errorf("ListRemotes() = %d remotes, want 1", len(remotes))
		}
	})
}

func TestGitService_GetRepoStatus(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	status := svc.GetRepoStatus("owner", "repo")

	if status["rebasing"] != false {
		t.Error("GetRepoStatus() rebasing should be false for clean repo")
	}
	if status["reverting"] != false {
		t.Error("GetRepoStatus() reverting should be false for clean repo")
	}
	if status["merging"] != false {
		t.Error("GetRepoStatus() merging should be false for clean repo")
	}
}

func TestGitService_InitRepository(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "gitfolio-init-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	svc := &GitService{
		localRoot: tmpDir,
		repoRoot:  tmpDir,
	}

	repo := &models.Repository{
		Name:        "test-repo",
		Description: "A test repository",
	}

	err = svc.InitRepository("testowner", repo)
	if err != nil {
		t.Fatalf("InitRepository() error = %v", err)
	}

	repoPath := filepath.Join(tmpDir, "test-repo")
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		t.Error("InitRepository() should create the repository directory")
	}

	// 验证 README.md
	readmePath := filepath.Join(repoPath, "README.md")
	content, err := os.ReadFile(readmePath)
	if err != nil {
		t.Fatalf("failed to read README: %v", err)
	}
	if len(content) == 0 {
		t.Error("InitRepository() should create a non-empty README.md")
	}

	// 验证是 git 仓库
	gitDir := filepath.Join(repoPath, ".git")
	if _, err := os.Stat(gitDir); os.IsNotExist(err) {
		t.Error("InitRepository() should initialize a git repository")
	}
}

func TestGitService_DeleteRepository(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	err := svc.DeleteRepository("owner", "repo")
	if err != nil {
		t.Errorf("DeleteRepository() error = %v", err)
	}

	if _, err := os.Stat(tmpDir); !os.IsNotExist(err) {
		t.Error("DeleteRepository() should remove the directory")
	}
}

func TestGitService_AbortOperation_UnknownType(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	err := svc.AbortOperation("owner", "repo", "unknown")
	if err == nil {
		t.Error("AbortOperation() should return error for unknown operation type")
	}
}

func TestGitService_ResetCommits_InvalidCount(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	err := svc.ResetCommits("owner", "repo", 0)
	if err == nil {
		t.Error("ResetCommits() should return error for count <= 0")
	}

	err = svc.ResetCommits("owner", "repo", -1)
	if err == nil {
		t.Error("ResetCommits() should return error for negative count")
	}
}

func TestGitService_MergeBranch(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	// 创建一个分支并添加提交
	exec.Command("git", "-C", tmpDir, "checkout", "-b", "feature").Run()
	newFile := filepath.Join(tmpDir, "feature.txt")
	os.WriteFile(newFile, []byte("feature content"), 0644)
	exec.Command("git", "-C", tmpDir, "add", "-A").Run()
	exec.Command("git", "-C", tmpDir, "commit", "-m", "feature commit").Run()
	exec.Command("git", "-C", tmpDir, "checkout", "main").Run()

	// 合并
	err := svc.MergeBranch("owner", "repo", "feature", "main")
	if err != nil {
		t.Errorf("MergeBranch() error = %v", err)
	}

	// 验证合并后文件存在
	if _, err := os.Stat(filepath.Join(tmpDir, "feature.txt")); os.IsNotExist(err) {
		t.Error("MergeBranch() should merge the feature file into main")
	}
}

func TestGitService_CherryPick(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	// 创建一个分支并添加提交
	exec.Command("git", "-C", tmpDir, "checkout", "-b", "feature").Run()
	newFile := filepath.Join(tmpDir, "cherry.txt")
	os.WriteFile(newFile, []byte("cherry content"), 0644)
	exec.Command("git", "-C", tmpDir, "add", "-A").Run()
	exec.Command("git", "-C", tmpDir, "commit", "-m", "cherry commit").Run()

	// 获取提交 hash
	hashOutput, _ := exec.Command("git", "-C", tmpDir, "rev-parse", "HEAD").Output()
	sha := string(hashOutput)[:40]

	// 切回 main 并 cherry-pick
	exec.Command("git", "-C", tmpDir, "checkout", "main").Run()

	err := svc.CherryPick("owner", "repo", []string{sha})
	if err != nil {
		t.Errorf("CherryPick() error = %v", err)
	}

	// 验证文件存在
	if _, err := os.Stat(filepath.Join(tmpDir, "cherry.txt")); os.IsNotExist(err) {
		t.Error("CherryPick() should pick the commit")
	}
}

func TestGitService_CreateTag(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	err := svc.CreateTag("owner", "repo", "v1.0.0", "main")
	if err != nil {
		t.Errorf("CreateTag() error = %v", err)
	}

	// 验证标签
	output, _ := exec.Command("git", "-C", tmpDir, "tag", "-l", "v1.0.0").Output()
	if len(output) == 0 {
		t.Error("CreateTag() should create the tag")
	}
}

func TestGitService_DeleteTag(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	// 先创建标签
	exec.Command("git", "-C", tmpDir, "tag", "v1.0.0").Run()

	err := svc.DeleteTag("owner", "repo", "v1.0.0")
	if err != nil {
		t.Errorf("DeleteTag() error = %v", err)
	}

	// 验证标签已删除
	output, _ := exec.Command("git", "-C", tmpDir, "tag", "-l", "v1.0.0").Output()
	if len(output) > 0 {
		t.Error("DeleteTag() should remove the tag")
	}
}

func TestGitService_SetDefaultBranch(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	// 创建 develop 分支
	exec.Command("git", "-C", tmpDir, "branch", "develop").Run()

	err := svc.SetDefaultBranch("owner", "repo", "develop")
	if err != nil {
		t.Errorf("SetDefaultBranch() error = %v", err)
	}

	// 验证 HEAD 指向 develop
	output, _ := exec.Command("git", "-C", tmpDir, "symbolic-ref", "HEAD").Output()
	if string(output) != "refs/heads/develop\n" {
		t.Errorf("HEAD = %q, want 'refs/heads/develop'", string(output))
	}
}

func TestGitService_MultiplePushURLs(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	// 添加 origin remote
	svc.AddRemote("owner", "repo", "origin", "https://github.com/test/repo.git")

	// 添加多个 push URL
	svc.AddRemotePushURL("owner", "repo", "origin", "https://github.com/test/repo-mirror1.git")
	svc.AddRemotePushURL("owner", "repo", "origin", "https://github.com/test/repo-mirror2.git")

	remotes, err := svc.ListRemotes("owner", "repo")
	if err != nil {
		t.Fatalf("ListRemotes() error = %v", err)
	}

	for _, r := range remotes {
		if r.Name == "origin" {
			// 应该有多个 push URL
			if len(r.PushURLs) < 2 {
				t.Errorf("origin push URLs count = %d, want at least 2", len(r.PushURLs))
			}
		}
	}

	// 删除一个 push URL
	err = svc.RemoveRemotePushURL("owner", "repo", "origin", "https://github.com/test/repo-mirror1.git")
	if err != nil {
		t.Errorf("RemoveRemotePushURL() error = %v", err)
	}
}

func TestGitService_RepoNotFound(t *testing.T) {
	svc := newTestGitService().WithLocalPath("/nonexistent/path")

	t.Run("ListRemotes repo not found", func(t *testing.T) {
		_, err := svc.ListRemotes("owner", "repo")
		if err == nil {
			t.Error("ListRemotes() should return error for nonexistent repo")
		}
	})

	t.Run("AddRemote repo not found", func(t *testing.T) {
		err := svc.AddRemote("owner", "repo", "origin", "https://example.com/repo.git")
		if err == nil {
			t.Error("AddRemote() should return error for nonexistent repo")
		}
	})

	t.Run("CreateBranch repo not found", func(t *testing.T) {
		err := svc.CreateBranch("owner", "repo", "test", "HEAD")
		if err == nil {
			t.Error("CreateBranch() should return error for nonexistent repo")
		}
	})

	t.Run("EditFile repo not found", func(t *testing.T) {
		_, err := svc.EditFile("owner", "repo", "test.txt", "content", "msg", "Test", "test@test.com")
		if err == nil {
			t.Error("EditFile() should return error for nonexistent repo")
		}
	})
}

func TestGitService_GetFileDiff(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	newFile := filepath.Join(tmpDir, "feature.txt")
	os.WriteFile(newFile, []byte("line1\nline2\nline3\n"), 0644)

	t.Run("unstaged diff", func(t *testing.T) {
		exec.Command("git", "-C", tmpDir, "add", "feature.txt").Run()
		exec.Command("git", "-C", tmpDir, "commit", "-m", "add feature.txt").Run()
		os.WriteFile(newFile, []byte("line1\nline2\nline3\nmodified\n"), 0644)

		result, err := svc.GetFileDiff("owner", "repo", "feature.txt", false)
		if err != nil {
			t.Fatalf("GetFileDiff() error = %v", err)
		}
		if result.IsBinary {
			t.Error("GetFileDiff() should not report binary for text file")
		}
		if result.FilePath != "feature.txt" {
			t.Errorf("FilePath = %q, want 'feature.txt'", result.FilePath)
		}
		if result.Additions == 0 && result.Deletions == 0 {
			t.Error("GetFileDiff() should report changes for modified file")
		}
	})

	t.Run("staged diff", func(t *testing.T) {
		exec.Command("git", "-C", tmpDir, "add", "feature.txt").Run()
		result, err := svc.GetFileDiff("owner", "repo", "feature.txt", true)
		if err != nil {
			t.Fatalf("GetFileDiff() staged error = %v", err)
		}
		if result.Additions == 0 {
			t.Error("GetFileDiff() staged should report additions")
		}
	})
}

func TestGitService_GetCommitFileDiff(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	newFile := filepath.Join(tmpDir, "new.txt")
	os.WriteFile(newFile, []byte("content\n"), 0644)
	exec.Command("git", "-C", tmpDir, "add", "-A").Run()
	exec.Command("git", "-C", tmpDir, "commit", "-m", "add new.txt").Run()

	hashOutput, _ := exec.Command("git", "-C", tmpDir, "rev-parse", "HEAD").Output()
	sha := strings.TrimSpace(string(hashOutput))

	result, err := svc.GetCommitFileDiff("owner", "repo", sha, "new.txt")
	if err != nil {
		t.Fatalf("GetCommitFileDiff() error = %v", err)
	}
	if result.Additions == 0 {
		t.Error("GetCommitFileDiff() should report additions for new file in commit")
	}
}

func TestGitService_DiscardFileChanges(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	t.Run("discard tracked file changes", func(t *testing.T) {
		readmePath := filepath.Join(tmpDir, "README.md")
		os.WriteFile(readmePath, []byte("# Modified\n"), 0644)

		err := svc.DiscardFileChanges("owner", "repo", "README.md", false)
		if err != nil {
			t.Fatalf("DiscardFileChanges() error = %v", err)
		}

		content, _ := os.ReadFile(readmePath)
		if string(content) == "# Modified\n" {
			t.Error("DiscardFileChanges() should restore original content")
		}
	})

	t.Run("discard untracked file", func(t *testing.T) {
		newFile := filepath.Join(tmpDir, "untracked.txt")
		os.WriteFile(newFile, []byte("new content"), 0644)

		err := svc.DiscardFileChanges("owner", "repo", "untracked.txt", true)
		if err != nil {
			t.Fatalf("DiscardFileChanges() untracked error = %v", err)
		}

		if _, err := os.Stat(newFile); !os.IsNotExist(err) {
			t.Error("DiscardFileChanges() should remove untracked file")
		}
	})
}

func TestGitService_CheckoutBranch(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	exec.Command("git", "-C", tmpDir, "branch", "develop").Run()

	err := svc.CheckoutBranch("owner", "repo", "develop")
	if err != nil {
		t.Fatalf("CheckoutBranch() error = %v", err)
	}

	output, _ := exec.Command("git", "-C", tmpDir, "rev-parse", "--abbrev-ref", "HEAD").Output()
	if strings.TrimSpace(string(output)) != "develop" {
		t.Errorf("current branch = %q, want 'develop'", strings.TrimSpace(string(output)))
	}
}

func TestGitService_StashOperations(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	t.Run("stash list initially empty", func(t *testing.T) {
		entries, err := svc.GetStashList("owner", "repo")
		if err != nil {
			t.Fatalf("GetStashList() error = %v", err)
		}
		if len(entries) != 0 {
			t.Errorf("GetStashList() = %d entries, want 0", len(entries))
		}
	})

	t.Run("stash save", func(t *testing.T) {
		newFile := filepath.Join(tmpDir, "stash-test.txt")
		os.WriteFile(newFile, []byte("stash content"), 0644)
		exec.Command("git", "-C", tmpDir, "add", "-A").Run()

		err := svc.StashSave("owner", "repo", "test stash")
		if err != nil {
			t.Fatalf("StashSave() error = %v", err)
		}

		entries, _ := svc.GetStashList("owner", "repo")
		if len(entries) == 0 {
			t.Error("StashSave() should create a stash entry")
		}

		if _, err := os.Stat(newFile); !os.IsNotExist(err) {
			t.Error("StashSave() should clean working tree of staged files")
		}
	})

	t.Run("stash pop", func(t *testing.T) {
		err := svc.StashPop("owner", "repo", 0)
		if err != nil {
			t.Fatalf("StashPop() error = %v", err)
		}

		entries, _ := svc.GetStashList("owner", "repo")
		if len(entries) != 0 {
			t.Error("StashPop() should remove the stash entry")
		}

		newFile := filepath.Join(tmpDir, "stash-test.txt")
		if _, err := os.Stat(newFile); os.IsNotExist(err) {
			t.Error("StashPop() should restore the stashed file")
		}
	})

	t.Run("stash save and apply", func(t *testing.T) {
		exec.Command("git", "-C", tmpDir, "add", "-A").Run()
		svc.StashSave("owner", "repo", "apply test")

		err := svc.StashApply("owner", "repo", 0)
		if err != nil {
			t.Fatalf("StashApply() error = %v", err)
		}

		entries, _ := svc.GetStashList("owner", "repo")
		if len(entries) == 0 {
			t.Error("StashApply() should keep the stash entry")
		}
	})

	t.Run("stash drop", func(t *testing.T) {
		entries, _ := svc.GetStashList("owner", "repo")
		if len(entries) == 0 {
			return
		}
		err := svc.StashDrop("owner", "repo", 0)
		if err != nil {
			t.Fatalf("StashDrop() error = %v", err)
		}

		entries, _ = svc.GetStashList("owner", "repo")
		if len(entries) != 0 {
			t.Error("StashDrop() should remove the stash entry")
		}
	})
}

func TestGitService_GetRepoStatus_Enhanced(t *testing.T) {
	tmpDir, cleanup := setupTestRepo(t)
	defer cleanup()

	svc := newTestGitService().WithLocalPath(tmpDir)

	t.Run("clean repo status", func(t *testing.T) {
		status := svc.GetRepoStatus("owner", "repo")
		if status["cherry_picking"] != false {
			t.Error("GetRepoStatus() cherry_picking should be false")
		}
		conflictFiles, ok := status["conflict_files"].([]string)
		if !ok || len(conflictFiles) != 0 {
			t.Error("GetRepoStatus() conflict_files should be empty")
		}
		if status["current_branch"] == "" {
			t.Error("GetRepoStatus() current_branch should not be empty")
		}
	})

	t.Run("status with untracked file", func(t *testing.T) {
		newFile := filepath.Join(tmpDir, "untracked.txt")
		os.WriteFile(newFile, []byte("hello"), 0644)

		status := svc.GetRepoStatus("owner", "repo")
		untracked, ok := status["untracked"].([]string)
		if !ok || len(untracked) == 0 {
			t.Error("GetRepoStatus() should report untracked files")
		}
		os.Remove(newFile)
	})

	t.Run("status with staged file", func(t *testing.T) {
		newFile := filepath.Join(tmpDir, "staged.txt")
		os.WriteFile(newFile, []byte("staged content"), 0644)
		exec.Command("git", "-C", tmpDir, "add", "staged.txt").Run()

		status := svc.GetRepoStatus("owner", "repo")
		staged, ok := status["staged"].([]string)
		if !ok || len(staged) == 0 {
			t.Error("GetRepoStatus() should report staged files")
		}
	})
}
