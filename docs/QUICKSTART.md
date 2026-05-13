# GitFolio 快速开始

## 安装和运行

### 1. 环境要求

- Go 1.26+
- Node.js 18+
- SQLite（默认）或 PostgreSQL

### 2. 安装

```bash
git clone https://github.com/azhai/gitfolio.git
cd gitfolio

# 安装前端依赖
cd web && npm install && cd ..

# 配置环境变量
cp .env.example .env
# 编辑 .env，至少修改 JWT_SECRET
```

### 3. 运行

```bash
# 开发模式
make dev

# 或直接运行
go run main.go
```

服务器将在 `http://localhost:9000` 启动。

### 4. 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | FolioAdmin | 管理员 |
| demo | demo123 | 访客 |

## 创建项目

### 本地项目

1. 登录后点击"新建项目"
2. 填写项目名称和描述
3. 选择项目类型为"本地项目"
4. 点击创建

### 镜像项目

1. 登录后点击"导入项目"
2. 输入 GitHub 仓库 URL（如 `https://github.com/golang/go`）
3. 系统自动创建镜像项目并同步数据

也可以通过管理后台创建：

1. 以 admin 身份登录
2. 进入管理后台 → 平台账号
3. 添加 GitHub 账号和 Token
4. 点击"创建镜像"，输入 owner/repo

## 同步功能

### 手动同步

在项目设置页面点击"同步"按钮，触发一次同步。

### 定时同步

1. 进入项目设置页面
2. 在"同步配置"中设置同步间隔（秒）
3. 保存配置，系统将自动定时拉取

### 同步内容

- 仓库信息（描述、默认分支等）
- Issues 和评论
- Pull Requests 和评论
- 标签（Labels）
- 版本发布（Releases）

### 增量同步

系统基于时间戳实现增量同步：
- Issue 和 PR 各自维护独立的同步时间点
- 首次同步为全量拉取，后续只同步变更

## 项目类型

| 类型 | 可见性 | 远程同步 | 推送远程 | 说明 |
|------|--------|---------|---------|------|
| `local` | 除 guest 外可见 | ❌ | ❌ | 本地项目，无远程关联 |
| `mirror` | 所有人可见 | ✅ 拉取 | ❌ | 镜像项目，只读 |
| `public` | 所有人可见 | ✅ | ✅ | 公开项目 |
| `private` | 仅所有者和团队成员可见 | ✅ | ✅ | 私有项目 |

类型转换规则：mirror ↔ public/private 可互转，public ↔ private 可互转，local 不可转换。

## 角色系统

### 用户角色

| 角色 | 权限 |
|------|------|
| `admin` | 全部权限 |
| `user` | 管理自己的项目，参与团队项目 |
| `guest` | 只读访问公开和镜像项目 |

### 团队角色

| 角色 | 权限 |
|------|------|
| `leader` | 危险操作（删除、转移）、合并 PR |
| `member` | 管理团队项目（非危险操作） |

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `APP_MODE` | `debug` | 运行模式 |
| `SERVER_PORT` | `9000` | 服务端口 |
| `BASE_URL` | `http://127.0.0.1:9000` | 站点 URL |
| `DB_TYPE` | `sqlite` | 数据库类型（sqlite/pgsql） |
| `DB_DSN` | `gitfolio.db` | 数据库连接串 |
| `JWT_SECRET` | - | JWT 签名密钥 |
| `REPO_ROOT` | `./repos` | 仓库存储根目录 |
| `PROXY_URL` | - | 代理地址（可选） |

PostgreSQL 连接串示例：`postgres://user:password@127.0.0.1:5432/dbname?sslmode=disable`

## 构建生产版本

```bash
# 构建当前平台
make one

# 构建所有平台
make folio

# 清理
make clean
```

## 故障排查

### Token 无效

检查 GitHub Token 是否正确，是否有 `repo` 权限。在管理后台更新 Token。

### 仓库不存在

确认仓库名称正确，私有仓库需要 Token 有访问权限。

### 数据库连接失败

检查 `.env` 中的数据库配置，确保 PostgreSQL 服务正在运行。

### 同步失败

1. 查看项目设置中的同步日志
2. 检查 GitHub API 速率限制
3. 确认 Token 权限
