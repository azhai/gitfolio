# GitFolio

一个轻量级的 Git 仓库管理系统，采用 Go + React 开发，支持从 GitHub 镜像同步仓库数据。

![GitFolio](./web/screenshot-1.png)

## 功能特性

- 🔐 用户认证和授权（JWT）
- 📦 Git 仓库管理（CRUD、分支、标签、提交）
- 🏗️ 四种项目类型（local、mirror、public、private）
- 📝 Issue 跟踪系统（标签、指派、评论）
- 🔀 Pull Request 管理（合并、关闭、重开）
- ✅ 任务管理系统（排期、附件、关联 Issue、状态流转、时间追踪）
- 🔗 提交自动关联 Issue/PR/Task（Fixes #123, Closes #123, Task: #5）
- 📝 提交详情和分支比较（签名验证、文件变更、差异对比）
- ⏱️ 任务时间追踪（计时器、时间汇总）
- 👥 团队/组织管理（Leader/Member 角色）
- 🏷️ 里程碑管理
- 📊 仓库统计和活动流
- 💻 代码片段管理
- 🔄 仓库同步（GitHub 镜像，支持定时自动同步）
- ⭐ Star 和 Watch 功能
- 🚀 Release 版本管理
- 📄 文件查看（代码高亮、Markdown 渲染、查看源码）
- 🌐 国际化支持（中文/英文）

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Go 1.26+ |
| Web 框架 | Fiber v3 |
| ORM | goent（自研轻量 ORM，线程安全） |
| 数据库 | SQLite（默认）/ PostgreSQL |
| 认证 | JWT |
| 前端 | React 18 + Chakra UI + Vite |
| 配置管理 | goent/utils Environ |

## 快速开始

### 环境要求

- Go 1.26+
- Node.js 18+
- SQLite 或 PostgreSQL

### 安装和运行

```bash
# 克隆项目
git clone https://github.com/azhai/gitfolio.git
cd gitfolio

# 安装前端依赖
cd web && npm install && cd ..

# 配置环境变量
cp .env.example .env
# 编辑 .env，至少修改 JWT_SECRET

# 开发模式运行
make dev

# 或直接运行
go run main.go
```

服务器将在 `http://localhost:9000` 启动（默认端口）。

### 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | FolioAdmin | 管理员 |
| demo | demo123 | 访客 |

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `APP_MODE` | `debug` | 运行模式（debug/release） |
| `SERVER_PORT` | `9000` | 服务端口 |
| `BASE_URL` | `http://127.0.0.1:9000` | 站点 URL |
| `DB_TYPE` | `sqlite` | 数据库类型（sqlite/pgsql） |
| `DB_DSN` | `gitfolio.db` | 数据库连接串 |
| `JWT_SECRET` | - | JWT 签名密钥（**生产环境必须修改**） |
| `REPO_ROOT` | `./repos` | 仓库存储根目录 |
| `PROXY_URL` | - | 代理地址（可选，如 `http://127.0.0.1:7890`） |

PostgreSQL 连接串示例：`postgres://user:password@127.0.0.1:5432/dbname?sslmode=disable`

### 构建生产版本

```bash
# 构建当前平台
make one

# 构建所有平台（darwin/linux/windows, amd64/arm64）
make folio

# 清理构建产物
make clean
```

## 项目结构

```
gitfolio/
├── config/                 # 配置管理
│   ├── config.go           # 全局配置加载
│   └── constants.go        # 常量定义
├── handlers/               # HTTP 请求处理器
│   ├── admin_handler.go    # 管理后台（账号、镜像、同步点）
│   ├── issue_handler.go    # Issue CRUD + 评论
│   ├── pull_request_handler.go # PR CRUD + 合并/关闭
│   ├── task_handler.go     # 任务管理 + 排期 + 附件 + 计时
│   ├── release_handler.go  # 版本发布
│   ├── repo_crud.go        # 仓库增删改查 + 转移
│   ├── repo_dto.go         # 仓库响应结构
│   ├── repo_git.go         # Git 操作（树、文件、提交、差异）
│   ├── repo_star.go        # Star/Watch
│   ├── repo_sync.go        # 仓库同步
│   ├── snippet_handler.go  # 代码片段
│   ├── stats_handler.go    # 统计信息
│   └── user_handler.go     # 用户管理
├── helpers/                # 公共辅助函数
│   ├── helpers.go          # 分页、响应、参数解析
│   ├── db.go               # 批量查询（贡献者、用户、评论数）
│   ├── labels.go           # 标签管理
│   ├── permissions.go      # 权限校验
│   ├── references.go       # 提交消息解析和关联创建
│   └── resources.go        # 资源查询（Owner、Repo 解析）
├── middleware/             # 中间件
│   └── auth.go             # JWT 认证 + 角色检查
├── models/                 # 数据模型
│   ├── conn.go             # 数据库连接管理
│   └── tables.go           # 所有表结构定义
├── routes/                 # 路由配置
│   └── routes.go           # 路由注册
├── services/               # 业务逻辑层
│   ├── account_service.go  # 账户服务
│   ├── git_commit.go       # Git 提交查询
│   ├── git_diff.go         # Git Diff 解析
│   ├── git_graph.go        # Git 图表数据
│   ├── git_repo.go         # Git 仓库操作
│   ├── github_service.go   # GitHub API 集成
│   ├── scheduler_service.go # 定时同步调度
│   ├── stats_service.go    # 统计服务
│   └── sync_service.go     # 同步服务（Issue/PR/评论并发同步）
├── web/                    # 前端（React + Chakra UI + Vite）
│   ├── src/
│   │   ├── api/            # API 调用封装
│   │   ├── components/     # 通用组件
│   │   ├── contexts/       # React Context（认证）
│   │   ├── i18n/           # 国际化（中文/英文）
│   │   ├── pages/          # 页面组件
│   │   └── theme/          # Chakra UI 主题
│   └── package.json
├── main.go                 # 程序入口
└── Makefile                # 构建命令
```

## 项目类型

| 类型 | 可见性 | 远程同步 | 推送远程 | Owner ID | 说明 |
|------|--------|---------|---------|----------|------|
| `local` | 除 guest 外可见 | ❌ | ❌ | 0 | 本地项目，无远程关联 |
| `mirror` | 所有人可见 | ✅ 拉取 | ❌ | 用户/团队 ID | 镜像项目，只读 |
| `public` | 所有人可见 | ✅ | ✅ | 用户/团队 ID | 公开项目 |
| `private` | 仅所有者和团队成员可见 | ✅ | ✅ | 用户/团队 ID | 私有项目 |

类型转换规则：mirror ↔ public/private 可互转，public ↔ private 可互转，local 不可转换。

镜像项目不显示"新建议题"和"新建 PR"按钮，因为数据来自远程仓库。

## 角色系统

### 用户角色

| 角色 | 权限 |
|------|------|
| `admin` | 全部权限，包括管理所有用户和项目 |
| `user` | 管理自己的项目，参与团队项目 |
| `guest` | 只读访问公开和镜像项目 |

### 团队角色

| 角色 | 权限 |
|------|------|
| `leader` | 危险操作（删除、转移所有权）、合并 PR |
| `member` | 管理团队项目（非危险操作） |

### 仓库列表可见性

| 角色 | 可见项目类型 |
|------|-------------|
| admin | 所有项目 |
| user | local + public + mirror + 自己/团队的 private |
| guest | public + mirror |

## 同步系统

GitFolio 支持从 GitHub 镜像同步仓库数据，包括：

- 仓库信息（描述、默认分支等）
- Issues 和评论
- Pull Requests 和评论
- 标签（Labels）
- 版本发布（Releases）

### 同步方式

1. **手动同步**：在项目设置页面点击"同步"按钮
2. **定时同步**：配置同步间隔，系统自动定时拉取
3. **增量同步**：基于时间戳，只同步上次以来的变更

### 同步配置

通过管理后台或项目设置页面配置：
- 同步间隔（秒）
- 暂停/恢复同步
- 查看同步日志

### 同步性能

- Issue/PR 评论采用并发获取（10 个并发），大幅缩短同步时间
- 数据库批量写入，减少 I/O 开销
- goent ORM 线程安全，支持并发数据库操作

## API 文档

所有 API 路径前缀为 `/api/v1`。需要认证的接口需在 Header 中携带 `Authorization: Bearer <token>`。

### 认证

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/auth/login` | 登录 | - |
| POST | `/auth/logout` | 登出 | ✓ |

### 用户

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/user/me` | 获取当前用户 | ✓ |
| PUT | `/user/me` | 更新当前用户 | ✓ |
| POST | `/user/me/password` | 修改密码 | ✓ |
| GET | `/users` | 用户列表 | 可选 |
| POST | `/users` | 创建用户 | admin |
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
| POST | `/:owner/:repo/transfer` | 转移仓库 | ✓ |

### Git 操作

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/:owner/:repo/tree/*` | 目录树 | 可选 |
| GET | `/:owner/:repo/file/*` | 文件内容 | 可选 |
| GET | `/:owner/:repo/raw/*` | 原始文件内容 | 可选 |
| GET | `/:owner/:repo/branches` | 分支列表 | 可选 |
| GET | `/:owner/:repo/tags` | 标签列表 | 可选 |
| GET | `/:owner/:repo/commits` | 提交历史 | 可选 |
| GET | `/:owner/:repo/commits/:sha` | 提交详情 | 可选 |
| GET | `/:owner/:repo/last-commit` | 最近提交 | 可选 |
| GET | `/:owner/:repo/contributors` | 贡献者列表 | 可选 |
| GET | `/:owner/:repo/code-stats` | 代码统计 | 可选 |
| GET | `/:owner/:repo/commit-activity` | 提交活动 | 可选 |
| GET | `/:owner/:repo/compare/:basehead` | 提交/分支比较 | 可选 |
| POST | `/:owner/:repo/rebase` | Rebase | ✓ |
| POST | `/:owner/:repo/stage` | 暂存文件 | ✓ |
| POST | `/:owner/:repo/unstage` | 取消暂存 | ✓ |
| POST | `/:owner/:repo/commit` | 提交更改 | ✓ |

### 仓库同步

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/:owner/:repo/sync/pull` | 拉取同步 | ✓ |
| POST | `/:owner/:repo/sync/issues` | 同步 Issue/PR | ✓ |
| POST | `/:owner/:repo/sync/push` | 推送同步 | ✓ |
| GET | `/:owner/:repo/sync/config` | 获取同步配置 | ✓ |
| PUT | `/:owner/:repo/sync/config` | 更新同步配置 | ✓ |
| GET | `/:owner/:repo/sync/logs` | 同步日志 | ✓ |
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

**查询参数**：`state`（open/closed/all）、`label`、`page`、`per_page`

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

**查询参数**：`state`（open/closed）、`page`、`per_page`

### 任务管理

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/:owner/:repo/tasks` | 任务列表 | - |
| POST | `/:owner/:repo/tasks` | 创建任务 | ✓ |
| GET | `/:owner/:repo/tasks/:id` | 任务详情 | - |
| PUT | `/:owner/:repo/tasks/:id` | 更新任务 | ✓ |
| DELETE | `/:owner/:repo/tasks/:id` | 删除任务 | ✓ |
| POST | `/:owner/:repo/tasks/:id/attachments` | 上传附件 | ✓ |
| DELETE | `/:owner/:repo/tasks/:id/attachments/:aid` | 删除附件 | ✓ |
| POST | `/:owner/:repo/tasks/:id/issues` | 关联 Issue | ✓ |
| DELETE | `/:owner/:repo/tasks/:id/issues/:iid` | 取消关联 | ✓ |
| GET | `/:owner/:repo/tasks/:id/comments` | 任务评论 | - |
| POST | `/:owner/:repo/tasks/:id/comments` | 添加评论 | ✓ |
| POST | `/:owner/:repo/tasks/:id/transition` | 状态流转 | ✓ |
| GET | `/:owner/:repo/tasks/:id/transitions` | 流转历史 | - |
| POST | `/:owner/:repo/tasks/:id/pull_requests` | 关联 PR | ✓ |
| DELETE | `/:owner/:repo/tasks/:id/pull_requests/:pid` | 取消关联 PR | ✓ |
| GET | `/:owner/:repo/tasks/:id/pull_requests` | 关联 PR 列表 | - |
| GET | `/:owner/:repo/tasks/:id/commits` | 关联提交 | - |
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
| POST | `/groups/:name/avatar` | 上传头像 | ✓ |
| GET | `/groups/:name/members` | 成员列表 | - |
| POST | `/groups/:name/members` | 添加成员 | ✓ |
| PUT | `/groups/:name/members/:username` | 更新角色 | ✓ |
| DELETE | `/groups/:name/members/:username` | 移除成员 | ✓ |

### 活动流

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/activities` | 活动列表 | - |
| POST | `/activities` | 创建活动 | ✓ |

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

### 管理后台

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/admin/accounts` | 平台账号列表 | admin |
| POST | `/admin/accounts` | 创建平台账号 | admin |
| DELETE | `/admin/accounts/:id` | 删除平台账号 | admin |
| POST | `/admin/mirror` | 创建镜像项目 | admin |
| POST | `/admin/import` | 从远程导入 | admin |
| GET | `/admin/sync-points` | 同步点列表 | admin |
| PUT | `/admin/sync-points/:id` | 更新同步点 | admin |
| GET | `/admin/sync-logs` | 同步日志 | admin |

### 通用

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/stats` | 全局统计 |
| GET | `/recent-issues` | 最近 Issue |
| GET | `/recent-tasks` | 最近任务 |

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
| `PullRequestLabel` | PR-标签关联 |
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
| `PlatformAccount` | 平台账号 |
| `SyncToken` | 同步令牌 |
| `RemoteRepository` | 远程仓库 |
| `SyncPoint` | 同步点 |
| `SyncLog` | 同步日志 |
| `Webhook` | Webhook |

## 开发

### 开发模式

```bash
make dev
# 前端通过 Vite 构建，后端通过 go run 热启动
# 访问: http://localhost:9000
```

### 构建

```bash
# 构建当前平台
make one

# 构建所有平台
make folio

# 清理
make clean
```

### 代码格式化

```bash
go fmt ./...
```

## 许可证

MIT License
