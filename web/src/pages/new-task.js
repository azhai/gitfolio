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

export { NewTask };
