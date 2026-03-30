import { Layout, Loading, ProjectHeader, ProjectTabs, EmptyState, formatTime, MarkdownEditor, MarkdownRenderer } from '../components.js';
import { RepositoryService, IssueService, PullRequestService, API, LabelService } from '../api.js';

const CommentService = {
    list(owner, repo, issueNumber) {
        return API.get(`/${owner}/${repo}/issues/${issueNumber}/comments`);
    },
    
    create(owner, repo, issueNumber, data) {
        return API.post(`/${owner}/${repo}/issues/${issueNumber}/comments`, data);
    }
};

const IssueDetail = {
    oninit(vnode) {
        IssueDetail.loadData(vnode);
    },
    
    onbeforeupdate(vnode) {
        const { number: newNumber } = vnode.attrs;
        const { number: oldNumber } = vnode.state;
        
        if (newNumber !== oldNumber) {
            vnode.state.loading = true;
            vnode.state.comments = [];
            IssueDetail.loadData(vnode);
        }
    },
    
    loadData(vnode) {
        const { owner, repo, number } = vnode.attrs;
        
        vnode.state.number = number;
        vnode.state.repo = null;
        vnode.state.issue = null;
        vnode.state.labels = [];
        vnode.state.comments = [];
        vnode.state.loading = true;
        vnode.state.issuesCount = 0;
        vnode.state.prsCount = 0;
        vnode.state.editMode = false;
        vnode.state.editTitle = '';
        vnode.state.editBody = '';
        vnode.state.editLabels = [];
        vnode.state.newComment = '';
        vnode.state.submitting = false;
        
        Promise.all([
            RepositoryService.get(owner, repo),
            IssueService.get(owner, repo, number),
            IssueService.list(owner, repo, { state: 'all', per_page: 1000 }),
            PullRequestService.list(owner, repo, { state: 'all', per_page: 1000 }),
            LabelService.list(owner, repo)
        ]).then(([repoResult, issueResult, issuesResult, prsResult, labelsResult]) => {
            vnode.state.repo = repoResult.data || repoResult;
            vnode.state.issue = issueResult.data || issueResult;
            vnode.state.labels = labelsResult || [];
            vnode.state.issuesCount = (issuesResult.data || issuesResult || []).filter(i => !i.is_closed).length;
            vnode.state.prsCount = (prsResult.data || prsResult || []).filter(p => !p.is_closed && !p.is_merged).length;
            vnode.state.editTitle = vnode.state.issue.title;
            vnode.state.editBody = vnode.state.issue.body || '';
            vnode.state.editLabels = (vnode.state.issue.labels || []).map(l => l.name);
            vnode.state.loading = false;
            vnode.state.loadComments();
            m.redraw();
        }).catch(error => {
            console.error('Failed to load issue:', error);
            vnode.state.loading = false;
            m.redraw();
        });
        
        vnode.state.loadComments = function() {
            CommentService.list(owner, repo, number).then(result => {
                vnode.state.comments = result.data || result || [];
                m.redraw();
            }).catch(() => {
                vnode.state.comments = [];
            });
        };
    },
    
    handleSave: function(vnode) {
        const { owner, repo, number } = vnode.attrs;
        const { editTitle, editBody, editLabels, submitting } = vnode.state;
        
        if (submitting) return;
        if (!editTitle.trim()) {
            alert('标题不能为空');
            return;
        }
        
        vnode.state.submitting = true;
        
        IssueService.update(owner, repo, number, {
            title: editTitle,
            body: editBody,
            labels: editLabels
        }).then(result => {
            vnode.state.issue = result.data || result;
            vnode.state.editMode = false;
            vnode.state.submitting = false;
            m.redraw();
        }).catch(error => {
            vnode.state.submitting = false;
            alert('保存失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },
    
    handleClose: function(vnode) {
        const { owner, repo, number } = vnode.attrs;
        const { issue } = vnode.state;
        
        if (!confirm(issue.is_closed ? '确定要重新打开此 Issue 吗？' : '确定要关闭此 Issue 吗？')) {
            return;
        }
        
        IssueService.update(owner, repo, number, {
            is_closed: !issue.is_closed
        }).then(result => {
            vnode.state.issue = result.data || result;
            vnode.state.issuesCount += issue.is_closed ? 1 : -1;
            m.redraw();
        }).catch(error => {
            alert('操作失败: ' + (error.message || '未知错误'));
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
        
        CommentService.create(owner, repo, number, {
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
        const { repo, issue, labels, comments, loading, editMode, editTitle, editBody, editLabels, newComment, submitting } = vnode.state;
        const { owner, repo: repoName, number } = vnode.attrs;
        
        if (loading) {
            return m(Layout, m(Loading));
        }
        
        if (!repo || !issue) {
            return m(Layout, m(EmptyState, { message: 'Issue 不存在', icon: 'fa-exclamation-triangle' }));
        }
        
        return m(Layout, [
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
                activeTab: 'issues'
            }),
            
            m('div.issue-detail-content', [
                m('div.issue-detail-header', [
                    m('div.issue-title-row', [
                        m('div.issue-number', `#${issue.number}`),
                        editMode ? 
                            m('input.issue-title-input', {
                                value: editTitle,
                                oninput: (e) => { vnode.state.editTitle = e.target.value; }
                            }) :
                            m('h1.issue-title', issue.title),
                        m('div.issue-status-badge', { 
                            class: issue.is_closed ? 'closed' : 'open' 
                        }, issue.is_closed ? '已关闭' : '开启')
                    ]),
                    m('div.issue-meta', [
                        m('span', `由 ${issue.author} 创建于 ${formatTime(issue.created_at)}`),
                        issue.updated_at !== issue.created_at ? 
                            m('span', ` · 更新于 ${formatTime(issue.updated_at)}`) : null
                    ])
                ]),
                
                m('div.issue-detail-body', [
                    m('div.issue-main', [
                        m('div.issue-description', [
                            editMode ? [
                                m('div.form-group', [
                                    m('label.form-label', '描述'),
                                    m(MarkdownEditor, {
                                        value: editBody,
                                        oninput: (e) => { vnode.state.editBody = e.target.value; },
                                        placeholder: '添加描述... (支持 Markdown 格式)',
                                        rows: 10,
                                        owner: owner,
                                        repo: repo.name
                                    })
                                ]),
                                m('div.issue-edit-actions', [
                                    m('button.btn.btn-primary', {
                                        onclick: () => IssueDetail.handleSave(vnode),
                                        disabled: submitting
                                    }, submitting ? '保存中...' : '保存'),
                                    m('button.btn', {
                                        onclick: () => { 
                                            vnode.state.editMode = false; 
                                            vnode.state.editLabels = (issue.labels || []).map(l => l.name);
                                        }
                                    }, '取消')
                                ])
                            ] : [
                                m('div.issue-body', [
                                    m(MarkdownRenderer, { content: issue.body || '暂无描述', owner, repo: repo.name })
                                ]),
                                m('div.issue-actions', [
                                    m('button.btn.btn-sm', {
                                        onclick: () => { 
                                            vnode.state.editMode = true; 
                                            vnode.state.editLabels = (issue.labels || []).map(l => l.name);
                                        }
                                    }, [m('i.fas.fa-edit'), ' 编辑']),
                                    m('button.btn.btn-sm', {
                                        onclick: () => IssueDetail.handleClose(vnode)
                                    }, issue.is_closed ? [m('i.fas.fa-redo'), ' 重新打开'] : [m('i.fas.fa-times'), ' 关闭'])
                                ])
                            ]
                        ]),
                        
                        m('div.issue-comments', [
                            m('h3', '评论'),
                            comments.length === 0 ? 
                                m('p.no-comments', '暂无评论') :
                                m('div.comment-list', comments.map(comment => 
                                    m('div.comment-item', [
                                        m('div.comment-header', [
                                            m('span.comment-author', comment.author),
                                            m('span.comment-time', formatTime(comment.created_at))
                                        ]),
                                        m('div.comment-body', [
                                            m(MarkdownRenderer, { content: comment.body, owner, repo: repo.name })
                                        ])
                                    ])
                                )),
                            
                            m('div.comment-form', [
                                m('textarea.comment-input', {
                                    placeholder: '添加评论...',
                                    value: newComment,
                                    oninput: (e) => { vnode.state.newComment = e.target.value; }
                                }),
                                m('button.btn.btn-primary', {
                                    onclick: () => IssueDetail.handleAddComment(vnode),
                                    disabled: submitting || !newComment.trim()
                                }, '发表评论')
                            ])
                        ])
                    ]),
                    
                    m('div.issue-sidebar', [
                        m('div.sidebar-card', [
                            m('h4', '指派给'),
                            m('p', issue.assignee || '未指派')
                        ]),
                        m('div.sidebar-card', [
                            m('h4', '标签'),
                            editMode ? 
                                m('div.labels-editor', labels.map(label => 
                                    m('button.btn.btn-sm.label-btn', {
                                        type: 'button',
                                        class: editLabels.includes(label.name) ? 'active' : '',
                                        style: editLabels.includes(label.name) ? `background-color: ${label.color}; color: white; border-color: ${label.color};` : `border-color: ${label.color};`,
                                        onclick: () => {
                                            if (editLabels.includes(label.name)) {
                                                vnode.state.editLabels = editLabels.filter(l => l !== label.name);
                                            } else {
                                                vnode.state.editLabels.push(label.name);
                                            }
                                        }
                                    }, label.name)
                                )) :
                                (issue.labels && issue.labels.length > 0 ? 
                                    m('div.issue-labels-list', issue.labels.map(label => 
                                        m('span.issue-label', { style: { backgroundColor: label.color } }, label.name)
                                    )) :
                                    m('p', '暂无标签')
                                )
                        ])
                    ])
                ])
            ])
        ]);
    }
};

export { IssueDetail };
