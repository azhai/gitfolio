// Projects: list (search / filter / paginate), create and migrate forms.
// One module serves /projects, /projects/new and /projects/migrate.
import Alpine from '../../lib/alpine.min.js'
import { reposAPI } from '../api.js'
import { t, timeAgo } from '../i18n.js'
import { projectTypeClass, projectTypeLabel, repoUrl } from '../model.js'
import { toast, toastError } from '../ui.js'

var PAGE_SIZE = 6

var LANG_COLORS = {
  Go: '#00ADD8',
  JavaScript: '#f7df1e',
  TypeScript: '#3178C6',
  Python: '#3572A5',
  Rust: '#dea584',
  Java: '#b07219',
  Ruby: '#701516',
  PHP: '#4F5D95',
  C: '#555555',
  'C++': '#f34b7d',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Vue: '#41b883',
}

function viewFromPath() {
  var path = window.location.pathname.replace(/\/+$/, '')
  if (path === '/projects/new') return 'create'
  if (path === '/projects/migrate') return 'migrate'
  return 'list'
}

Alpine.data('projects', function () {
  return {
    view: 'list',
    loading: true,
    repos: [],
    search: '',
    tab: 'all',
    page: 1,
    submitting: false,
    detecting: false,
    tabs: [],
    migrateTypes: [],

    createForm: {
      name: '',
      description: '',
      homepage: '',
      project_type: 'local',
      default_branch: 'main',
      init_readme: true,
    },

    migrateForm: {
      name: '',
      description: '',
      clone_url: '',
      homepage: '',
      project_type: 'mirror',
    },

    init: function () {
      this.view = viewFromPath()
      this.tabs = [
        { key: 'all', label: 'projects.tabAll' },
        { key: 'my', label: 'projects.tabMy' },
        { key: 'starred', label: 'projects.tabStarred' },
      ]
      this.migrateTypes = [
        { key: 'mirror', icon: 'download', color: '#2563eb', label: t('project.mirror'), desc: t('migrateProject.mirrorDesc') },
        { key: 'public', icon: 'globe', color: '#16a34a', label: t('project.public'), desc: t('migrateProject.publicDesc') },
        { key: 'private', icon: 'lock', color: '#ea580c', label: t('project.private'), desc: t('migrateProject.privateDesc') },
      ]
      if (this.view !== 'list') {
        // Guests may not create or import repositories.
        if (this.$store.auth.isGuest || !this.$store.auth.isAuthenticated) {
          window.location.replace('/projects')
          return
        }
        this.loading = false
        return
      }
      this.load()
    },

    load: async function () {
      try {
        var data = await reposAPI.list({ per_page: 200 })
        this.repos = Array.isArray(data) ? data : (data && data.data) || []
      } catch (err) {
        this.repos = []
      } finally {
        this.loading = false
      }
    },

    get isGuest() {
      return this.$store.auth.isGuest
    },

    get filtered() {
      var q = this.search.trim().toLowerCase()
      var me = this.$store.auth.username
      var tab = this.tab
      return this.repos.filter(function (repo) {
        var haystack = ((repo.owner || '') + '/' + (repo.name || '') + ' ' + (repo.description || '')).toLowerCase()
        if (q && haystack.indexOf(q) < 0) return false
        if (tab === 'my') return repo.owner === me || repo.is_owner
        if (tab === 'starred') return repo.is_starred || repo.starred
        return true
      })
    },

    get totalPages() {
      return Math.max(1, Math.ceil(this.filtered.length / PAGE_SIZE))
    },

    get paged() {
      if (this.page > this.totalPages) this.page = 1
      var start = (this.page - 1) * PAGE_SIZE
      return this.filtered.slice(start, start + PAGE_SIZE)
    },

    createProject: async function () {
      if (!this.createForm.name.trim()) {
        toast(t('createProject.nameRequired'), 'error')
        return
      }
      this.submitting = true
      try {
        var data = await reposAPI.create(this.createForm)
        window.location.href = '/' + (data.owner || '') + '/' + data.name
      } catch (err) {
        toastError(err)
      } finally {
        this.submitting = false
      }
    },

    detect: async function () {
      var url = this.migrateForm.clone_url.trim()
      if (!url) {
        toast(t('migrateProject.enterUrlFirst'), 'info')
        return
      }
      this.detecting = true
      try {
        var data = await reposAPI.detectRepo(url)
        if (data.name) this.migrateForm.name = data.name
        if (data.description) this.migrateForm.description = data.description
        if (data.homepage) this.migrateForm.homepage = data.homepage
        toast(t('migrateProject.autoFilled'), 'success')
      } catch (err) {
        toastError(err)
      } finally {
        this.detecting = false
      }
    },

    migrate: async function () {
      if (!this.migrateForm.name.trim()) {
        toast(t('migrateProject.nameRequired'), 'error')
        return
      }
      if (!this.migrateForm.clone_url.trim()) {
        toast(t('migrateProject.urlRequired'), 'error')
        return
      }
      this.submitting = true
      try {
        var data = await reposAPI.create(this.migrateForm)
        var base = '/' + (data.owner || '') + '/' + data.name
        window.location.href = data.migrate_status === 'cloning' ? base + '?migrating=1' : base
      } catch (err) {
        toastError(err)
      } finally {
        this.submitting = false
      }
    },

    t: t,
    timeAgo: timeAgo,
    repoUrl: repoUrl,
    projectTypeClass: projectTypeClass,
    projectTypeLabel: projectTypeLabel,
    langColor: function (lang) {
      return LANG_COLORS[lang] || '#888'
    },
  }
})
