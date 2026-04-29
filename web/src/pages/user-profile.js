import { Layout, Loading, EmptyState } from '../components.js';
import { UserService, API, Auth } from '../api.js';

const UserProfile = {
    oninit(vnode) {
        const { username } = vnode.attrs;
        vnode.state.user = null;
        vnode.state.repos = [];
        vnode.state.currentUser = null;
        vnode.state.loading = true;
        vnode.state.error = null;

        vnode.state.editing = false;
        vnode.state.editForm = {};
        vnode.state.saving = false;

        vnode.state.showPasswordModal = false;
        vnode.state.passwordForm = {};
        vnode.state.changingPassword = false;

        vnode.state.uploadingAvatar = false;

        UserProfile.loadUser(vnode, username);
    },

    loadUser(vnode, username) {
        var requests = [
            API.get(`/users/${username}`),
            API.get(`/users/${username}/repos`)
        ];
        if (Auth.isAuthenticated()) {
            requests.push(API.get('/user/me'));
        }
        Promise.allSettled(requests).then(function(results) {
            if (results[0].status === 'fulfilled') {
                vnode.state.user = results[0].value;
            }
            if (results[1].status === 'fulfilled') {
                vnode.state.repos = results[1].value || [];
            }
            if (results.length > 2 && results[2].status === 'fulfilled') {
                vnode.state.currentUser = results[2].value;
            } else {
                try {
                    var userData = JSON.parse(localStorage.getItem('user') || 'null');
                    if (userData) { vnode.state.currentUser = userData; }
                } catch (e) {}
            }
            if (!vnode.state.user) {
                vnode.state.error = '用户不存在';
            }
        }).catch(() => {
            vnode.state.error = '加载失败';
        }).finally(() => {
            vnode.state.loading = false;
            m.redraw();
        });
    },

    isOwnProfile(vnode) {
        return vnode.state.currentUser && vnode.state.user &&
            vnode.state.currentUser.username === vnode.state.user.username;
    },

    canEdit(vnode) {
        if (!vnode.state.currentUser) return false;
        return UserProfile.isOwnProfile(vnode) || vnode.state.currentUser.is_admin;
    },

    startEdit(vnode) {
        const { user } = vnode.state;
        vnode.state.editing = true;
        vnode.state.editForm = {
            full_name: user.full_name || '',
            bio: user.bio || '',
            website: user.website || '',
            location: user.location || ''
        };
    },

    cancelEdit(vnode) {
        vnode.state.editing = false;
        vnode.state.editForm = {};
    },

    saveEdit(vnode) {
        const { user, editForm } = vnode.state;
        vnode.state.saving = true;

        UserService.update(user.username, editForm).then(result => {
            vnode.state.user = result;
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

        vnode.state.uploadingAvatar = true;

        UserService.uploadAvatar(vnode.state.user.username, formData).then(result => {
            vnode.state.user = result;
            vnode.state.uploadingAvatar = false;
            m.redraw();
        }).catch(error => {
            vnode.state.uploadingAvatar = false;
            alert('上传失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    openChangePassword(vnode) {
        vnode.state.showPasswordModal = true;
        vnode.state.passwordForm = { old_password: '', new_password: '', confirm_password: '' };
    },

    closeChangePassword(vnode) {
        vnode.state.showPasswordModal = false;
        vnode.state.passwordForm = {};
    },

    submitChangePassword(vnode) {
        const pf = vnode.state.passwordForm;
        if (!pf.old_password || !pf.new_password) {
            alert('请填写完整');
            return;
        }
        if (pf.new_password.length < 6) {
            alert('新密码至少6位');
            return;
        }
        if (pf.new_password !== pf.confirm_password) {
            alert('两次输入的新密码不一致');
            return;
        }

        vnode.state.changingPassword = true;

        UserService.changePassword({
            old_password: pf.old_password,
            new_password: pf.new_password
        }).then(() => {
            UserProfile.closeChangePassword(vnode);
            vnode.state.changingPassword = false;
            alert('密码修改成功');
            m.redraw();
        }).catch(error => {
            vnode.state.changingPassword = false;
            alert('修改失败: ' + (error.message || '未知错误'));
            m.redraw();
        });
    },

    view(vnode) {
        const { user, repos, loading, error, editing, editForm, saving,
                showPasswordModal, passwordForm, changingPassword, uploadingAvatar } = vnode.state;

        if (loading) {
            return m(Layout, m(Loading));
        }

        if (error || !user) {
            return m(Layout, m(EmptyState, { message: error || '用户不存在', icon: 'fa-user' }));
        }

        const ownProfile = UserProfile.isOwnProfile(vnode);
        const canEdit = UserProfile.canEdit(vnode);

        return m(Layout, [
            m('div.user-profile-page', [
                m('div.profile-header-card', [
                    m('div.profile-avatar-wrap', {
                        style: { position: 'relative' }
                    }, [
                        user.avatar_url
                            ? m('img.profile-avatar-img', { src: user.avatar_url, alt: user.username })
                            : m('div.profile-avatar-placeholder', (user.full_name || user.username)[0].toUpperCase()),
                        canEdit ? m('div.avatar-upload-overlay', {
                            onclick: () => document.getElementById('profile-avatar-input').click()
                        }, [
                            uploadingAvatar
                                ? m('i.fas.fa-spinner.fa-spin')
                                : m('i.fas.fa-camera'),
                            m('input#profile-avatar-input', {
                                type: 'file',
                                accept: 'image/*',
                                style: { display: 'none' },
                                onchange: e => UserProfile.handleAvatarUpload(vnode, e)
                            })
                        ]) : null
                    ]),
                    m('div.profile-detail', [
                        m('div.profile-name-row', [
                            m('h1.profile-name', user.full_name || user.username),
                            m('span.profile-username', '@' + user.username)
                        ]),
                        user.bio ? m('p.profile-bio', user.bio) : null,
                        m('div.profile-meta', [
                            user.email ? m('span.meta-item', [m('i.fas fa-envelope'), ' ' + user.email]) : null,
                            user.location ? m('span.meta-item', [m('i.fas fa-map-marker-alt'), ' ' + user.location]) : null,
                            user.website ? m('a.meta-item', { href: user.website, target: '_blank', rel: 'noopener' }, [m('i.fas fa-globe'), ' ' + user.website]) : null,
                            m('span.meta-item', [m('i.fas fa-calendar-alt'), ' 加入于 ' + (user.created_at || '-')])
                        ].filter(Boolean)),
                        m('div.profile-tags', [
                            user.is_admin ? m('span.tag.tag-admin', [m('i.fas fa-shield-alt'), ' 管理员']) : null,
                            !user.is_active ? m('span.tag tag-inactive', '已禁用') : null
                        ].filter(Boolean)),
                        canEdit ? m('div.profile-actions', [
                            m('button.btn.btn-primary.btn-sm', {
                                onclick: () => UserProfile.startEdit(vnode)
                            }, [m('i.fas fa-edit'), ' 编辑资料']),
                            ownProfile ? m('button.btn.btn-secondary.btn-sm', {
                                onclick: () => UserProfile.openChangePassword(vnode)
                            }, [m('i.fas fa-key'), ' 修改密码']) : null
                        ]) : null
                    ])
                ]),

                editing ? m('div.profile-edit-panel', [
                    m('h3.panel-title', [m('i.fas fa-user-edit'), ' 编辑个人资料']),
                    m('div.form-group', [
                        m('label.form-label', '全名'),
                        m('input.form-input', {
                            type: 'text',
                            value: editForm.full_name,
                            oninput: e => { editForm.full_name = e.target.value; },
                            placeholder: '显示名称'
                        })
                    ]),
                    m('div.form-group', [
                        m('label.form-label', '个人简介'),
                        m('textarea.form-input', {
                            value: editForm.bio,
                            oninput: e => { editForm.bio = e.target.value; },
                            placeholder: '介绍一下自己...',
                            rows: 3
                        })
                    ]),
                    m('div.form-group', [
                        m('label.form-label', '网站'),
                        m('input.form-input', {
                            type: 'url',
                            value: editForm.website,
                            oninput: e => { editForm.website = e.target.value; },
                            placeholder: 'https://...'
                        })
                    ]),
                    m('div.form-group', [
                        m('label.form-label', '位置'),
                        m('input.form-input', {
                            type: 'text',
                            value: editForm.location,
                            oninput: e => { editForm.location = e.target.value; },
                            placeholder: '所在城市'
                        })
                    ]),
                    m('div.form-actions', [
                        m('button.btn.btn-primary', {
                            onclick: () => UserProfile.saveEdit(vnode),
                            disabled: saving
                        }, saving ? '保存中...' : '保存修改'),
                        m('button.btn', {
                            onclick: () => UserProfile.cancelEdit(vnode)
                        }, '取消')
                    ])
                ]) : null,

                showPasswordModal ? m('div.modal-overlay', {
                    onclick: (e) => { if (e.target === e.currentTarget) UserProfile.closeChangePassword(vnode); }
                }, [
                    m('div.modal.modal-sm', [
                        m('div.modal-header', [
                            m('h3', [m('i.fas fa-key'), ' 修改密码']),
                            m('button.modal-close', { onclick: () => UserProfile.closeChangePassword(vnode) }, '\u00d7')
                        ]),
                        m('div.modal-body', [
                            m('div.form-group', [
                                m('label.form-label', '当前密码'),
                                m('input.form-input', {
                                    type: 'password',
                                    value: passwordForm.old_password,
                                    oninput: e => { passwordForm.old_password = e.target.value; },
                                    placeholder: '输入当前密码'
                                })
                            ]),
                            m('div.form-group', [
                                m('label.form-label', '新密码'),
                                m('input.form-input', {
                                    type: 'password',
                                    value: passwordForm.new_password,
                                    oninput: e => { passwordForm.new_password = e.target.value; },
                                    placeholder: '至少6位'
                                })
                            ]),
                            m('div.form-group', [
                                m('label.form-label', '确认新密码'),
                                m('input.form-input', {
                                    type: 'password',
                                    value: passwordForm.confirm_password,
                                    oninput: e => { passwordForm.confirm_password = e.target.value; },
                                    placeholder: '再次输入新密码'
                                })
                            ])
                        ]),
                        m('div.modal-footer', [
                            m('button.btn.btn-primary', {
                                onclick: () => UserProfile.submitChangePassword(vnode),
                                disabled: changingPassword
                            }, changingPassword ? '修改中...' : '确认修改'),
                            m('button.btn', { onclick: () => UserProfile.closeChangePassword(vnode) }, '取消')
                        ])
                    ])
                ]) : null,

                m('div.profile-sections', [
                    m('div.profile-section', [
                        m('h2.section-title', [m('i.fas fa-book'), ' 项目 (' + repos.length + ')']),
                        repos.length === 0
                            ? m(EmptyState, { message: '暂无项目', icon: 'fa-code-branch' })
                            : m('div.repos-grid', repos.map(repo =>
                                m('a.repo-card', {
                                    href: '/project/' + repo.owner + '/' + repo.name,
                                    oncreate: (el) => el.onclick = (e) => { e.preventDefault(); m.route.set('/project/' + repo.owner + '/' + repo.name); }
                                }, [
                                    m('div.repo-name', repo.display_name || repo.name),
                                    repo.description ? m('p.repo-desc', repo.description) : null,
                                    m('div.repo-meta', [
                                        m('span.repo-type', { class: repo.project_type === 'mirror' ? 'mirror' : '' },
                                            repo.project_type === 'mirror' ? '镜像' : '本地'
                                        ),
                                        repo.language ? m('span', [m('i.fas fa-circle repo-lang-dot'), ' ' + repo.language]) : null
                                    ].filter(Boolean))
                                ])
                            ))
                    ])
                ])
            ])
        ]);
    }
};

export { UserProfile };
