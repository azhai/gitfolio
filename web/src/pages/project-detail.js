import { Layout, Loading, ProjectHeader, ProjectTabs, EmptyState } from '../components.js';
import { RepositoryService, IssueService, PullRequestService, TaskService } from '../api.js';

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
        vnode.state.prsCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.loading = true;
        vnode.state.currentPath = '';
        vnode.state.currentBranch = 'HEAD';
        vnode.state.branches = [];
        vnode.state.tags = [];
        vnode.state.treeEntries = [];
        vnode.state.fileContent = null;
        vnode.state.showBranchMenu = false;
        vnode.state.activeTab = 'branches';
        vnode.state.lastCommit = null;
        vnode.state.stagedFiles = [];
        vnode.state.workingFiles = [];
        vnode.state.untrackedFiles = [];
        vnode.state.isNonMirrorRepo = false;
        vnode.state.showCommitDialog = false;
        vnode.state.commitMessage = '';
        vnode.state.committing = false;
        
        const closeBranchMenu = (e) => {
            if (vnode.state.showBranchMenu) {
                const target = e.target;
                if (!target.closest('.branch-selector')) {
                    vnode.state.showBranchMenu = false;
                    m.redraw();
                }
            }
        };
        
        document.addEventListener('click', closeBranchMenu);
        
        vnode.state.cleanup = function() {
            document.removeEventListener('click', closeBranchMenu);
        };
        
        vnode.state.loadBranches = function() {
            RepositoryService.getBranches(owner, repo).then(result => {
                vnode.state.branches = result.branches || [];
                vnode.state.stagedFiles = result.staged_files || [];
                vnode.state.workingFiles = result.working_files || [];
                vnode.state.untrackedFiles = result.untracked_files || [];
                vnode.state.isNonMirrorRepo = result.staged_files !== undefined;
                m.redraw();
            }).catch(() => {});
        };
        
        vnode.state.loadTags = function() {
            RepositoryService.getTags(owner, repo).then(result => {
                vnode.state.tags = result.tags || [];
                m.redraw();
            }).catch(() => {});
        };
        
        vnode.state.loadLastCommit = function() {
            RepositoryService.getLastCommit(owner, repo, vnode.state.currentBranch).then(result => {
                vnode.state.lastCommit = result.data || result;
                m.redraw();
            }).catch(() => {
                vnode.state.lastCommit = null;
            });
        };
        
        vnode.state.loadTree = function() {
            const branch = vnode.state.currentBranch;
            const path = vnode.state.currentPath;
            console.log('🌳 [loadTree] Starting...');
            console.log('🌳 [loadTree] Parameters:', { owner, repo, ref: branch, path });
            
            vnode.state.fileContent = null;
            
            console.log('🌳 [loadTree] Calling API: getTree(', owner, ',', repo, ', { path:', path, ', ref:', branch, '})');
            
            RepositoryService.getTree(owner, repo, { path: path, ref: branch }).then(result => {
                console.log('🌳 [loadTree] API Success! Result:', result);
                const entries = result.entries || [];
                console.log('🌳 [loadTree] Entries count:', entries.length);
                console.log('🌳 [loadTree] Updating treeEntries state...');
                vnode.state.treeEntries = entries;
                console.log('🌳 [loadTree] Calling m.redraw()...');
                m.redraw();
                console.log('🌳 [loadTree] ✅ Complete!');
            }).catch((error) => {
                console.error('❌ [loadTree] API Error:', error);
                console.error('❌ [loadTree] Error details:', error.message, error.stack);
                vnode.state.treeEntries = [];
                m.redraw();
            });
            
            console.log('🌳 [loadTree] Also calling loadLastCommit()...');
            vnode.state.loadLastCommit();
        };
        
        vnode.state.loadFile = function(path) {
            RepositoryService.getFile(owner, repo, { path: path, ref: vnode.state.currentBranch }).then(result => {
                vnode.state.fileContent = result.content;
                vnode.state.currentPath = path;
                m.redraw();
            }).catch(() => {
                vnode.state.fileContent = null;
                m.redraw();
            });
        };
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 }),
            TaskService.list(owner, repo, { per_page: 1 })
        ]).then(([repoResult, issuesResult, prsResult, tasksResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.loading = false;
            vnode.state.loadBranches();
            vnode.state.loadTags();
            vnode.state.loadTree();
            m.redraw();
        }).catch(error => {
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, issuesCount, prsCount, loading, currentPath, currentBranch, branches, tags, treeEntries, fileContent, showBranchMenu, activeTab, lastCommit, stagedFiles, workingFiles, untrackedFiles, isNonMirrorRepo, showCommitDialog, commitMessage, committing } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        console.log('🎨 [view] Rendering...');
        console.log('🎨 [view] State:', {
            currentBranch,
            currentPath,
            treeEntriesCount: treeEntries.length,
            fileContent: fileContent ? 'has content' : null
        });
        
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
                    repo: repo,
                    description: repo.description,
                    stars: repo.stars_count,
                    forks: repo.forks_count,
                    visibility: repo.is_private ? 'private' : 'public'
                }),
                
                m(ProjectTabs, {
                    owner: owner,
                    repo: repo,
                    issuesCount: issuesCount,
                    prsCount: prsCount,
                    tasksCount: vnode.state.tasksCount,
                    activeTab: 'code'
                }),
                
                m('div.project-layout', [
                    m('div.main-content', [
                        m('div.file-browser', [
                            m('div.file-browser-header', [
                                m('div.branch-selector', [
                                    m('div.branch-dropdown', {
                                        onclick: (e) => {
                                            e.stopPropagation();
                                            vnode.state.showBranchMenu = !vnode.state.showBranchMenu;
                                        }
                                    }, [
                                        m('i.fas.fa-code-branch'),
                                        m('span', currentBranch === 'HEAD' ? (repo.default_branch || 'main') : currentBranch),
                                        m('i.fas.fa-chevron-down')
                                    ]),
                                    showBranchMenu ? m('div.branch-menu', {
                                        onclick: (e) => { e.stopPropagation(); }
                                    }, [
                                        m('div.branch-menu-tabs', [
                                            m('div.branch-menu-tab', {
                                                class: activeTab === 'branches' ? 'active' : '',
                                                onclick: (e) => { 
                                                    e.stopPropagation();
                                                    vnode.state.activeTab = 'branches'; 
                                                }
                                            }, '分支'),
                                            m('div.branch-menu-tab', {
                                                class: activeTab === 'tags' ? 'active' : '',
                                                onclick: (e) => { 
                                                    e.stopPropagation();
                                                    vnode.state.activeTab = 'tags'; 
                                                }
                                            }, '标签')
                                        ]),
                                        m('div.branch-menu-list', [
                                            activeTab === 'branches' ? 
                                                [
                                                    isNonMirrorRepo ? m('div.branch-option virtual-branch', {
                                                        class: currentBranch === '__staged__' ? 'active' : '',
                                                        onclick: (e) => { 
                                                            e.stopPropagation();
                                                            vnode.state.currentBranch = '__staged__';
                                                            vnode.state.currentPath = '';
                                                            vnode.state.showBranchMenu = false;
                                                            vnode.state.treeEntries = stagedFiles.map(f => ({ type: 'blob', name: f.split('/').pop(), path: f, size: 0 }));
                                                            vnode.state.fileContent = null;
                                                            m.redraw();
                                                        }
                                                    }, [
                                                        m('i.fas.fa-check', { style: { visibility: currentBranch === '__staged__' ? 'visible' : 'hidden' } }),
                                                        m('i.fas.fa-layer-group'),
                                                        `暂存区 (${stagedFiles.length})`
                                                    ]) : null,
                                                    isNonMirrorRepo ? m('div.branch-option virtual-branch', {
                                                        class: currentBranch === '__working__' ? 'active' : '',
                                                        onclick: (e) => { 
                                                            e.stopPropagation();
                                                            vnode.state.currentBranch = '__working__';
                                                            vnode.state.currentPath = '';
                                                            vnode.state.showBranchMenu = false;
                                                            const allWorking = [...(workingFiles || []), ...(untrackedFiles || [])];
                                                            vnode.state.treeEntries = allWorking.map(f => ({ type: 'blob', name: f.split('/').pop(), path: f, size: 0 }));
                                                            vnode.state.fileContent = null;
                                                            m.redraw();
                                                        }
                                                    }, [
                                                        m('i.fas.fa-check', { style: { visibility: currentBranch === '__working__' ? 'visible' : 'hidden' } }),
                                                        m('i.fas.fa-edit'),
                                                        `工作区 (${(workingFiles || []).length + (untrackedFiles || []).length})`
                                                    ]) : null,
                                                    isNonMirrorRepo ? m('div.branch-divider') : null,
                                                ].concat(
                                                branches.map(branch => 
                                                    m('div.branch-option', {
                                                        class: currentBranch === branch ? 'active' : '',
                                                        onclick: (e) => { 
                                                            console.log('=== Branch clicked ===');
                                                            console.log('Selected branch:', branch);
                                                            console.log('Previous branch:', currentBranch);
                                                            e.stopPropagation();
                                                            vnode.state.currentBranch = branch;
                                                            vnode.state.currentPath = '';
                                                            vnode.state.showBranchMenu = false;
                                                            console.log('About to call loadTree()...');
                                                            vnode.state.loadTree();
                                                            console.log('loadTree() called, triggering redraw...');
                                                            m.redraw();
                                                            console.log('=== Branch click complete ===');
                                                        }
                                                    }, [
                                                        m('i.fas.fa-check', { style: { visibility: currentBranch === branch ? 'visible' : 'hidden' } }),
                                                        branch
                                                    ])
                                                )) :
                                                tags.map(tag => 
                                                    m('div.branch-option', {
                                                        class: currentBranch === tag ? 'active' : '',
                                                        onclick: (e) => { 
                                                            e.stopPropagation();
                                                            vnode.state.currentBranch = tag;
                                                            vnode.state.currentPath = '';
                                                            vnode.state.showBranchMenu = false;
                                                            vnode.state.loadTree();
                                                            m.redraw();
                                                        }
                                                    }, [
                                                        m('i.fas.fa-check', { style: { visibility: currentBranch === tag ? 'visible' : 'hidden' } }),
                                                        m('i.fas.fa-tag'),
                                                        tag
                                                    ])
                                                )
                                        ])
                                    ]) : null
                                ]),
                                m('div.file-actions', [
                                    isNonMirrorRepo && stagedFiles.length > 0 ? m('button.btn.btn-sm.btn-primary', {
                                        onclick: () => {
                                            vnode.state.showCommitDialog = true;
                                            vnode.state.commitMessage = '';
                                        }
                                    }, [
                                        m('i.fas.fa-check'),
                                        ' 提交'
                                    ]) : null,
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
                            
                            m('div.path-breadcrumb-container', [
                                m('div.path-breadcrumb', renderBreadcrumb(owner, repo.name, currentPath, (path) => {
                                    vnode.state.currentPath = path;
                                    vnode.state.loadTree();
                                })),
                                lastCommit && lastCommit.time ? m('div.last-commit-info', [
                                    m('span.last-commit-time', `最后提交: ${lastCommit.time}`)
                                ]) : null
                            ]),
                            
                            fileContent !== null ? [
                                m('div.file-content-header', [
                                    m('span', currentPath.split('/').pop()),
                                    m('button.btn.btn-sm', { onclick: () => {
                                        const parts = currentPath.split('/');
                                        parts.pop();
                                        vnode.state.currentPath = parts.join('/');
                                        vnode.state.fileContent = null;
                                        vnode.state.loadTree();
                                    } }, '返回')
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
                                currentBranch === '__staged__' ? m('div.virtual-branch-panel', [
                                    m('div.virtual-branch-header', [
                                        m('div.virtual-branch-title', [
                                            m('i.fas.fa-layer-group'),
                                            m('span', '暂存区'),
                                            m('span.badge', stagedFiles.length)
                                        ]),
                                        stagedFiles.length > 0 ? m('button.btn.btn-sm.btn-primary', {
                                            onclick: () => {
                                                vnode.state.showCommitDialog = true;
                                                vnode.state.commitMessage = '';
                                            }
                                        }, [m('i.fas.fa-check'), ' 提交变更']) : null
                                    ]),
                                    stagedFiles.length === 0 
                                        ? m('div.virtual-branch-empty', '暂无已暂存的文件')
                                        : m('div.file-list', stagedFiles.map(file => 
                                            m('div.file-item virtual-file-item', [
                                                m('span.file-icon', [m('i.fas.fa-file-code')]),
                                                m('span.file-name', file),
                                                m('span.file-actions-inline', [
                                                    m('button.btn-icon', {
                                                        title: '取消暂存',
                                                        onclick: () => {
                                                            RepositoryService.unstage(owner, repoName, { files: [file] }).then(result => {
                                                                vnode.state.stagedFiles = result.staged_files || [];
                                                                vnode.state.workingFiles = result.working_files || [];
                                                                vnode.state.untrackedFiles = result.untracked_files || [];
                                                                vnode.state.treeEntries = (result.staged_files || []).map(f => ({ type: 'blob', name: f.split('/').pop(), path: f, size: 0 }));
                                                                m.redraw();
                                                            });
                                                        }
                                                    }, m('i.fas.fa-minus'))
                                                ])
                                            ])
                                        ))
                                ]) :
                                currentBranch === '__working__' ? m('div.virtual-branch-panel', [
                                    m('div.virtual-branch-header', [
                                        m('div.virtual-branch-title', [
                                            m('i.fas.fa-edit'),
                                            m('span', '工作区'),
                                            m('span.badge', (workingFiles || []).length + (untrackedFiles || []).length)
                                        ]),
                                        (workingFiles || []).length + (untrackedFiles || []).length > 0 ? m('button.btn.btn-sm', {
                                            onclick: () => {
                                                RepositoryService.stage(owner, repoName, { files: [] }).then(result => {
                                                    vnode.state.stagedFiles = result.staged_files || [];
                                                    vnode.state.workingFiles = result.working_files || [];
                                                    vnode.state.untrackedFiles = result.untracked_files || [];
                                                    vnode.state.currentBranch = '__staged__';
                                                    vnode.state.treeEntries = (result.staged_files || []).map(f => ({ type: 'blob', name: f.split('/').pop(), path: f, size: 0 }));
                                                    m.redraw();
                                                });
                                            }
                                        }, [m('i.fas.fa-plus'), ' 全部暂存']) : null
                                    ]),
                                    (workingFiles || []).length + (untrackedFiles || []).length === 0
                                        ? m('div.virtual-branch-empty', '工作区很干净，没有未暂存的修改')
                                        : m('div.file-list', [
                                            ...(workingFiles || []).map(file => 
                                                m('div.file-item virtual-file-item', [
                                                    m('span.file-icon.modified', [m('i.fas.fa-file-code')]),
                                                    m('span.file-name', file),
                                                    m('span.file-status.modified', '已修改'),
                                                    m('span.file-actions-inline', [
                                                        m('button.btn-icon', {
                                                            title: '暂存此文件',
                                                            onclick: () => {
                                                                RepositoryService.stage(owner, repoName, { files: [file] }).then(result => {
                                                                    vnode.state.stagedFiles = result.staged_files || [];
                                                                    vnode.state.workingFiles = result.working_files || [];
                                                                    vnode.state.untrackedFiles = result.untracked_files || [];
                                                                    const allWorking = [...(result.working_files || []), ...(result.untracked_files || [])];
                                                                    vnode.state.treeEntries = allWorking.map(f => ({ type: 'blob', name: f.split('/').pop(), path: f, size: 0 }));
                                                                    m.redraw();
                                                                });
                                                            }
                                                        }, m('i.fas.fa-plus'))
                                                    ])
                                                ])
                                            ),
                                            ...(untrackedFiles || []).map(file => 
                                                m('div.file-item virtual-file-item', [
                                                    m('span.file-icon.untracked', [m('i.fas.fa-file-code')]),
                                                    m('span.file-name', file),
                                                    m('span.file-status.untracked', '未跟踪'),
                                                    m('span.file-actions-inline', [
                                                        m('button.btn-icon', {
                                                            title: '暂存此文件',
                                                            onclick: () => {
                                                                RepositoryService.stage(owner, repoName, { files: [file] }).then(result => {
                                                                    vnode.state.stagedFiles = result.staged_files || [];
                                                                    vnode.state.workingFiles = result.working_files || [];
                                                                    vnode.state.untrackedFiles = result.untracked_files || [];
                                                                    const allWorking = [...(result.working_files || []), ...(result.untracked_files || [])];
                                                                    vnode.state.treeEntries = allWorking.map(f => ({ type: 'blob', name: f.split('/').pop(), path: f, size: 0 }));
                                                                    m.redraw();
                                                                });
                                                            }
                                                        }, m('i.fas.fa-plus'))
                                                    ])
                                                ])
                                            )
                                        ])
                                ]) :
                                treeEntries.length === 0 
                                    ? m(EmptyState, { message: repo.local_path ? '此目录为空' : '仓库未初始化，请先同步代码', icon: 'fa-folder-open' })
                                    : (function() {
                                        return m('div.file-list', treeEntries.map(entry => 
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
                                        ));
                                    })()
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
                ]),
                showCommitDialog ? m('div.modal-overlay', {
                    onclick: (e) => {
                        if (e.target.classList.contains('modal-overlay')) {
                            vnode.state.showCommitDialog = false;
                            m.redraw();
                        }
                    }
                }, m('div.modal.commit-dialog', [
                    m('div.modal-header', [
                        m('h3', [m('i.fas.fa-check'), ' 提交变更']),
                        m('button.modal-close', {
                            onclick: () => {
                                vnode.state.showCommitDialog = false;
                                m.redraw();
                            }
                        }, m('i.fas.fa-times'))
                    ]),
                    m('div.modal-body', [
                        m('div.commit-files-summary', [
                            m('span', `${stagedFiles.length} 个文件已暂存`)
                        ]),
                        m('div.commit-files-list', stagedFiles.map(file => 
                            m('div.commit-file-item', [
                                m('i.fas.fa-file-code'),
                                m('span', file)
                            ])
                        )),
                        m('div.form-group', [
                            m('label', '提交信息'),
                            m('textarea.commit-message-input', {
                                placeholder: '输入提交信息...',
                                value: commitMessage,
                                oninput: (e) => {
                                    vnode.state.commitMessage = e.target.value;
                                }
                            })
                        ])
                    ]),
                    m('div.modal-footer', [
                        m('button.btn', {
                            onclick: () => {
                                vnode.state.showCommitDialog = false;
                                m.redraw();
                            }
                        }, '取消'),
                        m('button.btn.btn-primary', {
                            disabled: !commitMessage.trim() || committing,
                            onclick: () => {
                                if (!commitMessage.trim()) return;
                                vnode.state.committing = true;
                                m.redraw();
                                RepositoryService.commit(owner, repoName, { message: commitMessage.trim() }).then(result => {
                                    vnode.state.committing = false;
                                    vnode.state.showCommitDialog = false;
                                    vnode.state.stagedFiles = result.staged_files || [];
                                    vnode.state.workingFiles = result.working_files || [];
                                    vnode.state.untrackedFiles = result.untracked_files || [];
                                    vnode.state.currentBranch = repo.default_branch || 'main';
                                    vnode.state.loadTree();
                                    vnode.state.loadBranches();
                                    m.redraw();
                                }).catch(err => {
                                    vnode.state.committing = false;
                                    alert('提交失败: ' + (err.message || '未知错误'));
                                    m.redraw();
                                });
                            }
                        }, committing ? '提交中...' : '确认提交')
                    ])
                ])) : null
            ])
        ]);
    }
};

const TreeEntry = {
    view(vnode) {
        const { entry, owner, repo, currentPath, onNavigate } = vnode.attrs;
        const isTree = entry.type === 'tree';
        
        return m('div.file-item', {
            onclick: () => onNavigate(entry.path, !isTree),
            style: { cursor: 'pointer' }
        }, [
            m('span.file-icon', { class: isTree ? 'folder' : '' }, [
                m(`i.fas.${isTree ? 'fa-folder' : 'fa-file-code'}`)
            ]),
            m('span.file-name', entry.name),
            m('span.file-commit-message', entry.last_commit_message || ''),
            m('span.file-commit-time', entry.last_commit_time ? formatRelativeTime(entry.last_commit_time) : '')
        ]);
    }
};

function formatRelativeTime(timeStr) {
    const date = new Date(timeStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 7) {
        if (diffDays === 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours === 0) {
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                if (diffMinutes === 0) return '刚刚';
                return `${diffMinutes}分钟前`;
            }
            return `${diffHours}小时前`;
        }
        return `${diffDays}天前`;
    }
    
    return date.toLocaleDateString('zh-CN');
}

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
            m('i.fas.fa-map-marker-alt'),
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
