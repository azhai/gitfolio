import { Auth } from './api.js';

const Layout = {
    view(vnode) {
        return m('div.app-container', [
            m(TopBar),
            m('div.main-container', [
                m(Sidebar),
                m('main.content', vnode.children)
            ])
        ]);
    }
};

const TopBar = {
    view() {
        return m('header.top-bar', [
            m('div.top-bar-left', [
                m('button.menu-toggle', {
                    onclick: () => {
                        Sidebar.isCollapsed = !Sidebar.isCollapsed;
                        localStorage.setItem('sidebarCollapsed', Sidebar.isCollapsed);
                        m.redraw();
                    }
                }, m('i.fas.fa-bars')),
                m('a.logo', { href: '/', oncreate: m.route.link }, [
                    m('i.fas.fa-code-branch'),
                    m('span', 'GitFolio')
                ]),
                m('div.search-box', [
                    m('i.fas.fa-search'),
                    m('input[type=text][placeholder=搜索项目、Issue、PR...]')
                ])
            ]),
            m('div.top-bar-right', [
                m('button.icon-btn', m('i.fas.fa-plus')),
                m('button.icon-btn', [
                    m('i.fas.fa-bell'),
                    m('span.badge', '3')
                ]),
                Auth.isAuthenticated() ? 
                    m('div.user-menu', [
                        m('div.user-menu-header', { 
                            onclick: (e) => {
                                e.stopPropagation();
                                const dropdown = document.querySelector('.user-dropdown');
                                if (dropdown) dropdown.classList.toggle('show');
                            }
                        }, [
                            m('img.avatar', { src: '/images/avatar-32.svg', alt: '用户头像' }),
                            m('span.username', 'ryan'),
                            m('i.fas.fa-chevron-down')
                        ]),
                        m('div.user-dropdown', [
                            m('a.dropdown-item', { 
                                href: '/settings',
                                oncreate: m.route.link 
                            }, [
                                m('i.fas.fa-cog'),
                                ' 设置'
                            ]),
                            m('a.dropdown-item', { 
                                href: '#',
                                onclick: (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    Auth.logout().then(() => {
                                        m.route.set('/login');
                                    });
                                }
                            }, [
                                m('i.fas.fa-sign-out-alt'),
                                ' 退出登录'
                            ])
                        ])
                    ]) :
                    m('a.btn.btn-primary.btn-sm', { 
                        href: '/login',
                        oncreate: m.route.link 
                    }, '登录')
            ])
        ]);
    }
};

const Sidebar = {
    isCollapsed: false,
    oninit() {
        Sidebar.isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    },
    view() {
        const currentRoute = m.route.get();
        
        return m('aside.sidebar#sidebar', {
            class: Sidebar.isCollapsed ? 'collapsed' : ''
        }, [
            m('nav.sidebar-nav', [
                m('div.nav-section', [
                    m('a.nav-item', { 
                        href: '/', 
                        oncreate: m.route.link,
                        class: currentRoute === '/' ? 'active' : ''
                    }, [
                        m('i.fas.fa-home'),
                        !Sidebar.isCollapsed ? m('span', '总览') : null
                    ]),
                    m('a.nav-item', { 
                        href: '/projects', 
                        oncreate: m.route.link,
                        class: currentRoute.startsWith('/projects') ? 'active' : ''
                    }, [
                        m('i.fas.fa-folder'),
                        !Sidebar.isCollapsed ? m('span', '项目') : null
                    ]),
                    m('a.nav-item', { 
                        href: '/groups', 
                        oncreate: m.route.link,
                        class: currentRoute === '/groups' ? 'active' : ''
                    }, [
                        m('i.fas.fa-users'),
                        !Sidebar.isCollapsed ? m('span', '团队') : null
                    ]),
                    m('a.nav-item', { 
                        href: '/activity', 
                        oncreate: m.route.link,
                        class: currentRoute === '/activity' ? 'active' : ''
                    }, [
                        m('i.fas.fa-chart-line'),
                        !Sidebar.isCollapsed ? m('span', '活动') : null
                    ]),
                    m('a.nav-item', { 
                        href: '/snippets', 
                        oncreate: m.route.link,
                        class: currentRoute === '/snippets' ? 'active' : ''
                    }, [
                        m('i.fas.fa-code'),
                        !Sidebar.isCollapsed ? m('span', '片段') : null
                    ])
                ])
            ])
        ]);
    }
};

const ProjectHeader = {
    view(vnode) {
        const { owner, repo: repoObj, description, stars, forks, visibility, projectType } = vnode.attrs;
        
        const repo = typeof repoObj === 'string' ? repoObj : (repoObj?.name || '加载中...');
        const repoDesc = description || (repoObj?.description || '');
        const repoStars = stars !== undefined ? stars : (repoObj?.stars_count || 0);
        const repoForks = forks !== undefined ? forks : (repoObj?.forks_count || 0);
        const repoVisibility = visibility || (repoObj?.is_private ? 'private' : 'public');
        const repoType = projectType || (repoObj?.project_type || 'owned');
        
        return m('div.project-header', [
            m('div.project-header-top', [
                m('div.project-title-section', [
                    m('h1', repo),
                    m('div.project-badges', [
                        repoType === 'mirror' ? m('span.project-type-badge.mirror', [
                            m('i.fas.fa-clone'),
                            ' 镜像'
                        ]) : null,
                        m('span.project-visibility', { class: repoVisibility === 'private' ? 'private' : '' }, 
                            repoVisibility === 'private' ? '私有' : '公开')
                    ])
                ]),
                m('div.project-actions-bar', [
                    m('button.btn.btn-sm', [
                        m('i.fas.fa-star'),
                        ' 星标 ',
                        m('span', repoStars)
                    ]),
                    m('button.btn.btn-sm', [
                        m('i.fas.fa-code-branch'),
                        ' Fork ',
                        m('span', repoForks)
                    ]),
                    m('button.btn.btn-sm', [
                        m('i.fas.fa-clone'),
                        ' 克隆'
                    ])
                ])
            ]),
            m('div.project-breadcrumb', [
                m('a', { href: `/projects?owner=${owner}`, oncreate: m.route.link }, owner),
                m('span', '/'),
                m('span', repo)
            ]),
            m('p.project-description', repoDesc || '暂无描述')
        ]);
    }
};

const ProjectTabs = {
    view(vnode) {
        const { owner, repo, issuesCount, prsCount, activeTab } = vnode.attrs;
        const currentRoute = m.route.get();
        
        const tabs = [
            { id: 'code', icon: 'fa-code', label: '代码', href: `/project/${owner}/${repo}` },
            { id: 'issues', icon: 'fa-exclamation-circle', label: 'Issue', href: `/issues/${owner}/${repo}`, count: issuesCount },
            { id: 'prs', icon: 'fa-code-branch', label: 'PR', href: `/pull-requests/${owner}/${repo}`, count: prsCount },
            { id: 'tasks', icon: 'fa-tasks', label: '任务', href: `/tasks/${owner}/${repo}` },
            { id: 'releases', icon: 'fa-cube', label: '发布', href: `/releases/${owner}/${repo}` },
            { id: 'stats', icon: 'fa-chart-line', label: '统计', href: `/stats/${owner}/${repo}` },
            { id: 'settings', icon: 'fa-cog', label: '设置', href: `/settings/${owner}/${repo}` }
        ];
        
        return m('div.project-tabs', tabs.map(tab => {
            let isActive = false;
            if (activeTab) {
                isActive = tab.id === activeTab;
            } else {
                isActive = currentRoute.includes(`/${tab.id}/`) || currentRoute.includes(`/${tab.id}`);
            }
            
            return m('a.project-tab', {
                href: tab.href,
                oncreate: m.route.link,
                class: isActive ? 'active' : ''
            }, [
                m(`i.fas.${tab.icon}`),
                ` ${tab.label}`,
                tab.count !== undefined ? m('span.badge', tab.count) : ''
            ]);
        }));
    }
};

const Loading = {
    view() {
        return m('div.loading', [
            m('i.fas.fa-spinner.fa-spin'),
            m('span', ' 加载中...')
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

const Modal = {
    view(vnode) {
        const { isOpen, onClose, title, children } = vnode.attrs;
        
        if (!isOpen) return null;
        
        return m('div.modal-overlay', {
            onclick: (e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }
        }, [
            m('div.modal', [
                m('div.modal-header', [
                    m('h3', title),
                    m('button.modal-close', {
                        onclick: onClose
                    }, m('i.fas.fa-times'))
                ]),
                m('div.modal-body', children)
            ])
        ]);
    }
};

function formatTime(dateString) {
    if (!dateString) return '未知';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 30) return `${days} 天前`;
    
    return date.toLocaleDateString('zh-CN');
}

const ProjectCard = {
    view(vnode) {
        const { project } = vnode.attrs;
        
        return m('div.project-card', [
            m('div.project-card-header', [
                m('h3', m('a', { 
                    href: `/project/${project.owner}/${project.name}`,
                    oncreate: m.route.link
                }, project.name)),
                m('div.project-badges', [
                    project.project_type === 'mirror' ? m('span.project-type-badge.mirror', [
                        m('i.fas.fa-clone'),
                        ' 镜像'
                    ]) : null,
                    m('span.project-visibility', project.is_private ? '私有' : '公开')
                ])
            ]),
            m('p.project-card-description', project.description || '暂无描述'),
            m('div.project-card-meta', [
                m('span', [
                    m('i.fas.fa-star'),
                    ` ${project.stars_count || 0}`
                ]),
                m('span', [
                    m('i.fas.fa-code-branch'),
                    ` ${project.forks_count || 0}`
                ]),
                m('span', [
                    m('i.fas.fa-clock'),
                    ` ${formatTime(project.updated_at)}`
                ])
            ])
        ]);
    }
};

const IssueItem = {
    view(vnode) {
        const { issue, owner: propOwner, repo: propRepo } = vnode.attrs;
        const owner = propOwner || issue.owner;
        const repo = propRepo || issue.repo;
        
        return m('div.issue-item', [
            m('div.issue-item-icon', [
                m(`i.fas.${issue.is_closed ? 'fa-check-circle' : 'fa-exclamation-circle'}`, {
                    class: issue.is_closed ? 'closed' : 'open'
                })
            ]),
            m('div.issue-item-content', [
                m('h4', [
                    issue.labels && issue.labels.length > 0 ? 
                        m('span.issue-labels-inline', issue.labels.map(label => 
                            m('span.issue-label', { style: { backgroundColor: label.color } }, label.name)
                        )) : null,
                    m('a', { 
                        href: `/issues/${owner}/${repo}/${issue.number}`,
                        oncreate: m.route.link
                    }, issue.title)
                ]),
                m('div.issue-item-meta', [
                    m('span', `#${issue.number}`),
                    m('span', `由 ${issue.author} 创建于 ${formatTime(issue.created_at)}`),
                    issue.comments_count > 0 ? m('span', [
                        m('i.fas.fa-comment'),
                        ` ${issue.comments_count}`
                    ]) : null
                ])
            ])
        ]);
    }
};

const PRItem = {
    view(vnode) {
        const { pr, owner: propOwner, repo: propRepo } = vnode.attrs;
        const owner = propOwner || pr.owner;
        const repo = propRepo || pr.repo;
        
        let statusClass = 'open';
        let statusIcon = 'fa-code-branch';
        if (pr.is_merged) {
            statusClass = 'merged';
        } else if (pr.is_closed) {
            statusClass = 'closed';
        }
        
        return m('div.pr-item', [
            m('div.pr-item-icon', [
                m(`i.fas.${statusIcon}`, { class: statusClass })
            ]),
            m('div.pr-item-content', [
                m('h4', m('a', { 
                    href: `/pull-requests/${owner}/${repo}/${pr.number}`,
                    oncreate: m.route.link
                }, pr.title)),
                m('div.pr-item-meta', [
                    m('span', `#${pr.number}`),
                    m('span', `${pr.source_branch} → ${pr.target_branch}`),
                    m('span', `由 ${pr.author} 创建于 ${formatTime(pr.created_at)}`),
                    pr.comments_count > 0 ? m('span', [
                        m('i.fas.fa-comment'),
                        ` ${pr.comments_count}`
                    ]) : null,
                    pr.files_count > 0 ? m('span', [
                        m('i.fas.fa-file-code'),
                        ` ${pr.files_count}`
                    ]) : null
                ])
            ])
        ]);
    }
};

const MarkdownEditor = {
    oninit(vnode) {
        vnode.state.preview = false;
        vnode.state.showCodeRef = false;
        vnode.state.codeRef = {
            branch: 'main',
            commit: '',
            path: '',
            startLine: '',
            endLine: ''
        };
    },
    
    view(vnode) {
        const { value, oninput, placeholder, rows, owner, repo } = vnode.attrs;
        const { preview, showCodeRef, codeRef } = vnode.state;
        
        return m('div.markdown-editor', [
            m('div.editor-toolbar', [
                m('button.toolbar-btn', {
                    class: !preview ? 'active' : '',
                    onclick: () => { vnode.state.preview = false; }
                }, [m('i.fas.fa-edit'), ' 编辑']),
                m('button.toolbar-btn', {
                    class: preview ? 'active' : '',
                    onclick: () => { vnode.state.preview = true; }
                }, [m('i.fas.fa-eye', ' 预览')]),
                m('div.toolbar-separator'),
                m('button.toolbar-btn', {
                    title: '插入代码引用',
                    onclick: () => { vnode.state.showCodeRef = !showCodeRef; }
                }, [m('i.fas.fa-code'), ' 代码引用'])
            ]),
            
            showCodeRef ? m('div.code-ref-panel', [
                m('div.code-ref-row', [
                    m('input.form-input.code-ref-input', {
                        type: 'text',
                        placeholder: '分支 (如: main)',
                        value: codeRef.branch,
                        oninput: (e) => { vnode.state.codeRef.branch = e.target.value; }
                    }),
                    m('input.form-input.code-ref-input', {
                        type: 'text',
                        placeholder: 'Commit (可选)',
                        value: codeRef.commit,
                        oninput: (e) => { vnode.state.codeRef.commit = e.target.value; }
                    })
                ]),
                m('div.code-ref-row', [
                    m('input.form-input.code-ref-input.code-ref-path', {
                        type: 'text',
                        placeholder: '文件路径 (如: src/main.go)',
                        value: codeRef.path,
                        oninput: (e) => { vnode.state.codeRef.path = e.target.value; }
                    })
                ]),
                m('div.code-ref-row', [
                    m('input.form-input.code-ref-input', {
                        type: 'number',
                        placeholder: '起始行',
                        value: codeRef.startLine,
                        oninput: (e) => { vnode.state.codeRef.startLine = e.target.value; }
                    }),
                    m('input.form-input.code-ref-input', {
                        type: 'number',
                        placeholder: '结束行',
                        value: codeRef.endLine,
                        oninput: (e) => { vnode.state.codeRef.endLine = e.target.value; }
                    }),
                    m('button.btn.btn-sm.btn-primary', {
                        onclick: () => {
                            const ref = codeRef;
                            let codeRefStr = '';
                            if (ref.commit) {
                                codeRefStr = `\`\`\`coderef:${ref.branch}:${ref.commit}:${ref.path}`;
                            } else {
                                codeRefStr = `\`\`\`coderef:${ref.branch}:${ref.path}`;
                            }
                            if (ref.startLine && ref.endLine) {
                                codeRefStr += `:${ref.startLine}-${ref.endLine}`;
                            } else if (ref.startLine) {
                                codeRefStr += `:${ref.startLine}`;
                            }
                            codeRefStr += '\n```';
                            
                            const newValue = value ? value + '\n\n' + codeRefStr : codeRefStr;
                            oninput({ target: { value: newValue } });
                            vnode.state.showCodeRef = false;
                            vnode.state.codeRef = { branch: 'main', commit: '', path: '', startLine: '', endLine: '' };
                        }
                    }, '插入')
                ])
            ]) : null,
            
            preview ? 
                m('div.markdown-preview', [
                    m(MarkdownRenderer, { content: value || '' })
                ]) :
                m('textarea.form-input.form-textarea.markdown-textarea', {
                    placeholder: placeholder || '支持 Markdown 格式...',
                    rows: rows || 10,
                    value: value,
                    oninput: oninput
                })
        ]);
    }
};

const MarkdownRenderer = {
    view(vnode) {
        const { content, owner, repo } = vnode.attrs;
        
        const html = MarkdownRenderer.render(content, owner, repo);
        
        return m('div.markdown-body', {
            innerHTML: html,
            onclick: (e) => {
                let target = e.target;
                while (target && target !== e.currentTarget) {
                    if (target.tagName === 'A' && target.classList.contains('issue-ref')) {
                        e.preventDefault();
                        e.stopPropagation();
                        const href = target.getAttribute('href');
                        if (href) {
                            console.log('Navigating to:', href);
                            m.route.set(href);
                        }
                        return;
                    }
                    target = target.parentElement;
                }
            }
        });
    },
    
    render(content, owner, repo) {
        if (!content) return '';
        
        let html = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        if (owner && repo) {
            html = html.replace(/#(\d+)/g, (match, number) => {
                return `<a href="/issues/${owner}/${repo}/${number}" class="issue-ref">#${number}</a>`;
            });
        }
        
        html = html.replace(/```coderef:([^:\n]+):([^:\n]+):([^:\n]+):(\d+)-(\d+)\n```/g, (match, branch, commit, path, start, end) => {
            return `<div class="code-ref-block" data-branch="${branch}" data-commit="${commit}" data-path="${path}" data-start="${start}" data-end="${end}">
                <div class="code-ref-header">
                    <span class="code-ref-branch"><i class="fas fa-code-branch"></i> ${branch}</span>
                    <span class="code-ref-path">${path}</span>
                    <span class="code-ref-lines">L${start}-L${end}</span>
                </div>
                <div class="code-ref-content">加载中...</div>
            </div>`;
        });
        
        html = html.replace(/```coderef:([^:\n]+):([^:\n]+):(\d+)-(\d+)\n```/g, (match, branch, path, start, end) => {
            return `<div class="code-ref-block" data-branch="${branch}" data-path="${path}" data-start="${start}" data-end="${end}">
                <div class="code-ref-header">
                    <span class="code-ref-branch"><i class="fas fa-code-branch"></i> ${branch}</span>
                    <span class="code-ref-path">${path}</span>
                    <span class="code-ref-lines">L${start}-L${end}</span>
                </div>
                <div class="code-ref-content">加载中...</div>
            </div>`;
        });
        
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre class="code-block"><code class="language-${lang}">${code}</code></pre>`;
        });
        
        html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        
        html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
        
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
        
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        html = '<p>' + html + '</p>';
        
        return html;
    }
};

export { Layout, TopBar, Sidebar, ProjectHeader, ProjectTabs, Loading, EmptyState, Modal, formatTime, ProjectCard, IssueItem, PRItem, MarkdownEditor, MarkdownRenderer };
