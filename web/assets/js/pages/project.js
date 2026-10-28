// Project workspace: files, commits, branches, issues, pull requests, settings
// and sync. One document serves the whole /:owner/:repo subtree — the tab is
// derived from the path. Every view field is plain: Alpine's reactive() reads
// all own properties during setup, so a getter that throws there silently
// prevents the whole tree from mounting.
import Alpine from '../../lib/alpine.min.js'
import { marked } from '../../lib/marked.js'
import { reposAPI, issuesAPI, prsAPI } from '../api.js'
import { t, timeAgo, dated } from '../i18n.js'
import { projectTypeClass, projectTypeLabel } from '../model.js'
import { fileIcon } from '../icon.js'
import { toast, copyText, sanitizeHtml, confirmBox } from '../ui.js'

var PER_PAGE = 30

var EXT_LANG = {
  go: 'go', js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  py: 'python', rb: 'ruby', rs: 'rust', java: 'java', c: 'c', h: 'c',
  cpp: 'cpp', cs: 'csharp', php: 'php', css: 'css', html: 'markup',
  xml: 'markup', json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
  md: 'markdown', sql: 'sql', sh: 'bash', bash: 'bash', ini: 'ini',
  diff: 'diff', lua: 'lua', kt: 'kotlin', swift: 'swift', scala: 'scala',
  r: 'r', ps1: 'powershell', vim: 'vim', nginx: 'nginx',
}

var TAB_GROUPS = {
  issues: ['issues', 'issue', 'issue-new'],
  prs: ['prs', 'pr', 'pr-new'],
}

function parsePath() {
  var parts = window.location.pathname.split('/').filter(Boolean)
  var rest = parts.slice(2)
  var tab = 'tree'
  var sub = ''
  var number = 0
  var head = rest[0] || ''

  if (head === 'commits') tab = 'commits'
  else if (head === 'branches') tab = 'branches'
  else if (head === 'issues') {
    if (rest[1] === 'new') tab = 'issue-new'
    else if (rest[1]) {
      tab = 'issue'
      number = parseInt(rest[1], 10) || 0
    } else tab = 'issues'
  } else if (head === 'pull_requests') {
    if (rest[1] === 'new') tab = 'pr-new'
    else if (rest[1]) {
      tab = 'pr'
      number = parseInt(rest[1], 10) || 0
    } else tab = 'prs'
  } else if (head === 'settings') tab = 'settings'
  else if (head === 'sync') tab = 'sync'
  else if (head === 'tree') sub = rest.slice(1).join('/')

  return {
    owner: decodeURIComponent(parts[0] || ''),
    repo: decodeURIComponent(parts[1] || ''),
    tab: tab,
    sub: decodeURIComponent(sub),
    number: number,
  }
}

Alpine.data('project', function () {
  return {
    owner: '',
    repoName: '',
    tab: 'tree',
    number: 0,
    base: '/',
    crumbSegs: [],
    parentUrl: '',
    dirPath: '',
    loading: true,
    saving: false,
    creating: false,
    posting: false,
    syncing: false,
    savingSync: false,
    emptyMessage: '',

    repo: null,
    canManage: false,
    canCreate: false,
    canComment: false,

    lastCommit: null,
    entries: [],
    file: null,
    filePath: '',
    fileContent: '',
    fileSize: '',
    fileLangClass: '',
    readmeHtml: '',

    commits: [],
    commitPage: 1,
    commitPages: 1,
    branches: [],

    issues: [],
    issueError: '',
    prs: [],
    prError: '',

    issue: null,
    issueHtml: '',
    comments: [],
    commentText: '',

    newIssue: { title: '', body: '' },

    pr: null,
    prHtml: '',
    prComments: [],
    prCommentText: '',
    newPR: { title: '', body: '', source_branch: '', target_branch: '' },

    settings: { name: '', description: '', homepage: '', default_branch: '' },

    syncConfig: null,
    syncDraft: { intervalHours: 0, intervalMinutes: 0, is_paused: false },
    syncLogs: [],

    init: function () {
      var r = parsePath()
      this.owner = r.owner
      this.repoName = r.repo
      this.tab = r.tab
      this.number = r.number
      this.dirPath = r.sub
      this.base = '/' + r.owner + '/' + r.repo
      this.emptyMessage = t('project.emptyTree')
      this.updateCrumbs()
      this.load().catch(
        function (err) {
          this.loading = false
          toast((err && err.message) || 'Repository not found', 'error')
        }.bind(this)
      )
    },

    updateCrumbs: function () {
      this.crumbSegs = this.dirPath ? this.dirPath.split('/').filter(Boolean) : []
      this.parentUrl = this.base + '/tree/' + this.crumbSegs.slice(0, -1).join('/')
    },

    // Whether a tab group should look active: /issues/12 keeps 议题 highlighted.
    tabIs: function (group) {
      var members = TAB_GROUPS[group]
      return members ? members.indexOf(this.tab) >= 0 : this.tab === group
    },

    async load() {
      this.repo = await reposAPI.get(this.owner, this.repoName)
      var auth = this.$store.auth
      var uid = auth.user && auth.user.id
      this.canManage = auth.isAdmin || (!!uid && this.repo.owner_id === uid)
      this.canCreate = auth.isAuthenticated && !auth.isGuest
      this.canComment = this.canCreate
      this.settings = {
        name: this.repo.name || '',
        description: this.repo.description || '',
        homepage: this.repo.homepage || '',
        default_branch: this.repo.default_branch || '',
      }
      try {
        if (this.tab === 'tree') await this.loadTree()
        else if (this.tab === 'commits') await this.loadCommits(1)
        else if (this.tab === 'branches') await this.loadBranches()
        else if (this.tab === 'issues') await this.loadIssues()
        else if (this.tab === 'issue') await this.loadIssue()
        else if (this.tab === 'prs') await this.loadPRs()
        else if (this.tab === 'pr') await this.loadPR()
        else if (this.tab === 'pr-new') await this.loadBranches()
        else if (this.tab === 'settings') await this.loadBranches()
        else if (this.tab === 'sync') await this.loadSync()
      } catch (err) {
        /* each section renders its own empty state */
      } finally {
        this.loading = false
        this.highlight()
      }
    },

    // ---------- files ----------

    loadTree: async function () {
      this.lastCommit = await reposAPI.lastCommit(this.owner, this.repoName).catch(function () {
        return null
      })
      try {
        var data = await reposAPI.tree(this.owner, this.repoName, this.dirPath)
        var list = (data && data.entries) || []
        if (list.length === 1 && list[0].type === 'blob' && list[0].path === this.dirPath) {
          await this.openFile(this.dirPath)
          return
        }
        this.entries = list
        this.file = null
        if (!this.dirPath) await this.loadReadme()
      } catch (err) {
        await this.openFile(this.dirPath)
      }
    },

    openFile: async function (path) {
      this.filePath = path || ''
      var name = this.filePath.split('/').pop() || ''
      var ext = name.indexOf('.') >= 0 ? name.split('.').pop().toLowerCase() : ''
      this.fileLangClass = EXT_LANG[ext] ? 'language-' + EXT_LANG[ext] : ''
      var data = await reposAPI.file(this.owner, this.repoName, path)
      this.file = data || {}
      this.fileContent = (data && (data.content || data.raw)) || ''
      this.fileSize = data && data.size ? String(data.size) : ''
      this.entries = []
      this.$nextTick(this.highlight.bind(this))
    },

    loadReadme: async function () {
      var names = ['README.md', 'readme.md', 'README.markdown', 'README']
      for (var i = 0; i < names.length; i++) {
        try {
          var file = await reposAPI.file(this.owner, this.repoName, names[i])
          if (file && file.content) {
            this.readmeHtml = this.markdownHtml(file.content)
            return
          }
        } catch (err) {
          /* try the next candidate */
        }
      }
    },

    // ---------- commits / branches ----------

    loadCommits: async function (page) {
      var data = await reposAPI.commits(this.owner, this.repoName, { page: page, per_page: PER_PAGE })
      this.commits = (data && data.commits) || []
      var total = (data && data.total) || this.commits.length
      this.commitPage = page
      this.commitPages = Math.max(1, Math.ceil(total / PER_PAGE))
    },

    goCommitPage: async function (page) {
      if (page < 1 || page > this.commitPages) return
      await this.loadCommits(page)
    },

    loadBranches: async function () {
      var data = await reposAPI.branches(this.owner, this.repoName)
      this.branches = (data && data.branches) || (Array.isArray(data) ? data : [])
      if (this.tab === 'pr-new') {
        var def = (this.repo && this.repo.default_branch) || this.branches[0] || ''
        if (!this.newPR.target_branch) this.newPR.target_branch = def
        if (!this.newPR.source_branch) this.newPR.source_branch = def
      }
    },

    // ---------- issues ----------

    loadIssues: async function () {
      try {
        var data = await issuesAPI.list(this.owner, this.repoName, { per_page: 50 })
        this.issues = Array.isArray(data) ? data : (data && data.data) || []
      } catch (err) {
        this.issues = []
        this.issueError = err.message || ''
      }
    },

    loadIssue: async function () {
      try {
        this.issue = await issuesAPI.get(this.owner, this.repoName, this.number)
        this.issueHtml = this.markdownHtml(this.issue && this.issue.body)
        this.comments = await issuesAPI
          .comments(this.owner, this.repoName, this.number)
          .then(function (data) {
            return Array.isArray(data) ? data : (data && data.data) || []
          })
          .catch(function () {
            return []
          })
      } catch (err) {
        this.issueError = err.message || t('issue.notFound')
      }
    },

    toggleIssue: async function () {
      if (!this.issue) return
      var next = !this.issue.is_closed
      try {
        await issuesAPI.update(this.owner, this.repoName, this.number, {
          is_closed: next,
          status: next ? 'closed' : 'open',
        })
        this.issue.is_closed = next
        toast(next ? t('issue.closeIssue') : t('issue.reopenIssue'))
      } catch (err) {
        toast(err.message || t('issue.operationFailed'), 'error')
      }
    },

    submitComment: async function () {
      var text = this.commentText.trim()
      if (!text) return
      this.posting = true
      try {
        var created = await issuesAPI.createComment(this.owner, this.repoName, this.number, {
          body: text,
        })
        this.commentText = ''
        if (created && created.id) this.comments.push(created)
        else await this.loadIssue()
      } catch (err) {
        toast(err.message || t('issue.commentFailed'), 'error')
      } finally {
        this.posting = false
      }
    },

    createIssue: async function () {
      if (!this.newIssue.title.trim()) {
        toast(t('issue.titleRequired'), 'error')
        return
      }
      this.creating = true
      try {
        var issue = await issuesAPI.create(this.owner, this.repoName, {
          title: this.newIssue.title,
          body: this.newIssue.body,
        })
        var n = (issue && issue.number) || ''
        window.location.href = this.base + '/issues/' + n
      } catch (err) {
        toast(err.message || t('issue.createFailed'), 'error')
      } finally {
        this.creating = false
      }
    },

    // ---------- pull requests ----------

    loadPRs: async function () {
      try {
        var data = await prsAPI.list(this.owner, this.repoName, { per_page: 50 })
        this.prs = Array.isArray(data) ? data : (data && data.data) || []
      } catch (err) {
        this.prs = []
        this.prError = err.message || ''
      }
    },

    loadPR: async function () {
      try {
        this.pr = await prsAPI.get(this.owner, this.repoName, this.number)
        this.prHtml = this.markdownHtml(this.pr && this.pr.body)
        this.prComments = await issuesAPI
          .comments(this.owner, this.repoName, this.number)
          .then(function (data) {
            return Array.isArray(data) ? data : (data && data.data) || []
          })
          .catch(function () {
            return []
          })
      } catch (err) {
        this.prError = err.message || t('pr.notFound')
      }
    },

    prStateCls: function () {
      if (!this.pr) return 'badge--gray'
      if (this.pr.status === 'merged' || this.pr.is_merged) return 'badge--purple'
      if (this.pr.status === 'closed' || this.pr.is_closed) return 'badge--red'
      return 'badge--green'
    },

    prStateLabel: function () {
      if (!this.pr) return ''
      if (this.pr.status === 'merged' || this.pr.is_merged) return t('pr.merged')
      if (this.pr.status === 'closed' || this.pr.is_closed) return t('pr.closed')
      return t('pr.open')
    },

    togglePR: async function () {
      if (!this.pr) return
      try {
        if (this.pr.is_closed) {
          await prsAPI.reopen(this.owner, this.repoName, this.number)
          this.pr.is_closed = false
          this.pr.status = 'open'
        } else {
          await prsAPI.close(this.owner, this.repoName, this.number)
          this.pr.is_closed = true
          this.pr.status = 'closed'
        }
      } catch (err) {
        toast(err.message || t('issue.operationFailed'), 'error')
      }
    },

    mergePR: async function () {
      if (!this.pr) return
      try {
        await prsAPI.merge(this.owner, this.repoName, this.number)
        this.pr.is_merged = true
        this.pr.status = 'merged'
        toast(t('pr.merged'))
      } catch (err) {
        toast(err.message || t('issue.operationFailed'), 'error')
      }
    },

    submitPRComment: async function () {
      var text = this.prCommentText.trim()
      if (!text) return
      this.posting = true
      try {
        var created = await issuesAPI.createComment(this.owner, this.repoName, this.number, {
          body: text,
        })
        this.prCommentText = ''
        if (created && created.id) this.prComments.push(created)
        else await this.loadPR()
      } catch (err) {
        toast(err.message || t('issue.commentFailed'), 'error')
      } finally {
        this.posting = false
      }
    },

    createPR: async function () {
      if (!this.newPR.title.trim()) {
        toast(t('issue.titleRequired'), 'error')
        return
      }
      this.creating = true
      try {
        var pr = await prsAPI.create(this.owner, this.repoName, this.newPR)
        var n = (pr && pr.number) || ''
        window.location.href = this.base + '/pull_requests/' + n
      } catch (err) {
        toast(err.message || t('common.failed'), 'error')
      } finally {
        this.creating = false
      }
    },

    // ---------- settings ----------

    typeDescription: function () {
      var key = (this.repo && this.repo.project_type) || 'local'
      return t('projectSettings.' + key + 'ProjectDesc')
    },

    typeOptions: function () {
      var current = (this.repo && this.repo.project_type) || 'local'
      var self = this
      var options = [
        { key: 'public', icon: 'globe', color: '#16a34a' },
        { key: 'private', icon: 'lock', color: '#ea580c' },
        { key: 'mirror', icon: 'download', color: '#2563eb' },
      ]
      return options.map(function (opt) {
        var disabled = self.repo && self.repo.project_type === 'local'
        return {
          key: opt.key,
          icon: opt.icon,
          color: opt.color,
          disabled: disabled || opt.key === current,
        }
      })
    },

    convertType: async function (next) {
      var current = (this.repo && this.repo.project_type) || 'local'
      if (next === current) return
      var ok = await confirmBox({
        title: t('projectSettings.convertConfirmTitle'),
        message: t('projectSettings.convertConfirmDesc', {
          from: t('project.' + current),
          to: t('project.' + next),
        }),
        danger: true,
        confirmText: t('projectSettings.saveChanges'),
      })
      if (!ok) return
      try {
        var updated = await reposAPI.update(this.owner, this.repoName, { project_type: next })
        this.repo = Object.assign({}, this.repo, updated || { project_type: next })
        toast(t('projectSettings.settingsSaved'))
      } catch (err) {
        toast(err.message || t('projectSettings.saveFailed'), 'error')
      }
    },

    saveSettings: async function () {
      this.saving = true
      try {
        var payload = {
          name: this.settings.name,
          description: this.settings.description,
          homepage: this.settings.homepage,
        }
        if (this.settings.default_branch) payload.default_branch = this.settings.default_branch
        var updated = await reposAPI.update(this.owner, this.repoName, payload)
        this.repo = Object.assign({}, this.repo, updated || {})
        toast(t('projectSettings.settingsSaved'))
      } catch (err) {
        toast(err.message || t('projectSettings.saveFailed'), 'error')
      } finally {
        this.saving = false
      }
    },

    deleteRepo: async function () {
      var ok = await confirmBox({
        title: t('projectSettings.confirmDeleteRepo'),
        message: t('project.deleteConfirm'),
        danger: true,
        confirmText: t('project.deleteRepo'),
      })
      if (!ok) return
      try {
        await reposAPI.del(this.owner, this.repoName)
        window.location.href = '/projects'
      } catch (err) {
        toast(err.message || t('projectSettings.deleteRepoFailed'), 'error')
      }
    },

    // ---------- sync ----------

    syncDesc: function () {
      var remote = this.repo && this.repo.project_type !== 'local'
      return t(remote ? 'projectSettings.codeSyncDesc' : 'projectSettings.codeSyncLocalDesc')
    },

    loadSync: async function () {
      await Promise.all([this.loadSyncConfig(), this.loadSyncLogs()])
    },

    loadSyncConfig: async function () {
      try {
        var cfg = await reposAPI.getSyncConfig(this.owner, this.repoName)
        this.syncConfig = cfg
        var secs = (cfg && cfg.sync_interval) || 0
        this.syncDraft = {
          intervalHours: Math.floor(secs / 3600),
          intervalMinutes: Math.floor((secs % 3600) / 60),
          is_paused: !!(cfg && cfg.is_paused),
        }
      } catch (err) {
        this.syncConfig = null
      }
    },

    loadSyncLogs: async function () {
      try {
        var data = await reposAPI.getSyncLogs(this.owner, this.repoName)
        this.syncLogs = (data && data.logs) || []
      } catch (err) {
        this.syncLogs = []
      }
    },

    saveSyncConfig: async function () {
      this.savingSync = true
      var seconds =
        (Number(this.syncDraft.intervalHours) || 0) * 3600 +
        (Number(this.syncDraft.intervalMinutes) || 0) * 60
      try {
        var cfg = await reposAPI.updateSyncConfig(this.owner, this.repoName, {
          sync_interval: seconds,
          is_paused: this.syncDraft.is_paused,
        })
        this.syncConfig = cfg || this.syncConfig
        toast(t('projectSettings.syncConfigSaved'))
      } catch (err) {
        toast(err.message || t('projectSettings.saveFailed'), 'error')
      } finally {
        this.savingSync = false
      }
    },

    pullCode: async function () {
      return this.runSync(function () {
        return reposAPI.syncPull(this.owner, this.repoName)
      }, t('projectSettings.pullCodeStarted'))
    },

    pullIssues: async function () {
      return this.runSync(function () {
        return reposAPI.syncIssues(this.owner, this.repoName)
      }, t('projectSettings.issuesSyncStarted'))
    },

    refreshStats: async function () {
      return this.runSync(function () {
        return reposAPI.refreshStats(this.owner, this.repoName)
      }, t('projectSettings.statsRefreshed'))
    },

    runSync: async function (fn, okMessage) {
      this.syncing = true
      try {
        await fn()
        toast(okMessage)
        await this.loadSyncLogs()
      } catch (err) {
        toast(err.message || t('projectSettings.syncFailed'), 'error')
      } finally {
        this.syncing = false
      }
    },

    // ---------- misc ----------

    highlight: function () {
      if (!window.Prism || !this.fileContent) return
      var el = this.$refs.fileCode
      if (el) window.Prism.highlightElement(el)
    },

    markdownHtml: function (text) {
      if (!text) return ''
      return sanitizeHtml(marked.parse(String(text)))
    },

    toggleStar: async function () {
      if (!this.repo) return
      try {
        if (this.repo.is_starred) {
          await reposAPI.unstar(this.owner, this.repoName)
          this.repo.stars_count = Math.max(0, (this.repo.stars_count || 1) - 1)
          this.repo.is_starred = false
        } else {
          await reposAPI.star(this.owner, this.repoName)
          this.repo.stars_count = (this.repo.stars_count || 0) + 1
          this.repo.is_starred = true
        }
      } catch (err) {
        toast((err && err.message) || t('common.failed'), 'error')
      }
    },

    copyClone: function () {
      copyText(window.location.origin + this.base + '.git')
    },

    // git timestamps look like "2025-12-29 15:12:37 +0100"
    relativeTime: function (value) {
      if (!value) return ''
      var parts = String(value).trim().split(/\s+/)
      var iso = (parts[0] || '') + 'T' + (parts[1] || '00:00:00')
      if (parts[2]) iso += parts[2].replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
      return timeAgo(iso) || String(value).slice(0, 10)
    },

    iconFor: function (entry) {
      return fileIcon(entry.name, entry.type === 'tree')
    },

    t: t,
    timeAgo: timeAgo,
    dated: dated,
    projectTypeClass: projectTypeClass,
    projectTypeLabel: projectTypeLabel,
  }
})
