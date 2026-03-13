# 测试文档

## 测试概述

GitFolio 项目包含完整的测试套件，覆盖所有主要功能模块。

## 技术栈

- **测试框架**: Go 标准测试库
- **HTTP 测试**: Fiber v3 Test API
- **数据库**: SQLite 内存数据库 (通过 goent)
- **断言**: 自定义断言函数

## 测试统计

- **测试文件数**: 7
- **测试用例数**: 60+

## 测试文件说明

### 1. setup.go
测试辅助函数和设置，包括：
- `SetupTestRouter()`: 初始化测试 Fiber 应用和数据库
- `MakeRequest()`: 创建 HTTP 请求辅助函数（返回 `*http.Response`）
- `ReadBody()`: 读取响应体内容
- `AssertStatus()`: 断言 HTTP 状态码
- `AssertJSONHasKey()`: 断言 JSON 响应包含指定键

### 2. auth_test.go
用户认证测试，包括：
- 用户注册测试（有效/无效数据）
- 重复用户注册测试
- 用户登录测试（用户名/邮箱）
- 非激活用户登录测试
- 获取当前用户信息测试
- 未认证访问测试

### 3. repository_test.go
仓库管理测试，包括：
- 创建仓库测试（公开/私有）
- 重复仓库名称测试
- 仓库列表测试
- 获取仓库详情测试
- 私有仓库权限测试
- 更新仓库测试
- 删除仓库测试
- Star 仓库测试

### 4. issue_test.go
Issue 跟踪测试，包括：
- 创建 Issue 测试
- Issue 列表测试（打开/关闭状态）
- 获取 Issue 详情测试
- 更新 Issue 测试
- 关闭 Issue 测试
- 创建评论测试
- 获取评论列表测试

### 5. middleware_test.go
中间件测试，包括：
- Token 生成测试
- 认证中间件测试（有效/无效 token）
- 可选认证中间件测试
- 管理员权限中间件测试
- Token 过期测试
- 获取当前用户 ID 测试

### 6. integration_test.go
集成测试，包括：
- 完整用户流程测试（注册→登录→创建仓库→创建Issue→评论→关闭）
- 协作流程测试（Star→创建Issue）
- 私有仓库流程测试
- 分页功能测试
- 健康检查测试

### 7. benchmark_test.go
性能基准测试，包括：
- 用户注册性能测试
- 用户登录性能测试
- 创建仓库性能测试
- 创建 Issue 性能测试
- 仓库列表查询性能测试

## 运行测试

### 运行所有测试
```bash
make test
# 或
go test -v ./tests/...
```

### 运行特定测试
```bash
# 运行认证测试
go test -v ./tests/... -run TestUser

# 运行仓库测试
go test -v ./tests/... -run TestRepository

# 运行集成测试
go test -v ./tests/... -run TestComplete
```

### 生成覆盖率报告
```bash
make test-coverage
# 或
go test -v -coverprofile=coverage.out ./tests/...
go tool cover -html=coverage.out -o coverage.html
```

### 运行性能测试
```bash
go test -bench=. ./tests/...
```

## 测试最佳实践

1. **使用内存数据库**: 所有测试使用 SQLite 内存数据库，通过 goent 的 `:memory:` DSN 确保测试隔离和快速执行
2. **数据库初始化**: 每个测试通过 `SetupTestRouter()` 初始化独立的数据库实例
3. **表驱动测试**: 使用表驱动方式组织测试用例，提高可读性
4. **断言函数**: 使用自定义断言函数简化测试代码
5. **配置初始化**: 在测试开始时初始化必要的配置
6. **Fiber 测试 API**: 使用 `app.Test()` 方法进行 HTTP 请求测试

## 测试覆盖的功能

- ✅ 用户注册和登录
- ✅ JWT Token 认证
- ✅ 仓库 CRUD 操作
- ✅ 公开/私有仓库权限控制
- ✅ Star 和 Watch 功能
- ✅ Issue 创建和管理
- ✅ 评论系统
- ✅ 分页功能
- ✅ 完整用户流程
- ✅ 中间件功能
- ✅ 错误处理

## 持续集成

建议在 CI/CD 流程中添加测试步骤：

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-go@v2
        with:
          go-version: 1.25
      - run: go test -v -cover ./tests/...
```

## 未来改进

1. 添加更多边界情况测试
2. 增加并发测试
3. 添加 API 文档测试
4. 增加数据库事务测试
5. 添加更多性能基准测试
