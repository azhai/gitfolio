import { Layout, Loading, EmptyState } from '../components.js';
import { GroupService, UserService, API } from '../api.js';

const Groups = {
    oninit(vnode) {
        vnode.state.groups = [];
        vnode.state.users = [];
        vnode.state.groupMembers = {};
        vnode.state.loading = true;
        vnode.state.searchQuery = '';
        vnode.state.activeTab = 'groups';

        Promise.allSettled([
            GroupService.list(),
            API.get('/users')
        ]).then(([groupsResult, usersResult]) => {
            if (groupsResult.status === 'fulfilled') {
                vnode.state.groups = groupsResult.value.data || [];
            }
            if (usersResult.status === 'fulfilled') {
                vnode.state.users = usersResult.value.data || usersResult.value || [];
            }
            let membersPromise = Promise.resolve();
            if (vnode.state.groups.length > 0) {
                membersPromise = Promise.all(
                    vnode.state.groups.map(g =>
                        GroupService.getMembers(g.name)
                            .then(members => { vnode.state.groupMembers[g.name] = members.data || []; })
                            .catch(() => { vnode.state.groupMembers[g.name] = []; })
                    )
                );
            }
            return membersPromise;
        }).then(() => {
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    filteredGroups(vnode) {
        const q = (vnode.state.searchQuery || '').toLowerCase();
        if (!q) return vnode.state.groups;
        return vnode.state.groups.filter(g =>
            (g.display_name || g.name).toLowerCase().includes(q) ||
            (g.description || '').toLowerCase().includes(q) ||
            (vnode.state.groupMembers[g.name] || []).some(m =>
                (m.user.username || '').toLowerCase().includes(q) ||
                (m.user.full_name || '').toLowerCase().includes(q) ||
                (m.user.email || '').toLowerCase().includes(q)
            )
        );
    },

    filteredUsers(vnode) {
        const q = (vnode.state.searchQuery || '').toLowerCase();
        if (!q) return vnode.state.users;
        return vnode.state.users.filter(u =>
            (u.full_name || u.username || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q) ||
            (u.bio || '').toLowerCase().includes(q)
        );
    },

    view(vnode) {
        const { groups, users, loading, searchQuery, activeTab } = vnode.state;

        const filteredGroups = Groups.filteredGroups(vnode);
        const filteredUsers = Groups.filteredUsers(vnode);

        return m(Layout, [
            m('div.page-header', [
                m('h1', [m('i.fas.fa-users'), ' 团队与账号']),
                m('div.page-actions', [
                    m('button.btn.btn-primary', {
                        onclick: () => m.route.set('/groups/new')
                    }, [m('i.fas.fa-plus'), ' 新建团队'])
                ])
            ]),

            m('div.search-bar', [
                m('div.search-input-wrapper', [
                    m('i.fas.fa-search'),
                    m('input.form-input.search-input', {
                        type: 'text',
                        placeholder: '搜索团队、成员、账号...',
                        value: searchQuery,
                        oninput: e => { vnode.state.searchQuery = e.target.value; }
                    }),
                    searchQuery ? m('button.search-clear', {
                        onclick: () => { vnode.state.searchQuery = ''; }
                    }, m('i.fas.fa-times')) : null
                ])
            ]),

            m('div.tabs-bar', [
                m('a.tab' + (activeTab === 'groups' ? '.active' : ''), {
                    onclick: () => { vnode.state.activeTab = 'groups'; }
                }, [m('i.fas.fa-users-cog'), ` 团队 (${filteredGroups.length})`]),
                m('a.tab' + (activeTab === 'accounts' ? '.active' : ''), {
                    onclick: () => { vnode.state.activeTab = 'accounts'; }
                }, [m('i.fas.fa-user-circle'), ` 账号 (${filteredUsers.length})`])
            ]),

            loading ? m(Loading) :
            activeTab === 'groups' ? m('div.groups-page', [
                filteredGroups.length === 0 && !searchQuery && groups.length === 0
                    ? m(EmptyState, { message: '暂无团队', icon: 'fa-users' })
                    : filteredGroups.length === 0 && searchQuery
                    ? m(EmptyState, { message: '未找到匹配的团队', icon: 'fa-search' })
                    : m('div.groups-list', filteredGroups.map(group => {
                        const members = vnode.state.groupMembers[group.name] || [];
                        return m('div.group-card', {
                            onclick: () => m.route.set(`/groups/${group.name}`)
                        }, [
                            m('div.group-card-main', [
                                m('div.group-avatar', [
                                    group.avatar
                                        ? m('img', { src: group.avatar, alt: group.name })
                                        : m('div.avatar-placeholder', group.display_name ? group.display_name[0].toUpperCase() : group.name[0].toUpperCase())
                                ]),
                                m('div.group-info', [
                                    m('h3.group-name', group.display_name || group.name),
                                    group.description ? m('p.group-description', group.description) : null,
                                    m('div.group-meta', [
                                        m('span', [m('i.fas.fa-users'), ` ${members.length} 成员`]),
                                        group.location ? m('span', [m('i.fas.fa-map-marker-alt'), ` ${group.location}`]) : null,
                                        group.website ? m('a', { href: group.website, target: '_blank', onclick: e => e.stopPropagation() }, [m('i.fas.fa-globe')]) : null
                                    ])
                                ])
                            ]),
                            members.length > 0 ? m('div.group-members-inline', [
                                m('div.members-label', '成员'),
                                m('div.members-avatars',
                                    members.slice(0, 8).map(function(member) {
                                        return m('span.member-avatar-sm', {
                                            title: member.user.full_name || member.user.username
                                        }, [
                                            member.user.avatar ? m('img', { src: member.user.avatar })
                                                : m('div.avatar-placeholder-sm', (member.user.full_name || member.user.username)[0].toUpperCase())
                                        ]);
                                    })
                                )
                             ]) : null
                        ]);
                    }))
            ]) : m('div.accounts-page', [
                filteredUsers.length === 0 && !searchQuery && users.length === 0
                    ? m(EmptyState, { message: '暂无账号', icon: 'fa-user-circle' })
                    : filteredUsers.length === 0 && searchQuery
                    ? m(EmptyState, { message: '未找到匹配的账号', icon: 'fa-search' })
                    : m('div.accounts-grid', filteredUsers.map(user =>
                        m('div.account-card', {
                            onclick: () => m.route.set(`/user/${user.username}`)
                        }, [
                            m('div.account-avatar', [
                                user.avatar
                                    ? m('img', { src: user.avatar, alt: user.username })
                                    : m('div.avatar-placeholder', (user.full_name || user.username)[0].toUpperCase())
                            ]),
                            m('div.account-info', [
                                m('h4.account-name', user.full_name || user.username),
                                m('p.account-email', user.email || ''),
                                m('div.account-badges', [
                                    user.is_admin ? m('span.badge.badge-admin', '管理员') : null,
                                    !user.is_active ? m('span.badge.badge-inactive', '已禁用') : null
                                ].filter(Boolean)),
                                user.bio ? m('p.account-bio', user.bio) : null
                            ])
                        ])
                    ))
            ])
        ]);
    }
};

const GroupDetail = {
    oninit(vnode) {
        const { name } = vnode.attrs;
        vnode.state.group = null;
        vnode.state.currentUser = null;
        vnode.state.members = [];
        vnode.state.loading = true;
        vnode.state.editing = false;
        vnode.state.editForm = {};
        vnode.state.activeTab = 'overview';
        vnode.state.showAddMember = false;
        vnode.state.newMemberUsername = '';
        vnode.state.newMemberRole = 'member';

        GroupDetail.loadGroup(vnode, name);
    },

    loadGroup(vnode, name) {
        Promise.all([
            GroupService.get(name),
            API.get('/user/me'),
            GroupService.getMembers(name)
        ]).then(([groupResult, userResult, membersResult]) => {
            vnode.state.group = groupResult;
            vnode.state.currentUser = userResult;
            vnode.state.members = membersResult.data || [];
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    canEdit(vnode) {
        const { currentUser, group } = vnode.state;
        if (!currentUser || !group) return false;
        if (currentUser.is_admin) return true;
        const member = vnode.state.members.find(m => m.user.id === currentUser.id);
        return member && (member.role === 'owner' || member.role === 'admin');
    },

    startEdit(vnode) {
        const { group } = vnode.state;
        vnode.state.editing = true;
        vnode.state.editForm = {
            display_name: group.display_name || '',
            description: group.description || '',
            website: group.website || '',
            location: group.location || ''
        };
    },

    cancelEdit(vnode) {
        vnode.state.editing = false;
        vnode.state.editForm = {};
    },

    saveEdit(vnode) {
        const { name } = vnode.attrs;
        vnode.state.saving = true;

        GroupService.update(name, vnode.state.editForm).then(result => {
            vnode.state.group = result;
            vnode.state.editing = false;
            vnode.state.saving = false;
            m.redraw();
        }).catch(error => {
            vnode.state.saving = false;
            alert('保存失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    handleAvatarUpload(vnode, e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        const { name } = vnode.attrs;
        vnode.state.uploadingAvatar = true;

        GroupService.uploadAvatar(name, formData).then(result => {
            vnode.state.group = result;
            vnode.state.uploadingAvatar = false;
            m.redraw();
        }).catch(error => {
            vnode.state.uploadingAvatar = false;
            alert('上传失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    addMember(vnode) {
        const { name } = vnode.attrs;
        const { newMemberUsername, newMemberRole } = vnode.state;

        if (!newMemberUsername) {
            alert('请输入用户名');
            return;
        }

        vnode.state.addingMember = true;

        GroupService.addMember(name, {
            username: newMemberUsername,
            role: newMemberRole
        }).then(() => {
            vnode.state.showAddMember = false;
            vnode.state.newMemberUsername = '';
            vnode.state.newMemberRole = 'member';
            vnode.state.addingMember = false;
            GroupDetail.loadGroup(vnode, name);
        }).catch(error => {
            vnode.state.addingMember = false;
            alert('添加成员失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    removeMember(vnode, username) {
        if (!confirm(`确定要移除成员 ${username} 吗？`)) {
            return;
        }

        const { name } = vnode.attrs;

        GroupService.removeMember(name, username).then(() => {
            GroupDetail.loadGroup(vnode, name);
        }).catch(error => {
            alert('移除成员失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { group, loading, editing, editForm, saving, activeTab, members, currentUser, showAddMember, newMemberUsername, newMemberRole, uploadingAvatar, addingMember } = vnode.state;

        if (loading) {
            return m(Layout, m(Loading));
        }

        if (!group) {
            return m(Layout, m(EmptyState, { message: '团队不存在', icon: 'fa-users' }));
        }

        return m(Layout, [
            m('div.group-detail-page', [
                m('div.group-header', [
                    m('div.group-avatar-large', {
                        style: { position: 'relative' }
                    }, [
                        group.avatar
                            ? m('img', { src: group.avatar, alt: group.name })
                            : m('div.avatar-placeholder', group.display_name ? group.display_name[0].toUpperCase() : group.name[0].toUpperCase()),
                        GroupDetail.canEdit(vnode) ? m('div.avatar-upload-overlay', {
                            onclick: () => document.getElementById('avatar-input').click()
                        }, [
                            m('i.fas.fa-camera'),
                            m('input#avatar-input', {
                                type: 'file',
                                accept: 'image/*',
                                style: { display: 'none' },
                                onchange: e => GroupDetail.handleAvatarUpload(vnode, e)
                            })
                        ]) : null,
                        uploadingAvatar ? m('div.avatar-uploading', [
                            m('i.fas.fa-spinner.fa-spin')
                        ]) : null
                    ]),
                    m('div.group-info', [
                        editing ? [
                            m('div.form-group', [
                                m('input.form-input', {
                                    type: 'text',
                                    value: editForm.display_name,
                                    oninput: e => { editForm.display_name = e.target.value; },
                                    placeholder: '显示名称'
                                })
                            ]),
                            m('div.form-group', [
                                m('textarea.form-input', {
                                    value: editForm.description,
                                    oninput: e => { editForm.description = e.target.value; },
                                    placeholder: '团队描述',
                                    rows: 2
                                })
                            ]),
                            m('div.form-group', [
                                m('input.form-input', {
                                    type: 'url',
                                    value: editForm.website,
                                    oninput: e => { editForm.website = e.target.value; },
                                    placeholder: '网站'
                                })
                            ]),
                            m('div.form-group', [
                                m('input.form-input', {
                                    type: 'text',
                                    value: editForm.location,
                                    oninput: e => { editForm.location = e.target.value; },
                                    placeholder: '位置'
                                })
                            ]),
                            m('div.form-actions', [
                                m('button.btn.btn-primary', {
                                    onclick: () => GroupDetail.saveEdit(vnode),
                                    disabled: saving
                                }, saving ? '保存中...' : '保存'),
                                m('button.btn', {
                                    onclick: () => GroupDetail.cancelEdit(vnode)
                                }, '取消')
                            ])
                        ] : [
                            m('h1', group.display_name || group.name),
                            group.description ? m('p.group-description', group.description) : null,
                            m('div.group-meta', [
                                m('span', [m('i.fas.fa-users'), ` ${members.length} 成员`]),
                                group.location ? m('span', [m('i.fas.fa-map-marker-alt'), ` ${group.location}`]) : null,
                                group.website ? m('a', { href: group.website, target: '_blank' }, [m('i.fas.fa-globe'), ' 网站']) : null
                            ]),
                            GroupDetail.canEdit(vnode) ? m('button.btn.btn-secondary', {
                                onclick: () => GroupDetail.startEdit(vnode),
                                style: { marginTop: '10px' }
                            }, [m('i.fas.fa-edit'), ' 编辑团队信息']) : null
                        ]
                    ])
                ]),

                m('div.group-tabs', [
                    m('a.tab' + (activeTab === 'overview' ? '.active' : ''), {
                        onclick: () => { vnode.state.activeTab = 'overview'; }
                    }, '概览'),
                    m('a.tab' + (activeTab === 'members' ? '.active' : ''), {
                        onclick: () => { vnode.state.activeTab = 'members'; }
                    }, '成员'),
                    m('a.tab', { href: '#' }, '项目'),
                    m('a.tab', { href: '#' }, '设置')
                ]),

                m('div.group-content', [
                    activeTab === 'overview' ? [
                        m('div.info-section', [
                            m('h3', '团队信息'),
                            m('div.info-row', [m('strong', '名称: '), group.name]),
                            m('div.info-row', [m('strong', '创建时间: '), group.created_at])
                        ])
                    ] : activeTab === 'members' ? [
                        m('div.members-section', [
                            m('div.members-header', [
                                m('h3', '团队成员'),
                                GroupDetail.canEdit(vnode) ? m('button.btn.btn-primary', {
                                    onclick: () => { vnode.state.showAddMember = !showAddMember; }
                                }, [m('i.fas.fa-plus'), ' 添加成员']) : null
                            ]),
                            showAddMember ? m('div.add-member-form', [
                                m('div.form-row', [
                                    m('input.form-input', {
                                        type: 'text',
                                        placeholder: '用户名',
                                        value: newMemberUsername,
                                        oninput: e => { vnode.state.newMemberUsername = e.target.value; }
                                    }),
                                    m('select.form-input', {
                                        value: newMemberRole,
                                        onchange: e => { vnode.state.newMemberRole = e.target.value; }
                                    }, [
                                        m('option', { value: 'member' }, '成员'),
                                        m('option', { value: 'admin' }, '管理员')
                                    ]),
                                    m('button.btn.btn-primary', {
                                        onclick: () => GroupDetail.addMember(vnode),
                                        disabled: addingMember
                                    }, addingMember ? '添加中...' : '添加'),
                                    m('button.btn', {
                                        onclick: () => { vnode.state.showAddMember = false; }
                                    }, '取消')
                                ])
                            ]) : null,
                            m('div.members-list', members.map(member =>
                                m('div.member-card', [
                                    m('div.member-avatar', [
                                        member.user.avatar
                                            ? m('img', { src: member.user.avatar, alt: member.user.username })
                                            : m('div.avatar-placeholder', member.user.username[0].toUpperCase())
                                    ]),
                                    m('div.member-info', [
                                        m('div.member-header', [
                                            m('h4.member-name', member.user.full_name || member.user.username),
                                            m('span.member-role', member.role === 'owner' ? '所有者' : member.role === 'admin' ? '管理员' : '成员')
                                        ]),
                                        m('p.member-email', member.user.email)
                                    ]),
                                    GroupDetail.canEdit(vnode) && member.role !== 'owner' ? m('div.member-actions', [
                                        m('button.btn.btn-danger.btn-sm', {
                                            onclick: () => GroupDetail.removeMember(vnode, member.user.username)
                                        }, [m('i.fas.fa-times'), ' 移除'])
                                    ]) : null
                                ])
                            ))
                        ])
                    ] : null
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
        vnode.state.creating = false;
    },

    create(vnode) {
        const { form } = vnode.state;

        if (!form.name) {
            alert('请输入团队名称');
            return;
        }

        vnode.state.creating = true;

        GroupService.create(form).then(result => {
            vnode.state.creating = false;
            m.route.set(`/groups/${result.name}`);
        }).catch(error => {
            vnode.state.creating = false;
            alert('创建失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { form, creating } = vnode.state;

        return m(Layout, [
            m('div.page-header', [
                m('h1', [m('i.fas.fa-plus'), ' 新建团队'])
            ]),

            m('div.new-group-form', [
                m('div.form-group', [
                    m('label', '团队名称 *'),
                    m('input.form-input', {
                        type: 'text',
                        value: form.name,
                        oninput: e => { form.name = e.target.value; },
                        placeholder: '团队唯一标识（英文字母、数字、下划线）'
                    })
                ]),

                m('div.form-group', [
                    m('label', '显示名称'),
                    m('input.form-input', {
                        type: 'text',
                        value: form.display_name,
                        oninput: e => { form.display_name = e.target.value; },
                        placeholder: '团队显示名称'
                    })
                ]),

                m('div.form-group', [
                    m('label', '描述'),
                    m('textarea.form-input', {
                        value: form.description,
                        oninput: e => { form.description = e.target.value; },
                        placeholder: '团队描述',
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
                        placeholder: '城市, 国家'
                    })
                ]),

                m('div.form-actions', [
                    m('button.btn.btn-primary', {
                        onclick: () => NewGroup.create(vnode),
                        disabled: creating
                    }, creating ? '创建中...' : '创建团队'),
                    m('button.btn', {
                        onclick: () => m.route.set('/groups')
                    }, '取消')
                ])
            ])
        ]);
    }
};

export { Groups, GroupDetail, NewGroup };