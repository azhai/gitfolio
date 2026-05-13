# GitFolio v2.0 Release Notes

## 重大变更

### 前端重构
- UI 框架从 Bulma/Macaron 迁移至 **Chakra UI**，采用 **GitLab 风格布局**
- 支持 **国际化**（中文/英文双语）
- 新增 Landing Page、代码高亮、Markdown 渲染等组件

### 项目类型系统
- 四种项目类型：`local`（本地）、`mirror`（镜像）、`public`（公开）、`private`（私有）
- 类型间可转换（mirror ↔ public/private，public ↔ private，local 不可转换）
- 镜像项目自动隐藏"新建议题"和"新建 PR"按钮

### 角色系统重设计
- 用户角色简化为 **admin / user / guest**
- 团队角色独立为 **leader / member**
- 细粒度的仓库可见性控制

### 同步系统
- 从 GitHub 镜像同步仓库数据（Issue、PR、评论、标签、Release）
- **增量同步**：Issue 和 PR 各自维护独立同步时间点
- **并发获取**：评论采用 goroutine 并发拉取（10 并发），大幅缩短同步时间
- 定时调度器支持自动同步
- 管理后台统一管理平台账号和同步点

### ORM 线程安全
- goent QueryBuilder 实现线程安全（`sync.Mutex` 保护 `Build()` 方法）
- 移除全局 Buffer Pool，每个查询使用独立 Buffer
- 支持并发数据库操作，无需应用层加锁

## 功能新增

| 功能 | 说明 |
|------|------|
| 任务管理 | 排期、附件、关联 Issue/PR、状态流转、时间追踪 |
| 提交关联 | 提交消息自动解析 Fixes/Closes/Task 关键字并创建关联 |
| 版本发布 | Release 列表和详情展示 |
| 代码片段 | 公开/私密代码片段管理 |
| 团队组织 | 创建团队、成员管理 |
| 活动流 | 全局活动时间线 |
| Star/Watch | 仓库收藏和关注 |
| 管理员配置 | 通过环境变量自定义管理员账号名和密码 |

## API 变更

- 路径前缀统一为 `/api/v1`
- PR 相关接口从 `/merge_requests` 改为 `/pull_requests`
- PR 状态移除 `merged`，仅保留 `open` / `closed`
- 新增管理后台接口：`/admin/accounts`、`/admin/mirror`、`/admin/sync-points`
- 新增同步配置接口：`/:owner/:repo/sync/config`

## 配置变更

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ADMIN_USERNAME` | `admin` | 管理员用户名 |
| `ADMIN_PASSWORD` | `FolioAdmin` | 管理员密码 |
| `PROXY_URL` | - | HTTP 代理地址 |

## 技术栈更新

- Go: 1.26+
- Fiber: v3
- React: 18 + Vite 5
- 数据库: SQLite（默认）/ PostgreSQL
