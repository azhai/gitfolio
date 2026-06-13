# API 文档

所有 API 路径前缀为 `/api/v1`。需要认证的接口需在 Header 中携带 `Authorization: Bearer <token>`。

## 认证

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/auth/login` | 登录 | - |
| POST | `/auth/logout` | 登出 | ✓ |

## 用户

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

## 仓库

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/repos` | 仓库列表 | 可选 |
| POST | `/repos` | 创建仓库 | ✓ |
| GET | `/repos/github-info` | GitHub 仓库信息 | - |
| GET | `/:owner/:repo` | 仓库详情 | 可选 |
| PUT | `/:owner/:repo` | 更新仓库 | ✓ |
| DELETE | `/:owner/:repo` | 删除仓库 | ✓ |
| POST | `/:owner/:repo/transfer` | 转移仓库 | ✓ |

## Git 操作

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

## 仓库同步

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/:owner/:repo/sync/pull` | 拉取同步 | ✓ |
| POST | `/:owner/:repo/sync/issues` | 同步 Issue/PR | ✓ |
| POST | `/:owner/:repo/sync/push` | 推送同步 | ✓ |
| GET | `/:owner/:repo/sync/config` | 获取同步配置 | ✓ |
| PUT | `/:owner/:repo/sync/config` | 更新同步配置 | ✓ |
| GET | `/:owner/:repo/sync/logs` | 同步日志 | ✓ |
| POST | `/:owner/:repo/refresh-stats` | 刷新统计 | ✓ |

## Star / Watch

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/:owner/:repo/star` | Star 仓库 | ✓ |
| DELETE | `/:owner/:repo/star` | 取消 Star | ✓ |
| POST | `/:owner/:repo/watch` | Watch 仓库 | ✓ |
| DELETE | `/:owner/:repo/watch` | 取消 Watch | ✓ |

## Issue

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

## Pull Request

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

## 任务管理

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

## 团队/组织

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

## 活动流

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/activities` | 活动列表 | - |
| POST | `/activities` | 创建活动 | ✓ |

## 代码片段

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/snippets` | 片段列表 | - |
| POST | `/snippets` | 创建片段 | ✓ |
| GET | `/snippets/:id` | 片段详情 | - |
| PUT | `/snippets/:id` | 更新片段 | ✓ |
| DELETE | `/snippets/:id` | 删除片段 | ✓ |

## 版本发布

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/:owner/:repo/releases` | 发布列表 | - |
| GET | `/:owner/:repo/releases/:tag` | 发布详情 | - |
| POST | `/:owner/:repo/releases/sync` | 同步发布 | ✓ |

## 管理后台

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

## 通用

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/stats` | 全局统计 |
| GET | `/recent-issues` | 最近 Issue |
| GET | `/recent-tasks` | 最近任务 |
