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
