import { Layout, Loading, ProjectHeader, ProjectTabs, EmptyState } from '../components.js';
import { RepositoryService, IssueService, MergeRequestService } from '../api.js';

const getLanguageFromPath = (path) => {
    const ext = path.split('.').pop().toLowerCase();
    const langMap = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'py': 'python',
        'rb': 'ruby',
        'go': 'go',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'cc': 'cpp',
        'cxx': 'cpp',
        'h': 'c',
        'hpp': 'cpp',
        'cs': 'csharp',
        'php': 'php',
        'swift': 'swift',
        'kt': 'kotlin',
        'rs': 'rust',
        'sh': 'bash',
        'bash': 'bash',
        'zsh': 'bash',
        'ps1': 'powershell',
        'html': 'html',
        'htm': 'html',
        'css': 'css',
        'scss': 'scss',
        'sass': 'sass',
        'less': 'less',
        'json': 'json',
        'xml': 'xml',
        'yaml': 'yaml',
        'yml': 'yaml',
        'md': 'markdown',
        'sql': 'sql',
        'vue': 'vue',
        'svelte': 'svelte',
        'dockerfile': 'dockerfile',
        'makefile': 'makefile',
        'toml': 'toml',
        'ini': 'ini',
        'cfg': 'ini',
        'conf': 'nginx',
        'nginx': 'nginx',
        'apache': 'apache',
        'diff': 'diff',
        'patch': 'diff'
    };
    return langMap[ext] || null;
};

const highlightFile = (code, path) => {
    if (typeof hljs === 'undefined') {
        return code;
    }
    
    const language = getLanguageFromPath(path);
    if (language && hljs.getLanguage(language)) {
        try {
            return hljs.highlight(code, { language: language }).value;
        } catch (e) {
            console.error('Highlight error:', e);
        }
    }
    
    try {
        return hljs.highlightAuto(code).value;
    } catch (e) {
        console.error('Auto-highlight error:', e);
    }
    
    return code;
};

const ProjectDetail = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.issuesCount = 0;
        vnode.state.mrsCount = 0;
        vnode.state.loading = true;
        vnode.state.currentPath = '';
        vnode.state.currentBranch = 'HEAD';
        vnode.state.branches = [];
        vnode.state.treeEntries = [];
        vnode.state.fileContent = null;
        vnode.state.showBranchMenu = false;
        
        vnode.state.loadBranches = function() {
            RepositoryService.getBranches(owner, repo).then(result => {
                vnode.state.branches = result.branches || [];
                m.redraw();
            }).catch(() => {});
        };
        
        vnode.state.loadTree = function() {
            vnode.state.fileContent = null;
            RepositoryService.getTree(owner, repo, vnode.state.currentPath, vnode.state.currentBranch).then(result => {
                vnode.state.treeEntries = result.entries || [];
                m.redraw();
            }).catch(() => {
                vnode.state.treeEntries = [];
                m.redraw();
            });
        };
        
        vnode.state.loadFile = function(path) {
            RepositoryService.getFile(owner, repo, path, vnode.state.currentBranch).then(result => {
                vnode.state.fileContent = result.content;
                m.redraw();
            }).catch(() => {
                vnode.state.fileContent = null;
                m.redraw();
            });
        };
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo),
            MergeRequestService.list(owner, repo)
        ]).then(([repoResult, issuesResult, mrsResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.mrsCount = (mrsResult.data || mrsResult || []).filter(m => !m.is_closed && !m.is_merged).length;
            vnode.state.loading = false;
            vnode.state.loadBranches();
            vnode.state.loadTree();
            m.redraw();
        }).catch(error => {
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, issuesCount, mrsCount, loading, currentPath, currentBranch, branches, treeEntries, fileContent, showBranchMenu } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
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
                                            vnode.state.showBranchMenu = !vnode.state.showBranchMenu;
                                        }
                                    }, [
                                        m('i.fas.fa-code-branch'),
                                        m('span', currentBranch === 'HEAD' ? (repo.default_branch || 'main') : currentBranch),
                                        m('i.fas.fa-chevron-down')
                                    ]),
                                    showBranchMenu ? m('div.branch-menu', [
                                        m('div.branch-menu-header', '切换分支'),
                                        branches.map(branch => 
                                            m('div.branch-option', {
                                                class: currentBranch === branch ? 'active' : '',
                                                onclick: () => { 
                                                    vnode.state.currentBranch = branch;
                                                    vnode.state.showBranchMenu = false;
                                                    vnode.state.loadTree();
                                                }
                                            }, [
                                                m('i.fas.fa-check', { style: { visibility: currentBranch === branch ? 'visible' : 'hidden' } }),
                                                branch
                                            ])
                                        )
                                    ]) : null
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
                            
                            m('div.path-breadcrumb', renderBreadcrumb(owner, repo.name, currentPath, (path) => {
                                vnode.state.currentPath = path;
                                vnode.state.loadTree();
                            })),
                            
                            fileContent !== null ? [
                                m('div.file-content-header', [
                                    m('span', currentPath.split('/').pop()),
                                    m('button.btn.btn-sm', { onclick: () => { vnode.state.fileContent = null; } }, '返回')
                                ]),
                                m('pre.file-content', [
                                    m('code', {
                                        class: 'hljs',
                                        oncreate: (vnode) => {
                                            const highlighted = highlightFile(fileContent, currentPath);
                                            vnode.dom.innerHTML = highlighted;
                                        }
                                    }, fileContent)
                                ])
                            ] : [
                                treeEntries.length === 0 
                                    ? m(EmptyState, { message: repo.local_path ? '此目录为空' : '仓库未初始化，请先同步代码', icon: 'fa-folder-open' })
                                    : m('div.file-list', treeEntries.map(entry => 
                                        m(TreeEntry, { 
                                            entry, 
                                            owner, 
                                            repo: repo.name,
                                            currentPath,
                                            onNavigate: (path, isFile) => {
                                                if (isFile) {
                                                    vnode.state.loadFile(path);
                                                } else {
                                                    vnode.state.currentPath = path;
                                                    vnode.state.loadTree();
                                                }
                                            }
                                        })
                                    ))
                            ]
                        ])
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

const TreeEntry = {
    view(vnode) {
        const { entry, owner, repo, currentPath, onNavigate } = vnode.attrs;
        const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        const isTree = entry.type === 'tree';
        
        return m('div.file-item', {
            onclick: () => onNavigate(newPath, !isTree),
            style: { cursor: 'pointer' }
        }, [
            m('span.file-icon', { class: isTree ? 'folder' : '' }, [
                m(`i.fas.${isTree ? 'fa-folder' : 'fa-file-code'}`)
            ]),
            m('span.file-name', entry.name),
            m('span.file-commit-message', entry.hash ? entry.hash.substring(0, 7) : ''),
            m('span.file-commit-time', entry.size && !isTree ? formatSize(entry.size) : '')
        ]);
    }
};

function formatSize(size) {
    const s = parseInt(size);
    if (isNaN(s) || s < 0) return '';
    if (s < 1024) return s + ' B';
    if (s < 1024 * 1024) return (s / 1024).toFixed(1) + ' KB';
    return (s / 1024 / 1024).toFixed(1) + ' MB';
}

function renderBreadcrumb(owner, repo, currentPath, onNavigate) {
    const parts = currentPath ? currentPath.split('/').filter(p => p) : [];
    
    let elements = [
        m('a', { 
            href: '#', 
            onclick: (e) => { e.preventDefault(); onNavigate(''); } 
        }, [
            m('i.fas.fa-folder'),
            ` ${repo}`
        ])
    ];
    
    parts.forEach((part, index) => {
        const path = parts.slice(0, index + 1).join('/');
        elements.push(m('span', ' / '));
        elements.push(m('a', { 
            href: '#', 
            onclick: (e) => { e.preventDefault(); onNavigate(path); } 
        }, part));
    });
    
    return elements;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('已复制到剪贴板');
    });
}

export { ProjectDetail };
