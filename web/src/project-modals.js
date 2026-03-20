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
