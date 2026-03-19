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
