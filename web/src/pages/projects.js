import { Layout, Loading, EmptyState } from '../components.js';
import { RepositoryService } from '../api.js';
import { ProjectCard, formatTime } from './dashboard.js';
import { CreateProjectModal } from '../project-modals.js';

const ProjectList = {
    oninit(vnode) {
        console.log('ProjectList initializing...');
        vnode.state.projects = [];
        vnode.state.loading = true;
        vnode.state.filter = 'all';
        vnode.state.search = '';
        vnode.state.showCreateModal = false;
        
        RepositoryService.list().then(result => {
            console.log('Projects loaded:', result);
            vnode.state.projects = result.data || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load projects:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { projects, loading, filter, search, showCreateModal } = vnode.state;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        let filteredProjects = projects;
        
        if (filter === 'mine') {
            filteredProjects = projects.filter(p => p.owner === 'ryan');
        } else if (filter === 'starred') {
            filteredProjects = projects.filter(p => p.starred);
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            filteredProjects = filteredProjects.filter(p => 
                p.name.toLowerCase().includes(searchLower) ||
                (p.description && p.description.toLowerCase().includes(searchLower))
            );
        }
        
        return m(Layout, [
            m('div.projects-page', [
                m('div.page-header', [
                    m('h1', '项目'),
                    m('div.page-actions', [
                        m('button.btn.btn-primary', {
                            onclick: () => { vnode.state.showCreateModal = true; }
                        }, [
                            m('i.fas.fa-plus'),
                            ' 新建项目'
                        ])
                    ])
                ]),
                
                m('div.projects-toolbar', [
                    m('div.filter-tabs', [
                        m('button.filter-tab', {
                            class: filter === 'all' ? 'active' : '',
                            onclick: () => { vnode.state.filter = 'all'; }
                        }, '全部'),
                        m('button.filter-tab', {
                            class: filter === 'mine' ? 'active' : '',
                            onclick: () => { vnode.state.filter = 'mine'; }
                        }, '我的'),
                        m('button.filter-tab', {
                            class: filter === 'starred' ? 'active' : '',
                            onclick: () => { vnode.state.filter = 'starred'; }
                        }, '星标')
                    ]),
                    m('div.search-filter', [
                        m('i.fas.fa-search'),
                        m('input[type=text][placeholder=搜索项目...]', {
                            value: search,
                            oninput: (e) => { vnode.state.search = e.target.value; }
                        })
                    ])
                ]),
                
                filteredProjects.length === 0 
                    ? m(EmptyState, { message: '暂无项目', icon: 'fa-folder-open' })
                    : m('div.projects-grid', filteredProjects.map(project => 
                        m(ProjectCard, { project })
                    ))
            ]),
            
            m(CreateProjectModal, {
                isOpen: showCreateModal,
                onClose: () => { vnode.state.showCreateModal = false; },
                onSubmit: (formData) => {
                    return RepositoryService.create('ryan', formData).then(result => {
                        vnode.state.projects.unshift(result.data || result);
                        vnode.state.showCreateModal = false;
                        m.redraw();
                    });
                }
            })
        ]);
    }
};

export { ProjectList };
