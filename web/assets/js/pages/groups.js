// Groups: list, create and detail (members + add/remove) in one module.
import Alpine from '../../lib/alpine.min.js'
import { groupsAPI } from '../api.js'
import { t, timeAgo } from '../i18n.js'
import { initials } from '../model.js'
import { toast, toastError, confirmBox } from '../ui.js'

function route() {
  var parts = window.location.pathname.split('/').filter(Boolean)
  if (parts[1] === 'new') return { view: 'new', name: '' }
  if (parts.length >= 2) return { view: 'detail', name: decodeURIComponent(parts[1]) }
  return { view: 'list', name: '' }
}

Alpine.data('groups', function () {
  return {
    view: 'list',
    loading: true,
    groups: [],
    group: null,
    members: [],
    showAdd: false,
    adding: false,
    submitting: false,
    canManage: false,
    form: { name: '', display_name: '', description: '', website: '', location: '', repo_root: '' },
    memberForm: { username: '', role: 'member' },

    init: async function () {
      var auth = this.$store.auth
      this.canManage = auth.isAuthenticated && !auth.isGuest
      var r = route()
      this.view = r.view
      if (this.view === 'list') {
        await this.loadList()
      } else if (this.view === 'detail') {
        await this.loadDetail(r.name)
      } else {
        this.loading = false
      }
    },

    loadList: async function () {
      try {
        var data = await groupsAPI.list()
        this.groups = Array.isArray(data) ? data : (data && data.data) || []
      } catch (err) {
        this.groups = []
      } finally {
        this.loading = false
      }
    },

    loadDetail: async function (name) {
      try {
        var result = await Promise.all([groupsAPI.get(name), groupsAPI.members(name)])
        this.group = result[0] || null
        this.members = Array.isArray(result[1]) ? result[1] : []
      } catch (err) {
        this.group = null
      } finally {
        this.loading = false
      }
    },

    createGroup: async function () {
      if (!this.form.name.trim()) {
        toast(t('group.groupNameRequired'), 'error')
        return
      }
      this.submitting = true
      try {
        var data = await groupsAPI.create(this.form)
        window.location.href = '/groups/' + (data.name || this.form.name)
      } catch (err) {
        toastError(err)
      } finally {
        this.submitting = false
      }
    },

    addMember: async function () {
      if (!this.memberForm.username.trim()) {
        toast(t('auth.enterUsername'), 'error')
        return
      }
      this.adding = true
      try {
        await groupsAPI.addMember(this.group.name, this.memberForm)
        this.members = await groupsAPI.members(this.group.name)
        this.memberForm = { username: '', role: 'member' }
        this.showAdd = false
        toast(t('common.success'), 'success')
      } catch (err) {
        toastError(err)
      } finally {
        this.adding = false
      }
    },

    removeMember: async function (username) {
      var ok = await confirmBox({
        title: t('group.remove'),
        message: t('group.confirmRemove', { username: username }),
        danger: true,
        confirmText: t('group.remove'),
      })
      if (!ok) return
      try {
        await groupsAPI.removeMember(this.group.name, username)
        this.members = await groupsAPI.members(this.group.name)
        toast(t('common.success'), 'success')
      } catch (err) {
        toastError(err)
      }
    },

    t: t,
    timeAgo: timeAgo,
    initials: initials,
  }
})
