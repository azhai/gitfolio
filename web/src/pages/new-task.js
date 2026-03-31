import { Layout, Loading, ProjectHeader, ProjectTabs, MarkdownEditor } from '../components.js';
import { RepositoryService, TaskService, IssueService, PullRequestService } from '../api.js';

const NewTask = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.loading = true;
        vnode.state.submitting = false;
        vnode.state.prsCount = 0;
        vnode.state.issuesCount = 0;
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
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 })
        ]).then(([repoResult, issuesResult, prsResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
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
    
    handleSubmit(vnode) {
        const { owner, repo } = vnode.attrs;
        const { formData, submitting } = vnode.state;
        
        if (submitting) return;
        
        if (!formData.title.trim()) {
            alert('标题不能为空');
            return;
        }
        
        vnode.state.submitting = true;
        
        TaskService.create(owner, repo, formData).then(result => {
            const task = result.data || result;
            m.route.set(`/tasks/${owner}/${repo}/${task.id}`);
        }).catch(error => {
            vnode.state.submitting = false;
            alert('创建任务失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },
    
    view(vnode) {
        const { owner, repo: repoName } = vnode.attrs;
        const { repo, loading, submitting, formData, issuesCount, prsCount, showScheduleForm, newSchedule } = vnode.state;
        
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
                prsCount: prsCount,
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

export { NewTask };
