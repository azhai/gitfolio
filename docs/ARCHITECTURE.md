# 项目结构与架构

## 目录结构

```
gitfolio/
├── config/                 # 配置管理
│   ├── config.go           # 全局配置加载
│   └── constants.go        # 常量定义
├── handlers/               # HTTP 请求处理器
│   ├── admin_handler.go    # 管理后台（账号、镜像、同步点）
│   ├── group_handler.go    # 团队 CRUD + 成员管理
│   ├── issue_handler.go    # Issue CRUD + 评论
│   ├── pull_request_handler.go # PR CRUD + 合并/关闭
│   ├── task_handler.go     # 任务管理 + 排期 + 附件 + 计时
│   ├── release_handler.go  # 版本发布
│   ├── repo_crud.go        # 仓库增删改查 + 转移
│   ├── repo_dto.go         # 仓库响应结构
│   ├── repo_git.go         # Git 操作（树、文件、提交、差异、暂存、提交）
│   ├── repo_star.go        # Star/Watch
│   ├── repo_sync.go        # 仓库同步
│   ├── snippet_handler.go  # 代码片段
│   ├── stats_handler.go    # 统计信息
│   ├── sync_config_handler.go # 同步配置
│   ├── upload_handler.go   # 文件上传
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
│   ├── fields.go           # 字段类型定义
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
│   ├── lang.go             # 语言检测
│   ├── proxy.go            # HTTP 代理
│   ├── scheduler_service.go # 定时同步调度
│   ├── stats_service.go    # 统计服务
│   └── sync_service.go     # 同步服务（Issue/PR/评论并发同步）
├── web/                    # 前端（静态 HTML + Alpine.js，无打包器）
│   ├── pages/              # 每个顶层路由一个 HTML 文档
│   ├── assets/
│   │   ├── css/            # 设计令牌与组件样式
│   │   ├── js/             # Alpine 组件、API 客户端、i18n、图标
│   │   └── lib/            # Alpine/marked/Prism/Sortable 运行时产物
│   └── public/             # favicon 等静态资源
├── main.go                 # 程序入口
└── Makefile                # 构建命令
```

## 前端架构

前端不使用打包器，也没有中间产物：Go 直接用 `embed` 把 `web/pages`、
`web/assets`、`web/public` 编进二进制，构建和部署都不需要 Node。改完前端文件
重新编译即可（`make front` 现在只打印提示，不复制任何东西）。

- 每个顶层路由一个 HTML 文档；项目工作区（`/owner/repo/...`）共用
  `project.html`，页面脚本从 `location.pathname` 解析子路径。
- 页面逻辑是 `web/assets/js/pages/*.js` 里的 Alpine 组件
  （`Alpine.data(...)`），`<body data-page="...">` 决定动态加载哪个模块。
- 运行时库与 lucide 图标集都是预生成产物，直接放在 `assets/lib/` 和
  `assets/js/icons.js`，随仓库提交。
- 组件写法、路由映射和样式约定见 `docs/WEB_ALPINE.md`。

## 项目类型

| 类型 | 可见性 | 远程同步 | 推送远程 | Owner ID | 说明 |
|------|--------|---------|---------|----------|------|
| `local` | 除 guest 外可见 | ❌ | ❌ | 0 | 本地项目，无远程关联 |
| `mirror` | 所有人可见 | ✅ 拉取 | ❌ | 用户/团队 ID | 镜像项目，只读 |
| `public` | 所有人可见 | ✅ | ✅ | 用户/团队 ID | 公开项目 |
| `private` | 仅所有者和团队成员可见 | ✅ | ✅ | 用户/团队 ID | 私有项目 |

类型转换规则：mirror ↔ public/private 可互转，public ↔ private 可互转，local 不可转换。

镜像项目不显示"新建 Issue"和"新建 PR"按钮，因为数据来自远程仓库。

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
| 未登录 | public + mirror（仅列表，详情需登录） |

### 项目访问权限

| 项目类型 | 未登录 | guest | user / admin |
|----------|--------|-------|-------------|
| `public` | ❌ 需登录 | ✅ 只读 | ✅ 读写 |
| `mirror` | ❌ 需登录 | ✅ 只读 | ✅ 读写（owner/组成员） |
| `private` | ❌ 403 | ❌ 403 | ✅ 仅 owner/组成员（admin 可访问所有） |
| `local` | ❌ 403 | ❌ 403 | ✅ 仅 owner（admin 可访问所有） |

### API 请求权限

| 请求类型 | 未登录 | guest | user / admin |
|----------|--------|-------|-------------|
| GET（读取） | ✅ 白名单接口 | ✅ 允许 | ✅ 允许 |
| POST/PUT/DELETE（写入） | ❌ 401 跳转登录 | ❌ 403 | ✅ 允许 |

白名单 GET 接口：`/health`、`/auth/login`、`/auth/logout`、`/stats`、`/recent-issues`、`/recent-tasks`、`/repos/github-info`

### Guest 用户界面限制

guest 用户在前端界面中以下操作按钮被禁用：

- 创建项目、迁移项目
- 创建团队、管理团队成员
- 创建代码片段、编辑/删除代码片段
- 仓库设置、同步操作
- 创建 Issue、添加评论
- 创建 PR、合并/关闭 PR
- 创建任务、状态流转、添加评论
- Star/Watch 仓库
- 提交页面：拉取代码、设置默认分支、新建/删除标签
- 个人设置：修改资料、上传头像、修改密码

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
