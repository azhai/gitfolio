const ReleasesPage = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.loading = true;
        
        RepositoryService.get(owner, repo).then(result => {
            vnode.state.repo = result.data || result;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load project:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, loading } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        return m(Layout, [
            m('div.releases-page', [
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
                    activeTab: 'releases'
                }),
                
                m('div.releases-content', [
                    m('div.releases-header', [
                        m('h1', '发布'),
                        m('button.btn.btn-primary', [
                            m('i.fas.fa-plus'),
                            ' 新建发布'
                        ])
                    ]),
                    
                    m('div.release-card', [
                        m('div.release-header', [
                            m('div.release-info', [
                                m('div.release-title-row', [
                                    m('h2.release-title', m('a', { href: '#' }, 'v1.0.0')),
                                    m('span.release-tag.latest', '最新版本')
                                ]),
                                m('div.release-meta', [
                                    m('span.release-meta-item', [
                                        m('i.fas.fa-tag'),
                                        ' v1.0.0'
                                    ]),
                                    m('span.release-meta-item', [
                                        m('i.fas.fa-code-branch'),
                                        ' main'
                                    ]),
                                    m('span.release-meta-item', [
                                        m('i.fas.fa-clock'),
                                        ' 初始发布'
                                    ])
                                ])
                            ])
                        ]),
                        m('div.release-body', [
                            m('div.release-notes', [
                                m('h3', '🎉 初始发布'),
                                m('p', '这是项目的第一个正式发布版本。'),
                                m('h3', '✨ 功能特性'),
                                m('ul', [
                                    m('li', '基础功能实现'),
                                    m('li', '用户界面完善'),
                                    m('li', 'API 接口开发')
                                ])
                            ])
                        ])
                    ]),
                    
                    m(EmptyState, { 
                        message: '暂无更多发布版本', 
                        icon: 'fa-cube' 
                    })
                ])
            ])
        ]);
    }
};

const StatsPage = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.loading = true;
        
        RepositoryService.get(owner, repo).then(result => {
            vnode.state.repo = result.data || result;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load project:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, loading } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        return m(Layout, [
            m('div.stats-page', [
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
                    activeTab: 'stats'
                }),
                
                m('div.stats-content', [
                    m('h1', '统计'),
                    
                    m('div.stats-grid', [
                        m('div.stat-card', [
                            m('div.stat-icon', m('i.fas.fa-star')),
                            m('div.stat-info', [
                                m('div.stat-value', repo.stars_count || 0),
                                m('div.stat-label', '星标')
                            ])
                        ]),
                        m('div.stat-card', [
                            m('div.stat-icon', m('i.fas.fa-code-branch')),
                            m('div.stat-info', [
                                m('div.stat-value', repo.forks_count || 0),
                                m('div.stat-label', 'Fork')
                            ])
                        ]),
                        m('div.stat-card', [
                            m('div.stat-icon', m('i.fas.fa-eye')),
                            m('div.stat-info', [
                                m('div.stat-value', repo.watch_count || 0),
                                m('div.stat-label', '关注')
                            ])
                        ]),
                        m('div.stat-card', [
                            m('div.stat-icon', m('i.fas.fa-exclamation-circle')),
                            m('div.stat-info', [
                                m('div.stat-value', '0'),
                                m('div.stat-label', 'Issue')
                            ])
                        ])
                    ]),
                    
                    m('div.stats-section', [
                        m('h2', '贡献者'),
                        m('div.contributors-list', [
                            m('div.contributor-item', [
                                m('img.avatar', { src: 'https://via.placeholder.com/40', alt: '贡献者' }),
                                m('div.contributor-info', [
                                    m('div.contributor-name', 'ryan'),
                                    m('div.contributor-stats', '10 commits')
                                ])
                            ])
                        ])
                    ])
                ])
            ])
        ]);
    }
};

export { ReleasesPage, StatsPage };
