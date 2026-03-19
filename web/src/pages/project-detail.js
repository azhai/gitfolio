import { Layout, Loading, ProjectHeader, ProjectTabs, EmptyState } from '../components.js';
import { RepositoryService, IssueService, MergeRequestService } from '../api.js';
import { formatTime } from './dashboard.js';

const ProjectDetail = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.issuesCount = 0;
        vnode.state.mrsCount = 0;
        vnode.state.loading = true;
        vnode.state.currentPath = '';
        vnode.state.currentBranch = 'main';
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo),
            MergeRequestService.list(owner, repo)
        ]).then(([repoResult, issuesResult, mrsResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.mrsCount = (mrsResult.data || mrsResult || []).filter(m => !m.is_closed && !m.is_merged).length;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load project:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, issuesCount, mrsCount, loading, currentPath, currentBranch } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        const fileTree = getFileTree(repoName);
        const files = fileTree[currentPath] || [];
        
        return m(Layout, [
            m('div.project-detail-page', [
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
                    issuesCount: issuesCount,
                    mrsCount: mrsCount,
                    activeTab: 'code'
                }),
                
                m('div.project-layout', [
                    m('div.main-content', [
                        m('div.file-browser', [
                            m('div.file-browser-header', [
                                m('div.branch-selector', [
                                    m('div.branch-dropdown', {
                                        onclick: (e) => {
                                            const menu = document.getElementById('branch-menu');
                                            if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                                        }
                                    }, [
                                        m('i.fas.fa-code-branch'),
                                        m('span', currentBranch),
                                        m('i.fas.fa-chevron-down')
                                    ]),
                                    m('div.branch-menu#branch-menu', { style: { display: 'none' } }, [
                                        m('div.branch-menu-header', '切换分支'),
                                        m('div.branch-option', {
                                            class: currentBranch === 'main' ? 'active' : '',
                                            onclick: () => { vnode.state.currentBranch = 'main'; }
                                        }, [
                                            m('i.fas.fa-check', { style: { visibility: currentBranch === 'main' ? 'visible' : 'hidden' } }),
                                            'main'
                                        ]),
                                        m('div.branch-option', {
                                            class: currentBranch === 'develop' ? 'active' : '',
                                            onclick: () => { vnode.state.currentBranch = 'develop'; }
                                        }, [
                                            m('i.fas.fa-check', { style: { visibility: currentBranch === 'develop' ? 'visible' : 'hidden' } }),
                                            'develop'
                                        ])
                                    ])
                                ]),
                                m('div.file-actions', [
                                    m('button.btn.btn-sm', [
                                        m('i.fas.fa-plus'),
                                        ' 添加文件'
                                    ]),
                                    m('button.btn.btn-sm', [
                                        m('i.fas.fa-download'),
                                        ' 下载'
                                    ])
                                ])
                            ]),
                            
                            m('div.path-breadcrumb', renderBreadcrumb(owner, repo.name, currentPath)),
                            
                            m('div.commit-info', [
                                m('img.commit-info-avatar', { src: 'https://via.placeholder.com/24', alt: '提交者' }),
                                m('div.commit-info-message', [
                                    m('a', { href: '#' }, '初始提交'),
                                    m('span.commit-info-meta', '· 提交于最近')
                                ]),
                                m('span.commit-info-hash', 'initial')
                            ]),
                            
                            files.length === 0 
                                ? m(EmptyState, { message: '此目录为空', icon: 'fa-folder-open' })
                                : m('div.file-list', files.map(file => 
                                    m(FileItem, { 
                                        file, 
                                        owner, 
                                        repo: repo.name,
                                        currentPath,
                                        onNavigate: (path) => { vnode.state.currentPath = path; }
                                    })
                                ))
                        ]),
                        
                        repo.readme ? m('div.readme-section', [
                            m('div.readme-header', [
                                m('i.fas.fa-book'),
                                ' README.md'
                            ]),
                            m('div.readme-content', {
                                oncreate: (vnode) => {
                                    if (typeof marked !== 'undefined') {
                                        vnode.dom.innerHTML = marked.parse(repo.readme);
                                    } else {
                                        vnode.dom.textContent = repo.readme;
                                    }
                                }
                            })
                        ]) : null
                    ]),
                    
                    m('div.sidebar-info', [
                        m('div.info-card', [
                            m('h3', [ m('i.fas.fa-download'), ' 克隆' ]),
                            m('div.clone-box', [
                                m('input.clone-url[type=text]', { 
                                    value: `https://git.home504.io/${owner}/${repo.name}.git`,
                                    readonly: true
                                }),
                                m('button.clone-btn', {
                                    onclick: () => copyToClipboard(`https://git.home504.io/${owner}/${repo.name}.git`)
                                }, m('i.fas.fa-copy'))
                            ])
                        ]),
                        
                        m('div.info-card', [
                            m('h3', [ m('i.fas.fa-eye'), ' 关注' ]),
                            m('div.stat-row', [
                                m('span.stat-label', '星标'),
                                m('span.stat-value', repo.stars_count || 0)
                            ]),
                            m('div.stat-row', [
                                m('span.stat-label', 'Fork'),
                                m('span.stat-value', repo.forks_count || 0)
                            ]),
                            m('div.stat-row', [
                                m('span.stat-label', '关注'),
                                m('span.stat-value', repo.watch_count || 0)
                            ])
                        ])
                    ])
                ])
            ])
        ]);
    }
};

const FileItem = {
    view(vnode) {
        const { file, owner, repo, currentPath, onNavigate } = vnode.attrs;
        const newPath = currentPath ? `${currentPath}/${file.name}` : file.name;
        
        return m('div.file-item', {
            onclick: () => {
                if (file.type === 'folder') {
                    onNavigate(newPath);
                }
            },
            style: { cursor: file.type === 'folder' ? 'pointer' : 'default' }
        }, [
            m('span.file-icon', { class: file.type === 'folder' ? 'folder' : '' }, [
                m(`i.fas.${file.type === 'folder' ? 'fa-folder' : 'fa-file-code'}`)
            ]),
            m('span.file-name', 
                file.type === 'folder' 
                    ? m('a', { href: '#', onclick: (e) => { e.preventDefault(); onNavigate(newPath); } }, file.name)
                    : file.name
            ),
            m('span.file-commit-message', file.message),
            m('span.file-commit-time', file.time)
        ]);
    }
};

function renderBreadcrumb(owner, repo, currentPath) {
    const parts = currentPath ? currentPath.split('/') : [];
    
    let html = m('a', { href: `/project/${owner}/${repo}`, oncreate: m.route.link }, [
        m('i.fas.fa-folder'),
        ` ${repo}`
    ]);
    
    if (parts.length === 0) return html;
    
    return [html, ...parts.map((part, index) => {
        const path = parts.slice(0, index + 1).join('/');
        return [
            m('span', ' / '),
            m('a', { href: '#', onclick: (e) => { e.preventDefault(); /* navigate to path */ } }, part)
        ];
    })];
}

function getFileTree(repoName) {
    const trees = {
        'builder': {
            '': [
                { name: 'builder.go', type: 'file', message: 'Add core builder functions', time: '2 months ago' },
                { name: 'cond.go', type: 'file', message: 'Add condition builders', time: '3 months ago' },
                { name: 'select.go', type: 'file', message: 'Implement SELECT builder', time: '3 months ago' },
                { name: 'insert.go', type: 'file', message: 'Implement INSERT builder', time: '3 months ago' },
                { name: 'update.go', type: 'file', message: 'Implement UPDATE builder', time: '3 months ago' },
                { name: 'delete.go', type: 'file', message: 'Implement DELETE builder', time: '3 months ago' },
                { name: 'go.mod', type: 'file', message: 'Update dependencies', time: '1 month ago' },
                { name: 'go.sum', type: 'file', message: 'Update dependencies', time: '1 month ago' },
                { name: 'README.md', type: 'file', message: 'Update documentation', time: '2 weeks ago' },
                { name: 'LICENSE', type: 'file', message: 'Add MIT license', time: '1 year ago' }
            ]
        },
        'gx': {
            '': [
                { name: 'cmd', type: 'folder', message: 'Add CLI commands', time: '1 week ago' },
                { name: 'find', type: 'folder', message: 'Implement find command', time: '2 weeks ago' },
                { name: 'replace', type: 'folder', message: 'Implement replace command', time: '2 weeks ago' },
                { name: 'rename', type: 'folder', message: 'Implement rename command', time: '2 weeks ago' },
                { name: 'go.mod', type: 'file', message: 'Update dependencies', time: '3 days ago' },
                { name: 'README.md', type: 'file', message: 'Update documentation', time: '1 week ago' }
            ],
            'cmd': [
                { name: 'root.go', type: 'file', message: 'Add root command', time: '1 week ago' },
                { name: 'find.go', type: 'file', message: 'Add find command', time: '1 week ago' },
                { name: 'replace.go', type: 'file', message: 'Add replace command', time: '1 week ago' },
                { name: 'rename.go', type: 'file', message: 'Add rename command', time: '1 week ago' }
            ],
            'find': [
                { name: 'finder.go', type: 'file', message: 'Implement finder', time: '2 weeks ago' },
                { name: 'search.go', type: 'file', message: 'Implement search', time: '2 weeks ago' }
            ],
            'replace': [
                { name: 'replacer.go', type: 'file', message: 'Implement replacer', time: '2 weeks ago' }
            ],
            'rename': [
                { name: 'renamer.go', type: 'file', message: 'Implement renamer', time: '2 weeks ago' }
            ]
        }
    };
    
    return trees[repoName] || {};
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('已复制到剪贴板');
    });
}

export { ProjectDetail };
