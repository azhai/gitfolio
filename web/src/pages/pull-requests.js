import { Layout, Loading, ProjectHeader, ProjectTabs, EmptyState, PRItem } from '../components.js';
import { RepositoryService, IssueService, PullRequestService } from '../api.js';
import { CreatePRModal } from '../modals.js';

const PullRequestList = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.prs = [];
        vnode.state.loading = true;
        vnode.state.filter = 'open';
        vnode.state.issuesCount = 0;
        vnode.state.showCreateModal = false;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            PullRequestService.list(owner, repo),
            IssueService.list(owner, repo)
        ]).then(([repoResult, prsResult, issuesResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.prs = prsResult.data || prsResult || [];
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load pull requests:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, prs, loading, filter, showCreateModal } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        const openPRs = prs.filter(p => !p.is_closed && !p.is_merged);
        const mergedPRs = prs.filter(p => p.is_merged);
        const closedPRs = prs.filter(p => p.is_closed && !p.is_merged);
        
        let filteredPRs = [];
        if (filter === 'open') filteredPRs = openPRs;
        else if (filter === 'merged') filteredPRs = mergedPRs;
        else if (filter === 'closed') filteredPRs = closedPRs;
        
        return m(Layout, [
            m('div.pull-requests-page', [
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
                    issuesCount: vnode.state.issuesCount,
                    prsCount: openPRs.length,
                    activeTab: 'prs'
                }),
                
                m('div.pull-requests-content', [
                    m('div.pull-requests-toolbar', [
                        m('div.filter-tabs', [
                            m('button.filter-tab', {
                                class: filter === 'open' ? 'active' : '',
                                onclick: () => { vnode.state.filter = 'open'; }
                            }, [
                                m('i.fas.fa-code-branch.open'),
                                ` ${openPRs.length} 个开启`
                            ]),
                            m('button.filter-tab', {
                                class: filter === 'merged' ? 'active' : '',
                                onclick: () => { vnode.state.filter = 'merged'; }
                            }, [
                                m('i.fas.fa-code-branch.merged'),
                                ` ${mergedPRs.length} 个已合并`
                            ]),
                            m('button.filter-tab', {
                                class: filter === 'closed' ? 'active' : '',
                                onclick: () => { vnode.state.filter = 'closed'; }
                            }, [
                                m('i.fas.fa-times-circle.closed'),
                                ` ${closedPRs.length} 个已关闭`
                            ])
                        ]),
                        m('button.btn.btn-primary', {
                            onclick: () => { vnode.state.showCreateModal = true; }
                        }, [
                            m('i.fas.fa-plus'),
                            ' 新建 PR'
                        ])
                    ]),
                    
                    filteredPRs.length === 0 
                        ? m(EmptyState, { 
                            message: filter === 'open' ? '暂无开启的 PR' : 
                                     filter === 'merged' ? '暂无已合并的 PR' : '暂无已关闭的 PR',
                            icon: 'fa-code-branch'
                        })
                        : m('div.pull-requests-list', filteredPRs.map(pr => 
                            m(PRItem, { pr, owner, repo: repo.name })
                        ))
                ])
            ]),
            
            m(CreatePRModal, {
                isOpen: showCreateModal,
                onClose: () => { vnode.state.showCreateModal = false; },
                onSubmit: (formData) => {
                    return PullRequestService.create(owner, repo.name, formData).then(result => {
                        vnode.state.prs.unshift(result.data || result);
                        vnode.state.showCreateModal = false;
                        m.redraw();
                    });
                },
                owner,
                repo: repo.name,
                branches: ['main', 'develop', 'feature-branch']
            })
        ]);
    }
};

export { PullRequestList };
