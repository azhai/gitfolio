import { Layout, Loading, EmptyState, ProjectCard, IssueItem, MRItem } from '../components.js';
import { RepositoryService, IssueService, MergeRequestService } from '../api.js';

const Dashboard = {
    oninit(vnode) {
        vnode.state.projects = [];
        vnode.state.issues = [];
        vnode.state.mrs = [];
        vnode.state.loading = true;
        
        Promise.all([
            RepositoryService.list(),
            IssueService.list(),
            MergeRequestService.list()
        ]).then(([projects, issues, mrs]) => {
            vnode.state.projects = projects.data || [];
            vnode.state.issues = issues.data || [];
            vnode.state.mrs = mrs.data || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load dashboard data:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { projects, issues, mrs, loading } = vnode.state;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        return m(Layout, [
            m('div.dashboard', [
                m('div.dashboard-header', [
                    m('h1', '仪表盘'),
                    m('p', '欢迎回来，ryan！')
                ]),
                
                m('div.dashboard-grid', [
                    m('div.dashboard-section', [
                        m('h2', [
                            m('i.fas.fa-folder'),
                            ' 最近项目'
                        ]),
                        projects.length === 0 
                            ? m(EmptyState, { message: '暂无项目' })
                            : m('div.project-list', projects.slice(0, 5).map(project => 
                                m(ProjectCard, { project })
                            ))
                    ]),
                    
                    m('div.dashboard-section', [
                        m('h2', [
                            m('i.fas.fa-exclamation-circle'),
                            ' 最近 Issue'
                        ]),
                        issues.length === 0 
                            ? m(EmptyState, { message: '暂无 Issue' })
                            : m('div.issue-list', issues.slice(0, 5).map(issue => 
                                m(IssueItem, { issue })
                            ))
                    ]),
                    
                    m('div.dashboard-section', [
                        m('h2', [
                            m('i.fas.fa-code-branch'),
                            ' 最近合并请求'
                        ]),
                        mrs.length === 0 
                            ? m(EmptyState, { message: '暂无合并请求' })
                            : m('div.mr-list', mrs.slice(0, 5).map(mr => 
                                m(MRItem, { mr })
                            ))
                    ])
                ])
            ])
        ]);
    }
};

export { Dashboard };
