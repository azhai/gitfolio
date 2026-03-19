# GitFolio - Git代码管理和同步系统

GitFolio是一个完整的Git代码管理和同步系统，支持从多个平台镜像同步仓库数据。

## 功能特性

### ✅ 已完成功能

1. **数据库模型设计**
   - 平台账号表 (platform_account)
   - 同步令牌表 (sync_token)
   - 远程仓库表 (remote_repository)
   - 同步点表 (sync_point)
   - 同步日志表 (sync_log)
   - 项目类型支持（镜像项目、持有项目、Fork项目）

2. **账号和Token管理**
   - 支持多平台账号管理（GitHub、Gitea、GitFolio、GitLab）
   - 安全存储访问令牌
   - 支持令牌过期时间和作用域管理

3. **镜像项目同步**
   - ✅ GitHub仓库同步
   - ✅ GitHub Issues同步
   - ✅ GitHub Pull Requests同步
   - ✅ Gitea仓库同步（基础支持）
   - ✅ 记录镜像源URL和最后同步时间
   - ✅ 自动创建用户账号

4. **同步点管理**
   - 记录同步状态
   - 支持增量同步
   - 失败重试机制

## 安装

```bash
# 编译所有工具
make

# 或单独编译
make mirror    # 镜像工具
make sync      # 同步工具
make account   # 账号管理工具
```

## 使用方法

### 1. 添加平台账号

```bash
# 添加GitHub账号
./bin/account -platform=github -username=azhai -token=ghp_xxx

# 添加Gitea账号
./bin/account -platform=gitea -username=azhai -token=b0c475xxx

# 查看帮助
./bin/account -help
```

### 2. 同步GitHub仓库

```bash
# 同步仓库（包括Issues和PRs）
./bin/sync -owner=golang -repo=go -token=ghp_xxx

# 只同步Issues
./bin/sync -owner=golang -repo=go -token=ghp_xxx -prs=false

# 只同步PRs
./bin/sync -owner=golang -repo=go -token=ghp_xxx -issues=false

# 查看帮助
./bin/sync -help
```

### 3. 镜像Gitea仓库

```bash
# 同步xorm/builder仓库
./bin/mirror -owner=xorm -repo=builder

# 同步仓库和PRs
./bin/mirror -owner=xorm -repo=builder -prs=true

# 同步仓库代码
./bin/mirror -owner=xorm -repo=builder -code=true

# 完整同步
./bin/mirror -owner=xorm -repo=builder -prs=true -code=true
```

## 数据库结构

### 核心表

#### platform_account (平台账号表)
```sql
id            serial PRIMARY KEY
platform      text          -- github, gitea, gitfolio, gitlab
username      text          -- 平台用户名
email         text          -- 邮箱
avatar_url    text          -- 头像URL
apiurl        text          -- API地址
is_active     boolean       -- 是否激活
user_id       integer       -- 关联的本地用户ID
```

#### sync_token (同步令牌表)
```sql
id            serial PRIMARY KEY
platform      text          -- 平台类型
name          text          -- 令牌名称
access_token  text          -- 访问令牌
refresh_token text          -- 刷新令牌
token_type    text          -- 令牌类型
expires_at    timestamp     -- 过期时间
scopes        text          -- 权限范围
account_id    integer       -- 关联账号ID
repository_id integer       -- 关联仓库ID（可选）
is_active     boolean       -- 是否激活
```

#### remote_repository (远程仓库表)
```sql
id            serial PRIMARY KEY
platform      text          -- 平台类型
owner         text          -- 仓库所有者
repo_name     text          -- 仓库名称
clone_url     text          -- 克隆URL
sshurl        text          -- SSH URL
apiurl        text          -- API URL
web_url       text          -- Web URL
repository_id integer       -- 关联的本地仓库ID
account_id    integer       -- 关联账号ID
is_primary    boolean       -- 是否主仓库
direction     text          -- pull/push/both
last_sync_at  timestamp     -- 最后同步时间
sync_enabled  boolean       -- 是否启用同步
```

#### sync_point (同步点表)
```sql
id                serial PRIMARY KEY
repository_id     integer       -- 仓库ID
remote_repo_id    integer       -- 远程仓库ID
sync_type         text          -- 同步类型
last_sync_at      timestamp     -- 最后同步时间
last_success_at   timestamp     -- 最后成功时间
last_failure_at   timestamp     -- 最后失败时间
failure_count     integer       -- 失败次数
last_commit_hash  text          -- 最后提交哈希
last_issue_number integer       -- 最后Issue编号
last_pr_number    integer       -- 最后PR编号
last_etag         text          -- ETag
last_modified     text          -- Last-Modified
next_sync_at      timestamp     -- 下次同步时间
sync_interval     integer       -- 同步间隔（秒）
last_error        text          -- 最后错误信息
is_paused         boolean       -- 是否暂停
```

#### sync_log (同步日志表)
```sql
id           serial PRIMARY KEY
sync_point_id integer       -- 同步点ID
sync_type    text           -- 同步类型
status       text           -- 状态
message      text           -- 消息
duration     bigint         -- 持续时间（毫秒）
items_synced integer        -- 同步项目数
items_failed integer        -- 失败项目数
details      text           -- 详细信息
```

## 项目类型

### 1. 镜像项目 (mirror)
- 从远程平台同步代码、Issues、PRs
- 只读，不能直接修改
- 定期自动同步

### 2. 持有项目 (owned)
- 本地创建和维护
- 可以推送到多个远程平台
- 支持多平台同步

### 3. Fork项目 (fork)
- 从其他项目Fork
- 可以提交Pull Request
- 保持与上游同步

## 配置文件

环境变量配置 (`.env`):

```bash
# Server Configuration
APP_MODE=debug
SERVER_PORT=3000
BASE_URL=http://127.0.0.1:3000

# Database Configuration
DB_TYPE=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=dba
DB_PASSWORD=pass
DB_NAME=test

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
SESSION_SECRET=your-session-secret-key
TOKEN_EXPIRY=24

# Repository Storage
REPO_ROOT=./repos
```

## API端点（待实现）

### 账号管理
- `GET /api/accounts` - 获取账号列表
- `POST /api/accounts` - 创建账号
- `PUT /api/accounts/:id` - 更新账号
- `DELETE /api/accounts/:id` - 删除账号

### 同步管理
- `POST /api/sync/repo` - 同步仓库
- `GET /api/sync/status/:id` - 获取同步状态
- `POST /api/sync/pause/:id` - 暂停同步
- `POST /api/sync/resume/:id` - 恢复同步

### 同步点管理
- `GET /api/sync-points` - 获取同步点列表
- `GET /api/sync-points/:id/logs` - 获取同步日志
- `PUT /api/sync-points/:id` - 更新同步点配置

## 待实现功能

### 高优先级
- [ ] 实现持有项目的推送功能
- [ ] 完善Gitea同步功能
- [ ] 实现GitFolio平台间同步
- [ ] 创建Web管理界面

### 中优先级
- [ ] 实现定时自动同步
- [ ] 添加Webhook支持
- [ ] 实现冲突解决机制
- [ ] 添加同步进度显示

### 低优先级
- [ ] 支持GitLab平台
- [ ] 实现代码审查功能
- [ ] 添加CI/CD集成
- [ ] 实现团队协作功能

## 开发指南

### 添加新平台支持

1. 在 `models/models.go` 中添加平台常量
2. 在 `services/sync_service.go` 中实现同步方法
3. 在 `cmd/sync/main.go` 中添加平台分支
4. 更新文档

### 运行测试

```bash
# 运行所有测试
go test ./...

# 运行特定包的测试
go test ./services
```

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！
