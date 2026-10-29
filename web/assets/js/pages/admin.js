// Admin console: users, scheduled sync tasks and database backups.
import Alpine from '../../lib/alpine.min.js'
import { usersAPI, adminAPI, backupsAPI } from '../api.js'
import { t, timeAgo } from '../i18n.js'
import { toast, toastError, confirmBox, query, setQuery } from '../ui.js'

var ADMIN_TABS = ['users', 'tasks', 'backup']

function intervalLabel(seconds) {
  if (!seconds) return '-'
  if (seconds % 3600 === 0) return seconds / 3600 + ' h'
  if (seconds % 60 === 0) return seconds / 60 + ' min'
  return seconds + ' s'
}

function statusLabel(status) {
  if (status === 'success') return t('admin.success')
  if (status === 'failure') return t('admin.failure')
  return t('common.running')
}

Alpine.data('admin', function () {
  return {
    loading: true,
    tab: 'users',
    search: '',
    users: [],
    syncPoints: [],
    syncLogs: [],
    backups: [],
    loaded: { tasks: false, backup: false },
    showCreate: false,
    creatingUser: false,
    backingUp: false,
    newUser: { username: '', email: '', password: '', full_name: '', role: 'user' },

    init: async function () {
      if (!this.$store.auth.isAdmin) {
        window.location.replace('/home')
        return
      }
      try {
        var data = await usersAPI.list({ per_page: 200 })
        this.users = Array.isArray(data) ? data : (data && data.data) || []
      } catch (err) {
        this.users = []
      } finally {
        this.loading = false
      }
      // ?tab=backup 之类的地址刷新后还停在原标签页。
      var tab = query('tab')
      if (ADMIN_TABS.indexOf(tab) >= 0) this.switchTab(tab)
    },

    switchTab: function (name) {
      this.tab = name
      setQuery('tab', name === 'users' ? '' : name)
      if (name === 'tasks' && !this.loaded.tasks) {
        this.loaded.tasks = true
        this.loadTasks()
      }
      if (name === 'backup' && !this.loaded.backup) {
        this.loaded.backup = true
        this.loadBackups()
      }
    },

    get filteredUsers() {
      var q = this.search.trim().toLowerCase()
      if (!q) return this.users
      return this.users.filter(function (u) {
        return ((u.username || '') + ' ' + (u.email || '') + ' ' + (u.full_name || ''))
          .toLowerCase()
          .indexOf(q) >= 0
      })
    },

    changeRole: async function (user, role) {
      try {
        await usersAPI.update(user.username, { role: role })
        user.role = role
        toast(t('admin.updated'), 'success')
      } catch (err) {
        toastError(err)
        this.users = this.users.slice()
      }
    },

    resetPassword: async function (user) {
      var next = window.prompt(t('admin.changePassword') + ' · ' + user.username, '')
      if (!next) return
      if (next.length < 6) {
        toast(t('userSettings.newPasswordTooShort'), 'error')
        return
      }
      try {
        await usersAPI.update(user.username, { password: next })
        toast(t('userSettings.passwordChanged'), 'success')
      } catch (err) {
        toastError(err)
      }
    },

    createUser: async function () {
      if (!this.newUser.username.trim()) {
        toast(t('userMgmt.usernameRequired'), 'error')
        return
      }
      if (!this.newUser.email.trim()) {
        toast(t('userMgmt.emailRequired'), 'error')
        return
      }
      if (this.newUser.password.length < 6) {
        toast(t('userMgmt.passwordMinLength'), 'error')
        return
      }
      this.creatingUser = true
      try {
        var created = await usersAPI.create(this.newUser)
        this.users = [created].concat(this.users)
        this.showCreate = false
        this.newUser = { username: '', email: '', password: '', full_name: '', role: 'user' }
        toast(t('common.success'), 'success')
      } catch (err) {
        toastError(err)
      } finally {
        this.creatingUser = false
      }
    },

    loadTasks: async function () {
      var result = await Promise.all([
        adminAPI.listSyncPoints().catch(function () {
          return []
        }),
        adminAPI.listSyncLogs(50).catch(function () {
          return []
        }),
      ])
      // 接口返回的是 {sync_points:[…]} / {logs:[…]}，不是数组也不是 {data:[…]}。
      this.syncPoints = (result[0] && result[0].sync_points) || []
      this.syncLogs = (result[1] && result[1].logs) || []
    },

    loadBackups: async function () {
      try {
        var data = await backupsAPI.list()
        this.backups = (data && data.backups) || []
      } catch (err) {
        this.backups = []
      }
    },

    // 增量备份必须挂在一个成功的全量备份上，没有就先把按钮禁掉。
    hasFullBackup: function () {
      return (this.backups || []).some(function (b) {
        return b.backup_type === 'full' && b.status === 'success'
      })
    },

    createBackup: async function (type) {
      this.backingUp = true
      try {
        await backupsAPI.create(type)
        toast(t('admin.backupCreated'), 'success')
        await this.loadBackups()
      } catch (err) {
        toastError(err)
      } finally {
        this.backingUp = false
      }
    },

    restoreBackup: async function (backup) {
      var ok = await confirmBox({
        title: t('admin.restore'),
        message: t('admin.restore') + ': ' + (backup.name || '#' + backup.id),
        danger: true,
        confirmText: t('admin.restore'),
      })
      if (!ok) return
      try {
        await backupsAPI.restore(backup.id)
        toast(t('admin.backupRestored'), 'success')
        await this.loadBackups()
      } catch (err) {
        toastError(err)
      }
    },

    t: t,
    timeAgo: timeAgo,
    intervalLabel: intervalLabel,
    statusLabel: statusLabel,
  }
})
