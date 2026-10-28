// Users: the people directory (/users) and a single profile (/users/:name).
import Alpine from '../../lib/alpine.min.js'
import { usersAPI } from '../api.js'
import { t, timeAgo } from '../i18n.js'
import { projectTypeClass, projectTypeLabel } from '../model.js'

function currentUsername() {
  var parts = window.location.pathname.split('/').filter(Boolean)
  return parts.length >= 2 ? decodeURIComponent(parts[1]) : ''
}

Alpine.data('users', function () {
  return {
    view: 'list',
    loading: true,
    users: [],
    user: null,
    repos: [],
    search: '',

    init: async function () {
      var username = currentUsername()
      if (!username) {
        this.view = 'list'
        try {
          var data = await usersAPI.list({ per_page: 200 })
          this.users = Array.isArray(data) ? data : (data && data.data) || []
        } catch (err) {
          this.users = []
        } finally {
          this.loading = false
        }
        return
      }
      this.view = 'profile'
      try {
        var result = await Promise.all([usersAPI.get(username), usersAPI.repos(username)])
        this.user = result[0] || null
        this.repos = Array.isArray(result[1]) ? result[1] : (result[1] && result[1].data) || []
      } catch (err) {
        this.user = null
      } finally {
        this.loading = false
      }
    },

    get filtered() {
      var q = this.search.trim().toLowerCase()
      if (!q) return this.users
      return this.users.filter(function (u) {
        return ((u.username || '') + ' ' + (u.full_name || '') + ' ' + (u.email || ''))
          .toLowerCase()
          .indexOf(q) >= 0
      })
    },

    get isSelf() {
      return !!(this.user && this.$store.auth.username === this.user.username)
    },

    t: t,
    timeAgo: timeAgo,
    projectTypeClass: projectTypeClass,
    projectTypeLabel: projectTypeLabel,
  }
})
