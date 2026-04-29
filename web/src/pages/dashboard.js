import { Layout, Loading, EmptyState, ProjectCard, IssueItem, PRItem } from '../components.js';
import { RepositoryService, IssueService, PullRequestService } from '../api.js';

const Dashboard = {
    oninit(vnode) {
        vnode.state.projects = [];
        vnode.state.issues = [];
        vnode.state.prs = [];
        vnode.state.loading = true;

        const loadProjects = RepositoryService.list()
            .then(res => { vnode.state.projects = res.data || []; })
            .catch(err => { console.error('Failed to load projects:', err); });

        const loadIssues = IssueService.list()
            .then(res => { vnode.state.issues = res.data || []; })
            .catch(err => { console.error('Failed to load issues:', err); });

        const loadPRs = PullRequestService.list()
            .then(res => { vnode.state.prs = res.data || []; })
            .catch(err => { console.error('Failed to load PRs:', err); });

        Promise.allSettled([loadProjects, loadIssues, loadPRs]).then(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { projects, issues, prs, loading } = vnode.state;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        return m(Layout, [
            m('div.dashboard', [
                m('div.dashboard-header', [
                    m('h1', '总览'),
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
                            : m('div.project-list', projects.slice(0, 10).map(project => 
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
                            : m('div.issue-list', issues.slice(0, 10).map(issue => 
                                m(IssueItem, { issue })
                            ))
                    ]),
                    
                    m('div.dashboard-section', [
                        m('h2', [
                            m('i.fas.fa-code-branch'),
                            ' 最近 PR'
                        ]),
                        prs.length === 0 
                            ? m(EmptyState, { message: '暂无 PR' })
                            : m('div.pr-list', prs.slice(0, 10).map(pr => 
                                m(PRItem, { pr })
                            ))
                    ])
                ])
            ])
        ]);
    }
};

export { Dashboard };