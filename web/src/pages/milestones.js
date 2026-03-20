import { Layout, Loading, EmptyState } from '../components.js';
import { MilestoneService } from '../api.js';

const Milestones = {
    oninit(vnode) {
        const { owner, repo } = vnode.attrs;
        vnode.state.milestones = [];
        vnode.state.loading = true;

        MilestoneService.list(owner, repo).then(result => {
            vnode.state.milestones = result.data || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    formatDate(dateStr) {
        if (!dateStr) return '无截止日期';
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN');
    },

    isOverdue(dateStr) {
        if (!dateStr) return false;
        return new Date(dateStr) < new Date();
    },

    view(vnode) {
        const { milestones, loading } = vnode.state;
        const { owner, repo } = vnode.attrs;
        const self = vnode.state;

        return m('div.milestones-section', [
            m('div.milestones-header', [
                m('h2', '里程碑'),
                m('button.btn.btn-primary', {
                    onclick: () => m.route.set(`/${owner}/${repo}/milestones/new`)
                }, [m('i.fas.fa-plus'), ' 新建里程碑'])
            ]),

            loading ? m(Loading) : [
                milestones.length === 0 
                    ? m(EmptyState, { message: '暂无里程碑', icon: 'fa-flag' })
                    : m('div.milestones-list', milestones.map(milestone => 
                        m('div.milestone-item', { class: milestone.is_closed ? 'closed' : '' }, [
                            m('div.milestone-icon', [
                                m(`i.fas.${milestone.is_closed ? 'fa-check-circle' : 'fa-flag'}`)
                            ]),
                            m('div.milestone-content', [
                                m('h3.milestone-title', [
                                    milestone.title,
                                    milestone.is_closed ? m('span.badge.closed', '已关闭') : null
                                ]),
                                milestone.description 
                                    ? m('p.milestone-description', milestone.description) : null,
                                m('div.milestone-meta', [
                                    m('span.due-date', {
                                        class: self.isOverdue(milestone.due_date) && !milestone.is_closed ? 'overdue' : ''
                                    }, [
                                        m('i.fas.fa-calendar'),
                                        ' 截止: ' + self.formatDate(milestone.due_date)
                                    ]),
                                    m('span.created', `创建于 ${milestone.created_at}`)
                                ])
                            ])
                        ])
                    ))
            ]
        ]);
    }
};

const NewMilestone = {
    oninit(vnode) {
        vnode.state.form = {
            title: '',
            description: '',
            due_date: ''
        };
        vnode.state.submitting = false;
    },

    submit(vnode) {
        const { owner, repo } = vnode.attrs;
        
        if (!vnode.state.form.title) {
            alert('请输入里程碑标题');
            return;
        }

        vnode.state.submitting = true;
        MilestoneService.create(owner, repo, vnode.state.form).then(result => {
            m.route.set(`/${owner}/${repo}/milestones`);
        }).catch(error => {
            vnode.state.submitting = false;
            alert('创建失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { form, submitting } = vnode.state;
        const { owner, repo } = vnode.attrs;

        return m('div.new-milestone-page', [
            m('div.page-header', [
                m('h2', '新建里程碑'),
                m('p', `为 ${owner}/${repo} 创建新里程碑`)
            ]),

            m('div.form-container', [
                m('div.form-group', [
                    m('label', '标题 *'),
                    m('input.form-input', {
                        type: 'text',
                        value: form.title,
                        oninput: e => { form.title = e.target.value; },
                        placeholder: '例如: v1.0.0'
                    })
                ]),

                m('div.form-group', [
                    m('label', '描述'),
                    m('textarea.form-input', {
                        value: form.description,
                        oninput: e => { form.description = e.target.value; },
                        placeholder: '里程碑描述',
                        rows: 4
                    })
                ]),

                m('div.form-group', [
                    m('label', '截止日期'),
                    m('input.form-input', {
                        type: 'date',
                        value: form.due_date,
                        oninput: e => { form.due_date = e.target.value; }
                    })
                ]),

                m('div.form-actions', [
                    m('button.btn.btn-primary', {
                        onclick: () => NewMilestone.submit(vnode),
                        disabled: submitting
                    }, submitting ? '创建中...' : '创建里程碑'),
                    m('button.btn', {
                        onclick: () => m.route.set(`/${owner}/${repo}/milestones`)
                    }, '取消')
                ])
            ])
        ]);
    }
};

export { Milestones, NewMilestone };
