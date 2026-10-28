// Authentication state, exposed as the `auth` Alpine store.
import { authAPI } from './api.js'

export var authStore = {
  user: null,
  loading: true,
  ready: false,

  get isAuthenticated() {
    return !!this.user
  },
  get role() {
    return this.user ? this.user.role || 'user' : ''
  },
  get isAdmin() {
    return this.role === 'admin'
  },
  get isUser() {
    return this.role === 'user' || this.role === 'admin'
  },
  get isGuest() {
    return this.role === 'guest'
  },
  get displayName() {
    return this.user ? this.user.full_name || this.user.username : ''
  },
  get username() {
    return this.user ? this.user.username : ''
  },
  get initials() {
    var name = this.user ? this.user.username || '?' : '?'
    return name.slice(0, 2)
  },
  get avatarUrl() {
    return this.user ? this.user.avatar_url || '' : ''
  },
  get profileUrl() {
    return this.user ? '/users/' + this.user.username : '/login'
  },

  load: async function () {
    var token = localStorage.getItem('gitfolio_token')
    if (!token) {
      this.loading = false
      this.ready = true
      return null
    }
    try {
      this.user = await authAPI.me()
    } catch (e) {
      this.user = null
    }
    this.loading = false
    this.ready = true
    return this.user
  },

  login: async function (username, password) {
    var data = await authAPI.login(username, password)
    if (data && data.user) this.user = data.user
    else await this.load()
    return data
  },

  logout: async function () {
    try {
      await authAPI.logout()
    } catch (e) {
      /* ignore */
    }
    localStorage.removeItem('gitfolio_token')
    this.user = null
  },

  refresh: async function () {
    return this.load()
  },
}
