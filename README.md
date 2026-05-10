# GitFolio

一个类似 Gitea 的 Git 仓库管理系统，采用 Go 语言开发。

![GitFolio](./web/screenshot-1.png)

## 功能特性

- 🔐 用户认证和授权（JWT）
- 📦 Git 仓库管理（CRUD、分支、标签、提交）
- 📝 Issue 跟踪系统（标签、指派、评论）
- 🔀 Pull Request 管理（合并、关闭、重开）
- ✅ 任务管理系统（排期、附件、关联 Issue、状态流转、时间追踪）
- 🔗 提交自动关联 Issue/PR/Task（Fixes #123, Closes #123, Task: #5）
- 📝 提交详情和分支比较（签名验证、文件变更、差异对比）
- ⏱️ 任务时间追踪（计时器、时间汇总）
- 👥 团队/组织管理
- 🏷️ 里程碑管理
- 📊 仓库统计和活动流
- 💻 代码片段管理
- 🔄 仓库同步（GitHub 镜像）
- ⭐ Star 和 Watch 功能
- 🚀 Release 版本管理

## 技术栈

- **后端**: Go 1.25+
- **Web 框架**: Fiber v3
- **ORM**: goent（自研轻量 ORM）
- **数据库**: SQLite（可扩展支持 PostgreSQL、MySQL）
- **认证**: JWT
- **前端**: React 18 + Chakra UI + Vite
- **配置管理**: goent/utils Environ

## 快速开始

### 安装依赖

```bash
go mod download
```

### 配置环境变量

复制示例配置文件：

```bash
cp example.env .env
```

主要环境变量：

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `SERVER_PORT` | `3000` | 服务端口 |
| `APP_MODE` | `debug` | 运行模式 |
| `DB_TYPE` | `sqlite` | 数据库类型 |
| `DB_DSN` | `gitfolio.db` | 数据库连接串 |
| `JWT_SECRET` | - | JWT 签名密钥 |
| `REPO_ROOT` | `./repos` | 仓库存储根目录 |
| `GITHUB_USERNAME` | - | GitHub 同步用户名 |
| `GITHUB_TOKEN` | - | GitHub 同步 Token |

### 运行服务器

```bash
go run main.go
```

服务器将在 `http://localhost:3000` 启动。

### 开发模式（热重启）

```bash
make dev
# 前端: http://localhost:5173
# 后端: http://localhost:3000
```

### 构建前端

```bash
# 开发模式（HMR）
./build-frontend.sh dev

# 生产构建
./build-frontend.sh build

# 清理构建产物
./build-frontend.sh clean

# 安装依赖
./build-frontend.sh install
```

## 项目结构

```
gitfolio/
├── cmd/                    # 命令行工具
│   ├── account/            # 账户管理
│   ├── import/             # 数据导入
│   ├── mirror/             # 仓库镜像
│   ├── seed/               # 种子数据
│   ├── sync/               # 仓库同步
│   └── update_commit_time/ # 更新提交时间
├── config/                 # 配置管理
│   ├── config.go           # 全局配置加载
│   └── constants.go        # 常量定义（状态、分页等）
├── handlers/               # HTTP 请求处理器
│   ├── group_handler.go    # 团队/组织 + 活动 + 里程碑
│   ├── group_member_handler.go # 团队成员管理
│   ├── issue_handler.go    # Issue CRUD
│   ├── pull_request_handler.go # PR CRUD + 合并/关闭
│   ├── task_handler.go     # 任务管理 + 排期 + 附件
│   ├── release_handler.go  # 版本发布
│   ├── repo_crud.go        # 仓库增删改查
│   ├── repo_dto.go         # 仓库响应结构
│   ├── repo_git.go         # Git 操作（树、文件、提交）
│   ├── repo_star.go        # Star/Watch
│   ├── repo_sync.go        # 仓库同步
│   ├── snippet_handler.go  # 代码片段
│   ├── stats_handler.go    # 统计信息
│   ├── upload_handler.go   # 文件上传
│   └── user_handler.go     # 用户管理
├── helpers/                # 公共辅助函数
│   ├── helpers.go          # 分页、响应、参数解析
│   ├── db.go               # 批量查询（贡献者、用户、评论数）
│   ├── labels.go           # 标签管理（默认标签、批量查询）
│   ├── permissions.go      # 权限校验（仓库访问、私有仓库）
│   ├── references.go       # 提交消息解析和关联创建
│   └── resources.go        # 资源查询（Owner、Repo 解析）
├── middleware/             # 中间件
│   └── auth.go             # JWT 认证中间件
├── models/                 # 数据模型
│   ├── conn.go             # 数据库连接管理（OpenDB/CloseDB）
│   └── tables.go           # 所有表结构定义
├── routes/                 # 路由配置
│   └── routes.go           # 路由注册（按模块分组）
├── services/               # 业务逻辑层
│   ├── account_service.go  # 账户服务
│   ├── git_commit.go       # Git 提交查询
│   ├── git_diff.go         # Git Diff 解析
│   ├── git_graph.go        # Git 图表数据
│   ├── git_repo.go         # Git 仓库操作
│   ├── github_service.go   # GitHub API 集成
│   ├── lang.go             # 语言检测
│   ├── stats_service.go    # 统计服务
│   └── sync_service.go     # 同步服务
├── tests/                  # 测试套件
├── web/                    # 前端（React + Chakra UI + Vite）
│   ├── src/
│   │   ├── api/           # API 调用封装
│   │   ├── components/    # 通用组件（布局、导航、侧边栏）
│   │   ├── contexts/      # React Context（认证）
│   │   ├── i18n/          # 国际化（中文）
│   │   ├── pages/         # 页面组件
│   │   │   ├── project/   # 项目子页面（代码、议题、PR、提交等）
│   │   │   └── ...        # 其他页面
│   │   ├── theme/         # Chakra UI 主题
│   │   ├── App.jsx        # 应用入口和路由
│   │   └── main.jsx       # React 挂载
│   ├── dist/              # 构建产物
│   ├── index.html         # HTML 入口
│   ├── package.json
│   └── vite.config.js     # Vite 配置
├── main.go                 # 程序入口
└── Makefile                # 构建命令
```

## API 文档

所有 API 路径前缀为 `/api/v1`。需要认证的接口需在 Header 中携带 `Authorization: Bearer <token>`。

### 认证

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/auth/register` | 注册用户 | - |
| POST | `/auth/login` | 登录 | - |
| POST | `/auth/logout` | 登出 | ✓ |

### 用户

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/user/me` | 获取当前用户 | ✓ |
| PUT | `/user/me` | 更新当前用户 | ✓ |
| POST | `/user/me/password` | 修改密码 | ✓ |
| GET | `/users` | 用户列表 | 可选 |
| GET | `/users/:username` | 用户详情 | 可选 |
| GET | `/users/:username/repos` | 用户仓库列表 | 可选 |
| PUT | `/users/:username` | 更新用户 | ✓ |
| POST | `/users/:username/avatar` | 上传头像 | ✓ |

### 仓库

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/repos` | 仓库列表 | 可选 |
| POST | `/repos` | 创建仓库 | ✓ |
| GET | `/repos/github-info` | GitHub 仓库信息 | - |
| GET | `/:owner/:repo` | 仓库详情 | 可选 |
| PUT | `/:owner/:repo` | 更新仓库 | ✓ |
| DELETE | `/:owner/:repo` | 删除仓库 | ✓ |

### Git 操作

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/:owner/:repo/tree/*` | 目录树 | 可选 |
| GET | `/:owner/:repo/file/*` | 文件内容 | 可选 |
| GET | `/:owner/:repo/branches` | 分支列表 | 可选 |
| GET | `/:owner/:repo/tags` | 标签列表 | 可选 |
| GET | `/:owner/:repo/commits` | 提交历史 | 可选 |
| GET | `/:owner/:repo/last-commit` | 最近提交 | 可选 |
| GET | `/:owner/:repo/contributors` | 贡献者列表 | 可选 |
| GET | `/:owner/:repo/code-stats` | 代码统计 | 可选 |
| GET | `/:owner/:repo/commit-activity` | 提交活动 | 可选 |
| POST | `/:owner/:repo/rebase` | Rebase | ✓ |
| POST | `/:owner/:repo/stage` | 暂存文件 | ✓ |
| POST | `/:owner/:repo/unstage` | 取消暂存 | ✓ |
| POST | `/:owner/:repo/commit` | 提交更改 | ✓ |
| GET | `/:owner/:repo/commits/:sha` | 提交详情 | 可选 |
| GET | `/:owner/:repo/compare/:basehead` | 提交/分支比较 | 可选 |

### 仓库同步

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/:owner/:repo/sync/pull` | 拉取同步 | ✓ |
| POST | `/:owner/:repo/sync/push` | 推送同步 | ✓ |
| POST | `/:owner/:repo/refresh-stats` | 刷新统计 | ✓ |

### Star / Watch

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/:owner/:repo/star` | Star 仓库 | ✓ |
| DELETE | `/:owner/:repo/star` | 取消 Star | ✓ |
| POST | `/:owner/:repo/watch` | Watch 仓库 | ✓ |
| DELETE | `/:owner/:repo/watch` | 取消 Watch | ✓ |

### Issue

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/:owner/:repo/issues` | Issue 列表 | - |
| POST | `/:owner/:repo/issues` | 创建 Issue | ✓ |
| GET | `/:owner/:repo/issues/:number` | Issue 详情 | - |
| PUT | `/:owner/:repo/issues/:number` | 更新 Issue | ✓ |
| GET | `/:owner/:repo/issues/:number/comments` | 评论列表 | - |
| POST | `/:owner/:repo/issues/:number/comments` | 添加评论 | ✓ |
| GET | `/:owner/:repo/labels` | 标签列表 | - |

**查询参数**：`state`（open/closed/all）、`label`（标签名过滤）、`page`、`per_page`

### Pull Request

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/:owner/:repo/pull_requests` | PR 列表 | - |
| POST | `/:owner/:repo/pull_requests` | 创建 PR | ✓ |
| GET | `/:owner/:repo/pull_requests/:number` | PR 详情 | - |
| PUT | `/:owner/:repo/pull_requests/:number` | 更新 PR | ✓ |
| GET | `/:owner/:repo/pull_requests/:number/commits` | PR 提交 | - |
| GET | `/:owner/:repo/pull_requests/:number/files` | PR 文件变更 | - |
| POST | `/:owner/:repo/pull_requests/:number/merge` | 合并 PR | ✓ |
| POST | `/:owner/:repo/pull_requests/:number/close` | 关闭 PR | ✓ |
| POST | `/:owner/:repo/pull_requests/:number/reopen` | 重开 PR | ✓ |

**查询参数**：`state`（open/closed/merged）、`page`、`per_page`

### 任务管理

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/:owner/:repo/tasks` | 任务列表 | - |
| POST | `/:owner/:repo/tasks` | 创建任务 | ✓ |
| GET | `/:owner/:repo/tasks/:id` | 任务详情 | - |
| PUT | `/:owner/:repo/tasks/:id` | 更新任务 | ✓ |
| DELETE | `/:owner/:repo/tasks/:id` | 删除任务 | ✓ |
| POST | `/:owner/:repo/tasks/:id/attachments` | 上传附件 | ✓ |
| DELETE | `/:owner/:repo/tasks/:id/attachments/:attachment_id` | 删除附件 | ✓ |
| POST | `/:owner/:repo/tasks/:id/issues` | 关联 Issue | ✓ |
| DELETE | `/:owner/:repo/tasks/:id/issues/:issue_id` | 取消关联 | ✓ |
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

**查询参数**：`status`（draft/progress/review/completed）、`priority`（1-5）、`page`、`per_page`

### 团队/组织

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/groups` | 团队列表 | - |
| POST | `/groups` | 创建团队 | ✓ |
| GET | `/groups/:name` | 团队详情 | - |
| PUT | `/groups/:name` | 更新团队 | ✓ |
| POST | `/groups/:name/avatar` | 上传团队头像 | ✓ |
| GET | `/groups/:name/members` | 成员列表 | - |
| POST | `/groups/:name/members` | 添加成员 | ✓ |
| DELETE | `/groups/:name/members/:username` | 移除成员 | ✓ |

### 活动流

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/activities` | 活动列表 | - |
| POST | `/activities` | 创建活动 | ✓ |

**查询参数**：`user_id`、`page`、`per_page`

### 代码片段

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/snippets` | 片段列表 | - |
| POST | `/snippets` | 创建片段 | ✓ |
| GET | `/snippets/:id` | 片段详情 | - |
| PUT | `/snippets/:id` | 更新片段 | ✓ |
| DELETE | `/snippets/:id` | 删除片段 | ✓ |

### 版本发布

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/:owner/:repo/releases` | 发布列表 | - |
| GET | `/:owner/:repo/releases/:tag` | 发布详情 | - |
| POST | `/:owner/:repo/releases/sync` | 同步发布 | ✓ |

### 通用

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/stats` | 全局统计 |

## 数据模型

核心数据表：

| 表名 | 说明 |
|------|------|
| `User` | 用户 |
| `Repository` | 仓库 |
| `RepositoryStats` | 仓库统计 |
| `Owner` | 仓库所有者 |
| `Issue` | Issue |
| `PullRequest` | Pull Request |
| `Comment` | 评论 |
| `Label` | 标签 |
| `IssueLabel` | Issue-标签关联 |
| `Milestone` | 里程碑 |
| `Contributor` | 贡献者 |
| `Branch` | 分支 |
| `Release` | 版本发布 |
| `Star` / `Watch` | 收藏/关注 |
| `Group` / `GroupMember` | 团队/成员 |
| `Activity` | 活动流 |
| `Task` | 任务 |
| `TaskSchedule` | 任务排期 |
| `TaskAttachment` | 任务附件 |
| `TaskIssue` | 任务-Issue 关联 |
| `TaskTransition` | 任务状态流转记录 |
| `TaskPullRequest` | 任务-PR 关联 |
| `TaskTimeLog` | 任务时间追踪 |
| `CommitReference` | 提交关联（Issue/PR/Task） |
| `Snippet` | 代码片段 |
| `SyncToken` / `SyncPoint` / `SyncLog` | 同步相关 |
| `RemoteRepository` | 远程仓库 |
| `Webhook` | Webhook |

## 开发

### 构建

```bash
make
# 或
go build -o folio
```

### 运行测试

```bash
make test
# 或
go test -v ./tests/...
```

### 代码格式化

```bash
make fmt
```

### 清理

```bash
make clean
```

## 许可证

MIT License
