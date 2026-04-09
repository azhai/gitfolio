import { Layout, Loading, ProjectHeader, ProjectTabs, MarkdownEditor } from '../components.js';
import { RepositoryService, PullRequestService, IssueService, TaskService } from '../api.js';

const NewPullRequest = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.loading = true;
        vnode.state.submitting = false;
        vnode.state.prsCount = 0;
        vnode.state.issuesCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.branches = ['main', 'develop'];
        vnode.state.formData = {
            title: '',
            body: '',
            source_branch: 'develop',
            target_branch: 'main'
        };
        
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
    
    handleSubmit(vnode) {
        const { owner, repo } = vnode.attrs;
        const { formData, submitting } = vnode.state;
        
        if (submitting) return;
        
        if (!formData.title.trim()) {
            alert('标题不能为空');
            return;
        }
        
        if (formData.source_branch === formData.target_branch) {
            alert('源分支和目标分支不能相同');
            return;
        }
        
        vnode.state.submitting = true;
        
        PullRequestService.create(owner, repo, formData).then(result => {
            const pr = result.data || result;
            m.route.set(`/pull-requests/${owner}/${repo}/${pr.number}`);
        }).catch(error => {
            vnode.state.submitting = false;
            alert('创建 PR 失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },
    
    view(vnode) {
        const { owner, repo: repoName } = vnode.attrs;
        const { repo, loading, submitting, formData, issuesCount, prsCount, branches } = vnode.state;
        
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
                activeTab: 'prs'
            }),
            
            m('div.new-pr-page', [
                m('div.breadcrumb', [
                    m('a', { href: '/', oncreate: m.route.link }, '首页'),
                    ' / ',
                    m('a', { href: `/pull-requests/${owner}/${repo.name}`, oncreate: m.route.link }, 'Pull Requests'),
                    ' / 新建'
                ]),
                
                m('div.new-pr-container', [
                    m('div.new-pr-main', [
                        m('div.form-card', [
                            m('div.branch-selector', [
                                m('div.branch-group', [
                                    m('label', '合并'),
                                    m('select.form-input', {
                                        value: formData.source_branch,
                                        onchange: (e) => {
                                            vnode.state.formData.source_branch = e.target.value;
                                        }
                                    }, branches.map(branch => 
                                        m('option', { value: branch }, branch)
                                    ))
                                ]),
                                m('div.branch-arrow', m('i.fas.fa-arrow-right')),
                                m('div.branch-group', [
                                    m('label', '到'),
                                    m('select.form-input', {
                                        value: formData.target_branch,
                                        onchange: (e) => {
                                            vnode.state.formData.target_branch = e.target.value;
                                        }
                                    }, branches.map(branch => 
                                        m('option', { value: branch }, branch)
                                    ))
                                ])
                            ]),
                            
                            formData.source_branch === formData.target_branch ?
                                m('div.warning-message', [
                                    m('i.fas.fa-exclamation-triangle'),
                                    ' 源分支和目标分支相同，请选择不同的分支'
                                ]) : null,
                            
                            m('div.form-group', [
                                m('label.form-label', { for: 'pr-title' }, '标题'),
                                m('input#pr-title.form-input', {
                                    type: 'text',
                                    placeholder: '标题',
                                    value: formData.title,
                                    oninput: (e) => {
                                        vnode.state.formData.title = e.target.value;
                                    }
                                })
                            ]),
                            
                            m('div.form-group', [
                                m('label.form-label', { for: 'pr-body' }, '描述'),
                                m('textarea#pr-body.form-textarea', {
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
                                    onclick: () => NewPullRequest.handleSubmit(vnode),
                                    disabled: submitting || !formData.title.trim() || formData.source_branch === formData.target_branch
                                }, submitting ? '创建中...' : '创建 Pull Request'),
                                m('button.btn', {
                                    onclick: () => {
                                        m.route.set(`/pull-requests/${owner}/${repo.name}`);
                                    }
                                }, '取消')
                            ])
                        ])
                    ]),
                    
                    m('div.new-pr-sidebar', [
                        m('div.sidebar-card', [
                            m('h4', '指派给'),
                            m('p', '未指派')
                        ]),
                        
                        m('div.sidebar-card', [
                            m('h4', '标签'),
                            m('p', '暂无标签')
                        ]),
                        
                        m('div.sidebar-card', [
                            m('h4', '审查者'),
                            m('p', '无')
                        ])
                    ])
                ])
            ])
        ]);
    }
};

export { NewPullRequest };
