import { Layout, Loading, EmptyState } from '../components.js';
import { ActivityService } from '../api.js';

const Activities = {
    oninit(vnode) {
        vnode.state.activities = [];
        vnode.state.loading = true;
        vnode.state.page = 1;

        ActivityService.list(1, 30).then(result => {
            vnode.state.activities = result.data || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    getActivityIcon(type) {
        const icons = {
            'create_repo': 'fa-plus-circle',
            'push': 'fa-upload',
            'star': 'fa-star',
            'fork': 'fa-code-branch',
            'issue': 'fa-exclamation-circle',
            'pr': 'fa-code-pull-request',
            'comment': 'fa-comment',
            'release': 'fa-tag',
            'default': 'fa-circle'
        };
        return icons[type] || icons['default'];
    },

    getActivityColor(type) {
        const colors = {
            'create_repo': '#28a745',
            'push': '#0366d6',
            'star': '#f1c40f',
            'fork': '#8b5cf6',
            'issue': '#e67e22',
            'pr': '#9b59b6',
            'comment': '#3498db',
            'release': '#2ecc71',
            'default': '#95a5a6'
        };
        return colors[type] || colors['default'];
    },

    formatTime(timeStr) {
        const date = new Date(timeStr);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes} 分钟前`;
        if (hours < 24) return `${hours} 小时前`;
        if (days < 7) return `${days} 天前`;
        return date.toLocaleDateString('zh-CN');
    },

    view(vnode) {
        const { activities, loading } = vnode.state;
        const self = vnode.state;

        return m(Layout, [
            m('div.page-header', [
                m('h1', [m('i.fas.fa-bolt'), ' 活动']),
                m('p.page-description', '查看所有用户的活动动态')
            ]),

            loading ? m(Loading) : [
                activities.length === 0 
                    ? m(EmptyState, { message: '暂无活动记录', icon: 'fa-bolt' })
                    : m('div.activity-timeline', activities.map(activity => 
                        m('div.activity-item', [
                            m('div.activity-icon', {
                                style: { backgroundColor: self.getActivityColor(activity.activity_type) }
                            }, [
                                m(`i.fas.${self.getActivityIcon(activity.activity_type)}`)
                            ]),
                            m('div.activity-content', [
                                m('div.activity-header', [
                                    activity.username 
                                        ? m('a.username', { href: '#', onclick: e => { e.preventDefault(); m.route.set(`/${activity.username}`); } }, activity.username)
                                        : m('span.username', '未知用户'),
                                    m('span.activity-title', activity.title || '进行了操作')
                                ]),
                                activity.repository 
                                    ? m('div.activity-repo', [
                                        m('i.fas.fa-book'),
                                        m('a', { 
                                            href: '#', 
                                            onclick: e => { e.preventDefault(); m.route.set(`/${activity.repository}`); } 
                                        }, activity.repository)
                                    ]) : null,
                                activity.content 
                                    ? m('div.activity-text', activity.content) : null,
                                m('div.activity-time', self.formatTime(activity.created_at))
                            ])
                        ])
                    ))
            ]
        ]);
    }
};

export { Activities };
