// GitFolio Frontend Build - 2026年 4月12日 星期日 05时18分47秒 CST
// Shared constants and configurations
const Constants = {
    API_BASE_URL: '/api/v1',
    DEFAULT_PAGE: 1,
    DEFAULT_PER_PAGE: 30,
    DEFAULT_BRANCH: 'main',
    
    HTTP_STATUS: {
        OK: 200,
        CREATED: 201,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        INTERNAL_ERROR: 500
    },
    
    VISIBILITY: {
        PUBLIC: 'public',
        PRIVATE: 'private'
    },
    
    PROJECT_TYPE: {
        MIRROR: 'mirror',
        OWNED: 'owned',
        FORK: 'fork'
    },
    
    ISSUE_STATE: {
        OPEN: 'open',
        CLOSED: 'closed',
        ALL: 'all'
    },
    
    PR_STATUS: {
        OPEN: 'open',
        CLOSED: 'closed',
        MERGED: 'merged'
    }
};

const Utils = {
    buildQueryString(params) {
        const parts = [];
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
                parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
            }
        });
        return parts.length > 0 ? '?' + parts.join('&') : '';
    },
    
    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return dateString;
            }
            return date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateString || '';
        }
    },
    
    truncate(text, maxLength = 100) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};
const Auth = {
    token: null,
    
    init() {
        this.token = localStorage.getItem('token');
    },
    
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    },
    
    isAuthenticated() {
        return !!this.token;
    },
    
    logout() {
        return API.post('/auth/logout').then(() => {
            this.setToken(null);
            localStorage.removeItem('user');
        }).catch(() => {
            this.setToken(null);
            localStorage.removeItem('user');
        });
    }
};

const API = {
    normalizeResponse(data) {
        if (data === null) {
            return {};
        }
        if (data && typeof data === 'object' && data.data === null) {
            data.data = [];
        }
        return data;
    },

    request(options) {
        const headers = {};

        if (options.headers) {
            Object.keys(options.headers).forEach(key => {
                headers[key] = options.headers[key];
            });
        }

        if (Auth.token) {
            headers['Authorization'] = `Bearer ${Auth.token}`;
        }

        const requestOptions = {
            url: `${Constants.API_BASE_URL}${options.url}`,
            method: options.method || 'GET',
            headers: headers,
            extract: function(xhr) {
                return {
                    status: xhr.status,
                    body: xhr.responseText ? JSON.parse(xhr.responseText) : null
                };
            }
        };

        if (options.body) {
            requestOptions.body = options.body;
        }

        return m.request(requestOptions).then(data => {
            if (data.status >= 400) {
                let errorMsg = '请求失败';
                if (data.body && data.body.error) {
                    errorMsg = data.body.error;
                } else if (data.body && data.body.message) {
                    errorMsg = data.body.message;
                } else if (typeof data.body === 'string') {
                    errorMsg = data.body;
                }
                throw new Error(errorMsg);
            }
            return this.normalizeResponse(data.body);
        }).catch(error => {
            if (error && error.message) {
                throw error;
            }
            if (error && error.code === Constants.HTTP_STATUS.UNAUTHORIZED) {
                Auth.setToken(null);
                m.route.set('/login');
            }
            let errorMsg = '请求失败';
            if (typeof error === 'string') {
                errorMsg = error;
            } else if (error && error.message) {
                errorMsg = error.message;
            } else if (error && error.error) {
                errorMsg = error.error;
            } else if (error && error.response && error.response.error) {
                errorMsg = error.response.error;
            } else if (error && typeof error === 'object') {
                try {
                    errorMsg = JSON.stringify(error);
                } catch (e) {
                    errorMsg = String(error);
                }
            }
            throw new Error(errorMsg);
        });
    },
    
    get(url, params = {}) {
        const queryString = Utils.buildQueryString(params);
        return this.request({ url: url + queryString, method: 'GET' });
    },
    
    post(url, body) {
        return this.request({ url, method: 'POST', body });
    },
    
    put(url, body) {
        return this.request({ url, method: 'PUT', body });
    },
    
    delete(url) {
        return this.request({ url, method: 'DELETE' });
    }
};

const UserService = {
    list(params = {}) {
        return API.get('/users', params);
    },
    
    get(id) {
        return API.get(`/users/${id}`);
    },
    
    create(data) {
        return API.post('/users', data);
    },
    
    update(username, data) {
        return API.put(`/users/${username}`, data);
    },
    
    uploadAvatar(username, formData) {
        return m.request({
            method: 'POST',
            url: `${API_BASE_URL}/users/${username}/avatar`,
            data: formData,
            headers: {
                'Authorization': `Bearer ${Auth.getToken()}`
            }
        });
    },
    
    delete(id) {
        return API.delete(`/users/${id}`);
    }
};

const RepositoryService = {
    list(owner, params = {}) {
        const url = owner ? `/users/${owner}/repos` : '/repos';
        return API.get(url, params);
    },

    get(owner, repo) {
        return API.get(`/${owner}/${repo}`);
    },

    create(data) {
        return API.post('/repos', data);
    },

    update(owner, repo, data) {
        return API.put(`/${owner}/${repo}`, data);
    },

    delete(owner, repo) {
        return API.delete(`/${owner}/${repo}`);
    },

    syncPull(owner, repo) {
        return API.post(`/${owner}/${repo}/sync/pull`);
    },

    syncPush(owner, repo, remoteUrl) {
        return API.post(`/${owner}/${repo}/sync/push`, { remote_url: remoteUrl });
    },

    getTree(owner, repo, params = {}) {
        const { path, ...queryParams } = params;
        const url = path ? `/${owner}/${repo}/tree/${path}` : `/${owner}/${repo}/tree`;
        return API.get(url, queryParams);
    },

    getFile(owner, repo, params = {}) {
        const { path, ...queryParams } = params;
        const url = path ? `/${owner}/${repo}/file/${path}` : `/${owner}/${repo}/file`;
        return API.get(url, queryParams);
    },

    getBranches(owner, repo) {
        return API.get(`/${owner}/${repo}/branches`);
    },
    
    getTags(owner, repo) {
        return API.get(`/${owner}/${repo}/tags`);
    },
    
    getCommits(owner, repo, params = {}) {
        return API.get(`/${owner}/${repo}/commits`, params);
    },
    
    getLastCommit(owner, repo, ref = 'HEAD') {
        return API.get(`/${owner}/${repo}/last-commit`, { ref });
    },
    
    getContributors(owner, repo) {
        return API.get(`/${owner}/${repo}/contributors`);
    },
    
    getCodeStats(owner, repo) {
        return API.get(`/${owner}/${repo}/code-stats`);
    },
    
    getCommitActivity(owner, repo, days = 30) {
        return API.get(`/${owner}/${repo}/commit-activity`, { days });
    },
    
    rebase(owner, repo, data) {
        return API.post(`/${owner}/${repo}/rebase`, data);
    }
};

const IssueService = {
    list(owner, repo, params = {}) {
        const url = owner && repo 
            ? `/${owner}/${repo}/issues`
            : '/issues';
        return API.get(url, params);
    },
    
    get(owner, repo, number) {
        return API.get(`/${owner}/${repo}/issues/${number}`);
    },
    
    create(owner, repo, data) {
        return API.post(`/${owner}/${repo}/issues`, data);
    },
    
    update(owner, repo, number, data) {
        return API.put(`/${owner}/${repo}/issues/${number}`, data);
    }
};

const LabelService = {
    list(owner, repo) {
        return API.get(`/${owner}/${repo}/labels`);
    }
};

const ReleaseService = {
    list(owner, repo) {
        return API.get(`/${owner}/${repo}/releases`);
    },
    
    get(owner, repo, tag) {
        return API.get(`/${owner}/${repo}/releases/${tag}`);
    },
    
    sync(owner, repo) {
        return API.post(`/${owner}/${repo}/releases/sync`);
    }
};

const TaskService = {
    list(owner, repo, params = {}) {
        return API.get(`/${owner}/${repo}/tasks`, params);
    },
    
    get(owner, repo, id) {
        return API.get(`/${owner}/${repo}/tasks/${id}`);
    },
    
    create(owner, repo, data) {
        return API.post(`/${owner}/${repo}/tasks`, data);
    },
    
    update(owner, repo, id, data) {
        return API.put(`/${owner}/${repo}/tasks/${id}`, data);
    },
    
    delete(owner, repo, id) {
        return API.delete(`/${owner}/${repo}/tasks/${id}`);
    },
    
    uploadAttachment(owner, repo, id, formData) {
        return API.post(`/${owner}/${repo}/tasks/${id}/attachments`, formData);
    },
    
    deleteAttachment(owner, repo, id, attachmentId) {
        return API.delete(`/${owner}/${repo}/tasks/${id}/attachments/${attachmentId}`);
    },
    
    addIssue(owner, repo, id, issueId) {
        return API.post(`/${owner}/${repo}/tasks/${id}/issues`, { issue_id: issueId });
    },
    
    removeIssue(owner, repo, id, issueId) {
        return API.delete(`/${owner}/${repo}/tasks/${id}/issues/${issueId}`);
    }
};

const PullRequestService = {
    list(owner, repo, params = {}) {
        const url = owner && repo 
            ? `/${owner}/${repo}/pull_requests`
            : '/pull_requests';
        return API.get(url, params);
    },
    
    get(owner, repo, number) {
        return API.get(`/${owner}/${repo}/pull_requests/${number}`);
    },
    
    create(owner, repo, data) {
        return API.post(`/${owner}/${repo}/pull_requests`, data);
    },
    
    update(owner, repo, number, data) {
        return API.put(`/${owner}/${repo}/pull_requests/${number}`, data);
    },
    
    merge(owner, repo, number) {
        return API.post(`/${owner}/${repo}/pull_requests/${number}/merge`);
    },
    
    close(owner, repo, number) {
        return API.post(`/${owner}/${repo}/pull_requests/${number}/close`);
    },
    
    reopen(owner, repo, number) {
        return API.post(`/${owner}/${repo}/pull_requests/${number}/reopen`);
    }
};

const GroupService = {
    list(params = {}) {
        return API.get('/groups', params);
    },

    get(name) {
        return API.get(`/groups/${name}`);
    },

    create(data) {
        return API.post('/groups', data);
    },
    
    update(name, data) {
        return API.put(`/groups/${name}`, data);
    },
    
    uploadAvatar(name, formData) {
        return m.request({
            method: 'POST',
            url: `${API_BASE_URL}/groups/${name}/avatar`,
            data: formData,
            headers: {
                'Authorization': `Bearer ${Auth.getToken()}`
            }
        });
    },
    
    getMembers(name) {
        return API.get(`/groups/${name}/members`);
    },
    
    addMember(name, data) {
        return API.post(`/groups/${name}/members`, data);
    },
    
    removeMember(name, username) {
        return API.delete(`/groups/${name}/members/${username}`);
    }
};

const ActivityService = {
    list(params = {}) {
        return API.get('/activities', params);
    },

    create(data) {
        return API.post('/activities', data);
    }
};

const MilestoneService = {
    list(owner, repo) {
        return API.get(`/${owner}/${repo}/milestones`);
    },

    create(owner, repo, data) {
        return API.post(`/${owner}/${repo}/milestones`, data);
    }
};

const SnippetService = {
    list(params = {}) {
        return API.get('/snippets', params);
    },

    get(id) {
        return API.get(`/snippets/${id}`);
    },

    create(data) {
        return API.post('/snippets', data);
    },

    update(id, data) {
        return API.put(`/snippets/${id}`, data);
    },

    delete(id) {
        return API.delete(`/snippets/${id}`);
    }
};

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
        const mirrorUrl = repoObj?.mirror_url || '';
        const isMirror = repoObj?.is_mirror || false;
        
        return m('div.project-header', [
            m('div.project-header-top', [
                m('div.project-title-section', [
                    m('h1', [
                        repo,
                        isMirror && mirrorUrl ? m('a.mirror-link', {
                            href: mirrorUrl,
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            title: `原始仓库: ${mirrorUrl}`
                        }, [
                            m('i.fas.fa-external-link-alt')
                        ]) : null
                    ]),
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
        const { owner, repo, issuesCount, prsCount, tasksCount, activeTab } = vnode.attrs;
        const currentRoute = m.route.get();
        const repoName = typeof repo === 'string' ? repo : (repo?.name || '');
        
        const tabs = [
            { id: 'code', icon: 'fa-code', label: '代码', href: `/project/${owner}/${repoName}` },
            { id: 'commits', icon: 'fa-history', label: '提交', href: `/commits/${owner}/${repoName}` },
            { id: 'issues', icon: 'fa-exclamation-circle', label: '议题', href: `/issues/${owner}/${repoName}`, count: issuesCount },
            { id: 'tasks', icon: 'fa-tasks', label: '任务', href: `/tasks/${owner}/${repoName}`, count: tasksCount },
            { id: 'prs', icon: 'fa-code-branch', label: 'PR', href: `/pull-requests/${owner}/${repoName}`, count: prsCount },
            { id: 'releases', icon: 'fa-cube', label: '发布', href: `/releases/${owner}/${repoName}` },
            { id: 'stats', icon: 'fa-chart-line', label: '统计', href: `/stats/${owner}/${repoName}` },
            { id: 'settings', icon: 'fa-cog', label: '设置', href: `/settings/${owner}/${repoName}` }
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

const Pagination = {
    view(vnode) {
        const { page, totalPages, onPageChange } = vnode.attrs;
        
        if (totalPages <= 1) return null;
        
        const pages = [];
        const maxVisible = 5;
        let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        if (startPage > 1) {
            pages.push({ num: 1, label: '1' });
            if (startPage > 2) {
                pages.push({ num: null, label: '...' });
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pages.push({ num: i, label: String(i) });
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                pages.push({ num: null, label: '...' });
            }
            pages.push({ num: totalPages, label: String(totalPages) });
        }
        
        return m('div.pagination', [
            m('button.pagination-btn', {
                disabled: page === 1,
                onclick: () => onPageChange(page - 1)
            }, [
                m('i.fas.fa-chevron-left')
            ]),
            pages.map(p => 
                p.num === null ?
                    m('span.pagination-ellipsis', p.label) :
                    m('button.pagination-btn', {
                        class: p.num === page ? 'active' : '',
                        onclick: () => onPageChange(p.num)
                    }, p.label)
            ),
            m('button.pagination-btn', {
                disabled: page === totalPages,
                onclick: () => onPageChange(page + 1)
            }, [
                m('i.fas.fa-chevron-right')
            ])
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
        
        let html = content;
        
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
            const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            let highlightedCode = escapedCode;
            
            if (typeof hljs !== 'undefined' && lang) {
                try {
                    const langClass = lang.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (hljs.getLanguage(langClass)) {
                        highlightedCode = hljs.highlight(code, { language: langClass }).value;
                    } else {
                        highlightedCode = hljs.highlightAuto(code).value;
                    }
                } catch (e) {
                    console.error('Highlight error:', e);
                }
            } else if (typeof hljs !== 'undefined') {
                try {
                    highlightedCode = hljs.highlightAuto(code).value;
                } catch (e) {
                    console.error('Auto-highlight error:', e);
                }
            }
            
            return `<pre class="code-block"><code class="language-${lang} hljs">${highlightedCode}</code></pre>`;
        });
        
        html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
        html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
        
        html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        
        html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
        html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
            if (match.match(/^\d/)) {
                return '<ol>' + match + '</ol>';
            }
            return '<ul>' + match + '</ul>';
        });
        
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        html = html.replace(/\n---\n/g, '<hr>');
        
        const lines = html.split('\n');
        let inParagraph = false;
        let result = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            if (trimmedLine === '') {
                if (inParagraph) {
                    result.push('</p>');
                    inParagraph = false;
                }
                continue;
            }
            
            if (/^<(h[1-6]|ul|ol|li|blockquote|pre|hr|div|table)/i.test(trimmedLine) ||
                /^<\/?(h[1-6]|ul|ol|li|blockquote|pre|hr|div|table)/i.test(trimmedLine)) {
                if (inParagraph) {
                    result.push('</p>');
                    inParagraph = false;
                }
                result.push(line);
                continue;
            }
            
            if (!inParagraph) {
                result.push('<p>');
                inParagraph = true;
            }
            
            result.push(line);
            if (i < lines.length - 1 && lines[i + 1].trim() !== '') {
                result.push('<br>');
            }
        }
        
        if (inParagraph) {
            result.push('</p>');
        }
        
        html = result.join('\n');
        
        html = html.replace(/<p>\s*<\/p>/g, '');
        html = html.replace(/<br>\s*<\/p>/g, '</p>');
        
        return html;
    }
};

const CreateIssueModal = {
    oninit(vnode) {
        vnode.state.formData = {
            title: '',
            body: '',
            labels: []
        };
        vnode.state.loading = false;
    },
    
    view(vnode) {
        const { isOpen, onClose, onSubmit, owner, repo, labels } = vnode.attrs;
        const { formData, loading } = vnode.state;
        const availableLabels = labels || [
            { name: 'Bug', color: '#d73a4a' },
            { name: 'Feat', color: '#a2eeef' },
            { name: 'WIP', color: '#fbca04' }
        ];
        
        return m(Modal, {
            isOpen,
            onClose,
            title: '新建 Issue'
        }, [
            m('form', {
                onsubmit: (e) => {
                    e.preventDefault();
                    if (loading) return;
                    
                    vnode.state.loading = true;
                    onSubmit(formData).then(() => {
                        vnode.state.loading = false;
                        vnode.state.formData = { title: '', body: '', labels: [] };
                        onClose();
                    }).catch(err => {
                        vnode.state.loading = false;
                        console.error('Failed to create issue:', err);
                        alert('创建Issue失败: ' + err.message);
                    });
                }
            }, [
                m('div.form-group', [
                    m('label.form-label', { for: 'issue-title' }, '标题'),
                    m('input#issue-title.form-input', {
                        type: 'text',
                        placeholder: '输入Issue标题',
                        required: true,
                        value: formData.title,
                        oninput: (e) => {
                            vnode.state.formData.title = e.target.value;
                        }
                    })
                ]),
                
                m('div.form-group', [
                    m('label.form-label', { for: 'issue-body' }, '描述'),
                    m(MarkdownEditor, {
                        value: formData.body,
                        oninput: (e) => {
                            vnode.state.formData.body = e.target.value;
                        },
                        placeholder: '详细描述这个Issue... (支持 Markdown 格式)',
                        rows: 10,
                        owner: owner,
                        repo: repo
                    })
                ]),
                
                m('div.form-group', [
                    m('label.form-label', '标签'),
                    m('div.labels-selector', availableLabels.map(label => 
                        m('button.btn.btn-sm.label-btn', {
                            type: 'button',
                            class: formData.labels.includes(label.name) ? 'active' : '',
                            style: formData.labels.includes(label.name) ? `background-color: ${label.color}; color: white; border-color: ${label.color};` : `border-color: ${label.color};`,
                            onclick: () => {
                                if (formData.labels.includes(label.name)) {
                                    vnode.state.formData.labels = formData.labels.filter(l => l !== label.name);
                                } else {
                                    vnode.state.formData.labels.push(label.name);
                                }
                            }
                        }, label.name)
                    )),
                    formData.labels.length > 0 ? 
                        m('div.selected-labels', [
                            m('span', '已选择: '),
                            formData.labels.map(labelName => {
                                const label = availableLabels.find(l => l.name === labelName);
                                return m('span.issue-label', {
                                    style: label ? `background-color: ${label.color}` : '',
                                    onclick: () => {
                                        vnode.state.formData.labels = formData.labels.filter(l => l !== labelName);
                                    }
                                }, labelName + ' ×');
                            })
                        ]) : null
                ]),
                
                m('div.modal-footer', [
                    m('button.btn', {
                        type: 'button',
                        onclick: onClose,
                        disabled: loading
                    }, '取消'),
                    m('button.btn.btn-primary', {
                        type: 'submit',
                        disabled: loading || !formData.title.trim()
                    }, loading ? '提交中...' : '创建 Issue')
                ])
            ])
        ]);
    }
};

const CreateTaskModal = {
    oninit(vnode) {
        vnode.state.formData = {
            title: '',
            draft: '',
            goal: '',
            preview_image: '',
            priority: 3,
            sort_order: 0,
            verifier: '',
            handler: '',
            schedules: []
        };
        vnode.state.loading = false;
        vnode.state.showScheduleForm = false;
        vnode.state.newSchedule = {
            schedule_type: 'review',
            plan_start_date: '',
            plan_end_date: '',
            plan_start_noon: 'am',
            plan_end_noon: 'pm',
            user1: '',
            user2: '',
            user3: ''
        };
    },
    
    view(vnode) {
        const { isOpen, onClose, onSubmit, owner, repo } = vnode.attrs;
        const { formData, loading, showScheduleForm, newSchedule } = vnode.state;
        
        const scheduleTypeLabels = {
            'review': '评审',
            'develop': '开发',
            'test': '测试',
            'accept': '验收'
        };
        
        return m(Modal, {
            isOpen,
            onClose,
            title: '新建任务'
        }, [
            m('form', {
                onsubmit: (e) => {
                    e.preventDefault();
                    if (loading) return;
                    
                    vnode.state.loading = true;
                    onSubmit(formData).then(() => {
                        vnode.state.loading = false;
                        vnode.state.formData = {
                            title: '',
                            draft: '',
                            goal: '',
                            preview_image: '',
                            priority: 3,
                            sort_order: 0,
                            verifier: '',
                            handler: '',
                            schedules: []
                        };
                        onClose();
                    }).catch(err => {
                        vnode.state.loading = false;
                        console.error('Failed to create task:', err);
                        alert('创建任务失败: ' + err.message);
                    });
                }
            }, [
                m('div.form-group', [
                    m('label.form-label', { for: 'task-title' }, '标题'),
                    m('input#task-title.form-input', {
                        type: 'text',
                        placeholder: '输入任务标题',
                        required: true,
                        value: formData.title,
                        oninput: (e) => {
                            vnode.state.formData.title = e.target.value;
                        }
                    })
                ]),
                
                m('div.form-group', [
                    m('label.form-label', { for: 'task-draft' }, '草稿'),
                    m('p.field-hint', '评审前的初始规划'),
                    m(MarkdownEditor, {
                        value: formData.draft,
                        oninput: (e) => {
                            vnode.state.formData.draft = e.target.value;
                        },
                        placeholder: '任务草稿... (支持 Markdown 格式)',
                        rows: 8,
                        owner: owner,
                        repo: repo
                    })
                ]),
                
                m('div.form-group', [
                    m('label.form-label', { for: 'task-goal' }, '目标'),
                    m('p.field-hint', '评审后形成的最终版本'),
                    m(MarkdownEditor, {
                        value: formData.goal,
                        oninput: (e) => {
                            vnode.state.formData.goal = e.target.value;
                        },
                        placeholder: '任务目标... (支持 Markdown 格式)',
                        rows: 6,
                        owner: owner,
                        repo: repo
                    })
                ]),
                
                m('div.form-group', [
                    m('label.form-label', { for: 'task-preview' }, '预览图URL'),
                    m('input#task-preview.form-input', {
                        type: 'text',
                        placeholder: '预览图片链接',
                        value: formData.preview_image,
                        oninput: (e) => {
                            vnode.state.formData.preview_image = e.target.value;
                        }
                    })
                ]),
                
                m('div.form-row', [
                    m('div.form-group', [
                        m('label.form-label', '优先级'),
                        m('select.form-input', {
                            value: formData.priority,
                            onchange: (e) => {
                                vnode.state.formData.priority = parseInt(e.target.value);
                            }
                        }, [
                            m('option', { value: 1 }, '1 - 紧急'),
                            m('option', { value: 2 }, '2 - 高'),
                            m('option', { value: 3 }, '3 - 中'),
                            m('option', { value: 4 }, '4 - 低'),
                            m('option', { value: 5 }, '5 - 最低')
                        ])
                    ]),
                    m('div.form-group', [
                        m('label.form-label', '排序'),
                        m('input.form-input', {
                            type: 'number',
                            placeholder: '排序数字',
                            value: formData.sort_order || 0,
                            oninput: (e) => {
                                vnode.state.formData.sort_order = parseInt(e.target.value) || 0;
                            }
                        })
                    ]),
                    m('div.form-group', [
                        m('label.form-label', '验收人'),
                        m('input.form-input', {
                            type: 'text',
                            placeholder: '用户名',
                            value: formData.verifier,
                            oninput: (e) => {
                                vnode.state.formData.verifier = e.target.value;
                            }
                        })
                    ]),
                    m('div.form-group', [
                        m('label.form-label', '处理人'),
                        m('input.form-input', {
                            type: 'text',
                            placeholder: '用户名',
                            value: formData.handler,
                            oninput: (e) => {
                                vnode.state.formData.handler = e.target.value;
                            }
                        })
                    ])
                ]),
                
                m('div.form-group', [
                    m('div.schedule-header-row', [
                        m('label.form-label', '排期信息'),
                        m('button.btn.btn-sm', {
                            type: 'button',
                            onclick: () => { vnode.state.showScheduleForm = !showScheduleForm; }
                        }, showScheduleForm ? '取消' : '添加排期')
                    ]),
                    
                    formData.schedules.length > 0 ? m('div.schedules-list', formData.schedules.map((s, idx) => 
                        m('div.schedule-item-preview', [
                            m('span', scheduleTypeLabels[s.schedule_type] || s.schedule_type),
                            s.plan_start_date ? m('span', `: ${s.plan_start_date} - ${s.plan_end_date}`) : null,
                            m('button.btn-sm.remove-schedule', {
                                type: 'button',
                                onclick: () => {
                                    vnode.state.formData.schedules.splice(idx, 1);
                                }
                            }, '×')
                        ])
                    )) : null,
                    
                    showScheduleForm ? m('div.schedule-form', [
                        m('div.form-row', [
                            m('div.form-group', [
                                m('label.form-label', '种类'),
                                m('select.form-input', {
                                    value: newSchedule.schedule_type,
                                    onchange: (e) => { vnode.state.newSchedule.schedule_type = e.target.value; }
                                }, [
                                    m('option', { value: 'review' }, '评审'),
                                    m('option', { value: 'develop' }, '开发'),
                                    m('option', { value: 'test' }, '测试'),
                                    m('option', { value: 'accept' }, '验收')
                                ])
                            ])
                        ]),
                        m('div.form-row', [
                            m('div.form-group', [
                                m('label.form-label', '计划开始'),
                                m('input.form-input', {
                                    type: 'date',
                                    value: newSchedule.plan_start_date,
                                    oninput: (e) => { vnode.state.newSchedule.plan_start_date = e.target.value; }
                                })
                            ]),
                            m('div.form-group', [
                                m('label.form-label', '计划结束'),
                                m('input.form-input', {
                                    type: 'date',
                                    value: newSchedule.plan_end_date,
                                    oninput: (e) => { vnode.state.newSchedule.plan_end_date = e.target.value; }
                                })
                            ])
                        ]),
                        m('div.form-row', [
                            m('div.form-group', [
                                m('label.form-label', '参与人1'),
                                m('input.form-input', {
                                    type: 'text',
                                    placeholder: '用户名',
                                    value: newSchedule.user1,
                                    oninput: (e) => { vnode.state.newSchedule.user1 = e.target.value; }
                                })
                            ]),
                            m('div.form-group', [
                                m('label.form-label', '参与人2'),
                                m('input.form-input', {
                                    type: 'text',
                                    placeholder: '用户名',
                                    value: newSchedule.user2,
                                    oninput: (e) => { vnode.state.newSchedule.user2 = e.target.value; }
                                })
                            ]),
                            m('div.form-group', [
                                m('label.form-label', '参与人3'),
                                m('input.form-input', {
                                    type: 'text',
                                    placeholder: '用户名',
                                    value: newSchedule.user3,
                                    oninput: (e) => { vnode.state.newSchedule.user3 = e.target.value; }
                                })
                            ])
                        ]),
                        m('button.btn.btn-sm.btn-primary', {
                            type: 'button',
                            onclick: () => {
                                vnode.state.formData.schedules.push({...newSchedule});
                                vnode.state.newSchedule = {
                                    schedule_type: 'review',
                                    plan_start_date: '',
                                    plan_end_date: '',
                                    plan_start_noon: 'am',
                                    plan_end_noon: 'pm',
                                    user1: '',
                                    user2: '',
                                    user3: ''
                                };
                                vnode.state.showScheduleForm = false;
                            }
                        }, '添加')
                    ]) : null
                ]),
                
                m('div.modal-footer', [
                    m('button.btn', {
                        type: 'button',
                        onclick: onClose,
                        disabled: loading
                    }, '取消'),
                    m('button.btn.btn-primary', {
                        type: 'submit',
                        disabled: loading || !formData.title.trim()
                    }, loading ? '提交中...' : '创建任务')
                ])
            ])
        ]);
    }
};

const CreatePRModal = {
    oninit(vnode) {
        vnode.state.formData = {
            title: '',
            description: '',
            source_branch: 'feature-branch',
            target_branch: 'main'
        };
        vnode.state.loading = false;
    },
    
    view(vnode) {
        const { isOpen, onClose, onSubmit, owner, repo, branches } = vnode.attrs;
        const { formData, loading } = vnode.state;
        const availableBranches = branches || ['main', 'develop'];
        
        return m(Modal, {
            isOpen,
            onClose,
            title: '新建 PR'
        }, [
            m('form', {
                onsubmit: (e) => {
                    e.preventDefault();
                    if (loading) return;
                    
                    vnode.state.loading = true;
                    onSubmit(formData).then(() => {
                        vnode.state.loading = false;
                        vnode.state.formData = {
                            title: '',
                            description: '',
                            source_branch: 'feature-branch',
                            target_branch: 'main'
                        };
                        onClose();
                    }).catch(err => {
                        vnode.state.loading = false;
                        console.error('Failed to create PR:', err);
                        alert('创建 PR 失败: ' + err.message);
                    });
                }
            }, [
                m('div.form-group', [
                    m('label.form-label', { for: 'pr-title' }, '标题'),
                    m('input#pr-title.form-input', {
                        type: 'text',
                        placeholder: '输入 PR 标题',
                        required: true,
                        value: formData.title,
                        oninput: (e) => {
                            vnode.state.formData.title = e.target.value;
                        }
                    })
                ]),
                
                m('div.form-group', [
                    m('label.form-label', { for: 'pr-desc' }, '描述'),
                    m('textarea#pr-desc.form-input.form-textarea', {
                        placeholder: '描述这个 PR 的变更内容...',
                        rows: 8,
                        value: formData.description,
                        oninput: (e) => {
                            vnode.state.formData.description = e.target.value;
                        }
                    })
                ]),
                
                m('div.form-group', [
                    m('label.form-label', '源分支'),
                    m('select.form-input', {
                        value: formData.source_branch,
                        onchange: (e) => {
                            vnode.state.formData.source_branch = e.target.value;
                        }
                    }, availableBranches.map(branch =>
                        m('option', { value: branch }, branch)
                    ))
                ]),
                
                m('div.form-group', [
                    m('label.form-label', '目标分支'),
                    m('select.form-input', {
                        value: formData.target_branch,
                        onchange: (e) => {
                            vnode.state.formData.target_branch = e.target.value;
                        }
                    }, availableBranches.map(branch =>
                        m('option', { value: branch }, branch)
                    ))
                ]),
                
                m('div.modal-footer', [
                    m('button.btn', {
                        type: 'button',
                        onclick: onClose,
                        disabled: loading
                    }, '取消'),
                    m('button.btn.btn-primary', {
                        type: 'submit',
                        disabled: loading || !formData.title.trim()
                    }, loading ? '提交中...' : '创建 PR')
                ])
            ])
        ]);
    }
};
const CreateProjectModal = {
    oninit(vnode) {
        vnode.state.formData = {
            name: '',
            description: '',
            is_private: false,
            project_type: 'owned'
        };
        vnode.state.loading = false;
    },
    
    view(vnode) {
        const { isOpen, onClose, onSubmit } = vnode.attrs;
        const { formData, loading } = vnode.state;
        
        return m(Modal, {
            isOpen,
            onClose,
            title: '新建项目'
        }, [
            m('form', {
                onsubmit: (e) => {
                    e.preventDefault();
                    if (loading) return;
                    
                    vnode.state.loading = true;
                    onSubmit(formData).then(() => {
                        vnode.state.loading = false;
                        vnode.state.formData = { name: '', description: '', is_private: false, project_type: 'owned' };
                        onClose();
                    }).catch(err => {
                        vnode.state.loading = false;
                        console.error('Failed to create project:', err);
                        alert('创建项目失败: ' + err.message);
                    });
                }
            }, [
                m('div.form-group', [
                    m('label.form-label', { for: 'project-name' }, '项目名称'),
                    m('input#project-name.form-input', {
                        type: 'text',
                        placeholder: '输入项目名称',
                        required: true,
                        pattern: '^[a-z0-9-_]+$',
                        value: formData.name,
                        oninput: (e) => {
                            vnode.state.formData.name = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
                        }
                    }),
                    m('p.form-hint', '只能包含小写字母、数字、连字符和下划线')
                ]),
                
                m('div.form-group', [
                    m('label.form-label', { for: 'project-desc' }, '描述'),
                    m('textarea#project-desc.form-input.form-textarea', {
                        placeholder: '简短描述项目...',
                        rows: 4,
                        value: formData.description,
                        oninput: (e) => {
                            vnode.state.formData.description = e.target.value;
                        }
                    })
                ]),
                
                m('div.form-group', [
                    m('label.form-label', '项目类型'),
                    m('div.project-type-selector', [
                        m('label.project-type-option', {
                            class: formData.project_type === 'owned' ? 'selected' : ''
                        }, [
                            m('input', {
                                type: 'radio',
                                name: 'project_type',
                                value: 'owned',
                                checked: formData.project_type === 'owned',
                                onchange: () => { vnode.state.formData.project_type = 'owned'; }
                            }),
                            m('div.project-type-content', [
                                m('i.fas.fa-code-branch'),
                                m('strong', '持有项目'),
                                m('span', '从本地创建并推送到远程')
                            ])
                        ]),
                        m('label.project-type-option', {
                            class: formData.project_type === 'mirror' ? 'selected' : ''
                        }, [
                            m('input', {
                                type: 'radio',
                                name: 'project_type',
                                value: 'mirror',
                                checked: formData.project_type === 'mirror',
                                onchange: () => { vnode.state.formData.project_type = 'mirror'; }
                            }),
                            m('div.project-type-content', [
                                m('i.fas.fa-mirror'),
                                m('strong', '镜像项目'),
                                m('span', '从远程平台同步')
                            ])
                        ])
                    ])
                ]),
                
                formData.project_type === 'mirror' ? 
                    m('div.form-group', [
                        m('label.form-label', { for: 'mirror-url' }, '镜像URL'),
                        m('input#mirror-url.form-input', {
                            type: 'url',
                            placeholder: 'https://github.com/user/repo',
                            value: formData.mirror_url || '',
                            oninput: (e) => {
                                vnode.state.formData.mirror_url = e.target.value;
                            }
                        }),
                        m('p.form-hint', '支持 GitHub、Gitea、GitLab 等平台的仓库URL')
                    ]) : null,
                
                m('div.form-group', [
                    m('label.form-label', '可见性'),
                    m('div.visibility-selector', [
                        m('label.visibility-option', {
                            class: !formData.is_private ? 'selected' : ''
                        }, [
                            m('input', {
                                type: 'radio',
                                name: 'visibility',
                                checked: !formData.is_private,
                                onchange: () => { vnode.state.formData.is_private = false; }
                            }),
                            m('i.fas.fa-globe'),
                            m('span', '公开')
                        ]),
                        m('label.visibility-option', {
                            class: formData.is_private ? 'selected' : ''
                        }, [
                            m('input', {
                                type: 'radio',
                                name: 'visibility',
                                checked: formData.is_private,
                                onchange: () => { vnode.state.formData.is_private = true; }
                            }),
                            m('i.fas.fa-lock'),
                            m('span', '私有')
                        ])
                    ])
                ]),
                
                m('div.modal-footer', [
                    m('button.btn', {
                        type: 'button',
                        onclick: onClose,
                        disabled: loading
                    }, '取消'),
                    m('button.btn.btn-primary', {
                        type: 'submit',
                        disabled: loading || !formData.name.trim()
                    }, loading ? '创建中...' : '创建项目')
                ])
            ])
        ]);
    }
};

const CloneProjectModal = {
    oninit(vnode) {
        vnode.state.formData = {
            clone_url: '',
            name: '',
            description: '',
            is_private: false,
            project_type: 'mirror'
        };
        vnode.state.loading = false;
        vnode.state.detected = null;
    },

    detectPlatform(url) {
        if (!url) return null;
        if (url.includes('github.com')) return 'github';
        if (url.includes('gitea.com') || url.includes('gitea.')) return 'gitea';
        if (url.includes('gitlab.com') || url.includes('gitlab.')) return 'gitlab';
        return 'other';
    },

    extractRepoInfo(url) {
        const patterns = [
            /github\.com\/([^\/]+)\/([^\/\?#]+)/,
            /gitea\.(com|org)\/([^\/]+)\/([^\/\?#]+)/,
            /gitlab\.com\/([^\/]+)\/([^\/\?#]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return {
                    owner: match[1],
                    repo: match[2].replace(/\.git$/, ''),
                    platform: this.detectPlatform(url)
                };
            }
        }
        return null;
    },

    view(vnode) {
        const { isOpen, onClose, onSubmit } = vnode.attrs;
        const { formData, loading, detected } = vnode.state;

        const detectedInfo = this.extractRepoInfo(formData.clone_url);

        return m(Modal, {
            isOpen,
            onClose,
            title: '克隆项目'
        }, [
            m('form', {
                onsubmit: (e) => {
                    e.preventDefault();
                    if (loading) return;

                    const submitData = { ...formData };
                    if (detectedInfo) {
                        submitData.mirror_url = formData.clone_url;
                        submitData.platform = detectedInfo.platform;
                    }

                    vnode.state.loading = true;
                    onSubmit(submitData).then(() => {
                        vnode.state.loading = false;
                        vnode.state.formData = {
                            clone_url: '',
                            name: '',
                            description: '',
                            is_private: false,
                            project_type: 'mirror'
                        };
                        onClose();
                    }).catch(err => {
                        vnode.state.loading = false;
                        console.error('Failed to clone project:', err);
                        alert('克隆项目失败: ' + (err.message || '未知错误'));
                    });
                }
            }, [
                m('div.form-group', [
                    m('label.form-label', { for: 'clone-url' }, '仓库 URL'),
                    m('input#clone-url.form-input', {
                        type: 'url',
                        placeholder: 'https://github.com/user/repo',
                        value: formData.clone_url,
                        oninput: (e) => {
                            vnode.state.formData.clone_url = e.target.value;
                            vnode.state.detected = this.detectPlatform(e.target.value);
                            if (detectedInfo) {
                                vnode.state.formData.name = detectedInfo.repo;
                            }
                        }
                    }),
                    m('p.form-hint', '支持 GitHub、Gitea、GitLab 等平台的仓库地址'),
                    detectedInfo ? m('p.form-hint', [
                        m('i.fas.fa-check-circle', { style: { color: 'var(--success-color)', marginRight: '4px' } }),
                        `检测到 ${detectedInfo.platform} 仓库: ${detectedInfo.owner}/${detectedInfo.repo}`
                    ]) : null
                ]),

                m('div.form-group', [
                    m('label.form-label', { for: 'project-name' }, '项目名称'),
                    m('input#project-name.form-input', {
                        type: 'text',
                        placeholder: '输入项目名称',
                        value: formData.name,
                        oninput: (e) => {
                            vnode.state.formData.name = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
                        }
                    })
                ]),

                m('div.form-group', [
                    m('label.form-label', { for: 'project-desc' }, '描述'),
                    m('textarea#project-desc.form-input.form-textarea', {
                        placeholder: '简短描述项目...',
                        rows: 3,
                        value: formData.description,
                        oninput: (e) => {
                            vnode.state.formData.description = e.target.value;
                        }
                    })
                ]),

                m('div.form-group', [
                    m('div.form-checkbox-group', [
                        m('input.form-checkbox', {
                            type: 'checkbox',
                            id: 'is-private-clone',
                            checked: formData.is_private
                        }),
                        m('label', { for: 'is-private-clone' }, '私有仓库')
                    ])
                ]),

                m('div.modal-footer', [
                    m('button.btn', {
                        type: 'button',
                        onclick: onClose,
                        disabled: loading
                    }, '取消'),
                    m('button.btn.btn-primary', {
                        type: 'submit',
                        disabled: loading || !formData.clone_url.trim() || !formData.name.trim()
                    }, loading ? '克隆中...' : '克隆项目')
                ])
            ])
        ]);
    }
};

const Dashboard = {
    oninit(vnode) {
        vnode.state.projects = [];
        vnode.state.issues = [];
        vnode.state.prs = [];
        vnode.state.loading = true;
        
        Promise.all([
            RepositoryService.list(),
            IssueService.list(),
            PullRequestService.list()
        ]).then(([projects, issues, prs]) => {
            vnode.state.projects = projects.data || [];
            vnode.state.issues = issues.data || [];
            vnode.state.prs = prs.data || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load dashboard data:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { projects, issues, prs, loading } = vnode.state;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        return m(Layout, [
            m('div.dashboard', [
                m('div.dashboard-header', [
                    m('h1', '总览'),
                    m('p', '欢迎回来，ryan！')
                ]),
                
                m('div.dashboard-grid', [
                    m('div.dashboard-section', [
                        m('h2', [
                            m('i.fas.fa-folder'),
                            ' 最近项目'
                        ]),
                        projects.length === 0 
                            ? m(EmptyState, { message: '暂无项目' })
                            : m('div.project-list', projects.slice(0, 5).map(project => 
                                m(ProjectCard, { project })
                            ))
                    ]),
                    
                    m('div.dashboard-section', [
                        m('h2', [
                            m('i.fas.fa-exclamation-circle'),
                            ' 最近 Issue'
                        ]),
                        issues.length === 0 
                            ? m(EmptyState, { message: '暂无 Issue' })
                            : m('div.issue-list', issues.slice(0, 5).map(issue => 
                                m(IssueItem, { issue })
                            ))
                    ]),
                    
                    m('div.dashboard-section', [
                        m('h2', [
                            m('i.fas.fa-code-branch'),
                            ' 最近 PR'
                        ]),
                        prs.length === 0 
                            ? m(EmptyState, { message: '暂无 PR' })
                            : m('div.pr-list', prs.slice(0, 5).map(pr => 
                                m(PRItem, { pr })
                            ))
                    ])
                ])
            ])
        ]);
    }
};


const ProjectList = {
    oninit(vnode) {
        vnode.state.projects = [];
        vnode.state.loading = true;
        vnode.state.filter = 'all';
        vnode.state.search = '';

        RepositoryService.list().then(result => {
            vnode.state.projects = result.data || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load projects:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },

    view(vnode) {
        const { projects, loading, filter, search } = vnode.state;

        if (loading) {
            return m(Layout, m(Loading));
        }

        let filteredProjects = projects;

        if (filter === 'mine') {
            filteredProjects = projects.filter(p => p.owner === 'ryan');
        } else if (filter === 'starred') {
            filteredProjects = projects.filter(p => p.starred);
        }

        if (search) {
            const searchLower = search.toLowerCase();
            filteredProjects = filteredProjects.filter(p =>
                p.name.toLowerCase().includes(searchLower) ||
                (p.description && p.description.toLowerCase().includes(searchLower))
            );
        }

        return m(Layout, [
            m('div.projects-page', [
                m('div.page-header', [
                    m('h1', '项目'),
                    m('div.page-actions', [
                        m('a.btn.btn-outline', {
                            href: '/projects/migrate'
                        }, [
                            m('i.fas.fa-download'),
                            ' 迁移项目'
                        ]),
                        m('a.btn.btn-primary', {
                            href: '/projects/new'
                        }, [
                            m('i.fas.fa-plus'),
                            ' 新建项目'
                        ])
                    ])
                ]),

                m('div.projects-toolbar', [
                    m('div.filter-tabs', [
                        m('button.filter-tab', {
                            class: filter === 'all' ? 'active' : '',
                            onclick: () => { vnode.state.filter = 'all'; }
                        }, '全部'),
                        m('button.filter-tab', {
                            class: filter === 'mine' ? 'active' : '',
                            onclick: () => { vnode.state.filter = 'mine'; }
                        }, '我的'),
                        m('button.filter-tab', {
                            class: filter === 'starred' ? 'active' : '',
                            onclick: () => { vnode.state.filter = 'starred'; }
                        }, '星标')
                    ]),
                    m('div.search-filter', [
                        m('i.fas.fa-search'),
                        m('input[type=text][placeholder=搜索项目...]', {
                            value: search,
                            oninput: (e) => { vnode.state.search = e.target.value; }
                        })
                    ])
                ]),

                filteredProjects.length === 0
                    ? m(EmptyState, { message: '暂无项目', icon: 'fa-folder-open' })
                    : m('div.projects-grid', filteredProjects.map(project =>
                        m(ProjectCard, { project })
                    ))
            ])
        ]);
    }
};


const getLanguageFromPath = (path) => {
    const ext = path.split('.').pop().toLowerCase();
    const langMap = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'py': 'python',
        'rb': 'ruby',
        'go': 'go',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'cc': 'cpp',
        'cxx': 'cpp',
        'h': 'c',
        'hpp': 'cpp',
        'cs': 'csharp',
        'php': 'php',
        'swift': 'swift',
        'kt': 'kotlin',
        'rs': 'rust',
        'sh': 'bash',
        'bash': 'bash',
        'zsh': 'bash',
        'ps1': 'powershell',
        'html': 'html',
        'htm': 'html',
        'css': 'css',
        'scss': 'scss',
        'sass': 'sass',
        'less': 'less',
        'json': 'json',
        'xml': 'xml',
        'yaml': 'yaml',
        'yml': 'yaml',
        'md': 'markdown',
        'sql': 'sql',
        'vue': 'vue',
        'svelte': 'svelte',
        'dockerfile': 'dockerfile',
        'makefile': 'makefile',
        'toml': 'toml',
        'ini': 'ini',
        'cfg': 'ini',
        'conf': 'nginx',
        'nginx': 'nginx',
        'apache': 'apache',
        'diff': 'diff',
        'patch': 'diff'
    };
    return langMap[ext] || null;
};

const highlightFile = (code, path) => {
    if (typeof hljs === 'undefined') {
        return code;
    }
    
    const language = getLanguageFromPath(path);
    if (language && hljs.getLanguage(language)) {
        try {
            return hljs.highlight(code, { language: language }).value;
        } catch (e) {
            console.error('Highlight error:', e);
        }
    }
    
    try {
        return hljs.highlightAuto(code).value;
    } catch (e) {
        console.error('Auto-highlight error:', e);
    }
    
    return code;
};

const ProjectDetail = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.issuesCount = 0;
        vnode.state.prsCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.loading = true;
        vnode.state.currentPath = '';
        vnode.state.currentBranch = 'HEAD';
        vnode.state.branches = [];
        vnode.state.tags = [];
        vnode.state.treeEntries = [];
        vnode.state.fileContent = null;
        vnode.state.showBranchMenu = false;
        vnode.state.activeTab = 'branches';
        vnode.state.lastCommit = null;
        
        const closeBranchMenu = (e) => {
            if (vnode.state.showBranchMenu) {
                const target = e.target;
                if (!target.closest('.branch-selector')) {
                    vnode.state.showBranchMenu = false;
                    m.redraw();
                }
            }
        };
        
        document.addEventListener('click', closeBranchMenu);
        
        vnode.state.cleanup = function() {
            document.removeEventListener('click', closeBranchMenu);
        };
        
        vnode.state.loadBranches = function() {
            RepositoryService.getBranches(owner, repo).then(result => {
                vnode.state.branches = result.branches || [];
                m.redraw();
            }).catch(() => {});
        };
        
        vnode.state.loadTags = function() {
            RepositoryService.getTags(owner, repo).then(result => {
                vnode.state.tags = result.tags || [];
                m.redraw();
            }).catch(() => {});
        };
        
        vnode.state.loadLastCommit = function() {
            RepositoryService.getLastCommit(owner, repo, vnode.state.currentBranch).then(result => {
                vnode.state.lastCommit = result.data || result;
                m.redraw();
            }).catch(() => {
                vnode.state.lastCommit = null;
            });
        };
        
        vnode.state.loadTree = function() {
            const branch = vnode.state.currentBranch;
            const path = vnode.state.currentPath;
            console.log('🌳 [loadTree] Starting...');
            console.log('🌳 [loadTree] Parameters:', { owner, repo, ref: branch, path });
            
            vnode.state.fileContent = null;
            
            console.log('🌳 [loadTree] Calling API: getTree(', owner, ',', repo, ', { path:', path, ', ref:', branch, '})');
            
            RepositoryService.getTree(owner, repo, { path: path, ref: branch }).then(result => {
                console.log('🌳 [loadTree] API Success! Result:', result);
                const entries = result.entries || [];
                console.log('🌳 [loadTree] Entries count:', entries.length);
                console.log('🌳 [loadTree] Updating treeEntries state...');
                vnode.state.treeEntries = entries;
                console.log('🌳 [loadTree] Calling m.redraw()...');
                m.redraw();
                console.log('🌳 [loadTree] ✅ Complete!');
            }).catch((error) => {
                console.error('❌ [loadTree] API Error:', error);
                console.error('❌ [loadTree] Error details:', error.message, error.stack);
                vnode.state.treeEntries = [];
                m.redraw();
            });
            
            console.log('🌳 [loadTree] Also calling loadLastCommit()...');
            vnode.state.loadLastCommit();
        };
        
        vnode.state.loadFile = function(path) {
            RepositoryService.getFile(owner, repo, { path: path, ref: vnode.state.currentBranch }).then(result => {
                vnode.state.fileContent = result.content;
                vnode.state.currentPath = path;
                m.redraw();
            }).catch(() => {
                vnode.state.fileContent = null;
                m.redraw();
            });
        };
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 }),
            TaskService.list(owner, repo, { per_page: 1 })
        ]).then(([repoResult, issuesResult, prsResult, tasksResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.loading = false;
            vnode.state.loadBranches();
            vnode.state.loadTags();
            vnode.state.loadTree();
            m.redraw();
        }).catch(error => {
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, issuesCount, prsCount, loading, currentPath, currentBranch, branches, tags, treeEntries, fileContent, showBranchMenu, activeTab, lastCommit } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        console.log('🎨 [view] Rendering...');
        console.log('🎨 [view] State:', {
            currentBranch,
            currentPath,
            treeEntriesCount: treeEntries.length,
            fileContent: fileContent ? 'has content' : null
        });
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        return m(Layout, [
            m('div.project-detail-page', [
                m(ProjectHeader, {
                    owner: owner,
                    repo: repo,
                    description: repo.description,
                    stars: repo.stars_count,
                    forks: repo.forks_count,
                    visibility: repo.is_private ? 'private' : 'public'
                }),
                
                m(ProjectTabs, {
                    owner: owner,
                    repo: repo,
                    issuesCount: issuesCount,
                    prsCount: prsCount,
                    tasksCount: vnode.state.tasksCount,
                    activeTab: 'code'
                }),
                
                m('div.project-layout', [
                    m('div.main-content', [
                        m('div.file-browser', [
                            m('div.file-browser-header', [
                                m('div.branch-selector', [
                                    m('div.branch-dropdown', {
                                        onclick: (e) => {
                                            e.stopPropagation();
                                            vnode.state.showBranchMenu = !vnode.state.showBranchMenu;
                                        }
                                    }, [
                                        m('i.fas.fa-code-branch'),
                                        m('span', currentBranch === 'HEAD' ? (repo.default_branch || 'main') : currentBranch),
                                        m('i.fas.fa-chevron-down')
                                    ]),
                                    showBranchMenu ? m('div.branch-menu', {
                                        onclick: (e) => { e.stopPropagation(); }
                                    }, [
                                        m('div.branch-menu-tabs', [
                                            m('div.branch-menu-tab', {
                                                class: activeTab === 'branches' ? 'active' : '',
                                                onclick: (e) => { 
                                                    e.stopPropagation();
                                                    vnode.state.activeTab = 'branches'; 
                                                }
                                            }, '分支'),
                                            m('div.branch-menu-tab', {
                                                class: activeTab === 'tags' ? 'active' : '',
                                                onclick: (e) => { 
                                                    e.stopPropagation();
                                                    vnode.state.activeTab = 'tags'; 
                                                }
                                            }, '标签')
                                        ]),
                                        m('div.branch-menu-list', [
                                            activeTab === 'branches' ? 
                                                branches.map(branch => 
                                                    m('div.branch-option', {
                                                        class: currentBranch === branch ? 'active' : '',
                                                        onclick: (e) => { 
                                                            console.log('=== Branch clicked ===');
                                                            console.log('Selected branch:', branch);
                                                            console.log('Previous branch:', currentBranch);
                                                            e.stopPropagation();
                                                            vnode.state.currentBranch = branch;
                                                            vnode.state.currentPath = '';
                                                            vnode.state.showBranchMenu = false;
                                                            console.log('About to call loadTree()...');
                                                            vnode.state.loadTree();
                                                            console.log('loadTree() called, triggering redraw...');
                                                            m.redraw();
                                                            console.log('=== Branch click complete ===');
                                                        }
                                                    }, [
                                                        m('i.fas.fa-check', { style: { visibility: currentBranch === branch ? 'visible' : 'hidden' } }),
                                                        branch
                                                    ])
                                                ) :
                                                tags.map(tag => 
                                                    m('div.branch-option', {
                                                        class: currentBranch === tag ? 'active' : '',
                                                        onclick: (e) => { 
                                                            e.stopPropagation();
                                                            vnode.state.currentBranch = tag;
                                                            vnode.state.currentPath = '';
                                                            vnode.state.showBranchMenu = false;
                                                            vnode.state.loadTree();
                                                            m.redraw();
                                                        }
                                                    }, [
                                                        m('i.fas.fa-check', { style: { visibility: currentBranch === tag ? 'visible' : 'hidden' } }),
                                                        m('i.fas.fa-tag'),
                                                        tag
                                                    ])
                                                )
                                        ])
                                    ]) : null
                                ]),
                                m('div.file-actions', [
                                    m('button.btn.btn-sm', [
                                        m('i.fas.fa-plus'),
                                        ' 添加文件'
                                    ]),
                                    m('button.btn.btn-sm', [
                                        m('i.fas.fa-download'),
                                        ' 下载'
                                    ])
                                ])
                            ]),
                            
                            m('div.path-breadcrumb-container', [
                                m('div.path-breadcrumb', renderBreadcrumb(owner, repo.name, currentPath, (path) => {
                                    vnode.state.currentPath = path;
                                    vnode.state.loadTree();
                                })),
                                lastCommit && lastCommit.time ? m('div.last-commit-info', [
                                    m('span.last-commit-time', `最后提交: ${lastCommit.time}`)
                                ]) : null
                            ]),
                            
                            fileContent !== null ? [
                                m('div.file-content-header', [
                                    m('span', currentPath.split('/').pop()),
                                    m('button.btn.btn-sm', { onclick: () => {
                                        const parts = currentPath.split('/');
                                        parts.pop();
                                        vnode.state.currentPath = parts.join('/');
                                        vnode.state.fileContent = null;
                                        vnode.state.loadTree();
                                    } }, '返回')
                                ]),
                                m('pre.file-content', [
                                    m('code', {
                                        class: 'hljs',
                                        oncreate: (vnode) => {
                                            const highlighted = highlightFile(fileContent, currentPath);
                                            vnode.dom.innerHTML = highlighted;
                                        }
                                    }, fileContent)
                                ])
                            ] : [
                                treeEntries.length === 0 
                                    ? m(EmptyState, { message: repo.local_path ? '此目录为空' : '仓库未初始化，请先同步代码', icon: 'fa-folder-open' })
                                    : (function() {
                                        console.log('📁 [view] Rendering file list with', treeEntries.length, 'entries');
                                        console.log('📁 [view] First entry:', treeEntries[0]);
                                        return m('div.file-list', treeEntries.map(entry => 
                                            m(TreeEntry, { 
                                                entry, 
                                                owner, 
                                                repo: repo.name,
                                                currentPath,
                                                onNavigate: (path, isFile) => {
                                                    if (isFile) {
                                                        vnode.state.loadFile(path);
                                                    } else {
                                                        vnode.state.currentPath = path;
                                                        vnode.state.loadTree();
                                                    }
                                                }
                                            })
                                        ));
                                    })()
                            ]
                        ])
                    ]),
                    
                    m('div.sidebar-info', [
                        m('div.info-card', [
                            m('h3', [ m('i.fas.fa-download'), ' 克隆' ]),
                            m('div.clone-box', [
                                m('input.clone-url[type=text]', { 
                                    value: `https://git.home504.io/${owner}/${repo.name}.git`,
                                    readonly: true
                                }),
                                m('button.clone-btn', {
                                    onclick: () => copyToClipboard(`https://git.home504.io/${owner}/${repo.name}.git`)
                                }, m('i.fas.fa-copy'))
                            ])
                        ]),
                        
                        m('div.info-card', [
                            m('h3', [ m('i.fas.fa-eye'), ' 关注' ]),
                            m('div.stat-row', [
                                m('span.stat-label', '星标'),
                                m('span.stat-value', repo.stars_count || 0)
                            ]),
                            m('div.stat-row', [
                                m('span.stat-label', 'Fork'),
                                m('span.stat-value', repo.forks_count || 0)
                            ]),
                            m('div.stat-row', [
                                m('span.stat-label', '关注'),
                                m('span.stat-value', repo.watch_count || 0)
                            ])
                        ])
                    ])
                ])
            ])
        ]);
    }
};

const TreeEntry = {
    view(vnode) {
        const { entry, owner, repo, currentPath, onNavigate } = vnode.attrs;
        const isTree = entry.type === 'tree';
        
        return m('div.file-item', {
            onclick: () => onNavigate(entry.path, !isTree),
            style: { cursor: 'pointer' }
        }, [
            m('span.file-icon', { class: isTree ? 'folder' : '' }, [
                m(`i.fas.${isTree ? 'fa-folder' : 'fa-file-code'}`)
            ]),
            m('span.file-name', entry.name),
            m('span.file-commit-message', entry.last_commit_message || ''),
            m('span.file-commit-time', entry.last_commit_time ? formatRelativeTime(entry.last_commit_time) : '')
        ]);
    }
};

function formatRelativeTime(timeStr) {
    const date = new Date(timeStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 7) {
        if (diffDays === 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours === 0) {
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                if (diffMinutes === 0) return '刚刚';
                return `${diffMinutes}分钟前`;
            }
            return `${diffHours}小时前`;
        }
        return `${diffDays}天前`;
    }
    
    return date.toLocaleDateString('zh-CN');
}

function formatSize(size) {
    const s = parseInt(size);
    if (isNaN(s) || s < 0) return '';
    if (s < 1024) return s + ' B';
    if (s < 1024 * 1024) return (s / 1024).toFixed(1) + ' KB';
    return (s / 1024 / 1024).toFixed(1) + ' MB';
}

function renderBreadcrumb(owner, repo, currentPath, onNavigate) {
    const parts = currentPath ? currentPath.split('/').filter(p => p) : [];
    
    let elements = [
        m('a', { 
            href: '#', 
            onclick: (e) => { e.preventDefault(); onNavigate(''); } 
        }, [
            m('i.fas.fa-map-marker-alt'),
            ` ${repo}`
        ])
    ];
    
    parts.forEach((part, index) => {
        const path = parts.slice(0, index + 1).join('/');
        elements.push(m('span', ' / '));
        elements.push(m('a', { 
            href: '#', 
            onclick: (e) => { e.preventDefault(); onNavigate(path); } 
        }, part));
    });
    
    return elements;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('已复制到剪贴板');
    });
}


const IssueList = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.issues = [];
        vnode.state.labels = [];
        vnode.state.loading = true;
        vnode.state.filter = 'open';
        vnode.state.labelFilter = '';
        vnode.state.prsCount = 0;
        vnode.state.tasksCount = 0;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo, { per_page: 1000 }),
            PullRequestService.list(owner, repo, { per_page: 1000 }),
            TaskService.list(owner, repo, { per_page: 1 }),
            LabelService.list(owner, repo)
        ]).then(([repoResult, issuesResult, prsResult, tasksResult, labelsResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issues = issuesResult.data || issuesResult || [];
            vnode.state.labels = labelsResult || [];
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load issues:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, issues, labels, loading, filter, labelFilter } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        let filteredIssues = issues.filter(issue => {
            if (filter === 'open') return !issue.is_closed;
            if (filter === 'closed') return issue.is_closed;
            return true;
        });
        
        if (labelFilter) {
            filteredIssues = filteredIssues.filter(issue => {
                if (!issue.labels || !issue.labels.length) return false;
                return issue.labels.some(l => l.name === labelFilter);
            });
        }
        
        const openCount = issues.filter(i => !i.is_closed).length;
        const closedCount = issues.filter(i => i.is_closed).length;
        
        return m(Layout, [
            m(ProjectHeader, { repo, owner }),
            m(ProjectTabs, { owner, repo: repo, activeTab: 'issues', issuesCount: openCount, prsCount: vnode.state.prsCount, tasksCount: vnode.state.tasksCount }),
            
            m('div.issues-page', [
                m('div.issues-header', [
                    m('div.issues-filters', [
                        m('button.filter-btn', {
                            class: filter === 'open' ? 'active' : '',
                            onclick: () => { vnode.state.filter = 'open'; }
                        }, [
                            m('i.fas.fa-exclamation-circle.open'),
                            ` ${openCount} 个开启`
                        ]),
                        m('button.filter-btn', {
                            class: filter === 'closed' ? 'active' : '',
                            onclick: () => { vnode.state.filter = 'closed'; }
                        }, [
                            m('i.fas.fa-check-circle.closed'),
                            ` ${closedCount} 个已关闭`
                        ])
                    ]),
                    m('button.btn.btn-primary', {
                        onclick: () => { m.route.set(`/issues/${owner}/${repo.name}/new`); }
                    }, [
                        m('i.fas.fa-plus'),
                        ' 新建议题'
                    ])
                ]),
                
                labels.length > 0 ? m('div.label-filters', [
                    m('span.label-filter-title', '标签过滤:'),
                    m('button.label-filter-btn', {
                        class: labelFilter === '' ? 'active' : '',
                        onclick: () => { vnode.state.labelFilter = ''; }
                    }, '全部'),
                    ...labels.map(label => 
                        m('button.label-filter-btn', {
                            class: labelFilter === label.name ? 'active' : '',
                            style: labelFilter === label.name ? `background-color: ${label.color}; color: white;` : `border-color: ${label.color};`,
                            onclick: () => { vnode.state.labelFilter = label.name; }
                        }, label.name)
                    )
                ]) : null,
                
                filteredIssues.length === 0 ? 
                    m(EmptyState, { 
                        message: filter === 'open' ? '没有开启的议题' : '没有已关闭的议题', 
                        icon: 'fa-inbox' 
                    }) :
                    m('div.issue-list', filteredIssues.map(issue => 
                        m(IssueItem, { issue, owner, repo: repo.name })
                    ))
            ])
        ]);
    }
};


const CommentService = {
    list(owner, repo, issueNumber) {
        return API.get(`/${owner}/${repo}/issues/${issueNumber}/comments`);
    },
    
    create(owner, repo, issueNumber, data) {
        return API.post(`/${owner}/${repo}/issues/${issueNumber}/comments`, data);
    }
};

const IssueDetail = {
    oninit(vnode) {
        IssueDetail.loadData(vnode);
    },
    
    onbeforeupdate(vnode) {
        const { number: newNumber } = vnode.attrs;
        const { number: oldNumber } = vnode.state;
        
        if (newNumber !== oldNumber) {
            vnode.state.loading = true;
            vnode.state.comments = [];
            IssueDetail.loadData(vnode);
        }
    },
    
    loadData(vnode) {
        const { owner, repo, number } = vnode.attrs;
        
        vnode.state.number = number;
        vnode.state.repo = null;
        vnode.state.issue = null;
        vnode.state.labels = [];
        vnode.state.comments = [];
        vnode.state.loading = true;
        vnode.state.issuesCount = 0;
        vnode.state.prsCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.editMode = false;
        vnode.state.editTitle = '';
        vnode.state.editBody = '';
        vnode.state.editLabels = [];
        vnode.state.newComment = '';
        vnode.state.submitting = false;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.get(owner, repo, number),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 }),
            LabelService.list(owner, repo),
            TaskService.list(owner, repo, { per_page: 1 })
        ]).then(([repoResult, issueResult, issuesResult, prsResult, labelsResult, tasksResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issue = issueResult.data || issueResult;
            vnode.state.labels = labelsResult || [];
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.editTitle = vnode.state.issue.title;
            vnode.state.editBody = vnode.state.issue.body || '';
            vnode.state.editLabels = (vnode.state.issue.labels || []).map(l => l.name);
            vnode.state.loading = false;
            vnode.state.loadComments();
            m.redraw();
        }).catch(error => {
            console.error('Failed to load issue:', error);
            vnode.state.loading = false;
            m.redraw();
        });
        
        vnode.state.loadComments = function() {
            CommentService.list(owner, repo, number).then(result => {
                vnode.state.comments = result.data || result || [];
                m.redraw();
            }).catch(() => {
                vnode.state.comments = [];
            });
        };
    },
    
    handleSave: function(vnode) {
        const { owner, repo, number } = vnode.attrs;
        const { editTitle, editBody, editLabels, submitting } = vnode.state;
        
        if (submitting) return;
        if (!editTitle.trim()) {
            alert('标题不能为空');
            return;
        }
        
        vnode.state.submitting = true;
        
        IssueService.update(owner, repo, number, {
            title: editTitle,
            body: editBody,
            labels: editLabels
        }).then(result => {
            vnode.state.issue = result.data || result;
            vnode.state.editMode = false;
            vnode.state.submitting = false;
            m.redraw();
        }).catch(error => {
            vnode.state.submitting = false;
            alert('保存失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },
    
    handleClose: function(vnode) {
        const { owner, repo, number } = vnode.attrs;
        const { issue } = vnode.state;
        
        if (!confirm(issue.is_closed ? '确定要重新打开此 Issue 吗？' : '确定要关闭此 Issue 吗？')) {
            return;
        }
        
        IssueService.update(owner, repo, number, {
            is_closed: !issue.is_closed
        }).then(result => {
            vnode.state.issue = result.data || result;
            vnode.state.issuesCount += issue.is_closed ? 1 : -1;
            m.redraw();
        }).catch(error => {
            alert('操作失败: ' + (error.message || '未知错误'));
        });
    },
    
    handleAddComment: function(vnode) {
        const { owner, repo, number } = vnode.attrs;
        const { newComment, submitting } = vnode.state;
        
        if (submitting) return;
        if (!newComment.trim()) {
            alert('评论内容不能为空');
            return;
        }
        
        vnode.state.submitting = true;
        
        CommentService.create(owner, repo, number, {
            body: newComment
        }).then(result => {
            vnode.state.comments.push(result.data || result);
            vnode.state.newComment = '';
            vnode.state.submitting = false;
            m.redraw();
        }).catch(error => {
            vnode.state.submitting = false;
            alert('评论失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, issue, labels, comments, loading, editMode, editTitle, editBody, editLabels, newComment, submitting } = vnode.state;
        const { owner, repo: repoName, number } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo || !issue) {
            return m(Layout, m(EmptyState, { message: 'Issue 不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        return m(Layout, [
            m(ProjectHeader, {
                owner: owner,
                repo: repo,
                description: repo.description,
                stars: repo.stars_count,
                forks: repo.forks_count,
                visibility: repo.is_private ? 'private' : 'public'
            }),
            
            m(ProjectTabs, {
                owner: owner,
                repo: repo,
                issuesCount: vnode.state.issuesCount,
                prsCount: vnode.state.prsCount,
                tasksCount: vnode.state.tasksCount,
                activeTab: 'issues'
            }),
            
            m('div.issue-detail-content', [
                m('div.issue-detail-header', [
                    m('div.issue-title-row', [
                        m('div.issue-number', `#${issue.number}`),
                        editMode ? 
                            m('input.issue-title-input', {
                                value: editTitle,
                                oninput: (e) => { vnode.state.editTitle = e.target.value; }
                            }) :
                            m('h1.issue-title', issue.title),
                        m('div.issue-status-badge', { 
                            class: issue.is_closed ? 'closed' : 'open' 
                        }, issue.is_closed ? '已关闭' : '开启')
                    ]),
                    m('div.issue-meta', [
                        m('span', `由 ${issue.author} 创建于 ${formatTime(issue.created_at)}`),
                        issue.updated_at !== issue.created_at ? 
                            m('span', ` · 更新于 ${formatTime(issue.updated_at)}`) : null
                    ])
                ]),
                
                m('div.issue-detail-body', [
                    m('div.issue-main', [
                        m('div.issue-description', [
                            editMode ? [
                                m('div.form-group', [
                                    m('label.form-label', '描述'),
                                    m(MarkdownEditor, {
                                        value: editBody,
                                        oninput: (e) => { vnode.state.editBody = e.target.value; },
                                        placeholder: '添加描述... (支持 Markdown 格式)',
                                        rows: 10,
                                        owner: owner,
                                        repo: repo.name
                                    })
                                ]),
                                m('div.issue-edit-actions', [
                                    m('button.btn.btn-primary', {
                                        onclick: () => IssueDetail.handleSave(vnode),
                                        disabled: submitting
                                    }, submitting ? '保存中...' : '保存'),
                                    m('button.btn', {
                                        onclick: () => { 
                                            vnode.state.editMode = false; 
                                            vnode.state.editLabels = (issue.labels || []).map(l => l.name);
                                        }
                                    }, '取消')
                                ])
                            ] : [
                                m('div.issue-body', [
                                    m(MarkdownRenderer, { content: issue.body || '暂无描述', owner, repo: repo.name })
                                ]),
                                m('div.issue-actions', [
                                    m('button.btn.btn-sm', {
                                        onclick: () => { 
                                            vnode.state.editMode = true; 
                                            vnode.state.editLabels = (issue.labels || []).map(l => l.name);
                                        }
                                    }, [m('i.fas.fa-edit'), ' 编辑']),
                                    m('button.btn.btn-sm', {
                                        onclick: () => IssueDetail.handleClose(vnode)
                                    }, issue.is_closed ? [m('i.fas.fa-redo'), ' 重新打开'] : [m('i.fas.fa-times'), ' 关闭'])
                                ])
                            ]
                        ]),
                        
                        m('div.issue-comments', [
                            m('h3', '评论'),
                            comments.length === 0 ? 
                                m('p.no-comments', '暂无评论') :
                                m('div.comment-list', comments.map(comment => 
                                    m('div.comment-item', [
                                        m('div.comment-header', [
                                            m('span.comment-author', comment.author),
                                            m('span.comment-time', formatTime(comment.created_at))
                                        ]),
                                        m('div.comment-body', [
                                            m(MarkdownRenderer, { content: comment.body, owner, repo: repo.name })
                                        ])
                                    ])
                                )),
                            
                            m('div.comment-form', [
                                m('textarea.comment-input', {
                                    placeholder: '添加评论...',
                                    value: newComment,
                                    oninput: (e) => { vnode.state.newComment = e.target.value; }
                                }),
                                m('button.btn.btn-primary', {
                                    onclick: () => IssueDetail.handleAddComment(vnode),
                                    disabled: submitting || !newComment.trim()
                                }, '发表评论')
                            ])
                        ])
                    ]),
                    
                    m('div.issue-sidebar', [
                        m('div.sidebar-card', [
                            m('h4', '指派给'),
                            m('p', issue.assignee || '未指派')
                        ]),
                        m('div.sidebar-card', [
                            m('h4', '标签'),
                            editMode ? 
                                m('div.labels-editor', labels.map(label => 
                                    m('button.btn.btn-sm.label-btn', {
                                        type: 'button',
                                        class: editLabels.includes(label.name) ? 'active' : '',
                                        style: editLabels.includes(label.name) ? `background-color: ${label.color}; color: white; border-color: ${label.color};` : `border-color: ${label.color};`,
                                        onclick: () => {
                                            if (editLabels.includes(label.name)) {
                                                vnode.state.editLabels = editLabels.filter(l => l !== label.name);
                                            } else {
                                                vnode.state.editLabels.push(label.name);
                                            }
                                        }
                                    }, label.name)
                                )) :
                                (issue.labels && issue.labels.length > 0 ? 
                                    m('div.issue-labels-list', issue.labels.map(label => 
                                        m('span.issue-label', { style: { backgroundColor: label.color } }, label.name)
                                    )) :
                                    m('p', '暂无标签')
                                )
                        ])
                    ])
                ])
            ])
        ]);
    }
};


const NewIssue = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.labels = [];
        vnode.state.loading = true;
        vnode.state.submitting = false;
        vnode.state.prsCount = 0;
        vnode.state.issuesCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.formData = {
            title: '',
            body: '',
            labels: []
        };
        
        Promise.all([
            RepositoryService.get(owner, repo),
            LabelService.list(owner, repo),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 }),
            TaskService.list(owner, repo, { per_page: 1 })
        ]).then(([repoResult, labelsResult, issuesResult, prsResult, tasksResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.labels = labelsResult || [];
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load data:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    handleSubmit(vnode) {
        const { owner, repo } = vnode.attrs;
        const { formData, submitting } = vnode.state;
        
        if (submitting) return;
        
        if (!formData.title.trim()) {
            alert('标题不能为空');
            return;
        }
        
        vnode.state.submitting = true;
        
        IssueService.create(owner, repo, formData).then(result => {
            const issue = result.data || result;
            m.route.set(`/issues/${owner}/${repo}/${issue.number}`);
        }).catch(error => {
            vnode.state.submitting = false;
            alert('创建议题失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },
    
    view(vnode) {
        const { owner, repo: repoName } = vnode.attrs;
        const { repo, labels, loading, submitting, formData, issuesCount, prsCount } = vnode.state;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m('div.empty-state', '项目不存在'));
        }
        
        return m(Layout, [
            m(ProjectHeader, {
                owner: owner,
                repo: repo,
                description: repo.description,
                stars: repo.stars_count,
                forks: repo.forks_count,
                visibility: repo.is_private ? 'private' : 'public'
            }),
            
            m(ProjectTabs, {
                owner: owner,
                repo: repo,
                issuesCount: issuesCount,
                prsCount: prsCount,
                tasksCount: vnode.state.tasksCount,
                activeTab: 'issues'
            }),
            
            m('div.new-issue-page', [
                m('div.breadcrumb', [
                    m('a', { href: '/', oncreate: m.route.link }, '首页'),
                    ' / ',
                    m('a', { href: `/issues/${owner}/${repo.name}`, oncreate: m.route.link }, '议题'),
                    ' / 新建'
                ]),
                
                m('div.new-issue-container', [
                    m('div.new-issue-main', [
                        m('div.form-card', [
                            m('div.form-group', [
                                m('label.form-label', { for: 'issue-title' }, '标题'),
                                m('input#issue-title.form-input', {
                                    type: 'text',
                                    placeholder: '标题',
                                    value: formData.title,
                                    oninput: (e) => {
                                        vnode.state.formData.title = e.target.value;
                                    }
                                })
                            ]),
                            
                            m('div.form-group', [
                                m('label.form-label', { for: 'issue-body' }, '描述'),
                                m('div.editor-toolbar', [
                                    m('button.toolbar-btn', {
                                        type: 'button',
                                        onclick: () => {
                                            const textarea = document.querySelector('#issue-body-textarea');
                                            if (textarea) {
                                                const start = textarea.selectionStart;
                                                const end = textarea.selectionEnd;
                                                const text = formData.body || '';
                                                const before = text.substring(0, start);
                                                const after = text.substring(end);
                                                vnode.state.formData.body = before + '****' + after;
                                                m.redraw();
                                            }
                                        }
                                    }, m('i.fas.fa-bold')),
                                    m('button.toolbar-btn', {
                                        type: 'button',
                                        onclick: () => {
                                            const textarea = document.querySelector('#issue-body-textarea');
                                            if (textarea) {
                                                const start = textarea.selectionStart;
                                                const end = textarea.selectionEnd;
                                                const text = formData.body || '';
                                                const before = text.substring(0, start);
                                                const after = text.substring(end);
                                                vnode.state.formData.body = before + '**' + after;
                                                m.redraw();
                                            }
                                        }
                                    }, m('i.fas.fa-italic')),
                                    m('button.toolbar-btn', {
                                        type: 'button',
                                        onclick: () => {
                                            const textarea = document.querySelector('#issue-body-textarea');
                                            if (textarea) {
                                                const start = textarea.selectionStart;
                                                const end = textarea.selectionEnd;
                                                const text = formData.body || '';
                                                const before = text.substring(0, start);
                                                const after = text.substring(end);
                                                vnode.state.formData.body = before + '`code`' + after;
                                                m.redraw();
                                            }
                                        }
                                    }, m('i.fas.fa-code')),
                                    m('button.toolbar-btn', {
                                        type: 'button',
                                        onclick: () => {
                                            const textarea = document.querySelector('#issue-body-textarea');
                                            if (textarea) {
                                                const start = textarea.selectionStart;
                                                const end = textarea.selectionEnd;
                                                const text = formData.body || '';
                                                const before = text.substring(0, start);
                                                const after = text.substring(end);
                                                vnode.state.formData.body = before + '[链接文字](url)' + after;
                                                m.redraw();
                                            }
                                        }
                                    }, m('i.fas.fa-link')),
                                    m('button.toolbar-btn', {
                                        type: 'button',
                                        onclick: () => {
                                            const textarea = document.querySelector('#issue-body-textarea');
                                            if (textarea) {
                                                const start = textarea.selectionStart;
                                                const end = textarea.selectionEnd;
                                                const text = formData.body || '';
                                                const before = text.substring(0, start);
                                                const after = text.substring(end);
                                                vnode.state.formData.body = before + '![图片alt](url)' + after;
                                                m.redraw();
                                            }
                                        }
                                    }, m('i.fas.fa-image'))
                                ]),
                                m('textarea#issue-body-textarea.form-textarea', {
                                    placeholder: '添加描述...',
                                    rows: 10,
                                    value: formData.body,
                                    oninput: (e) => {
                                        vnode.state.formData.body = e.target.value;
                                    }
                                })
                            ]),
                            
                            m('div.form-actions', [
                                m('button.btn.btn-primary', {
                                    onclick: () => NewIssue.handleSubmit(vnode),
                                    disabled: submitting || !formData.title.trim()
                                }, submitting ? '提交中...' : '提交新议题'),
                                m('button.btn', {
                                    onclick: () => {
                                        m.route.set(`/issues/${owner}/${repo.name}`);
                                    }
                                }, '取消')
                            ])
                        ])
                    ]),
                    
                    m('div.new-issue-sidebar', [
                        m('div.sidebar-card', [
                            m('h4', '标签'),
                            labels.length > 0 ?
                                m('div.labels-list', labels.map(label => 
                                    m('button.label-item', {
                                        class: formData.labels.includes(label.name) ? 'selected' : '',
                                        onclick: () => {
                                            if (formData.labels.includes(label.name)) {
                                                vnode.state.formData.labels = formData.labels.filter(l => l !== label.name);
                                            } else {
                                                vnode.state.formData.labels.push(label.name);
                                            }
                                        }
                                    }, [
                                        m('span.label-color', {
                                            style: { backgroundColor: label.color }
                                        }),
                                        m('span.label-name', label.name)
                                    ])
                                )) :
                                m('p.no-labels', '暂无标签')
                        ]),
                        
                        m('div.sidebar-card', [
                            m('h4', '指派给'),
                            m('p', '未指派')
                        ]),
                        
                        m('div.sidebar-card', [
                            m('h4', '项目'),
                            m('p', '无')
                        ])
                    ])
                ])
            ])
        ]);
    }
};


const PullRequestList = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.prs = [];
        vnode.state.loading = true;
        vnode.state.filter = 'open';
        vnode.state.issuesCount = 0;
        vnode.state.tasksCount = 0;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            PullRequestService.list(owner, repo, { per_page: 1000 }),
            IssueService.list(owner, repo, { per_page: 1000 }),
            TaskService.list(owner, repo, { per_page: 1 })
        ]).then(([repoResult, prsResult, issuesResult, tasksResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.prs = prsResult.data || prsResult || [];
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load pull requests:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, prs, loading, filter } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        const openPRs = prs.filter(p => !p.is_closed && !p.is_merged);
        const mergedPRs = prs.filter(p => p.is_merged);
        const closedPRs = prs.filter(p => p.is_closed && !p.is_merged);
        
        let filteredPRs = [];
        if (filter === 'open') filteredPRs = openPRs;
        else if (filter === 'merged') filteredPRs = mergedPRs;
        else if (filter === 'closed') filteredPRs = closedPRs;
        
        return m(Layout, [
            m('div.pull-requests-page', [
                m(ProjectHeader, {
                    owner: owner,
                    repo: repo,
                    description: repo.description,
                    stars: repo.stars_count,
                    forks: repo.forks_count,
                    visibility: repo.is_private ? 'private' : 'public'
                }),
                
                m(ProjectTabs, {
                    owner: owner,
                    repo: repo,
                    issuesCount: vnode.state.issuesCount,
                    prsCount: openPRs.length,
                    tasksCount: vnode.state.tasksCount,
                    activeTab: 'prs'
                }),
                
                m('div.pull-requests-content', [
                    m('div.pull-requests-toolbar', [
                        m('div.filter-tabs', [
                            m('button.filter-tab', {
                                class: filter === 'open' ? 'active' : '',
                                onclick: () => { vnode.state.filter = 'open'; }
                            }, [
                                m('i.fas.fa-code-branch.open'),
                                ` ${openPRs.length} 个开启`
                            ]),
                            m('button.filter-tab', {
                                class: filter === 'merged' ? 'active' : '',
                                onclick: () => { vnode.state.filter = 'merged'; }
                            }, [
                                m('i.fas.fa-code-branch.merged'),
                                ` ${mergedPRs.length} 个已合并`
                            ]),
                            m('button.filter-tab', {
                                class: filter === 'closed' ? 'active' : '',
                                onclick: () => { vnode.state.filter = 'closed'; }
                            }, [
                                m('i.fas.fa-times-circle.closed'),
                                ` ${closedPRs.length} 个已关闭`
                            ])
                        ]),
                        m('button.btn.btn-primary', {
                            onclick: () => { m.route.set(`/pull-requests/${owner}/${repo.name}/new`); }
                        }, [
                            m('i.fas.fa-plus'),
                            ' 新建 PR'
                        ])
                    ]),
                    
                    filteredPRs.length === 0 
                        ? m(EmptyState, { 
                            message: filter === 'open' ? '暂无开启的 PR' : 
                                     filter === 'merged' ? '暂无已合并的 PR' : '暂无已关闭的 PR',
                            icon: 'fa-code-branch'
                        })
                        : m('div.pull-requests-list', filteredPRs.map(pr => 
                            m(PRItem, { pr, owner, repo: repo.name })
                        ))
                ])
            ])
        ]);
    }
};


const PRCommentService = {
    list(owner, repo, prNumber) {
        return API.get(`/${owner}/${repo}/pull_requests/${prNumber}/comments`);
    },
    
    create(owner, repo, prNumber, data) {
        return API.post(`/${owner}/${repo}/pull_requests/${prNumber}/comments`, data);
    }
};

const PRCommitsService = {
    list(owner, repo, prNumber, params = {}) {
        return API.get(`/${owner}/${repo}/pull_requests/${prNumber}/commits`, params);
    }
};

const PRFilesService = {
    list(owner, repo, prNumber) {
        return API.get(`/${owner}/${repo}/pull_requests/${prNumber}/files`);
    }
};

const PullRequestDetail = {
    oninit(vnode) {
        PullRequestDetail.loadData(vnode);
    },
    
    onbeforeupdate(vnode) {
        const { number: newNumber } = vnode.attrs;
        const { number: oldNumber } = vnode.state;
        
        if (newNumber !== oldNumber) {
            vnode.state.loading = true;
            vnode.state.comments = [];
            PullRequestDetail.loadData(vnode);
        }
    },
    
    loadData(vnode) {
        const { owner, repo, number } = vnode.attrs;
        
        vnode.state.number = number;
        vnode.state.repo = null;
        vnode.state.pr = null;
        vnode.state.comments = [];
        vnode.state.loading = true;
        vnode.state.issuesCount = 0;
        vnode.state.prsCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.editMode = false;
        vnode.state.editTitle = '';
        vnode.state.editBody = '';
        vnode.state.newComment = '';
        vnode.state.submitting = false;
        vnode.state.activeTab = 'conversation';
        vnode.state.commits = [];
        vnode.state.commitsTotal = 0;
        vnode.state.files = [];
        vnode.state.totalAdditions = 0;
        vnode.state.totalDeletions = 0;
        vnode.state.expandedFiles = new Set();
        
        vnode.state.loadComments = function() {
            PRCommentService.list(owner, repo, number).then(result => {
                vnode.state.comments = result.data || result || [];
                m.redraw();
            }).catch(() => {
                vnode.state.comments = [];
            });
        };
        
        vnode.state.loadCommits = function() {
            PRCommitsService.list(owner, repo, number).then(result => {
                vnode.state.commits = result.commits || [];
                vnode.state.commitsTotal = result.total || 0;
                m.redraw();
            }).catch(() => {
                vnode.state.commits = [];
                vnode.state.commitsTotal = 0;
            });
        };
        
        vnode.state.loadFiles = function() {
            PRFilesService.list(owner, repo, number).then(result => {
                vnode.state.files = result.files || [];
                vnode.state.totalAdditions = result.total_additions || 0;
                vnode.state.totalDeletions = result.total_deletions || 0;
                m.redraw();
            }).catch(() => {
                vnode.state.files = [];
                vnode.state.totalAdditions = 0;
                vnode.state.totalDeletions = 0;
            });
        };
        
        Promise.all([
            RepositoryService.get(owner, repo),
            PullRequestService.get(owner, repo, number),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 }),
            TaskService.list(owner, repo, { per_page: 1 })
        ]).then(([repoResult, prResult, issuesResult, prsResult, tasksResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.pr = prResult.data || prResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.editTitle = vnode.state.pr.title;
            vnode.state.editBody = vnode.state.pr.body || '';
            vnode.state.loading = false;
            vnode.state.loadComments();
            vnode.state.loadCommits();
            vnode.state.loadFiles();
            m.redraw();
        }).catch(error => {
            console.error('Failed to load pull request:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    handleSave: function(vnode) {
        const { owner, repo, number } = vnode.attrs;
        const { editTitle, editBody, submitting } = vnode.state;
        
        if (submitting) return;
        if (!editTitle.trim()) {
            alert('标题不能为空');
            return;
        }
        
        vnode.state.submitting = true;
        
        PullRequestService.update(owner, repo, number, {
            title: editTitle,
            body: editBody
        }).then(result => {
            vnode.state.pr = result.data || result;
            vnode.state.editMode = false;
            vnode.state.submitting = false;
            m.redraw();
        }).catch(error => {
            vnode.state.submitting = false;
            alert('保存失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },
    
    handleMerge: function(vnode) {
        const { owner, repo, number } = vnode.attrs;
        
        if (!confirm('确定要合并此 PR 吗？')) {
            return;
        }
        
        PullRequestService.merge(owner, repo, number).then(result => {
            vnode.state.pr = result.pr || vnode.state.pr;
            vnode.state.pr.is_merged = true;
            vnode.state.pr.is_closed = true;
            vnode.state.pr.status = 'merged';
            vnode.state.prsCount--;
            m.redraw();
        }).catch(error => {
            alert('合并失败: ' + (error.message || '未知错误'));
        });
    },
    
    handleClose: function(vnode) {
        const { owner, repo, number } = vnode.attrs;
        
        if (!confirm('确定要关闭此 PR 吗？')) {
            return;
        }
        
        PullRequestService.close(owner, repo, number).then(result => {
            vnode.state.pr = result.pr || vnode.state.pr;
            vnode.state.pr.is_closed = true;
            vnode.state.pr.status = 'closed';
            vnode.state.prsCount--;
            m.redraw();
        }).catch(error => {
            alert('关闭失败: ' + (error.message || '未知错误'));
        });
    },
    
    handleReopen: function(vnode) {
        const { owner, repo, number } = vnode.attrs;
        
        if (!confirm('确定要重新打开此 PR 吗？')) {
            return;
        }
        
        PullRequestService.reopen(owner, repo, number).then(result => {
            vnode.state.pr = result.pr || vnode.state.pr;
            vnode.state.pr.is_closed = false;
            vnode.state.pr.is_merged = false;
            vnode.state.pr.status = 'open';
            vnode.state.prsCount++;
            m.redraw();
        }).catch(error => {
            alert('重新打开失败: ' + (error.message || '未知错误'));
        });
    },
    
    handleAddComment: function(vnode) {
        const { owner, repo, number } = vnode.attrs;
        const { newComment, submitting } = vnode.state;
        
        if (submitting) return;
        if (!newComment.trim()) {
            alert('评论内容不能为空');
            return;
        }
        
        vnode.state.submitting = true;
        
        PRCommentService.create(owner, repo, number, {
            body: newComment
        }).then(result => {
            vnode.state.comments.push(result.data || result);
            vnode.state.newComment = '';
            vnode.state.submitting = false;
            m.redraw();
        }).catch(error => {
            vnode.state.submitting = false;
            alert('评论失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },
    
    renderDiff: function(patch) {
        if (!patch) return '';
        
        let html = patch
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        const lines = html.split('\n');
        let result = [];
        let inHunk = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.startsWith('@@')) {
                inHunk = true;
                result.push(`<div class="diff-hunk-header">${line}</div>`);
                continue;
            }
            
            if (line.startsWith('diff --git') || 
                line.startsWith('index ') || 
                line.startsWith('--- ') || 
                line.startsWith('+++ ')) {
                inHunk = false;
                result.push(`<div class="diff-file-header">${line}</div>`);
                continue;
            }
            
            if (!inHunk) continue;
            
            if (line.startsWith('+') && !line.startsWith('+++')) {
                result.push(`<div class="diff-line diff-addition">${line.substring(1)}</div>`);
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                result.push(`<div class="diff-line diff-deletion">${line.substring(1)}</div>`);
            } else if (line === '\\ No newline at end of file') {
                continue;
            } else {
                result.push(`<div class="diff-line diff-context">${line.substring(1)}</div>`);
            }
        }
        
        return result.join('');
    },
    
    view(vnode) {
        const { repo, pr, comments, loading, editMode, editTitle, editBody, newComment, submitting, activeTab, commits, commitsTotal, files, totalAdditions, totalDeletions } = vnode.state;
        const { owner, repo: repoName, number } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo || !pr) {
            return m(Layout, m(EmptyState, { message: 'PR 不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        let statusClass = 'open';
        let statusText = '开启';
        if (pr.is_merged) {
            statusClass = 'merged';
            statusText = '已合并';
        } else if (pr.is_closed) {
            statusClass = 'closed';
            statusText = '已关闭';
        }
        
        return m(Layout, [
            m(ProjectHeader, {
                owner: owner,
                repo: repo,
                description: repo.description,
                stars: repo.stars_count,
                forks: repo.forks_count,
                visibility: repo.is_private ? 'private' : 'public'
            }),
            
            m(ProjectTabs, {
                owner: owner,
                repo: repo,
                issuesCount: vnode.state.issuesCount,
                prsCount: vnode.state.prsCount,
                tasksCount: vnode.state.tasksCount,
                activeTab: 'prs'
            }),
            
            m('div.pr-detail-content', [
                m('div.pr-detail-header', [
                    m('div.pr-title-row', [
                        m('div.pr-number', `#${pr.number}`),
                        editMode ? 
                            m('input.pr-title-input', {
                                value: editTitle,
                                oninput: (e) => { vnode.state.editTitle = e.target.value; }
                            }) :
                            m('h1.pr-title', pr.title),
                        m('div.pr-status-badge', { 
                            class: statusClass
                        }, statusText)
                    ]),
                    m('div.pr-meta', [
                        m('span', [
                            m('strong', pr.source_branch),
                            ' → ',
                            m('strong', pr.target_branch)
                        ]),
                        m('span', ' · '),
                        m('span', `由 ${pr.author || '未知'} 创建于 ${formatTime(pr.created_at)}`),
                        pr.updated_at !== pr.created_at ? 
                            m('span', ` · 更新于 ${formatTime(pr.updated_at)}`) : null
                    ])
                ]),
                
                m('div.pr-tabs', [
                    m('button.pr-tab-btn', {
                        class: activeTab === 'conversation' ? 'active' : '',
                        onclick: () => { vnode.state.activeTab = 'conversation'; }
                    }, [
                        m('i.fas.fa-comments'),
                        ' 对话',
                        comments.length > 0 ? m('span.tab-count', comments.length) : ''
                    ]),
                    m('button.pr-tab-btn', {
                        class: activeTab === 'commits' ? 'active' : '',
                        onclick: () => { vnode.state.activeTab = 'commits'; }
                    }, [
                        m('i.fas.fa-code-commit'),
                        ' Commits',
                        commitsTotal > 0 ? m('span.tab-count', commitsTotal) : ''
                    ]),
                    m('button.pr-tab-btn', {
                        class: activeTab === 'files' ? 'active' : '',
                        onclick: () => { vnode.state.activeTab = 'files'; }
                    }, [
                        m('i.fas.fa-file-code'),
                        ' Files changed',
                        files.length > 0 ? m('span.tab-count', `${totalAdditions}+ ${totalDeletions}-`) : ''
                    ])
                ]),
                
                activeTab === 'conversation' && m('div.pr-conversation-tab', [
                    m('div.pr-main', [
                        m('div.pr-description', [
                            editMode ? [
                                m('textarea.pr-body-textarea', {
                                    value: editBody,
                                    oninput: (e) => { vnode.state.editBody = e.target.value; },
                                    placeholder: '添加描述...'
                                }),
                                m('div.pr-edit-actions', [
                                    m('button.btn.btn-primary', {
                                        onclick: () => PullRequestDetail.handleSave(vnode),
                                        disabled: submitting
                                    }, submitting ? '保存中...' : '保存'),
                                    m('button.btn', {
                                        onclick: () => { vnode.state.editMode = false; }
                                    }, '取消')
                                ])
                            ] : [
                                m('div.pr-body', [
                                    m(MarkdownRenderer, { content: pr.body || '暂无描述', owner, repo: repo.name })
                                ]),
                                m('div.pr-actions', [
                                    m('button.btn.btn-sm', {
                                        onclick: () => { vnode.state.editMode = true; }
                                    }, [m('i.fas.fa-edit'), ' 编辑']),
                                    !pr.is_closed && !pr.is_merged ? [
                                        m('button.btn.btn-sm.btn-success', {
                                            onclick: () => PullRequestDetail.handleMerge(vnode)
                                        }, [m('i.fas.fa-code-branch'), ' 合并']),
                                        m('button.btn.btn-sm', {
                                            onclick: () => PullRequestDetail.handleClose(vnode)
                                        }, [m('i.fas.fa-times'), ' 关闭'])
                                    ] : pr.is_closed && !pr.is_merged ? [
                                        m('button.btn.btn-sm', {
                                            onclick: () => PullRequestDetail.handleReopen(vnode)
                                        }, [m('i.fas.fa-redo'), ' 重新打开'])
                                    ] : null
                                ])
                            ]
                        ]),
                        
                        m('div.pr-comments', [
                            m('h3', '评论'),
                            comments.length === 0 ? 
                                m('p.no-comments', '暂无评论') :
                                m('div.comment-list', comments.map(comment => 
                                    m('div.comment-item', [
                                        m('div.comment-header', [
                                            m('span.comment-author', comment.author),
                                            m('span.comment-time', formatTime(comment.created_at))
                                        ]),
                                        m('div.comment-body', [
                                            m(MarkdownRenderer, { content: comment.body, owner, repo: repo.name })
                                        ])
                                    ])
                                )),
                            
                            m('div.comment-form', [
                                m('textarea.comment-input', {
                                    placeholder: '添加评论...',
                                    value: newComment,
                                    oninput: (e) => { vnode.state.newComment = e.target.value; }
                                }),
                                m('button.btn.btn-primary', {
                                    onclick: () => PullRequestDetail.handleAddComment(vnode),
                                    disabled: submitting || !newComment.trim()
                                }, '发表评论')
                            ])
                        ])
                    ]),
                    
                    m('div.pr-sidebar', [
                        m('div.sidebar-card', [
                            m('h4', '源分支'),
                            m('p', pr.source_branch)
                        ]),
                        m('div.sidebar-card', [
                            m('h4', '目标分支'),
                            m('p', pr.target_branch)
                        ]),
                        m('div.sidebar-card', [
                            m('h4', '指派给'),
                            m('p', pr.assignee || '未指派')
                        ]),
                        m('div.sidebar-card', [
                            m('h4', '标签'),
                            m('p', '暂无标签')
                        ])
                    ])
                ]),
                
                activeTab === 'commits' && m('div.pr-commits-tab', [
                    m('div.commits-list-header', [
                        m('h3', `Commits (${commitsTotal})`)
                    ]),
                    commits.length === 0 ?
                        m('p.no-commits', '暂无提交') :
                        m('div.commits-list', commits.map(commit =>
                            m('div.commit-item', [
                                m('div.commit-hash', [
                                    m('code', commit.short_hash),
                                    m('span.commit-message', commit.message)
                                ]),
                                m('div.commit-meta', [
                                    m('span.commit-author', commit.author),
                                    m('span', ' · '),
                                    m('span.commit-date', formatTime(commit.date))
                                ])
                            ])
                        ))
                ]),
                
                activeTab === 'files' && m('div.pr-files-tab', [
                    m('div.files-stats-bar', [
                        m('span.stat-additions', [
                            m('i.fas.fa-plus'),
                            ` ${totalAdditions} additions`
                        ]),
                        m('span.stat-deletions', [
                            m('i.fas.fa-minus'),
                            ` ${totalDeletions} deletions`
                        ]),
                        m('span.stat-files-count', `${files.length} files changed`)
                    ]),
                    files.length === 0 ?
                        m('p.no-files', '暂无文件变更') :
                        m('div.files-list', files.map((file, index) => {
                            const isExpanded = vnode.state.expandedFiles.has(index);
                            
                            return m('div.file-item', [
                                m('div.file-header', {
                                    onclick: () => {
                                        if (isExpanded) {
                                            vnode.state.expandedFiles.delete(index);
                                        } else {
                                            vnode.state.expandedFiles.add(index);
                                        }
                                    }
                                }, [
                                    m(`i.fas.file-icon.${file.status === 'added' ? 'fa-plus' : file.status === 'deleted' ? 'fa-minus' : 'fa-pen'}`, {
                                        class: file.status
                                    }),
                                    m('i.fas.file-chevron', {
                                        class: isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'
                                    }),
                                    m('span.file-name', file.filename),
                                    m('span.file-stats', [
                                        file.additions > 0 ? m('span.additions', `+${file.additions}`) : '',
                                        file.deletions > 0 ? m('span.deletions', `-${file.deletions}`) : ''
                                    ])
                                ]),
                                isExpanded && file.patch && m('div.file-diff', {
                                    innerHTML: PullRequestDetail.renderDiff(file.patch)
                                })
                            ]);
                        }))
                ])
            ])
        ]);
    }
};


const NewPullRequest = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.loading = true;
        vnode.state.submitting = false;
        vnode.state.prsCount = 0;
        vnode.state.issuesCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.branches = ['main', 'develop'];
        vnode.state.formData = {
            title: '',
            body: '',
            source_branch: 'develop',
            target_branch: 'main'
        };
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 }),
            TaskService.list(owner, repo, { per_page: 1 })
        ]).then(([repoResult, issuesResult, prsResult, tasksResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load data:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    handleSubmit(vnode) {
        const { owner, repo } = vnode.attrs;
        const { formData, submitting } = vnode.state;
        
        if (submitting) return;
        
        if (!formData.title.trim()) {
            alert('标题不能为空');
            return;
        }
        
        if (formData.source_branch === formData.target_branch) {
            alert('源分支和目标分支不能相同');
            return;
        }
        
        vnode.state.submitting = true;
        
        PullRequestService.create(owner, repo, formData).then(result => {
            const pr = result.data || result;
            m.route.set(`/pull-requests/${owner}/${repo}/${pr.number}`);
        }).catch(error => {
            vnode.state.submitting = false;
            alert('创建 PR 失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },
    
    view(vnode) {
        const { owner, repo: repoName } = vnode.attrs;
        const { repo, loading, submitting, formData, issuesCount, prsCount, branches } = vnode.state;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m('div.empty-state', '项目不存在'));
        }
        
        return m(Layout, [
            m(ProjectHeader, {
                owner: owner,
                repo: repo,
                description: repo.description,
                stars: repo.stars_count,
                forks: repo.forks_count,
                visibility: repo.is_private ? 'private' : 'public'
            }),
            
            m(ProjectTabs, {
                owner: owner,
                repo: repo,
                issuesCount: issuesCount,
                prsCount: prsCount,
                tasksCount: vnode.state.tasksCount,
                activeTab: 'prs'
            }),
            
            m('div.new-pr-page', [
                m('div.breadcrumb', [
                    m('a', { href: '/', oncreate: m.route.link }, '首页'),
                    ' / ',
                    m('a', { href: `/pull-requests/${owner}/${repo.name}`, oncreate: m.route.link }, 'Pull Requests'),
                    ' / 新建'
                ]),
                
                m('div.new-pr-container', [
                    m('div.new-pr-main', [
                        m('div.form-card', [
                            m('div.branch-selector', [
                                m('div.branch-group', [
                                    m('label', '合并'),
                                    m('select.form-input', {
                                        value: formData.source_branch,
                                        onchange: (e) => {
                                            vnode.state.formData.source_branch = e.target.value;
                                        }
                                    }, branches.map(branch => 
                                        m('option', { value: branch }, branch)
                                    ))
                                ]),
                                m('div.branch-arrow', m('i.fas.fa-arrow-right')),
                                m('div.branch-group', [
                                    m('label', '到'),
                                    m('select.form-input', {
                                        value: formData.target_branch,
                                        onchange: (e) => {
                                            vnode.state.formData.target_branch = e.target.value;
                                        }
                                    }, branches.map(branch => 
                                        m('option', { value: branch }, branch)
                                    ))
                                ])
                            ]),
                            
                            formData.source_branch === formData.target_branch ?
                                m('div.warning-message', [
                                    m('i.fas.fa-exclamation-triangle'),
                                    ' 源分支和目标分支相同，请选择不同的分支'
                                ]) : null,
                            
                            m('div.form-group', [
                                m('label.form-label', { for: 'pr-title' }, '标题'),
                                m('input#pr-title.form-input', {
                                    type: 'text',
                                    placeholder: '标题',
                                    value: formData.title,
                                    oninput: (e) => {
                                        vnode.state.formData.title = e.target.value;
                                    }
                                })
                            ]),
                            
                            m('div.form-group', [
                                m('label.form-label', { for: 'pr-body' }, '描述'),
                                m('textarea#pr-body.form-textarea', {
                                    placeholder: '添加描述...',
                                    rows: 10,
                                    value: formData.body,
                                    oninput: (e) => {
                                        vnode.state.formData.body = e.target.value;
                                    }
                                })
                            ]),
                            
                            m('div.form-actions', [
                                m('button.btn.btn-primary', {
                                    onclick: () => NewPullRequest.handleSubmit(vnode),
                                    disabled: submitting || !formData.title.trim() || formData.source_branch === formData.target_branch
                                }, submitting ? '创建中...' : '创建 Pull Request'),
                                m('button.btn', {
                                    onclick: () => {
                                        m.route.set(`/pull-requests/${owner}/${repo.name}`);
                                    }
                                }, '取消')
                            ])
                        ])
                    ]),
                    
                    m('div.new-pr-sidebar', [
                        m('div.sidebar-card', [
                            m('h4', '指派给'),
                            m('p', '未指派')
                        ]),
                        
                        m('div.sidebar-card', [
                            m('h4', '标签'),
                            m('p', '暂无标签')
                        ]),
                        
                        m('div.sidebar-card', [
                            m('h4', '审查者'),
                            m('p', '无')
                        ])
                    ])
                ])
            ])
        ]);
    }
};


const TaskList = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.tasks = [];
        vnode.state.loading = true;
        vnode.state.statusFilter = '';
        vnode.state.priorityFilter = '';
        vnode.state.prsCount = 0;
        vnode.state.issuesCount = 0;
        vnode.state.tasksCount = 0;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            TaskService.list(owner, repo),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 })
        ]).then(([repoResult, tasksResult, issuesResult, prsResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            const taskData = tasksResult.data || tasksResult;
            vnode.state.tasks = Array.isArray(taskData) ? taskData : [];
            vnode.state.tasksCount = tasksResult.total || vnode.state.tasks.length;
            const prData = prsResult.data || prsResult;
            vnode.state.prsCount = Array.isArray(prData) ? prData.filter(p => !p.is_closed && !p.is_merged).length : 0;
            const issuesData = issuesResult.data || issuesResult;
            vnode.state.issuesCount = Array.isArray(issuesData) ? issuesData.filter(i => !i.is_closed).length : 0;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load tasks:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, tasks, loading, statusFilter, priorityFilter } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        let filteredTasks = tasks;
        
        if (statusFilter) {
            filteredTasks = filteredTasks.filter(t => t.status === statusFilter);
        }
        
        if (priorityFilter) {
            filteredTasks = filteredTasks.filter(t => t.priority === parseInt(priorityFilter));
        }
        
        const statusLabels = {
            'draft': '初建',
            'progress': '进行',
            'review': '审核',
            'completed': '完成'
        };
        
        const priorityLabels = {
            1: '紧急',
            2: '高',
            3: '中',
            4: '低',
            5: '最低'
        };
        
        const priorityColors = {
            1: '#ff0000',
            2: '#ff8c00',
            3: '#ffd700',
            4: '#90ee90',
            5: '#87ceeb'
        };
        
        return m(Layout, [
            m(ProjectHeader, { repo, owner }),
            m(ProjectTabs, { owner, repo: repo, activeTab: 'tasks', issuesCount: vnode.state.issuesCount, prsCount: vnode.state.prsCount, tasksCount: vnode.state.tasksCount }),
            
            m('div.tasks-page', [
                m('div.tasks-header', [
                    m('div.tasks-filters', [
                        m('select.filter-select', {
                            value: statusFilter,
                            onchange: (e) => { vnode.state.statusFilter = e.target.value; }
                        }, [
                            m('option', { value: '' }, '所有状态'),
                            m('option', { value: 'draft' }, '初建'),
                            m('option', { value: 'progress' }, '进行'),
                            m('option', { value: 'review' }, '审核'),
                            m('option', { value: 'completed' }, '完成')
                        ]),
                        m('select.filter-select', {
                            value: priorityFilter,
                            onchange: (e) => { vnode.state.priorityFilter = e.target.value; }
                        }, [
                            m('option', { value: '' }, '所有优先级'),
                            m('option', { value: '1' }, '紧急'),
                            m('option', { value: '2' }, '高'),
                            m('option', { value: '3' }, '中'),
                            m('option', { value: '4' }, '低'),
                            m('option', { value: '5' }, '最低')
                        ])
                    ]),
                    m('button.btn.btn-primary', {
                        onclick: () => { m.route.set(`/tasks/${owner}/${repo.name}/new`); }
                    }, [
                        m('i.fas.fa-plus'),
                        ' 新建任务'
                    ])
                ]),
                
                filteredTasks.length === 0 ? 
                    m(EmptyState, { 
                        message: '没有任务', 
                        icon: 'fa-tasks' 
                    }) :
                    m('div.task-list', filteredTasks.map(task => 
                        m('div.task-item', {
                            onclick: () => { m.route.set(`/tasks/${owner}/${repo.name}/${task.id}`); }
                        }, [
                            m('div.task-priority', {
                                style: { backgroundColor: priorityColors[task.priority] }
                            }),
                            task.preview_image ? m('div.task-preview', [
                                m('img', { src: task.preview_image, alt: task.title })
                            ]) : null,
                            m('div.task-content', [
                                m('div.task-title-row', [
                                    m('span.task-status-badge', { 
                                        class: task.status 
                                    }, statusLabels[task.status] || task.status),
                                    m('h4.task-title', task.title)
                                ]),
                                m('div.task-meta', [
                                    m('span', `优先级: ${priorityLabels[task.priority]}`),
                                    m('span', `发起人: ${task.initiator}`),
                                    task.handler ? m('span', `处理人: ${task.handler}`) : null,
                                    m('span', `创建于 ${formatTime(task.created_at)}`)
                                ])
                            ])
                        ])
                    ))
            ])
        ]);
    }
};

function formatTime(timeStr) {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return date.toLocaleDateString('zh-CN');
}


const TaskDetail = {
    oninit(vnode) {
        const { owner, repo, id } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.task = null;
        vnode.state.allIssues = [];
        vnode.state.loading = true;
        vnode.state.prsCount = 0;
        vnode.state.issuesCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.editMode = false;
        vnode.state.editData = {};
        vnode.state.showIssueSelector = false;
        vnode.state.selectedIssueId = '';
        vnode.state.uploadingFiles = false;
        vnode.state.uploadProgress = 0;
        vnode.state.dragOver = false;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            TaskService.get(owner, repo, id),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 }),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            TaskService.list(owner, repo, { per_page: 1 })
        ]).then(([repoResult, taskResult, prsResult, issuesResult, tasksResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.task = taskResult.data || taskResult;
            const prData = prsResult.data || prsResult;
            vnode.state.prsCount = Array.isArray(prData) ? prData.filter(p => !p.is_closed && !p.is_merged).length : 0;
            const issuesData = issuesResult.data || issuesResult;
            vnode.state.issuesCount = Array.isArray(issuesData) ? issuesData.filter(i => !i.is_closed).length : 0;
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.allIssues = Array.isArray(issuesData) ? issuesData : [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load task:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    handleSave: function(vnode) {
        const { owner, repo, id } = vnode.attrs;
        const { editData } = vnode.state;
        
        vnode.state.loading = true;
        
        TaskService.update(owner, repo, id, editData).then(result => {
            vnode.state.task = result.data || result;
            vnode.state.editMode = false;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            vnode.state.loading = false;
            alert('保存失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },
    
    handleDelete: function(vnode) {
        const { owner, repo, id } = vnode.attrs;
        
        if (!confirm('确定要删除此任务吗？')) {
            return;
        }
        
        TaskService.delete(owner, repo, id).then(() => {
            m.route.set(`/tasks/${owner}/${repo}`);
        }).catch(error => {
            alert('删除失败: ' + (error.message || '未知错误'));
        });
    },
    
    handleAddIssue: function(vnode) {
        const { owner, repo, id } = vnode.attrs;
        const { selectedIssueId, allIssues, task } = vnode.state;
        
        if (!selectedIssueId) {
            alert('请选择要关联的Issue');
            return;
        }
        
        const issueId = parseInt(selectedIssueId);
        
        if (task.issues && task.issues.some(i => i.id === issueId)) {
            alert('该Issue已经关联到此任务');
            return;
        }
        
        TaskService.addIssue(owner, repo, id, issueId).then(() => {
            const issue = allIssues.find(i => i.id === issueId);
            if (issue) {
                if (!vnode.state.task.issues) {
                    vnode.state.task.issues = [];
                }
                vnode.state.task.issues.push({
                    id: issue.id,
                    title: issue.title,
                    status: issue.is_closed ? 'closed' : 'open',
                    number: issue.number
                });
            }
            vnode.state.showIssueSelector = false;
            vnode.state.selectedIssueId = '';
            m.redraw();
        }).catch(error => {
            alert('关联失败: ' + (error.message || '未知错误'));
        });
    },
    
    handleRemoveIssue: function(vnode, issueId) {
        const { owner, repo, id } = vnode.attrs;
        
        if (!confirm('确定要取消关联此Issue吗？')) {
            return;
        }
        
        TaskService.removeIssue(owner, repo, id, issueId).then(() => {
            vnode.state.task.issues = vnode.state.task.issues.filter(i => i.id !== issueId);
            m.redraw();
        }).catch(error => {
            alert('取消关联失败: ' + (error.message || '未知错误'));
        });
    },
    
    handleFileUpload: function(vnode, event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        
        TaskDetail.uploadFiles(vnode, Array.from(files));
        event.target.value = '';
    },
    
    handleDropUpload: function(vnode, event) {
        event.preventDefault();
        event.stopPropagation();
        vnode.state.dragOver = false;
        
        const files = event.dataTransfer.files;
        if (!files || files.length === 0) return;
        
        TaskDetail.uploadFiles(vnode, Array.from(files));
    },
    
    handleDragOver: function(vnode, event) {
        event.preventDefault();
        event.stopPropagation();
        vnode.state.dragOver = true;
    },
    
    handleDragLeave: function(vnode, event) {
        event.preventDefault();
        event.stopPropagation();
        vnode.state.dragOver = false;
    },
    
    uploadFiles: function(vnode, files) {
        const { owner, repo, id } = vnode.attrs;
        
        if (vnode.state.uploadingFiles) {
            alert('正在上传中，请等待完成');
            return;
        }
        
        const maxSize = 10 * 1024 * 1024; // 10MB
        const oversizedFiles = files.filter(f => f.size > maxSize);
        if (oversizedFiles.length > 0) {
            alert(`以下文件超过10MB限制：${oversizedFiles.map(f => f.name).join(', ')}`);
            return;
        }
        
        vnode.state.uploadingFiles = true;
        vnode.state.uploadProgress = 0;
        m.redraw();
        
        const uploadPromises = files.map((file, index) => {
            const formData = new FormData();
            formData.append('file', file);
            
            return TaskService.uploadAttachment(owner, repo, id, formData).then(result => {
                vnode.state.uploadProgress = ((index + 1) / files.length) * 100;
                m.redraw();
                return result.data || result;
            });
        });
        
        Promise.all(uploadPromises).then(results => {
            if (!vnode.state.task.attachments) {
                vnode.state.task.attachments = [];
            }
            
            results.forEach(attachment => {
                vnode.state.task.attachments.push(attachment);
            });
            
            vnode.state.uploadingFiles = false;
            vnode.state.uploadProgress = 100;
            m.redraw();
        }).catch(error => {
            console.error('Upload error:', error);
            alert('上传失败: ' + (error.response?.data?.error || error.message || '未知错误'));
            vnode.state.uploadingFiles = false;
            m.redraw();
        });
    },
    
    handleDeleteAttachment: function(vnode, attachmentId) {
        const { owner, repo, id } = vnode.attrs;
        
        if (!confirm('确定要删除此附件吗？')) {
            return;
        }
        
        TaskService.deleteAttachment(owner, repo, id, attachmentId).then(() => {
            vnode.state.task.attachments = vnode.state.task.attachments.filter(a => a.id !== attachmentId);
            m.redraw();
        }).catch(error => {
            alert('删除失败: ' + (error.message || '未知错误'));
        });
    },
    
    view(vnode) {
        const { repo, task, loading, editMode, editData } = vnode.state;
        const { owner, repo: repoName, id } = vnode.attrs;
        
        if (loading && !task) {
            return m(Layout, m(Loading));
        }
        
        if (!repo || !task) {
            return m(Layout, m(EmptyState, { message: '任务不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        const statusLabels = {
            'draft': '初建',
            'progress': '进行',
            'review': '审核',
            'completed': '完成'
        };
        
        const priorityLabels = {
            1: '紧急',
            2: '高',
            3: '中',
            4: '低',
            5: '最低'
        };
        
        const priorityColors = {
            1: '#ff0000',
            2: '#ff8c00',
            3: '#ffd700',
            4: '#90ee90',
            5: '#87ceeb'
        };
        
        const scheduleTypeLabels = {
            'review': '评审',
            'develop': '开发',
            'test': '测试',
            'accept': '验收'
        };
        
        return m(Layout, [
            m('div.task-detail-page', [
                m(ProjectHeader, {
                    owner: owner,
                    repo: repo,
                    description: repo.description,
                    stars: repo.stars_count,
                    forks: repo.forks_count,
                    visibility: repo.is_private ? 'private' : 'public'
                }),
                
                m(ProjectTabs, {
                    owner: owner,
                    repo: repo,
                    issuesCount: vnode.state.issuesCount,
                    prsCount: vnode.state.prsCount,
                    tasksCount: vnode.state.tasksCount,
                    activeTab: 'tasks'
                }),
                
                m('div.task-detail-content', [
                    m('div.task-detail-header', [
                        m('div.task-title-row', [
                            m('div.task-priority-indicator', {
                                style: { backgroundColor: priorityColors[task.priority] }
                            }),
                            editMode ? 
                                m('input.task-title-input', {
                                    value: editData.title || task.title,
                                    oninput: (e) => { vnode.state.editData.title = e.target.value; }
                                }) :
                                m('h1.task-title', task.title),
                            m('div.task-status-badge', { 
                                class: task.status 
                            }, statusLabels[task.status] || task.status)
                        ]),
                        m('div.task-meta', [
                            m('span', `优先级: ${priorityLabels[task.priority]}`),
                            m('span', `发起人: ${task.initiator}`),
                            task.verifier ? m('span', `验收人: ${task.verifier}`) : null,
                            task.handler ? m('span', `处理人: ${task.handler}`) : null,
                            m('span', `创建于 ${formatTime(task.created_at)}`),
                            task.last_handled_at ? m('span', `最后处理于 ${formatTime(task.last_handled_at)}`) : null
                        ])
                    ]),
                    
                    m('div.task-detail-body', [
                        m('div.task-main', [
                            task.preview_image ? m('div.task-preview-image', [
                                m('img', { src: task.preview_image, alt: task.title })
                            ]) : null,
                            
                            m('div.task-description', [
                                m('h3', '草稿'),
                                m('p.field-hint', '评审前的初始规划'),
                                editMode ?
                                    m('textarea.task-content-textarea', {
                                        value: editData.draft || task.draft,
                                        oninput: (e) => { vnode.state.editData.draft = e.target.value; },
                                        placeholder: '任务草稿...'
                                    }) :
                                    m('div.task-body', [
                                        m(MarkdownRenderer, { content: task.draft || '暂无草稿' })
                                    ])
                            ]),
                            
                            m('div.task-description', [
                                m('h3', '目标'),
                                m('p.field-hint', '评审后形成的最终版本'),
                                editMode ?
                                    m('textarea.task-content-textarea', {
                                        value: editData.goal || task.goal,
                                        oninput: (e) => { vnode.state.editData.goal = e.target.value; },
                                        placeholder: '任务目标...'
                                    }) :
                                    m('div.task-body', [
                                        m(MarkdownRenderer, { content: task.goal || '暂无目标' })
                                    ])
                            ]),
                            
                            task.schedules && task.schedules.length > 0 ? m('div.task-schedules', [
                                m('h3', '排期信息'),
                                m('div.schedule-list', task.schedules.map(schedule => 
                                    m('div.schedule-item', [
                                        m('div.schedule-header', [
                                            m('span.schedule-type', scheduleTypeLabels[schedule.schedule_type] || schedule.schedule_type),
                                        ]),
                                        m('div.schedule-details', [
                                            schedule.plan_start_date ? m('div', [
                                                m('span.label', '计划时间: '),
                                                m('span', `${schedule.plan_start_date}${schedule.plan_start_noon ? ' ' + (schedule.plan_start_noon === 'am' ? '上午' : '下午') : ''} - ${schedule.plan_end_date}${schedule.plan_end_noon ? ' ' + (schedule.plan_end_noon === 'am' ? '上午' : '下午') : ''}`)
                                            ]) : null,
                                            schedule.actual_start_date ? m('div', [
                                                m('span.label', '实际时间: '),
                                                m('span', `${schedule.actual_start_date}${schedule.actual_start_noon ? ' ' + (schedule.actual_start_noon === 'am' ? '上午' : '下午') : ''} - ${schedule.actual_end_date}${schedule.actual_end_noon ? ' ' + (schedule.actual_end_noon === 'am' ? '上午' : '下午') : ''}`)
                                            ]) : null,
                                            schedule.user1 || schedule.user2 || schedule.user3 ? m('div', [
                                                m('span.label', '参与人: '),
                                                m('span', [schedule.user1, schedule.user2, schedule.user3].filter(Boolean).join(', '))
                                            ]) : null
                                        ])
                                    ])
                                ))
                            ]) : null,
                            
                            m('div.task-attachments', [
                                m('h3', [
                                    '附件',
                                    task.attachments ? ` (${task.attachments.length})` : ''
                                ]),
                                
                                m('div.upload-area', {
                                    class: vnode.state.dragOver ? 'drag-over' : '',
                                    ondragover: (e) => TaskDetail.handleDragOver(vnode, e),
                                    ondragleave: (e) => TaskDetail.handleDragLeave(vnode, e),
                                    ondrop: (e) => TaskDetail.handleDropUpload(vnode, e)
                                }, [
                                    m('i.fas.fa-cloud-upload-alt'),
                                    m('p', '拖拽文件到此处或'),
                                    m('label.upload-btn', [
                                        m('input[type=file]', {
                                            multiple: true,
                                            accept: '*/*',
                                            style: { display: 'none' },
                                            onchange: (e) => TaskDetail.handleFileUpload(vnode, e)
                                        }),
                                        '选择文件'
                                    ]),
                                    m('span.hint', '（单个文件最大 10MB，支持多选）')
                                ]),
                                
                                vnode.state.uploadingFiles ? m('div.upload-progress', [
                                    m('div.progress-bar', {
                                        style: { width: vnode.state.uploadProgress + '%' }
                                    }),
                                    m('span', `上传中... ${Math.round(vnode.state.uploadProgress)}%`)
                                ]) : null,
                                
                                task.attachments && task.attachments.length > 0 ? 
                                    m('div.attachment-list', task.attachments.map(att => 
                                        m('div.attachment-item', [
                                            m('div.attachment-icon', getFileIcon(att.file_type)),
                                            m('div.attachment-info', [
                                                m('a.attachment-name', { 
                                                    href: att.file_path, 
                                                    target: '_blank',
                                                    title: att.file_name
                                                }, att.file_name),
                                                m('span.attachment-meta', formatFileSize(att.file_size))
                                            ]),
                                            m('button.btn.btn-sm.btn-danger.attachment-delete', {
                                                onclick: () => TaskDetail.handleDeleteAttachment(vnode, att.id),
                                                title: '删除附件'
                                            }, [m('i.fas.fa-trash')])
                                        ])
                                    )) :
                                    m('p.no-attachments', '暂无附件')
                            ]),
                            
                            task.issues && task.issues.length > 0 ? m('div.task-issues', [
                                m('h3', '关联Issues'),
                                m('div.issue-list', task.issues.map(issue => 
                                    m('div.issue-item', [
                                        m('span.issue-status', {
                                            class: issue.status === 'closed' ? 'closed' : 'open'
                                        }, issue.status === 'closed' ? '已关闭' : '开启'),
                                        m('a', { 
                                            href: `/${owner}/${repo}/issues/${issue.number}`,
                                            onclick: (e) => {
                                                e.preventDefault();
                                                m.route.set(`/${owner}/${repo}/issues/${issue.number}`);
                                            }
                                        }, `#${issue.number}`),
                                        m('span.issue-title', issue.title),
                                        m('button.btn.btn-sm.btn-danger', {
                                            onclick: () => TaskDetail.handleRemoveIssue(vnode, issue.id)
                                        }, [m('i.fas.fa-times')])
                                    ])
                                ))
                            ]) : null,
                            
                            m('div.task-issue-actions', [
                                vnode.state.showIssueSelector ? [
                                    m('div.issue-selector', [
                                        m('select.form-input', {
                                            value: vnode.state.selectedIssueId,
                                            onchange: (e) => { vnode.state.selectedIssueId = e.target.value; }
                                        }, [
                                            m('option', { value: '' }, '选择Issue...'),
                                            vnode.state.allIssues.map(issue => 
                                                m('option', { value: issue.id }, `#${issue.number} - ${issue.title}`)
                                            )
                                        ]),
                                        m('button.btn.btn-primary.btn-sm', {
                                            onclick: () => TaskDetail.handleAddIssue(vnode)
                                        }, '关联'),
                                        m('button.btn.btn-sm', {
                                            onclick: () => { 
                                                vnode.state.showIssueSelector = false;
                                                vnode.state.selectedIssueId = '';
                                            }
                                        }, '取消')
                                    ])
                                ] : [
                                    m('button.btn.btn-sm', {
                                        onclick: () => { vnode.state.showIssueSelector = true; }
                                    }, [m('i.fas.fa-plus'), ' 关联Issue'])
                                ]
                            ]),
                            
                            m('div.task-actions', [
                                editMode ? [
                                    m('button.btn.btn-primary', {
                                        onclick: () => TaskDetail.handleSave(vnode)
                                    }, '保存'),
                                    m('button.btn', {
                                        onclick: () => { 
                                            vnode.state.editMode = false; 
                                            vnode.state.editData = {};
                                        }
                                    }, '取消')
                                ] : [
                                    m('button.btn.btn-sm', {
                                        onclick: () => { 
                                            vnode.state.editMode = true; 
                                            vnode.state.editData = {
                                                title: task.title,
                                                draft: task.draft,
                                                goal: task.goal,
                                                status: task.status,
                                                priority: task.priority,
                                                sort_order: task.sort_order || 0
                                            };
                                        }
                                    }, [m('i.fas.fa-edit'), ' 编辑']),
                                    m('button.btn.btn-sm.btn-danger', {
                                        onclick: () => TaskDetail.handleDelete(vnode)
                                    }, [m('i.fas.fa-trash'), ' 删除'])
                                ]
                            ])
                        ]),
                        
                        m('div.task-sidebar', [
                            m('div.sidebar-card', [
                                m('h4', '状态'),
                                editMode ?
                                    m('select.form-input', {
                                        value: editData.status || task.status,
                                        onchange: (e) => { vnode.state.editData.status = e.target.value; }
                                    }, [
                                        m('option', { value: 'draft' }, '初建'),
                                        m('option', { value: 'progress' }, '进行'),
                                        m('option', { value: 'review' }, '审核'),
                                        m('option', { value: 'completed' }, '完成')
                                    ]) :
                                    m('div.task-status-badge', { 
                                        class: task.status 
                                    }, statusLabels[task.status] || task.status)
                            ]),
                            m('div.sidebar-card', [
                                m('h4', '排序'),
                                editMode ?
                                    m('input.form-input', {
                                        type: 'number',
                                        value: editData.sort_order || task.sort_order || 0,
                                        oninput: (e) => { vnode.state.editData.sort_order = parseInt(e.target.value) || 0; }
                                    }) :
                                    m('p', task.sort_order || 0)
                            ]),
                            m('div.sidebar-card', [
                                m('h4', '优先级'),
                                editMode ?
                                    m('select.form-input', {
                                        value: editData.priority || task.priority,
                                        onchange: (e) => { vnode.state.editData.priority = parseInt(e.target.value); }
                                    }, [
                                        m('option', { value: 1 }, '紧急'),
                                        m('option', { value: 2 }, '高'),
                                        m('option', { value: 3 }, '中'),
                                        m('option', { value: 4 }, '低'),
                                        m('option', { value: 5 }, '最低')
                                    ]) :
                                    m('div.priority-display', [
                                        m('span.priority-dot', { style: { backgroundColor: priorityColors[task.priority] } }),
                                        m('span', priorityLabels[task.priority])
                                    ])
                            ]),
                            m('div.sidebar-card', [
                                m('h4', '发起人'),
                                m('p', task.initiator || '未知')
                            ]),
                            m('div.sidebar-card', [
                                m('h4', '验收人'),
                                m('p', task.verifier || '未指定')
                            ]),
                            m('div.sidebar-card', [
                                m('h4', '当前处理人'),
                                m('p', task.handler || '未指定')
                            ])
                        ])
                    ])
                ])
            ])
        ]);
    }
};

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(fileType) {
    if (!fileType) return m('i.fas.fa-file');
    
    if (fileType.startsWith('image/')) return m('i.fas.fa-file-image', { style: { color: '#4CAF50' } });
    if (fileType === 'application/pdf') return m('i.fas.fa-file-pdf', { style: { color: '#F44336' } });
    if (fileType.includes('word') || fileType.includes('document')) return m('i.fas.fa-file-word', { style: { color: '#2196F3' } });
    if (fileType.includes('excel') || fileType.includes('sheet')) return m('i.fas.fa-file-excel', { style: { color: '#4CAF50' } });
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('archive')) return m('i.fas.fa-file-archive', { style: { color: '#FF9800' } });
    if (fileType.includes('text') || fileType.includes('plain')) return m('i.fas.fa-file-alt', { style: { color: '#607D8B' } });
    if (fileType.includes('video')) return m('i.fas.fa-file-video', { style: { color: '#9C27B0' } });
    if (fileType.includes('audio')) return m('i.fas.fa-file-audio', { style: { color: '#E91E63' } });
    
    return m('i.fas.fa-file');
}


const NewTask = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.loading = true;
        vnode.state.submitting = false;
        vnode.state.prsCount = 0;
        vnode.state.issuesCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.formData = {
            title: '',
            draft: '',
            goal: '',
            preview_image: '',
            priority: 3,
            sort_order: 0,
            verifier: '',
            handler: '',
            schedules: []
        };
        vnode.state.showScheduleForm = false;
        vnode.state.newSchedule = {
            schedule_type: 'review',
            plan_start_date: '',
            plan_end_date: '',
            plan_start_noon: 'am',
            plan_end_noon: 'pm',
            user1: '',
            user2: '',
            user3: ''
        };
        vnode.state.pendingFiles = [];
        vnode.state.uploadingFiles = false;
        vnode.state.uploadProgress = 0;
        vnode.state.dragOver = false;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 }),
            TaskService.list(owner, repo, { per_page: 1 })
        ]).then(([repoResult, issuesResult, prsResult, tasksResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load data:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    handleAddSchedule(vnode) {
        const { newSchedule, formData } = vnode.state;
        
        if (!newSchedule.plan_start_date || !newSchedule.plan_end_date) {
            alert('请填写计划开始和结束日期');
            return;
        }
        
        vnode.state.formData.schedules.push({ ...newSchedule });
        vnode.state.newSchedule = {
            schedule_type: 'review',
            plan_start_date: '',
            plan_end_date: '',
            plan_start_noon: 'am',
            plan_end_noon: 'pm',
            user1: '',
            user2: '',
            user3: ''
        };
        vnode.state.showScheduleForm = false;
    },
    
    handleRemoveSchedule(vnode, index) {
        vnode.state.formData.schedules.splice(index, 1);
    },
    
    handleFileSelect(vnode, event) {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;
        
        const maxSize = 10 * 1024 * 1024;
        const validFiles = [];
        const oversizedFiles = [];
        
        files.forEach(file => {
            if (file.size > maxSize) {
                oversizedFiles.push(file.name);
            } else {
                validFiles.push(file);
            }
        });
        
        if (oversizedFiles.length > 0) {
            alert(`以下文件超过10MB限制：${oversizedFiles.join(', ')}`);
        }
        
        if (validFiles.length > 0) {
            vnode.state.pendingFiles = [...vnode.state.pendingFiles, ...validFiles];
            m.redraw();
        }
        
        event.target.value = '';
    },
    
    handleDropUpload(vnode, event) {
        event.preventDefault();
        event.stopPropagation();
        vnode.state.dragOver = false;
        
        const files = Array.from(event.dataTransfer.files || []);
        if (files.length === 0) return;
        
        NewTask.handleFileSelect(vnode, { target: { files } });
    },
    
    handleDragOver(vnode, event) {
        event.preventDefault();
        event.stopPropagation();
        vnode.state.dragOver = true;
    },
    
    handleDragLeave(vnode, event) {
        event.preventDefault();
        event.stopPropagation();
        vnode.state.dragOver = false;
    },
    
    removePendingFile(vnode, index) {
        vnode.state.pendingFiles.splice(index, 1);
        m.redraw();
    },
    
    async uploadAttachmentsAfterCreate(vnode, taskId) {
        const { owner, repo } = vnode.attrs;
        const { pendingFiles } = vnode.state;
        
        if (pendingFiles.length === 0) return;
        
        vnode.state.uploadingFiles = true;
        vnode.state.uploadProgress = 0;
        m.redraw();
        
        try {
            for (let i = 0; i < pendingFiles.length; i++) {
                const file = pendingFiles[i];
                const formData = new FormData();
                formData.append('file', file);
                
                await TaskService.uploadAttachment(owner, repo, taskId, formData);
                vnode.state.uploadProgress = ((i + 1) / pendingFiles.length) * 100;
                m.redraw();
            }
            
            vnode.state.uploadingFiles = false;
            vnode.state.pendingFiles = [];
        } catch (error) {
            console.error('Upload error:', error);
            alert('部分附件上传失败: ' + (error.message || '未知错误'));
            vnode.state.uploadingFiles = false;
        }
    },
    
    handleSubmit(vnode) {
        const { owner, repo } = vnode.attrs;
        const { formData, submitting } = vnode.state;
        
        if (submitting) return;
        
        if (!formData.title.trim()) {
            alert('标题不能为空');
            return;
        }
        
        vnode.state.submitting = true;
        
        TaskService.create(owner, repo, formData).then(async result => {
            const task = result.data || result;
            
            if (vnode.state.pendingFiles.length > 0) {
                await NewTask.uploadAttachmentsAfterCreate(vnode, task.id);
            }
            
            m.route.set(`/tasks/${owner}/${repo}/${task.id}`);
        }).catch(error => {
            vnode.state.submitting = false;
            alert('创建任务失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },
    
    view(vnode) {
        const { owner, repo: repoName } = vnode.attrs;
        const { repo, loading, submitting, formData, issuesCount, prsCount, showScheduleForm, newSchedule, pendingFiles, uploadingFiles, uploadProgress, dragOver } = vnode.state;
        
        const priorityLabels = {
            1: '紧急',
            2: '高',
            3: '中',
            4: '低',
            5: '最低'
        };
        
        const scheduleTypeLabels = {
            'review': '评审',
            'develop': '开发',
            'test': '测试',
            'accept': '验收'
        };
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m('div.empty-state', '项目不存在'));
        }
        
        return m(Layout, [
            m(ProjectHeader, {
                owner: owner,
                repo: repo,
                description: repo.description,
                stars: repo.stars_count,
                forks: repo.forks_count,
                visibility: repo.is_private ? 'private' : 'public'
            }),
            
            m(ProjectTabs, {
                owner: owner,
                repo: repo,
                issuesCount: issuesCount,
                prsCount: prsCount,
                tasksCount: vnode.state.tasksCount,
                activeTab: 'tasks'
            }),
            
            m('div.new-task-page', [
                m('div.breadcrumb', [
                    m('a', { href: '/', oncreate: m.route.link }, '首页'),
                    ' / ',
                    m('a', { href: `/tasks/${owner}/${repo.name}`, oncreate: m.route.link }, '任务'),
                    ' / 新建'
                ]),
                
                m('div.new-task-container', [
                    m('div.new-task-main', [
                        m('div.form-card', [
                            m('div.form-group', [
                                m('label.form-label', { for: 'task-title' }, '标题'),
                                m('input#task-title.form-input', {
                                    type: 'text',
                                    placeholder: '任务标题',
                                    required: true,
                                    value: formData.title,
                                    oninput: (e) => {
                                        vnode.state.formData.title = e.target.value;
                                    }
                                })
                            ]),
                            
                            m('div.form-group', [
                                m('label.form-label', { for: 'task-draft' }, '草稿'),
                                m('p.field-hint', '评审前的初始规划'),
                                m('textarea#task-draft.form-textarea', {
                                    placeholder: '任务草稿...',
                                    rows: 8,
                                    value: formData.draft,
                                    oninput: (e) => {
                                        vnode.state.formData.draft = e.target.value;
                                    }
                                })
                            ]),
                            
                            m('div.form-group', [
                                m('label.form-label', { for: 'task-goal' }, '目标'),
                                m('p.field-hint', '评审后形成的最终版本'),
                                m('textarea#task-goal.form-textarea', {
                                    placeholder: '任务目标...',
                                    rows: 6,
                                    value: formData.goal,
                                    oninput: (e) => {
                                        vnode.state.formData.goal = e.target.value;
                                    }
                                })
                            ]),
                            
                            m('div.form-group', [
                                m('label.form-label', { for: 'task-preview' }, '预览图URL'),
                                m('input#task-preview.form-input', {
                                    type: 'text',
                                    placeholder: '预览图片链接',
                                    value: formData.preview_image,
                                    oninput: (e) => {
                                        vnode.state.formData.preview_image = e.target.value;
                                    }
                                })
                            ]),
                            
                            m('div.form-row', [
                                m('div.form-group', [
                                    m('label.form-label', '优先级'),
                                    m('select.form-input', {
                                        value: formData.priority,
                                        onchange: (e) => {
                                            vnode.state.formData.priority = parseInt(e.target.value);
                                        }
                                    }, [
                                        m('option', { value: 1 }, '紧急'),
                                        m('option', { value: 2 }, '高'),
                                        m('option', { value: 3, selected: true }, '中'),
                                        m('option', { value: 4 }, '低'),
                                        m('option', { value: 5 }, '最低')
                                    ])
                                ]),
                                
                                m('div.form-group', [
                                    m('label.form-label', '排序'),
                                    m('input.form-input', {
                                        type: 'number',
                                        value: formData.sort_order,
                                        oninput: (e) => {
                                            vnode.state.formData.sort_order = parseInt(e.target.value) || 0;
                                        }
                                    })
                                ])
                            ]),
                            
                            m('div.form-row', [
                                m('div.form-group', [
                                    m('label.form-label', '处理人'),
                                    m('input.form-input', {
                                        type: 'text',
                                        placeholder: '处理人',
                                        value: formData.handler,
                                        oninput: (e) => {
                                            vnode.state.formData.handler = e.target.value;
                                        }
                                    })
                                ]),
                                
                                m('div.form-group', [
                                    m('label.form-label', '验证人'),
                                    m('input.form-input', {
                                        type: 'text',
                                        placeholder: '验证人',
                                        value: formData.verifier,
                                        oninput: (e) => {
                                            vnode.state.formData.verifier = e.target.value;
                                        }
                                    })
                                ])
                            ]),
                            
                            m('div.form-group', [
                                m('label.form-label', '计划'),
                                formData.schedules.length > 0 ?
                                    m('div.schedules-list', formData.schedules.map((schedule, index) => 
                                        m('div.schedule-item', [
                                            m('div.schedule-header', [
                                                m('span.schedule-type', scheduleTypeLabels[schedule.schedule_type]),
                                                m('button.btn.btn-sm', {
                                                    onclick: () => NewTask.handleRemoveSchedule(vnode, index)
                                                }, m('i.fas.fa-times'))
                                            ]),
                                            m('div.schedule-dates', [
                                                m('span', `${schedule.plan_start_date} ${schedule.plan_start_noon.toUpperCase()}`),
                                                ' → ',
                                                m('span', `${schedule.plan_end_date} ${schedule.plan_end_noon.toUpperCase()}`)
                                            ]),
                                            schedule.user1 ? m('div.schedule-users', `参与人: ${schedule.user1}${schedule.user2 ? ', ' + schedule.user2 : ''}${schedule.user3 ? ', ' + schedule.user3 : ''}`) : null
                                        ])
                                    )) : null,
                                
                                showScheduleForm ?
                                    m('div.schedule-form', [
                                        m('div.form-row', [
                                            m('div.form-group', [
                                                m('label', '类型'),
                                                m('select.form-input', {
                                                    value: newSchedule.schedule_type,
                                                    onchange: (e) => {
                                                        vnode.state.newSchedule.schedule_type = e.target.value;
                                                    }
                                                }, [
                                                    m('option', { value: 'review' }, '评审'),
                                                    m('option', { value: 'develop' }, '开发'),
                                                    m('option', { value: 'test' }, '测试'),
                                                    m('option', { value: 'accept' }, '验收')
                                                ])
                                            ])
                                        ]),
                                        
                                        m('div.form-row', [
                                            m('div.form-group', [
                                                m('label', '开始日期'),
                                                m('input.form-input', {
                                                    type: 'date',
                                                    value: newSchedule.plan_start_date,
                                                    onchange: (e) => {
                                                        vnode.state.newSchedule.plan_start_date = e.target.value;
                                                    }
                                                })
                                            ]),
                                            m('div.form-group', [
                                                m('label', '开始时段'),
                                                m('select.form-input', {
                                                    value: newSchedule.plan_start_noon,
                                                    onchange: (e) => {
                                                        vnode.state.newSchedule.plan_start_noon = e.target.value;
                                                    }
                                                }, [
                                                    m('option', { value: 'am' }, '上午'),
                                                    m('option', { value: 'pm' }, '下午')
                                                ])
                                            ])
                                        ]),
                                        
                                        m('div.form-row', [
                                            m('div.form-group', [
                                                m('label', '结束日期'),
                                                m('input.form-input', {
                                                    type: 'date',
                                                    value: newSchedule.plan_end_date,
                                                    onchange: (e) => {
                                                        vnode.state.newSchedule.plan_end_date = e.target.value;
                                                    }
                                                })
                                            ]),
                                            m('div.form-group', [
                                                m('label', '结束时段'),
                                                m('select.form-input', {
                                                    value: newSchedule.plan_end_noon,
                                                    onchange: (e) => {
                                                        vnode.state.newSchedule.plan_end_noon = e.target.value;
                                                    }
                                                }, [
                                                    m('option', { value: 'am' }, '上午'),
                                                    m('option', { value: 'pm' }, '下午')
                                                ])
                                            ])
                                        ]),
                                        
                                        m('div.form-row', [
                                            m('div.form-group', [
                                                m('label', '参与人1'),
                                                m('input.form-input', {
                                                    type: 'text',
                                                    value: newSchedule.user1,
                                                    oninput: (e) => {
                                                        vnode.state.newSchedule.user1 = e.target.value;
                                                    }
                                                })
                                            ]),
                                            m('div.form-group', [
                                                m('label', '参与人2'),
                                                m('input.form-input', {
                                                    type: 'text',
                                                    value: newSchedule.user2,
                                                    oninput: (e) => {
                                                        vnode.state.newSchedule.user2 = e.target.value;
                                                    }
                                                })
                                            ])
                                        ]),
                                        
                                        m('div.form-group', [
                                            m('label', '参与人3'),
                                            m('input.form-input', {
                                                type: 'text',
                                                value: newSchedule.user3,
                                                oninput: (e) => {
                                                    vnode.state.newSchedule.user3 = e.target.value;
                                                }
                                            })
                                        ]),
                                        
                                        m('div.schedule-form-actions', [
                                            m('button.btn.btn-sm.btn-primary', {
                                                onclick: () => NewTask.handleAddSchedule(vnode)
                                            }, '添加'),
                                            m('button.btn.btn-sm', {
                                                onclick: () => {
                                                    vnode.state.showScheduleForm = false;
                                                }
                                            }, '取消')
                                        ])
                                    ]) :
                                    m('button.btn.btn-sm', {
                                        onclick: () => {
                                            vnode.state.showScheduleForm = true;
                                        }
                                    }, [m('i.fas.fa-plus'), ' 添加计划'])
                            ]),
                            
                            m('div.form-group', [
                                m('label.form-label', '附件'),
                                m('p.field-hint', '支持上传多个附件，单个文件最大 10MB'),
                                
                                m('div.upload-area', {
                                    class: dragOver ? 'drag-over' : '',
                                    ondragover: (e) => NewTask.handleDragOver(vnode, e),
                                    ondragleave: (e) => NewTask.handleDragLeave(vnode, e),
                                    ondrop: (e) => NewTask.handleDropUpload(vnode, e)
                                }, [
                                    m('i.fas.fa-cloud-upload-alt'),
                                    m('p', '拖拽文件到此处或'),
                                    m('label.upload-btn', [
                                        m('input[type=file]', {
                                            multiple: true,
                                            accept: '*/*',
                                            style: { display: 'none' },
                                            onchange: (e) => NewTask.handleFileSelect(vnode, e)
                                        }),
                                        '选择文件'
                                    ])
                                ]),
                                
                                pendingFiles.length > 0 ? m('div.pending-files-list', [
                                    m('h4', `待上传文件 (${pendingFiles.length})`),
                                    pendingFiles.map((file, index) => 
                                        m('div.pending-file-item', [
                                            m('div.file-icon', getFileIcon(file.type)),
                                            m('div.file-info', [
                                                m('span.file-name', { title: file.name }, file.name),
                                                m('span.file-size', formatFileSize(file.size))
                                            ]),
                                            m('button.btn.btn-sm.btn-danger', {
                                                onclick: () => NewTask.removePendingFile(vnode, index),
                                                title: '移除'
                                            }, [m('i.fas.fa-times')])
                                        ])
                                    )
                                ]) : null,
                                
                                uploadingFiles ? m('div.upload-progress-container', [
                                    m('div.progress-bar-wrapper', [
                                        m('div.progress-bar-fill', {
                                            style: { width: uploadProgress + '%' }
                                        })
                                    ]),
                                    m('span.progress-text', `正在上传附件... ${Math.round(uploadProgress)}%`)
                                ]) : null
                            ]),
                            
                            m('div.form-actions', [
                                m('button.btn.btn-primary', {
                                    onclick: () => NewTask.handleSubmit(vnode),
                                    disabled: submitting || !formData.title.trim()
                                }, submitting ? '创建中...' : '创建任务'),
                                m('button.btn', {
                                    onclick: () => {
                                        m.route.set(`/tasks/${owner}/${repo.name}`);
                                    }
                                }, '取消')
                            ])
                        ])
                    ])
                ])
            ])
        ]);
    }
};

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(fileType) {
    if (!fileType) return m('i.fas.fa-file');
    
    if (fileType.startsWith('image/')) return m('i.fas.fa-file-image', { style: { color: '#4CAF50' } });
    if (fileType === 'application/pdf') return m('i.fas.fa-file-pdf', { style: { color: '#F44336' } });
    if (fileType.includes('word') || fileType.includes('document')) return m('i.fas.fa-file-word', { style: { color: '#2196F3' } });
    if (fileType.includes('excel') || fileType.includes('sheet')) return m('i.fas.fa-file-excel', { style: { color: '#4CAF50' } });
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('archive')) return m('i.fas.fa-file-archive', { style: { color: '#FF9800' } });
    if (fileType.includes('text') || fileType.includes('plain')) return m('i.fas.fa-file-alt', { style: { color: '#607D8B' } });
    if (fileType.includes('video')) return m('i.fas.fa-file-video', { style: { color: '#9C27B0' } });
    if (fileType.includes('audio')) return m('i.fas.fa-file-audio', { style: { color: '#E91E63' } });
    
    return m('i.fas.fa-file');
}

const ReleasesPage = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.issuesCount = 0;
        vnode.state.prsCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.releases = [];
        vnode.state.loading = true;
        vnode.state.syncing = false;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 }),
            TaskService.list(owner, repo, { per_page: 1 }),
            ReleaseService.list(owner, repo)
        ]).then(([repoResult, issuesResult, prsResult, tasksResult, releasesResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.releases = releasesResult.data || releasesResult || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load project:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    syncReleases(vnode) {
        const { owner, repo } = vnode.attrs;
        vnode.state.syncing = true;
        
        ReleaseService.sync(owner, repo).then(result => {
            vnode.state.syncing = false;
            return ReleaseService.list(owner, repo);
        }).then(releasesResult => {
            vnode.state.releases = releasesResult.data || releasesResult || [];
            m.redraw();
        }).catch(error => {
            console.error('Failed to sync releases:', error);
            vnode.state.syncing = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, issuesCount, prsCount, releases, loading, syncing } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        return m(Layout, [
            m('div.releases-page', [
                m(ProjectHeader, {
                    owner: owner,
                    repo: repo,
                    description: repo.description,
                    stars: repo.stars_count,
                    forks: repo.forks_count,
                    visibility: repo.is_private ? 'private' : 'public'
                }),
                
                m(ProjectTabs, {
                    owner: owner,
                    repo: repo,
                    issuesCount: issuesCount,
                    prsCount: prsCount,
                    tasksCount: vnode.state.tasksCount,
                    activeTab: 'releases'
                }),
                
                m('div.releases-content', [
                    m('div.releases-header', [
                        m('h1', '发布'),
                        repo.is_mirror ? m('button.btn.btn-primary', {
                            onclick: () => ReleasesPage.syncReleases(vnode),
                            disabled: syncing
                        }, [
                            m('i.fas.fa-sync', { class: syncing ? 'fa-spin' : '' }),
                            syncing ? ' 同步中...' : ' 从 GitHub 同步'
                        ]) : null
                    ]),
                    
                    releases.length === 0 ? 
                        m(EmptyState, { 
                            message: repo.is_mirror ? '暂无发布版本，点击上方按钮从 GitHub 同步' : '暂无发布版本', 
                            icon: 'fa-cube' 
                        }) :
                        releases.map((release, index) => 
                            m('div.release-card', [
                                m('div.release-header', [
                                    m('div.release-info', [
                                        m('div.release-title-row', [
                                            m('h2.release-title', m('a', { href: '#' }, release.tag_name)),
                                            index === 0 ? m('span.release-tag.latest', '最新版本') : null,
                                            release.is_prerelease ? m('span.release-tag.prerelease', '预发布') : null,
                                            release.is_draft ? m('span.release-tag.draft', '草稿') : null
                                        ]),
                                        m('div.release-meta', [
                                            m('span.release-meta-item', [
                                                m('i.fas.fa-tag'),
                                                ` ${release.tag_name}`
                                            ]),
                                            m('span.release-meta-item', [
                                                m('i.fas.fa-user'),
                                                ` ${release.author.username || 'unknown'}`
                                            ]),
                                            m('span.release-meta-item', [
                                                m('i.fas.fa-clock'),
                                                ` ${Utils.formatDate(release.created_at)}`
                                            ])
                                        ])
                                    ])
                                ]),
                                release.body ? m('div.release-body', [
                                    m('div.release-notes', [
                                        m(MarkdownRenderer, { content: release.body })
                                    ])
                                ]) : null
                            ])
                        )
                ])
            ])
        ]);
    }
};

const StatsPage = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.issuesCount = 0;
        vnode.state.prsCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.contributors = [];
        vnode.state.codeStats = null;
        vnode.state.commitActivity = [];
        vnode.state.loading = true;
        vnode.state.statsLoading = true;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 }),
            RepositoryService.getContributors(owner, repo),
            TaskService.list(owner, repo, { per_page: 1 })
        ]).then(([repoResult, issuesResult, prsResult, contributorsResult, tasksResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).length;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.contributors = contributorsResult.data || contributorsResult || [];
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load project:', error);
            vnode.state.loading = false;
            m.redraw();
        });
        
        Promise.all([
            RepositoryService.getCodeStats(owner, repo),
            RepositoryService.getCommitActivity(owner, repo, 30)
        ]).then(([codeStatsResult, activityResult]) => {
            vnode.state.codeStats = codeStatsResult.data || codeStatsResult;
            vnode.state.commitActivity = activityResult.activity || [];
            vnode.state.statsLoading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load stats:', error);
            vnode.state.statsLoading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, issuesCount, prsCount, contributors, loading, codeStats, commitActivity, statsLoading } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        return m(Layout, [
            m('div.stats-page', [
                m(ProjectHeader, {
                    owner: owner,
                    repo: repo,
                    description: repo.description,
                    stars: repo.stars_count,
                    forks: repo.forks_count,
                    visibility: repo.is_private ? 'private' : 'public'
                }),
                
                m(ProjectTabs, {
                    owner: owner,
                    repo: repo,
                    issuesCount: issuesCount,
                    prsCount: prsCount,
                    tasksCount: vnode.state.tasksCount,
                    activeTab: 'stats'
                }),
                
                m('div.stats-content', [
                    m('h1', '统计'),
                    
                    m('div.stats-grid', [
                        m('div.stat-card', [
                            m('div.stat-icon', m('i.fas.fa-star')),
                            m('div.stat-info', [
                                m('div.stat-value', repo.stars_count || 0),
                                m('div.stat-label', '星标')
                            ])
                        ]),
                        m('div.stat-card', [
                            m('div.stat-icon', m('i.fas.fa-code-branch')),
                            m('div.stat-info', [
                                m('div.stat-value', repo.forks_count || 0),
                                m('div.stat-label', 'Fork')
                            ])
                        ]),
                        m('div.stat-card', [
                            m('div.stat-icon', m('i.fas.fa-eye')),
                            m('div.stat-info', [
                                m('div.stat-value', repo.watch_count || 0),
                                m('div.stat-label', '关注')
                            ])
                        ]),
                        m('div.stat-card', [
                            m('div.stat-icon', m('i.fas.fa-exclamation-circle')),
                            m('div.stat-info', [
                                m('div.stat-value', issuesCount),
                                m('div.stat-label', '议题')
                            ])
                        ])
                    ]),
                    
                    codeStats ? m('div.code-stats-section', [
                        m('h2', [m('i.fas.fa-code'), ' 代码统计']),
                        
                        statsLoading ? 
                            m('div.loading-spinner', '加载中...') :
                            m('div.code-stats-grid', [
                                m('div.code-stat-card', [
                                    m('div.code-stat-icon', m('i.fas.fa-file-code')),
                                    m('div.code-stat-info', [
                                        m('div.code-stat-value', formatNumber(codeStats.total_lines)),
                                        m('div.code-stat-label', '总行数')
                                    ])
                                ]),
                                m('div.code-stat-card', [
                                    m('div.code-stat-icon', { style: { color: '#4CAF50' } }, m('i.fas.fa-code')),
                                    m('div.code-stat-info', [
                                        m('div.code-stat-value', formatNumber(codeStats.code_lines)),
                                        m('div.code-stat-label', '代码行')
                                    ])
                                ]),
                                m('div.code-stat-card', [
                                    m('div.code-stat-icon', { style: { color: '#FF9800' } }, m('i.fas.fa-comment')),
                                    m('div.code-stat-info', [
                                        m('div.code-stat-value', formatNumber(codeStats.comment_lines)),
                                        m('div.code-stat-label', '注释行')
                                    ])
                                ]),
                                m('div.code-stat-card', [
                                    m('div.code-stat-icon', { style: { color: '#9E9E9E' } }, m('i.fas.fa-minus')),
                                    m('div.code-stat-info', [
                                        m('div.code-stat-value', formatNumber(codeStats.blank_lines)),
                                        m('div.code-stat-label', '空行')
                                    ])
                                ])
                            ]),
                        
                        codeStats.languages && Object.keys(codeStats.languages).length > 0 ?
                            m('div.language-stats', [
                                m('h3', '语言分布'),
                                m('div.language-bars', Object.entries(codeStats.languages)
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 8)
                                    .map(([lang, lines]) => {
                                        const total = codeStats.code_lines || 1;
                                        const percentage = (lines / total * 100).toFixed(1);
                                        return m('div.language-bar-item', [
                                            m('div.language-bar-header', [
                                                m('span.language-name', lang),
                                                m('span.language-count', `${formatNumber(lines)} 行 (${percentage}%)`)
                                            ]),
                                            m('div.language-bar-track', [
                                                m('div.language-bar-fill', {
                                                    style: {
                                                        width: percentage + '%',
                                                        background: getLanguageColor(lang)
                                                    }
                                                })
                                            ])
                                        ]);
                                    }))
                            ]) : null
                    ]) : null,
                    
                    commitActivity && commitActivity.length > 0 ? m('div.commit-activity-section', [
                        m('h2', [m('i.fas.fa-chart-line'), ' 提交活动趋势']),
                        
                        m('div.activity-chart-container', [
                            m('svg.activity-chart', {
                                viewBox: '0 0 900 300',
                                preserveAspectRatio: 'xMidYMid meet'
                            }, [
                                m('defs', [
                                    m('linearGradient#activityGradient', {
                                        x1: '0%', y1: '0%',
                                        x2: '0%', y2: '100%'
                                    }, [
                                        m('stop', { offset: '0%', style: 'stop-color:var(--primary-color);stop-opacity:0.4' }),
                                        m('stop', { offset: '100%', style: 'stop-color:var(--primary-color);stop-opacity:0.05' })
                                    ]),
                                    m('filter#shadow', [
                                        m('feDropShadow', {
                                            dx: '0',
                                            dy: '2',
                                            stdDeviation: '3',
                                            'flood-color': 'var(--primary-color)',
                                            'flood-opacity': '0.3'
                                        })
                                    ])
                                ]),
                                
                                renderEnhancedChart(commitActivity)
                            ])
                        ]),
                        
                        m('div.activity-legend', [
                            m('div.legend-item', [
                                m('span.legend-dot', { style: { background: 'var(--primary-color)' } }),
                                '提交数'
                            ]),
                            m('div.legend-item', [
                                m('span.legend-bar', { style: { background: '#4CAF50' } }),
                                '添加行'
                            ]),
                            m('div.legend-item', [
                                m('span.legend-bar', { style: { background: '#F44336' } }),
                                '删除行'
                            ])
                        ]),
                        
                        m('div.activity-summary', [
                            m('div.summary-item', [
                                m('span.summary-label', '总提交数'),
                                m('span.summary-value', commitActivity.reduce((sum, a) => sum + a.count, 0))
                            ]),
                            m('div.summary-item', [
                                m('span.summary-label', '添加行'),
                                m('span.summary-value.additions', '+' + formatNumber(commitActivity.reduce((sum, a) => sum + (a.additions || 0), 0)))
                            ]),
                            m('div.summary-item', [
                                m('span.summary-label', '删除行'),
                                m('span.summary-value.deletions', '-' + formatNumber(commitActivity.reduce((sum, a) => sum + (a.deletions || 0), 0)))
                            ]),
                            m('div.summary-item', [
                                m('span.summary-label', '最活跃日'),
                                m('span.summary-value.highlight', (() => {
                                    const maxDay = commitActivity.reduce((max, a) => a.count > max.count ? a : max, commitActivity[0]);
                                    return maxDay.date;
                                })())
                            ])
                        ])
                    ]) : null,
                    
                    m('div.stats-section', [
                        m('h2', [m('i.fas.fa-users'), ' 贡献者']),
                        contributors.length === 0 
                            ? m(EmptyState, { 
                                message: '暂无贡献者', 
                                icon: 'fa-users' 
                            })
                            : m('div.contributors-grid', contributors.map((contributor, index) => {
                                const maxCommits = Math.max(...contributors.map(c => c.commits_count || 0), 1);
                                const commitPercent = ((contributor.commits_count || 0) / maxCommits * 100).toFixed(0);
                                
                                return m('div.contributor-card', [
                                    m('div.contributor-rank', {
                                        style: {
                                            background: index === 0 ? '#FFD700' : 
                                                       index === 1 ? '#C0C0C0' : 
                                                       index === 2 ? '#CD7F32' : 'var(--bg-tertiary)',
                                            color: index < 3 ? '#fff' : 'var(--text-secondary)'
                                        }
                                    }, `#${index + 1}`),
                                    
                                    m('img.contributor-avatar', { 
                                        src: contributor.avatar || '/images/avatar-80.svg', 
                                        alt: contributor.name,
                                        loading: 'lazy'
                                    }),
                                    
                                    m('div.contributor-details', [
                                        m('div.contributor-header', [
                                            m('span.contributor-name', contributor.name),
                                            m('span.contributor-commits', `${contributor.commits_count || 0} commits`)
                                        ]),
                                        
                                        m('div.contributor-bar-container', [
                                            m('div.contributor-bar', {
                                                style: {
                                                    width: commitPercent + '%',
                                                    background: index === 0 ? 'linear-gradient(90deg, #FFD700, #FFA500)' :
                                                               index === 1 ? 'linear-gradient(90deg, #C0C0C0, #A8A8A8)' :
                                                               index === 2 ? 'linear-gradient(90deg, #CD7F32, #8B4513)' :
                                                               `linear-gradient(90deg, var(--primary-color), var(--secondary-color))`
                                                }
                                            })
                                        ])
                                    ])
                                ]);
                            }))
                    ])
                ])
            ])
        ]);
    }
};

function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function getLanguageColor(lang) {
    const colors = {
        'Go': '#00ADD8',
        'JavaScript': '#F7DF1E',
        'TypeScript': '#3178C6',
        'Python': '#3776AB',
        'Ruby': '#CC342D',
        'Java': '#ED8B00',
        'C': '#A8B9CC',
        'C++': '#00599C',
        'C#': '#239120',
        'PHP': '#777BB4',
        'HTML': '#E34C26',
        'CSS': '#563D7C',
        'SCSS': '#CC6699',
        'Rust': '#DEA584',
        'Swift': '#FA7343',
        'Kotlin': '#A97BFF',
        'Scala': '#DC322F',
        'Lua': '#000080',
        'SQL': '#4479A1',
        'Shell': '#89E051',
        'YAML': '#CB171E',
        'XML': '#E34C26',
        'Markdown': '#083FA1',
        'Other': '#959DA5'
    };
    return colors[lang] || colors['Other'];
}

function renderEnhancedChart(activity) {
    if (!activity || activity.length === 0) return null;
    
    const chartWidth = 850;
    const chartHeight = 250;
    const padding = { top: 30, right: 30, bottom: 40, left: 50 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;
    
    const maxCount = Math.max(...activity.map(a => a.count), 1);
    const maxAdditions = Math.max(...activity.map(a => a.additions || 0), 1);
    const maxDeletions = Math.max(...activity.map(a => a.deletions || 0), 1);
    
    const elements = [];
    
    // 网格线
    for (let i = 0; i <= 5; i++) {
        const y = padding.top + (innerHeight / 5) * i;
        elements.push(m('line', {
            x1: padding.left,
            y1: y,
            x2: chartWidth - padding.right,
            y2: y,
            stroke: '#e5e7eb',
            'stroke-width': '1',
            'stroke-dasharray': '4,4'
        }));
        
        const value = Math.round(maxCount * (5 - i) / 5);
        elements.push(m('text', {
            x: padding.left - 10,
            y: y + 4,
            'text-anchor': 'end',
            'font-size': '11',
            fill: '#9CA3AF'
        }, value.toString()));
    }
    
    // X轴日期标签
    const labelInterval = Math.ceil(activity.length / 7);
    activity.forEach((a, i) => {
        if (i % labelInterval === 0) {
            const x = padding.left + (i / (activity.length - 1)) * innerWidth;
            elements.push(m('text', {
                x: x,
                y: chartHeight - 10,
                'text-anchor': 'middle',
                'font-size': '10',
                fill: '#9CA3AF'
            }, a.date.substring(5)));
        }
    });
    
    // 面积图路径
    const areaPoints = activity.map((a, i) => {
        const x = padding.left + (i / (activity.length - 1)) * innerWidth;
        const y = padding.top + innerHeight - (a.count / maxCount) * innerHeight;
        return `${x},${y}`;
    });
    
    const areaPath = `M ${padding.left},${padding.top + innerHeight} L ${areaPoints.join(' L')} L ${padding.left + innerWidth},${padding.top + innerHeight} Z`;
    
    elements.push(m('path', {
        d: areaPath,
        fill: 'url(#activityGradient)',
        stroke: 'none'
    }));
    
    // 折线路径
    const linePath = `M ${areaPoints.join(' L')}`;
    
    elements.push(m('path', {
        d: linePath,
        fill: 'none',
        stroke: 'var(--primary-color)',
        'stroke-width': '3',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        filter: 'url(#shadow)'
    }));
    
    // 数据点和工具提示
    activity.forEach((a, i) => {
        if (a.count > 0) {
            const x = padding.left + (i / (activity.length - 1)) * innerWidth;
            const y = padding.top + innerHeight - (a.count / maxCount) * innerHeight;
            
            elements.push(m('circle', {
                cx: x,
                cy: y,
                r: '6',
                fill: '#fff',
                stroke: 'var(--primary-color)',
                'stroke-width': '2.5',
                style: { cursor: 'pointer' },
                title: `${a.date}\n提交: ${a.count} 次\n添加: +${a.additions || 0} 行\n删除: -${a.deletions || 0} 行`
            }));
            
            // 悬停时显示数值
            if (a.count >= maxCount * 0.8) {
                elements.push(m('text', {
                    x: x,
                    y: y - 12,
                    'text-anchor': 'middle',
                    'font-size': '11',
                    'font-weight': '600',
                    fill: 'var(--primary-color)'
                }, a.count.toString()));
            }
        }
    });
    
    // X轴线
    elements.push(m('line', {
        x1: padding.left,
        y1: padding.top + innerHeight,
        x2: chartWidth - padding.right,
        y2: padding.top + innerHeight,
        stroke: '#D1D5DB',
        'stroke-width': '2'
    }));
    
    // Y轴线
    elements.push(m('line', {
        x1: padding.left,
        y1: padding.top,
        x2: padding.left,
        y2: padding.top + innerHeight,
        stroke: '#D1D5DB',
        'stroke-width': '2'
    }));
    
    return elements;
}


const SettingsPage = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;

        vnode.state.repo = null;
        vnode.state.issuesCount = 0;
        vnode.state.prsCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.loading = true;
        vnode.state.activeSection = 'general';
        vnode.state.formData = {
            name: '',
            description: '',
            is_private: false,
            default_branch: 'main'
        };
        vnode.state.saving = false;
        vnode.state.deleting = false;

        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 }),
            TaskService.list(owner, repo, { per_page: 1 })
        ]).then(([repoResult, issuesResult, prsResult, tasksResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.formData = {
                name: vnode.state.repo.name,
                description: vnode.state.repo.description || '',
                is_private: vnode.state.repo.is_private,
                default_branch: 'main'
            };
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load repository:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },

    handleSave: function(vnode) {
        const { owner, repo } = vnode.attrs;
        const { formData, saving } = vnode.state;

        if (saving) return;
        vnode.state.saving = true;

        RepositoryService.update(owner, repo, formData).then(result => {
            const updatedRepo = result.data || result;
            vnode.state.repo = updatedRepo;
            vnode.state.saving = false;
            alert('设置已保存！');
            if (formData.name && formData.name !== repo) {
                m.route.set('/settings/' + owner + '/' + formData.name);
            } else {
                m.redraw();
            }
        }).catch(error => {
            vnode.state.saving = false;
            alert('保存设置失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    handleDelete: function(vnode) {
        const { owner, repo } = vnode.attrs;
        const { deleting, repo: repoData } = vnode.state;

        if (deleting) return;
        if (!confirm(`确定要删除项目 "${repoData.name}" 吗？此操作不可撤销！`)) {
            return;
        }

        vnode.state.deleting = true;

        RepositoryService.delete(owner, repo).then(() => {
            vnode.state.deleting = false;
            alert('项目已删除！');
            m.route.set('/projects');
        }).catch(error => {
            vnode.state.deleting = false;
            alert('删除项目失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, loading, activeSection, formData } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        return m(Layout, [
            m(ProjectHeader, { repo, owner }),
            m(ProjectTabs, { 
                owner, 
                repo: repo, 
                issuesCount: vnode.state.issuesCount,
                prsCount: vnode.state.prsCount,
                tasksCount: vnode.state.tasksCount,
                activeTab: 'settings'
            }),
            
            m('div.settings-page', [
                m('div.settings-container', [
                    m('div.settings-sidebar', [
                        m('nav.settings-nav', [
                            m('a.settings-nav-item', {
                                class: activeSection === 'general' ? 'active' : '',
                                onclick: () => { vnode.state.activeSection = 'general'; }
                            }, [
                                m('i.fas.fa-cog'),
                                m('span', '常规设置')
                            ]),
                            m('a.settings-nav-item', {
                                class: activeSection === 'members' ? 'active' : '',
                                onclick: () => { vnode.state.activeSection = 'members'; }
                            }, [
                                m('i.fas.fa-users'),
                                m('span', '成员管理')
                            ]),
                            m('a.settings-nav-item', {
                                class: activeSection === 'integrations' ? 'active' : '',
                                onclick: () => { vnode.state.activeSection = 'integrations'; }
                            }, [
                                m('i.fas.fa-plug'),
                                m('span', '集成')
                            ]),
                            m('a.settings-nav-item', {
                                class: activeSection === 'webhooks' ? 'active' : '',
                                onclick: () => { vnode.state.activeSection = 'webhooks'; }
                            }, [
                                m('i.fas.fa-link'),
                                m('span', 'Webhooks')
                            ]),
                            m('a.settings-nav-item', {
                                class: activeSection === 'repository' ? 'active' : '',
                                onclick: () => { vnode.state.activeSection = 'repository'; }
                            }, [
                                m('i.fas.fa-database'),
                                m('span', '仓库设置')
                            ]),
                            m('a.settings-nav-item', {
                                class: activeSection === 'sync' ? 'active' : '',
                                onclick: () => { vnode.state.activeSection = 'sync'; }
                            }, [
                                m('i.fas.fa-sync'),
                                m('span', '代码同步')
                            ]),
                            m('a.settings-nav-item', {
                                class: activeSection === 'danger' ? 'active' : '',
                                onclick: () => { vnode.state.activeSection = 'danger'; }
                            }, [
                                m('i.fas.fa-exclamation-triangle'),
                                m('span', '危险区域')
                            ])
                        ])
                    ]),
                    
                    m('div.settings-content', [
                        activeSection === 'general' ? m(GeneralSettings, { formData, repo, parent: SettingsPage, parentVnode: vnode }) : null,
                        activeSection === 'members' ? m(MembersSettings, { repo }) : null,
                        activeSection === 'integrations' ? m(IntegrationsSettings, { repo }) : null,
                        activeSection === 'webhooks' ? m(WebhooksSettings, { repo }) : null,
                        activeSection === 'repository' ? m(RepositorySettings, { repo }) : null,
                        activeSection === 'sync' ? m(SyncSettings, { repo, owner, parent: SettingsPage, parentVnode: vnode }) : null,
                        activeSection === 'danger' ? m(DangerSettings, { repo: repo, parent: SettingsPage, parentVnode: vnode }) : null
                    ])
                ])
            ])
        ]);
    }
};

const GeneralSettings = {
    view(vnode) {
        const { formData, repo } = vnode.attrs;
        
        return m('div.settings-section', [
            m('div.settings-section-header', [
                m('h2.settings-section-title', '常规设置'),
                m('p.settings-section-description', '项目的基本信息和设置')
            ]),
            
            m('div.form-group', [
                m('label.form-label', '项目名称'),
                m('input.form-input', {
                    type: 'text',
                    value: formData.name,
                    oninput: (e) => { formData.name = e.target.value; }
                }),
                m('p.form-hint', '项目的显示名称，用于在列表和页面标题中展示')
            ]),
            
            m('div.form-group', [
                m('label.form-label', '项目描述'),
                m('textarea.form-input.form-textarea', {
                    value: formData.description,
                    oninput: (e) => { formData.description = e.target.value; }
                }),
                m('p.form-hint', '简短描述项目的用途和功能')
            ]),
            
            m('div.form-row', [
                m('div.form-group', [
                    m('label.form-label', '项目可见性'),
                    m('select.form-select', {
                        value: formData.is_private ? 'private' : 'public',
                        onchange: (e) => { formData.is_private = e.target.value === 'private'; }
                    }, [
                        m('option', { value: 'public' }, '公开'),
                        m('option', { value: 'private' }, '私有'),
                        m('option', { value: 'internal' }, '内部')
                    ])
                ]),
                
                m('div.form-group', [
                    m('label.form-label', '默认分支'),
                    m('select.form-select', {
                        value: formData.default_branch,
                        onchange: (e) => { formData.default_branch = e.target.value; }
                    }, [
                        m('option', { value: 'main' }, 'main'),
                        m('option', { value: 'develop' }, 'develop'),
                        m('option', { value: 'master' }, 'master')
                    ])
                ])
            ]),
            
            m('div.form-group', [
                m('div.form-checkbox-group', [
                    m('input.form-checkbox', {
                        type: 'checkbox',
                        id: 'wiki',
                        checked: true
                    }),
                    m('label', { for: 'wiki' }, '启用 Wiki')
                ])
            ]),
            
            m('div.form-group', [
                m('div.form-checkbox-group', [
                    m('input.form-checkbox', {
                        type: 'checkbox',
                        id: 'issues',
                        checked: true
                    }),
                    m('label', { for: 'issues' }, '启用 Issue 跟踪')
                ])
            ]),
            
            m('div.form-group', [
                m('button.btn.btn-primary', {
                    onclick: function() {
                        const pv = vnode && vnode.attrs && vnode.attrs.parentVnode;
                        if (pv) {
                            vnode.attrs.parent.handleSave(pv);
                        }
                    }
                }, '保存更改')
            ])
        ]);
    }
};

const MembersSettings = {
    view(vnode) {
        const { repo } = vnode.attrs;
        
        const members = [
            { name: 'Ryan', email: 'ryan@example.com', role: 'owner', avatar: '/images/avatar-40.svg' },
            { name: 'Alice', email: 'alice@example.com', role: 'developer', avatar: '/images/avatar-40.svg' }
        ];
        
        return m('div.settings-section', [
            m('div.settings-section-header', [
                m('h2.settings-section-title', '成员管理'),
                m('p.settings-section-description', '管理项目的成员和权限')
            ]),
            
            m('div.form-group', [
                m('button.btn.btn-primary', [
                    m('i.fas.fa-plus'),
                    ' 邀请成员'
                ])
            ]),
            
            m('div.members-list', members.map(member => 
                m('div.member-item', [
                    m('img.member-avatar', { src: member.avatar, alt: member.name }),
                    m('div.member-info', [
                        m('div.member-name', member.name),
                        m('div.member-email', member.email)
                    ]),
                    m('span.member-role', { class: member.role }, 
                        member.role === 'owner' ? '所有者' : '开发者'
                    ),
                    member.role !== 'owner' ? 
                        m('div.member-actions', [
                            m('button.btn-icon-sm', { title: '编辑权限' }, 
                                m('i.fas.fa-edit')
                            ),
                            m('button.btn-icon-sm.danger', { title: '移除成员' }, 
                                m('i.fas.fa-trash')
                            )
                        ]) : null
                ])
            ))
        ]);
    }
};

const IntegrationsSettings = {
    view(vnode) {
        return m('div.settings-section', [
            m('div.settings-section-header', [
                m('h2.settings-section-title', '集成'),
                m('p.settings-section-description', '配置外部服务和集成')
            ]),
            
            m('div.integrations-list', [
                m('div.integration-item', [
                    m('div.integration-icon', m('i.fab.fa-github')),
                    m('div.integration-info', [
                        m('h4', 'GitHub'),
                        m('p', '同步代码和Issue到GitHub')
                    ]),
                    m('button.btn', '配置')
                ]),
                m('div.integration-item', [
                    m('div.integration-icon', m('i.fab.fa-gitlab')),
                    m('div.integration-info', [
                        m('h4', 'GitLab'),
                        m('p', '同步代码和Issue到GitLab')
                    ]),
                    m('button.btn', '配置')
                ]),
                m('div.integration-item', [
                    m('div.integration-icon', m('i.fas fa-code-branch')),
                    m('div.integration-info', [
                        m('h4', 'Gitea'),
                        m('p', '同步代码和Issue到Gitea')
                    ]),
                    m('button.btn', '配置')
                ])
            ])
        ]);
    }
};

const WebhooksSettings = {
    view(vnode) {
        return m('div.settings-section', [
            m('div.settings-section-header', [
                m('h2.settings-section-title', 'Webhooks'),
                m('p.settings-section-description', '配置Webhook以接收项目事件通知')
            ]),
            
            m('div.form-group', [
                m('button.btn.btn-primary', [
                    m('i.fas.fa-plus'),
                    ' 添加 Webhook'
                ])
            ]),
            
            m(EmptyState, { 
                message: '暂无Webhook配置', 
                icon: 'fa-link' 
            })
        ]);
    }
};

const RepositorySettings = {
    view(vnode) {
        return m('div.settings-section', [
            m('div.settings-section-header', [
                m('h2.settings-section-title', '仓库设置'),
                m('p.settings-section-description', '管理仓库的高级设置')
            ]),
            
            m('div.form-group', [
                m('label.form-label', 'Git远程仓库URL'),
                m('input.form-input', {
                    type: 'text',
                    placeholder: 'https://github.com/user/repo.git',
                    readonly: true,
                    value: `https://gitfolio.io/${vnode.attrs.repo.name}.git`
                })
            ]),
            
            m('div.form-group', [
                m('label.form-label', '镜像设置'),
                m('div.form-checkbox-group', [
                    m('input.form-checkbox', {
                        type: 'checkbox',
                        id: 'mirror-enabled'
                    }),
                    m('label', { for: 'mirror-enabled' }, '启用镜像同步')
                ])
            ]),
            
            m('div.form-group', [
                m('label.form-label', '同步间隔（秒）'),
                m('input.form-input', {
                    type: 'number',
                    value: '3600',
                    min: '300'
                })
            ])
        ]);
    }
};

const DangerSettings = {
    view(vnode) {
        const { repo } = vnode.attrs;
        
        return m('div.settings-section.danger-zone', [
            m('div.settings-section-header', [
                m('h2.settings-section-title', '危险区域'),
                m('p.settings-section-description', '以下操作不可逆，请谨慎操作')
            ]),
            
            m('div.form-group', [
                m('h4', '归档项目'),
                m('p', '归档项目将使其变为只读状态'),
                m('button.btn', '归档项目')
            ]),
            
            m('div.form-group', [
                m('h4', '转移项目'),
                m('p', '将项目转移到其他命名空间'),
                m('button.btn', '转移项目')
            ]),
            
            m('div.form-group', [
                m('h4', '删除项目'),
                m('p', '永久删除此项目及其所有相关数据'),
                m('button.btn.btn-danger', {
                    onclick: function() {
                        const pv = vnode && vnode.attrs && vnode.attrs.parentVnode;
                        if (pv) {
                            vnode.attrs.parent.handleDelete(pv);
                        }
                    }
                }, '删除项目')
            ])
        ]);
    }
};

const SyncSettings = {
    oninit(vnode) {
        vnode.state.syncing = false;
        vnode.state.pushUrl = '';
    },

    handleSyncPull(vnode) {
        const { owner, repo } = vnode.attrs;
        if (vnode.state.syncing) return;

        vnode.state.syncing = true;
        RepositoryService.syncPull(owner, repo.name).then(result => {
            vnode.state.syncing = false;
            alert('同步成功！最后同步时间: ' + (result.last_sync || '未知'));
            m.redraw();
        }).catch(error => {
            vnode.state.syncing = false;
            alert('同步失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    handleSyncPush(vnode) {
        const { owner, repo } = vnode.attrs;
        const { pushUrl, syncing } = vnode.state;

        if (syncing) return;
        if (!pushUrl || !pushUrl.trim()) {
            alert('请输入推送目标 URL');
            return;
        }

        vnode.state.syncing = true;
        RepositoryService.syncPush(owner, repo.name, pushUrl).then(result => {
            vnode.state.syncing = false;
            alert('推送成功！');
            m.redraw();
        }).catch(error => {
            vnode.state.syncing = false;
            alert('推送失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { repo } = vnode.attrs;
        const { syncing, pushUrl } = vnode.state;
        const isMirror = repo.is_mirror;

        return m('div.settings-section', [
            m('div.settings-section-header', [
                m('h2.settings-section-title', '代码同步'),
                m('p.settings-section-description', '管理代码的拉取和推送同步')
            ]),

            isMirror ? [
                m('div.form-group', [
                    m('h4', '镜像同步'),
                    m('p', '从远程仓库拉取最新代码更新'),
                    m('p', [
                        m('strong', '镜像地址: '),
                        repo.mirror_url || '未设置'
                    ]),
                    repo.last_sync_at ? m('p', [
                        m('strong', '最后同步: '),
                        repo.last_sync_at
                    ]) : null,
                    m('button.btn.btn-primary', {
                        onclick: () => SyncSettings.handleSyncPull(vnode),
                        disabled: syncing
                    }, syncing ? '同步中...' : '立即同步')
                ])
            ] : [
                m('div.form-group', [
                    m('h4', '推送到远程'),
                    m('p', '将代码推送到远程仓库'),
                    m('div.form-row', [
                        m('input.form-input', {
                            type: 'text',
                            placeholder: '输入目标仓库 URL (例如: git@github.com:user/repo.git)',
                            value: pushUrl,
                            oninput: (e) => { vnode.state.pushUrl = e.target.value; },
                            style: 'flex: 1; margin-right: 10px;'
                        }),
                        m('button.btn.btn-primary', {
                            onclick: () => SyncSettings.handleSyncPush(vnode),
                            disabled: syncing
                        }, syncing ? '推送中...' : '推送')
                    ])
                ])
            ]
        ]);
    }
};


const CreateProjectPage = {
    oninit(vnode) {
        vnode.state.formData = {
            name: '',
            description: '',
            is_private: false,
            default_branch: 'main'
        };
        vnode.state.loading = false;
        vnode.state.error = null;
    },

    handleSubmit(vnode) {
        vnode.state.loading = true;
        vnode.state.error = null;

        RepositoryService.create(vnode.state.formData).then(result => {
            vnode.state.loading = false;
            m.route.set('/projects');
        }).catch(err => {
            vnode.state.loading = false;
            vnode.state.error = err.message || '创建项目失败';
            m.redraw();
        });
    },

    view(vnode) {
        const { formData, loading, error } = vnode.state;

        return m(Layout, [
            m('div.create-project-page', [
                m('div.page-header', [
                    m('h1', '创建项目'),
                    m('a.btn', { href: '/projects' }, [
                        m('i.fas.fa-arrow-left'),
                        ' 返回'
                    ])
                ]),

                m('div.create-project-form', [
                    error ? m('div.alert.alert-error', error) : null,

                    m('div.form-section', [
                        m('h3', '项目信息'),
                        m('div.form-group', [
                            m('label.form-label', { for: 'name' }, '项目名称 *'),
                            m('input#name.form-input', {
                                type: 'text',
                                placeholder: 'my-awesome-project',
                                value: formData.name,
                                oninput: (e) => {
                                    formData.name = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
                                }
                            }),
                            m('p.form-hint', '项目URL: /{username}/' + (formData.name || 'project-name'))
                        ]),

                        m('div.form-group', [
                            m('label.form-label', { for: 'description' }, '描述'),
                            m('textarea#description.form-input.form-textarea', {
                                placeholder: '简短描述项目用途...',
                                rows: 3,
                                value: formData.description,
                                oninput: (e) => { formData.description = e.target.value; }
                            })
                        ])
                    ]),

                    m('div.form-section', [
                        m('h3', '设置'),
                        m('div.form-group', [
                            m('label.form-label', '可见性'),
                            m('div.visibility-options', [
                                m('label.visibility-option', {
                                    class: !formData.is_private ? 'selected' : ''
                                }, [
                                    m('input', {
                                        type: 'radio',
                                        name: 'visibility',
                                        checked: !formData.is_private,
                                        onchange: () => { formData.is_private = false; }
                                    }),
                                    m('i.fas.fa-globe'),
                                    m('div', [
                                        m('strong', '公开'),
                                        m('span', '所有人可见')
                                    ])
                                ]),
                                m('label.visibility-option', {
                                    class: formData.is_private ? 'selected' : ''
                                }, [
                                    m('input', {
                                        type: 'radio',
                                        name: 'visibility',
                                        checked: formData.is_private,
                                        onchange: () => { formData.is_private = true; }
                                    }),
                                    m('i.fas.fa-lock'),
                                    m('div', [
                                        m('strong', '私有'),
                                        m('span', '仅自己可见')
                                    ])
                                ])
                            ])
                        ]),

                        m('div.form-group', [
                            m('label.form-label', '默认分支'),
                            m('select.form-select', {
                                value: formData.default_branch,
                                onchange: (e) => { formData.default_branch = e.target.value; }
                            }, [
                                m('option', { value: 'main' }, 'main'),
                                m('option', { value: 'master' }, 'master'),
                                m('option', { value: 'develop' }, 'develop')
                            ])
                        ])
                    ]),

                    m('div.form-actions', [
                        m('a.btn', { href: '/projects' }, '取消'),
                        m('button.btn.btn-primary', {
                            disabled: loading || !formData.name.trim(),
                            onclick: () => { CreateProjectPage.handleSubmit(vnode); }
                        }, loading ? '创建中...' : '创建项目')
                    ])
                ])
            ])
        ]);
    }
};


const MigrateProjectPage = {
    oninit(vnode) {
        vnode.state.formData = {
            clone_url: '',
            name: '',
            description: '',
            homepage: '',
            is_private: false,
            project_type: 'mirror'
        };
        vnode.state.loading = false;
        vnode.state.error = null;
        vnode.state.detected = null;
        vnode.state.fetchingGitHub = false;
    },

    detectPlatform(url) {
        if (!url) return null;
        if (url.includes('github.com')) return 'github';
        if (url.includes('gitea.com') || url.includes('gitea.')) return 'gitea';
        if (url.includes('gitlab.com') || url.includes('gitlab.')) return 'gitlab';
        return 'other';
    },

    extractRepoInfo(url) {
        const patterns = [
            /github\.com\/([^\/]+)\/([^\/\?#]+)/,
            /gitea\.(com|org)\/([^\/]+)\/([^\/\?#]+)/,
            /gitlab\.com\/([^\/]+)\/([^\/\?#]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return {
                    owner: match[1],
                    repo: match[2].replace(/\.git$/, ''),
                    platform: this.detectPlatform(url)
                };
            }
        }
        return null;
    },

    async fetchGitHubInfo(vnode, url) {
        if (!url || !url.includes('github.com')) return;
        
        vnode.state.fetchingGitHub = true;
        m.redraw();
        
        try {
            const response = await fetch(`/api/v1/repos/github-info?url=${encodeURIComponent(url)}`);
            if (response.ok) {
                const data = await response.json();
                if (!vnode.state.formData.name) {
                    vnode.state.formData.name = data.name;
                }
                if (!vnode.state.formData.description) {
                    vnode.state.formData.description = data.description || '';
                }
                if (!vnode.state.formData.homepage) {
                    vnode.state.formData.homepage = data.homepage || '';
                }
            }
        } catch (err) {
            console.error('Failed to fetch GitHub info:', err);
        } finally {
            vnode.state.fetchingGitHub = false;
            m.redraw();
        }
    },

    handleCloneUrlInput(vnode, e) {
        vnode.state.formData.clone_url = e.target.value;
        const detectedInfo = MigrateProjectPage.extractRepoInfo(e.target.value);
        if (detectedInfo) {
            vnode.state.detected = detectedInfo;
            if (detectedInfo.platform === 'github') {
                MigrateProjectPage.fetchGitHubInfo(vnode, e.target.value);
            }
        } else {
            vnode.state.detected = null;
        }
    },

    handleSubmit(vnode) {
        vnode.state.loading = true;
        vnode.state.error = null;

        const submitData = { ...vnode.state.formData };
        if (vnode.state.detected) {
            submitData.mirror_url = submitData.clone_url;
            submitData.platform = vnode.state.detected.platform;
        }

        RepositoryService.create(submitData).then(result => {
            vnode.state.loading = false;
            m.route.set('/projects');
        }).catch(err => {
            vnode.state.loading = false;
            let errorMsg = '迁移项目失败';
            if (typeof err === 'string') {
                errorMsg = err;
            } else if (err && err.message) {
                errorMsg = err.message;
            } else if (err && err.error) {
                errorMsg = err.error;
            } else if (err && err.response && err.response.error) {
                errorMsg = err.response.error;
            } else if (err && typeof err === 'object') {
                try {
                    errorMsg = JSON.stringify(err);
                } catch (e) {
                    errorMsg = String(err);
                }
            }
            vnode.state.error = errorMsg;
            m.redraw();
        });
    },

    view(vnode) {
        const { formData, loading, error, detected, fetchingGitHub } = vnode.state;

        return m(Layout, [
            m('div.migrate-project-page', [
                m('div.page-header', [
                    m('h1', '迁移项目'),
                    m('a.btn', { href: '/projects' }, [
                        m('i.fas.fa-arrow-left'),
                        ' 返回'
                    ])
                ]),

                m('div.migrate-project-form', [
                    error ? m('div.alert.alert-error', error) : null,

                    m('div.form-section', [
                        m('h3', '源仓库'),
                        m('div.form-group', [
                            m('label.form-label', { for: 'clone-url' }, '仓库地址 *'),
                            m('input#clone-url.form-input', {
                                type: 'url',
                                placeholder: 'https://github.com/user/repo',
                                value: formData.clone_url,
                                oninput: (e) => { MigrateProjectPage.handleCloneUrlInput(vnode, e); }
                            }),
                            m('p.form-hint', '支持 GitHub、Gitea、GitLab 等平台')
                        ]),

                        detected ? m('div.detected-info', [
                            m('i.fas.fa-check-circle'),
                            m('span', '检测到 ' + detected.platform + ' 仓库: ' + detected.owner + '/' + detected.repo),
                            fetchingGitHub ? m('span.loading-hint', ' (正在获取信息...)') : null
                        ]) : null
                    ]),

                    m('div.form-section', [
                        m('h3', '项目信息'),
                        m('div.form-group', [
                            m('label.form-label', { for: 'name' }, '项目名称 *'),
                            m('input#name.form-input', {
                                type: 'text',
                                placeholder: 'my-mirrored-project',
                                value: formData.name,
                                oninput: (e) => {
                                    formData.name = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
                                }
                            }),
                            m('p.form-hint', '项目URL: /{username}/' + (formData.name || 'project-name'))
                        ]),

                        m('div.form-group', [
                            m('label.form-label', { for: 'description' }, '描述'),
                            m('textarea#description.form-input.form-textarea', {
                                placeholder: '简短描述项目...',
                                rows: 3,
                                value: formData.description,
                                oninput: (e) => { formData.description = e.target.value; }
                            })
                        ]),

                        m('div.form-group', [
                            m('label.form-label', { for: 'homepage' }, '主页'),
                            m('input#homepage.form-input', {
                                type: 'url',
                                placeholder: 'https://example.com',
                                value: formData.homepage,
                                oninput: (e) => { formData.homepage = e.target.value; }
                            }),
                            m('p.form-hint', '项目主页地址')
                        ])
                    ]),

                    m('div.form-section', [
                        m('h3', '设置'),
                        m('div.form-group', [
                            m('label.form-label', '可见性'),
                            m('div.visibility-options', [
                                m('label.visibility-option', {
                                    class: !formData.is_private ? 'selected' : ''
                                }, [
                                    m('input', {
                                        type: 'radio',
                                        name: 'visibility',
                                        checked: !formData.is_private,
                                        onchange: () => { formData.is_private = false; }
                                    }),
                                    m('i.fas.fa-globe'),
                                    m('div', [
                                        m('strong', '公开'),
                                        m('span', '所有人可见')
                                    ])
                                ]),
                                m('label.visibility-option', {
                                    class: formData.is_private ? 'selected' : ''
                                }, [
                                    m('input', {
                                        type: 'radio',
                                        name: 'visibility',
                                        checked: formData.is_private,
                                        onchange: () => { formData.is_private = true; }
                                    }),
                                    m('i.fas.fa-lock'),
                                    m('div', [
                                        m('strong', '私有'),
                                        m('span', '仅自己可见')
                                    ])
                                ])
                            ])
                        ])
                    ]),

                    m('div.form-actions', [
                        m('a.btn', { href: '/projects' }, '取消'),
                        m('button.btn.btn-primary', {
                            disabled: loading || !formData.clone_url.trim() || !formData.name.trim(),
                            onclick: () => { MigrateProjectPage.handleSubmit(vnode); }
                        }, loading ? '迁移中...' : '迁移项目')
                    ])
                ])
            ])
        ]);
    }
};


const LoginPage = {
    oninit(vnode) {
        vnode.state.username = '';
        vnode.state.password = '';
        vnode.state.error = null;
        vnode.state.loading = false;
    },

    handleLogin(vnode) {
        const { username, password } = vnode.state;

        if (!username.trim() || !password.trim()) {
            vnode.state.error = '请输入用户名和密码';
            return;
        }

        vnode.state.loading = true;
        vnode.state.error = null;

        API.post('/auth/login', { username, password }).then(result => {
            if (result.token) {
                Auth.setToken(result.token);
                localStorage.setItem('user', JSON.stringify(result.user));
                window.location.href = '/projects';
            } else {
                vnode.state.error = '登录失败';
                vnode.state.loading = false;
                m.redraw();
            }
        }).catch(err => {
            vnode.state.error = '用户名或密码错误';
            vnode.state.loading = false;
            m.redraw();
        });
    },

    view(vnode) {
        const { username, password, error, loading } = vnode.state;

        return m('div.login-page', [
            m('div.login-container', [
                m('div.login-header', [
                    m('h1', 'GitFolio'),
                    m('p', '代码管理与同步平台')
                ]),

                m('form.login-form', {
                    onsubmit: (e) => {
                        e.preventDefault();
                        LoginPage.handleLogin(vnode);
                    }
                }, [
                    error ? m('div.alert.alert-error', error) : null,

                    m('div.form-group', [
                        m('label.form-label', { for: 'username' }, '用户名'),
                        m('input#username.form-input', {
                            type: 'text',
                            placeholder: '输入用户名',
                            value: username,
                            oninput: (e) => { vnode.state.username = e.target.value; }
                        })
                    ]),

                    m('div.form-group', [
                        m('label.form-label', { for: 'password' }, '密码'),
                        m('input#password.form-input', {
                            type: 'password',
                            placeholder: '输入密码',
                            value: password,
                            oninput: (e) => { vnode.state.password = e.target.value; }
                        })
                    ]),

                    m('button.btn.btn-primary.btn-block', {
                        type: 'submit',
                        disabled: loading
                    }, loading ? '登录中...' : '登录')
                ]),

                m('div.login-footer', [
                    m('p', '默认账号: ryan / password123')
                ])
            ])
        ]);
    }
};


const Groups = {
    oninit(vnode) {
        vnode.state.groups = [];
        vnode.state.loading = true;
        vnode.state.page = 1;
        vnode.state.perPage = 30;

        GroupService.list(1, 30).then(result => {
            vnode.state.groups = result.data || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    view(vnode) {
        const { groups, loading } = vnode.state;

        return m(Layout, [
            m('div.page-header', [
                m('h1', [m('i.fas.fa-users'), ' 团队']),
                m('div.page-actions', [
                    m('button.btn.btn-primary', {
                        onclick: () => m.route.set('/groups/new')
                    }, [m('i.fas.fa-plus'), ' 新建团队'])
                ])
            ]),

            loading ? m(Loading) : [
                groups.length === 0 
                    ? m(EmptyState, { message: '暂无团队', icon: 'fa-users' })
                    : m('div.groups-list', groups.map(group => 
                        m('div.group-card', {
                            onclick: () => m.route.set(`/groups/${group.name}`)
                        }, [
                            m('div.group-avatar', [
                                group.avatar 
                                    ? m('img', { src: group.avatar, alt: group.name })
                                    : m('div.avatar-placeholder', group.display_name ? group.display_name[0].toUpperCase() : group.name[0].toUpperCase())
                            ]),
                            m('div.group-info', [
                                m('h3.group-name', group.display_name || group.name),
                                group.description ? m('p.group-description', group.description) : null,
                                m('div.group-meta', [
                                    m('span', [m('i.fas.fa-users'), ` ${group.members_count || 0} 成员`]),
                                    group.location ? m('span', [m('i.fas.fa-map-marker-alt'), ` ${group.location}`]) : null,
                                    group.website ? m('a', { href: group.website, target: '_blank', onclick: e => e.stopPropagation() }, [m('i.fas.fa-globe')]) : null
                                ])
                            ])
                        ])
                    ))
            ]
        ]);
    }
};

const GroupDetail = {
    oninit(vnode) {
        const { name } = vnode.attrs;
        vnode.state.group = null;
        vnode.state.currentUser = null;
        vnode.state.members = [];
        vnode.state.loading = true;
        vnode.state.editing = false;
        vnode.state.editForm = {};
        vnode.state.activeTab = 'overview';
        vnode.state.showAddMember = false;
        vnode.state.newMemberUsername = '';
        vnode.state.newMemberRole = 'member';

        GroupDetail.loadGroup(vnode, name);
    },

    loadGroup(vnode, name) {
        Promise.all([
            GroupService.get(name),
            API.get('/user/me'),
            GroupService.getMembers(name)
        ]).then(([groupResult, userResult, membersResult]) => {
            vnode.state.group = groupResult;
            vnode.state.currentUser = userResult;
            vnode.state.members = membersResult.data || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    canEdit(vnode) {
        const { currentUser, group } = vnode.state;
        if (!currentUser || !group) return false;
        if (currentUser.is_admin) return true;
        const member = vnode.state.members.find(m => m.user.id === currentUser.id);
        return member && (member.role === 'owner' || member.role === 'admin');
    },

    startEdit(vnode) {
        const { group } = vnode.state;
        vnode.state.editing = true;
        vnode.state.editForm = {
            display_name: group.display_name || '',
            description: group.description || '',
            website: group.website || '',
            location: group.location || ''
        };
    },

    cancelEdit(vnode) {
        vnode.state.editing = false;
        vnode.state.editForm = {};
    },

    saveEdit(vnode) {
        const { name } = vnode.attrs;
        vnode.state.saving = true;
        
        GroupService.update(name, vnode.state.editForm).then(result => {
            vnode.state.group = result;
            vnode.state.editing = false;
            vnode.state.saving = false;
            m.redraw();
        }).catch(error => {
            vnode.state.saving = false;
            alert('保存失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    handleAvatarUpload(vnode, e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        const { name } = vnode.attrs;
        vnode.state.uploadingAvatar = true;

        GroupService.uploadAvatar(name, formData).then(result => {
            vnode.state.group = result;
            vnode.state.uploadingAvatar = false;
            m.redraw();
        }).catch(error => {
            vnode.state.uploadingAvatar = false;
            alert('上传失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    addMember(vnode) {
        const { name } = vnode.attrs;
        const { newMemberUsername, newMemberRole } = vnode.state;

        if (!newMemberUsername) {
            alert('请输入用户名');
            return;
        }

        vnode.state.addingMember = true;

        GroupService.addMember(name, {
            username: newMemberUsername,
            role: newMemberRole
        }).then(() => {
            vnode.state.showAddMember = false;
            vnode.state.newMemberUsername = '';
            vnode.state.newMemberRole = 'member';
            vnode.state.addingMember = false;
            GroupDetail.loadGroup(vnode, name);
        }).catch(error => {
            vnode.state.addingMember = false;
            alert('添加成员失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    removeMember(vnode, username) {
        if (!confirm(`确定要移除成员 ${username} 吗？`)) {
            return;
        }

        const { name } = vnode.attrs;

        GroupService.removeMember(name, username).then(() => {
            GroupDetail.loadGroup(vnode, name);
        }).catch(error => {
            alert('移除成员失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { group, loading, editing, editForm, saving, activeTab, members, currentUser, showAddMember, newMemberUsername, newMemberRole, uploadingAvatar, addingMember } = vnode.state;

        if (loading) {
            return m(Layout, m(Loading));
        }

        if (!group) {
            return m(Layout, m(EmptyState, { message: '团队不存在', icon: 'fa-users' }));
        }

        return m(Layout, [
            m('div.group-detail-page', [
                m('div.group-header', [
                    m('div.group-avatar-large', {
                        style: { position: 'relative' }
                    }, [
                        group.avatar 
                            ? m('img', { src: group.avatar, alt: group.name })
                            : m('div.avatar-placeholder', group.display_name ? group.display_name[0].toUpperCase() : group.name[0].toUpperCase()),
                        GroupDetail.canEdit(vnode) ? m('div.avatar-upload-overlay', {
                            onclick: () => document.getElementById('avatar-input').click()
                        }, [
                            m('i.fas.fa-camera'),
                            m('input#avatar-input', {
                                type: 'file',
                                accept: 'image/*',
                                style: { display: 'none' },
                                onchange: e => GroupDetail.handleAvatarUpload(vnode, e)
                            })
                        ]) : null,
                        uploadingAvatar ? m('div.avatar-uploading', [
                            m('i.fas.fa-spinner.fa-spin')
                        ]) : null
                    ]),
                    m('div.group-info', [
                        editing ? [
                            m('div.form-group', [
                                m('input.form-input', {
                                    type: 'text',
                                    value: editForm.display_name,
                                    oninput: e => { editForm.display_name = e.target.value; },
                                    placeholder: '显示名称'
                                })
                            ]),
                            m('div.form-group', [
                                m('textarea.form-input', {
                                    value: editForm.description,
                                    oninput: e => { editForm.description = e.target.value; },
                                    placeholder: '团队描述',
                                    rows: 2
                                })
                            ]),
                            m('div.form-group', [
                                m('input.form-input', {
                                    type: 'url',
                                    value: editForm.website,
                                    oninput: e => { editForm.website = e.target.value; },
                                    placeholder: '网站'
                                })
                            ]),
                            m('div.form-group', [
                                m('input.form-input', {
                                    type: 'text',
                                    value: editForm.location,
                                    oninput: e => { editForm.location = e.target.value; },
                                    placeholder: '位置'
                                })
                            ]),
                            m('div.form-actions', [
                                m('button.btn.btn-primary', {
                                    onclick: () => GroupDetail.saveEdit(vnode),
                                    disabled: saving
                                }, saving ? '保存中...' : '保存'),
                                m('button.btn', {
                                    onclick: () => GroupDetail.cancelEdit(vnode)
                                }, '取消')
                            ])
                        ] : [
                            m('h1', group.display_name || group.name),
                            group.description ? m('p.group-description', group.description) : null,
                            m('div.group-meta', [
                                m('span', [m('i.fas.fa-users'), ` ${members.length} 成员`]),
                                group.location ? m('span', [m('i.fas.fa-map-marker-alt'), ` ${group.location}`]) : null,
                                group.website ? m('a', { href: group.website, target: '_blank' }, [m('i.fas.fa-globe'), ' 网站']) : null
                            ]),
                            GroupDetail.canEdit(vnode) ? m('button.btn.btn-secondary', {
                                onclick: () => GroupDetail.startEdit(vnode),
                                style: { marginTop: '10px' }
                            }, [m('i.fas.fa-edit'), ' 编辑团队信息']) : null
                        ]
                    ])
                ]),

                m('div.group-tabs', [
                    m('a.tab' + (activeTab === 'overview' ? '.active' : ''), {
                        onclick: () => { vnode.state.activeTab = 'overview'; }
                    }, '概览'),
                    m('a.tab' + (activeTab === 'members' ? '.active' : ''), {
                        onclick: () => { vnode.state.activeTab = 'members'; }
                    }, '成员'),
                    m('a.tab', { href: '#' }, '项目'),
                    m('a.tab', { href: '#' }, '设置')
                ]),

                m('div.group-content', [
                    activeTab === 'overview' ? [
                        m('div.info-section', [
                            m('h3', '团队信息'),
                            m('div.info-row', [m('strong', '名称: '), group.name]),
                            m('div.info-row', [m('strong', '创建时间: '), group.created_at])
                        ])
                    ] : activeTab === 'members' ? [
                        m('div.members-section', [
                            m('div.members-header', [
                                m('h3', '团队成员'),
                                GroupDetail.canEdit(vnode) ? m('button.btn.btn-primary', {
                                    onclick: () => { vnode.state.showAddMember = !showAddMember; }
                                }, [m('i.fas.fa-plus'), ' 添加成员']) : null
                            ]),
                            showAddMember ? m('div.add-member-form', [
                                m('div.form-row', [
                                    m('input.form-input', {
                                        type: 'text',
                                        placeholder: '用户名',
                                        value: newMemberUsername,
                                        oninput: e => { vnode.state.newMemberUsername = e.target.value; }
                                    }),
                                    m('select.form-input', {
                                        value: newMemberRole,
                                        onchange: e => { vnode.state.newMemberRole = e.target.value; }
                                    }, [
                                        m('option', { value: 'member' }, '成员'),
                                        m('option', { value: 'admin' }, '管理员')
                                    ]),
                                    m('button.btn.btn-primary', {
                                        onclick: () => GroupDetail.addMember(vnode),
                                        disabled: addingMember
                                    }, addingMember ? '添加中...' : '添加'),
                                    m('button.btn', {
                                        onclick: () => { vnode.state.showAddMember = false; }
                                    }, '取消')
                                ])
                            ]) : null,
                            m('div.members-list', members.map(member => 
                                m('div.member-card', [
                                    m('div.member-avatar', [
                                        member.user.avatar 
                                            ? m('img', { src: member.user.avatar, alt: member.user.username })
                                            : m('div.avatar-placeholder', member.user.username[0].toUpperCase())
                                    ]),
                                    m('div.member-info', [
                                        m('div.member-header', [
                                            m('h4.member-name', member.user.full_name || member.user.username),
                                            m('span.member-role', member.role === 'owner' ? '所有者' : member.role === 'admin' ? '管理员' : '成员')
                                        ]),
                                        m('p.member-email', member.user.email)
                                    ]),
                                    GroupDetail.canEdit(vnode) && member.role !== 'owner' ? m('div.member-actions', [
                                        m('button.btn.btn-danger.btn-sm', {
                                            onclick: () => GroupDetail.removeMember(vnode, member.user.username)
                                        }, [m('i.fas.fa-times'), ' 移除'])
                                    ]) : null
                                ])
                            ))
                        ])
                    ] : null
                ])
            ])
        ]);
    }
};

const NewGroup = {
    oninit(vnode) {
        vnode.state.form = {
            name: '',
            display_name: '',
            description: '',
            website: '',
            location: ''
        };
        vnode.state.creating = false;
    },

    create(vnode) {
        const { form } = vnode.state;

        if (!form.name) {
            alert('请输入团队名称');
            return;
        }

        vnode.state.creating = true;

        GroupService.create(form).then(result => {
            vnode.state.creating = false;
            m.route.set(`/groups/${result.name}`);
        }).catch(error => {
            vnode.state.creating = false;
            alert('创建失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { form, creating } = vnode.state;

        return m(Layout, [
            m('div.page-header', [
                m('h1', [m('i.fas.fa-plus'), ' 新建团队'])
            ]),

            m('div.new-group-form', [
                m('div.form-group', [
                    m('label', '团队名称 *'),
                    m('input.form-input', {
                        type: 'text',
                        value: form.name,
                        oninput: e => { form.name = e.target.value; },
                        placeholder: '团队唯一标识（英文字母、数字、下划线）'
                    })
                ]),

                m('div.form-group', [
                    m('label', '显示名称'),
                    m('input.form-input', {
                        type: 'text',
                        value: form.display_name,
                        oninput: e => { form.display_name = e.target.value; },
                        placeholder: '团队显示名称'
                    })
                ]),

                m('div.form-group', [
                    m('label', '描述'),
                    m('textarea.form-input', {
                        value: form.description,
                        oninput: e => { form.description = e.target.value; },
                        placeholder: '团队描述',
                        rows: 3
                    })
                ]),

                m('div.form-group', [
                    m('label', '网站'),
                    m('input.form-input', {
                        type: 'url',
                        value: form.website,
                        oninput: e => { form.website = e.target.value; },
                        placeholder: 'https://example.com'
                    })
                ]),

                m('div.form-group', [
                    m('label', '位置'),
                    m('input.form-input', {
                        type: 'text',
                        value: form.location,
                        oninput: e => { form.location = e.target.value; },
                        placeholder: '城市, 国家'
                    })
                ]),

                m('div.form-actions', [
                    m('button.btn.btn-primary', {
                        onclick: () => NewGroup.create(vnode),
                        disabled: creating
                    }, creating ? '创建中...' : '创建团队'),
                    m('button.btn', {
                        onclick: () => m.route.set('/groups')
                    }, '取消')
                ])
            ])
        ]);
    }
};


const Activities = {
    oninit(vnode) {
        vnode.state.activities = [];
        vnode.state.loading = true;
        vnode.state.page = 1;

        ActivityService.list(1, 30).then(result => {
            vnode.state.activities = result.data || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    getActivityIcon(type) {
        const icons = {
            'create_repo': 'fa-plus-circle',
            'push': 'fa-upload',
            'star': 'fa-star',
            'fork': 'fa-code-branch',
            'issue': 'fa-exclamation-circle',
            'pr': 'fa-code-pull-request',
            'comment': 'fa-comment',
            'release': 'fa-tag',
            'default': 'fa-circle'
        };
        return icons[type] || icons['default'];
    },

    getActivityColor(type) {
        const colors = {
            'create_repo': '#28a745',
            'push': '#0366d6',
            'star': '#f1c40f',
            'fork': '#8b5cf6',
            'issue': '#e67e22',
            'pr': '#9b59b6',
            'comment': '#3498db',
            'release': '#2ecc71',
            'default': '#95a5a6'
        };
        return colors[type] || colors['default'];
    },

    formatTime(timeStr) {
        const date = new Date(timeStr);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes} 分钟前`;
        if (hours < 24) return `${hours} 小时前`;
        if (days < 7) return `${days} 天前`;
        return date.toLocaleDateString('zh-CN');
    },

    view(vnode) {
        const { activities, loading } = vnode.state;
        const self = vnode.state;

        return m(Layout, [
            m('div.page-header', [
                m('h1', [m('i.fas.fa-bolt'), ' 活动']),
                m('p.page-description', '查看所有用户的活动动态')
            ]),

            loading ? m(Loading) : [
                activities.length === 0 
                    ? m(EmptyState, { message: '暂无活动记录', icon: 'fa-bolt' })
                    : m('div.activity-timeline', activities.map(activity => 
                        m('div.activity-item', [
                            m('div.activity-icon', {
                                style: { backgroundColor: self.getActivityColor(activity.activity_type) }
                            }, [
                                m(`i.fas.${self.getActivityIcon(activity.activity_type)}`)
                            ]),
                            m('div.activity-content', [
                                m('div.activity-header', [
                                    activity.username 
                                        ? m('a.username', { href: '#', onclick: e => { e.preventDefault(); m.route.set(`/${activity.username}`); } }, activity.username)
                                        : m('span.username', '未知用户'),
                                    m('span.activity-title', activity.title || '进行了操作')
                                ]),
                                activity.repository 
                                    ? m('div.activity-repo', [
                                        m('i.fas.fa-book'),
                                        m('a', { 
                                            href: '#', 
                                            onclick: e => { e.preventDefault(); m.route.set(`/${activity.repository}`); } 
                                        }, activity.repository)
                                    ]) : null,
                                activity.content 
                                    ? m('div.activity-text', activity.content) : null,
                                m('div.activity-time', self.formatTime(activity.created_at))
                            ])
                        ])
                    ))
            ]
        ]);
    }
};


const Milestones = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        vnode.state.milestones = [];
        vnode.state.loading = true;

        MilestoneService.list(owner, repo).then(result => {
            vnode.state.milestones = result.data || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    formatDate(dateStr) {
        if (!dateStr) return '无截止日期';
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN');
    },

    isOverdue(dateStr) {
        if (!dateStr) return false;
        return new Date(dateStr) < new Date();
    },

    view(vnode) {
        const { milestones, loading } = vnode.state;
        const { owner, repo } = vnode.attrs;
        const self = vnode.state;

        return m('div.milestones-section', [
            m('div.milestones-header', [
                m('h2', '里程碑'),
                m('button.btn.btn-primary', {
                    onclick: () => m.route.set(`/${owner}/${repo}/milestones/new`)
                }, [m('i.fas.fa-plus'), ' 新建里程碑'])
            ]),

            loading ? m(Loading) : [
                milestones.length === 0 
                    ? m(EmptyState, { message: '暂无里程碑', icon: 'fa-flag' })
                    : m('div.milestones-list', milestones.map(milestone => 
                        m('div.milestone-item', { class: milestone.is_closed ? 'closed' : '' }, [
                            m('div.milestone-icon', [
                                m(`i.fas.${milestone.is_closed ? 'fa-check-circle' : 'fa-flag'}`)
                            ]),
                            m('div.milestone-content', [
                                m('h3.milestone-title', [
                                    milestone.title,
                                    milestone.is_closed ? m('span.badge.closed', '已关闭') : null
                                ]),
                                milestone.description 
                                    ? m('p.milestone-description', milestone.description) : null,
                                m('div.milestone-meta', [
                                    m('span.due-date', {
                                        class: self.isOverdue(milestone.due_date) && !milestone.is_closed ? 'overdue' : ''
                                    }, [
                                        m('i.fas.fa-calendar'),
                                        ' 截止: ' + self.formatDate(milestone.due_date)
                                    ]),
                                    m('span.created', `创建于 ${milestone.created_at}`)
                                ])
                            ])
                        ])
                    ))
            ]
        ]);
    }
};

const NewMilestone = {
    oninit(vnode) {
        vnode.state.form = {
            title: '',
            description: '',
            due_date: ''
        };
        vnode.state.submitting = false;
    },

    submit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        if (!vnode.state.form.title) {
            alert('请输入里程碑标题');
            return;
        }

        vnode.state.submitting = true;
        MilestoneService.create(owner, repo, vnode.state.form).then(result => {
            m.route.set(`/${owner}/${repo}/milestones`);
        }).catch(error => {
            vnode.state.submitting = false;
            alert('创建失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { form, submitting } = vnode.state;
        const { owner, repo } = vnode.attrs;

        return m('div.new-milestone-page', [
            m('div.page-header', [
                m('h2', '新建里程碑'),
                m('p', `为 ${owner}/${repo} 创建新里程碑`)
            ]),

            m('div.form-container', [
                m('div.form-group', [
                    m('label', '标题 *'),
                    m('input.form-input', {
                        type: 'text',
                        value: form.title,
                        oninput: e => { form.title = e.target.value; },
                        placeholder: '例如: v1.0.0'
                    })
                ]),

                m('div.form-group', [
                    m('label', '描述'),
                    m('textarea.form-input', {
                        value: form.description,
                        oninput: e => { form.description = e.target.value; },
                        placeholder: '里程碑描述',
                        rows: 4
                    })
                ]),

                m('div.form-group', [
                    m('label', '截止日期'),
                    m('input.form-input', {
                        type: 'date',
                        value: form.due_date,
                        oninput: e => { form.due_date = e.target.value; }
                    })
                ]),

                m('div.form-actions', [
                    m('button.btn.btn-primary', {
                        onclick: () => NewMilestone.submit(vnode),
                        disabled: submitting
                    }, submitting ? '创建中...' : '创建里程碑'),
                    m('button.btn', {
                        onclick: () => m.route.set(`/${owner}/${repo}/milestones`)
                    }, '取消')
                ])
            ])
        ]);
    }
};


const highlightCode = (code, language) => {
    if (typeof hljs !== 'undefined' && language) {
        try {
            const langClass = language.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (hljs.getLanguage(langClass)) {
                return hljs.highlight(code, { language: langClass }).value;
            }
        } catch (e) {
            console.error('Highlight error:', e);
        }
    }
    return code;
};

const SnippetsPage = {
    oninit(vnode) {
        vnode.state.snippets = [];
        vnode.state.loading = true;
        vnode.state.page = 1;
        vnode.state.perPage = 30;
        vnode.state.language = '';

        SnippetService.list(1, 30).then(result => {
            vnode.state.snippets = result.data || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    view(vnode) {
        const { snippets, loading } = vnode.state;

        return m(Layout, [
            m('div.page-header', [
                m('h1', [m('i.fas.fa-code'), ' 片段']),
                m('div.page-actions', [
                    Auth.isAuthenticated() ? m('button.btn.btn-primary', {
                        onclick: () => m.route.set('/snippets/new')
                    }, [m('i.fas.fa-plus'), ' 新建片段']) : null
                ])
            ]),

            loading ? m(Loading) : [
                snippets.length === 0 
                    ? m(EmptyState, { message: '暂无片段', icon: 'fa-code' })
                    : m('div.snippets-list', snippets.map(snippet => 
                        m('div.snippet-card', {
                            onclick: () => m.route.set(`/snippets/${snippet.id}`)
                        }, [
                            m('div.snippet-header', [
                                m('h3.snippet-title', snippet.title),
                                snippet.language ? m('span.language-badge', snippet.language) : null
                            ]),
                            snippet.description ? m('p.snippet-description', snippet.description) : null,
                            m('div.snippet-meta', [
                                snippet.username ? m('span', [m('i.fas.fa-user'), ` ${snippet.username}`]) : null,
                                m('span', [m('i.fas.fa-clock'), ` ${snippet.created_at}`])
                            ])
                        ])
                    ))
            ]
        ]);
    }
};

const SnippetDetail = {
    oninit(vnode) {
        const { id } = vnode.attrs;
        vnode.state.snippet = null;
        vnode.state.loading = true;

        SnippetService.get(id).then(result => {
            vnode.state.snippet = result;
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    view(vnode) {
        const { snippet, loading } = vnode.state;
        const { id } = vnode.attrs;

        if (loading) {
            return m(Layout, m(Loading));
        }

        if (!snippet) {
            return m(Layout, m(EmptyState, { message: '片段不存在', icon: 'fa-exclamation-triangle' }));
        }

        return m(Layout, [
            m('div.snippet-detail-page', [
                m('div.snippet-detail-header', [
                    m('h1', snippet.title),
                    m('div.snippet-actions', [
                        Auth.isAuthenticated() && snippet.user_id && Auth.token ? 
                            m('button.btn', {
                                onclick: () => m.route.set(`/snippets/${id}/edit`)
                            }, [m('i.fas.fa-edit'), ' 编辑']) : null,
                        Auth.isAuthenticated() && snippet.user_id && Auth.token ?
                            m('button.btn.btn-danger', {
                                onclick: () => {
                                    if (confirm('确定要删除这个片段吗？')) {
                                        SnippetService.delete(id).then(() => {
                                            m.route.set('/snippets');
                                        }).catch(error => {
                                            alert('删除失败: ' + (error.message || '未知错误'));
                                        });
                                    }
                                }
                            }, [m('i.fas.fa-trash'), ' 删除']) : null
                    ])
                ]),

                snippet.description ? m('p.snippet-description', snippet.description) : null,

                m('div.snippet-meta', [
                    snippet.language ? m('span', [m('i.fas.fa-code'), ` ${snippet.language}`]) : null,
                    snippet.username ? m('span', [m('i.fas.fa-user'), ` ${snippet.username}`]) : null,
                    m('span', [m('i.fas.fa-clock'), ` 创建于 ${snippet.created_at}`])
                ]),

                m('div.snippet-code', [
                    m('div.code-header', [
                        m('span', snippet.language || '代码'),
                        m('button.btn.btn-sm', {
                            onclick: () => {
                                navigator.clipboard.writeText(snippet.code);
                                alert('已复制到剪贴板');
                            }
                        }, [m('i.fas.fa-copy'), ' 复制'])
                    ]),
                    m('pre', [
                        m('code', { 
                            class: snippet.language ? `language-${snippet.language.toLowerCase().replace(/[^a-z0-9]/g, '')} hljs` : 'hljs',
                            oncreate: (vnode) => {
                                if (snippet.language && typeof hljs !== 'undefined') {
                                    const langClass = snippet.language.toLowerCase().replace(/[^a-z0-9]/g, '');
                                    if (hljs.getLanguage(langClass)) {
                                        vnode.dom.innerHTML = hljs.highlight(snippet.code, { language: langClass }).value;
                                    }
                                }
                            }
                        }, snippet.code)
                    ])
                ])
            ])
        ]);
    }
};

const NewSnippet = {
    oninit(vnode) {
        vnode.state.form = {
            title: '',
            description: '',
            language: '',
            code: '',
            visibility: 'public'
        };
        vnode.state.submitting = false;
    },

    submit(vnode) {
        if (!vnode.state.form.title) {
            alert('请输入标题');
            return;
        }

        if (!vnode.state.form.code) {
            alert('请输入代码');
            return;
        }

        vnode.state.submitting = true;
        SnippetService.create(vnode.state.form).then(result => {
            m.route.set(`/snippets/${result.id}`);
        }).catch(error => {
            vnode.state.submitting = false;
            alert('创建失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { form, submitting } = vnode.state;

        return m(Layout, [
            m('div.new-snippet-page', [
                m('div.page-header', [
                    m('h2', '新建片段')
                ]),

                m('div.form-container', [
                    m('div.form-group', [
                        m('label', '标题 *'),
                        m('input.form-input', {
                            type: 'text',
                            value: form.title,
                            oninput: e => { form.title = e.target.value; },
                            placeholder: '片段标题'
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '描述'),
                        m('textarea.form-input', {
                            value: form.description,
                            oninput: e => { form.description = e.target.value; },
                            placeholder: '描述这个片段的用途',
                            rows: 3
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '编程语言'),
                        m('input.form-input', {
                            type: 'text',
                            value: form.language,
                            oninput: e => { form.language = e.target.value; },
                            placeholder: '例如: JavaScript, Python, Go'
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '代码 *'),
                        m('textarea.form-input.code-input', {
                            value: form.code,
                            oninput: e => { form.code = e.target.value; },
                            placeholder: '粘贴你的代码...',
                            rows: 10
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '可见性'),
                        m('select.form-input', {
                            value: form.visibility,
                            onchange: e => { form.visibility = e.target.value; }
                        }, [
                            m('option', { value: 'public' }, '公开'),
                            m('option', { value: 'private' }, '私有')
                        ])
                    ]),

                    m('div.form-actions', [
                        m('button.btn.btn-primary', {
                            onclick: () => NewSnippet.submit(vnode),
                            disabled: submitting
                        }, submitting ? '创建中...' : '创建片段'),
                        m('button.btn', {
                            onclick: () => m.route.set('/snippets')
                        }, '取消')
                    ])
                ])
            ])
        ]);
    }
};

const EditSnippet = {
    oninit(vnode) {
        const { id } = vnode.attrs;
        vnode.state.snippet = null;
        vnode.state.form = {
            title: '',
            description: '',
            language: '',
            code: '',
            visibility: 'public'
        };
        vnode.state.loading = true;
        vnode.state.submitting = false;

        SnippetService.get(id).then(result => {
            vnode.state.snippet = result;
            vnode.state.form = {
                title: result.title,
                description: result.description || '',
                language: result.language || '',
                code: result.code,
                visibility: result.visibility || 'public'
            };
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    submit(vnode) {
        const { id } = vnode.attrs;
        
        if (!vnode.state.form.title) {
            alert('请输入标题');
            return;
        }

        if (!vnode.state.form.code) {
            alert('请输入代码');
            return;
        }

        vnode.state.submitting = true;
        SnippetService.update(id, vnode.state.form).then(result => {
            m.route.set(`/snippets/${id}`);
        }).catch(error => {
            vnode.state.submitting = false;
            alert('更新失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { form, loading, submitting } = vnode.state;
        const { id } = vnode.attrs;

        if (loading) {
            return m(Layout, m(Loading));
        }

        return m(Layout, [
            m('div.new-snippet-page', [
                m('div.page-header', [
                    m('h2', '编辑片段')
                ]),

                m('div.form-container', [
                    m('div.form-group', [
                        m('label', '标题 *'),
                        m('input.form-input', {
                            type: 'text',
                            value: form.title,
                            oninput: e => { form.title = e.target.value; },
                            placeholder: '片段标题'
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '描述'),
                        m('textarea.form-input', {
                            value: form.description,
                            oninput: e => { form.description = e.target.value; },
                            placeholder: '描述这个片段的用途',
                            rows: 3
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '编程语言'),
                        m('input.form-input', {
                            type: 'text',
                            value: form.language,
                            oninput: e => { form.language = e.target.value; },
                            placeholder: '例如: JavaScript, Python, Go'
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '代码 *'),
                        m('textarea.form-input.code-input', {
                            value: form.code,
                            oninput: e => { form.code = e.target.value; },
                            placeholder: '粘贴你的代码...',
                            rows: 10
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '可见性'),
                        m('select.form-input', {
                            value: form.visibility,
                            onchange: e => { form.visibility = e.target.value; }
                        }, [
                            m('option', { value: 'public' }, '公开'),
                            m('option', { value: 'private' }, '私有')
                        ])
                    ]),

                    m('div.form-actions', [
                        m('button.btn.btn-primary', {
                            onclick: () => EditSnippet.submit(vnode),
                            disabled: submitting
                        }, submitting ? '保存中...' : '保存'),
                        m('button.btn', {
                            onclick: () => m.route.set(`/snippets/${id}`)
                        }, '取消')
                    ])
                ])
            ])
        ]);
    }
};


const branchColors = [
    '#28a745', '#0366d6', '#d73a49', '#f66a0a', '#6f42c1',
    '#005cc5', '#044289', '#e36209', '#b08800', '#1b1f23',
    '#e91e63', '#00bcd4', '#ff5722', '#795548', '#607d8b'
];

function getBranchColor(branchName) {
    let hash = 0;
    for (let i = 0; i < branchName.length; i++) {
        hash = branchName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return branchColors[Math.abs(hash) % branchColors.length];
}

function extractVersion(message) {
    if (!message) return null;
    
    const patterns = [
        /v\d+\.\d+\.\d+/i,
        /v\d+\.\d+/i,
        /release[\s\-_]?\d+\.\d+\.\d+/i,
        /release[\s\-_]?\d+\.\d+/i,
        /version[\s\-_]?\d+\.\d+\.\d+/i,
        /version[\s\-_]?\d+\.\d+/i,
        /\d+\.\d+\.\d+/,
    ];
    
    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
            return match[0];
        }
    }
    
    return null;
}

const LANE_COLORS = [
    '#e74c3c', '#2ecc71', '#3498db', '#f39c12',
    '#9b59b6', '#1abc9c', '#e67e22', '#e91e63',
    '#00bcd4', '#8bc34a', '#ff5722', '#607d8b',
    '#795548', '#cddc39', '#ff9800', '#673ab7'
];

function getLaneColor(laneIndex) {
    return LANE_COLORS[laneIndex % LANE_COLORS.length];
}

function computeGraphLayout(commits) {
    if (!commits || commits.length === 0) return null;

    const commitLanes = {};
    const commitFlows = {};
    const maxLane = { value: 0 };
    const activeLanes = [];
    const lanesAbove = [];
    const lanesBelow = [];

    function findLaneForHash(hash) {
        for (let i = 0; i < activeLanes.length; i++) {
            if (activeLanes[i] === hash) return i;
        }
        return -1;
    }

    function findAvailableLane(preferredLane) {
        if (preferredLane !== undefined && preferredLane < activeLanes.length && activeLanes[preferredLane] === null) {
            return preferredLane;
        }
        for (let i = 0; i < activeLanes.length; i++) {
            if (activeLanes[i] === null) return i;
        }
        activeLanes.push(null);
        if (activeLanes.length - 1 > maxLane.value) maxLane.value = activeLanes.length - 1;
        return activeLanes.length - 1;
    }

    function setLane(lane, hash) {
        while (activeLanes.length <= lane) {
            activeLanes.push(null);
            if (activeLanes.length - 1 > maxLane.value) maxLane.value = activeLanes.length - 1;
        }
        activeLanes[lane] = hash;
    }

    function clearLane(lane) {
        if (lane < activeLanes.length) {
            activeLanes[lane] = null;
        }
    }

    function compactLanes() {
        let write = 0;
        for (let read = 0; read < activeLanes.length; read++) {
            if (activeLanes[read] !== null) {
                if (write !== read) {
                    activeLanes[write] = activeLanes[read];
                    activeLanes[read] = null;
                }
                write++;
            }
        }
        activeLanes.length = write;
    }

    function snapshotActive() {
        const s = new Set();
        for (let i = 0; i < activeLanes.length; i++) {
            if (activeLanes[i] !== null) s.add(i);
        }
        return s;
    }

    for (let i = 0; i < commits.length; i++) {
        lanesAbove[i] = snapshotActive();

        const commit = commits[i];
        const hash = commit.hash;
        const parents = commit.parents || [];

        let myLane = findLaneForHash(hash);
        if (myLane === -1) {
            myLane = findAvailableLane(0);
        }

        commitLanes[hash] = myLane;

        const flows = [];

        if (parents.length === 0) {
            clearLane(myLane);
            compactLanes();
            commitFlows[hash] = flows;
            lanesBelow[i] = snapshotActive();
            continue;
        }

        const firstParent = parents[0];
        setLane(myLane, firstParent);
        flows.push({ fromLane: myLane, toLane: myLane, type: 'straight' });

        for (let p = 1; p < parents.length; p++) {
            const parentHash = parents[p];
            const existingLane = findLaneForHash(parentHash);

            if (existingLane !== -1) {
                flows.push({ fromLane: myLane, toLane: existingLane, type: 'merge' });
            } else {
                const newLane = findAvailableLane(myLane + 1);
                setLane(newLane, parentHash);
                flows.push({ fromLane: myLane, toLane: newLane, type: 'branch' });
            }
        }

        compactLanes();
        commitFlows[hash] = flows;
        lanesBelow[i] = snapshotActive();
    }

    const laneCount = maxLane.value + 1;
    const laneColorsMap = {};
    for (let l = 0; l < laneCount; l++) {
        laneColorsMap[l] = getLaneColor(l);
    }

    return { commitLanes, commitFlows, laneCount, laneColors: laneColorsMap, lanesAbove, lanesBelow };
}

function renderCommitGraph(layout, commits, currentCommitIndex) {
    if (!layout) return null;

    const { commitLanes, commitFlows, laneCount, laneColors, lanesAbove, lanesBelow } = layout;

    const LANE_W = 18;
    const ROW_H = 28;
    const NODE_R = 3;
    const LINE_W = 1.8;
    const PAD_X = 4;
    const totalWidth = Math.max(laneCount, 1) * LANE_W + PAD_X * 2;
    const totalHeight = ROW_H;

    const commit = commits[currentCommitIndex];
    const hash = commit.hash;
    const myLane = commitLanes[hash] || 0;
    const myX = myLane * LANE_W + LANE_W / 2 + PAD_X;
    const myY = ROW_H / 2;
    const color = laneColors[myLane];

    const paths = [];
    const nodes = [];

    nodes.push({ x: myX, y: myY, r: NODE_R, color });

    const above = lanesAbove[currentCommitIndex];
    const below = lanesBelow[currentCommitIndex];

    if (above.has(myLane)) {
        paths.push({ d: `M ${myX} 0 L ${myX} ${myY - NODE_R}`, color });
    }

    const flows = commitFlows[hash] || [];
    const flowTargetLanes = new Set();

    for (const flow of flows) {
        const toX = flow.toLane * LANE_W + LANE_W / 2 + PAD_X;
        const toColor = laneColors[flow.toLane];
        flowTargetLanes.add(flow.toLane);

        if (flow.type === 'straight') {
            paths.push({ d: `M ${myX} ${myY + NODE_R} L ${myX} ${totalHeight}`, color: toColor });
        } else {
            const cp1y = myY + (totalHeight - myY) * 0.4;
            const cp2y = totalHeight - (totalHeight - myY) * 0.4;
            paths.push({ d: `M ${myX} ${myY + NODE_R} C ${myX} ${cp1y}, ${toX} ${cp2y}, ${toX} ${totalHeight}`, color: toColor });
        }
    }

    if (flows.length === 0) {
        // root commit — no outgoing lines below
    }

    const handledLanes = new Set([myLane, ...flowTargetLanes]);

    for (const lane of above) {
        if (handledLanes.has(lane)) continue;

        const lx = lane * LANE_W + LANE_W / 2 + PAD_X;
        const lColor = laneColors[lane];

        if (below.has(lane)) {
            paths.push({ d: `M ${lx} 0 L ${lx} ${totalHeight}`, color: lColor });
        } else {
            paths.push({ d: `M ${lx} 0 L ${lx} ${myY - NODE_R}`, color: lColor });
            const cp1y = (myY - NODE_R) + (myY - (myY - NODE_R)) * 0.5;
            paths.push({ d: `M ${lx} ${myY - NODE_R} C ${lx} ${cp1y}, ${myX} ${myY - NODE_R - 2}, ${myX} ${myY - NODE_R}`, color: lColor });
        }
    }

    return m('svg.commit-graph-svg', {
        width: totalWidth,
        height: totalHeight,
        viewBox: `0 0 ${totalWidth} ${totalHeight}`,
        style: { display: 'block' }
    }, [
        ...paths.map(p => m('path', {
            d: p.d,
            stroke: p.color,
            'stroke-width': LINE_W,
            fill: 'none',
            'stroke-linecap': 'round'
        })),
        m('circle', {
            cx: myX,
            cy: myY,
            r: NODE_R + 1,
            fill: '#1a1a2e',
            stroke: 'none'
        }),
        m('circle', {
            cx: myX,
            cy: myY,
            r: NODE_R,
            fill: color,
            stroke: '#fff',
            'stroke-width': 1.2
        })
    ]);
}

const CommitList = {
    oninit(vnode) {
        const { owner, repo, branch: urlBranch } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.commits = [];
        vnode.state.loading = true;
        vnode.state.perPage = 50;
        vnode.state.total = 0;
        vnode.state.totalPages = 0;
        vnode.state.branches = [];
        vnode.state.tags = [];
        vnode.state.showBranchMenu = false;
        vnode.state.prsCount = 0;
        vnode.state.issuesCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.activeTab = 'branches';
        vnode.state.selectedCommits = [];
        vnode.state.lastSelectedIndex = -1;
        vnode.state.showRebaseConfirm = false;
        vnode.state.rebaseInProgress = false;
        
        const urlParams = m.route.param();
        const pageFromUrl = parseInt(urlParams.page) || 1;
        
        if (urlBranch && urlBranch !== 'commits') {
            vnode.state.selectedBranches = [urlBranch];
            vnode.state.page = pageFromUrl;
        } else {
            vnode.state.selectedBranches = ['all'];
            vnode.state.page = pageFromUrl;
        }
        
        vnode.state.updateUrl = function() {
            const branches = vnode.state.selectedBranches;
            const page = vnode.state.page;
            
            let path;
            if (branches.includes('all') || branches.length === 0) {
                path = `/commits/${owner}/${repo}`;
            } else if (branches.length === 1) {
                path = `/commits/${owner}/${repo}/${branches[0]}`;
            } else {
                path = `/commits/${owner}/${repo}`;
            }
            
            const query = {};
            if (page > 1) query.page = page;
            if (branches.length > 1 && !branches.includes('all')) {
                query.branches = branches.join(',');
            }
            
            const queryString = Object.keys(query).length > 0 
                ? '?' + Object.entries(query).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
                : '';
            
            m.route.set(path + queryString, { replace: true });
        };
        
        const closeBranchMenu = (e) => {
            if (vnode.state.showBranchMenu) {
                const target = e.target;
                if (!target.closest('.branch-selector')) {
                    vnode.state.showBranchMenu = false;
                    m.redraw();
                }
            }
        };
        
        document.addEventListener('click', closeBranchMenu);
        
        vnode.state.cleanup = function() {
            document.removeEventListener('click', closeBranchMenu);
        };
        
        vnode.state.loadCommits = function() {
            vnode.state.loading = true;
            vnode.state.selectedCommits = [];
            vnode.state.lastSelectedIndex = -1;
            const selected = vnode.state.selectedBranches;
            const isAllSelected = selected.includes('all');
            
            RepositoryService.getCommits(owner, repo, {
                ref: 'HEAD',
                page: vnode.state.page,
                per_page: vnode.state.perPage,
                all: isAllSelected ? 'true' : 'false',
                branches: !isAllSelected ? selected.join(',') : ''
            }).then(result => {
                const data = result.data || result;
                vnode.state.commits = data.commits || [];
                vnode.state.graphLayout = computeGraphLayout(vnode.state.commits);
                vnode.state.total = data.total || 0;
                vnode.state.totalPages = Math.ceil(vnode.state.total / vnode.state.perPage);
                vnode.state.loading = false;
                vnode.state.updateUrl();
                m.redraw();
            }).catch(error => {
                console.error('Failed to load commits:', error);
                vnode.state.loading = false;
                vnode.state.commits = [];
                vnode.state.graphLayout = null;
                m.redraw();
            });
        };
        
        vnode.state.loadBranches = function() {
            RepositoryService.getBranches(owner, repo).then(result => {
                vnode.state.branches = result.branches || [];
                m.redraw();
            }).catch(() => {});
        };
        
        vnode.state.loadTags = function() {
            RepositoryService.getTags(owner, repo).then(result => {
                vnode.state.tags = result.tags || [];
                m.redraw();
            }).catch(() => {});
        };
        
        Promise.all([
            RepositoryService.get(owner, repo),
            PullRequestService.list(owner, repo, { per_page: 1000 }),
            IssueService.list(owner, repo, { per_page: 1000 }),
            TaskService.list(owner, repo, { per_page: 1 })
        ]).then(([repoResult, prsResult, issuesResult, tasksResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.loading = false;
            vnode.state.loadBranches();
            vnode.state.loadTags();
            vnode.state.loadCommits();
            m.redraw();
        }).catch(error => {
            console.error('Failed to load repo:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, commits, loading, page, totalPages, total, selectedBranches, branches, tags, showBranchMenu, activeTab } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        const isAllSelected = selectedBranches.includes('all');
        const displayText = isAllSelected ? 
            `全部分支 (${branches.length})` : 
            `${selectedBranches.length} 个分支`;
        
        if (loading && !repo) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        return m(Layout, [
            m(ProjectHeader, { repo, owner }),
            m(ProjectTabs, { owner, repo: repo, activeTab: 'commits', issuesCount: vnode.state.issuesCount, prsCount: vnode.state.prsCount, tasksCount: vnode.state.tasksCount }),
            
            m('div.commits-page', [
                m('div.commits-header', [
                    m('div.branch-selector', [
                        m('div.branch-dropdown', {
                            onclick: (e) => {
                                e.stopPropagation();
                                vnode.state.showBranchMenu = !vnode.state.showBranchMenu;
                            }
                        }, [
                            m('i.fas.fa-code-branch'),
                            m('span.branch-display-text', displayText),
                            m('i.fas.fa-chevron-down')
                        ]),
                        showBranchMenu ? m('div.branch-menu.multi-select-menu', {
                            onclick: (e) => { e.stopPropagation(); }
                        }, [
                            m('div.branch-menu-header', [
                                m('span.menu-title', '选择分支'),
                                m('div.menu-actions', [
                                    m('a.action-link', {
                                        onclick: (e) => {
                                            e.stopPropagation();
                                            if (isAllSelected) {
                                                vnode.state.selectedBranches = [];
                                            } else {
                                                vnode.state.selectedBranches = ['all'];
                                            }
                                            vnode.state.page = 1;
                                            vnode.state.loadCommits();
                                        }
                                    }, isAllSelected ? '取消全选' : '全选'),
                                    m('a.action-link', {
                                        onclick: (e) => {
                                            e.stopPropagation();
                                            if (selectedBranches.length > 0) {
                                                vnode.state.showBranchMenu = false;
                                                vnode.state.loadCommits();
                                            }
                                        }
                                    }, '应用')
                                ])
                            ]),
                            m('div.branch-menu-tabs', [
                                m('div.branch-menu-tab', {
                                    class: activeTab === 'branches' ? 'active' : '',
                                    onclick: (e) => { 
                                        e.stopPropagation();
                                        vnode.state.activeTab = 'branches'; 
                                    }
                                }, `分支 (${branches.length})`),
                                m('div.branch-menu-tab', {
                                    class: activeTab === 'tags' ? 'active' : '',
                                    onclick: (e) => { 
                                        e.stopPropagation();
                                        vnode.state.activeTab = 'tags'; 
                                    }
                                }, `标签 (${tags.length})`)
                            ]),
                            m('div.branch-menu-list.scrollable-list', [
                                activeTab === 'branches' ? 
                                    [
                                        m('div.branch-option.checkbox-option', {
                                            class: isAllSelected ? 'selected' : '',
                                            onclick: (e) => { 
                                                e.stopPropagation();
                                                if (isAllSelected) {
                                                    vnode.state.selectedBranches = [];
                                                } else {
                                                    vnode.state.selectedBranches = ['all'];
                                                }
                                            }
                                        }, [
                                            m('input[type=checkbox]', {
                                                type: 'checkbox',
                                                checked: isAllSelected,
                                                onchange: () => {}
                                            }),
                                            m('i.fas.fa-sitemap'),
                                            m('span.option-label', '全部分支')
                                        ]),
                                        ...branches.map(branch => {
                                            const isSelected = !isAllSelected && selectedBranches.includes(branch);
                                            return m('div.branch-option.checkbox-option', {
                                                class: isSelected ? 'selected' : '',
                                                onclick: (e) => { 
                                                    e.stopPropagation();
                                                    let newSelection;
                                                    if (isAllSelected) {
                                                        newSelection = branches.filter(b => b !== branch);
                                                        newSelection.unshift('all');
                                                    } else {
                                                        if (isSelected) {
                                                            newSelection = selectedBranches.filter(b => b !== branch);
                                                            if (newSelection.length === 0) {
                                                                newSelection = ['all'];
                                                            }
                                                        } else {
                                                            newSelection = [...selectedBranches.filter(b => b !== 'all'), branch];
                                                        }
                                                    }
                                                    vnode.state.selectedBranches = newSelection;
                                                }
                                            }, [
                                                m('input[type=checkbox]', {
                                                    type: 'checkbox',
                                                    checked: isSelected || isAllSelected,
                                                    onchange: () => {}
                                                }),
                                                m('span.branch-color-dot', {
                                                    style: { background: getBranchColor(branch) }
                                                }),
                                                m('span.option-label', branch)
                                            ]);
                                        })
                                    ] :
                                    tags.map(tag => {
                                        const isSelected = selectedBranches.includes(tag);
                                        return m('div.branch-option.checkbox-option', {
                                            class: isSelected ? 'selected' : '',
                                            onclick: (e) => { 
                                                e.stopPropagation();
                                                let newSelection;
                                                if (isSelected) {
                                                    newSelection = selectedBranches.filter(t => t !== tag);
                                                } else {
                                                    newSelection = [...selectedBranches.filter(b => b !== 'all'), tag];
                                                }
                                                vnode.state.selectedBranches = newSelection;
                                            }
                                        }, [
                                            m('input[type=checkbox]', {
                                                type: 'checkbox',
                                                checked: isSelected,
                                                onchange: () => {}
                                            }),
                                            m('i.fas.fa-tag'),
                                            m('span.option-label', tag)
                                        ]);
                                    })
                            ])
                        ]) : null
                    ]),
                    m('div.commits-count', [
                        m('i.fas.fa-history'),
                        ` 共 ${total} 个提交`
                    ])
                ]),
                
                loading ? m(Loading) : [
                    commits.length === 0 ? 
                        m(EmptyState, { message: '暂无提交记录', icon: 'fa-history' }) :
                        [
                            vnode.state.selectedCommits.length > 0 ? m('div.commits-actions-bar', [
                                m('span.selected-count', `已选择 ${vnode.state.selectedCommits.length} 个提交`),
                                m('button.btn.btn-danger', {
                                    onclick: () => {
                                        vnode.state.showRebaseConfirm = true;
                                    }
                                }, [m('i.fas.fa-trash'), ' 删除选中提交 (Rebase)'])
                            ]) : null,
                            m('div.commits-list', commits.map((commit, index) => {
                                const version = extractVersion(commit.message);
                                const isSelected = vnode.state.selectedCommits.includes(commit.hash);
                                return m('div.commit-item', {
                                    class: isSelected ? 'selected' : '',
                                    onclick: (e) => {
                                        if (e.target.tagName === 'A' || e.target.type === 'checkbox') {
                                            return;
                                        }
                                        m.route.set(`/project/${owner}/${repo.name}?ref=${commit.hash}`);
                                    }
                                }, [
                                    m('div.commit-checkbox', [
                                        m('input[type=checkbox]', {
                                            checked: isSelected,
                                            onclick: (e) => {
                                                e.stopPropagation();
                                            },
                                            onchange: (e) => {
                                                const shiftKey = e.shiftKey;
                                                
                                                if (shiftKey && vnode.state.lastSelectedIndex !== -1) {
                                                    const start = Math.min(vnode.state.lastSelectedIndex, index);
                                                    const end = Math.max(vnode.state.lastSelectedIndex, index);
                                                    
                                                    for (let i = start; i <= end; i++) {
                                                        const hash = vnode.state.commits[i].hash;
                                                        if (!vnode.state.selectedCommits.includes(hash)) {
                                                            vnode.state.selectedCommits.push(hash);
                                                        }
                                                    }
                                                } else {
                                                    if (isSelected) {
                                                        vnode.state.selectedCommits = vnode.state.selectedCommits.filter(h => h !== commit.hash);
                                                    } else {
                                                        vnode.state.selectedCommits.push(commit.hash);
                                                    }
                                                    vnode.state.lastSelectedIndex = index;
                                                }
                                            }
                                        })
                                    ]),
                                    m('div.commit-graph', 
                                        renderCommitGraph(vnode.state.graphLayout, commits, index)
                                    ),
                                    m('div.commit-message', [
                                        m('span.commit-message-text', commit.message),
                                        version ? m('span.version-tag', version) : null
                                    ]),
                                    m('div.commit-meta', [
                                        m('span.commit-author', commit.author),
                                        m('span.commit-date', Utils.formatDate(commit.date))
                                    ]),
                                    m('a.commit-hash', {
                                        href: `/project/${owner}/${repo.name}?ref=${commit.hash}`,
                                        onclick: (e) => {
                                            e.stopPropagation();
                                        }
                                    }, commit.short_hash)
                                ]);
                            }))
                        ]
                ],
                
                totalPages > 1 ? m(Pagination, {
                    page,
                    totalPages,
                    onPageChange: (newPage) => {
                        vnode.state.page = newPage;
                        vnode.state.loadCommits();
                    }
                }) : null
            ]),
            
            vnode.state.showRebaseConfirm ? m('div.modal-overlay', {
                onclick: (e) => {
                    if (e.target === e.currentTarget) {
                        vnode.state.showRebaseConfirm = false;
                    }
                }
            }, [
                m('div.modal', [
                    m('div.modal-header', [
                        m('h2', [m('i.fas.fa-exclamation-triangle'), ' 确认删除提交']),
                        m('button.modal-close', {
                            onclick: () => { vnode.state.showRebaseConfirm = false; }
                        }, '×')
                    ]),
                    m('div.modal-body', [
                        m('p.warning-text', [
                            m('i.fas.fa-exclamation-circle'),
                            ' 您即将删除 ',
                            m('strong', vnode.state.selectedCommits.length),
                            ' 个提交。此操作将执行 interactive rebase，可能会改变提交历史。'
                        ]),
                        m('p', '选中的提交：'),
                        m('div.selected-commits-list', 
                            vnode.state.selectedCommits.map(hash => {
                                const commit = vnode.state.commits.find(c => c.hash === hash);
                                return commit ? m('div.selected-commit-item', [
                                    m('code', commit.short_hash),
                                    m('span', commit.message.substring(0, 50))
                                ]) : null;
                            })
                        ),
                        m('p.warning-text', [
                            m('i.fas.fa-info-circle'),
                            ' 注意：此操作不可逆，请确保您已备份重要数据。'
                        ])
                    ]),
                    m('div.modal-footer', [
                        m('button.btn', {
                            onclick: () => { vnode.state.showRebaseConfirm = false; }
                        }, '取消'),
                        m('button.btn.btn-danger', {
                            onclick: () => {
                                vnode.state.rebaseInProgress = true;
                                RepositoryService.rebase(owner, repo.name, {
                                    commits: vnode.state.selectedCommits
                                }).then(() => {
                                    vnode.state.showRebaseConfirm = false;
                                    vnode.state.rebaseInProgress = false;
                                    vnode.state.selectedCommits = [];
                                    vnode.state.loadCommits();
                                    alert('提交删除成功！');
                                }).catch(error => {
                                    vnode.state.rebaseInProgress = false;
                                    alert('删除失败: ' + (error.message || '未知错误'));
                                    m.redraw();
                                });
                            },
                            disabled: vnode.state.rebaseInProgress
                        }, vnode.state.rebaseInProgress ? '删除中...' : '确认删除')
                    ])
                ])
            ]) : null
        ]);
    }
};

function md5(string) {
    function md5cycle(x, k) {
        var a = x[0], b = x[1], c = x[2], d = x[3];
        a = ff(a, b, c, d, k[0], 7, -680876936);
        d = ff(d, a, b, c, k[1], 12, -389564586);
        c = ff(c, d, a, b, k[2], 17, 606105819);
        b = ff(b, c, d, a, k[3], 22, -1044525330);
        a = ff(a, b, c, d, k[4], 7, -176418897);
        d = ff(d, a, b, c, k[5], 12, 1200080426);
        c = ff(c, d, a, b, k[6], 17, -1473231341);
        b = ff(b, c, d, a, k[7], 22, -45705983);
        a = ff(a, b, c, d, k[8], 7, 1770035416);
        d = ff(d, a, b, c, k[9], 12, -1958414417);
        c = ff(c, d, a, b, k[10], 17, -42063);
        b = ff(b, c, d, a, k[11], 22, -1990404162);
        a = ff(a, b, c, d, k[12], 7, 1804603682);
        d = ff(d, a, b, c, k[13], 12, -40341101);
        c = ff(c, d, a, b, k[14], 17, -1502002290);
        b = ff(b, c, d, a, k[15], 22, 1236535329);
        a = gg(a, b, c, d, k[1], 5, -165796510);
        d = gg(d, a, b, c, k[6], 9, -1069501632);
        c = gg(c, d, a, b, k[11], 14, 643717713);
        b = gg(b, c, d, a, k[0], 20, -373897302);
        a = gg(a, b, c, d, k[5], 5, -701558691);
        d = gg(d, a, b, c, k[10], 9, 38016083);
        c = gg(c, d, a, b, k[15], 14, -660478335);
        b = gg(b, c, d, a, k[4], 20, -405537848);
        a = gg(a, b, c, d, k[9], 5, 568446438);
        d = gg(d, a, b, c, k[14], 9, -1019803690);
        c = gg(c, d, a, b, k[3], 14, -187363961);
        b = gg(b, c, d, a, k[8], 20, 1163531501);
        a = gg(a, b, c, d, k[13], 5, -1444681467);
        d = gg(d, a, b, c, k[2], 9, -51403784);
        c = gg(c, d, a, b, k[7], 14, 1735328473);
        b = gg(b, c, d, a, k[12], 20, -1926607734);
        a = hh(a, b, c, d, k[5], 4, -378558);
        d = hh(d, a, b, c, k[8], 11, -2022574463);
        c = hh(c, d, a, b, k[11], 16, 1839030562);
        b = hh(b, c, d, a, k[14], 23, -35309556);
        a = hh(a, b, c, d, k[1], 4, -1530992060);
        d = hh(d, a, b, c, k[4], 11, 1272893353);
        c = hh(c, d, a, b, k[7], 16, -155497632);
        b = hh(b, c, d, a, k[10], 23, -1094730640);
        a = hh(a, b, c, d, k[13], 4, 681279174);
        d = hh(d, a, b, c, k[0], 11, -358537222);
        c = hh(c, d, a, b, k[3], 16, -722521979);
        b = hh(b, c, d, a, k[6], 23, 76029189);
        a = hh(a, b, c, d, k[9], 4, -640364487);
        d = hh(d, a, b, c, k[12], 11, -421815835);
        c = hh(c, d, a, b, k[15], 16, 530742520);
        b = hh(b, c, d, a, k[2], 23, -995338651);
        a = ii(a, b, c, d, k[0], 6, -198630844);
        d = ii(d, a, b, c, k[7], 10, 1126891415);
        c = ii(c, d, a, b, k[14], 15, -1416354905);
        b = ii(b, c, d, a, k[5], 21, -57434055);
        a = ii(a, b, c, d, k[12], 6, 1700485571);
        d = ii(d, a, b, c, k[3], 10, -1894986606);
        c = ii(c, d, a, b, k[10], 15, -1051523);
        b = ii(b, c, d, a, k[1], 21, -2054922799);
        a = ii(a, b, c, d, k[8], 6, 1873313359);
        d = ii(d, a, b, c, k[15], 10, -30611744);
        c = ii(c, d, a, b, k[6], 15, -1560198380);
        b = ii(b, c, d, a, k[13], 21, 1309151649);
        a = ii(a, b, c, d, k[4], 6, -145523070);
        d = ii(d, a, b, c, k[11], 10, -1120210379);
        c = ii(c, d, a, b, k[2], 15, 718787259);
        b = ii(b, c, d, a, k[9], 21, -343485551);
        x[0] = add32(a, x[0]);
        x[1] = add32(b, x[1]);
        x[2] = add32(c, x[2]);
        x[3] = add32(d, x[3]);
    }

    function cmn(q, a, b, x, s, t) {
        a = add32(add32(a, q), add32(x, t));
        return add32((a << s) | (a >>> (32 - s)), b);
    }

    function ff(a, b, c, d, x, s, t) {
        return cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }

    function gg(a, b, c, d, x, s, t) {
        return cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }

    function hh(a, b, c, d, x, s, t) {
        return cmn(b ^ c ^ d, a, b, x, s, t);
    }

    function ii(a, b, c, d, x, s, t) {
        return cmn(c ^ (b | (~d)), a, b, x, s, t);
    }

    function md51(s) {
        var n = s.length,
            state = [1732584193, -271733879, -1732584194, 271733878], i;
        for (i = 64; i <= s.length; i += 64) {
            md5cycle(state, md5blk(s.substring(i - 64, i)));
        }
        s = s.substring(i - 64);
        var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < s.length; i++)
            tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
            md5cycle(state, tail);
            for (i = 0; i < 16; i++) tail[i] = 0;
        }
        tail[14] = n * 8;
        md5cycle(state, tail);
        return state;
    }

    function md5blk(s) {
        var md5blks = [],
            i;
        for (i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
        }
        return md5blks;
    }

    var hex_chr = '0123456789abcdef'.split('');

    function rhex(n) {
        var s = '',
            j = 0;
        for (; j < 4; j++)
            s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
        return s;
    }

    function hex(x) {
        for (var i = 0; i < x.length; i++)
            x[i] = rhex(x[i]);
        return x.join('');
    }

    function add32(a, b) {
        return (a + b) & 0xFFFFFFFF;
    }

    return hex(md51(string));
}


const UserManagement = {
    oninit(vnode) {
        vnode.state.users = [];
        vnode.state.currentUser = null;
        vnode.state.loading = true;
        vnode.state.editingUser = null;
        vnode.state.editForm = {};

        Promise.all([
            API.get('/users'),
            API.get('/user/me')
        ]).then(([usersResult, userResult]) => {
            vnode.state.users = usersResult.data || usersResult || [];
            vnode.state.currentUser = userResult;
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    canEdit(vnode) {
        const { currentUser } = vnode.state;
        return currentUser && currentUser.is_admin;
    },

    startEdit(vnode, user) {
        vnode.state.editingUser = user;
        vnode.state.editForm = {
            full_name: user.full_name || '',
            bio: user.bio || '',
            website: user.website || '',
            location: user.location || '',
            is_active: user.is_active,
            is_admin: user.is_admin
        };
    },

    cancelEdit(vnode) {
        vnode.state.editingUser = null;
        vnode.state.editForm = {};
    },

    saveEdit(vnode) {
        const { editingUser, editForm } = vnode.state;
        vnode.state.saving = true;

        UserService.update(editingUser.username, editForm).then(result => {
            const index = vnode.state.users.findIndex(u => u.id === editingUser.id);
            if (index !== -1) {
                vnode.state.users[index] = result;
            }
            vnode.state.editingUser = null;
            vnode.state.saving = false;
            m.redraw();
        }).catch(error => {
            vnode.state.saving = false;
            alert('保存失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    handleAvatarUpload(vnode, user, e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        vnode.state.uploadingAvatar = user.id;

        UserService.uploadAvatar(user.username, formData).then(result => {
            const index = vnode.state.users.findIndex(u => u.id === user.id);
            if (index !== -1) {
                vnode.state.users[index] = result;
            }
            vnode.state.uploadingAvatar = null;
            m.redraw();
        }).catch(error => {
            vnode.state.uploadingAvatar = null;
            alert('上传失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { users, currentUser, loading, editingUser, editForm, saving, uploadingAvatar } = vnode.state;

        if (loading) {
            return m(Layout, m(Loading));
        }

        if (!currentUser || !currentUser.is_admin) {
            return m(Layout, m(EmptyState, { 
                message: '权限不足', 
                icon: 'fa-lock' 
            }));
        }

        return m(Layout, [
            m('div.page-header', [
                m('h1', [m('i.fas.fa-users-cog'), ' 用户管理'])
            ]),

            users.length === 0 
                ? m(EmptyState, { message: '暂无用户', icon: 'fa-users' })
                : m('div.users-list', users.map(user => 
                    m('div.user-card', [
                        m('div.user-avatar', {
                            style: { position: 'relative' }
                        }, [
                            user.avatar 
                                ? m('img', { src: user.avatar, alt: user.username })
                                : m('div.avatar-placeholder', user.username[0].toUpperCase()),
                            m('div.avatar-upload-overlay', {
                                onclick: () => document.getElementById(`avatar-input-${user.id}`).click()
                            }, [
                                m('i.fas.fa-camera'),
                                m('input', {
                                    id: `avatar-input-${user.id}`,
                                    type: 'file',
                                    accept: 'image/*',
                                    style: { display: 'none' },
                                    onchange: e => UserManagement.handleAvatarUpload(vnode, user, e)
                                })
                            ]),
                            uploadingAvatar === user.id ? m('div.avatar-uploading', [
                                m('i.fas.fa-spinner.fa-spin')
                            ]) : null
                        ]),
                        m('div.user-info', [
                            m('div.user-header', [
                                m('h3.user-name', user.full_name || user.username),
                                user.is_admin ? m('span.badge.badge-admin', '管理员') : null,
                                !user.is_active ? m('span.badge.badge-inactive', '已禁用') : null
                            ]),
                            m('p.user-email', user.email),
                            user.bio ? m('p.user-bio', user.bio) : null,
                            m('div.user-meta', [
                                m('span', [m('i.fas.fa-calendar'), ` ${user.created_at}`]),
                                user.location ? m('span', [m('i.fas.fa-map-marker-alt'), ` ${user.location}`]) : null
                            ])
                        ]),
                        m('div.user-actions', [
                            m('button.btn.btn-secondary', {
                                onclick: () => UserManagement.startEdit(vnode, user)
                            }, [m('i.fas.fa-edit'), ' 编辑'])
                        ])
                    ])
                )),

            editingUser ? m('div.modal-overlay', {
                onclick: (e) => {
                    if (e.target === e.currentTarget) {
                        UserManagement.cancelEdit(vnode);
                    }
                }
            }, [
                m('div.modal', [
                    m('div.modal-header', [
                        m('h2', `编辑用户: ${editingUser.username}`),
                        m('button.modal-close', {
                            onclick: () => UserManagement.cancelEdit(vnode)
                        }, '×')
                    ]),
                    m('div.modal-body', [
                        m('div.form-group', [
                            m('label', '全名'),
                            m('input.form-input', {
                                type: 'text',
                                value: editForm.full_name,
                                oninput: e => { editForm.full_name = e.target.value; }
                            })
                        ]),
                        m('div.form-group', [
                            m('label', '个人简介'),
                            m('textarea.form-input', {
                                value: editForm.bio,
                                oninput: e => { editForm.bio = e.target.value; },
                                rows: 3
                            })
                        ]),
                        m('div.form-group', [
                            m('label', '网站'),
                            m('input.form-input', {
                                type: 'url',
                                value: editForm.website,
                                oninput: e => { editForm.website = e.target.value; }
                            })
                        ]),
                        m('div.form-group', [
                            m('label', '位置'),
                            m('input.form-input', {
                                type: 'text',
                                value: editForm.location,
                                oninput: e => { editForm.location = e.target.value; }
                            })
                        ]),
                        m('div.form-group', [
                            m('label', [
                                m('input', {
                                    type: 'checkbox',
                                    checked: editForm.is_active,
                                    onchange: e => { editForm.is_active = e.target.checked; }
                                }),
                                ' 账号激活'
                            ])
                        ]),
                        m('div.form-group', [
                            m('label', [
                                m('input', {
                                    type: 'checkbox',
                                    checked: editForm.is_admin,
                                    onchange: e => { editForm.is_admin = e.target.checked; }
                                }),
                                ' 管理员权限'
                            ])
                        ])
                    ]),
                    m('div.modal-footer', [
                        m('button.btn.btn-primary', {
                            onclick: () => UserManagement.saveEdit(vnode),
                            disabled: saving
                        }, saving ? '保存中...' : '保存'),
                        m('button.btn', {
                            onclick: () => UserManagement.cancelEdit(vnode)
                        }, '取消')
                    ])
                ])
            ]) : null
        ]);
    }
};


Auth.init();

async function loadTheme() {
    try {
        const stats = await API.get('/stats');
        if (stats && stats.theme) {
            document.documentElement.setAttribute('data-theme', stats.theme);
        } else {
            document.documentElement.setAttribute('data-theme', 'orange');
        }
    } catch (err) {
        console.error('Failed to load theme:', err);
        document.documentElement.setAttribute('data-theme', 'orange');
    }
}

loadTheme();

const AuthGuard = {
    oninit(vnode) {
        if (!Auth.isAuthenticated()) {
            m.route.set('/login');
        }
    },
    view(vnode) {
        return Auth.isAuthenticated() ? m(vnode.attrs.component, vnode.attrs) : null;
    }
};

const withAuth = (component) => {
    return {
        view(vnode) {
            return m(AuthGuard, { ...vnode.attrs, component });
        }
    };
};

m.route.prefix = '';

const routes = {
    '/': Dashboard,
    '/login': LoginPage,
    '/projects': ProjectList,
    '/projects/new': withAuth(CreateProjectPage),
    '/projects/migrate': withAuth(MigrateProjectPage),
    '/project/:owner/:repo': ProjectDetail,
    '/commits/:owner/:repo': CommitList,
    '/commits/:owner/:repo/:branch': CommitList,
    '/issues/:owner/:repo/new': withAuth(NewIssue),
    '/issues/:owner/:repo': IssueList,
    '/issues/:owner/:repo/:number': IssueDetail,
    '/pull-requests/:owner/:repo/new': withAuth(NewPullRequest),
    '/pull-requests/:owner/:repo': PullRequestList,
    '/pull-requests/:owner/:repo/:number': PullRequestDetail,
    '/tasks/:owner/:repo/new': withAuth(NewTask),
    '/tasks/:owner/:repo': TaskList,
    '/tasks/:owner/:repo/:id': TaskDetail,
    '/releases/:owner/:repo': ReleasesPage,
    '/stats/:owner/:repo': StatsPage,
    '/settings/:owner/:repo': withAuth(SettingsPage),
    '/groups': Groups,
    '/groups/new': withAuth(NewGroup),
    '/groups/:name': GroupDetail,
    '/users': withAuth(UserManagement),
    '/activity': Activities,
    '/snippets': SnippetsPage,
    '/snippets/new': withAuth(NewSnippet),
    '/snippets/:id': SnippetDetail,
    '/snippets/:id/edit': withAuth(EditSnippet)
};

m.route(document.getElementById('app'), '/', routes);
