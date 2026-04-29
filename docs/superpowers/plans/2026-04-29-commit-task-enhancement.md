# 代码提交与任务管理增强 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 参考 Gitea/GitHub，渐进增强 gitfolio 的代码提交详情/比较和任务管理（评论、流转、关联、计时）功能。

**Architecture:** 在现有 Fiber + goent 架构上扩展，新增 4 个数据模型（CommitReference、TaskTransition、TaskPullRequest、TaskTimeLog），修改 1 个现有模型（Comment 增加 TaskID），新增约 14 个 API 端点，分 4 个阶段渐进实施。

**Tech Stack:** Go, Fiber v3, goent ORM, git CLI commands

---

## 阶段 1：提交详情与比较

### Task 1: 新增 GetCommitDetail 服务方法

**Files:**
- Modify: `services/git_commit.go`

- [ ] **Step 1: 新增 CommitDetail 和 CommitFileChange 结构体及 GetCommitDetail 方法**

在 `services/git_commit.go` 文件末尾添加：

```go
type CommitDetail struct {
	Hash               string              `json:"hash"`
	ShortHash          string              `json:"short_hash"`
	Message            string              `json:"message"`
	Author             string              `json:"author"`
	AuthorEmail        string              `json:"author_email"`
	Committer          string              `json:"committer"`
	CommitterEmail     string              `json:"committer_email"`
	Date               string              `json:"date"`
	VerificationStatus string              `json:"verification_status"`
	Parents            []string            `json:"parents"`
	Files              []CommitFileChange  `json:"files"`
	Stats              CommitStatsSummary  `json:"stats"`
}

type CommitFileChange struct {
	Filename  string `json:"filename"`
	Status    string `json:"status"`
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
	Patch     string `json:"patch,omitempty"`
}

type CommitStatsSummary struct {
	TotalAdditions int `json:"total_additions"`
	TotalDeletions int `json:"total_deletions"`
	FilesChanged   int `json:"files_changed"`
}

func (s *GitService) GetCommitDetail(owner, name, sha string) (*CommitDetail, error) {
	repoPath := s.getRepoPath(owner, name)

	logCmd := exec.Command("git", "-C", repoPath, "log", "-1",
		"--format=%H|%h|%s|%an|%ae|%cn|%ce|%ai|%P", sha)
	logOutput, err := logCmd.Output()
	if err != nil {
		return nil, fmt.Errorf("commit not found: %w", err)
	}

	parts := strings.Split(strings.TrimSpace(string(logOutput)), "|")
	if len(parts) < 8 {
		return nil, fmt.Errorf("invalid commit log format")
	}

	var parentHashes []string
	if len(parts) >= 9 && parts[8] != "" {
		parentHashes = strings.Fields(parts[8])
	}

	verificationStatus := s.verifyCommitSignature(repoPath, sha)

	numstatCmd := exec.Command("git", "-C", repoPath, "diff-tree", "--no-commit-id",
		"-r", "--numstat", sha)
	numstatOutput, err := numstatCmd.Output()
	if err != nil {
		return &CommitDetail{
			Hash:               parts[0],
			ShortHash:          parts[1],
			Message:            parts[2],
			Author:             parts[3],
			AuthorEmail:        parts[4],
			Committer:          parts[5],
			CommitterEmail:     parts[6],
			Date:               parts[7],
			VerificationStatus: verificationStatus,
			Parents:            parentHashes,
			Files:              []CommitFileChange{},
			Stats:              CommitStatsSummary{},
		}, nil
	}

	files := s.parseCommitFiles(repoPath, sha, string(numstatOutput))

	totalAdditions := 0
	totalDeletions := 0
	for _, f := range files {
		totalAdditions += f.Additions
		totalDeletions += f.Deletions
	}

	return &CommitDetail{
		Hash:               parts[0],
		ShortHash:          parts[1],
		Message:            parts[2],
		Author:             parts[3],
		AuthorEmail:        parts[4],
		Committer:          parts[5],
		CommitterEmail:     parts[6],
		Date:               parts[7],
		VerificationStatus: verificationStatus,
		Parents:            parentHashes,
		Files:              files,
		Stats: CommitStatsSummary{
			TotalAdditions: totalAdditions,
			TotalDeletions: totalDeletions,
			FilesChanged:   len(files),
		},
	}, nil
}

func (s *GitService) parseCommitFiles(repoPath, sha, numstatOutput string) []CommitFileChange {
	lines := strings.Split(strings.TrimSpace(numstatOutput), "\n")
	files := make([]CommitFileChange, 0, len(lines))

	for _, line := range lines {
		if line == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 3 {
			continue
		}

		additions := 0
		deletions := 0
		if parts[0] != "-" {
			fmt.Sscanf(parts[0], "%d", &additions)
		}
		if parts[1] != "-" {
			fmt.Sscanf(parts[1], "%d", &deletions)
		}

		filename := strings.Join(parts[2:], " ")

		status := "modified"
		if additions > 0 && deletions == 0 {
			status = "added"
		} else if additions == 0 && deletions > 0 {
			status = "deleted"
		}

		patch := s.getCommitFilePatch(repoPath, sha, filename)

		files = append(files, CommitFileChange{
			Filename:  filename,
			Status:    status,
			Additions: additions,
			Deletions: deletions,
			Patch:     patch,
		})
	}
	return files
}

func (s *GitService) getCommitFilePatch(repoPath, sha, filename string) string {
	cmd := exec.Command("git", "-C", repoPath, "diff-tree", "-p", sha, "--", filename)
	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	return string(output)
}

func (s *GitService) verifyCommitSignature(repoPath, sha string) string {
	cmd := exec.Command("git", "-C", repoPath, "verify-commit", sha, "--raw")
	output, err := cmd.CombinedOutput()
	if err != nil {
		outputStr := string(output)
		if strings.Contains(outputStr, "no signature") || strings.Contains(outputStr, "not signed") {
			return "no_signature"
		}
		return "no_signature"
	}
	if strings.Contains(string(output), "GOODSIG") || strings.Contains(string(output), "VALIDSIG") {
		return "verified"
	}
	return "unverified"
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/ryan/projects/gitfolio && go build ./...`
Expected: 编译通过

### Task 2: 新增 CompareCommits 服务方法

**Files:**
- Modify: `services/git_commit.go`

- [ ] **Step 1: 新增 CompareResult 结构体和 CompareCommits 方法**

在 `services/git_commit.go` 文件末尾添加：

```go
type CompareResult struct {
	BaseCommit  *CommitInfo   `json:"base_commit"`
	HeadCommit  *CommitInfo   `json:"head_commit"`
	AheadBy     int           `json:"ahead_by"`
	BehindBy    int           `json:"behind_by"`
	Commits     []Commit      `json:"commits"`
	Files       []PRFileChange `json:"files"`
	TotalAdditions int        `json:"total_additions"`
	TotalDeletions int        `json:"total_deletions"`
}

func (s *GitService) CompareCommits(owner, name, base, head string) (*CompareResult, error) {
	repoPath := s.getRepoPath(owner, name)

	aheadCmd := exec.Command("git", "-C", repoPath, "rev-list", "--count",
		fmt.Sprintf("%s..%s", base, head))
	aheadOutput, err := aheadCmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to count ahead commits: %w", err)
	}
	aheadBy := 0
	fmt.Sscanf(strings.TrimSpace(string(aheadOutput)), "%d", &aheadBy)

	behindCmd := exec.Command("git", "-C", repoPath, "rev-list", "--count",
		fmt.Sprintf("%s..%s", head, base))
	behindOutput, err := behindCmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to count behind commits: %w", err)
	}
	behindBy := 0
	fmt.Sscanf(strings.TrimSpace(string(behindOutput)), "%d", &behindBy)

	baseInfo := s.getCommitInfo(repoPath, base)
	headInfo := s.getCommitInfo(repoPath, head)

	logCmd := exec.Command("git", "-C", repoPath, "log",
		fmt.Sprintf("%s..%s", base, head),
		"--format=%H|%h|%s|%an|%ae|%ai")
	logOutput, err := logCmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list commits: %w", err)
	}

	var commits []Commit
	lines := strings.Split(strings.TrimSpace(string(logOutput)), "\n")
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

	files, totalAdditions, totalDeletions, err := s.GetPRFiles(owner, name, head, base)
	if err != nil {
		files = nil
		totalAdditions = 0
		totalDeletions = 0
	}

	return &CompareResult{
		BaseCommit:     baseInfo,
		HeadCommit:     headInfo,
		AheadBy:        aheadBy,
		BehindBy:       behindBy,
		Commits:        commits,
		Files:          files,
		TotalAdditions: totalAdditions,
		TotalDeletions: totalDeletions,
	}, nil
}

func (s *GitService) getCommitInfo(repoPath, ref string) *CommitInfo {
	cmd := exec.Command("git", "-C", repoPath, "log", "-1",
		"--format=%H|%an|%ae|%s", ref)
	output, err := cmd.Output()
	if err != nil {
		return nil
	}
	parts := strings.SplitN(strings.TrimSpace(string(output)), "|", 4)
	if len(parts) < 4 {
		return nil
	}
	return &CommitInfo{
		Hash:    parts[0][:7],
		Author:  parts[1],
		Email:   parts[2],
		Message: parts[3],
	}
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/ryan/projects/gitfolio && go build ./...`
Expected: 编译通过

### Task 3: 新增提交详情和比较的 Handler 与路由

**Files:**
- Modify: `handlers/repo_git.go`
- Modify: `routes/routes.go`

- [ ] **Step 1: 在 handlers/repo_git.go 末尾新增 GetCommitDetail handler**

```go
func GetCommitDetail(c fiber.Ctx) error {
	sha := c.Params("sha")
	if sha == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Commit SHA is required"})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	gitSvc := services.NewGitService()
	detail, err := gitSvc.GetCommitDetail(result.Owner.Username, result.Repo.Name, sha)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Commit not found"})
	}

	return c.Status(fiber.StatusOK).JSON(detail)
}

func CompareCommits(c fiber.Ctx) error {
	baseHead := c.Params("basehead")
	if baseHead == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Base and head refs are required"})
	}

	parts := strings.SplitN(baseHead, "...", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid compare format, use base...head"})
	}
	base, head := parts[0], parts[1]

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	if result.Repo.LocalPath == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Repository not initialized"})
	}

	gitSvc := services.NewGitService()
	compareResult, err := gitSvc.CompareCommits(result.Owner.Username, result.Repo.Name, base, head)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(compareResult)
}
```

- [ ] **Step 2: 在 routes/routes.go 的 setupRepoGitRoutes 函数中注册新路由**

在 `repo.Post("/commit", ...)` 行之后添加：

```go
	repo.Get("/commits/:sha", middleware.OptionalAuth(), handlers.GetCommitDetail)
	repo.Get("/compare/:basehead", middleware.OptionalAuth(), handlers.CompareCommits)
```

- [ ] **Step 3: 验证编译**

Run: `cd /Users/ryan/projects/gitfolio && go build ./...`
Expected: 编译通过

- [ ] **Step 4: Commit**

```bash
cd /Users/ryan/projects/gitfolio
git add services/git_commit.go handlers/repo_git.go routes/routes.go
git commit -m "feat: add commit detail and compare APIs"
```

---

## 阶段 2：提交关联系统

### Task 4: 新增 CommitReference 数据模型

**Files:**
- Modify: `models/tables.go`

- [ ] **Step 1: 在 FolioSchema 中添加 CommitReference 表字段**

在 `FolioSchema` 结构体中 `TaskIssue` 字段之后添加：

```go
	CommitReference *goent.Table[CommitReference]
```

- [ ] **Step 2: 在 models/tables.go 末尾添加 CommitReference 结构体**

```go
type CommitReference struct {
	ID           int64  `goe:"pk"`
	CreatedAt    time.Time
	CommitHash   string `goe:"index"`
	RepositoryID int64  `goe:"index"`
	TargetType   string `goe:"index"`
	TargetID     int64  `goe:"index"`
	Action       string
}
```

- [ ] **Step 3: 验证编译**

Run: `cd /Users/ryan/projects/gitfolio && go build ./...`
Expected: 编译通过

### Task 5: 新增提交消息解析和关联创建逻辑

**Files:**
- Create: `helpers/references.go`

- [ ] **Step 1: 创建 helpers/references.go**

```go
package helpers

import (
	"regexp"
	"strconv"

	"github.com/azhai/gitfolio/models"
)

type CommitRef struct {
	TargetType string
	TargetID   int64
	Action     string
}

var refPatterns = []*struct {
	regex   *regexp.Regexp
	action  string
	target  string
}{
	{regexp.MustCompile(`(?i)\b(fixes|closes|resolves)\s+#(\d+)`), "closes", "issue"},
	{regexp.MustCompile(`(?i)\b(references|refs?|see)\s+#(\d+)`), "references", "issue"},
	{regexp.MustCompile(`(?i)\bPR\s+#(\d+)`), "references", "pull_request"},
	{regexp.MustCompile(`(?i)\bTask[-:]?\s*#(\d+)`), "references", "task"},
}

func ParseCommitReferences(message string) []CommitRef {
	var refs []CommitRef
	seen := make(map[string]bool)

	for _, pattern := range refPatterns {
		matches := pattern.regex.FindAllStringSubmatch(message, -1)
		for _, match := range matches {
			idStr := match[len(match)-1]
			id, err := strconv.ParseInt(idStr, 10, 64)
			if err != nil || id == 0 {
				continue
			}
			key := pattern.target + ":" + idStr
			if seen[key] {
				continue
			}
			seen[key] = true
			refs = append(refs, CommitRef{
				TargetType: pattern.target,
				TargetID:   id,
				Action:     pattern.action,
			})
		}
	}
	return refs
}

func CreateCommitReferences(db *models.Database, commitHash string, repoID int64, message string) {
	refs := ParseCommitReferences(message)
	for _, ref := range refs {
		existing, _ := db.CommitReference.Select().Filter(
			goent.And(
				goent.Equals(db.CommitReference.Field("commit_hash"), commitHash),
				goent.Equals(db.CommitReference.Field("target_type"), ref.TargetType),
				goent.Equals(db.CommitReference.Field("target_id"), ref.TargetID),
			),
		).One()
		if existing != nil {
			continue
		}

		record := &models.CommitReference{
			CommitHash:   commitHash,
			RepositoryID: repoID,
			TargetType:   ref.TargetType,
			TargetID:     ref.TargetID,
			Action:       ref.Action,
		}
		db.CommitReference.Insert().One(record)

		if ref.Action == "closes" && ref.TargetType == "issue" {
			issue, err := db.Issue.Select().Where("id = ? AND repository_id = ?", ref.TargetID, repoID).One()
			if err == nil && issue != nil && !issue.IsClosed {
				issue.IsClosed = true
				db.Issue.Save().One(issue)
			}
		}
	}
}

func GetCommitReferences(db *models.Database, commitHash string) []CommitRef {
	records, err := db.CommitReference.Select().Where("commit_hash = ?", commitHash).All()
	if err != nil {
		return nil
	}
	var refs []CommitRef
	for _, r := range records {
		refs = append(refs, CommitRef{
			TargetType: r.TargetType,
			TargetID:   r.TargetID,
			Action:     r.Action,
		})
	}
	return refs
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/ryan/projects/gitfolio && go build ./...`
Expected: 编译通过

### Task 6: 修改 CommitChanges handler 和 GetCommitDetail 以支持关联

**Files:**
- Modify: `handlers/repo_git.go`
- Modify: `services/git_commit.go`

- [ ] **Step 1: 修改 CommitChanges handler，在提交成功后解析关联**

在 `handlers/repo_git.go` 的 `CommitChanges` 函数中，找到 `gitSvc.CommitChanges(...)` 调用成功后的位置（`if err := gitSvc.CommitChanges(...); err != nil` 的 else 分支），在 `now := time.Now()` 之前添加获取提交 hash 的逻辑：

将 `CommitChanges` 函数中 `gitSvc.CommitChanges(...)` 调用替换为获取 hash 的版本。修改整个函数如下：

```go
func CommitChanges(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	userID := middleware.GetCurrentUserID(c)
	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		Message string `json:"message"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.Message == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Commit message is required"})
	}

	db := models.GetDB()
	user, err := db.User.Select().Where("id = ?", userID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	gitSvc := services.NewGitService()
	commitHash, err := gitSvc.CommitChangesWithHash(result.Owner.Username, result.Repo.Name, req.Message, user.Username, user.Email)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	helpers.CreateCommitReferences(db, commitHash, result.Repo.ID, req.Message)

	now := time.Now()
	result.Repo.LastCommitAt = &now
	db.Repository.Save().One(result.Repo)

	stagedFiles, _ := gitSvc.GetStagedFiles(result.Owner.Username, result.Repo.Name)
	workingFiles, _ := gitSvc.GetWorkingTreeFiles(result.Owner.Username, result.Repo.Name)
	untrackedFiles, _ := gitSvc.GetUntrackedFiles(result.Owner.Username, result.Repo.Name)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":         "Committed successfully",
		"commit_hash":     commitHash,
		"staged_files":    stagedFiles,
		"working_files":   workingFiles,
		"untracked_files": untrackedFiles,
	})
}
```

- [ ] **Step 2: 在 services/git_repo.go 新增 CommitChangesWithHash 方法**

在 `CommitChanges` 方法之后添加：

```go
func (s *GitService) CommitChangesWithHash(owner, name, message, authorName, authorEmail string) (string, error) {
	repoPath := s.getRepoPath(owner, name)
	cmd := exec.Command("git", "-C", repoPath, "commit", "-m", message)
	if authorName != "" && authorEmail != "" {
		cmd.Env = append(os.Environ(),
			fmt.Sprintf("GIT_AUTHOR_NAME=%s", authorName),
			fmt.Sprintf("GIT_AUTHOR_EMAIL=%s", authorEmail),
			fmt.Sprintf("GIT_COMMITTER_NAME=%s", authorName),
			fmt.Sprintf("GIT_COMMITTER_EMAIL=%s", authorEmail),
		)
	}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git commit failed: %s", string(output))
	}

	hashCmd := exec.Command("git", "-C", repoPath, "rev-parse", "HEAD")
	hashOutput, err := hashCmd.Output()
	if err != nil {
		return "", nil
	}
	return strings.TrimSpace(string(hashOutput)), nil
}
```

- [ ] **Step 3: 修改 GetCommitDetail handler，在返回中包含关联信息**

在 `handlers/repo_git.go` 的 `GetCommitDetail` 函数中，在 `return c.Status(fiber.StatusOK).JSON(detail)` 之前添加：

```go
	db := models.GetDB()
	refs := helpers.GetCommitReferences(db, sha)
	detail.References = refs
```

同时在函数顶部添加 `db` 变量不需要，因为已有 `helpers.GetCommitReferences` 内部调用 `models.GetDB()`。

- [ ] **Step 4: 在 CommitDetail 结构体中添加 References 字段**

在 `services/git_commit.go` 的 `CommitDetail` 结构体中添加：

```go
	References         []CommitRefInfo     `json:"references,omitempty"`
```

新增 `CommitRefInfo` 结构体：

```go
type CommitRefInfo struct {
	TargetType string `json:"target_type"`
	TargetID   int64  `json:"target_id"`
	Action     string `json:"action"`
}
```

- [ ] **Step 5: 修改 GetCommitDetail handler 使用 CommitRefInfo**

将 `handlers/repo_git.go` 的 `GetCommitDetail` 函数中获取 refs 的逻辑改为：

```go
	refs := helpers.GetCommitReferences(db, detail.Hash)
	var refInfos []services.CommitRefInfo
	for _, r := range refs {
		refInfos = append(refInfos, services.CommitRefInfo{
			TargetType: r.TargetType,
			TargetID:   r.TargetID,
			Action:     r.Action,
		})
	}
	detail.References = refInfos
```

- [ ] **Step 6: 验证编译**

Run: `cd /Users/ryan/projects/gitfolio && go build ./...`
Expected: 编译通过

- [ ] **Step 7: Commit**

```bash
cd /Users/ryan/projects/gitfolio
git add models/tables.go helpers/references.go handlers/repo_git.go services/git_commit.go services/git_repo.go
git commit -m "feat: add commit reference system with auto-linking to issues/PRs/tasks"
```

---

## 阶段 3：任务评论与状态流转

### Task 7: 修改 Comment 模型新增 TaskID，新增 TaskTransition 模型

**Files:**
- Modify: `models/tables.go`

- [ ] **Step 1: 在 Comment 结构体中添加 TaskID 字段**

在 `Comment` 结构体的 `PullRequestID` 字段之后添加：

```go
	TaskID *int64 `goe:"index"`
```

- [ ] **Step 2: 在 FolioSchema 中添加 TaskTransition 表字段**

在 `FolioSchema` 结构体中 `CommitReference` 字段之后添加：

```go
	TaskTransition *goent.Table[TaskTransition]
```

- [ ] **Step 3: 在 models/tables.go 末尾添加 TaskTransition 结构体**

```go
type TaskTransition struct {
	ID         int64  `goe:"pk"`
	CreatedAt  time.Time
	TaskID     int64  `goe:"index"`
	FromStatus string
	ToStatus   string
	UserID     int64  `goe:"index"`
	Comment    string
}
```

- [ ] **Step 4: 验证编译**

Run: `cd /Users/ryan/projects/gitfolio && go build ./...`
Expected: 编译通过

### Task 8: 扩展 BatchGetCommentsCount 支持 task 类型

**Files:**
- Modify: `helpers/db.go`

- [ ] **Step 1: 修改 BatchGetCommentsCount 函数，添加 task 分支**

在 `BatchGetCommentsCount` 函数的 switch 语句中添加 `case "task"` 分支：

```go
	case "task":
		fieldName = "task_id"
```

同时在遍历 comments 的 switch 语句中添加：

```go
		case "task":
			if c.TaskID != nil {
				result[*c.TaskID]++
			}
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/ryan/projects/gitfolio && go build ./...`
Expected: 编译通过

### Task 9: 新增任务评论和状态流转 Handler

**Files:**
- Modify: `handlers/task_handler.go`

- [ ] **Step 1: 新增任务评论相关类型和 handler**

在 `handlers/task_handler.go` 中添加以下代码：

```go
type TaskCommentResponse struct {
	ID        int64  `json:"id"`
	Body      string `json:"body"`
	Author    string `json:"author"`
	AuthorID  int64  `json:"author_id"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

func GetTaskComments(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	comments, err := db.Comment.Select().Where("task_id = ?", task.ID).All()
	if err != nil {
		return c.Status(fiber.StatusOK).JSON([]TaskCommentResponse{})
	}

	var contributorIDs []int64
	for _, comment := range comments {
		if comment.AuthorID != 0 {
			contributorIDs = append(contributorIDs, comment.AuthorID)
		}
	}
	contributorsMap := helpers.BatchGetContributors(db, contributorIDs)

	var response []TaskCommentResponse
	for _, comment := range comments {
		authorName := ""
		if contrib := contributorsMap[comment.AuthorID]; contrib != nil {
			authorName = contrib.Name
		}
		response = append(response, TaskCommentResponse{
			ID:        comment.ID,
			Body:      comment.Body,
			Author:    authorName,
			AuthorID:  comment.AuthorID,
			CreatedAt: comment.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			UpdatedAt: comment.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response)
}

func CreateTaskComment(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	userID := middleware.GetCurrentUserID(c)

	var req struct {
		Body string `json:"body"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.Body == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Comment body is required"})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	authorUser, _ := db.User.Select().Where("id = ?", userID).One()
	var authorContrib *models.Contributor
	if authorUser != nil {
		authorContrib = helpers.FindOrCreateContributor(db, result.Repo.ID, authorUser.Username, authorUser.Email, authorUser.Avatar)
	}

	tid := task.ID
	comment := &models.Comment{
		Body:     req.Body,
		TaskID:   &tid,
		AuthorID: authorContrib.ID,
	}

	if err := db.Comment.Insert().One(comment); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create comment"})
	}

	return c.Status(fiber.StatusCreated).JSON(TaskCommentResponse{
		ID:        comment.ID,
		Body:      comment.Body,
		Author:    authorContrib.Name,
		AuthorID:  comment.AuthorID,
		CreatedAt: comment.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt: comment.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
}
```

- [ ] **Step 2: 新增任务状态流转 handler**

在 `handlers/task_handler.go` 中添加以下代码：

```go
var validTransitions = map[string][]string{
	TaskStatusDraft:    {TaskStatusProgress},
	TaskStatusProgress: {TaskStatusReview, TaskStatusDraft},
	TaskStatusReview:   {TaskStatusCompleted, TaskStatusRejected},
	TaskStatusRejected: {TaskStatusProgress},
}

const TaskStatusRejected = "rejected"

type TransitionRequest struct {
	ToStatus string `json:"to_status"`
	Comment  string `json:"comment"`
}

type TransitionResponse struct {
	ID         int64  `json:"id"`
	FromStatus string `json:"from_status"`
	ToStatus   string `json:"to_status"`
	UserID     int64  `json:"user_id"`
	Comment    string `json:"comment"`
	CreatedAt  string `json:"created_at"`
}

func TransitionTask(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	userID := middleware.GetCurrentUserID(c)

	var req TransitionRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	allowedTargets, ok := validTransitions[task.Status]
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot transition from current status"})
	}

	valid := false
	for _, t := range allowedTargets {
		if t == req.ToStatus {
			valid = true
			break
		}
	}
	if !valid {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":             "Invalid transition",
			"allowed_transitions": allowedTargets,
		})
	}

	if req.ToStatus == TaskStatusCompleted && task.VerifierID != nil && *task.VerifierID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only verifier can mark task as completed"})
	}

	transition := &models.TaskTransition{
		TaskID:     task.ID,
		FromStatus: task.Status,
		ToStatus:   req.ToStatus,
		UserID:     userID,
		Comment:    req.Comment,
	}

	task.Status = req.ToStatus
	now := time.Now()
	task.LastHandledAt = &now

	if err := db.Task.Save().One(task); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update task status"})
	}

	if err := db.TaskTransition.Insert().One(transition); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to record transition"})
	}

	return c.Status(fiber.StatusOK).JSON(TransitionResponse{
		ID:         transition.ID,
		FromStatus: transition.FromStatus,
		ToStatus:   transition.ToStatus,
		UserID:     transition.UserID,
		Comment:    transition.Comment,
		CreatedAt:  transition.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
}

func GetTaskTransitions(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	transitions, err := db.TaskTransition.Select().Where("task_id = ?", task.ID).OrderBy("created_at DESC").All()
	if err != nil {
		return c.Status(fiber.StatusOK).JSON([]TransitionResponse{})
	}

	var response []TransitionResponse
	for _, t := range transitions {
		response = append(response, TransitionResponse{
			ID:         t.ID,
			FromStatus: t.FromStatus,
			ToStatus:   t.ToStatus,
			UserID:     t.UserID,
			Comment:    t.Comment,
			CreatedAt:  t.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response)
}
```

- [ ] **Step 3: 修改 TaskResponse 和 buildTaskFullResponse 添加 comments_count**

在 `TaskResponse` 结构体中添加：

```go
	CommentsCount int                `json:"comments_count"`
```

修改 `buildTaskFullResponse` 函数，在构建 response 之前获取评论数：

```go
	commentsCount, _ := db.Comment.Select().Where("task_id = ?", task.ID).Count("id")
```

在 `ToTaskResponse` 调用中传入 commentsCount，修改 `ToTaskResponse` 函数签名和实现：

在 `ToTaskResponse` 函数中添加 `commentsCount int` 参数，并在 response 赋值中添加：

```go
		CommentsCount: commentsCount,
```

同时更新 `ListTasks` 中调用 `ToTaskResponse` 的地方，传入 0 作为 commentsCount。

- [ ] **Step 4: 验证编译**

Run: `cd /Users/ryan/projects/gitfolio && go build ./...`
Expected: 编译通过

### Task 10: 注册任务评论和状态流转路由

**Files:**
- Modify: `routes/routes.go`

- [ ] **Step 1: 在 setupTaskRoutes 函数中注册新路由**

在 `repo.Delete("/tasks/:id", ...)` 行之后添加：

```go
	repo.Get("/tasks/:id/comments", handlers.GetTaskComments)
	repo.Post("/tasks/:id/comments", middleware.AuthMiddleware(), handlers.CreateTaskComment)
	repo.Post("/tasks/:id/transition", middleware.AuthMiddleware(), handlers.TransitionTask)
	repo.Get("/tasks/:id/transitions", handlers.GetTaskTransitions)
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/ryan/projects/gitfolio && go build ./...`
Expected: 编译通过

- [ ] **Step 3: Commit**

```bash
cd /Users/ryan/projects/gitfolio
git add models/tables.go helpers/db.go handlers/task_handler.go routes/routes.go
git commit -m "feat: add task comments and status transition system"
```

---

## 阶段 4：任务关联与时间追踪

### Task 11: 新增 TaskPullRequest 和 TaskTimeLog 数据模型

**Files:**
- Modify: `models/tables.go`

- [ ] **Step 1: 在 FolioSchema 中添加新表字段**

在 `FolioSchema` 结构体中 `TaskTransition` 字段之后添加：

```go
	TaskPullRequest *goent.Table[TaskPullRequest]
	TaskTimeLog     *goent.Table[TaskTimeLog]
```

- [ ] **Step 2: 在 models/tables.go 末尾添加新结构体**

```go
type TaskPullRequest struct {
	ID            int64  `goe:"pk"`
	CreatedAt     time.Time
	TaskID        int64  `goe:"index"`
	PullRequestID int64  `goe:"index"`
}

type TaskTimeLog struct {
	ID        int64  `goe:"pk"`
	CreatedAt time.Time
	TaskID    int64  `goe:"index"`
	UserID    int64  `goe:"index"`
	StartTime time.Time
	EndTime   *time.Time
	Duration  int64
	Note      string
}
```

- [ ] **Step 3: 验证编译**

Run: `cd /Users/ryan/projects/gitfolio && go build ./...`
Expected: 编译通过

### Task 12: 新增任务 PR 关联、提交关联和时间追踪 Handler

**Files:**
- Modify: `handlers/task_handler.go`

- [ ] **Step 1: 新增任务 PR 关联 handler**

```go
func LinkTaskPullRequest(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	userID := middleware.GetCurrentUserID(c)

	var req struct {
		PullRequestID int64 `json:"pull_request_id"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	if task.InitiatorID != userID && result.Repo.OwnerID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	pr, err := db.PullRequest.Select().Where("id = ? AND repository_id = ?", req.PullRequestID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Pull request not found"})
	}

	existing, _ := db.TaskPullRequest.Select().Where("task_id = ? AND pull_request_id = ?", task.ID, pr.ID).One()
	if existing != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Pull request already linked"})
	}

	link := &models.TaskPullRequest{
		TaskID:        task.ID,
		PullRequestID: pr.ID,
	}
	if err := db.TaskPullRequest.Insert().One(link); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to link pull request"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Pull request linked successfully"})
}

func UnlinkTaskPullRequest(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	prID, _ := strconv.Atoi(c.Params("pr_id"))
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	if task.InitiatorID != userID && result.Repo.OwnerID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Access denied"})
	}

	db.TaskPullRequest.Delete().Where("task_id = ? AND pull_request_id = ?", task.ID, prID).Exec()

	return c.Status(fiber.StatusNoContent).JSON(nil)
}

func GetTaskPullRequests(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	links, err := db.TaskPullRequest.Select().Where("task_id = ?", task.ID).All()
	if err != nil {
		return c.Status(fiber.StatusOK).JSON([]PRResponse{})
	}

	var prIDs []int64
	for _, link := range links {
		prIDs = append(prIDs, link.PullRequestID)
	}

	if len(prIDs) == 0 {
		return c.Status(fiber.StatusOK).JSON([]PRResponse{})
	}

	prs, err := db.PullRequest.Select().Filter(goent.In(db.PullRequest.Field("id"), prIDs)).All()
	if err != nil {
		return c.Status(fiber.StatusOK).JSON([]PRResponse{})
	}

	contributorIDs := helpers.CollectPRContributorIDs(prs)
	contributorsMap := helpers.BatchGetContributors(db, contributorIDs)

	var response []PRResponse
	for _, mr := range prs {
		authorContrib := contributorsMap[mr.AuthorID]
		if authorContrib == nil {
			authorContrib = &models.Contributor{Name: "Unknown"}
		}
		var assigneeContrib *models.Contributor
		if mr.AssigneeID != nil {
			assigneeContrib = contributorsMap[*mr.AssigneeID]
		}
		response = append(response, *ToPRResponse(mr, authorContrib, assigneeContrib, 0, 0))
	}

	return c.Status(fiber.StatusOK).JSON(response)
}
```

- [ ] **Step 2: 新增任务关联提交 handler**

```go
func GetTaskCommits(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	refs, err := db.CommitReference.Select().Where("repository_id = ? AND target_type = ? AND target_id = ?", result.Repo.ID, "task", task.ID).All()
	if err != nil || len(refs) == 0 {
		return c.Status(fiber.StatusOK).JSON([]services.Commit{})
	}

	var commits []services.Commit
	gitSvc := services.NewGitService()
	for _, ref := range refs {
		commitList, _, err := gitSvc.GetCommitList(result.Owner.Username, result.Repo.Name, ref.CommitHash, 1, 1)
		if err == nil && len(commitList) > 0 {
			commits = append(commits, commitList[0])
		}
	}

	return c.Status(fiber.StatusOK).JSON(commits)
}
```

- [ ] **Step 3: 新增任务时间追踪 handler**

```go
func StartTaskTimer(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	activeLog, _ := db.TaskTimeLog.Select().Where("task_id = ? AND user_id = ? AND end_time IS NULL", task.ID, userID).One()
	if activeLog != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Timer already running for this task"})
	}

	var req struct {
		Note string `json:"note"`
	}
	_ = c.Bind().JSON(&req)

	timeLog := &models.TaskTimeLog{
		TaskID:    task.ID,
		UserID:    userID,
		StartTime: time.Now(),
		Note:      req.Note,
	}

	if err := db.TaskTimeLog.Insert().One(timeLog); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to start timer"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":   "Timer started",
		"time_log_id": timeLog.ID,
		"start_time": timeLog.StartTime.Format("2006-01-02T15:04:05Z07:00"),
	})
}

func StopTaskTimer(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))
	userID := middleware.GetCurrentUserID(c)

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	activeLog, err := db.TaskTimeLog.Select().Where("task_id = ? AND user_id = ? AND end_time IS NULL", task.ID, userID).One()
	if err != nil || activeLog == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No active timer found"})
	}

	now := time.Now()
	activeLog.EndTime = &now
	activeLog.Duration = int64(now.Sub(activeLog.StartTime).Seconds())

	if err := db.TaskTimeLog.Save().One(activeLog); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to stop timer"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":  "Timer stopped",
		"duration": activeLog.Duration,
	})
}

type TimeLogResponse struct {
	ID        int64  `json:"id"`
	UserID    int64  `json:"user_id"`
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time,omitempty"`
	Duration  int64  `json:"duration"`
	Note      string `json:"note"`
}

func GetTaskTimeLogs(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	logs, err := db.TaskTimeLog.Select().Where("task_id = ?", task.ID).OrderBy("created_at DESC").All()
	if err != nil {
		return c.Status(fiber.StatusOK).JSON([]TimeLogResponse{})
	}

	var response []TimeLogResponse
	for _, log := range logs {
		resp := TimeLogResponse{
			ID:        log.ID,
			UserID:    log.UserID,
			StartTime: log.StartTime.Format("2006-01-02T15:04:05Z07:00"),
			Duration:  log.Duration,
			Note:      log.Note,
		}
		if log.EndTime != nil {
			resp.EndTime = log.EndTime.Format("2006-01-02T15:04:05Z07:00")
		}
		response = append(response, resp)
	}

	return c.Status(fiber.StatusOK).JSON(response)
}

func GetTaskTimeSummary(c fiber.Ctx) error {
	taskID, _ := strconv.Atoi(c.Params("id"))

	result, err := helpers.GetOwnerAndRepoWithPrivateAccessFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	task, err := db.Task.Select().Where("id = ? AND repository_id = ?", taskID, result.Repo.ID).One()
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Task not found"})
	}

	logs, err := db.TaskTimeLog.Select().Where("task_id = ? AND end_time IS NOT NULL", task.ID).All()
	if err != nil {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"total_duration": 0, "by_user": map[string]int64{}})
	}

	totalDuration := int64(0)
	byUser := make(map[int64]int64)
	for _, log := range logs {
		totalDuration += log.Duration
		byUser[log.UserID] += log.Duration
	}

	userNames := make(map[string]int64)
	userIDs := make([]int64, 0, len(byUser))
	for uid := range byUser {
		userIDs = append(userIDs, uid)
	}
	usersMap := helpers.BatchGetUsers(db, userIDs)
	for uid, dur := range byUser {
		name := "Unknown"
		if u := usersMap[uid]; u != nil {
			name = u.Username
		}
		userNames[name] = dur
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"total_duration": totalDuration,
		"by_user":        userNames,
	})
}
```

- [ ] **Step 4: 修改 buildTaskFullResponse 聚合新数据**

修改 `buildTaskFullResponse` 函数，在构建 response 之前获取关联 PR 和总耗时：

在 `buildTaskFullResponse` 函数中，在 `return ToTaskResponse(...)` 之前添加获取关联数据的逻辑，并修改 `ToTaskResponse` 函数签名以接受新字段。

在 `TaskResponse` 结构体中添加：

```go
	LinkedPRs    []PRSummary        `json:"linked_prs,omitempty"`
	TotalTime    int64              `json:"total_time"`
```

新增 `PRSummary` 结构体：

```go
type PRSummary struct {
	ID     int64  `json:"id"`
	Number int    `json:"number"`
	Title  string `json:"title"`
	Status string `json:"status"`
}
```

修改 `buildTaskFullResponse`：

```go
func buildTaskFullResponse(db *models.Database, task *models.Task) TaskResponse {
	initiator := helpers.GetUser(db, task.InitiatorID)

	var verifier *models.User
	if task.VerifierID != nil {
		verifier = helpers.GetUser(db, *task.VerifierID)
	}

	var handler *models.User
	if task.HandlerID != nil {
		handler = helpers.GetUser(db, *task.HandlerID)
	}

	schedules := getTaskSchedules(db, task.ID)
	attachments := getTaskAttachments(db, task.ID)
	issues := getTaskIssues(db, task.ID)
	commentsCount, _ := db.Comment.Select().Where("task_id = ?", task.ID).Count("id")

	var linkedPRs []PRSummary
	prLinks, _ := db.TaskPullRequest.Select().Where("task_id = ?", task.ID).All()
	for _, link := range prLinks {
		pr, err := db.PullRequest.Select().Where("id = ?", link.PullRequestID).One()
		if err == nil {
			status := "open"
			if pr.IsMerged {
				status = "merged"
			} else if pr.IsClosed {
				status = "closed"
			}
			linkedPRs = append(linkedPRs, PRSummary{
				ID:     pr.ID,
				Number: pr.Number,
				Title:  pr.Title,
				Status: status,
			})
		}
	}

	var totalTime int64
	timeLogs, _ := db.TaskTimeLog.Select().Where("task_id = ? AND end_time IS NOT NULL", task.ID).All()
	for _, log := range timeLogs {
		totalTime += log.Duration
	}

	return ToTaskResponse(task, initiator, verifier, handler, schedules, attachments, issues, int(commentsCount), linkedPRs, totalTime)
}
```

修改 `ToTaskResponse` 函数签名和实现：

```go
func ToTaskResponse(task *models.Task, initiator *models.User, verifier *models.User, handler *models.User, schedules []TaskScheduleResp, attachments []TaskAttachmentResp, issues []TaskIssueResp, commentsCount int, linkedPRs []PRSummary, totalTime int64) TaskResponse {
	response := TaskResponse{
		ID:            task.ID,
		Title:         task.Title,
		Draft:         task.Draft,
		Goal:          task.Goal,
		PreviewImage:  task.PreviewImage,
		Status:        task.Status,
		Priority:      task.Priority,
		SortOrder:     task.SortOrder,
		RepositoryID:  task.RepositoryID,
		InitiatorID:   task.InitiatorID,
		Schedules:     schedules,
		Attachments:   attachments,
		Issues:        issues,
		CommentsCount: commentsCount,
		LinkedPRs:     linkedPRs,
		TotalTime:     totalTime,
		CreatedAt:     task.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:     task.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if initiator != nil {
		response.Initiator = initiator.Username
	}
	if verifier != nil {
		response.Verifier = verifier.Username
		response.VerifierID = task.VerifierID
	}
	if handler != nil {
		response.Handler = handler.Username
		response.HandlerID = task.HandlerID
	}
	if task.LastHandledAt != nil {
		response.LastHandledAt = task.LastHandledAt.Format("2006-01-02T15:04:05Z07:00")
	}

	return response
}
```

同时更新 `ListTasks` 中调用 `ToTaskResponse` 的地方，传入新参数：

```go
		response = append(response, ToTaskResponse(task, initiator, verifier, handler, nil, nil, nil, 0, nil, 0))
```

- [ ] **Step 5: 验证编译**

Run: `cd /Users/ryan/projects/gitfolio && go build ./...`
Expected: 编译通过

### Task 13: 注册任务关联和时间追踪路由

**Files:**
- Modify: `routes/routes.go`

- [ ] **Step 1: 在 setupTaskRoutes 函数中注册新路由**

在 `repo.Delete("/tasks/:id/issues/:issue_id", ...)` 行之后添加：

```go
	repo.Post("/tasks/:id/pull_requests", middleware.AuthMiddleware(), handlers.LinkTaskPullRequest)
	repo.Delete("/tasks/:id/pull_requests/:pr_id", middleware.AuthMiddleware(), handlers.UnlinkTaskPullRequest)
	repo.Get("/tasks/:id/pull_requests", handlers.GetTaskPullRequests)
	repo.Get("/tasks/:id/commits", handlers.GetTaskCommits)
	repo.Post("/tasks/:id/timer/start", middleware.AuthMiddleware(), handlers.StartTaskTimer)
	repo.Post("/tasks/:id/timer/stop", middleware.AuthMiddleware(), handlers.StopTaskTimer)
	repo.Get("/tasks/:id/time-logs", handlers.GetTaskTimeLogs)
	repo.Get("/tasks/:id/time-summary", handlers.GetTaskTimeSummary)
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/ryan/projects/gitfolio && go build ./...`
Expected: 编译通过

### Task 14: 修改 PR 合并逻辑，检查关联任务自动流转

**Files:**
- Modify: `handlers/pull_request_handler.go`

- [ ] **Step 1: 在 MergePullRequest 函数中，合并成功后检查关联任务**

在 `MergePullRequest` 函数中，在 `db.PullRequest.Save().One(mr)` 成功之后、return 之前添加：

```go
	taskLinks, _ := db.TaskPullRequest.Select().Where("pull_request_id = ?", mr.ID).All()
	for _, link := range taskLinks {
		task, err := db.Task.Select().Where("id = ?", link.TaskID).One()
		if err != nil {
			continue
		}
		if task.Status == TaskStatusReview {
			task.Status = TaskStatusCompleted
			now := time.Now()
			task.LastHandledAt = &now
			db.Task.Save().One(task)

			transition := &models.TaskTransition{
				TaskID:     task.ID,
				FromStatus: TaskStatusReview,
				ToStatus:   TaskStatusCompleted,
				UserID:     userID,
				Comment:    "Auto-completed: linked PR #" + strconv.Itoa(mr.Number) + " was merged",
			}
			db.TaskTransition.Insert().One(transition)
		}
	}
```

注意：需要在 `pull_request_handler.go` 中 import `strconv` 和引用 `TaskStatusReview`、`TaskStatusCompleted` 常量。由于这些常量定义在 `task_handler.go` 中且同属 `handlers` 包，可以直接使用。

- [ ] **Step 2: 验证编译**

Run: `cd /Users/ryan/projects/gitfolio && go build ./...`
Expected: 编译通过

- [ ] **Step 3: Commit**

```bash
cd /Users/ryan/projects/gitfolio
git add models/tables.go handlers/task_handler.go handlers/pull_request_handler.go routes/routes.go
git commit -m "feat: add task PR linking, commit linking, and time tracking"
```

### Task 15: 更新 README 文档

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 在 API 文档部分添加新增端点**

在 README.md 的 API 文档中，添加以下新端点：

**代码提交**：
| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/:owner/:repo/commits/:sha` | 提交详情（含 diff、签名、关联） | 可选 |
| GET | `/:owner/:repo/compare/:base...:head` | 提交/分支比较 | 可选 |

**任务管理**：
| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/:owner/:repo/tasks/:id/comments` | 任务评论列表 | - |
| POST | `/:owner/:repo/tasks/:id/comments` | 添加任务评论 | ✓ |
| POST | `/:owner/:repo/tasks/:id/transition` | 执行状态流转 | ✓ |
| GET | `/:owner/:repo/tasks/:id/transitions` | 流转历史 | - |
| POST | `/:owner/:repo/tasks/:id/pull_requests` | 关联 PR | ✓ |
| DELETE | `/:owner/:repo/tasks/:id/pull_requests/:pr_id` | 取消关联 PR | ✓ |
| GET | `/:owner/:repo/tasks/:id/pull_requests` | 关联 PR 列表 | - |
| GET | `/:owner/:repo/tasks/:id/commits` | 关联提交列表 | - |
| POST | `/:owner/:repo/tasks/:id/timer/start` | 开始计时 | ✓ |
| POST | `/:owner/:repo/tasks/:id/timer/stop` | 停止计时 | ✓ |
| GET | `/:owner/:repo/tasks/:id/time-logs` | 时间记录 | - |
| GET | `/:owner/:repo/tasks/:id/time-summary` | 时间汇总 | - |

在数据模型部分添加：
- CommitReference：提交关联（Issue/PR/Task）
- TaskTransition：任务状态流转记录
- TaskPullRequest：任务与 PR 关联
- TaskTimeLog：任务时间追踪

- [ ] **Step 2: Commit**

```bash
cd /Users/ryan/projects/gitfolio
git add README.md
git commit -m "docs: update README with new commit and task management APIs"
```
