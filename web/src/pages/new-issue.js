import { Layout, Loading, ProjectHeader, ProjectTabs, MarkdownEditor, MarkdownRenderer } from '../components.js';
import { RepositoryService, IssueService, PullRequestService, LabelService, TaskService } from '../api.js';

const NewIssue = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.labels = [];
        vnode.state.loading = true;
        vnode.state.submitting = false;
        vnode.state.prsCount = 0;
        vnode.state.issuesCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.formData = {
            title: '',
            body: '',
            labels: []
        };
        
        Promise.all([
            RepositoryService.get(owner, repo),
            LabelService.list(owner, repo),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 }),
            TaskService.list(owner, repo, { per_page: 1 })
        ]).then(([repoResult, labelsResult, issuesResult, prsResult, tasksResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.labels = labelsResult || [];
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
    
    handleSubmit(vnode) {
        const { owner, repo } = vnode.attrs;
        const { formData, submitting } = vnode.state;
        
        if (submitting) return;
        
        if (!formData.title.trim()) {
            alert('标题不能为空');
            return;
        }
        
        vnode.state.submitting = true;
        
        IssueService.create(owner, repo, formData).then(result => {
            const issue = result.data || result;
            m.route.set(`/issues/${owner}/${repo}/${issue.number}`);
        }).catch(error => {
            vnode.state.submitting = false;
            alert('创建议题失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },
    
    view(vnode) {
        const { owner, repo: repoName } = vnode.attrs;
        const { repo, labels, loading, submitting, formData, issuesCount, prsCount } = vnode.state;
        
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
                activeTab: 'issues'
            }),
            
            m('div.new-issue-page', [
                m('div.breadcrumb', [
                    m('a', { href: '/', oncreate: m.route.link }, '首页'),
                    ' / ',
                    m('a', { href: `/issues/${owner}/${repo.name}`, oncreate: m.route.link }, '议题'),
                    ' / 新建'
                ]),
                
                m('div.new-issue-container', [
                    m('div.new-issue-main', [
                        m('div.form-card', [
                            m('div.form-group', [
                                m('label.form-label', { for: 'issue-title' }, '标题'),
                                m('input#issue-title.form-input', {
                                    type: 'text',
                                    placeholder: '标题',
                                    value: formData.title,
                                    oninput: (e) => {
                                        vnode.state.formData.title = e.target.value;
                                    }
                                })
                            ]),
                            
                            m('div.form-group', [
                                m('label.form-label', { for: 'issue-body' }, '描述'),
                                m('div.editor-toolbar', [
                                    m('button.toolbar-btn', {
                                        type: 'button',
                                        onclick: () => {
                                            const textarea = document.querySelector('#issue-body-textarea');
                                            if (textarea) {
                                                const start = textarea.selectionStart;
                                                const end = textarea.selectionEnd;
                                                const text = formData.body || '';
                                                const before = text.substring(0, start);
                                                const after = text.substring(end);
                                                vnode.state.formData.body = before + '****' + after;
                                                m.redraw();
                                            }
                                        }
                                    }, m('i.fas.fa-bold')),
                                    m('button.toolbar-btn', {
                                        type: 'button',
                                        onclick: () => {
                                            const textarea = document.querySelector('#issue-body-textarea');
                                            if (textarea) {
                                                const start = textarea.selectionStart;
                                                const end = textarea.selectionEnd;
                                                const text = formData.body || '';
                                                const before = text.substring(0, start);
                                                const after = text.substring(end);
                                                vnode.state.formData.body = before + '**' + after;
                                                m.redraw();
                                            }
                                        }
                                    }, m('i.fas.fa-italic')),
                                    m('button.toolbar-btn', {
                                        type: 'button',
                                        onclick: () => {
                                            const textarea = document.querySelector('#issue-body-textarea');
                                            if (textarea) {
                                                const start = textarea.selectionStart;
                                                const end = textarea.selectionEnd;
                                                const text = formData.body || '';
                                                const before = text.substring(0, start);
                                                const after = text.substring(end);
                                                vnode.state.formData.body = before + '`code`' + after;
                                                m.redraw();
                                            }
                                        }
                                    }, m('i.fas.fa-code')),
                                    m('button.toolbar-btn', {
                                        type: 'button',
                                        onclick: () => {
                                            const textarea = document.querySelector('#issue-body-textarea');
                                            if (textarea) {
                                                const start = textarea.selectionStart;
                                                const end = textarea.selectionEnd;
                                                const text = formData.body || '';
                                                const before = text.substring(0, start);
                                                const after = text.substring(end);
                                                vnode.state.formData.body = before + '[链接文字](url)' + after;
                                                m.redraw();
                                            }
                                        }
                                    }, m('i.fas.fa-link')),
                                    m('button.toolbar-btn', {
                                        type: 'button',
                                        onclick: () => {
                                            const textarea = document.querySelector('#issue-body-textarea');
                                            if (textarea) {
                                                const start = textarea.selectionStart;
                                                const end = textarea.selectionEnd;
                                                const text = formData.body || '';
                                                const before = text.substring(0, start);
                                                const after = text.substring(end);
                                                vnode.state.formData.body = before + '![图片alt](url)' + after;
                                                m.redraw();
                                            }
                                        }
                                    }, m('i.fas.fa-image'))
                                ]),
                                m('textarea#issue-body-textarea.form-textarea', {
                                    placeholder: '添加描述...',
                                    rows: 10,
                                    value: formData.body,
                                    oninput: (e) => {
                                        vnode.state.formData.body = e.target.value;
                                    }
                                })
                            ]),
                            
                            m('div.form-actions', [
                                m('button.btn.btn-primary', {
                                    onclick: () => NewIssue.handleSubmit(vnode),
                                    disabled: submitting || !formData.title.trim()
                                }, submitting ? '提交中...' : '提交新议题'),
                                m('button.btn', {
                                    onclick: () => {
                                        m.route.set(`/issues/${owner}/${repo.name}`);
                                    }
                                }, '取消')
                            ])
                        ])
                    ]),
                    
                    m('div.new-issue-sidebar', [
                        m('div.sidebar-card', [
                            m('h4', '标签'),
                            labels.length > 0 ?
                                m('div.labels-list', labels.map(label => 
                                    m('button.label-item', {
                                        class: formData.labels.includes(label.name) ? 'selected' : '',
                                        onclick: () => {
                                            if (formData.labels.includes(label.name)) {
                                                vnode.state.formData.labels = formData.labels.filter(l => l !== label.name);
                                            } else {
                                                vnode.state.formData.labels.push(label.name);
                                            }
                                        }
                                    }, [
                                        m('span.label-color', {
                                            style: { backgroundColor: label.color }
                                        }),
                                        m('span.label-name', label.name)
                                    ])
                                )) :
                                m('p.no-labels', '暂无标签')
                        ]),
                        
                        m('div.sidebar-card', [
                            m('h4', '指派给'),
                            m('p', '未指派')
                        ]),
                        
                        m('div.sidebar-card', [
                            m('h4', '项目'),
                            m('p', '无')
                        ])
                    ])
                ])
            ])
        ]);
    }
};

export { NewIssue };
