// Project workspace: file browser, readme, commits, branches, issues and PRs.
// The tab is derived from the path, so one document serves the whole subtree.
// All view state is plain fields — Alpine's reactive() reads every own property
// during setup, so getters would be invoked there and can throw.
import Alpine from '../../lib/alpine.min.js'
import { marked } from '../../lib/marked.js'
import { reposAPI, issuesAPI, prsAPI } from '../api.js'
import { t, timeAgo } from '../i18n.js'
import { projectTypeClass, projectTypeLabel } from '../model.js'
import { fileIcon } from '../icon.js'
import { toast, copyText } from '../ui.js'

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

function parsePath() {
  var parts = window.location.pathname.split('/').filter(Boolean)
  var rest = parts.slice(2)
  var tab = 'tree'
  var sub = ''
  if (rest[0] === 'commits') tab = 'commits'
  else if (rest[0] === 'branches') tab = 'branches'
  else if (rest[0] === 'issues') tab = 'issues'
  else if (rest[0] === 'pull_requests') tab = 'prs'
  else if (rest[0] === 'tree') sub = rest.slice(1).join('/')
  return {
    owner: decodeURIComponent(parts[0] || ''),
    repo: decodeURIComponent(parts[1] || ''),
    tab: tab,
    sub: decodeURIComponent(sub),
  }
}

Alpine.data('project', function () {
  return {
    owner: '',
    repoName: '',
    tab: 'tree',
    base: '/',
    crumbSegs: [],
    parentUrl: '',
    dirPath: '',
    loading: true,
    emptyMessage: '',
    repo: null,
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

    init: function () {
      var r = parsePath()
      this.owner = r.owner
      this.repoName = r.repo
      this.tab = r.tab
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

    load: async function () {
      this.repo = await reposAPI.get(this.owner, this.repoName)
      try {
        if (this.tab === 'tree') await this.loadTree()
        else if (this.tab === 'commits') await this.loadCommits(1)
        else if (this.tab === 'branches') await this.loadBranches()
        else if (this.tab === 'issues') await this.loadIssues()
        else if (this.tab === 'prs') await this.loadPRs()
      } catch (err) {
        /* each section renders its own empty state */
      } finally {
        this.loading = false
        this.highlight()
      }
    },

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
            this.readmeHtml = marked.parse(file.content)
            return
          }
        } catch (err) {
          /* try the next candidate */
        }
      }
    },

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
    },

    loadIssues: async function () {
      try {
        var data = await issuesAPI.list(this.owner, this.repoName, { per_page: 50 })
        this.issues = Array.isArray(data) ? data : (data && data.data) || []
      } catch (err) {
        this.issues = []
        this.issueError = err.message || ''
      }
    },

    loadPRs: async function () {
      try {
        var data = await prsAPI.list(this.owner, this.repoName, { per_page: 50 })
        this.prs = Array.isArray(data) ? data : (data && data.data) || []
      } catch (err) {
        this.prs = []
        this.prError = err.message || ''
      }
    },

    highlight: function () {
      if (!window.Prism || !this.fileContent) return
      var el = this.$refs.fileCode
      if (el) window.Prism.highlightElement(el)
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
    projectTypeClass: projectTypeClass,
    projectTypeLabel: projectTypeLabel,
  }
})
