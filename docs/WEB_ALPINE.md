# 前端：静态页面 + Alpine.js

React 已移除，前端是一组静态 HTML 页面 + Alpine.js 组件，没有打包和转译步骤。
`web/pages/*.html` 和 `web/assets/**` 由 `node web/scripts/build.mjs` 原样复制到
`web/dist/`，Go 用 `embed` 把 `web/dist` 编进二进制。

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
    js/icons.js     由 scripts/vendor.mjs 从 lucide 生成，勿手改
    js/model.js     项目类型、任务状态等展示元数据
    js/pages/*.js   每个页面一个 Alpine 组件模块
    lib/            alpine / marked / prism / sortable（从 node_modules 复制）
  scripts/vendor.mjs  把依赖产物复制到 assets/lib，并按需生成图标集
  scripts/build.mjs   复制到 dist；--watch 时监听改动
  public/             favicon 等静态资源
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
| `/snippets`, `/snippets/:id/edit` | `snippets.html` |
| `/users`, `/users/:username` | `users.html` |
| `/admin` | `admin.html` |
| `/settings` | `settings.html` |
| 其余两段及以上路径（`/:owner/:repo/...`） | `project.html` |

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

运行时库只有四个：Alpine 3.17、marked（Markdown）、Prism（代码高亮）、
SortableJS（拖拽排序）。它们被复制到 `web/assets/lib/` 并随仓库提交，
因此**部署不需要 Node**。

升级依赖：

```bash
cd web && pnpm update && pnpm run vendor && pnpm run build
```

`vendor.mjs` 只复制用到的产物，并按 `ICON_SLUGS` 把 lucide 图标烘成
`assets/js/icons.js`（71 个图标约 12KB，而不是整包 460KB）。

## 开发

```bash
./build-frontend.sh dev     # 监听 web/{pages,assets,public}，改动即复制到 dist
go run .                    # 另一个终端；Go 内嵌的是 dist
```

改完记得重启 Go 进程，`embed` 在编译期取值。

## 迁移状态

已迁移：登录、仪表盘、项目、团队、动态、片段、用户、设置、管理后台，以及
项目工作区（文件树/文件查看/README、提交、分支、议题、合并请求）。

尚未迁移（旧 React 里的能力）：仓库设置与同步面板、议题/PR 详情页与新建页、
提交详情、任务看板、Git 工作流（暂存/提交/交互式 rebase/stash/行级暂存）、
文件编辑、分支/标签管理、统计页。这些 URL 目前会落到 `project.html` 但只显示
对应列表或空态。旧的 React 源码仍在 `web/src/`（不参与构建），全部迁移完成后删除。
