const ReleasesPage = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.issuesCount = 0;
        vnode.state.prsCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.releases = [];
        vnode.state.loading = true;
        vnode.state.syncing = false;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 }),
            TaskService.list(owner, repo, { per_page: 1 }),
            ReleaseService.list(owner, repo)
        ]).then(([repoResult, issuesResult, prsResult, tasksResult, releasesResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.releases = releasesResult.data || releasesResult || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load project:', error);
            vnode.state.loading = false;
            m.redraw();
        });
    },
    
    syncReleases(vnode) {
        const { owner, repo } = vnode.attrs;
        vnode.state.syncing = true;
        
        ReleaseService.sync(owner, repo).then(result => {
            vnode.state.syncing = false;
            return ReleaseService.list(owner, repo);
        }).then(releasesResult => {
            vnode.state.releases = releasesResult.data || releasesResult || [];
            m.redraw();
        }).catch(error => {
            console.error('Failed to sync releases:', error);
            vnode.state.syncing = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, issuesCount, prsCount, releases, loading, syncing } = vnode.state;
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
                    activeTab: 'releases'
                }),
                
                m('div.releases-content', [
                    m('div.releases-header', [
                        m('h1', '发布'),
                        repo.is_mirror ? m('button.btn.btn-primary', {
                            onclick: () => ReleasesPage.syncReleases(vnode),
                            disabled: syncing
                        }, [
                            m('i.fas.fa-sync', { class: syncing ? 'fa-spin' : '' }),
                            syncing ? ' 同步中...' : ' 从 GitHub 同步'
                        ]) : null
                    ]),
                    
                    releases.length === 0 ? 
                        m(EmptyState, { 
                            message: repo.is_mirror ? '暂无发布版本，点击上方按钮从 GitHub 同步' : '暂无发布版本', 
                            icon: 'fa-cube' 
                        }) :
                        releases.map((release, index) => 
                            m('div.release-card', [
                                m('div.release-header', [
                                    m('div.release-info', [
                                        m('div.release-title-row', [
                                            m('h2.release-title', m('a', { href: '#' }, release.tag_name)),
                                            index === 0 ? m('span.release-tag.latest', '最新版本') : null,
                                            release.is_prerelease ? m('span.release-tag.prerelease', '预发布') : null,
                                            release.is_draft ? m('span.release-tag.draft', '草稿') : null
                                        ]),
                                        m('div.release-meta', [
                                            m('span.release-meta-item', [
                                                m('i.fas.fa-tag'),
                                                ` ${release.tag_name}`
                                            ]),
                                            m('span.release-meta-item', [
                                                m('i.fas.fa-user'),
                                                ` ${release.author.username || 'unknown'}`
                                            ]),
                                            m('span.release-meta-item', [
                                                m('i.fas.fa-clock'),
                                                ` ${Utils.formatDate(release.created_at)}`
                                            ])
                                        ])
                                    ])
                                ]),
                                release.body ? m('div.release-body', [
                                    m('div.release-notes', [
                                        m(MarkdownRenderer, { content: release.body })
                                    ])
                                ]) : null
                            ])
                        )
                ])
            ])
        ]);
    }
};

const StatsPage = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.issuesCount = 0;
        vnode.state.prsCount = 0;
        vnode.state.tasksCount = 0;
        vnode.state.contributors = [];
        vnode.state.codeStats = null;
        vnode.state.commitActivity = [];
        vnode.state.loading = true;
        vnode.state.statsLoading = true;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 }),
            RepositoryService.getContributors(owner, repo),
            TaskService.list(owner, repo, { per_page: 1 })
        ]).then(([repoResult, issuesResult, prsResult, contributorsResult, tasksResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).length;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.contributors = contributorsResult.data || contributorsResult || [];
            vnode.state.tasksCount = tasksResult.total || 0;
            vnode.state.loading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load project:', error);
            vnode.state.loading = false;
            m.redraw();
        });
        
        Promise.all([
            RepositoryService.getCodeStats(owner, repo),
            RepositoryService.getCommitActivity(owner, repo, 30)
        ]).then(([codeStatsResult, activityResult]) => {
            vnode.state.codeStats = codeStatsResult.data || codeStatsResult;
            vnode.state.commitActivity = activityResult.activity || [];
            vnode.state.statsLoading = false;
            m.redraw();
        }).catch(error => {
            console.error('Failed to load stats:', error);
            vnode.state.statsLoading = false;
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, issuesCount, prsCount, contributors, loading, codeStats, commitActivity, statsLoading } = vnode.state;
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
                                m('div.stat-value', issuesCount),
                                m('div.stat-label', '议题')
                            ])
                        ])
                    ]),
                    
                    codeStats ? m('div.code-stats-section', [
                        m('h2', [m('i.fas.fa-code'), ' 代码统计']),
                        
                        statsLoading ? 
                            m('div.loading-spinner', '加载中...') :
                            m('div.code-stats-grid', [
                                m('div.code-stat-card', [
                                    m('div.code-stat-icon', m('i.fas.fa-file-code')),
                                    m('div.code-stat-info', [
                                        m('div.code-stat-value', formatNumber(codeStats.total_lines)),
                                        m('div.code-stat-label', '总行数')
                                    ])
                                ]),
                                m('div.code-stat-card', [
                                    m('div.code-stat-icon', { style: { color: '#4CAF50' } }, m('i.fas.fa-code')),
                                    m('div.code-stat-info', [
                                        m('div.code-stat-value', formatNumber(codeStats.code_lines)),
                                        m('div.code-stat-label', '代码行')
                                    ])
                                ]),
                                m('div.code-stat-card', [
                                    m('div.code-stat-icon', { style: { color: '#FF9800' } }, m('i.fas.fa-comment')),
                                    m('div.code-stat-info', [
                                        m('div.code-stat-value', formatNumber(codeStats.comment_lines)),
                                        m('div.code-stat-label', '注释行')
                                    ])
                                ]),
                                m('div.code-stat-card', [
                                    m('div.code-stat-icon', { style: { color: '#9E9E9E' } }, m('i.fas.fa-minus')),
                                    m('div.code-stat-info', [
                                        m('div.code-stat-value', formatNumber(codeStats.blank_lines)),
                                        m('div.code-stat-label', '空行')
                                    ])
                                ])
                            ]),
                        
                        codeStats.languages && Object.keys(codeStats.languages).length > 0 ?
                            m('div.language-stats', [
                                m('h3', '语言分布'),
                                m('div.language-bars', Object.entries(codeStats.languages)
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 8)
                                    .map(([lang, lines]) => {
                                        const total = codeStats.code_lines || 1;
                                        const percentage = (lines / total * 100).toFixed(1);
                                        return m('div.language-bar-item', [
                                            m('div.language-bar-header', [
                                                m('span.language-name', lang),
                                                m('span.language-count', `${formatNumber(lines)} 行 (${percentage}%)`)
                                            ]),
                                            m('div.language-bar-track', [
                                                m('div.language-bar-fill', {
                                                    style: {
                                                        width: percentage + '%',
                                                        background: getLanguageColor(lang)
                                                    }
                                                })
                                            ])
                                        ]);
                                    }))
                            ]) : null
                    ]) : null,
                    
                    commitActivity && commitActivity.length > 0 ? m('div.commit-activity-section', [
                        m('h2', [m('i.fas.fa-chart-line'), ' 提交活动趋势']),
                        
                        m('div.activity-chart-container', [
                            m('svg.activity-chart', {
                                viewBox: '0 0 900 300',
                                preserveAspectRatio: 'xMidYMid meet'
                            }, [
                                m('defs', [
                                    m('linearGradient#activityGradient', {
                                        x1: '0%', y1: '0%',
                                        x2: '0%', y2: '100%'
                                    }, [
                                        m('stop', { offset: '0%', style: 'stop-color:var(--primary-color);stop-opacity:0.4' }),
                                        m('stop', { offset: '100%', style: 'stop-color:var(--primary-color);stop-opacity:0.05' })
                                    ]),
                                    m('filter#shadow', [
                                        m('feDropShadow', {
                                            dx: '0',
                                            dy: '2',
                                            stdDeviation: '3',
                                            'flood-color': 'var(--primary-color)',
                                            'flood-opacity': '0.3'
                                        })
                                    ])
                                ]),
                                
                                renderEnhancedChart(commitActivity)
                            ])
                        ]),
                        
                        m('div.activity-legend', [
                            m('div.legend-item', [
                                m('span.legend-dot', { style: { background: 'var(--primary-color)' } }),
                                '提交数'
                            ]),
                            m('div.legend-item', [
                                m('span.legend-bar', { style: { background: '#4CAF50' } }),
                                '添加行'
                            ]),
                            m('div.legend-item', [
                                m('span.legend-bar', { style: { background: '#F44336' } }),
                                '删除行'
                            ])
                        ]),
                        
                        m('div.activity-summary', [
                            m('div.summary-item', [
                                m('span.summary-label', '总提交数'),
                                m('span.summary-value', commitActivity.reduce((sum, a) => sum + a.count, 0))
                            ]),
                            m('div.summary-item', [
                                m('span.summary-label', '添加行'),
                                m('span.summary-value.additions', '+' + formatNumber(commitActivity.reduce((sum, a) => sum + (a.additions || 0), 0)))
                            ]),
                            m('div.summary-item', [
                                m('span.summary-label', '删除行'),
                                m('span.summary-value.deletions', '-' + formatNumber(commitActivity.reduce((sum, a) => sum + (a.deletions || 0), 0)))
                            ]),
                            m('div.summary-item', [
                                m('span.summary-label', '最活跃日'),
                                m('span.summary-value.highlight', (() => {
                                    const maxDay = commitActivity.reduce((max, a) => a.count > max.count ? a : max, commitActivity[0]);
                                    return maxDay.date;
                                })())
                            ])
                        ])
                    ]) : null,
                    
                    m('div.stats-section', [
                        m('h2', [m('i.fas.fa-users'), ' 贡献者']),
                        contributors.length === 0 
                            ? m(EmptyState, { 
                                message: '暂无贡献者', 
                                icon: 'fa-users' 
                            })
                            : m('div.contributors-grid', contributors.map((contributor, index) => {
                                const maxCommits = Math.max(...contributors.map(c => c.commits_count || 0), 1);
                                const commitPercent = ((contributor.commits_count || 0) / maxCommits * 100).toFixed(0);
                                
                                return m('div.contributor-card', [
                                    m('div.contributor-rank', {
                                        style: {
                                            background: index === 0 ? '#FFD700' : 
                                                       index === 1 ? '#C0C0C0' : 
                                                       index === 2 ? '#CD7F32' : 'var(--bg-tertiary)',
                                            color: index < 3 ? '#fff' : 'var(--text-secondary)'
                                        }
                                    }, `#${index + 1}`),
                                    
                                    m('img.contributor-avatar', { 
                                        src: contributor.avatar || '/images/avatar-80.svg', 
                                        alt: contributor.name,
                                        loading: 'lazy'
                                    }),
                                    
                                    m('div.contributor-details', [
                                        m('div.contributor-header', [
                                            m('span.contributor-name', contributor.name),
                                            m('span.contributor-commits', `${contributor.commits_count || 0} commits`)
                                        ]),
                                        
                                        m('div.contributor-bar-container', [
                                            m('div.contributor-bar', {
                                                style: {
                                                    width: commitPercent + '%',
                                                    background: index === 0 ? 'linear-gradient(90deg, #FFD700, #FFA500)' :
                                                               index === 1 ? 'linear-gradient(90deg, #C0C0C0, #A8A8A8)' :
                                                               index === 2 ? 'linear-gradient(90deg, #CD7F32, #8B4513)' :
                                                               `linear-gradient(90deg, var(--primary-color), var(--secondary-color))`
                                                }
                                            })
                                        ])
                                    ])
                                ]);
                            }))
                    ])
                ])
            ])
        ]);
    }
};

function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function getLanguageColor(lang) {
    const colors = {
        'Go': '#00ADD8',
        'JavaScript': '#F7DF1E',
        'TypeScript': '#3178C6',
        'Python': '#3776AB',
        'Ruby': '#CC342D',
        'Java': '#ED8B00',
        'C': '#A8B9CC',
        'C++': '#00599C',
        'C#': '#239120',
        'PHP': '#777BB4',
        'HTML': '#E34C26',
        'CSS': '#563D7C',
        'SCSS': '#CC6699',
        'Rust': '#DEA584',
        'Swift': '#FA7343',
        'Kotlin': '#A97BFF',
        'Scala': '#DC322F',
        'Lua': '#000080',
        'SQL': '#4479A1',
        'Shell': '#89E051',
        'YAML': '#CB171E',
        'XML': '#E34C26',
        'Markdown': '#083FA1',
        'Other': '#959DA5'
    };
    return colors[lang] || colors['Other'];
}

function renderEnhancedChart(activity) {
    if (!activity || activity.length === 0) return null;
    
    const chartWidth = 850;
    const chartHeight = 250;
    const padding = { top: 30, right: 30, bottom: 40, left: 50 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;
    
    const maxCount = Math.max(...activity.map(a => a.count), 1);
    const maxAdditions = Math.max(...activity.map(a => a.additions || 0), 1);
    const maxDeletions = Math.max(...activity.map(a => a.deletions || 0), 1);
    
    const elements = [];
    
    // 网格线
    for (let i = 0; i <= 5; i++) {
        const y = padding.top + (innerHeight / 5) * i;
        elements.push(m('line', {
            x1: padding.left,
            y1: y,
            x2: chartWidth - padding.right,
            y2: y,
            stroke: '#e5e7eb',
            'stroke-width': '1',
            'stroke-dasharray': '4,4'
        }));
        
        const value = Math.round(maxCount * (5 - i) / 5);
        elements.push(m('text', {
            x: padding.left - 10,
            y: y + 4,
            'text-anchor': 'end',
            'font-size': '11',
            fill: '#9CA3AF'
        }, value.toString()));
    }
    
    // X轴日期标签
    const labelInterval = Math.ceil(activity.length / 7);
    activity.forEach((a, i) => {
        if (i % labelInterval === 0) {
            const x = padding.left + (i / (activity.length - 1)) * innerWidth;
            elements.push(m('text', {
                x: x,
                y: chartHeight - 10,
                'text-anchor': 'middle',
                'font-size': '10',
                fill: '#9CA3AF'
            }, a.date.substring(5)));
        }
    });
    
    // 面积图路径
    const areaPoints = activity.map((a, i) => {
        const x = padding.left + (i / (activity.length - 1)) * innerWidth;
        const y = padding.top + innerHeight - (a.count / maxCount) * innerHeight;
        return `${x},${y}`;
    });
    
    const areaPath = `M ${padding.left},${padding.top + innerHeight} L ${areaPoints.join(' L')} L ${padding.left + innerWidth},${padding.top + innerHeight} Z`;
    
    elements.push(m('path', {
        d: areaPath,
        fill: 'url(#activityGradient)',
        stroke: 'none'
    }));
    
    // 折线路径
    const linePath = `M ${areaPoints.join(' L')}`;
    
    elements.push(m('path', {
        d: linePath,
        fill: 'none',
        stroke: 'var(--primary-color)',
        'stroke-width': '3',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        filter: 'url(#shadow)'
    }));
    
    // 数据点和工具提示
    activity.forEach((a, i) => {
        if (a.count > 0) {
            const x = padding.left + (i / (activity.length - 1)) * innerWidth;
            const y = padding.top + innerHeight - (a.count / maxCount) * innerHeight;
            
            elements.push(m('circle', {
                cx: x,
                cy: y,
                r: '6',
                fill: '#fff',
                stroke: 'var(--primary-color)',
                'stroke-width': '2.5',
                style: { cursor: 'pointer' },
                title: `${a.date}\n提交: ${a.count} 次\n添加: +${a.additions || 0} 行\n删除: -${a.deletions || 0} 行`
            }));
            
            // 悬停时显示数值
            if (a.count >= maxCount * 0.8) {
                elements.push(m('text', {
                    x: x,
                    y: y - 12,
                    'text-anchor': 'middle',
                    'font-size': '11',
                    'font-weight': '600',
                    fill: 'var(--primary-color)'
                }, a.count.toString()));
            }
        }
    });
    
    // X轴线
    elements.push(m('line', {
        x1: padding.left,
        y1: padding.top + innerHeight,
        x2: chartWidth - padding.right,
        y2: padding.top + innerHeight,
        stroke: '#D1D5DB',
        'stroke-width': '2'
    }));
    
    // Y轴线
    elements.push(m('line', {
        x1: padding.left,
        y1: padding.top,
        x2: padding.left,
        y2: padding.top + innerHeight,
        stroke: '#D1D5DB',
        'stroke-width': '2'
    }));
    
    return elements;
}

export { ReleasesPage, StatsPage };
