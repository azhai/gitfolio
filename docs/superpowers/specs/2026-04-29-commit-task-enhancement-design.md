# 代码提交与任务管理增强设计

## 概述

参考 Gitea 和 GitHub，渐进增强 gitfolio 的代码提交和任务管理功能。采用方案 A（渐进增强），在现有架构上逐步添加功能，保持向后兼容。

## 一、代码提交增强

### 1.1 单个提交详情 API

**路由**：`GET /:owner/:repo/commits/:sha`

**返回内容**：
- 完整提交信息（hash、short_hash、作者、提交者、消息、时间）
- 变更文件列表（每个文件的 status/additions/deletions/patch）
- 父提交列表
- 签名验证状态（verified/unverified/no_signature）
- 关联的 Issue/PR/Task（通过 CommitReference）

**实现**：
- `services/git_commit.go` 新增 `GetCommitDetail(owner, name, sha)` 方法
- 使用 `git show --stat --format=... <sha>` 获取提交元数据和文件统计
- 使用 `git diff-tree -p <sha>` 获取完整 diff
- 使用 `git verify-commit <sha>` 获取签名状态

**响应结构**：
```json
{
  "hash": "abc123...",
  "short_hash": "abc1234",
  "message": "feat: add login page",
  "author": "ryan",
  "author_email": "ryan@example.com",
  "committer": "ryan",
  "committer_email": "ryan@example.com",
  "date": "2026-04-29T10:00:00+08:00",
  "verification_status": "verified",
  "parents": ["def456..."],
  "files": [
    {
      "filename": "src/login.js",
      "status": "added",
      "additions": 50,
      "deletions": 0,
      "patch": "@@ -0,0 +1,50 @@..."
    }
  ],
  "stats": { "total_additions": 50, "total_deletions": 0, "files_changed": 1 },
  "references": [
    { "target_type": "issue", "target_id": 123, "action": "closes" }
  ]
}
```

### 1.2 提交比较 API

**路由**：`GET /:owner/:repo/compare/:base...:head`

**返回内容**：
- 基础提交和目标提交信息
- 差异文件列表（同 PR files 格式）
- 总增删行数
- ahead/behind 提交数
- 两个端点之间的提交列表

**实现**：
- `services/git_commit.go` 新增 `CompareCommits(owner, name, base, head)` 方法
- 使用 `git rev-list --count base..head` 计算 ahead
- 使用 `git rev-list --count head..base` 计算 behind
- 使用 `git diff --numstat base...head` 获取差异
- 使用 `git log base..head` 获取中间提交列表

**响应结构**：
```json
{
  "base_commit": { "hash": "...", "short_hash": "...", "message": "..." },
  "head_commit": { "hash": "...", "short_hash": "...", "message": "..." },
  "ahead_by": 5,
  "behind_by": 0,
  "commits": [...],
  "files": [...],
  "total_additions": 200,
  "total_deletions": 50
}
```

### 1.3 提交自动关联 Issue/PR/Task

**机制**：解析提交消息中的关键词，自动创建关联记录。

**支持的关键词**：
- `Fixes #123` / `fixes #123` → action=closes, target=Issue#123
- `Closes #123` / `closes #123` → action=closes, target=Issue#123
- `Resolves #123` → action=closes, target=Issue#123
- `References #123` / `Ref #123` → action=references, target=Issue#123
- `PR #45` → action=references, target=PR#45
- `Task-Id: #5` / `Task: #5` → action=references, target=Task#5

**触发时机**：
1. `CommitChanges` handler 提交成功后
2. 同步服务导入提交时

**联动效果**：
- `closes`/`fixes` 动作在 Issue 上自动设置 `IsClosed=true`
- 关联记录在提交详情和 Issue/PR/Task 详情中双向展示

### 1.4 提交签名验证

**实现**：在 `GetCommitDetail` 中调用 `git verify-commit <sha>`。

**返回状态**：
- `verified`：签名有效
- `unverified`：签名无效或密钥不可信
- `no_signature`：无签名

**解析逻辑**：
- 命令退出码 0 + 输出包含 "Good signature" → verified
- 命令退出码 1 + 输出包含 "BAD signature" → unverified
- 命令退出码 1 + 输出包含 "no signature" → no_signature

## 二、任务管理增强

### 2.1 任务评论系统

**复用现有 Comment 模型**，新增 `TaskID` 字段。

**模型变更**：
```go
type Comment struct {
    // 现有字段不变
    TaskID *int64 `goe:"index"` // 新增
}
```

**新增路由**：
- `GET /:owner/:repo/tasks/:id/comments` — 获取任务评论列表
- `POST /:owner/:repo/tasks/:id/comments` — 添加任务评论

**实现**：复用现有评论逻辑，增加 TaskID 分支。扩展 `BatchGetCommentsCount` 支持 `task` 类型。

### 2.2 任务状态流转

**状态机**：
```
draft → progress → review → completed
  ↑         ↓         ↓
  └─────────┘    rejected
                     ↓
                 progress（重新打开）
```

**合法转换表**：
| From | To |
|------|----|
| draft | progress |
| progress | review |
| review | completed |
| review | rejected |
| rejected | progress |

**新增模型**：
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

**新增路由**：
- `POST /:owner/:repo/tasks/:id/transition` — 执行状态流转
- `GET /:owner/:repo/tasks/:id/transitions` — 获取流转历史

**校验规则**：
- 只允许合法的状态转换
- 流转时自动更新 `LastHandledAt`
- `review → completed` 只有验证者（verifier）可操作
- 每次流转可选附带评论

### 2.3 任务与 PR 双向关联

**新增模型**：
```go
type TaskPullRequest struct {
    ID            int64  `goe:"pk"`
    CreatedAt     time.Time
    TaskID        int64  `goe:"index"`
    PullRequestID int64  `goe:"index"`
}
```

**新增路由**：
- `POST /:owner/:repo/tasks/:id/pull_requests` — 关联 PR
- `DELETE /:owner/:repo/tasks/:id/pull_requests/:pr_id` — 取消关联
- `GET /:owner/:repo/tasks/:id/pull_requests` — 获取关联 PR 列表

**联动效果**：
- PR 合并时，自动检查关联任务是否可标记为 completed
- 任务详情中展示关联 PR 的状态

### 2.4 任务与提交关联

**两种机制**：
- 自动关联：提交消息中包含 `Task-Id: #5` 或 `Task: #5` 时，通过 CommitReference 表自动关联
- 手动关联：暂不提供手动 API，通过提交消息约定即可

**新增路由**：
- `GET /:owner/:repo/tasks/:id/commits` — 获取关联提交列表

**实现**：复用 CommitReference 表，TargetType="task"。查询时按 TaskID 搜索 CommitReference，再根据 CommitHash 调用 git log 获取提交详情。

### 2.5 任务时间追踪

**新增模型**：
```go
type TaskTimeLog struct {
    ID        int64  `goe:"pk"`
    CreatedAt time.Time
    TaskID    int64  `goe:"index"`
    UserID    int64  `goe:"index"`
    StartTime time.Time
    EndTime   *time.Time
    Duration  int64   // 秒数，结束时计算
    Note      string
}
```

**新增路由**：
- `POST /:owner/:repo/tasks/:id/timer/start` — 开始计时
- `POST /:owner/:repo/tasks/:id/timer/stop` — 停止计时
- `GET /:owner/:repo/tasks/:id/time-logs` — 获取时间记录
- `GET /:owner/:repo/tasks/:id/time-summary` — 获取汇总

**规则**：
- 同一用户同一任务同一时间只能有一个活跃计时
- 停止计时时自动计算 Duration = EndTime - StartTime
- 任务详情中返回总耗时（秒）

## 三、新增数据模型汇总

| 模型 | 用途 | 关键字段 |
|------|------|---------|
| CommitReference | 提交关联 Issue/PR/Task | CommitHash, RepositoryID, TargetType, TargetID, Action |
| TaskTransition | 任务状态流转记录 | TaskID, FromStatus, ToStatus, UserID, Comment |
| TaskPullRequest | 任务与 PR 关联 | TaskID, PullRequestID |
| TaskTimeLog | 任务时间追踪 | TaskID, UserID, StartTime, EndTime, Duration |

**现有模型变更**：
- Comment 新增 TaskID *int64 字段
- TaskResponse 新增 comments_count、total_time、linked_prs、linked_commits 字段
- Commit/CommitGraphLine 新增 verification_status、references 字段

## 四、新增路由汇总

**代码提交**：
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/:owner/:repo/commits/:sha` | 单个提交详情 |
| GET | `/:owner/:repo/compare/:base...:head` | 提交/分支比较 |

**任务管理**：
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/:owner/:repo/tasks/:id/comments` | 任务评论列表 |
| POST | `/:owner/:repo/tasks/:id/comments` | 添加任务评论 |
| POST | `/:owner/:repo/tasks/:id/transition` | 执行状态流转 |
| GET | `/:owner/:repo/tasks/:id/transitions` | 流转历史 |
| POST | `/:owner/:repo/tasks/:id/pull_requests` | 关联 PR |
| DELETE | `/:owner/:repo/tasks/:id/pull_requests/:pr_id` | 取消关联 PR |
| GET | `/:owner/:repo/tasks/:id/pull_requests` | 关联 PR 列表 |
| GET | `/:owner/:repo/tasks/:id/commits` | 关联提交列表 |
| POST | `/:owner/:repo/tasks/:id/timer/start` | 开始计时 |
| POST | `/:owner/:repo/tasks/:id/timer/stop` | 停止计时 |
| GET | `/:owner/:repo/tasks/:id/time-logs` | 时间记录 |
| GET | `/:owner/:repo/tasks/:id/time-summary` | 时间汇总 |

## 五、实施顺序

### 阶段 1：提交详情与比较
1. services/git_commit.go 新增 GetCommitDetail、CompareCommits、VerifyCommitSignature
2. handlers/repo_git.go 新增 GetCommitDetail、CompareCommits handler
3. routes/routes.go 注册新路由

### 阶段 2：提交关联系统
1. models/tables.go 新增 CommitReference 模型
2. helpers/references.go 新增提交消息解析和关联创建逻辑
3. 修改 CommitChanges handler，提交后自动解析关联
4. 修改 GetCommitDetail 返回关联信息

### 阶段 3：任务评论与状态流转
1. models/tables.go 修改 Comment 新增 TaskID，新增 TaskTransition 模型
2. handlers/task_handler.go 新增评论和流转 handler
3. helpers/db.go 扩展 BatchGetCommentsCount 支持 task 类型
4. 修改 TaskResponse 新增字段

### 阶段 4：任务关联与时间追踪
1. models/tables.go 新增 TaskPullRequest、TaskTimeLog 模型
2. handlers/task_handler.go 新增 PR 关联、提交关联、计时 handler
3. 修改 PR 合并逻辑，检查关联任务自动流转
4. 修改 buildTaskFullResponse 聚合新数据
