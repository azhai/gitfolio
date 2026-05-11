# GitFolio 同步系统使用指南

## 快速开始

### 1. 安装和编译

```bash
# 编译所有工具
make

# 编译后的工具位于 ./bin/ 目录
ls -la ./bin/
# folio    - 主程序
# mirror   - 镜像工具
# sync     - 同步工具
# account  - 账号管理工具
```

### 2. 添加平台账号

```bash
# 添加GitHub账号
./bin/account -platform=github -username=azhai -token=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

# 添加Gitea账号
./bin/account -platform=gitea -username=azhai -token=b0c475de8a7f607f31ba8a6302730bb8e0cb8345
```

### 3. 同步仓库

```bash
# 同步GitHub仓库（包括Issues和PRs）
./bin/sync -owner=golang -repo=go -token=ghp_xxx

# 同步Gitea仓库
./bin/mirror -owner=xorm -repo=builder -prs=true -code=true
```

## 功能特性

### ✅ 已实现

1. **多平台支持**
   - GitHub（完整支持）
   - Gitea（基础支持）
   - GitFolio（待实现）
   - GitLab（待实现）

2. **数据同步**
   - 仓库信息
   - Issues
   - Pull Requests
   - 代码仓库

3. **账号管理**
   - 多平台账号
   - Token管理
   - 安全存储

4. **同步管理**
   - 同步点记录
   - 增量同步
   - 失败重试

5. **项目类型**
   - local：本地项目，无远程关联
   - mirror：镜像项目，只读同步
   - public：公开项目，可推送远程
   - private：私有项目，可推送远程

6. **角色系统**
   - 用户角色：admin、user、guest
   - 团队角色：leader（负责人）、member（成员）

### 🚧 待实现

1. **推送功能**
   - 推送到远程平台
   - 多平台同步

2. **高级功能**
   - 定时同步
   - Webhook
   - 冲突解决

## 使用示例

### 示例1：同步公开仓库

```bash
# 同步golang/go仓库
./bin/sync -owner=golang -repo=go -token=YOUR_TOKEN

# 输出：
# === Syncing golang/go from github ===
# Repository synced: go (ID: 4)
# Issues synced successfully
# Pull Requests synced successfully
# ✓ Sync completed successfully!
```

### 示例2：镜像私有仓库

```bash
# 添加账号
./bin/account -platform=github -username=yourname -token=YOUR_TOKEN

# 同步仓库
./bin/mirror -owner=yourname -repo=yourrepo -prs=true -code=true
```

### 示例3：查看同步状态

```bash
# 查询数据库
psql -d test -c "SELECT * FROM folio.sync_point;"

# 查看同步日志
psql -d test -c "SELECT * FROM folio.sync_log ORDER BY created_at DESC LIMIT 10;"
```

## 数据库查询示例

### 查看账号列表

```sql
SELECT id, platform, username, apiurl 
FROM folio.platform_account;
```

### 查看同步的仓库

```sql
SELECT id, name, project_type, is_mirror, mirror_url, last_sync_at
FROM folio.repository
WHERE is_mirror = true;
```

### 查看同步统计

```sql
SELECT 
    r.name,
    COUNT(DISTINCT i.id) as issues_count,
    COUNT(DISTINCT mr.id) as prs_count,
    r.last_sync_at
FROM folio.repository r
LEFT JOIN folio.issue i ON r.id = i.repository_id
LEFT JOIN folio.merge_request mr ON r.id = mr.repository_id
GROUP BY r.id, r.name, r.last_sync_at;
```

## 故障排查

### 问题1：Token无效

```bash
# 错误信息
GitHub API returned status 401

# 解决方法
# 检查Token是否正确，是否有足够的权限
./bin/account -platform=github -username=azhai -token=NEW_TOKEN
```

### 问题2：仓库不存在

```bash
# 错误信息
GitHub API returned status 404

# 解决方法
# 检查仓库名称是否正确
# 如果是私有仓库，确保Token有访问权限
```

### 问题3：数据库连接失败

```bash
# 错误信息
Failed to init database: connection refused

# 解决方法
# 检查数据库配置
cat .env | grep DB_

# 测试数据库连接
psql -h 127.0.0.1 -U dba -d test
```

## 最佳实践

1. **Token管理**
   - 使用最小权限原则
   - 定期更新Token
   - 不要提交Token到代码库

2. **同步策略**
   - 首次同步使用完整同步
   - 后续使用增量同步
   - 设置合理的同步间隔

3. **错误处理**
   - 查看同步日志
   - 检查网络连接
   - 验证Token权限

## 更多信息

详细文档请查看：
- [完整功能文档](./docs/SYNC_SYSTEM.md)
- [API文档](./docs/API.md)（待实现）
- [开发指南](./docs/DEVELOPMENT.md)（待实现）
