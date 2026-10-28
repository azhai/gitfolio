// Snippets: list, create, view and edit. Route shape decides the view.
import Alpine from '../../lib/alpine.min.js'
import { snippetsAPI } from '../api.js'
import { t, timeAgo } from '../i18n.js'
import { toast, toastError, confirmBox, copyText } from '../ui.js'

function route() {
  var parts = window.location.pathname.split('/').filter(Boolean)
  if (parts[1] === 'new') return { view: 'new', id: '' }
  if (parts.length >= 3 && parts[2] === 'edit') return { view: 'edit', id: parts[1] }
  if (parts.length >= 2) return { view: 'detail', id: parts[1] }
  return { view: 'list', id: '' }
}

Alpine.data('snippets', function () {
  return {
    view: 'list',
    loading: true,
    id: '',
    snippets: [],
    snippet: null,
    search: '',
    saving: false,
    form: {
      title: '',
      description: '',
      filename: '',
      language: '',
      visibility: 'public',
      content: '',
    },

    init: async function () {
      var r = route()
      this.view = r.view
      this.id = r.id

      if (this.view === 'list') {
        await this.loadList()
      } else if (this.view === 'detail') {
        await this.loadOne(r.id)
      } else if (this.view === 'edit') {
        await this.loadOne(r.id)
        if (this.snippet) {
          this.form = {
            title: this.snippet.title || '',
            description: this.snippet.description || '',
            filename: this.snippet.filename || '',
            language: this.snippet.language || '',
            visibility: this.snippet.visibility || 'public',
            content: this.snippet.content || '',
          }
        }
      } else {
        this.loading = false
      }
    },

    loadList: async function () {
      try {
        var data = await snippetsAPI.list({ per_page: 100 })
        this.snippets = Array.isArray(data) ? data : (data && data.data) || []
      } catch (err) {
        this.snippets = []
      } finally {
        this.loading = false
      }
    },

    loadOne: async function (id) {
      try {
        this.snippet = await snippetsAPI.get(id)
      } catch (err) {
        this.snippet = null
      } finally {
        this.loading = false
        this.$nextTick(function () {
          if (window.microlight) window.microlight.reset()
        })
      }
    },

    get filtered() {
      var q = this.search.trim().toLowerCase()
      if (!q) return this.snippets
      return this.snippets.filter(function (s) {
        return ((s.title || '') + ' ' + (s.description || '') + ' ' + (s.language || ''))
          .toLowerCase()
          .indexOf(q) >= 0
      })
    },

    get canEdit() {
      if (!this.snippet) return false
      var me = this.$store.auth.username
      return this.$store.auth.isAdmin || this.snippet.username === me || this.snippet.owner === me
    },

    save: async function () {
      if (!this.form.title.trim()) {
        toast(t('snippet.titleRequired'), 'error')
        return
      }
      this.saving = true
      try {
        if (this.view === 'edit') {
          await snippetsAPI.update(this.id, this.form)
          toast(t('common.success'), 'success')
          window.location.href = '/snippets/' + this.id
        } else {
          var created = await snippetsAPI.create(this.form)
          window.location.href = '/snippets/' + created.id
        }
      } catch (err) {
        toastError(err)
      } finally {
        this.saving = false
      }
    },

    remove: async function () {
      var ok = await confirmBox({
        title: t('snippet.delete'),
        message: t('snippet.confirmDelete'),
        danger: true,
        confirmText: t('snippet.delete'),
      })
      if (!ok) return
      try {
        await snippetsAPI.del(this.id)
        window.location.href = '/snippets'
      } catch (err) {
        toastError(err)
      }
    },

    copyCode: function () {
      copyText((this.snippet && this.snippet.content) || '')
    },

    t: t,
    timeAgo: timeAgo,
  }
})
