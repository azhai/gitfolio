import { Layout } from '../components.js';
import { RepositoryService } from '../api.js';

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

export { MigrateProjectPage };