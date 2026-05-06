# Bulma + 马卡龙蓝前端重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking。

**Goal:** 用 Bulma CSS 框架和马卡龙蓝配色全面重构 GitFolio 前端 UI，首页改为 4-Tab 布局（活动/项目/片段/用户）

**Architecture:** 引入 Bulma CDN，用其原生组件类替换全部自定义 CSS。通过覆盖 Bulma CSS 变量实现马卡龙蓝主题。Layout 从 Sidebar+TopBar 改为 Bulma Navbar + 左侧菜单。首页 Dashboard 重写为 4 个 Tab 页签。所有子页面统一使用 Bulma 的 card/box/table/form/button 等组件风格。

**Tech Stack:** Mithril.js (SPA), Bulma 0.9.x (CDN), Font Awesome, highlight.js

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `web/index-spa.html` | 修改 | 添加 Bulma CDN 引入 |
| `web/styles.css` | 重写 | 删除旧样式，保留 Bulma 覆盖变量 + 特殊组件样式 |
| `web/src/components.js` | 重写 | Layout/TopBar/Sidebar → Bulma Navbar + 新组件 |
| `web/src/pages/dashboard.js` | 重写 | 4-Tab 首页（活动/项目/片段/用户） |
| `web/src/pages/projects.js` | 修改 | Bulma 卡片列表 |
| `web/src/pages/project-detail.js` | 修改 | Bulma tabs + content |
| `web/src/pages/settings.js` | 修改 | Bulma form 样式 |
| `web/src/pages/snippets.js` | 修改 | Bulma 卡片 |
| `web/src/pages/user-profile.js` | 修改 | Bulma media-object |
| `web/src/pages/login.js` | 修改 | Bulma hero + form |
| `web/src/pages/*.js` (其余) | 修改 | 统一 Bulma 风格 |
| `web/src/app.js` | 微调 | 路由保持不变 |
| `web/app-spa.js` | 重新构建 | 编译产物 |

---

### Task 1: 添加 Bulma CDN 和马卡龙蓝主题

**Files:**
- Modify: `web/index-spa.html`
- Rewrite: `web/styles.css`

- [ ] **Step 1: 在 index-spa.html 中添加 Bulma CDN**

在 `<head>` 中现有 stylesheet 之后添加：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css">
```

- [ ] **Step 2: 重写 styles.css 为马卡龙蓝主题覆盖**

完全重写 `styles.css`，内容为：

```css
:root {
    --macaron-blue: #89CFF0;
    --macaron-blue-light: #B8E4F9;
    --macaron-blue-dark: #5BA3C9;
    --macaron-link: #4A90D9;
    --macaron-info: #87CEEB;
}

html, body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background-color: #f5f7fa;
    min-height: 100vh;
}

/* 覆盖 Bulma 主色为马卡龙蓝 */
.hero.is-primary {
    background-color: var(--macaron-blue) !important;
}
.button.is-primary {
    background-color: var(--macaron-blue-dark);
    border-color: transparent;
}
.button.is-primary:hover {
    background-color: var(--macaron-blue);
}
.tabs li.is-active a {
    border-bottom-color: var(--macaron-blue-dark);
    color: var(--macaron-blue-dark);
}
.navbar.is-primary {
    background-color: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.06);
}
.navbar-item.is-active {
    color: var(--macaron-blue-dark) !important;
}
a {
    color: var(--macaron-link);
}
a:hover {
    color: var(--macaron-blue-dark);
}

/* Card 增强 */
.card {
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(137,207,240,0.12);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(137,207,240,0.2);
}

/* Tab 内容区 */
.tab-content {
    padding: 1.5rem 0;
}

/* Activity 时间线 */
.activity-timeline {
    position: relative;
    padding-left: 1.5rem;
}
.activity-timeline::before {
    content: '';
    position: absolute;
    left: 6px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #e8eef3;
}
.activity-item {
    position: relative;
    margin-bottom: 1.25rem;
}
.activity-item::before {
    content: '';
    position: absolute;
    left: -1.35rem;
    top: 0.4rem;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--macaron-blue);
    border: 2px solid white;
}

/* Snippet 代码预览 */
.snippet-preview {
    background: #f8f9fa;
    border-radius: 6px;
    padding: 0.75rem;
    font-size: 0.85rem;
    overflow-x: auto;
    max-height: 120px;
}

/* User profile card */
.user-card .media-content {
    overflow: hidden;
}
.user-card .user-bio {
    color: #666;
    font-size: 0.9rem;
    margin-top: 0.25rem;
}

/* Sidebar 菜单 */
.menu-list a {
    border-radius: 8px;
    margin-bottom: 2px;
}
.menu-list a.is-active {
    background-color: var(--macaron-blue-light);
    color: var(--macaron-blue-dark);
    font-weight: 600;
}
.menu-list a:hover {
    background-color: #f0f7fc;
}

/* Form 样式微调 */
.input:focus, .textarea:focus {
    border-color: var(--macaron-blue);
    box-shadow: 0 0 0 0.125em rgba(137,207,240,0.25);
}

/* Badge / Tag */
.tag.is-info {
    background-color: var(--macaron-info);
    color: #1a5276;
}

/* Loading */
.loading-overlay {
    position: fixed;
    inset: 0;
    background: rgba(255,255,255,0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
}

/* Empty state */
.empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #999;
}
.empty-state i {
    font-size: 3rem;
    margin-bottom: 1rem;
    color: #ccc;
}

/* Responsive */
@media screen and (max-width: 1023px) {
    .sidebar-menu {
        display: none;
    }
}
```

- [ ] **Step 3: 验证 Bulma 加载成功**

刷新浏览器控制台确认无报错，Bulma 类可用。

---

### Task 2: 重写核心布局组件 (Layout/Navbar/Sidebar)

**Files:**
- Rewrite: `web/src/components.js`

- [ ] **Step 1: 重写 Layout 组件为 Bulma 结构**

将整个 `components.js` 中的 Layout、TopBar、Sidebar 替换为 Bulma 风格。核心结构：

```javascript
const Layout = {
    view(vnode) {
        return m('div', [
            m(Navbar),
            m('section.section', { style: 'padding-top: 1rem;' }, [
                m('div.container', [
                    m('div.columns', [
                        m('div.column.is-narrow.sidebar-column', { style: 'display: block;' }, [
                            m(SidebarMenu)
                        ]),
                        m('div.column', vnode.children)
                    ])
                ])
            ]),
            m(Footer)
        ]);
    }
};
```

- [ ] **Step 2: 重写 Navbar 组件**

```javascript
const Navbar = {
    view() {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        return m('nav.navbar.is-white', { role: 'navigation', 'aria-label': 'main navigation' }, [
            m('div.navbar-brand', [
                m('a.navbar-item', { href: '/', oncreate: m.route.link }, [
                    m('span.icon-text', [
                        m('span.icon', m('i.fas.fa-code-branch')),
                        m('strong', { style: 'color: var(--macaron-blue-dark);' }, 'GitFolio')
                    ])
                ]),
                m('a.navbar-burger', {
                    class: 'burger',
                    onclick: () => {
                        const el = document.querySelector('.navbar-burger');
                        const menu = document.querySelector('.navbar-menu');
                        el.classList.toggle('is-active');
                        menu.classList.toggle('is-active');
                    }
                }, [
                    m('span'), m('span'), m('span')
                ])
            ]),
            m('div.navbar-menu#navMenu', [
                m('div.navbar-end', [
                    m('div.navbar-item', [
                        m('div.field.has-addons', [
                            m('div.control', [
                                m('input.input.is-rounded.is-small', {
                                    type: 'text', placeholder: '搜索...',
                                    style: 'width: 200px;'
                                })
                            ])
                        ])
                    ]),
                    Auth.isAuthenticated() ? [
                        m('a.navbar-item', { href: '/activity', oncreate: m.route.link }, [
                            m('span.icon', m('i.fas.fa-bell'))
                        ]),
                        m('a.navbar-item.dropdown', [
                            m('figure.image.is-24x24', [
                                m('img.is-rounded', { src: '/images/avatar-32.svg', alt: 'avatar' })
                            ]),
                            m('span', user?.username || 'User'),
                            m('span.icon.is-small', m('i.fas.fa-chevron-down'))
                        ])
                    ] : m('a.navbar-item', { href: '/login', oncreate: m.route.link }, '登录')
                ])
            ])
        ]);
    }
};
```

- [ ] **Step 3: 重写 SidebarMenu 组件**

```javascript
const SidebarMenu = {
    view() {
        const currentRoute = m.route.get();
        const items = [
            { icon: 'fa-home', label: '首页', href: '/' },
            { icon: 'fa-folder', label: '项目', href: '/projects' },
            { icon: 'fa-bolt', label: '活动', href: '/activity' },
            { icon: 'fa-code', label: '片段', href: '/snippets' },
            { icon: 'fa-users', label: '用户', href: '/users' },
            { icon: 'fa-cog', label: '设置', href: '/settings/ryan/zenc' },
        ];
        return m('aside.menu.sidebar-menu', { style: 'min-width: 200px; padding-right: 1rem;' }, [
            m('p.menu-label', '导航'),
            m('ul.menu-list', items.map(item =>
                m('li', m('a', {
                    href: item.href,
                    oncreate: m.route.link,
                    class: currentRoute === item.href || currentRoute.startsWith(item.href + '/') ? 'is-active' : ''
                }, [
                    m('span.icon.is-small', m(`i.fas.${item.icon}`)),
                    m('span', item.label)
                ]))
            ))
        ]);
    }
};
```

- [ ] **Step 4: 添加 Footer 组件**

```javascript
const Footer = {
    view() {
        return m('footer.footer', { style: 'padding: 1rem 1.5rem; background: transparent;' }, [
            m('div.content.has-text-centered', [
                m('p', { style: 'font-size: 0.8rem; color: #aaa;' },
                    'GitFolio © 2026 · Built with Mithril + Bulma')
            ])
        ]);
    }
};
```

- [ ] **Step 5: 重写通用组件 (Loading/EmptyState/Pagination)**

```javascript
const Loading = {
    view() {
        return m('div.loading-overlay', [
            m('button.button.is-loading.is-large.is-primary', { style: 'border: none; background: transparent;' })
        ]);
    }
};

const EmptyState = {
    view(vnode) {
        const { message, icon } = vnode.attrs;
        return m('div.empty-state', [
            m(`i.fas.${icon || 'fa-inbox'}`),
            m('p', message || '暂无数据')
        ]);
    }
};
```

- [ ] **Step 6: 重写 ProjectCard 为 Bulma Card**

```javascript
const ProjectCard = {
    view(vnode) {
        const { project } = vnode.attrs;
        return m('div.card', { style: 'margin-bottom: 1rem;' }, [
            m('div.card-content', [
                m('div.media', [
                    m('div.media-left', [
                        m('span.icon.is-medium.has-text-primary', m(`i.fas.${project.project_type === 'mirror' ? 'fa-clone' : 'fa-laptop-code'}`))
                    ]),
                    m('div.media-content', [
                        m('p.title.is-6', m('a', {
                            href: `/project/${project.owner}/${project.name}`,
                            oncreate: m.route.link,
                            style: 'color: inherit;'
                        }, project.name)),
                        m('p.subtitle.is-7', { style: 'color: #888;' },
                            project.description || '暂无描述'
                        )
                    ])
                ]),
                m('div.level.is-mobile', { style: 'margin-top: 0.75rem;' }, [
                    m('div.level-left', [
                        m('span.icon-text.is-small', [m('span.icon.is-small', m('i.fas.fa-star')), m('span', String(project.stars_count || 0))]),
                        m('span.icon-text.is-small', [m('span.icon.is-small', m('i.fas.fa-code-branch')), m('span', String(project.forks_count || 0))])
                    ]),
                    m('div.level-right', [
                        m('span.tag.is-rounded.is-light.is-small', project.is_private ? '私有' : '公开')
                    ])
                ])
            ])
        ]);
    }
};
```

---

### Task 3: 重写首页 Dashboard（4-Tab 布局）

**Files:**
- Rewrite: `web/src/pages/dashboard.js`

- [ ] **Step 1: 重写 Dashboard 为 4-Tab 页面**

完整重写 `dashboard.js`：

```javascript
import { Layout, Loading, EmptyState, ProjectCard } from '../components.js';
import { RepositoryService, IssueService, PullRequestService, ActivityService, SnippetService, UserService } from '../api.js';

const TABS = [
    { id: 'activities', icon: 'fa-bolt', label: '活动' },
    { id: 'projects', icon: 'fa-folder', label: '项目' },
    { id: 'snippets', icon: 'fa-code', label: '片段' },
    { id: 'users', icon: 'fa-users', label: '用户' }
];

const Dashboard = {
    oninit(vnode) {
        vnode.state.activeTab = 'activities';
        vnode.state.activities = [];
        vnode.state.projects = [];
        vnode.state.snippets = [];
        vnode.state.users = [];
        vnode.state.loading = {};
        TABS.forEach(tab => { vnode.state.loading[tab.id] = true; });

        Dashboard.loadActivities(vnode);
        Dashboard.loadProjects(vnode);
        Dashboard.loadSnippets(vnode);
        Dashboard.loadUsers(vnode);
    },

    loadActivities(vnode) {
        ActivityService.list(1, 20).then(result => {
            vnode.state.activities = result.data || [];
            vnode.state.loading.activities = false;
            m.redraw();
        }).catch(() => { vnode.state.loading.activities = false; m.redraw(); });
    },

    loadProjects(vnode) {
        RepositoryService.list().then(result => {
            let projects = result.data || [];
            projects.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            vnode.state.projects = projects;
            vnode.state.loading.projects = false;
            m.redraw();
        }).catch(() => { vnode.state.loading.projects = false; m.redraw(); });
    },

    loadSnippets(vnode) {
        SnippetService.list(1, 20).then(result => {
            vnode.state.snippets = result.data || [];
            vnode.state.loading.snippets = false;
            m.redraw();
        }).catch(() => { vnode.state.loading.snippets = false; m.redraw(); });
    },

    loadUsers(vnode) {
        UserService.list && UserService.list(1, 20).then(result => {
            vnode.state.users = result.data || [];
            vnode.state.loading.users = false;
            m.redraw();
        }).catch(() => { vnode.state.loading.users = false; m.redraw(); });
    },

    formatTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const diff = Date.now() - date.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return '刚刚';
        if (mins < 60) return mins + ' 分钟前';
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + ' 小时前';
        const days = Math.floor(hrs / 24);
        if (days < 30) return days + ' 天前';
        return date.toLocaleDateString('zh-CN');
    },

    getActivityIcon(type) {
        return ({ push: 'fa-upload', star: 'fa-star', issue: 'fa-exclamation-circle', pr: 'fa-code-pull-request', create_repo: 'fa-plus-circle', comment: 'fa-comment' }[type]) || 'fa-circle';
    },

    view(vnode) {
        const { activeTab, activities, projects, snippets, users, loading } = vnode.state;

        return m(Layout, [
            m('div.dashboard-page', [
                m('div.level', [
                    m('div.level-left', [
                        m('h1.title', 'GitFolio'),
                        m('p.subtitle', '个人最近的活动与任务')
                    ]),
                    m('div.level-right', [
                        m('div.field.is-grouped', [
                            m('p.control', m('a.button.is-primary.is-small', { href: '/projects/new', oncreate: m.route.link }, [
                                m('span.icon.is-small', m('i.fas.fa-plus')), ' 新建项目'
                            ])),
                            m('p.control', m('a.button.is-light.is-small', { href: '/snippets/new', oncreate: m.route.link }, [
                                m('span.icon.is-small', m('i.fas.fa-code')), ' 新建片段'
                            ]))
                        ])
                    ])
                ]),

                m('div.tabs.is-boxed', { style: 'margin-top: 1rem;' }, [
                    m('ul', TABS.map(tab =>
                        m('li', { class: activeTab === tab.id ? 'is-active' : '' }, m('a', {
                            onclick: () => { vnode.state.activeTab = tab.id; m.redraw(); }
                        }, [
                            m('span.icon.is-small', m(`i.fas.${tab.icon}`)),
                            m('span', tab.label),
                            loading[tab.id] === true ? m('span.icon.is-small', m('i.fas.fa-spinner.fa-spin')) : null
                        ]))
                    ))
                ]),

                m('div.tab-content', loading[activeTab] === true ? m(Loading) :
                    activeTab === 'activities' ? Dashboard.renderActivities(vnode) :
                    activeTab === 'projects' ? Dashboard.renderProjects(vnode) :
                    activeTab === 'snippets' ? Dashboard.renderSnippets(vnode) :
                    Dashboard.renderUsers(vnode)
                )
            ])
        ]);
    },

    renderActivities(vnode) {
        const { activities } = vnode.state;
        if (!activities.length) return m(EmptyState, { message: '暂无活动记录', icon: 'fa-bolt' });
        return m('div.activity-timeline', activities.map(act =>
            m('div.activity-item', m('div.box', { style: 'margin-bottom: 0.75rem; padding: 1rem;' }, [
                m('div.media', [
                    m('div.media-left', [
                        m('span.icon.has-text-primary', m(`i.fas.${Dashboard.getActivityIcon(act.activity_type)}`))
                    ]),
                    m('div.media-content', [
                        m('p', [
                            act.username ? m('strong', act.username) : '未知用户',
                            m('span', { style: 'color: #666; margin-left: 0.5rem;' }, act.title || '进行了操作')
                        ]),
                        act.repository ? m('p.is-size-7', [
                            m('a', { href: '#', onclick: e => { e.preventDefault(); } }, act.repository)
                        ]) : null,
                        act.content ? m('p.is-size-7', { style: 'color: #888;' }, act.content) : null,
                        m('p.is-size-7', { style: 'color: #aaa; margin-top: 0.25rem;' }, Dashboard.formatTime(act.created_at))
                    ])
                ])
            ])))
        );
    },

    renderProjects(vnode) {
        const { projects } = vnode.state;
        if (!projects.length) return m(EmptyState, { message: '暂无项目', icon: 'fa-folder' });
        return m('div.columns.is-multiline', projects.map(p =>
            m('div.column.is-one-third', m(ProjectCard, { project: p }))
        ));
    },

    renderSnippets(vnode) {
        const { snippets } = vnode.state;
        if (!snippets.length) return m(EmptyState, { message: '暂无片段', icon: 'fa-code' });
        return m('div.columns.is-multiline', snippets.map(s =>
            m('div.column.is-one-third', m('div.card', { style: 'margin-bottom: 1rem;', onclick: () => m.route.set('/snippets/' + s.id) }, [
                m('div.card-content', [
                    m('p.title.is-6', s.title),
                    s.language ? m('span.tag.is-rounded.is-light.is-info', s.language) : null,
                    s.description ? m('p.is-size-7', { style: 'color: #666; margin-top: 0.5rem;' }, s.description) : null,
                    m('div.level.is-mobile', { style: 'margin-top: 0.75rem;' }, [
                        m('div.level-left', [
                            m('span.is-size-7.has-text-grey', s.username || '')
                        ]),
                        m('div.level-right', [
                            m('span.is-size-7.has-text-grey-light', Dashboard.formatTime(s.created_at))
                        ])
                    ])
                ])
            ]))
        ));
    },

    renderUsers(vnode) {
        const { users } = vnode.state;
        if (!users.length) return m(EmptyState, { message: '暂无用户', icon: 'fa-users' });
        return m('div.columns.is-multiline', users.map(u =>
            m('div.column.is-one-quarter', m('div.card.user-card', { style: 'margin-bottom: 1rem;' }, [
                m('div.card-content', [
                    m('div.media', [
                        m('div.media-left', [
                            u.avatar_url
                                ? m('figure.image.is-48x48', m('img.is-rounded', { src: u.avatar_url }))
                                : m('div.has-background-primary.has-text-white.is-flex.is-justify-content-center.is-align-items-center', {
                                    style: 'width: 48px; height: 48px; border-radius: 50%; font-size: 1.2rem;'
                                  }, (u.full_name || u.username || '?')[0].toUpperCase())
                        ]),
                        m('div.media-content', [
                            m('p.title.is-6', m('a', { href: '/user/' + u.username, oncreate: m.route.link, style: 'color: inherit;' },
                                u.full_name || u.username)),
                            m('p.subtitle.is-7.user-bio', '@' + (u.username || '')),
                            u.bio ? m('p.is-size-7.user-bio', u.bio) : null,
                            u.is_admin ? m('span.tag.is-small.is-danger', '管理员') : null
                        ])
                    ])
                ])
            ]))
        ));
    }
};

export { Dashboard };
```

---

### Task 4: 改造子页面 - Projects 列表页

**Files:**
- Modify: `web/src/pages/projects.js`

- [ ] **Step 1: 用 Bulma classes 重写 ProjectList 视图**

将 `.projects-page`, `.page-header`, `.project-card` 等自定义类替换为 Bulma 的 `.section`, `.title`, `.card`, `.columns` 等。关键改动：
- 页面容器：`.projects-page` → `m('div.section')` 
- 头部：`.page-header` → `m('div.level')` + `m('h1.title')`
- 工具栏 filter-tabs → `m('div.tabs')` 或 `m('div.field.is-grouped')`
- 项目卡片 → 使用已重写的 `ProjectCard` 组件
- 排序：按 `updated_at` DESC（默认行为）

---

### Task 5: 改造子页面 - Settings 设置页

**Files:**
- Modify: `web/src/pages/settings.js`

- [ ] **Step 1: 用 Bulma form 组件重写设置表单**

关键改动：
- `.settings-section` → `m('div.section')` 或 `m('div.box')`
- `.form-group` → 保持但加 `.field` class
- `.form-input` → `.input`
- `.form-label` → `.label`
- 按钮：使用 `.button.is-primary`, `.button.is-secondary` (→ `.is-light`)
- 推送区域保持之前的「保存」+「全部推送」两个按钮布局

---

### Task 6: 改造子页面 - Login 登录页

**Files:**
- Modify: `web/src/pages/login.js`

- [ ] **Step 1: 用 Bulma hero + form 重写登录页**

```javascript
// 使用 hero + columns 居中布局
return m('section.section', [
    m('div.columns.is-centered', [
        m('div.column.is-one-third', m('div.box', [
            m('h1.title.has-text-centered', '登录 GitFolio'),
            m('form', [...])
        ]))
    ])
]);
```

---

### Task 7: 改造子页面 - Snippets 片段页

**Files:**
- Modify: `web/src/pages/snippets.js`

- [ ] **Step 1: 用 Bulma cards 重写片段列表和详情**

- 列表：`.snippets-list` → `m('div.columns.is-multiline')` + `.column.is-one-third` + `.card`
- 详情：使用 `.box` 包裹代码预览区

---

### Task 8: 改造子页面 - UserProfile 用户页

**Files:**
- Modify: `web/src/pages/user-profile.js`

- [ ] **Step 1: 用 Bulma media-object 重写用户资料页**

- 头像区：`.profile-header-card` → `m('div.hero-body')` 或 `m('div.box')` + media object
- 编辑面板：`.profile-edit-panel` → `m('div.box')` + `.field` + `.input`

---

### Task 9: 改造其余子页面

**Files:**
- Modify: `web/src/pages/activities.js` — 可简化或删除（功能已合并到 Dashboard Tab）
- Modify: `web/src/pages/issues.js` — Bulma table/card
- Modify: `web/src/pages/pull-requests.js` — Bulma table/card
- Modify: `web/src/pages/task-detail.js`, `new-task.js` — Bulma form
- Modify: `web/src/pages/groups.js` — Bulma cards
- Modify: `web/src/pages/commits.js` — Bulma timeline
- Modify: `web/src/pages/releases-stats.js` — Bulma content
- Modify: `web/src/pages/milestones.js` — Bulma content
- Modify: `web/src/pages/user-management.js` — Bulma table
- Modify: `web/src/pages/create-project.js`, `migrate-project.js` — Bulma form
- Modify: `web/src/pages/issue-detail.js`, `pr-detail.js` — Bulma layout
- Modify: `web/src/pages/new-issue.js`, `new-pr.js` — Bulma form
- Modify: `web/src/pages/placeholder.js` — Bulma empty state

每个页面的通用改造模式：
1. 外层容器 → `m('div.section')` 或 `m('div.container')`
2. 页面标题 → `m('div.level')` + `m('h1.title')`
3. 表单元素 → `.field` > `.label` + `.input/.textarea` + `.help`
4. 卡片列表 → `.columns.is-multiline` > `.column` > `.card`
5. 数据表格 → `.table.is-fullwidth.is-hoverable`
6. 按钮 → `.button.is-primary/.is-light/.is-danger`
7. 徽章/tag → `.tag.is-rounded.is-light`

---

### Task 10: 构建验证和测试

**Files:**
- Build: `web/scripts/build-frontend-node.js`
- Output: `web/app-spa.js`

- [ ] **Step 1: 运行前端构建脚本**

```bash
cd /Users/ryan/projects/gitfolio/web && node scripts/build-frontend-node.js
```

- [ ] **Step 2: 检查构建产物无语法错误**

- [ ] **Step 3: 启动后端服务并在浏览器中验证**

```bash
cd /Users/ryan/projects/gitfolio && go build -o gitfolio . && ./gitfolio
```

浏览器访问 `http://127.0.0.1:3000` 验证：
- Navbar 显示正常，马卡龙蓝色调
- 侧边菜单可点击切换
- 首页 4 个 Tab 可切换，内容正确显示
- 项目按更新时间降序排列
- 子页面路由正常工作

- [ ] **Step 4: 修复发现的问题并重新构建**
