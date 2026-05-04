import { Layout, Loading, ProjectHeader, ProjectTabs, EmptyState } from '../components.js';
import { RepositoryService, IssueService, PullRequestService, TaskService } from '../api.js';

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
        vnode.state.saving = false;
        vnode.state.pushUrl = vnode.attrs.repo?.mirror_url || '';
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

    handleSaveRemote(vnode) {
        const { owner, repo } = vnode.attrs;
        const { pushUrl, saving } = vnode.state;

        if (saving) return;
        if (!pushUrl || !pushUrl.trim()) {
            alert('请输入远程仓库 URL');
            return;
        }

        vnode.state.saving = true;
        API.put(`/api/v1/${owner}/${repo.name}`, { mirror_url: pushUrl }).then(result => {
            vnode.state.saving = false;
            alert('保存成功！');
            repo.mirror_url = pushUrl;
            m.redraw();
        }).catch(error => {
            vnode.state.saving = false;
            alert('保存失败: ' + (error.response?.data?.error || error.message || '未知错误'));
            m.redraw();
        });
    },

    handlePushAll(vnode) {
        const { owner, repo } = vnode.attrs;
        const { syncing } = vnode.state;

        if (syncing) return;

        vnode.state.syncing = true;
        RepositoryService.syncPull(owner, repo.name).then(result => {
            vnode.state.syncing = false;
            alert('推送完成！');
            m.redraw();
        }).catch(error => {
            vnode.state.syncing = false;
            alert('推送失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { repo } = vnode.attrs;
        const { syncing, saving, pushUrl } = vnode.state;

        return m('div.settings-section', [
            m('div.settings-section-header', [
                m('h2.settings-section-title', '代码同步'),
                m('p.settings-section-description', '管理代码的拉取和推送同步')
            ]),

            repo.is_mirror ? m('div.form-group', [
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
            ]) : null,

            m('div.form-group', [
                m('h4', '推送到远程'),
                m('p', '将本地代码推送到远程仓库'),
                m('div.form-row', [
                    m('input.form-input', {
                        type: 'text',
                        placeholder: '远程仓库 URL (例如: https://github.com/user/repo.git)',
                        value: pushUrl,
                        oninput: (e) => { vnode.state.pushUrl = e.target.value; },
                        style: 'flex: 1; margin-right: 10px;'
                    }),
                    m('button.btn.btn-secondary', {
                        onclick: () => SyncSettings.handleSaveRemote(vnode),
                        disabled: saving,
                        style: 'padding: 6px 10px; font-size: 13px; flex-shrink: 0; width: 200px;'
                    }, saving ? '保存中...' : '保存'),
                    m('button.btn.btn-primary', {
                        onclick: () => SyncSettings.handlePushAll(vnode),
                        disabled: syncing,
                        style: 'padding: 6px 10px; font-size: 13px; flex-shrink: 0; width: 200px;'
                    }, syncing ? '推送中...' : '全部推送')
                ])
            ])
        ]);
    }
};

export { SettingsPage };
