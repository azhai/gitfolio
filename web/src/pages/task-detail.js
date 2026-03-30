import { Layout, Loading, ProjectHeader, ProjectTabs, EmptyState, formatTime, MarkdownRenderer } from '../components.js';
import { RepositoryService, TaskService, PullRequestService, IssueService } from '../api.js';

const TaskDetail = {
    oninit(vnode) {
        const { owner, repo, id } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.task = null;
        vnode.state.allIssues = [];
        vnode.state.loading = true;
        vnode.state.prsCount = 0;
        vnode.state.issuesCount = 0;
        vnode.state.editMode = false;
        vnode.state.editData = {};
        vnode.state.showIssueSelector = false;
        vnode.state.selectedIssueId = '';
        
        Promise.all([
            RepositoryService.get(owner, repo),
            TaskService.get(owner, repo, id),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 }),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 })
        ]).then(([repoResult, taskResult, prsResult, issuesResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.task = taskResult.data || taskResult;
            const prData = prsResult.data || prsResult;
            vnode.state.prsCount = Array.isArray(prData) ? prData.filter(p => !p.is_closed && !p.is_merged).length : 0;
            const issuesData = issuesResult.data || issuesResult;
            vnode.state.issuesCount = Array.isArray(issuesData) ? issuesData.filter(i => !i.is_closed).length : 0;
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
                    prsCount: vnode.state.prsCount,
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
                            
                            task.attachments && task.attachments.length > 0 ? m('div.task-attachments', [
                                m('h3', '附件'),
                                m('div.attachment-list', task.attachments.map(att => 
                                    m('div.attachment-item', [
                                        m('i.fas.fa-file'),
                                        m('a', { href: att.file_path, target: '_blank' }, att.file_name),
                                        m('span.attachment-size', `(${formatFileSize(att.file_size)})`)
                                    ])
                                ))
                            ]) : null,
                            
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

export { TaskDetail };
