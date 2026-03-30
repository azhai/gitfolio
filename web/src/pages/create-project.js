import { Layout } from '../components.js';
import { RepositoryService } from '../api.js';

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

        RepositoryService.create(vnode.state.formData).then(result => {
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

export { CreateProjectPage };