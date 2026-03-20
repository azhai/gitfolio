import { API, Auth } from '../api.js';

const LoginPage = {
    oninit(vnode) {
        vnode.state.username = '';
        vnode.state.password = '';
        vnode.state.error = null;
        vnode.state.loading = false;
    },

    handleLogin(vnode) {
        const { username, password } = vnode.state;

        if (!username.trim() || !password.trim()) {
            vnode.state.error = '请输入用户名和密码';
            return;
        }

        vnode.state.loading = true;
        vnode.state.error = null;

        API.post('/auth/login', { username, password }).then(result => {
            if (result.token) {
                Auth.setToken(result.token);
                localStorage.setItem('user', JSON.stringify(result.user));
                window.location.href = '/projects';
            } else {
                vnode.state.error = '登录失败';
                vnode.state.loading = false;
                m.redraw();
            }
        }).catch(err => {
            vnode.state.error = '用户名或密码错误';
            vnode.state.loading = false;
            m.redraw();
        });
    },

    view(vnode) {
        const { username, password, error, loading } = vnode.state;

        return m('div.login-page', [
            m('div.login-container', [
                m('div.login-header', [
                    m('h1', 'GitFolio'),
                    m('p', '代码管理与同步平台')
                ]),

                m('form.login-form', {
                    onsubmit: (e) => {
                        e.preventDefault();
                        LoginPage.handleLogin(vnode);
                    }
                }, [
                    error ? m('div.alert.alert-error', error) : null,

                    m('div.form-group', [
                        m('label.form-label', { for: 'username' }, '用户名'),
                        m('input#username.form-input', {
                            type: 'text',
                            placeholder: '输入用户名',
                            value: username,
                            oninput: (e) => { vnode.state.username = e.target.value; }
                        })
                    ]),

                    m('div.form-group', [
                        m('label.form-label', { for: 'password' }, '密码'),
                        m('input#password.form-input', {
                            type: 'password',
                            placeholder: '输入密码',
                            value: password,
                            oninput: (e) => { vnode.state.password = e.target.value; }
                        })
                    ]),

                    m('button.btn.btn-primary.btn-block', {
                        type: 'submit',
                        disabled: loading
                    }, loading ? '登录中...' : '登录')
                ]),

                m('div.login-footer', [
                    m('p', '默认账号: ryan / password123')
                ])
            ])
        ]);
    }
};

export { LoginPage };