import { Layout, Loading, EmptyState } from '../components.js';
import { GroupService } from '../api.js';

const Groups = {
    oninit(vnode) {
        vnode.state.groups = [];
        vnode.state.loading = true;
        vnode.state.page = 1;
        vnode.state.perPage = 30;

        GroupService.list(1, 30).then(result => {
            vnode.state.groups = result.data || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    view(vnode) {
        const { groups, loading } = vnode.state;

        return m(Layout, [
            m('div.page-header', [
                m('h1', [m('i.fas.fa-users'), ' 群组']),
                m('div.page-actions', [
                    m('button.btn.btn-primary', {
                        onclick: () => m.route.set('/groups/new')
                    }, [m('i.fas.fa-plus'), ' 新建群组'])
                ])
            ]),

            loading ? m(Loading) : [
                groups.length === 0 
                    ? m(EmptyState, { message: '暂无群组', icon: 'fa-users' })
                    : m('div.groups-list', groups.map(group => 
                        m('div.group-card', {
                            onclick: () => m.route.set(`/groups/${group.name}`)
                        }, [
                            m('div.group-avatar', [
                                group.avatar 
                                    ? m('img', { src: group.avatar, alt: group.name })
                                    : m('div.avatar-placeholder', group.display_name ? group.display_name[0].toUpperCase() : group.name[0].toUpperCase())
                            ]),
                            m('div.group-info', [
                                m('h3.group-name', group.display_name || group.name),
                                group.description ? m('p.group-description', group.description) : null,
                                m('div.group-meta', [
                                    m('span', [m('i.fas.fa-users'), ` ${group.members_count || 0} 成员`]),
                                    group.location ? m('span', [m('i.fas.fa-map-marker-alt'), ` ${group.location}`]) : null,
                                    group.website ? m('a', { href: group.website, target: '_blank', onclick: e => e.stopPropagation() }, [m('i.fas.fa-globe')]) : null
                                ])
                            ])
                        ])
                    ))
            ]
        ]);
    }
};

const GroupDetail = {
    oninit(vnode) {
        const { name } = vnode.attrs;
        vnode.state.group = null;
        vnode.state.loading = true;

        GroupService.get(name).then(result => {
            vnode.state.group = result;
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    view(vnode) {
        const { group, loading } = vnode.state;

        if (loading) {
            return m(Layout, m(Loading));
        }

        if (!group) {
            return m(Layout, m(EmptyState, { message: '群组不存在', icon: 'fa-users' }));
        }

        return m(Layout, [
            m('div.group-detail-page', [
                m('div.group-header', [
                    m('div.group-avatar-large', [
                        group.avatar 
                            ? m('img', { src: group.avatar, alt: group.name })
                            : m('div.avatar-placeholder', group.display_name ? group.display_name[0].toUpperCase() : group.name[0].toUpperCase())
                    ]),
                    m('div.group-info', [
                        m('h1', group.display_name || group.name),
                        group.description ? m('p.group-description', group.description) : null,
                        m('div.group-meta', [
                            m('span', [m('i.fas.fa-users'), ` ${group.members_count || 0} 成员`]),
                            group.location ? m('span', [m('i.fas.fa-map-marker-alt'), ` ${group.location}`]) : null,
                            group.website ? m('a', { href: group.website, target: '_blank' }, [m('i.fas.fa-globe'), ' 网站']) : null
                        ])
                    ])
                ]),

                m('div.group-tabs', [
                    m('a.tab.active', { href: '#' }, '概览'),
                    m('a.tab', { href: '#' }, '成员'),
                    m('a.tab', { href: '#' }, '项目'),
                    m('a.tab', { href: '#' }, '设置')
                ]),

                m('div.group-content', [
                    m('div.info-section', [
                        m('h3', '群组信息'),
                        m('div.info-row', [m('strong', '名称: '), group.name]),
                        m('div.info-row', [m('strong', '创建时间: '), group.created_at])
                    ])
                ])
            ])
        ]);
    }
};

const NewGroup = {
    oninit(vnode) {
        vnode.state.form = {
            name: '',
            display_name: '',
            description: '',
            website: '',
            location: ''
        };
        vnode.state.submitting = false;
    },

    submit(vnode) {
        if (!vnode.state.form.name) {
            alert('请输入群组名称');
            return;
        }

        vnode.state.submitting = true;
        GroupService.create(vnode.state.form).then(result => {
            m.route.set(`/groups/${result.name}`);
        }).catch(error => {
            vnode.state.submitting = false;
            alert('创建失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { form, submitting } = vnode.state;

        return m(Layout, [
            m('div.page-header', [
                m('h1', [m('i.fas.fa-users'), ' 新建群组'])
            ]),

            m('div.form-container', [
                m('div.form-group', [
                    m('label', '群组名称 *'),
                    m('input.form-input', {
                        type: 'text',
                        value: form.name,
                        oninput: e => { form.name = e.target.value; },
                        placeholder: '例如: my-group'
                    })
                ]),

                m('div.form-group', [
                    m('label', '显示名称'),
                    m('input.form-input', {
                        type: 'text',
                        value: form.display_name,
                        oninput: e => { form.display_name = e.target.value; },
                        placeholder: '例如: 我的群组'
                    })
                ]),

                m('div.form-group', [
                    m('label', '描述'),
                    m('textarea.form-input', {
                        value: form.description,
                        oninput: e => { form.description = e.target.value; },
                        placeholder: '群组描述',
                        rows: 3
                    })
                ]),

                m('div.form-group', [
                    m('label', '网站'),
                    m('input.form-input', {
                        type: 'url',
                        value: form.website,
                        oninput: e => { form.website = e.target.value; },
                        placeholder: 'https://example.com'
                    })
                ]),

                m('div.form-group', [
                    m('label', '位置'),
                    m('input.form-input', {
                        type: 'text',
                        value: form.location,
                        oninput: e => { form.location = e.target.value; },
                        placeholder: '例如: 北京'
                    })
                ]),

                m('div.form-actions', [
                    m('button.btn.btn-primary', {
                        onclick: () => NewGroup.submit(vnode),
                        disabled: submitting
                    }, submitting ? '创建中...' : '创建群组'),
                    m('button.btn', {
                        onclick: () => m.route.set('/groups')
                    }, '取消')
                ])
            ])
        ]);
    }
};

export { Groups, GroupDetail, NewGroup };
