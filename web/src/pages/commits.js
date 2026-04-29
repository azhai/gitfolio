import { Layout, Loading, ProjectHeader, ProjectTabs, EmptyState, Pagination } from '../components.js';
import { RepositoryService, PullRequestService, TaskService, IssueService } from '../api.js';

const branchColors = [
    '#28a745', '#0366d6', '#d73a49', '#f66a0a', '#6f42c1',
    '#005cc5', '#044289', '#e36209', '#b08800', '#1b1f23',
    '#e91e63', '#00bcd4', '#ff5722', '#795548', '#607d8b'
];

function getBranchColor(branchName) {
    let hash = 0;
    for (let i = 0; i < branchName.length; i++) {
        hash = branchName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return branchColors[Math.abs(hash) % branchColors.length];
}

function extractVersion(message) {
    if (!message) return null;
    
    const patterns = [
        /v\d+\.\d+\.\d+/i,
        /v\d+\.\d+/i,
        /release[\s\-_]?\d+\.\d+\.\d+/i,
        /release[\s\-_]?\d+\.\d+/i,
        /version[\s\-_]?\d+\.\d+\.\d+/i,
        /version[\s\-_]?\d+\.\d+/i,
        /\d+\.\d+\.\d+/,
    ];
    
    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
            return match[0];
        }
    }
    
    return null;
}

const LANE_COLORS = [
    '#e74c3c', '#2ecc71', '#3498db', '#f39c12',
    '#9b59b6', '#1abc9c', '#e67e22', '#e91e63',
    '#00bcd4', '#8bc34a', '#ff5722', '#607d8b',
    '#795548', '#cddc39', '#ff9800', '#673ab7'
];

function getLaneColor(laneIndex) {
    return LANE_COLORS[laneIndex % LANE_COLORS.length];
}

function computeGraphLayout(commits) {
    if (!commits || commits.length === 0) return null;

    const commitLanes = {};
    const commitFlows = {};
    let maxLane = 0;
    const activeLanes = [];
    const hashToLane = {};
    const lanesAbove = [];
    const lanesBelow = [];

    function findLaneForHash(hash) {
        if (hash in hashToLane) return hashToLane[hash];
        return -1;
    }

    function findAvailableLane() {
        for (let i = 0; i < activeLanes.length; i++) {
            if (activeLanes[i] === null) return i;
        }
        activeLanes.push(null);
        if (activeLanes.length - 1 > maxLane) maxLane = activeLanes.length - 1;
        return activeLanes.length - 1;
    }

    function setLane(lane, hash) {
        while (activeLanes.length <= lane) {
            activeLanes.push(null);
            if (activeLanes.length - 1 > maxLane) maxLane = activeLanes.length - 1;
        }
        if (hash in hashToLane && hashToLane[hash] !== lane) {
            const oldLane = hashToLane[hash];
            if (oldLane < activeLanes.length && activeLanes[oldLane] === hash) {
                activeLanes[oldLane] = null;
            }
        }
        activeLanes[lane] = hash;
        hashToLane[hash] = lane;
    }

    function clearLane(lane) {
        if (lane < activeLanes.length && activeLanes[lane] !== null) {
            const oldHash = activeLanes[lane];
            if (hashToLane[oldHash] === lane) {
                delete hashToLane[oldHash];
            }
            activeLanes[lane] = null;
        }
    }

    function snapshotActive() {
        const s = new Set();
        for (let i = 0; i < activeLanes.length; i++) {
            if (activeLanes[i] !== null) s.add(i);
        }
        return s;
    }

    for (let i = 0; i < commits.length; i++) {
        lanesAbove[i] = snapshotActive();

        const commit = commits[i];
        const hash = commit.hash;
        const parents = commit.parents || [];

        let myLane = findLaneForHash(hash);
        if (myLane === -1) {
            myLane = findAvailableLane();
        }

        commitLanes[hash] = myLane;

        const flows = [];

        if (parents.length === 0) {
            clearLane(myLane);
            commitFlows[hash] = flows;
            lanesBelow[i] = snapshotActive();
            continue;
        }

        const firstParent = parents[0];
        setLane(myLane, firstParent);
        flows.push({ fromLane: myLane, toLane: myLane, type: 'straight' });

        for (let p = 1; p < parents.length; p++) {
            const parentHash = parents[p];
            const existingLane = findLaneForHash(parentHash);

            if (existingLane !== -1) {
                flows.push({ fromLane: myLane, toLane: existingLane, type: 'merge' });
            } else {
                const newLane = findAvailableLane();
                setLane(newLane, parentHash);
                flows.push({ fromLane: myLane, toLane: newLane, type: 'branch' });
            }
        }

        commitFlows[hash] = flows;
        lanesBelow[i] = snapshotActive();
    }

    const laneCount = maxLane + 1;
    const laneColorsMap = {};
    for (let l = 0; l < laneCount; l++) {
        laneColorsMap[l] = getLaneColor(l);
    }

    return { commitLanes, commitFlows, laneCount, laneColors: laneColorsMap, lanesAbove, lanesBelow };
}

function renderCommitGraph(layout, commits, currentCommitIndex) {
    if (!layout) return null;

    const { commitLanes, commitFlows, laneCount, laneColors, lanesAbove, lanesBelow } = layout;

    const LANE_W = 18;
    const ROW_H = 28;
    const NODE_R = 3;
    const LINE_W = 1.8;
    const PAD_X = 4;
    const totalWidth = Math.max(laneCount, 1) * LANE_W + PAD_X * 2;
    const totalHeight = ROW_H;

    const commit = commits[currentCommitIndex];
    const hash = commit.hash;
    const myLane = commitLanes[hash] || 0;
    const myX = myLane * LANE_W + LANE_W / 2 + PAD_X;
    const myY = ROW_H / 2;
    const color = laneColors[myLane];

    const paths = [];
    const nodes = [];

    nodes.push({ x: myX, y: myY, r: NODE_R, color });

    const above = lanesAbove[currentCommitIndex];
    const below = lanesBelow[currentCommitIndex];

    if (above.has(myLane)) {
        paths.push({ d: `M ${myX} 0 L ${myX} ${myY - NODE_R}`, color });
    }

    const flows = commitFlows[hash] || [];
    const flowTargetLanes = new Set();

    for (const flow of flows) {
        const toX = flow.toLane * LANE_W + LANE_W / 2 + PAD_X;
        const toColor = laneColors[flow.toLane];
        flowTargetLanes.add(flow.toLane);

        if (flow.type === 'straight') {
            paths.push({ d: `M ${myX} ${myY + NODE_R} L ${myX} ${totalHeight}`, color: toColor });
        } else {
            const cp1y = myY + (totalHeight - myY) * 0.4;
            const cp2y = totalHeight - (totalHeight - myY) * 0.4;
            paths.push({ d: `M ${myX} ${myY + NODE_R} C ${myX} ${cp1y}, ${toX} ${cp2y}, ${toX} ${totalHeight}`, color: toColor });
        }
    }

    if (flows.length === 0) {
        // root commit — no outgoing lines below
    }

    const handledLanes = new Set([myLane, ...flowTargetLanes]);

    for (const lane of above) {
        if (handledLanes.has(lane)) continue;

        const lx = lane * LANE_W + LANE_W / 2 + PAD_X;
        const lColor = laneColors[lane];

        if (below.has(lane)) {
            paths.push({ d: `M ${lx} 0 L ${lx} ${totalHeight}`, color: lColor });
        } else {
            paths.push({ d: `M ${lx} 0 L ${lx} ${myY - NODE_R}`, color: lColor });
            const cp1y = (myY - NODE_R) + (myY - (myY - NODE_R)) * 0.5;
            paths.push({ d: `M ${lx} ${myY - NODE_R} C ${lx} ${cp1y}, ${myX} ${myY - NODE_R - 2}, ${myX} ${myY - NODE_R}`, color: lColor });
        }
    }

    return m('svg.commit-graph-svg', {
        width: totalWidth,
        height: totalHeight,
        viewBox: `0 0 ${totalWidth} ${totalHeight}`,
        style: { display: 'block' }
    }, [
        ...paths.map(p => m('path', {
            d: p.d,
            stroke: p.color,
            'stroke-width': LINE_W,
            fill: 'none',
            'stroke-linecap': 'round'
        })),
        m('circle', {
            cx: myX,
            cy: myY,
            r: NODE_R + 1,
            fill: '#1a1a2e',
            stroke: 'none'
        }),
        m('circle', {
            cx: myX,
            cy: myY,
            r: NODE_R,
            fill: color,
            stroke: '#fff',
            'stroke-width': 1.2
        })
    ]);
}

const CommitList = {
    oninit(vnode) {
        const { owner, repo, branch: urlBranch } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.commits = [];
        vnode.state.loading = true;
        vnode.state.perPage = 50;
        vnode.state.total = 0;
        vnode.state.totalPages = 0;
        vnode.state.branches = [];
        vnode.state.tags = [];
        vnode.state.showBranchMenu = false;
        vnode.state.prsCount = 0;
        vnode.state.issuesCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.activeTab = 'branches';
        vnode.state.selectedCommits = [];
        vnode.state.lastSelectedIndex = -1;
        vnode.state.showRebaseConfirm = false;
        vnode.state.rebaseInProgress = false;
        
        const urlParams = m.route.param();
        const pageFromUrl = parseInt(urlParams.page) || 1;
        
        if (urlBranch && urlBranch !== 'commits') {
            vnode.state.selectedBranches = [urlBranch];
            vnode.state.page = pageFromUrl;
        } else {
            vnode.state.selectedBranches = ['all'];
            vnode.state.page = pageFromUrl;
        }
        
        vnode.state.updateUrl = function() {
            const branches = vnode.state.selectedBranches;
            const page = vnode.state.page;
            
            let path;
            if (branches.includes('all') || branches.length === 0) {
                path = `/commits/${owner}/${repo}`;
            } else if (branches.length === 1) {
                path = `/commits/${owner}/${repo}/${branches[0]}`;
            } else {
                path = `/commits/${owner}/${repo}`;
            }
            
            const query = {};
            if (page > 1) query.page = page;
            if (branches.length > 1 && !branches.includes('all')) {
                query.branches = branches.join(',');
            }
            
            const queryString = Object.keys(query).length > 0 
                ? '?' + Object.entries(query).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
                : '';
            
            m.route.set(path + queryString, { replace: true });
        };
        
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
        
        vnode.state.loadCommits = function() {
            vnode.state.loading = true;
            vnode.state.selectedCommits = [];
            vnode.state.lastSelectedIndex = -1;
            const selected = vnode.state.selectedBranches;
            const isAllSelected = selected.includes('all');
            
            RepositoryService.getCommits(owner, repo, {
                ref: 'HEAD',
                page: vnode.state.page,
                per_page: vnode.state.perPage,
                all: isAllSelected ? 'true' : 'false',
                branches: !isAllSelected ? selected.join(',') : ''
            }).then(result => {
                const data = result.data || result;
                vnode.state.commits = data.commits || [];
                vnode.state.graphLayout = computeGraphLayout(vnode.state.commits);
                vnode.state.total = data.total || 0;
                vnode.state.totalPages = Math.ceil(vnode.state.total / vnode.state.perPage);
                vnode.state.loading = false;
                vnode.state.updateUrl();
                m.redraw();
            }).catch(error => {
                console.error('Failed to load commits:', error);
                vnode.state.loading = false;
                vnode.state.commits = [];
                vnode.state.graphLayout = null;
                m.redraw();
            });
        };
        
        vnode.state.loadBranches = function() {
            RepositoryService.getBranches(owner, repo).then(result => {
                vnode.state.branches = result.branches || [];
                m.redraw();
            }).catch(() => {});
        };
        
        vnode.state.loadTags = function() {
            RepositoryService.getTags(owner, repo).then(result => {
                vnode.state.tags = result.tags || [];
                m.redraw();
            }).catch(() => {});
        };
        
        Promise.all([
            RepositoryService.get(owner, repo),
            PullRequestService.list(owner, repo, { per_page: 1000 }),
            IssueService.list(owner, repo, { per_page: 1000 }),
            TaskService.list(owner, repo, { per_page: 1 })
        ]).then(([repoResult, prsResult, issuesResult, tasksResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.loading = false;
            vnode.state.loadBranches();
            vnode.state.loadTags();
            vnode.state.loadCommits();
            m.redraw();
        }).catch(error => {
            console.error('Failed to load repo:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, commits, loading, page, totalPages, total, selectedBranches, branches, tags, showBranchMenu, activeTab } = vnode.state;
        const { owner, repo: repoName } = vnode.attrs;
        
        const isAllSelected = selectedBranches.includes('all');
        const displayText = isAllSelected ? 
            `全部分支 (${branches.length})` : 
            `${selectedBranches.length} 个分支`;
        
        if (loading && !repo) {
            return m(Layout, m(Loading));
        }
        
        if (!repo) {
            return m(Layout, m(EmptyState, { message: '项目不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        return m(Layout, [
            m(ProjectHeader, { repo, owner }),
            m(ProjectTabs, { owner, repo: repo, activeTab: 'commits', issuesCount: vnode.state.issuesCount, prsCount: vnode.state.prsCount, tasksCount: vnode.state.tasksCount }),
            
            m('div.commits-page', [
                m('div.commits-header', [
                    m('div.branch-selector', [
                        m('div.branch-dropdown', {
                            onclick: (e) => {
                                e.stopPropagation();
                                vnode.state.showBranchMenu = !vnode.state.showBranchMenu;
                            }
                        }, [
                            m('i.fas.fa-code-branch'),
                            m('span.branch-display-text', displayText),
                            m('i.fas.fa-chevron-down')
                        ]),
                        showBranchMenu ? m('div.branch-menu.multi-select-menu', {
                            onclick: (e) => { e.stopPropagation(); }
                        }, [
                            m('div.branch-menu-header', [
                                m('span.menu-title', '选择分支'),
                                m('div.menu-actions', [
                                    m('a.action-link', {
                                        onclick: (e) => {
                                            e.stopPropagation();
                                            if (isAllSelected) {
                                                vnode.state.selectedBranches = [];
                                            } else {
                                                vnode.state.selectedBranches = ['all'];
                                            }
                                            vnode.state.page = 1;
                                            vnode.state.loadCommits();
                                        }
                                    }, isAllSelected ? '取消全选' : '全选'),
                                    m('a.action-link', {
                                        onclick: (e) => {
                                            e.stopPropagation();
                                            if (selectedBranches.length > 0) {
                                                vnode.state.showBranchMenu = false;
                                                vnode.state.loadCommits();
                                            }
                                        }
                                    }, '应用')
                                ])
                            ]),
                            m('div.branch-menu-tabs', [
                                m('div.branch-menu-tab', {
                                    class: activeTab === 'branches' ? 'active' : '',
                                    onclick: (e) => { 
                                        e.stopPropagation();
                                        vnode.state.activeTab = 'branches'; 
                                    }
                                }, `分支 (${branches.length})`),
                                m('div.branch-menu-tab', {
                                    class: activeTab === 'tags' ? 'active' : '',
                                    onclick: (e) => { 
                                        e.stopPropagation();
                                        vnode.state.activeTab = 'tags'; 
                                    }
                                }, `标签 (${tags.length})`)
                            ]),
                            m('div.branch-menu-list.scrollable-list', [
                                activeTab === 'branches' ? 
                                    [
                                        m('div.branch-option.checkbox-option', {
                                            class: isAllSelected ? 'selected' : '',
                                            onclick: (e) => { 
                                                e.stopPropagation();
                                                if (isAllSelected) {
                                                    vnode.state.selectedBranches = [];
                                                } else {
                                                    vnode.state.selectedBranches = ['all'];
                                                }
                                            }
                                        }, [
                                            m('input[type=checkbox]', {
                                                type: 'checkbox',
                                                checked: isAllSelected,
                                                onchange: () => {}
                                            }),
                                            m('i.fas.fa-sitemap'),
                                            m('span.option-label', '全部分支')
                                        ]),
                                        ...branches.map(branch => {
                                            const isSelected = !isAllSelected && selectedBranches.includes(branch);
                                            return m('div.branch-option.checkbox-option', {
                                                class: isSelected ? 'selected' : '',
                                                onclick: (e) => { 
                                                    e.stopPropagation();
                                                    let newSelection;
                                                    if (isAllSelected) {
                                                        newSelection = branches.filter(b => b !== branch);
                                                        newSelection.unshift('all');
                                                    } else {
                                                        if (isSelected) {
                                                            newSelection = selectedBranches.filter(b => b !== branch);
                                                            if (newSelection.length === 0) {
                                                                newSelection = ['all'];
                                                            }
                                                        } else {
                                                            newSelection = [...selectedBranches.filter(b => b !== 'all'), branch];
                                                        }
                                                    }
                                                    vnode.state.selectedBranches = newSelection;
                                                }
                                            }, [
                                                m('input[type=checkbox]', {
                                                    type: 'checkbox',
                                                    checked: isSelected || isAllSelected,
                                                    onchange: () => {}
                                                }),
                                                m('span.branch-color-dot', {
                                                    style: { background: getBranchColor(branch) }
                                                }),
                                                m('span.option-label', branch)
                                            ]);
                                        })
                                    ] :
                                    tags.map(tag => {
                                        const isSelected = selectedBranches.includes(tag);
                                        return m('div.branch-option.checkbox-option', {
                                            class: isSelected ? 'selected' : '',
                                            onclick: (e) => { 
                                                e.stopPropagation();
                                                let newSelection;
                                                if (isSelected) {
                                                    newSelection = selectedBranches.filter(t => t !== tag);
                                                } else {
                                                    newSelection = [...selectedBranches.filter(b => b !== 'all'), tag];
                                                }
                                                vnode.state.selectedBranches = newSelection;
                                            }
                                        }, [
                                            m('input[type=checkbox]', {
                                                type: 'checkbox',
                                                checked: isSelected,
                                                onchange: () => {}
                                            }),
                                            m('i.fas.fa-tag'),
                                            m('span.option-label', tag)
                                        ]);
                                    })
                            ])
                        ]) : null
                    ]),
                    m('div.commits-count', [
                        m('i.fas.fa-history'),
                        ` 共 ${total} 个提交`
                    ])
                ]),
                
                loading ? m(Loading) : [
                    commits.length === 0 ? 
                        m(EmptyState, { message: '暂无提交记录', icon: 'fa-history' }) :
                        [
                            vnode.state.selectedCommits.length > 0 ? m('div.commits-actions-bar', [
                                m('span.selected-count', `已选择 ${vnode.state.selectedCommits.length} 个提交`),
                                m('button.btn.btn-danger', {
                                    onclick: () => {
                                        vnode.state.showRebaseConfirm = true;
                                    }
                                }, [m('i.fas.fa-trash'), ' 删除选中提交 (Rebase)'])
                            ]) : null,
                            m('div.commits-list', commits.map((commit, index) => {
                                const version = extractVersion(commit.message);
                                const isSelected = vnode.state.selectedCommits.includes(commit.hash);
                                return m('div.commit-item', {
                                    class: isSelected ? 'selected' : '',
                                    onclick: (e) => {
                                        if (e.target.tagName === 'A' || e.target.type === 'checkbox') {
                                            return;
                                        }
                                        m.route.set(`/project/${owner}/${repo.name}?ref=${commit.hash}`);
                                    }
                                }, [
                                    m('div.commit-checkbox', [
                                        m('input[type=checkbox]', {
                                            checked: isSelected,
                                            onclick: (e) => {
                                                e.stopPropagation();
                                            },
                                            onchange: (e) => {
                                                const shiftKey = e.shiftKey;
                                                
                                                if (shiftKey && vnode.state.lastSelectedIndex !== -1) {
                                                    const start = Math.min(vnode.state.lastSelectedIndex, index);
                                                    const end = Math.max(vnode.state.lastSelectedIndex, index);
                                                    
                                                    for (let i = start; i <= end; i++) {
                                                        const hash = vnode.state.commits[i].hash;
                                                        if (!vnode.state.selectedCommits.includes(hash)) {
                                                            vnode.state.selectedCommits.push(hash);
                                                        }
                                                    }
                                                } else {
                                                    if (isSelected) {
                                                        vnode.state.selectedCommits = vnode.state.selectedCommits.filter(h => h !== commit.hash);
                                                    } else {
                                                        vnode.state.selectedCommits.push(commit.hash);
                                                    }
                                                    vnode.state.lastSelectedIndex = index;
                                                }
                                            }
                                        })
                                    ]),
                                    m('div.commit-graph', 
                                        renderCommitGraph(vnode.state.graphLayout, commits, index)
                                    ),
                                    m('div.commit-message', [
                                        m('span.commit-message-text', commit.message),
                                        version ? m('span.version-tag', version) : null
                                    ]),
                                    m('div.commit-meta', [
                                        m('span.commit-author', commit.author),
                                        m('span.commit-date', Utils.formatDate(commit.date))
                                    ]),
                                    m('a.commit-hash', {
                                        href: `/project/${owner}/${repo.name}?ref=${commit.hash}`,
                                        onclick: (e) => {
                                            e.stopPropagation();
                                        }
                                    }, commit.short_hash)
                                ]);
                            }))
                        ]
                ],
                
                totalPages > 1 ? m(Pagination, {
                    page,
                    totalPages,
                    onPageChange: (newPage) => {
                        vnode.state.page = newPage;
                        vnode.state.loadCommits();
                    }
                }) : null
            ]),
            
            vnode.state.showRebaseConfirm ? m('div.modal-overlay', {
                onclick: (e) => {
                    if (e.target === e.currentTarget) {
                        vnode.state.showRebaseConfirm = false;
                    }
                }
            }, [
                m('div.modal', [
                    m('div.modal-header', [
                        m('h2', [m('i.fas.fa-exclamation-triangle'), ' 确认删除提交']),
                        m('button.modal-close', {
                            onclick: () => { vnode.state.showRebaseConfirm = false; }
                        }, '×')
                    ]),
                    m('div.modal-body', [
                        m('p.warning-text', [
                            m('i.fas.fa-exclamation-circle'),
                            ' 您即将删除 ',
                            m('strong', vnode.state.selectedCommits.length),
                            ' 个提交。此操作将执行 interactive rebase，可能会改变提交历史。'
                        ]),
                        m('p', '选中的提交：'),
                        m('div.selected-commits-list', 
                            vnode.state.selectedCommits.map(hash => {
                                const commit = vnode.state.commits.find(c => c.hash === hash);
                                return commit ? m('div.selected-commit-item', [
                                    m('code', commit.short_hash),
                                    m('span', commit.message.substring(0, 50))
                                ]) : null;
                            })
                        ),
                        m('p.warning-text', [
                            m('i.fas.fa-info-circle'),
                            ' 注意：此操作不可逆，请确保您已备份重要数据。'
                        ])
                    ]),
                    m('div.modal-footer', [
                        m('button.btn', {
                            onclick: () => { vnode.state.showRebaseConfirm = false; }
                        }, '取消'),
                        m('button.btn.btn-danger', {
                            onclick: () => {
                                vnode.state.rebaseInProgress = true;
                                RepositoryService.rebase(owner, repo.name, {
                                    commits: vnode.state.selectedCommits
                                }).then(() => {
                                    vnode.state.showRebaseConfirm = false;
                                    vnode.state.rebaseInProgress = false;
                                    vnode.state.selectedCommits = [];
                                    vnode.state.loadCommits();
                                    alert('提交删除成功！');
                                }).catch(error => {
                                    vnode.state.rebaseInProgress = false;
                                    alert('删除失败: ' + (error.message || '未知错误'));
                                    m.redraw();
                                });
                            },
                            disabled: vnode.state.rebaseInProgress
                        }, vnode.state.rebaseInProgress ? '删除中...' : '确认删除')
                    ])
                ])
            ]) : null
        ]);
    }
};

function md5(string) {
    function md5cycle(x, k) {
        var a = x[0], b = x[1], c = x[2], d = x[3];
        a = ff(a, b, c, d, k[0], 7, -680876936);
        d = ff(d, a, b, c, k[1], 12, -389564586);
        c = ff(c, d, a, b, k[2], 17, 606105819);
        b = ff(b, c, d, a, k[3], 22, -1044525330);
        a = ff(a, b, c, d, k[4], 7, -176418897);
        d = ff(d, a, b, c, k[5], 12, 1200080426);
        c = ff(c, d, a, b, k[6], 17, -1473231341);
        b = ff(b, c, d, a, k[7], 22, -45705983);
        a = ff(a, b, c, d, k[8], 7, 1770035416);
        d = ff(d, a, b, c, k[9], 12, -1958414417);
        c = ff(c, d, a, b, k[10], 17, -42063);
        b = ff(b, c, d, a, k[11], 22, -1990404162);
        a = ff(a, b, c, d, k[12], 7, 1804603682);
        d = ff(d, a, b, c, k[13], 12, -40341101);
        c = ff(c, d, a, b, k[14], 17, -1502002290);
        b = ff(b, c, d, a, k[15], 22, 1236535329);
        a = gg(a, b, c, d, k[1], 5, -165796510);
        d = gg(d, a, b, c, k[6], 9, -1069501632);
        c = gg(c, d, a, b, k[11], 14, 643717713);
        b = gg(b, c, d, a, k[0], 20, -373897302);
        a = gg(a, b, c, d, k[5], 5, -701558691);
        d = gg(d, a, b, c, k[10], 9, 38016083);
        c = gg(c, d, a, b, k[15], 14, -660478335);
        b = gg(b, c, d, a, k[4], 20, -405537848);
        a = gg(a, b, c, d, k[9], 5, 568446438);
        d = gg(d, a, b, c, k[14], 9, -1019803690);
        c = gg(c, d, a, b, k[3], 14, -187363961);
        b = gg(b, c, d, a, k[8], 20, 1163531501);
        a = gg(a, b, c, d, k[13], 5, -1444681467);
        d = gg(d, a, b, c, k[2], 9, -51403784);
        c = gg(c, d, a, b, k[7], 14, 1735328473);
        b = gg(b, c, d, a, k[12], 20, -1926607734);
        a = hh(a, b, c, d, k[5], 4, -378558);
        d = hh(d, a, b, c, k[8], 11, -2022574463);
        c = hh(c, d, a, b, k[11], 16, 1839030562);
        b = hh(b, c, d, a, k[14], 23, -35309556);
        a = hh(a, b, c, d, k[1], 4, -1530992060);
        d = hh(d, a, b, c, k[4], 11, 1272893353);
        c = hh(c, d, a, b, k[7], 16, -155497632);
        b = hh(b, c, d, a, k[10], 23, -1094730640);
        a = hh(a, b, c, d, k[13], 4, 681279174);
        d = hh(d, a, b, c, k[0], 11, -358537222);
        c = hh(c, d, a, b, k[3], 16, -722521979);
        b = hh(b, c, d, a, k[6], 23, 76029189);
        a = hh(a, b, c, d, k[9], 4, -640364487);
        d = hh(d, a, b, c, k[12], 11, -421815835);
        c = hh(c, d, a, b, k[15], 16, 530742520);
        b = hh(b, c, d, a, k[2], 23, -995338651);
        a = ii(a, b, c, d, k[0], 6, -198630844);
        d = ii(d, a, b, c, k[7], 10, 1126891415);
        c = ii(c, d, a, b, k[14], 15, -1416354905);
        b = ii(b, c, d, a, k[5], 21, -57434055);
        a = ii(a, b, c, d, k[12], 6, 1700485571);
        d = ii(d, a, b, c, k[3], 10, -1894986606);
        c = ii(c, d, a, b, k[10], 15, -1051523);
        b = ii(b, c, d, a, k[1], 21, -2054922799);
        a = ii(a, b, c, d, k[8], 6, 1873313359);
        d = ii(d, a, b, c, k[15], 10, -30611744);
        c = ii(c, d, a, b, k[6], 15, -1560198380);
        b = ii(b, c, d, a, k[13], 21, 1309151649);
        a = ii(a, b, c, d, k[4], 6, -145523070);
        d = ii(d, a, b, c, k[11], 10, -1120210379);
        c = ii(c, d, a, b, k[2], 15, 718787259);
        b = ii(b, c, d, a, k[9], 21, -343485551);
        x[0] = add32(a, x[0]);
        x[1] = add32(b, x[1]);
        x[2] = add32(c, x[2]);
        x[3] = add32(d, x[3]);
    }

    function cmn(q, a, b, x, s, t) {
        a = add32(add32(a, q), add32(x, t));
        return add32((a << s) | (a >>> (32 - s)), b);
    }

    function ff(a, b, c, d, x, s, t) {
        return cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }

    function gg(a, b, c, d, x, s, t) {
        return cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }

    function hh(a, b, c, d, x, s, t) {
        return cmn(b ^ c ^ d, a, b, x, s, t);
    }

    function ii(a, b, c, d, x, s, t) {
        return cmn(c ^ (b | (~d)), a, b, x, s, t);
    }

    function md51(s) {
        var n = s.length,
            state = [1732584193, -271733879, -1732584194, 271733878], i;
        for (i = 64; i <= s.length; i += 64) {
            md5cycle(state, md5blk(s.substring(i - 64, i)));
        }
        s = s.substring(i - 64);
        var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < s.length; i++)
            tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
            md5cycle(state, tail);
            for (i = 0; i < 16; i++) tail[i] = 0;
        }
        tail[14] = n * 8;
        md5cycle(state, tail);
        return state;
    }

    function md5blk(s) {
        var md5blks = [],
            i;
        for (i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
        }
        return md5blks;
    }

    var hex_chr = '0123456789abcdef'.split('');

    function rhex(n) {
        var s = '',
            j = 0;
        for (; j < 4; j++)
            s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
        return s;
    }

    function hex(x) {
        for (var i = 0; i < x.length; i++)
            x[i] = rhex(x[i]);
        return x.join('');
    }

    function add32(a, b) {
        return (a + b) & 0xFFFFFFFF;
    }

    return hex(md51(string));
}

export default CommitList;
