// GitFolio Frontend Build - 2026年 3月19日 星期四 21时04分01秒 CST

const API_BASE_URL = '/api/v1';

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
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (Auth.token) {
            headers['Authorization'] = `Bearer ${Auth.token}`;
        }
        
        return m.request({
            url: `${API_BASE_URL}${options.url}`,
            method: options.method || 'GET',
            body: options.body,
            headers
        }).catch((error) => {
            console.error('API Error:', error);
            if (error.code === 401) {
                Auth.setToken(null);
                m.route.set('/login');
            }
            throw error;
        });
    },
    
    get(url) {
        return this.request({ url, method: 'GET' });
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
    list() {
        return API.get('/users');
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
    list(owner) {
        const url = owner ? `/users/${owner}/repos` : '/repos';
        return API.get(url);
    },

    get(owner, repo) {
        return API.get(`/${owner}/${repo}`);
    },

    create(owner, data) {
        return API.post('/repos', data);
    },

    update(owner, repo, data) {
        return API.put(`/${owner}/${repo}`, data);
    },

    delete(owner, repo) {
        return API.delete(`/${owner}/${repo}`);
    }
};

const IssueService = {
    list(owner, repo) {
        const url = owner && repo 
            ? `/${owner}/${repo}/issues`
            : '/issues';
        return API.get(url);
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
    list(owner, repo) {
        const url = owner && repo 
            ? `/${owner}/${repo}/merge_requests`
            : '/merge_requests';
        return API.get(url);
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
                    m('img.avatar', { src: 'https://via.placeholder.com/32', alt: '用户头像' }),
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
                        href: '/milestones', 
                        oncreate: m.route.link,
                        class: currentRoute === '/milestones' ? 'active' : ''
                    }, [
                        m('i.fas.fa-flag'),
                        m('span', '里程碑')
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
        const { owner, repo: repoObj, description, stars, forks, visibility } = vnode.attrs;
        
        const repo = typeof repoObj === 'string' ? repoObj : (repoObj?.name || '加载中...');
        const repoDesc = description || (repoObj?.description || '');
        const repoStars = stars !== undefined ? stars : (repoObj?.stars_count || 0);
        const repoForks = forks !== undefined ? forks : (repoObj?.forks_count || 0);
        const repoVisibility = visibility || (repoObj?.is_private ? 'private' : 'public');
        
        return m('div.project-header', [
            m('div.project-header-top', [
                m('div.project-title-section', [
                    m('h1', repo),
                    m('span.project-visibility', { class: repoVisibility === 'private' ? 'private' : '' }, 
                        repoVisibility === 'private' ? '私有' : '公开')
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
                m('span.project-visibility', project.is_private ? '私有' : '公开')
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
        console.log('ProjectList initializing...');
        vnode.state.projects = [];
        vnode.state.loading = true;
        vnode.state.filter = 'all';
        vnode.state.search = '';
        vnode.state.showCreateModal = false;
        
        RepositoryService.list().then(result => {
            console.log('Projects loaded:', result);
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
        const { projects, loading, filter, search, showCreateModal } = vnode.state;
        
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
                        m('button.btn.btn-primary', {
                            onclick: () => { vnode.state.showCreateModal = true; }
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
            ]),
            
            m(CreateProjectModal, {
                isOpen: showCreateModal,
                onClose: () => { vnode.state.showCreateModal = false; },
                onSubmit: (formData) => {
                    return RepositoryService.create('ryan', formData).then(result => {
                        vnode.state.projects.unshift(result.data || result);
                        vnode.state.showCreateModal = false;
                        m.redraw();
                    });
                }
            })
        ]);
    }
};


const ProjectDetail = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.issuesCount = 0;
        vnode.state.mrsCount = 0;
        vnode.state.loading = true;
        vnode.state.currentPath = '';
        vnode.state.currentBranch = 'main';
        
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
        const { repo, issuesCount, mrsCount, loading, currentPath, currentBranch } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        const fileTree = getFileTree(repoName);
        const files = fileTree[currentPath] || [];
        
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
                                            const menu = document.getElementById('branch-menu');
                                            if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                                        }
                                    }, [
                                        m('i.fas.fa-code-branch'),
                                        m('span', currentBranch),
                                        m('i.fas.fa-chevron-down')
                                    ]),
                                    m('div.branch-menu#branch-menu', { style: { display: 'none' } }, [
                                        m('div.branch-menu-header', '切换分支'),
                                        m('div.branch-option', {
                                            class: currentBranch === 'main' ? 'active' : '',
                                            onclick: () => { vnode.state.currentBranch = 'main'; }
                                        }, [
                                            m('i.fas.fa-check', { style: { visibility: currentBranch === 'main' ? 'visible' : 'hidden' } }),
                                            'main'
                                        ]),
                                        m('div.branch-option', {
                                            class: currentBranch === 'develop' ? 'active' : '',
                                            onclick: () => { vnode.state.currentBranch = 'develop'; }
                                        }, [
                                            m('i.fas.fa-check', { style: { visibility: currentBranch === 'develop' ? 'visible' : 'hidden' } }),
                                            'develop'
                                        ])
                                    ])
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
                            
                            m('div.path-breadcrumb', renderBreadcrumb(owner, repo.name, currentPath)),
                            
                            m('div.commit-info', [
                                m('img.commit-info-avatar', { src: 'https://via.placeholder.com/24', alt: '提交者' }),
                                m('div.commit-info-message', [
                                    m('a', { href: '#' }, '初始提交'),
                                    m('span.commit-info-meta', '· 提交于最近')
                                ]),
                                m('span.commit-info-hash', 'initial')
                            ]),
                            
                            files.length === 0 
                                ? m(EmptyState, { message: '此目录为空', icon: 'fa-folder-open' })
                                : m('div.file-list', files.map(file => 
                                    m(FileItem, { 
                                        file, 
                                        owner, 
                                        repo: repo.name,
                                        currentPath,
                                        onNavigate: (path) => { vnode.state.currentPath = path; }
                                    })
                                ))
                        ]),
                        
                        repo.readme ? m('div.readme-section', [
                            m('div.readme-header', [
                                m('i.fas.fa-book'),
                                ' README.md'
                            ]),
                            m('div.readme-content', {
                                oncreate: (vnode) => {
                                    if (typeof marked !== 'undefined') {
                                        vnode.dom.innerHTML = marked.parse(repo.readme);
                                    } else {
                                        vnode.dom.textContent = repo.readme;
                                    }
                                }
                            })
                        ]) : null
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

const FileItem = {
    view(vnode) {
        const { file, owner, repo, currentPath, onNavigate } = vnode.attrs;
        const newPath = currentPath ? `${currentPath}/${file.name}` : file.name;
        
        return m('div.file-item', {
            onclick: () => {
                if (file.type === 'folder') {
                    onNavigate(newPath);
                }
            },
            style: { cursor: file.type === 'folder' ? 'pointer' : 'default' }
        }, [
            m('span.file-icon', { class: file.type === 'folder' ? 'folder' : '' }, [
                m(`i.fas.${file.type === 'folder' ? 'fa-folder' : 'fa-file-code'}`)
            ]),
            m('span.file-name', 
                file.type === 'folder' 
                    ? m('a', { href: '#', onclick: (e) => { e.preventDefault(); onNavigate(newPath); } }, file.name)
                    : file.name
            ),
            m('span.file-commit-message', file.message),
            m('span.file-commit-time', file.time)
        ]);
    }
};

function renderBreadcrumb(owner, repo, currentPath) {
    const parts = currentPath ? currentPath.split('/') : [];
    
    let html = m('a', { href: `/project/${owner}/${repo}`, oncreate: m.route.link }, [
        m('i.fas.fa-folder'),
        ` ${repo}`
    ]);
    
    if (parts.length === 0) return html;
    
    return [html, ...parts.map((part, index) => {
        const path = parts.slice(0, index + 1).join('/');
        return [
            m('span', ' / '),
            m('a', { href: '#', onclick: (e) => { e.preventDefault(); /* navigate to path */ } }, part)
        ];
    })];
}

function getFileTree(repoName) {
    const trees = {
        'builder': {
            '': [
                { name: 'builder.go', type: 'file', message: 'Add core builder functions', time: '2 months ago' },
                { name: 'cond.go', type: 'file', message: 'Add condition builders', time: '3 months ago' },
                { name: 'select.go', type: 'file', message: 'Implement SELECT builder', time: '3 months ago' },
                { name: 'insert.go', type: 'file', message: 'Implement INSERT builder', time: '3 months ago' },
                { name: 'update.go', type: 'file', message: 'Implement UPDATE builder', time: '3 months ago' },
                { name: 'delete.go', type: 'file', message: 'Implement DELETE builder', time: '3 months ago' },
                { name: 'go.mod', type: 'file', message: 'Update dependencies', time: '1 month ago' },
                { name: 'go.sum', type: 'file', message: 'Update dependencies', time: '1 month ago' },
                { name: 'README.md', type: 'file', message: 'Update documentation', time: '2 weeks ago' },
                { name: 'LICENSE', type: 'file', message: 'Add MIT license', time: '1 year ago' }
            ]
        },
        'gx': {
            '': [
                { name: 'cmd', type: 'folder', message: 'Add CLI commands', time: '1 week ago' },
                { name: 'find', type: 'folder', message: 'Implement find command', time: '2 weeks ago' },
                { name: 'replace', type: 'folder', message: 'Implement replace command', time: '2 weeks ago' },
                { name: 'rename', type: 'folder', message: 'Implement rename command', time: '2 weeks ago' },
                { name: 'go.mod', type: 'file', message: 'Update dependencies', time: '3 days ago' },
                { name: 'README.md', type: 'file', message: 'Update documentation', time: '1 week ago' }
            ],
            'cmd': [
                { name: 'root.go', type: 'file', message: 'Add root command', time: '1 week ago' },
                { name: 'find.go', type: 'file', message: 'Add find command', time: '1 week ago' },
                { name: 'replace.go', type: 'file', message: 'Add replace command', time: '1 week ago' },
                { name: 'rename.go', type: 'file', message: 'Add rename command', time: '1 week ago' }
            ],
            'find': [
                { name: 'finder.go', type: 'file', message: 'Implement finder', time: '2 weeks ago' },
                { name: 'search.go', type: 'file', message: 'Implement search', time: '2 weeks ago' }
            ],
            'replace': [
                { name: 'replacer.go', type: 'file', message: 'Implement replacer', time: '2 weeks ago' }
            ],
            'rename': [
                { name: 'renamer.go', type: 'file', message: 'Implement renamer', time: '2 weeks ago' }
            ]
        }
    };
    
    return trees[repoName] || {};
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
        ]).then(([repoResult, issuesResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issues = issuesResult.data || issuesResult || [];
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
            m(ProjectTabs, { owner, repo: repo.name, activeTab: 'issues', issuesCount: openCount }),
            
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
            MergeRequestService.list(owner, repo)
        ]).then(([repoResult, mrsResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.mrs = mrsResult.data || mrsResult || [];
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
                    issuesCount: 0,
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
        vnode.state.loading = true;
        
        RepositoryService.get(owner, repo).then(result => {
            vnode.state.repo = result.data || result;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load project:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, loading } = vnode.state;
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
        vnode.state.loading = true;
        
        RepositoryService.get(owner, repo).then(result => {
            vnode.state.repo = result.data || result;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load project:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, loading } = vnode.state;
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
                                m('img.avatar', { src: 'https://via.placeholder.com/40', alt: '贡献者' }),
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

        RepositoryService.get(owner, repo).then(result => {
            vnode.state.repo = result.data || result;
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

    handleSave(vnode) {
        const { owner, repo } = vnode.attrs;
        const { formData, saving } = vnode.state;

        if (saving) return;
        vnode.state.saving = true;

        RepositoryService.update(owner, repo, formData).then(result => {
            vnode.state.repo = result.data || result;
            vnode.state.saving = false;
            alert('设置已保存！');
            m.redraw();
        }).catch(error => {
            vnode.state.saving = false;
            console.error('Failed to save settings:', error);
            alert('保存设置失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    handleDelete(vnode) {
        const { owner, repo } = vnode.attrs;
        const { deleting } = vnode.state;

        if (deleting) return;
        if (!confirm(`确定要删除项目 "${repo.name}" 吗？此操作不可撤销！`)) {
            return;
        }

        vnode.state.deleting = true;

        RepositoryService.delete(owner, repo).then(() => {
            vnode.state.deleting = false;
            alert('项目已删除！');
            m.route.set('/projects');
        }).catch(error => {
            vnode.state.deleting = false;
            console.error('Failed to delete repository:', error);
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
            m(ProjectTabs, { owner, repo: repo.name, activeTab: 'settings' }),
            
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
                                class: activeSection === 'danger' ? 'active' : '',
                                onclick: () => { vnode.state.activeSection = 'danger'; }
                            }, [
                                m('i.fas.fa-exclamation-triangle'),
                                m('span', '危险区域')
                            ])
                        ])
                    ]),
                    
                    m('div.settings-content', [
                        activeSection === 'general' ? m(GeneralSettings, { formData, repo }) : null,
                        activeSection === 'members' ? m(MembersSettings, { repo }) : null,
                        activeSection === 'integrations' ? m(IntegrationsSettings, { repo }) : null,
                        activeSection === 'webhooks' ? m(WebhooksSettings, { repo }) : null,
                        activeSection === 'repository' ? m(RepositorySettings, { repo }) : null,
                        activeSection === 'danger' ? m(DangerSettings, { repo }) : null
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
                    onclick: () => { SettingsPage.handleSave(vnode); }
                }, '保存更改')
            ])
        ]);
    }
};

const MembersSettings = {
    view(vnode) {
        const { repo } = vnode.attrs;
        
        const members = [
            { name: 'Ryan', email: 'ryan@example.com', role: 'owner', avatar: 'https://via.placeholder.com/40' },
            { name: 'Alice', email: 'alice@example.com', role: 'developer', avatar: 'https://via.placeholder.com/40' }
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
                    onclick: () => { SettingsPage.handleDelete(vnode); }
                }, '删除项目')
            ])
        ]);
    }
};

const GroupsPage = {
    view() {
        return m(Layout, [
            m('div.page-header', [
                m('h1', '群组')
            ]),
            m(EmptyState, { 
                message: '暂无群组', 
                icon: 'fa-users' 
            })
        ]);
    }
};

const ActivityPage = {
    view() {
        return m(Layout, [
            m('div.page-header', [
                m('h1', '活动')
            ]),
            m(EmptyState, { 
                message: '暂无活动', 
                icon: 'fa-chart-line' 
            })
        ]);
    }
};

const MilestonesPage = {
    view() {
        return m(Layout, [
            m('div.page-header', [
                m('h1', '里程碑')
            ]),
            m(EmptyState, { 
                message: '暂无里程碑', 
                icon: 'fa-flag' 
            })
        ]);
    }
};

const SnippetsPage = {
    view() {
        return m(Layout, [
            m('div.page-header', [
                m('h1', '代码片段')
            ]),
            m(EmptyState, { 
                message: '暂无代码片段', 
                icon: 'fa-code' 
            })
        ]);
    }
};


Auth.init();

// 使用 HTML5 History API，不使用 hash 路由
m.route.prefix = '';

const routes = {
    '/': Dashboard,
    '/projects': ProjectList,
    '/project/:owner/:repo': ProjectDetail,
    '/issues/:owner/:repo': IssueList,
    '/merge-requests/:owner/:repo': MergeRequestList,
    '/releases/:owner/:repo': ReleasesPage,
    '/stats/:owner/:repo': StatsPage,
    '/settings/:owner/:repo': SettingsPage,
    '/groups': GroupsPage,
    '/activity': ActivityPage,
    '/milestones': MilestonesPage,
    '/snippets': SnippetsPage
};

m.route(document.getElementById('app'), '/', routes);
