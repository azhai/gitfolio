# GitFolio 同步系统

GitFolio 支持从 GitHub 镜像同步仓库数据，包括仓库信息、Issues、Pull Requests、标签和版本发布。

## 同步架构

```
GitHub API ──→ SyncService ──→ Database
                  │
                  ├── 仓库信息同步
                  ├── Issue 同步（含评论）
                  ├── PR 同步（含评论）
                  ├── 标签同步
                  └── Release 同步
```

### 核心组件

| 组件 | 文件 | 说明 |
|------|------|------|
| SyncService | `services/sync_service.go` | 同步逻辑，并发获取和写入 |
| SchedulerService | `services/scheduler_service.go` | 定时调度，管理同步间隔 |
| GitHubService | `services/github_service.go` | GitHub API 封装 |
| AdminHandler | `handlers/admin_handler.go` | 管理后台接口 |
| RepoSyncHandler | `handlers/repo_sync.go` | 项目同步接口 |

## 同步方式

### 1. 手动同步

在项目设置页面点击"同步"按钮，或调用 API：

```bash
# 拉取代码
curl -X POST http://localhost:9000/api/v1/owner/repo/sync/pull \
  -H "Authorization: Bearer <token>"

# 同步 Issue 和 PR
curl -X POST http://localhost:9000/api/v1/owner/repo/sync/issues \
  -H "Authorization: Bearer <token>"
```

### 2. 定时同步

系统内置调度器，根据配置的同步间隔自动触发同步。

配置方式：
1. 项目设置 → 同步配置 → 设置同步间隔（秒）
2. 或通过 API：`PUT /api/v1/:owner/:repo/sync/config`

### 3. 增量同步

基于时间戳实现增量同步，Issue 和 PR 各自维护独立的同步时间点：

- **首次同步**：项目 Issue/PR 数量为 0 时，执行全量拉取
- **后续同步**：使用 `since` 参数，只获取上次同步以来的变更
- **SyncPoint**：记录 `LastIssueSyncAt` 和 `LastPRSyncAt` 两个独立时间点

## 同步流程

### Issue 同步

```
1. 检查项目 Issue 数量，为 0 则全量拉取
2. 使用 since 参数增量获取 Issue 列表
3. 批量保存/更新 Issue 到数据库
4. 同步 Issue 标签关联
5. 并发获取 Issue 评论（10 个并发）
6. 批量保存评论
7. 更新 SyncPoint.LastIssueSyncAt
```

### PR 同步

```
1. 检查项目 PR 数量，为 0 则全量拉取
2. 使用 since 参数增量获取 PR 列表
3. 批量保存/更新 PR 到数据库
4. 同步 PR 标签关联
5. 并发获取 PR 评论（10 个并发）
6. 批量保存评论
7. 更新 SyncPoint.LastPRSyncAt
```

## 并发与性能

### 评论并发获取

Issue 和 PR 的评论采用并发获取策略：

- 使用 goroutine 并发请求 GitHub API
- 信号量控制并发数为 10，避免触发 API 速率限制
- 获取和写入在同一 goroutine 中完成（goent ORM 线程安全）

### 批量写入

数据库操作使用批量写入，减少 I/O 开销。

### 线程安全

goent ORM 的 QueryBuilder 已实现线程安全：
- `Build()` 方法通过 `sync.Mutex` 保护
- 每次查询使用独立的 `bytes.Buffer`
- 移除了全局 Buffer Pool，避免跨 goroutine 共享

## 数据模型

### SyncPoint（同步点）

| 字段 | 类型 | 说明 |
|------|------|------|
| RepositoryID | int64 | 仓库 ID |
| RemoteRepoID | int64 | 远程仓库 ID |
| SyncType | string | 同步类型 |
| LastIssueSyncAt | *time.Time | Issue 最后同步时间 |
| LastPRSyncAt | *time.Time | PR 最后同步时间 |
| SyncInterval | int | 同步间隔（秒），默认 3600 |
| IsPaused | bool | 是否暂停 |
| FailureCount | int | 连续失败次数 |
| LastError | string | 最后错误信息 |

### SyncLog（同步日志）

| 字段 | 类型 | 说明 |
|------|------|------|
| SyncPointID | int64 | 同步点 ID |
| SyncType | string | 同步类型 |
| Status | string | 状态（success/failed） |
| Message | string | 消息 |
| Duration | int64 | 耗时（毫秒） |
| ItemsSynced | int | 成功同步数 |
| ItemsFailed | int | 失败数 |

### PlatformAccount（平台账号）

| 字段 | 类型 | 说明 |
|------|------|------|
| Platform | string | 平台（github/gitea/gitlab） |
| Username | string | 平台用户名 |
| UserID | int64 | 关联本地用户 ID |
| IsActive | bool | 是否激活 |

## 管理接口

### 平台账号管理

```bash
# 列出账号
GET /api/v1/admin/accounts

# 创建账号
POST /api/v1/admin/accounts
{
  "platform": "github",
  "username": "yourname",
  "token": "ghp_xxx"
}

# 删除账号
DELETE /api/v1/admin/accounts/:id
```

### 创建镜像项目

```bash
POST /api/v1/admin/mirror
{
  "owner": "golang",
  "repo": "go",
  "platform": "github"
}
```

### 同步点管理

```bash
# 列出所有同步点
GET /api/v1/admin/sync-points

# 更新同步点配置
PUT /api/v1/admin/sync-points/:id
{
  "sync_interval": 1800,
  "is_paused": false
}

# 查看同步日志
GET /api/v1/admin/sync-logs
```

## 项目设置中的同步

每个项目设置页面提供：

- **同步按钮**：手动触发一次同步
- **同步配置**：设置同步间隔、暂停/恢复
- **同步日志**：查看最近的同步记录
- **推送配置**：public/private 项目可配置推送远程

## 支持的平台

| 平台 | 状态 | 说明 |
|------|------|------|
| GitHub | ✅ 完整支持 | 仓库、Issue、PR、评论、标签、Release |
| Gitea | 🚧 基础支持 | 仓库信息同步 |
| GitLab | 📋 计划中 | - |
| GitFolio | 📋 计划中 | 平台间同步 |

## 故障排查

### 同步失败

1. 查看同步日志中的错误信息
2. 检查 GitHub Token 是否有效
3. 确认 Token 有 `repo` 权限
4. 检查 API 速率限制（每小时 5000 次）

### 同步速度慢

- 评论采用并发获取，默认 10 并发
- 如果网络较慢，可能是 GitHub API 响应延迟
- 可通过代理加速：设置 `PROXY_URL` 环境变量

### 数据不完整

- 首次同步为全量拉取，确保同步完成
- 增量同步基于时间戳，如果远程有回退操作可能遗漏
- 可删除 SyncPoint 中的时间记录，触发全量重新同步
