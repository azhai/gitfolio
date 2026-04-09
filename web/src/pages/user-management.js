import { Layout, Loading, EmptyState } from '../components.js';
import { UserService, API } from '../api.js';

const UserManagement = {
    oninit(vnode) {
        vnode.state.users = [];
        vnode.state.currentUser = null;
        vnode.state.loading = true;
        vnode.state.editingUser = null;
        vnode.state.editForm = {};

        Promise.all([
            API.get('/users'),
            API.get('/user/me')
        ]).then(([usersResult, userResult]) => {
            vnode.state.users = usersResult.data || usersResult || [];
            vnode.state.currentUser = userResult;
            vnode.state.loading = false;
            m.redraw();
        }).catch(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    canEdit(vnode) {
        const { currentUser } = vnode.state;
        return currentUser && currentUser.is_admin;
    },

    startEdit(vnode, user) {
        vnode.state.editingUser = user;
        vnode.state.editForm = {
            full_name: user.full_name || '',
            bio: user.bio || '',
            website: user.website || '',
            location: user.location || '',
            is_active: user.is_active,
            is_admin: user.is_admin
        };
    },

    cancelEdit(vnode) {
        vnode.state.editingUser = null;
        vnode.state.editForm = {};
    },

    saveEdit(vnode) {
        const { editingUser, editForm } = vnode.state;
        vnode.state.saving = true;

        UserService.update(editingUser.username, editForm).then(result => {
            const index = vnode.state.users.findIndex(u => u.id === editingUser.id);
            if (index !== -1) {
                vnode.state.users[index] = result;
            }
            vnode.state.editingUser = null;
            vnode.state.saving = false;
            m.redraw();
        }).catch(error => {
            vnode.state.saving = false;
            alert('保存失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    handleAvatarUpload(vnode, user, e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        vnode.state.uploadingAvatar = user.id;

        UserService.uploadAvatar(user.username, formData).then(result => {
            const index = vnode.state.users.findIndex(u => u.id === user.id);
            if (index !== -1) {
                vnode.state.users[index] = result;
            }
            vnode.state.uploadingAvatar = null;
            m.redraw();
        }).catch(error => {
            vnode.state.uploadingAvatar = null;
            alert('上传失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { users, currentUser, loading, editingUser, editForm, saving, uploadingAvatar } = vnode.state;

        if (loading) {
            return m(Layout, m(Loading));
        }

        if (!currentUser || !currentUser.is_admin) {
            return m(Layout, m(EmptyState, { 
                message: '权限不足', 
                icon: 'fa-lock' 
            }));
        }

        return m(Layout, [
            m('div.page-header', [
                m('h1', [m('i.fas.fa-users-cog'), ' 用户管理'])
            ]),

            users.length === 0 
                ? m(EmptyState, { message: '暂无用户', icon: 'fa-users' })
                : m('div.users-list', users.map(user => 
                    m('div.user-card', [
                        m('div.user-avatar', {
                            style: { position: 'relative' }
                        }, [
                            user.avatar 
                                ? m('img', { src: user.avatar, alt: user.username })
                                : m('div.avatar-placeholder', user.username[0].toUpperCase()),
                            m('div.avatar-upload-overlay', {
                                onclick: () => document.getElementById(`avatar-input-${user.id}`).click()
                            }, [
                                m('i.fas.fa-camera'),
                                m('input', {
                                    id: `avatar-input-${user.id}`,
                                    type: 'file',
                                    accept: 'image/*',
                                    style: { display: 'none' },
                                    onchange: e => UserManagement.handleAvatarUpload(vnode, user, e)
                                })
                            ]),
                            uploadingAvatar === user.id ? m('div.avatar-uploading', [
                                m('i.fas.fa-spinner.fa-spin')
                            ]) : null
                        ]),
                        m('div.user-info', [
                            m('div.user-header', [
                                m('h3.user-name', user.full_name || user.username),
                                user.is_admin ? m('span.badge.badge-admin', '管理员') : null,
                                !user.is_active ? m('span.badge.badge-inactive', '已禁用') : null
                            ]),
                            m('p.user-email', user.email),
                            user.bio ? m('p.user-bio', user.bio) : null,
                            m('div.user-meta', [
                                m('span', [m('i.fas.fa-calendar'), ` ${user.created_at}`]),
                                user.location ? m('span', [m('i.fas.fa-map-marker-alt'), ` ${user.location}`]) : null
                            ])
                        ]),
                        m('div.user-actions', [
                            m('button.btn.btn-secondary', {
                                onclick: () => UserManagement.startEdit(vnode, user)
                            }, [m('i.fas.fa-edit'), ' 编辑'])
                        ])
                    ])
                )),

            editingUser ? m('div.modal-overlay', {
                onclick: (e) => {
                    if (e.target === e.currentTarget) {
                        UserManagement.cancelEdit(vnode);
                    }
                }
            }, [
                m('div.modal', [
                    m('div.modal-header', [
                        m('h2', `编辑用户: ${editingUser.username}`),
                        m('button.modal-close', {
                            onclick: () => UserManagement.cancelEdit(vnode)
                        }, '×')
                    ]),
                    m('div.modal-body', [
                        m('div.form-group', [
                            m('label', '全名'),
                            m('input.form-input', {
                                type: 'text',
                                value: editForm.full_name,
                                oninput: e => { editForm.full_name = e.target.value; }
                            })
                        ]),
                        m('div.form-group', [
                            m('label', '个人简介'),
                            m('textarea.form-input', {
                                value: editForm.bio,
                                oninput: e => { editForm.bio = e.target.value; },
                                rows: 3
                            })
                        ]),
                        m('div.form-group', [
                            m('label', '网站'),
                            m('input.form-input', {
                                type: 'url',
                                value: editForm.website,
                                oninput: e => { editForm.website = e.target.value; }
                            })
                        ]),
                        m('div.form-group', [
                            m('label', '位置'),
                            m('input.form-input', {
                                type: 'text',
                                value: editForm.location,
                                oninput: e => { editForm.location = e.target.value; }
                            })
                        ]),
                        m('div.form-group', [
                            m('label', [
                                m('input', {
                                    type: 'checkbox',
                                    checked: editForm.is_active,
                                    onchange: e => { editForm.is_active = e.target.checked; }
                                }),
                                ' 账号激活'
                            ])
                        ]),
                        m('div.form-group', [
                            m('label', [
                                m('input', {
                                    type: 'checkbox',
                                    checked: editForm.is_admin,
                                    onchange: e => { editForm.is_admin = e.target.checked; }
                                }),
                                ' 管理员权限'
                            ])
                        ])
                    ]),
                    m('div.modal-footer', [
                        m('button.btn.btn-primary', {
                            onclick: () => UserManagement.saveEdit(vnode),
                            disabled: saving
                        }, saving ? '保存中...' : '保存'),
                        m('button.btn', {
                            onclick: () => UserManagement.cancelEdit(vnode)
                        }, '取消')
                    ])
                ])
            ]) : null
        ]);
    }
};

export { UserManagement };
