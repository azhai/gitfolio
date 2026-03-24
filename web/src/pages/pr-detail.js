import { Layout, Loading, ProjectHeader, ProjectTabs, EmptyState, formatTime } from '../components.js';
import { RepositoryService, IssueService, PullRequestService, API } from '../api.js';

const PRCommentService = {
    list(owner, repo, prNumber) {
        return API.get(`/${owner}/${repo}/merge_requests/${prNumber}/comments`);
    },
    
    create(owner, repo, prNumber, data) {
        return API.post(`/${owner}/${repo}/merge_requests/${prNumber}/comments`, data);
    }
};

const PullRequestDetail = {
    oninit(vnode) {
        const { owner, repo, number } = vnode.attrs;
        
        vnode.state.repo = null;
        vnode.state.pr = null;
        vnode.state.comments = [];
        vnode.state.loading = true;
        vnode.state.issuesCount = 0;
        vnode.state.prsCount = 0;
        vnode.state.editMode = false;
        vnode.state.editTitle = '';
        vnode.state.editBody = '';
        vnode.state.newComment = '';
        vnode.state.submitting = false;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            PullRequestService.get(owner, repo, number),
            IssueService.list(owner, repo),
            PullRequestService.list(owner, repo)
        ]).then(([repoResult, prResult, issuesResult, prsResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.pr = prResult.data || prResult;
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.editTitle = vnode.state.pr.title;
            vnode.state.editBody = vnode.state.pr.body || '';
            vnode.state.loading = false;
            vnode.state.loadComments();
            m.redraw();
        }).catch(error => {
            console.error('Failed to load pull request:', error);
            vnode.state.loading = false;
            m.redraw();
        });
        
        vnode.state.loadComments = function() {
            PRCommentService.list(owner, repo, number).then(result => {
                vnode.state.comments = result.data || result || [];
                m.redraw();
            }).catch(() => {
                vnode.state.comments = [];
            });
        };
    },
    
    handleSave: function(vnode) {
        const { owner, repo, number } = vnode.attrs;
        const { editTitle, editBody, submitting } = vnode.state;
        
        if (submitting) return;
        if (!editTitle.trim()) {
            alert('标题不能为空');
            return;
        }
        
        vnode.state.submitting = true;
        
        PullRequestService.update(owner, repo, number, {
            title: editTitle,
            body: editBody
        }).then(result => {
            vnode.state.pr = result.data || result;
            vnode.state.editMode = false;
            vnode.state.submitting = false;
            m.redraw();
        }).catch(error => {
            vnode.state.submitting = false;
            alert('保存失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },
    
    handleMerge: function(vnode) {
        const { owner, repo, number } = vnode.attrs;
        
        if (!confirm('确定要合并此 PR 吗？')) {
            return;
        }
        
        PullRequestService.merge(owner, repo, number).then(result => {
            vnode.state.pr = result.pr || vnode.state.pr;
            vnode.state.pr.is_merged = true;
            vnode.state.pr.is_closed = true;
            vnode.state.pr.status = 'merged';
            vnode.state.prsCount--;
            m.redraw();
        }).catch(error => {
            alert('合并失败: ' + (error.message || '未知错误'));
        });
    },
    
    handleClose: function(vnode) {
        const { owner, repo, number } = vnode.attrs;
        
        if (!confirm('确定要关闭此 PR 吗？')) {
            return;
        }
        
        PullRequestService.close(owner, repo, number).then(result => {
            vnode.state.pr = result.pr || vnode.state.pr;
            vnode.state.pr.is_closed = true;
            vnode.state.pr.status = 'closed';
            vnode.state.prsCount--;
            m.redraw();
        }).catch(error => {
            alert('关闭失败: ' + (error.message || '未知错误'));
        });
    },
    
    handleReopen: function(vnode) {
        const { owner, repo, number } = vnode.attrs;
        
        if (!confirm('确定要重新打开此 PR 吗？')) {
            return;
        }
        
        PullRequestService.reopen(owner, repo, number).then(result => {
            vnode.state.pr = result.pr || vnode.state.pr;
            vnode.state.pr.is_closed = false;
            vnode.state.pr.is_merged = false;
            vnode.state.pr.status = 'open';
            vnode.state.prsCount++;
            m.redraw();
        }).catch(error => {
            alert('重新打开失败: ' + (error.message || '未知错误'));
        });
    },
    
    handleAddComment: function(vnode) {
        const { owner, repo, number } = vnode.attrs;
        const { newComment, submitting } = vnode.state;
        
        if (submitting) return;
        if (!newComment.trim()) {
            alert('评论内容不能为空');
            return;
        }
        
        vnode.state.submitting = true;
        
        PRCommentService.create(owner, repo, number, {
            body: newComment
        }).then(result => {
            vnode.state.comments.push(result.data || result);
            vnode.state.newComment = '';
            vnode.state.submitting = false;
            m.redraw();
        }).catch(error => {
            vnode.state.submitting = false;
            alert('评论失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },
    
    view(vnode) {
        const { repo, pr, comments, loading, editMode, editTitle, editBody, newComment, submitting } = vnode.state;
        const { owner, repo: repoName, number } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo || !pr) {
            return m(Layout, m(EmptyState, { message: 'PR 不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        let statusClass = 'open';
        let statusText = '开启';
        if (pr.is_merged) {
            statusClass = 'merged';
            statusText = '已合并';
        } else if (pr.is_closed) {
            statusClass = 'closed';
            statusText = '已关闭';
        }
        
        return m(Layout, [
            m('div.pr-detail-page', [
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
                    issuesCount: vnode.state.issuesCount,
                    prsCount: vnode.state.prsCount,
                    activeTab: 'prs'
                }),
                
                m('div.pr-detail-content', [
                    m('div.pr-detail-header', [
                        m('div.pr-title-row', [
                            m('div.pr-number', `#${pr.number}`),
                            editMode ? 
                                m('input.pr-title-input', {
                                    value: editTitle,
                                    oninput: (e) => { vnode.state.editTitle = e.target.value; }
                                }) :
                                m('h1.pr-title', pr.title),
                            m('div.pr-status-badge', { 
                                class: statusClass
                            }, statusText)
                        ]),
                        m('div.pr-meta', [
                            m('span', [
                                m('strong', pr.source_branch),
                                ' → ',
                                m('strong', pr.target_branch)
                            ]),
                            m('span', ' · '),
                            m('span', `由 ${pr.author || '未知'} 创建于 ${formatTime(pr.created_at)}`),
                            pr.updated_at !== pr.created_at ? 
                                m('span', ` · 更新于 ${formatTime(pr.updated_at)}`) : null
                        ])
                    ]),
                    
                    m('div.pr-detail-body', [
                        m('div.pr-main', [
                            m('div.pr-description', [
                                editMode ? [
                                    m('textarea.pr-body-textarea', {
                                        value: editBody,
                                        oninput: (e) => { vnode.state.editBody = e.target.value; },
                                        placeholder: '添加描述...'
                                    }),
                                    m('div.pr-edit-actions', [
                                        m('button.btn.btn-primary', {
                                            onclick: () => PullRequestDetail.handleSave(vnode),
                                            disabled: submitting
                                        }, submitting ? '保存中...' : '保存'),
                                        m('button.btn', {
                                            onclick: () => { vnode.state.editMode = false; }
                                        }, '取消')
                                    ])
                                ] : [
                                    m('div.pr-body', pr.body || '暂无描述'),
                                    m('div.pr-actions', [
                                        m('button.btn.btn-sm', {
                                            onclick: () => { vnode.state.editMode = true; }
                                        }, [m('i.fas.fa-edit'), ' 编辑']),
                                        !pr.is_closed && !pr.is_merged ? [
                                            m('button.btn.btn-sm.btn-success', {
                                                onclick: () => PullRequestDetail.handleMerge(vnode)
                                            }, [m('i.fas.fa-code-branch'), ' 合并']),
                                            m('button.btn.btn-sm', {
                                                onclick: () => PullRequestDetail.handleClose(vnode)
                                            }, [m('i.fas.fa-times'), ' 关闭'])
                                        ] : pr.is_closed && !pr.is_merged ? [
                                            m('button.btn.btn-sm', {
                                                onclick: () => PullRequestDetail.handleReopen(vnode)
                                            }, [m('i.fas.fa-redo'), ' 重新打开'])
                                        ] : null
                                    ])
                                ]
                            ]),
                            
                            m('div.pr-comments', [
                                m('h3', '评论'),
                                comments.length === 0 ? 
                                    m('p.no-comments', '暂无评论') :
                                    m('div.comment-list', comments.map(comment => 
                                        m('div.comment-item', [
                                            m('div.comment-header', [
                                                m('span.comment-author', comment.author),
                                                m('span.comment-time', formatTime(comment.created_at))
                                            ]),
                                            m('div.comment-body', comment.body)
                                        ])
                                    )),
                                
                                m('div.comment-form', [
                                    m('textarea.comment-input', {
                                        placeholder: '添加评论...',
                                        value: newComment,
                                        oninput: (e) => { vnode.state.newComment = e.target.value; }
                                    }),
                                    m('button.btn.btn-primary', {
                                        onclick: () => PullRequestDetail.handleAddComment(vnode),
                                        disabled: submitting || !newComment.trim()
                                    }, '发表评论')
                                ])
                            ])
                        ]),
                        
                        m('div.pr-sidebar', [
                            m('div.sidebar-card', [
                                m('h4', '源分支'),
                                m('p', pr.source_branch)
                            ]),
                            m('div.sidebar-card', [
                                m('h4', '目标分支'),
                                m('p', pr.target_branch)
                            ]),
                            m('div.sidebar-card', [
                                m('h4', '指派给'),
                                m('p', pr.assignee || '未指派')
                            ]),
                            m('div.sidebar-card', [
                                m('h4', '标签'),
                                m('p', '暂无标签')
                            ])
                        ])
                    ])
                ])
            ])
        ]);
    }
};

export { PullRequestDetail };
