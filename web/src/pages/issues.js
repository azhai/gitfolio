import { Layout, Loading, ProjectHeader, ProjectTabs, EmptyState, IssueItem } from '../components.js';
import { RepositoryService, IssueService, MergeRequestService } from '../api.js';
import { CreateIssueModal } from '../modals.js';

const IssueList = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.issues = [];
        vnode.state.loading = true;
        vnode.state.filter = 'open';
        vnode.state.mrsCount = 0;
        vnode.state.showCreateModal = false;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo),
            MergeRequestService.list(owner, repo)
        ]).then(([repoResult, issuesResult, mrsResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issues = issuesResult.data || issuesResult || [];
            vnode.state.mrsCount = (mrsResult.data || mrsResult || []).filter(m => !m.is_closed && !m.is_merged).length;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load issues:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, issues, loading, filter, showCreateModal } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        const filteredIssues = issues.filter(issue => {
            if (filter === 'open') return !issue.is_closed;
            if (filter === 'closed') return issue.is_closed;
            return true;
        });
        
        const openCount = issues.filter(i => !i.is_closed).length;
        const closedCount = issues.filter(i => i.is_closed).length;
        
        return m(Layout, [
            m(ProjectHeader, { repo, owner }),
            m(ProjectTabs, { owner, repo: repo.name, activeTab: 'issues', issuesCount: openCount, mrsCount: vnode.state.mrsCount }),
            
            m('div.issues-page', [
                m('div.issues-header', [
                    m('div.issues-filters', [
                        m('button.filter-btn', {
                            class: filter === 'open' ? 'active' : '',
                            onclick: () => { vnode.state.filter = 'open'; }
                        }, [
                            m('i.fas.fa-exclamation-circle.open'),
                            ` ${openCount} 个开启`
                        ]),
                        m('button.filter-btn', {
                            class: filter === 'closed' ? 'active' : '',
                            onclick: () => { vnode.state.filter = 'closed'; }
                        }, [
                            m('i.fas.fa-check-circle.closed'),
                            ` ${closedCount} 个已关闭`
                        ])
                    ]),
                    m('button.btn.btn-primary', {
                        onclick: () => { vnode.state.showCreateModal = true; }
                    }, [
                        m('i.fas.fa-plus'),
                        ' 新建 Issue'
                    ])
                ]),
                
                filteredIssues.length === 0 ? 
                    m(EmptyState, { 
                        message: filter === 'open' ? '没有开启的Issue' : '没有已关闭的Issue', 
                        icon: 'fa-inbox' 
                    }) :
                    m('div.issue-list', filteredIssues.map(issue => 
                        m(IssueItem, { issue, owner, repo: repo.name })
                    ))
            ]),
            
            m(CreateIssueModal, {
                isOpen: showCreateModal,
                onClose: () => { vnode.state.showCreateModal = false; },
                onSubmit: (formData) => {
                    return IssueService.create(owner, repo.name, formData).then(result => {
                        vnode.state.issues.unshift(result.data || result);
                        vnode.state.showCreateModal = false;
                        m.redraw();
                    });
                },
                owner,
                repo: repo.name
            })
        ]);
    }
};

export { IssueList };
