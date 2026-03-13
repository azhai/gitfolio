# GitFolio

一个类似 Gitea 的 Git 仓库管理系统，也是采用 Go 语言开发。

## 功能特性

- 🔐 用户认证和授权
- 📦 Git 仓库管理
- 🌿 分支管理
- 📝 Issue 跟踪系统
- 💬 评论系统
- ⭐ Star 和 Watch 功能

## 技术栈

- **后端**: Go 1.25+
- **Web 框架**: Fiber v3
- **ORM**: goent
- **数据库**: SQLite (可扩展支持 PostgreSQL, MySQL)
- **认证**: JWT
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

### 运行服务器

```bash
go run main.go
```

服务器将在 `http://localhost:3000` 启动。

### 开发模式（热重启）

使用 Air 实现代码修改后自动重启：

```bash
make dev
```

首次运行会自动安装 Air 工具。修改 `.go` 文件后服务器会自动重新编译和重启。

## API 文档

### 认证

#### 注册用户
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "your-username",
  "email": "your-email@example.com",
  "password": "your-password"
}
```

#### 登录
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "your-username",
  "password": "your-password"
}
```

### 用户

#### 获取当前用户信息
```http
GET /api/v1/user/me
Authorization: Bearer <token>
```

#### 更新用户信息
```http
PUT /api/v1/user/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "full_name": "Your Name",
  "bio": "Your bio",
  "website": "https://example.com",
  "location": "Your location"
}
```

### 仓库

#### 创建仓库
```http
POST /api/v1/repos
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "my-repo",
  "description": "My repository",
  "is_private": false
}
```

#### 获取仓库列表
```http
GET /api/v1/repos?page=1&per_page=30
```

#### 获取仓库详情
```http
GET /api/v1/:owner/:repo
```

#### Star 仓库
```http
POST /api/v1/:owner/:repo/star
Authorization: Bearer <token>
```

#### Watch 仓库
```http
POST /api/v1/:owner/:repo/watch
Authorization: Bearer <token>
```

### Issue

#### 创建 Issue
```http
POST /api/v1/:owner/:repo/issues
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Issue title",
  "body": "Issue body",
  "labels": ["bug", "help-wanted"]
}
```

#### 获取 Issue 列表
```http
GET /api/v1/:owner/:repo/issues?state=open&page=1
```

#### 添加评论
```http
POST /api/v1/:owner/:repo/issues/:number/comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "body": "Comment body"
}
```

## 项目结构

```
gitfolio/
├── config/          # 配置管理
├── controllers/     # 控制器
├── database/        # 数据库初始化
├── middleware/      # 中间件
├── models/          # 数据模型
├── routes/          # 路由配置
├── services/        # 业务逻辑
├── web/             # 前端文件
│   ├── index.html
│   ├── projects.html
│   ├── issues.html
│   ├── project-detail.html
│   ├── styles.css
│   └── app.js
├── main.go          # 程序入口
└── go.mod           # 依赖管理
```

## 开发

### 构建

```bash
make
# 或
go build -o folio
```

### 运行测试

```bash
# 运行所有测试
make test
# 或
go test -v ./tests/...

# 生成测试覆盖率报告
make test-coverage
```

### 代码格式化

```bash
make fmt
# 或
go fmt ./...
```

### 清理

```bash
make clean
```

## 测试

项目包含完整的测试套件，覆盖以下模块：

### 测试文件

- `tests/setup.go` - 测试辅助函数和设置
- `tests/auth_test.go` - 用户认证测试
- `tests/repository_test.go` - 仓库管理测试
- `tests/issue_test.go` - Issue 跟踪测试
- `tests/middleware_test.go` - 中间件测试
- `tests/integration_test.go` - 集成测试

### 测试覆盖

- ✅ 用户注册和登录
- ✅ JWT Token 认证
- ✅ 仓库 CRUD 操作
- ✅ 公开/私有仓库权限
- ✅ Star 和 Watch 功能
- ✅ Issue 创建和管理
- ✅ 评论系统
- ✅ 分页功能
- ✅ 完整用户流程测试

### 运行特定测试

```bash
# 运行认证测试
go test -v ./tests/... -run TestUser

# 运行仓库测试
go test -v ./tests/... -run TestRepository

# 运行集成测试
go test -v ./tests/... -run TestComplete
```

## 许可证

MIT License
