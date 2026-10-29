# 前端：静态页面 + Alpine.js

React 已移除，前端是一组静态 HTML 页面 + Alpine.js 组件，没有打包、转译、
复制或监听步骤。Go 直接用 `embed` 把 `web/pages`、`web/assets`、`web/public`
编进二进制，`web/dist` 这种中间产物已经不存在。

## 目录

```
web/
  pages/            每个顶层路由一个 HTML 文档
    login.html  home.html  projects.html  groups.html  activity.html
    snippets.html  users.html  admin.html  settings.html
    project.html  项目工作区外壳（/owner/repo/... 全部由它渲染）
  assets/
    css/app.css     设计令牌 + 全部组件样式
    js/app.js       入口：注册 store/指令 → 挂外壳 → 加载页面模块 → Alpine.start()
    js/api.js       后端 API 客户端（纯 fetch，与框架无关）
    js/auth.js      auth store（user / isAdmin / login / logout）
    js/i18n.js      语言包与 t()、时间格式化
    js/locales/     zh.js / en.js
    js/shell.js     顶部导航、toast 宿主、确认框、页脚
    js/icon.js      内联 SVG 图标 + 按文件类型取图标
    js/icons.js     lucide 图标集（新图标按原有格式手工补）
    js/model.js     项目类型、任务状态等展示元数据
    js/pages/*.js   每个页面一个 Alpine 组件模块
    lib/            alpine / marked / microlight / sortable 预构建产物
  public/           favicon 等静态资源
```

## 路由

`main.go` 里的 `pageRoutes` 是唯一的 URL → 文档映射：

| URL | 文档 |
| --- | --- |
| `/` | `landing.html` |
| `/login` | `login.html` |
| `/home` | `home.html` |
| `/projects`, `/projects/new`, `/projects/migrate` | `projects.html` |
| `/groups`, `/groups/:name` | `groups.html` |
| `/activity` | `activity.html` |
| `/snippets`, `/snippets/:id/edit` | `snippets.html` |
| `/users`, `/users/:username` | `users.html` |
| `/admin` | `admin.html` |
| `/settings` | `settings.html` |
| 其余两段及以上路径（`/:owner/:repo/...`） | `project.html` |
| 仓库不存在或路径无法识别 | `404.html`（HTTP 404） |

子路径不再单独建文件：页面脚本自己从 `location.pathname` 取参数（见
`ui.js` 的 `projectRef()` 与 `query()`），所以 `/snippets/12/edit` 和
`/snippets` 共用一份 HTML。

## 约定

- **`<body data-page="home">`** 决定加载哪个 `js/pages/*.js`，由 `app.js` 动态 import。
- 页面模块在 import 时调用 `Alpine.data('name', () => ({...}))`，HTML 用
  `x-data="name"` 挂上。`app.js` 在 import 完成之后才 `Alpine.start()`。
- **组件对象里不要写 getter**。Alpine 的 `reactive()` 在初始化时会读取所有
  自有属性，getter 会被立即求值；一旦它抛异常，整棵组件树会静默不挂载
  （页面全白但控制台只有一条 Alpine 警告）。需要派生值就放到 `init()` 里
  算好存成普通字段，或在模板里调用方法。
- Alpine 表达式可以直接调用挂在 window 上的 `t()`、`icon()`、`fmt.*`、
  `toast()`；组件内部把需要的方法挂到返回对象上（如 `t: t`）更清晰。
- 图标用 `<span x-icon="'star'"></span>` 或 `x-icon="{ name: 'star', size: 14 }"`。
- 公共 chrome（导航/页脚/toast/确认框）由 `shell.js` 注入，页面只需
  `<div id="app-shell"></div>` 和 `<div id="app-footer"></div>` 两个占位。
- 样式一律使用 `app.css` 里的语义类（`.card`、`.btn--primary`、`.badge--green`、
  `.table`、`.tabs`…）与少量工具类；不要再引入 CSS 框架。
- `x-cloak` 用于隐藏条件渲染块，避免加载时闪现。

## 依赖与升级

运行时库只有四个：Alpine 3.17、marked（Markdown）、microlight（代码高亮，2KB）、
SortableJS（拖拽排序）。它们的产物已放在 `web/assets/lib/`，图标集
`web/assets/js/icons.js` 也已生成，全部随仓库提交。项目没有 `package.json`
或包管理器，构建、部署都不需要 Node。

升级时直接替换 `assets/lib/` 下对应的文件；新增图标需要按现有格式把 SVG
路径补进 `assets/js/icons.js`。

## 开发

构建只需要 make 和 Go：

```bash
make dev      # go run ./（http://127.0.0.1:9000）
make one      # 编译当前平台
```

改完前端文件要重新编译并重启 Go 进程：`embed` 在编译期取值，运行时读的是
编进二进制的那一份。`./build-frontend.sh` 是薄包装（`build` / `dev` / `serve`）。

## 迁移状态

React 源码与 Vite/Vitest 配置已删除。所有页面都由 `web/pages/*.html` +
`web/assets/js/pages/*.js` 渲染：登录、仪表盘、项目、团队、动态、片段、用户、
设置、管理后台，以及项目工作区——文件树/文件查看/README、新建/编辑/删除文件（仅带工作区的仓库）、
提交列表与详情、
分支、标签、发行版、统计、议题（列表/详情/新建、评论、关闭与重开）、合并请求
（列表/详情/新建、评论、合并与关闭）、任务看板（列表/新建/详情、状态流转、
评论）、项目设置（基本信息、类型转换、删除）、同步（代码同步、定时同步、日志）。

Git 工作流（`/owner/repo/changes`，仅带工作区的仓库）覆盖：已暂存/未暂存/未跟踪
三组变更、单文件差异、暂存与取消暂存（单个/全部）、丢弃变更、提交、分支切换/新建/
合并、stash 保存与取回/应用/删除、冲突与未完成操作的提示和中止。

尚未迁移：行级暂存（`/stage-patch` 按 diff 行选择）、交互式 rebase 编辑器，以及
删除提交范围 / cherry-pick / revert / reset 的图形入口——接口都在，页面没做。

## 渲染约定

- 仓库正文、README、评论都通过 `marked` 渲染，再用 `ui.js` 的 `sanitizeHtml`
  去掉脚本、事件属性和 `javascript:` 链接——内容是同步进来的外部数据。
- 组件对象里不要写 getter：Alpine 的 `reactive()` 会在 setup 阶段求值所有自有
  属性，一旦抛错整棵树静默不挂载。视图状态在 `init()` 里算好存成普通字段。
- `dated(label, value)` 为零值时间返回空串，模板用 `x-show` 绑定同一个表达式，
  避免出现「创建于 -」这种悬空文案。
