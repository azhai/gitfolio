import { Layout, Loading, EmptyState } from '../components.js';
import { SnippetService, Auth } from '../api.js';

const highlightCode = (code, language) => {
    if (typeof hljs !== 'undefined' && language) {
        try {
            const langClass = language.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (hljs.getLanguage(langClass)) {
                return hljs.highlight(code, { language: langClass }).value;
            }
        } catch (e) {
            console.error('Highlight error:', e);
        }
    }
    return code;
};

const SnippetsPage = {
    oninit(vnode) {
        vnode.state.snippets = [];
        vnode.state.loading = true;
        vnode.state.page = 1;
        vnode.state.perPage = 30;
        vnode.state.language = '';

        SnippetService.list(1, 30).then(result => {
            vnode.state.snippets = result.data || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    view(vnode) {
        const { snippets, loading } = vnode.state;

        return m(Layout, [
            m('div.page-header', [
                m('h1', [m('i.fas.fa-code'), ' 代码片段']),
                m('div.page-actions', [
                    Auth.isAuthenticated() ? m('button.btn.btn-primary', {
                        onclick: () => m.route.set('/snippets/new')
                    }, [m('i.fas.fa-plus'), ' 新建片段']) : null
                ])
            ]),

            loading ? m(Loading) : [
                snippets.length === 0 
                    ? m(EmptyState, { message: '暂无代码片段', icon: 'fa-code' })
                    : m('div.snippets-list', snippets.map(snippet => 
                        m('div.snippet-card', {
                            onclick: () => m.route.set(`/snippets/${snippet.id}`)
                        }, [
                            m('div.snippet-header', [
                                m('h3.snippet-title', snippet.title),
                                snippet.language ? m('span.language-badge', snippet.language) : null
                            ]),
                            snippet.description ? m('p.snippet-description', snippet.description) : null,
                            m('div.snippet-meta', [
                                snippet.username ? m('span', [m('i.fas.fa-user'), ` ${snippet.username}`]) : null,
                                m('span', [m('i.fas.fa-clock'), ` ${snippet.created_at}`])
                            ])
                        ])
                    ))
            ]
        ]);
    }
};

const SnippetDetail = {
    oninit(vnode) {
        const { id } = vnode.attrs;
        vnode.state.snippet = null;
        vnode.state.loading = true;

        SnippetService.get(id).then(result => {
            vnode.state.snippet = result;
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    view(vnode) {
        const { snippet, loading } = vnode.state;
        const { id } = vnode.attrs;

        if (loading) {
            return m(Layout, m(Loading));
        }

        if (!snippet) {
            return m(Layout, m(EmptyState, { message: '代码片段不存在', icon: 'fa-exclamation-triangle' }));
        }

        return m(Layout, [
            m('div.snippet-detail-page', [
                m('div.snippet-detail-header', [
                    m('h1', snippet.title),
                    m('div.snippet-actions', [
                        Auth.isAuthenticated() && snippet.user_id && Auth.token ? 
                            m('button.btn', {
                                onclick: () => m.route.set(`/snippets/${id}/edit`)
                            }, [m('i.fas.fa-edit'), ' 编辑']) : null,
                        Auth.isAuthenticated() && snippet.user_id && Auth.token ?
                            m('button.btn.btn-danger', {
                                onclick: () => {
                                    if (confirm('确定要删除这个代码片段吗？')) {
                                        SnippetService.delete(id).then(() => {
                                            m.route.set('/snippets');
                                        }).catch(error => {
                                            alert('删除失败: ' + (error.message || '未知错误'));
                                        });
                                    }
                                }
                            }, [m('i.fas.fa-trash'), ' 删除']) : null
                    ])
                ]),

                snippet.description ? m('p.snippet-description', snippet.description) : null,

                m('div.snippet-meta', [
                    snippet.language ? m('span', [m('i.fas.fa-code'), ` ${snippet.language}`]) : null,
                    snippet.username ? m('span', [m('i.fas.fa-user'), ` ${snippet.username}`]) : null,
                    m('span', [m('i.fas.fa-clock'), ` 创建于 ${snippet.created_at}`])
                ]),

                m('div.snippet-code', [
                    m('div.code-header', [
                        m('span', snippet.language || '代码'),
                        m('button.btn.btn-sm', {
                            onclick: () => {
                                navigator.clipboard.writeText(snippet.code);
                                alert('已复制到剪贴板');
                            }
                        }, [m('i.fas.fa-copy'), ' 复制'])
                    ]),
                    m('pre', [
                        m('code', { 
                            class: snippet.language ? `language-${snippet.language.toLowerCase().replace(/[^a-z0-9]/g, '')} hljs` : 'hljs',
                            oncreate: (vnode) => {
                                if (snippet.language && typeof hljs !== 'undefined') {
                                    const langClass = snippet.language.toLowerCase().replace(/[^a-z0-9]/g, '');
                                    if (hljs.getLanguage(langClass)) {
                                        vnode.dom.innerHTML = hljs.highlight(snippet.code, { language: langClass }).value;
                                    }
                                }
                            }
                        }, snippet.code)
                    ])
                ])
            ])
        ]);
    }
};

const NewSnippet = {
    oninit(vnode) {
        vnode.state.form = {
            title: '',
            description: '',
            language: '',
            code: '',
            visibility: 'public'
        };
        vnode.state.submitting = false;
    },

    submit(vnode) {
        if (!vnode.state.form.title) {
            alert('请输入标题');
            return;
        }

        if (!vnode.state.form.code) {
            alert('请输入代码');
            return;
        }

        vnode.state.submitting = true;
        SnippetService.create(vnode.state.form).then(result => {
            m.route.set(`/snippets/${result.id}`);
        }).catch(error => {
            vnode.state.submitting = false;
            alert('创建失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { form, submitting } = vnode.state;

        return m(Layout, [
            m('div.new-snippet-page', [
                m('div.page-header', [
                    m('h2', '新建代码片段')
                ]),

                m('div.form-container', [
                    m('div.form-group', [
                        m('label', '标题 *'),
                        m('input.form-input', {
                            type: 'text',
                            value: form.title,
                            oninput: e => { form.title = e.target.value; },
                            placeholder: '代码片段标题'
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '描述'),
                        m('textarea.form-input', {
                            value: form.description,
                            oninput: e => { form.description = e.target.value; },
                            placeholder: '描述这个代码片段的用途',
                            rows: 3
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '编程语言'),
                        m('input.form-input', {
                            type: 'text',
                            value: form.language,
                            oninput: e => { form.language = e.target.value; },
                            placeholder: '例如: JavaScript, Python, Go'
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '代码 *'),
                        m('textarea.form-input.code-input', {
                            value: form.code,
                            oninput: e => { form.code = e.target.value; },
                            placeholder: '粘贴你的代码...',
                            rows: 10
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '可见性'),
                        m('select.form-input', {
                            value: form.visibility,
                            onchange: e => { form.visibility = e.target.value; }
                        }, [
                            m('option', { value: 'public' }, '公开'),
                            m('option', { value: 'private' }, '私有')
                        ])
                    ]),

                    m('div.form-actions', [
                        m('button.btn.btn-primary', {
                            onclick: () => NewSnippet.submit(vnode),
                            disabled: submitting
                        }, submitting ? '创建中...' : '创建片段'),
                        m('button.btn', {
                            onclick: () => m.route.set('/snippets')
                        }, '取消')
                    ])
                ])
            ])
        ]);
    }
};

const EditSnippet = {
    oninit(vnode) {
        const { id } = vnode.attrs;
        vnode.state.snippet = null;
        vnode.state.form = {
            title: '',
            description: '',
            language: '',
            code: '',
            visibility: 'public'
        };
        vnode.state.loading = true;
        vnode.state.submitting = false;

        SnippetService.get(id).then(result => {
            vnode.state.snippet = result;
            vnode.state.form = {
                title: result.title,
                description: result.description || '',
                language: result.language || '',
                code: result.code,
                visibility: result.visibility || 'public'
            };
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    submit(vnode) {
        const { id } = vnode.attrs;
        
        if (!vnode.state.form.title) {
            alert('请输入标题');
            return;
        }

        if (!vnode.state.form.code) {
            alert('请输入代码');
            return;
        }

        vnode.state.submitting = true;
        SnippetService.update(id, vnode.state.form).then(result => {
            m.route.set(`/snippets/${id}`);
        }).catch(error => {
            vnode.state.submitting = false;
            alert('更新失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { form, loading, submitting } = vnode.state;
        const { id } = vnode.attrs;

        if (loading) {
            return m(Layout, m(Loading));
        }

        return m(Layout, [
            m('div.new-snippet-page', [
                m('div.page-header', [
                    m('h2', '编辑代码片段')
                ]),

                m('div.form-container', [
                    m('div.form-group', [
                        m('label', '标题 *'),
                        m('input.form-input', {
                            type: 'text',
                            value: form.title,
                            oninput: e => { form.title = e.target.value; },
                            placeholder: '代码片段标题'
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '描述'),
                        m('textarea.form-input', {
                            value: form.description,
                            oninput: e => { form.description = e.target.value; },
                            placeholder: '描述这个代码片段的用途',
                            rows: 3
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '编程语言'),
                        m('input.form-input', {
                            type: 'text',
                            value: form.language,
                            oninput: e => { form.language = e.target.value; },
                            placeholder: '例如: JavaScript, Python, Go'
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '代码 *'),
                        m('textarea.form-input.code-input', {
                            value: form.code,
                            oninput: e => { form.code = e.target.value; },
                            placeholder: '粘贴你的代码...',
                            rows: 10
                        })
                    ]),

                    m('div.form-group', [
                        m('label', '可见性'),
                        m('select.form-input', {
                            value: form.visibility,
                            onchange: e => { form.visibility = e.target.value; }
                        }, [
                            m('option', { value: 'public' }, '公开'),
                            m('option', { value: 'private' }, '私有')
                        ])
                    ]),

                    m('div.form-actions', [
                        m('button.btn.btn-primary', {
                            onclick: () => EditSnippet.submit(vnode),
                            disabled: submitting
                        }, submitting ? '保存中...' : '保存'),
                        m('button.btn', {
                            onclick: () => m.route.set(`/snippets/${id}`)
                        }, '取消')
                    ])
                ])
            ])
        ]);
    }
};

export { SnippetsPage, SnippetDetail, NewSnippet, EditSnippet };
