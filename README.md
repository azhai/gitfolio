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
| admin | xxxxxxxx | 管理员 |
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

## 详细文档

- [项目结构与架构](./docs/ARCHITECTURE.md) — 目录结构、前端架构、项目类型、角色系统、数据模型
- [API 文档](./docs/API.md) — 全部 REST API 接口说明
- [快速上手](./docs/QUICKSTART.md) — 详细的安装部署指南
- [同步系统](./docs/SYNC_SYSTEM.md) — 同步功能详细说明

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
