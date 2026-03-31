import { Layout, Loading, ProjectHeader, ProjectTabs, EmptyState } from '../components.js';
import { RepositoryService, TaskService, IssueService, PullRequestService } from '../api.js';

const TaskList = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.tasks = [];
        vnode.state.loading = true;
        vnode.state.statusFilter = '';
        vnode.state.priorityFilter = '';
        vnode.state.prsCount = 0;
        vnode.state.issuesCount = 0;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            TaskService.list(owner, repo),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 })
        ]).then(([repoResult, tasksResult, issuesResult, prsResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            const taskData = tasksResult.data || tasksResult;
            vnode.state.tasks = Array.isArray(taskData) ? taskData : [];
            const prData = prsResult.data || prsResult;
            vnode.state.prsCount = Array.isArray(prData) ? prData.filter(p => !p.is_closed && !p.is_merged).length : 0;
            const issuesData = issuesResult.data || issuesResult;
            vnode.state.issuesCount = Array.isArray(issuesData) ? issuesData.filter(i => !i.is_closed).length : 0;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load tasks:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, tasks, loading, statusFilter, priorityFilter } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        let filteredTasks = tasks;
        
        if (statusFilter) {
            filteredTasks = filteredTasks.filter(t => t.status === statusFilter);
        }
        
        if (priorityFilter) {
            filteredTasks = filteredTasks.filter(t => t.priority === parseInt(priorityFilter));
        }
        
        const statusLabels = {
            'draft': '初建',
            'progress': '进行',
            'review': '审核',
            'completed': '完成'
        };
        
        const priorityLabels = {
            1: '紧急',
            2: '高',
            3: '中',
            4: '低',
            5: '最低'
        };
        
        const priorityColors = {
            1: '#ff0000',
            2: '#ff8c00',
            3: '#ffd700',
            4: '#90ee90',
            5: '#87ceeb'
        };
        
        return m(Layout, [
            m(ProjectHeader, { repo, owner }),
            m(ProjectTabs, { owner, repo: repo.name, activeTab: 'tasks', issuesCount: vnode.state.issuesCount, prsCount: vnode.state.prsCount }),
            
            m('div.tasks-page', [
                m('div.tasks-header', [
                    m('div.tasks-filters', [
                        m('select.filter-select', {
                            value: statusFilter,
                            onchange: (e) => { vnode.state.statusFilter = e.target.value; }
                        }, [
                            m('option', { value: '' }, '所有状态'),
                            m('option', { value: 'draft' }, '初建'),
                            m('option', { value: 'progress' }, '进行'),
                            m('option', { value: 'review' }, '审核'),
                            m('option', { value: 'completed' }, '完成')
                        ]),
                        m('select.filter-select', {
                            value: priorityFilter,
                            onchange: (e) => { vnode.state.priorityFilter = e.target.value; }
                        }, [
                            m('option', { value: '' }, '所有优先级'),
                            m('option', { value: '1' }, '紧急'),
                            m('option', { value: '2' }, '高'),
                            m('option', { value: '3' }, '中'),
                            m('option', { value: '4' }, '低'),
                            m('option', { value: '5' }, '最低')
                        ])
                    ]),
                    m('button.btn.btn-primary', {
                        onclick: () => { m.route.set(`/tasks/${owner}/${repo.name}/new`); }
                    }, [
                        m('i.fas.fa-plus'),
                        ' 新建任务'
                    ])
                ]),
                
                filteredTasks.length === 0 ? 
                    m(EmptyState, { 
                        message: '没有任务', 
                        icon: 'fa-tasks' 
                    }) :
                    m('div.task-list', filteredTasks.map(task => 
                        m('div.task-item', {
                            onclick: () => { m.route.set(`/tasks/${owner}/${repo.name}/${task.id}`); }
                        }, [
                            m('div.task-priority', {
                                style: { backgroundColor: priorityColors[task.priority] }
                            }),
                            task.preview_image ? m('div.task-preview', [
                                m('img', { src: task.preview_image, alt: task.title })
                            ]) : null,
                            m('div.task-content', [
                                m('div.task-title-row', [
                                    m('span.task-status-badge', { 
                                        class: task.status 
                                    }, statusLabels[task.status] || task.status),
                                    m('h4.task-title', task.title)
                                ]),
                                m('div.task-meta', [
                                    m('span', `优先级: ${priorityLabels[task.priority]}`),
                                    m('span', `发起人: ${task.initiator}`),
                                    task.handler ? m('span', `处理人: ${task.handler}`) : null,
                                    m('span', `创建于 ${formatTime(task.created_at)}`)
                                ])
                            ])
                        ])
                    ))
            ])
        ]);
    }
};

function formatTime(timeStr) {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return date.toLocaleDateString('zh-CN');
}

export { TaskList };
