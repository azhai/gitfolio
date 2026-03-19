import { Layout, Loading, ProjectHeader, ProjectTabs, EmptyState, MRItem } from '../components.js';
import { RepositoryService, MergeRequestService } from '../api.js';
import { CreateMRModal } from '../modals.js';

const MergeRequestList = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.mrs = [];
        vnode.state.loading = true;
        vnode.state.filter = 'open';
        vnode.state.issuesCount = 0;
        vnode.state.showCreateModal = false;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            MergeRequestService.list(owner, repo)
        ]).then(([repoResult, mrsResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.mrs = mrsResult.data || mrsResult || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load merge requests:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, mrs, loading, filter, showCreateModal } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        const openMRs = mrs.filter(m => !m.is_closed && !m.is_merged);
        const mergedMRs = mrs.filter(m => m.is_merged);
        const closedMRs = mrs.filter(m => m.is_closed && !m.is_merged);
        
        let filteredMRs = [];
        if (filter === 'open') filteredMRs = openMRs;
        else if (filter === 'merged') filteredMRs = mergedMRs;
        else if (filter === 'closed') filteredMRs = closedMRs;
        
        return m(Layout, [
            m('div.merge-requests-page', [
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
                    issuesCount: 0,
                    mrsCount: openMRs.length,
                    activeTab: 'mrs'
                }),
                
                m('div.merge-requests-content', [
                    m('div.merge-requests-toolbar', [
                        m('div.filter-tabs', [
                            m('button.filter-tab', {
                                class: filter === 'open' ? 'active' : '',
                                onclick: () => { vnode.state.filter = 'open'; }
                            }, [
                                m('i.fas.fa-code-branch.open'),
                                ` ${openMRs.length} 个开启`
                            ]),
                            m('button.filter-tab', {
                                class: filter === 'merged' ? 'active' : '',
                                onclick: () => { vnode.state.filter = 'merged'; }
                            }, [
                                m('i.fas.fa-code-branch.merged'),
                                ` ${mergedMRs.length} 个已合并`
                            ]),
                            m('button.filter-tab', {
                                class: filter === 'closed' ? 'active' : '',
                                onclick: () => { vnode.state.filter = 'closed'; }
                            }, [
                                m('i.fas.fa-times-circle.closed'),
                                ` ${closedMRs.length} 个已关闭`
                            ])
                        ]),
                        m('button.btn.btn-primary', {
                            onclick: () => { vnode.state.showCreateModal = true; }
                        }, [
                            m('i.fas.fa-plus'),
                            ' 新建合并请求'
                        ])
                    ]),
                    
                    filteredMRs.length === 0 
                        ? m(EmptyState, { 
                            message: filter === 'open' ? '暂无开启的合并请求' : 
                                     filter === 'merged' ? '暂无已合并的合并请求' : '暂无已关闭的合并请求',
                            icon: 'fa-code-branch'
                        })
                        : m('div.merge-requests-list', filteredMRs.map(mr => 
                            m(MRItem, { mr, owner, repo: repo.name })
                        ))
                ])
            ]),
            
            m(CreateMRModal, {
                isOpen: showCreateModal,
                onClose: () => { vnode.state.showCreateModal = false; },
                onSubmit: (formData) => {
                    return MergeRequestService.create(owner, repo.name, formData).then(result => {
                        vnode.state.mrs.unshift(result.data || result);
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

export { MergeRequestList };
