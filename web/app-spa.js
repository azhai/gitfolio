// GitFolio Frontend Build - 2026年 3月23日 星期一 08时37分50秒 CST
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
    
    MR_STATUS: {
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
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
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
    }
};

const API = {
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
            headers: headers
        };

        if (options.body) {
            requestOptions.body = options.body;
        }

        return m.request(requestOptions).catch(error => {
            if (error.code === Constants.HTTP_STATUS.UNAUTHORIZED) {
                Auth.setToken(null);
                m.route.set('/login');
            }
            throw error;
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
    
    update(id, data) {
        return API.put(`/users/${id}`, data);
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
        return API.get(`/${owner}/${repo}/tree`, params);
    },

    getFile(owner, repo, params = {}) {
        return API.get(`/${owner}/${repo}/file`, params);
    },

    getBranches(owner, repo) {
        return API.get(`/${owner}/${repo}/branches`);
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

const MergeRequestService = {
    list(owner, repo, params = {}) {
        const url = owner && repo 
            ? `/${owner}/${repo}/merge_requests`
            : '/merge_requests';
        return API.get(url, params);
    },
    
    get(owner, repo, number) {
        return API.get(`/${owner}/${repo}/merge_requests/${number}`);
    },
    
    create(owner, repo, data) {
        return API.post(`/${owner}/${repo}/merge_requests`, data);
    },
    
    update(owner, repo, number, data) {
        return API.put(`/${owner}/${repo}/merge_requests/${number}`, data);
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
                        const sidebar = document.getElementById('sidebar');
                        if (sidebar) {
                            sidebar.classList.toggle('collapsed');
                            sidebar.classList.toggle('active');
                        }
                    }
                }, m('i.fas.fa-bars')),
                m('a.logo', { href: '/', oncreate: m.route.link }, [
                    m('i.fas.fa-code-branch'),
                    m('span', 'GitFolio')
                ]),
                m('div.search-box', [
                    m('i.fas.fa-search'),
                    m('input[type=text][placeholder=搜索项目、Issue、合并请求...]')
                ])
            ]),
            m('div.top-bar-right', [
                m('button.icon-btn', m('i.fas.fa-plus')),
                m('button.icon-btn', [
                    m('i.fas.fa-bell'),
                    m('span.badge', '3')
                ]),
                m('div.user-menu', [
                    m('img.avatar', { src: '/images/avatar-32.svg', alt: '用户头像' }),
                    m('span.username', 'ryan'),
                    m('i.fas.fa-chevron-down')
                ])
            ])
        ]);
    }
};

const Sidebar = {
    view() {
        const currentRoute = m.route.get();
        
        return m('aside.sidebar#sidebar', [
            m('nav.sidebar-nav', [
                m('div.nav-section', [
                    m('a.nav-item', { 
                        href: '/', 
                        oncreate: m.route.link,
                        class: currentRoute === '/' ? 'active' : ''
                    }, [
                        m('i.fas.fa-home'),
                        m('span', '仪表盘')
                    ]),
                    m('a.nav-item', { 
                        href: '/projects', 
                        oncreate: m.route.link,
                        class: currentRoute.startsWith('/projects') ? 'active' : ''
                    }, [
                        m('i.fas.fa-folder'),
                        m('span', '项目')
                    ]),
                    m('a.nav-item', { 
                        href: '/groups', 
                        oncreate: m.route.link,
                        class: currentRoute === '/groups' ? 'active' : ''
                    }, [
                        m('i.fas.fa-users'),
                        m('span', '群组')
                    ]),
                    m('a.nav-item', { 
                        href: '/activity', 
                        oncreate: m.route.link,
                        class: currentRoute === '/activity' ? 'active' : ''
                    }, [
                        m('i.fas.fa-chart-line'),
                        m('span', '活动')
                    ]),
                    m('a.nav-item', { 
                        href: '/snippets', 
                        oncreate: m.route.link,
                        class: currentRoute === '/snippets' ? 'active' : ''
                    }, [
                        m('i.fas.fa-code'),
                        m('span', '代码片段')
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
        const { owner, repo, issuesCount, mrsCount, activeTab } = vnode.attrs;
        const currentRoute = m.route.get();
        
        const tabs = [
            { id: 'code', icon: 'fa-code', label: '代码', href: `/project/${owner}/${repo}` },
            { id: 'issues', icon: 'fa-exclamation-circle', label: 'Issue', href: `/issues/${owner}/${repo}`, count: issuesCount },
            { id: 'mrs', icon: 'fa-code-branch', label: '合并请求', href: `/merge-requests/${owner}/${repo}`, count: mrsCount },
            { id: 'milestones', icon: 'fa-flag', label: '里程碑', href: `/milestones/${owner}/${repo}` },
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
                m('h4', m('a', { 
                    href: `/issues/${owner}/${repo}/${issue.number}`,
                    oncreate: m.route.link
                }, issue.title)),
                m('div.issue-item-meta', [
                    m('span', `#${issue.number}`),
                    m('span', `由 ${issue.author} 创建于 ${formatTime(issue.created_at)}`),
                    issue.labels ? m('div.issue-labels', issue.labels.map(label => 
                        m('span.issue-label', { style: { backgroundColor: label.color } }, label.name)
                    )) : null
                ])
            ])
        ]);
    }
};

const MRItem = {
    view(vnode) {
        const { mr, owner: propOwner, repo: propRepo } = vnode.attrs;
        const owner = propOwner || mr.owner;
        const repo = propRepo || mr.repo;
        
        let statusClass = 'open';
        let statusIcon = 'fa-code-branch';
        if (mr.is_merged) {
            statusClass = 'merged';
        } else if (mr.is_closed) {
            statusClass = 'closed';
        }
        
        return m('div.mr-item', [
            m('div.mr-item-icon', [
                m(`i.fas.${statusIcon}`, { class: statusClass })
            ]),
            m('div.mr-item-content', [
                m('h4', m('a', { 
                    href: `/merge-requests/${owner}/${repo}/${mr.number}`,
                    oncreate: m.route.link
                }, mr.title)),
                m('div.mr-item-meta', [
                    m('span', `!${mr.number}`),
                    m('span', `${mr.source_branch} → ${mr.target_branch}`),
                    m('span', `由 ${mr.author} 创建于 ${formatTime(mr.created_at)}`)
                ])
            ])
        ]);
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
        const { isOpen, onClose, onSubmit, owner, repo } = vnode.attrs;
        const { formData, loading } = vnode.state;
        
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
                    m('textarea#issue-body.form-input.form-textarea', {
                        placeholder: '详细描述这个Issue...',
                        rows: 10,
                        value: formData.body,
                        oninput: (e) => {
                            vnode.state.formData.body = e.target.value;
                        }
                    })
                ]),
                
                m('div.form-group', [
                    m('label.form-label', '标签'),
                    m('div.labels-selector', [
                        m('button.btn.btn-sm', {
                            type: 'button',
                            onclick: () => {
                                if (!formData.labels.includes('bug')) {
                                    vnode.state.formData.labels.push('bug');
                                }
                            }
                        }, [
                            m('i.fas.fa-bug'),
                            ' Bug'
                        ]),
                        m('button.btn.btn-sm', {
                            type: 'button',
                            onclick: () => {
                                if (!formData.labels.includes('enhancement')) {
                                    vnode.state.formData.labels.push('enhancement');
                                }
                            }
                        }, [
                            m('i.fas.fa-magic'),
                            ' Enhancement'
                        ]),
                        m('button.btn.btn-sm', {
                            type: 'button',
                            onclick: () => {
                                if (!formData.labels.includes('question')) {
                                    vnode.state.formData.labels.push('question');
                                }
                            }
                        }, [
                            m('i.fas.fa-question-circle'),
                            ' Question'
                        ])
                    ]),
                    formData.labels.length > 0 ? 
                        m('div.selected-labels', [
                            m('span', '已选择: '),
                            formData.labels.map(label => 
                                m('span.issue-label', {
                                    onclick: () => {
                                        vnode.state.formData.labels = formData.labels.filter(l => l !== label);
                                    }
                                }, label + ' ×')
                            )
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

const CreateMRModal = {
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
            title: '新建合并请求'
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
                        console.error('Failed to create MR:', err);
                        alert('创建合并请求失败: ' + err.message);
                    });
                }
            }, [
                m('div.form-group', [
                    m('label.form-label', { for: 'mr-title' }, '标题'),
                    m('input#mr-title.form-input', {
                        type: 'text',
                        placeholder: '输入合并请求标题',
                        required: true,
                        value: formData.title,
                        oninput: (e) => {
                            vnode.state.formData.title = e.target.value;
                        }
                    })
                ]),
                
                m('div.form-group', [
                    m('label.form-label', { for: 'mr-desc' }, '描述'),
                    m('textarea#mr-desc.form-input.form-textarea', {
                        placeholder: '描述这个合并请求的变更内容...',
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
                    }, loading ? '提交中...' : '创建合并请求')
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
        vnode.state.mrs = [];
        vnode.state.loading = true;
        
        Promise.all([
            RepositoryService.list(),
            IssueService.list(),
            MergeRequestService.list()
        ]).then(([projects, issues, mrs]) => {
            vnode.state.projects = projects.data || [];
            vnode.state.issues = issues.data || [];
            vnode.state.mrs = mrs.data || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load dashboard data:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { projects, issues, mrs, loading } = vnode.state;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        return m(Layout, [
            m('div.dashboard', [
                m('div.dashboard-header', [
                    m('h1', '仪表盘'),
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
                            ' 最近合并请求'
                        ]),
                        mrs.length === 0 
                            ? m(EmptyState, { message: '暂无合并请求' })
                            : m('div.mr-list', mrs.slice(0, 5).map(mr => 
                                m(MRItem, { mr })
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
        vnode.state.mrsCount = 0;
        vnode.state.loading = true;
        vnode.state.currentPath = '';
        vnode.state.currentBranch = 'HEAD';
        vnode.state.branches = [];
        vnode.state.treeEntries = [];
        vnode.state.fileContent = null;
        vnode.state.showBranchMenu = false;
        
        vnode.state.loadBranches = function() {
            RepositoryService.getBranches(owner, repo).then(result => {
                vnode.state.branches = result.branches || [];
                m.redraw();
            }).catch(() => {});
        };
        
        vnode.state.loadTree = function() {
            vnode.state.fileContent = null;
            RepositoryService.getTree(owner, repo, { path: vnode.state.currentPath, ref: vnode.state.currentBranch }).then(result => {
                vnode.state.treeEntries = result.entries || [];
                m.redraw();
            }).catch(() => {
                vnode.state.treeEntries = [];
                m.redraw();
            });
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
            IssueService.list(owner, repo),
            MergeRequestService.list(owner, repo)
        ]).then(([repoResult, issuesResult, mrsResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.mrsCount = (mrsResult.data || mrsResult || []).filter(m => !m.is_closed && !m.is_merged).length;
            vnode.state.loading = false;
            vnode.state.loadBranches();
            vnode.state.loadTree();
            m.redraw();
        }).catch(error => {
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, issuesCount, mrsCount, loading, currentPath, currentBranch, branches, treeEntries, fileContent, showBranchMenu } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
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
                    repo: repo.name,
                    description: repo.description,
                    stars: repo.stars_count,
                    forks: repo.forks_count,
                    visibility: repo.is_private ? 'private' : 'public'
                }),
                
                m(ProjectTabs, {
                    owner: owner,
                    repo: repo.name,
                    issuesCount: issuesCount,
                    mrsCount: mrsCount,
                    activeTab: 'code'
                }),
                
                m('div.project-layout', [
                    m('div.main-content', [
                        m('div.file-browser', [
                            m('div.file-browser-header', [
                                m('div.branch-selector', [
                                    m('div.branch-dropdown', {
                                        onclick: (e) => {
                                            vnode.state.showBranchMenu = !vnode.state.showBranchMenu;
                                        }
                                    }, [
                                        m('i.fas.fa-code-branch'),
                                        m('span', currentBranch === 'HEAD' ? (repo.default_branch || 'main') : currentBranch),
                                        m('i.fas.fa-chevron-down')
                                    ]),
                                    showBranchMenu ? m('div.branch-menu', [
                                        m('div.branch-menu-header', '切换分支'),
                                        branches.map(branch => 
                                            m('div.branch-option', {
                                                class: currentBranch === branch ? 'active' : '',
                                                onclick: () => { 
                                                    vnode.state.currentBranch = branch;
                                                    vnode.state.showBranchMenu = false;
                                                    vnode.state.loadTree();
                                                }
                                            }, [
                                                m('i.fas.fa-check', { style: { visibility: currentBranch === branch ? 'visible' : 'hidden' } }),
                                                branch
                                            ])
                                        )
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
                            
                            m('div.path-breadcrumb', renderBreadcrumb(owner, repo.name, currentPath, (path) => {
                                vnode.state.currentPath = path;
                                vnode.state.loadTree();
                            })),
                            
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
                                    : m('div.file-list', treeEntries.map(entry => 
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
                                    ))
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
            m('span.file-commit-message', entry.hash ? entry.hash.substring(0, 7) : ''),
            m('span.file-commit-time', entry.size && !isTree ? formatSize(entry.size) : '')
        ]);
    }
};

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
            m('i.fas.fa-folder'),
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
        vnode.state.loading = true;
        vnode.state.filter = 'open';
        vnode.state.mrsCount = 0;
        vnode.state.showCreateModal = false;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo),
            MergeRequestService.list(owner, repo)
        ]).then(([repoResult, issuesResult, mrsResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issues = issuesResult.data || issuesResult || [];
            vnode.state.mrsCount = (mrsResult.data || mrsResult || []).filter(m => !m.is_closed && !m.is_merged).length;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load issues:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, issues, loading, filter, showCreateModal } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        const filteredIssues = issues.filter(issue => {
            if (filter === 'open') return !issue.is_closed;
            if (filter === 'closed') return issue.is_closed;
            return true;
        });
        
        const openCount = issues.filter(i => !i.is_closed).length;
        const closedCount = issues.filter(i => i.is_closed).length;
        
        return m(Layout, [
            m(ProjectHeader, { repo, owner }),
            m(ProjectTabs, { owner, repo: repo.name, activeTab: 'issues', issuesCount: openCount, mrsCount: vnode.state.mrsCount }),
            
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
                        onclick: () => { vnode.state.showCreateModal = true; }
                    }, [
                        m('i.fas.fa-plus'),
                        ' 新建 Issue'
                    ])
                ]),
                
                filteredIssues.length === 0 ? 
                    m(EmptyState, { 
                        message: filter === 'open' ? '没有开启的Issue' : '没有已关闭的Issue', 
                        icon: 'fa-inbox' 
                    }) :
                    m('div.issue-list', filteredIssues.map(issue => 
                        m(IssueItem, { issue, owner, repo: repo.name })
                    ))
            ]),
            
            m(CreateIssueModal, {
                isOpen: showCreateModal,
                onClose: () => { vnode.state.showCreateModal = false; },
                onSubmit: (formData) => {
                    return IssueService.create(owner, repo.name, formData).then(result => {
                        vnode.state.issues.unshift(result.data || result);
                        vnode.state.showCreateModal = false;
                        m.redraw();
                    });
                },
                owner,
                repo: repo.name
            })
        ]);
    }
};


const MergeRequestList = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.mrs = [];
        vnode.state.loading = true;
        vnode.state.filter = 'open';
        vnode.state.issuesCount = 0;
        vnode.state.showCreateModal = false;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            MergeRequestService.list(owner, repo),
            IssueService.list(owner, repo)
        ]).then(([repoResult, mrsResult, issuesResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.mrs = mrsResult.data || mrsResult || [];
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load merge requests:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, mrs, loading, filter, showCreateModal } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        const openMRs = mrs.filter(m => !m.is_closed && !m.is_merged);
        const mergedMRs = mrs.filter(m => m.is_merged);
        const closedMRs = mrs.filter(m => m.is_closed && !m.is_merged);
        
        let filteredMRs = [];
        if (filter === 'open') filteredMRs = openMRs;
        else if (filter === 'merged') filteredMRs = mergedMRs;
        else if (filter === 'closed') filteredMRs = closedMRs;
        
        return m(Layout, [
            m('div.merge-requests-page', [
                m(ProjectHeader, {
                    owner: owner,
                    repo: repo.name,
                    description: repo.description,
                    stars: repo.stars_count,
                    forks: repo.forks_count,
                    visibility: repo.is_private ? 'private' : 'public'
                }),
                
                m(ProjectTabs, {
                    owner: owner,
                    repo: repo.name,
                    issuesCount: vnode.state.issuesCount,
                    mrsCount: openMRs.length,
                    activeTab: 'mrs'
                }),
                
                m('div.merge-requests-content', [
                    m('div.merge-requests-toolbar', [
                        m('div.filter-tabs', [
                            m('button.filter-tab', {
                                class: filter === 'open' ? 'active' : '',
                                onclick: () => { vnode.state.filter = 'open'; }
                            }, [
                                m('i.fas.fa-code-branch.open'),
                                ` ${openMRs.length} 个开启`
                            ]),
                            m('button.filter-tab', {
                                class: filter === 'merged' ? 'active' : '',
                                onclick: () => { vnode.state.filter = 'merged'; }
                            }, [
                                m('i.fas.fa-code-branch.merged'),
                                ` ${mergedMRs.length} 个已合并`
                            ]),
                            m('button.filter-tab', {
                                class: filter === 'closed' ? 'active' : '',
                                onclick: () => { vnode.state.filter = 'closed'; }
                            }, [
                                m('i.fas.fa-times-circle.closed'),
                                ` ${closedMRs.length} 个已关闭`
                            ])
                        ]),
                        m('button.btn.btn-primary', {
                            onclick: () => { vnode.state.showCreateModal = true; }
                        }, [
                            m('i.fas.fa-plus'),
                            ' 新建合并请求'
                        ])
                    ]),
                    
                    filteredMRs.length === 0 
                        ? m(EmptyState, { 
                            message: filter === 'open' ? '暂无开启的合并请求' : 
                                     filter === 'merged' ? '暂无已合并的合并请求' : '暂无已关闭的合并请求',
                            icon: 'fa-code-branch'
                        })
                        : m('div.merge-requests-list', filteredMRs.map(mr => 
                            m(MRItem, { mr, owner, repo: repo.name })
                        ))
                ])
            ]),
            
            m(CreateMRModal, {
                isOpen: showCreateModal,
                onClose: () => { vnode.state.showCreateModal = false; },
                onSubmit: (formData) => {
                    return MergeRequestService.create(owner, repo.name, formData).then(result => {
                        vnode.state.mrs.unshift(result.data || result);
                        vnode.state.showCreateModal = false;
                        m.redraw();
                    });
                },
                owner,
                repo: repo.name,
                branches: ['main', 'develop', 'feature-branch']
            })
        ]);
    }
};

const ReleasesPage = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.issuesCount = 0;
        vnode.state.mrsCount = 0;
        vnode.state.loading = true;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo),
            MergeRequestService.list(owner, repo)
        ]).then(([repoResult, issuesResult, mrsResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.mrsCount = (mrsResult.data || mrsResult || []).filter(m => !m.is_closed && !m.is_merged).length;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load project:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, issuesCount, mrsCount, loading } = vnode.state;
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
                    repo: repo.name,
                    description: repo.description,
                    stars: repo.stars_count,
                    forks: repo.forks_count,
                    visibility: repo.is_private ? 'private' : 'public'
                }),
                
                m(ProjectTabs, {
                    owner: owner,
                    repo: repo.name,
                    issuesCount: issuesCount,
                    mrsCount: mrsCount,
                    activeTab: 'releases'
                }),
                
                m('div.releases-content', [
                    m('div.releases-header', [
                        m('h1', '发布'),
                        m('button.btn.btn-primary', [
                            m('i.fas.fa-plus'),
                            ' 新建发布'
                        ])
                    ]),
                    
                    m('div.release-card', [
                        m('div.release-header', [
                            m('div.release-info', [
                                m('div.release-title-row', [
                                    m('h2.release-title', m('a', { href: '#' }, 'v1.0.0')),
                                    m('span.release-tag.latest', '最新版本')
                                ]),
                                m('div.release-meta', [
                                    m('span.release-meta-item', [
                                        m('i.fas.fa-tag'),
                                        ' v1.0.0'
                                    ]),
                                    m('span.release-meta-item', [
                                        m('i.fas.fa-code-branch'),
                                        ' main'
                                    ]),
                                    m('span.release-meta-item', [
                                        m('i.fas.fa-clock'),
                                        ' 初始发布'
                                    ])
                                ])
                            ])
                        ]),
                        m('div.release-body', [
                            m('div.release-notes', [
                                m('h3', '🎉 初始发布'),
                                m('p', '这是项目的第一个正式发布版本。'),
                                m('h3', '✨ 功能特性'),
                                m('ul', [
                                    m('li', '基础功能实现'),
                                    m('li', '用户界面完善'),
                                    m('li', 'API 接口开发')
                                ])
                            ])
                        ])
                    ]),
                    
                    m(EmptyState, { 
                        message: '暂无更多发布版本', 
                        icon: 'fa-cube' 
                    })
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
        vnode.state.mrsCount = 0;
        vnode.state.loading = true;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo),
            MergeRequestService.list(owner, repo)
        ]).then(([repoResult, issuesResult, mrsResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.mrsCount = (mrsResult.data || mrsResult || []).filter(m => !m.is_closed && !m.is_merged).length;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load project:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, issuesCount, mrsCount, loading } = vnode.state;
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
                    repo: repo.name,
                    description: repo.description,
                    stars: repo.stars_count,
                    forks: repo.forks_count,
                    visibility: repo.is_private ? 'private' : 'public'
                }),
                
                m(ProjectTabs, {
                    owner: owner,
                    repo: repo.name,
                    issuesCount: issuesCount,
                    mrsCount: mrsCount,
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
                                m('div.stat-value', '0'),
                                m('div.stat-label', 'Issue')
                            ])
                        ])
                    ]),
                    
                    m('div.stats-section', [
                        m('h2', '贡献者'),
                        m('div.contributors-list', [
                            m('div.contributor-item', [
                                m('img.avatar', { src: '/images/avatar-40.svg', alt: '贡献者' }),
                                m('div.contributor-info', [
                                    m('div.contributor-name', 'ryan'),
                                    m('div.contributor-stats', '10 commits')
                                ])
                            ])
                        ])
                    ])
                ])
            ])
        ]);
    }
};


const SettingsPage = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;

        vnode.state.repo = null;
        vnode.state.issuesCount = 0;
        vnode.state.mrsCount = 0;
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
            IssueService.list(owner, repo),
            MergeRequestService.list(owner, repo)
        ]).then(([repoResult, issuesResult, mrsResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.mrsCount = (mrsResult.data || mrsResult || []).filter(m => !m.is_closed && !m.is_merged).length;
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
                repo: repo.name, 
                issuesCount: vnode.state.issuesCount,
                mrsCount: vnode.state.mrsCount,
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

        RepositoryService.create('ryan', vnode.state.formData).then(result => {
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
            is_private: false,
            project_type: 'mirror'
        };
        vnode.state.loading = false;
        vnode.state.error = null;
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

    handleCloneUrlInput(vnode, e) {
        vnode.state.formData.clone_url = e.target.value;
        const detectedInfo = MigrateProjectPage.extractRepoInfo(e.target.value);
        if (detectedInfo) {
            vnode.state.detected = detectedInfo;
            if (!vnode.state.formData.name) {
                vnode.state.formData.name = detectedInfo.repo;
            }
            if (!vnode.state.formData.description) {
                vnode.state.formData.description = '从 ' + detectedInfo.platform + ' 镜像的项目';
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

        RepositoryService.create('ryan', submitData).then(result => {
            vnode.state.loading = false;
            m.route.set('/projects');
        }).catch(err => {
            vnode.state.loading = false;
            vnode.state.error = err.message || '迁移项目失败';
            m.redraw();
        });
    },

    view(vnode) {
        const { formData, loading, error, detected } = vnode.state;

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
                            m('span', '检测到 ' + detected.platform + ' 仓库: ' + detected.owner + '/' + detected.repo)
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
                m('h1', [m('i.fas.fa-users'), ' 群组']),
                m('div.page-actions', [
                    m('button.btn.btn-primary', {
                        onclick: () => m.route.set('/groups/new')
                    }, [m('i.fas.fa-plus'), ' 新建群组'])
                ])
            ]),

            loading ? m(Loading) : [
                groups.length === 0 
                    ? m(EmptyState, { message: '暂无群组', icon: 'fa-users' })
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
        vnode.state.loading = true;

        GroupService.get(name).then(result => {
            vnode.state.group = result;
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    view(vnode) {
        const { group, loading } = vnode.state;

        if (loading) {
            return m(Layout, m(Loading));
        }

        if (!group) {
            return m(Layout, m(EmptyState, { message: '群组不存在', icon: 'fa-users' }));
        }

        return m(Layout, [
            m('div.group-detail-page', [
                m('div.group-header', [
                    m('div.group-avatar-large', [
                        group.avatar 
                            ? m('img', { src: group.avatar, alt: group.name })
                            : m('div.avatar-placeholder', group.display_name ? group.display_name[0].toUpperCase() : group.name[0].toUpperCase())
                    ]),
                    m('div.group-info', [
                        m('h1', group.display_name || group.name),
                        group.description ? m('p.group-description', group.description) : null,
                        m('div.group-meta', [
                            m('span', [m('i.fas.fa-users'), ` ${group.members_count || 0} 成员`]),
                            group.location ? m('span', [m('i.fas.fa-map-marker-alt'), ` ${group.location}`]) : null,
                            group.website ? m('a', { href: group.website, target: '_blank' }, [m('i.fas.fa-globe'), ' 网站']) : null
                        ])
                    ])
                ]),

                m('div.group-tabs', [
                    m('a.tab.active', { href: '#' }, '概览'),
                    m('a.tab', { href: '#' }, '成员'),
                    m('a.tab', { href: '#' }, '项目'),
                    m('a.tab', { href: '#' }, '设置')
                ]),

                m('div.group-content', [
                    m('div.info-section', [
                        m('h3', '群组信息'),
                        m('div.info-row', [m('strong', '名称: '), group.name]),
                        m('div.info-row', [m('strong', '创建时间: '), group.created_at])
                    ])
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
        vnode.state.submitting = false;
    },

    submit(vnode) {
        if (!vnode.state.form.name) {
            alert('请输入群组名称');
            return;
        }

        vnode.state.submitting = true;
        GroupService.create(vnode.state.form).then(result => {
            m.route.set(`/groups/${result.name}`);
        }).catch(error => {
            vnode.state.submitting = false;
            alert('创建失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { form, submitting } = vnode.state;

        return m(Layout, [
            m('div.page-header', [
                m('h1', [m('i.fas.fa-users'), ' 新建群组'])
            ]),

            m('div.form-container', [
                m('div.form-group', [
                    m('label', '群组名称 *'),
                    m('input.form-input', {
                        type: 'text',
                        value: form.name,
                        oninput: e => { form.name = e.target.value; },
                        placeholder: '例如: my-group'
                    })
                ]),

                m('div.form-group', [
                    m('label', '显示名称'),
                    m('input.form-input', {
                        type: 'text',
                        value: form.display_name,
                        oninput: e => { form.display_name = e.target.value; },
                        placeholder: '例如: 我的群组'
                    })
                ]),

                m('div.form-group', [
                    m('label', '描述'),
                    m('textarea.form-input', {
                        value: form.description,
                        oninput: e => { form.description = e.target.value; },
                        placeholder: '群组描述',
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
                        placeholder: '例如: 北京'
                    })
                ]),

                m('div.form-actions', [
                    m('button.btn.btn-primary', {
                        onclick: () => NewGroup.submit(vnode),
                        disabled: submitting
                    }, submitting ? '创建中...' : '创建群组'),
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
                m('h1', [m('i.fas.fa-code'), ' 代码片段']),
                m('div.page-actions', [
                    Auth.isAuthenticated() ? m('button.btn.btn-primary', {
                        onclick: () => m.route.set('/snippets/new')
                    }, [m('i.fas.fa-plus'), ' 新建片段']) : null
                ])
            ]),

            loading ? m(Loading) : [
                snippets.length === 0 
                    ? m(EmptyState, { message: '暂无代码片段', icon: 'fa-code' })
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
            return m(Layout, m(EmptyState, { message: '代码片段不存在', icon: 'fa-exclamation-triangle' }));
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
                                    if (confirm('确定要删除这个代码片段吗？')) {
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
                    m('h2', '新建代码片段')
                ]),

                m('div.form-container', [
                    m('div.form-group', [
                        m('label', '标题 *'),
                        m('input.form-input', {
                            type: 'text',
                            value: form.title,
                            oninput: e => { form.title = e.target.value; },
                            placeholder: '代码片段标题'
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '描述'),
                        m('textarea.form-input', {
                            value: form.description,
                            oninput: e => { form.description = e.target.value; },
                            placeholder: '描述这个代码片段的用途',
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
                    m('h2', '编辑代码片段')
                ]),

                m('div.form-container', [
                    m('div.form-group', [
                        m('label', '标题 *'),
                        m('input.form-input', {
                            type: 'text',
                            value: form.title,
                            oninput: e => { form.title = e.target.value; },
                            placeholder: '代码片段标题'
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '描述'),
                        m('textarea.form-input', {
                            value: form.description,
                            oninput: e => { form.description = e.target.value; },
                            placeholder: '描述这个代码片段的用途',
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


Auth.init();

const requireAuth = function(vnode) {
    if (!Auth.isAuthenticated()) {
        m.route.set('/login');
        return false;
    }
    return true;
};

m.route.prefix = '';

const routes = {
    '/': Dashboard,
    '/login': LoginPage,
    '/projects': ProjectList,
    '/projects/new': CreateProjectPage,
    '/projects/migrate': MigrateProjectPage,
    '/project/:owner/:repo': ProjectDetail,
    '/issues/:owner/:repo': IssueList,
    '/merge-requests/:owner/:repo': MergeRequestList,
    '/releases/:owner/:repo': ReleasesPage,
    '/stats/:owner/:repo': StatsPage,
    '/settings/:owner/:repo': SettingsPage,
    '/groups': Groups,
    '/groups/new': NewGroup,
    '/groups/:name': GroupDetail,
    '/activity': Activities,
    '/milestones/:owner/:repo': Milestones,
    '/milestones/:owner/:repo/new': NewMilestone,
    '/snippets': SnippetsPage,
    '/snippets/new': NewSnippet,
    '/snippets/:id': SnippetDetail,
    '/snippets/:id/edit': EditSnippet
};

m.route(document.getElementById('app'), '/', routes);
