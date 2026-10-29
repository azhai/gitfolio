// Project workspace: files, commits, branches, issues, pull requests, settings
// and sync. One document serves the whole /:owner/:repo subtree — the tab is
// derived from the path. Every view field is plain: Alpine's reactive() reads
// all own properties during setup, so a getter that throws there silently
// prevents the whole tree from mounting.
import Alpine from '../../lib/alpine.min.js'
import { marked } from '../../lib/marked.js'
import { reposAPI, issuesAPI, prsAPI, tasksAPI, releasesAPI } from '../api.js'
import { t, timeAgo, dated } from '../i18n.js'
import { projectTypeClass, projectTypeLabel, taskStatus } from '../model.js'
import { fileIcon } from '../icon.js'
import { toast, copyText, sanitizeHtml, confirmBox } from '../ui.js'

var PER_PAGE = 30
var ISSUE_PER_PAGE = 20

var TAB_GROUPS = {
  issues: ['issues', 'issue', 'issue-new'],
  prs: ['prs', 'pr', 'pr-new'],
  tasks: ['tasks', 'task', 'task-new'],
}

function parsePath() {
  var parts = window.location.pathname.split('/').filter(Boolean)
  var rest = parts.slice(2)
  var tab = 'tree'
  var sub = ''
  var number = 0
  var sha = ''
  var head = rest[0] || ''

  if (head === 'commits') {
    if (rest[1]) {
      tab = 'commit'
      sha = decodeURIComponent(rest[1])
    } else tab = 'commits'
  } else if (head === 'changes') tab = 'changes'
  else if (head === 'branches') tab = 'branches'
  else if (head === 'tags') tab = 'tags'
  else if (head === 'releases') tab = 'releases'
  else if (head === 'stats') tab = 'stats'
  else if (head === 'tasks') {
    if (rest[1] === 'new') tab = 'task-new'
    else if (rest[1]) {
      tab = 'task'
      number = parseInt(rest[1], 10) || 0
    } else tab = 'tasks'
  } else if (head === 'issues') {
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
    sha: sha,
  }
}

var MARKDOWN_EXT = /\.(md|markdown|mdown|mkd|mkdn)$/i

// 文件扩展名 -> highlight.js 语言标识。只映射到内置语言，避免控制台刷出
// “没有该语言” 的警告。
var EXT_LANG = {
  go: 'go', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', py: 'python', rb: 'ruby', rs: 'rust',
  java: 'java', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp', cs: 'csharp',
  php: 'php', css: 'css', html: 'xml', xml: 'xml', json: 'json', yaml: 'yaml',
  yml: 'yaml', toml: 'ini', md: 'markdown', sql: 'sql', sh: 'bash',
  bash: 'bash', zsh: 'bash', ini: 'ini', diff: 'diff', patch: 'diff',
  lua: 'lua', kt: 'kotlin', swift: 'swift', scala: 'scala', r: 'r',
  ps1: 'powershell', vim: 'vim', nginx: 'nginx',
}

var API_BASE = '/api/v1'

function isMarkdownPath(path) {
  return MARKDOWN_EXT.test(path || '')
}

// 返回 "language-xxx"；highlight.js 没内置该语言时返回空串，让它自动推断。
function languageClassFor(path) {
  var name = (path || '').split('/').pop() || ''
  var ext = name.indexOf('.') >= 0 ? name.split('.').pop().toLowerCase() : ''
  var lang = EXT_LANG[ext]
  if (!lang) return ''
  if (window.hljs && !window.hljs.getLanguage(lang)) return ''
  return 'language-' + lang
}

// ---------- 提交图 ----------
// 每个提交行画一小段 SVG 连线：从上一行底部接到本行节点，再从节点接到下一行。
// 行高固定，保证相邻两行的线条能接上。
var GRAPH_COLORS = [
  '#e74c3c', '#2ecc71', '#3498db', '#f39c12', '#9b59b6', '#1abc9c',
  '#e67e22', '#e91e63', '#00bcd4', '#8bc34a', '#ff5722', '#607d8b',
  '#795548', '#cddc39', '#ff9800', '#673ab7',
]
var GRAPH_ROW_H = 42
var GRAPH_LANE_W = 18

// 根据提交的 parents 计算每条提交落在哪条泳道，以及和上下的连线关系。
function computeGraphLayout(commits) {
  if (!commits || !commits.length) return null

  var commitLanes = {}
  var commitFlows = {}
  var hashToLane = {}
  var activeLanes = []
  var lanesAbove = []
  var lanesBelow = []
  var maxLane = 0

  function findLaneForHash(hash) {
    return hash in hashToLane ? hashToLane[hash] : -1
  }

  function findAvailableLane() {
    for (var i = 0; i < activeLanes.length; i++) {
      if (activeLanes[i] === null) return i
    }
    activeLanes.push(null)
    maxLane = Math.max(maxLane, activeLanes.length - 1)
    return activeLanes.length - 1
  }

  function setLane(lane, hash) {
    while (activeLanes.length <= lane) {
      activeLanes.push(null)
      maxLane = Math.max(maxLane, activeLanes.length - 1)
    }
    if (hash in hashToLane && hashToLane[hash] !== lane) {
      var oldLane = hashToLane[hash]
      if (oldLane < activeLanes.length && activeLanes[oldLane] === hash) {
        activeLanes[oldLane] = null
      }
    }
    activeLanes[lane] = hash
    hashToLane[hash] = lane
  }

  function clearLane(lane) {
    if (lane < activeLanes.length && activeLanes[lane] !== null) {
      var oldHash = activeLanes[lane]
      if (hashToLane[oldHash] === lane) delete hashToLane[oldHash]
      activeLanes[lane] = null
    }
  }

  function snapshotActive() {
    var seen = {}
    for (var i = 0; i < activeLanes.length; i++) {
      if (activeLanes[i] !== null) seen[i] = true
    }
    return seen
  }

  for (var i = 0; i < commits.length; i++) {
    lanesAbove[i] = snapshotActive()

    var commit = commits[i]
    var hash = commit.hash
    var parents = commit.parents || []

    var myLane = findLaneForHash(hash)
    if (myLane === -1) myLane = findAvailableLane()
    commitLanes[hash] = myLane

    var flows = []
    if (!parents.length) {
      clearLane(myLane)
      commitFlows[hash] = flows
      lanesBelow[i] = snapshotActive()
      continue
    }

    setLane(myLane, parents[0])
    flows.push({ fromLane: myLane, toLane: myLane, type: 'straight' })

    for (var p = 1; p < parents.length; p++) {
      var parentHash = parents[p]
      var existingLane = findLaneForHash(parentHash)
      if (existingLane !== -1) {
        flows.push({ fromLane: myLane, toLane: existingLane, type: 'merge' })
      } else {
        var newLane = findAvailableLane()
        setLane(newLane, parentHash)
        flows.push({ fromLane: myLane, toLane: newLane, type: 'branch' })
      }
    }

    commitFlows[hash] = flows
    lanesBelow[i] = snapshotActive()
  }

  var laneCount = maxLane + 1
  var laneColors = {}
  for (var l = 0; l < laneCount; l++) laneColors[l] = GRAPH_COLORS[l % GRAPH_COLORS.length]

  return {
    commitLanes: commitLanes,
    commitFlows: commitFlows,
    laneCount: laneCount,
    laneColors: laneColors,
    lanesAbove: lanesAbove,
    lanesBelow: lanesBelow,
  }
}

function renderCommitGraphSvg(layout, commits, index) {
  var commit = commits[index]
  if (!layout || !commit) return ''

  var rowH = GRAPH_ROW_H
  var laneW = GRAPH_LANE_W
  var nodeR = 3.5
  var padX = 6
  var lineW = 1.8
  var width = Math.max(layout.laneCount, 1) * laneW + padX * 2

  var myLane = layout.commitLanes[commit.hash] || 0
  var myX = myLane * laneW + laneW / 2 + padX
  var myY = rowH / 2
  var color = layout.laneColors[myLane]
  var above = layout.lanesAbove[index] || {}
  var below = layout.lanesBelow[index] || {}
  var parts = []

  function drawPath(d, stroke) {
    parts.push(
      '<path d="' + d + '" stroke="' + stroke + '" stroke-width="' + lineW +
        '" fill="none" stroke-linecap="round"></path>'
    )
  }

  if (above[myLane]) {
    drawPath('M ' + myX + ' 0 L ' + myX + ' ' + (myY - nodeR), color)
  }

  var handled = {}
  handled[myLane] = true
  var flows = layout.commitFlows[commit.hash] || []
  for (var i = 0; i < flows.length; i++) {
    var flow = flows[i]
    var toX = flow.toLane * laneW + laneW / 2 + padX
    var toColor = layout.laneColors[flow.toLane]
    handled[flow.toLane] = true
    if (flow.type === 'straight') {
      drawPath('M ' + myX + ' ' + (myY + nodeR) + ' L ' + myX + ' ' + rowH, toColor)
    } else {
      var cp1y = myY + (rowH - myY) * 0.4
      var cp2y = rowH - (rowH - myY) * 0.4
      drawPath(
        'M ' + myX + ' ' + (myY + nodeR) + ' C ' + myX + ' ' + cp1y + ', ' +
          toX + ' ' + cp2y + ', ' + toX + ' ' + rowH,
        toColor
      )
    }
  }

  for (var laneKey in above) {
    var lane = Number(laneKey)
    if (handled[lane]) continue
    var lx = lane * laneW + laneW / 2 + padX
    var lColor = layout.laneColors[lane]
    var topY = myY - nodeR
    if (below[lane]) {
      drawPath('M ' + lx + ' 0 L ' + lx + ' ' + rowH, lColor)
    } else {
      drawPath('M ' + lx + ' 0 L ' + lx + ' ' + topY, lColor)
      var cpY = topY + (myY - topY) * 0.5
      drawPath('M ' + lx + ' ' + topY + ' C ' + lx + ' ' + cpY + ', ' + myX + ' ' + (topY - 2) + ', ' + myX + ' ' + topY, lColor)
    }
  }

  parts.push(
    '<circle cx="' + myX + '" cy="' + myY + '" r="' + nodeR + '" fill="' + color +
      '" stroke="#fff" stroke-width="1.2"></circle>'
  )

  return '<svg class="commit-graph-svg" width="' + width + '" height="' + rowH +
    '" viewBox="0 0 ' + width + ' ' + rowH + '">' + parts.join('') + '</svg>'
}

// Only rewrite repo-relative URLs. Absolute, protocol-relative and pure
// fragment links already point somewhere meaningful.
function isRelativeHref(href) {
  return !/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(href)
}

function splitHref(href) {
  var idx = href.search(/[?#]/)
  if (idx < 0) return { path: href, suffix: '' }
  return { path: href.slice(0, idx), suffix: href.slice(idx) }
}

// Resolve a relative markdown path against the directory containing the
// markdown file ('' for README at repo root).
function resolveRepoPath(baseDir, relative) {
  var segs = (baseDir || '').split('/').filter(Boolean)
  var decoded = relative
  try {
    decoded = decodeURI(relative || '')
  } catch (err) {
    /* keep the raw path when it contains a stray % */
  }
  var parts = String(decoded || '').split('/')
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i]
    if (!part || part === '.') continue
    if (part === '..') {
      if (segs.length) segs.pop()
    } else {
      segs.push(part)
    }
  }
  return segs
}

Alpine.data('project', function () {
  return {
    owner: '',
    repoName: '',
    tab: 'tree',
    number: 0,
    base: '/',
    ownerUrl: '',
    crumbSegs: [],
    parentUrl: '',
    dirPath: '',
    loading: true,
    saving: false,
    creating: false,
    posting: false,
    syncing: false,
    savingSync: false,
    syncPollTimer: null,
    pushUrl: '',
    remotes: [],
    loadingRemotes: false,
    newRemoteName: '',
    newRemoteUrl: '',
    addingRemote: false,
    pushingRemote: '',
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
    fileLangClass: '',
    fileHtml: '',
    fileSource: false,
    sourceView: false,
    fileSize: '',
    readmeHtml: '',
    readmePath: '',
    canEditFile: false,
    editing: false,
    editContent: '',
    editMessage: '',
    savingFile: false,
    showNewFile: false,
    newFile: { path: '', message: '', content: '' },

    commits: [],
    commitPage: 1,
    commitPages: 1,
    commitTotal: 0,
    showGraph: true,
    graphLayout: null,
    branches: [],

    issues: [],
    issuePage: 1,
    issuePages: 1,
    issueTotal: 0,
    issueError: '',
    prs: [],
    prPage: 1,
    prPages: 1,
    prTotal: 0,
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

    sha: '',
    commit: null,
    commitError: '',

    tags: [],
    tagDraft: { name: '', branch: '' },
    showTagForm: false,
    savingTag: false,

    releases: [],
    releaseError: '',
    syncingReleases: false,

    tasks: [],
    taskColumns: [],
    tasksError: '',
    task: null,
    taskError: '',
    taskGoalHtml: '',
    taskDraftHtml: '',
    taskComments: [],
    taskTransitions: [],
    taskCommentText: '',
    postingTask: false,
    transitioning: false,
    isTaskOwner: false,
    openIssues: [],
    openIssuesLoaded: false,
    showTaskIssuePicker: false,
    attachingTask: false,
    deletingAttachment: false,
    newTask: { title: '', goal: '', draft: '', priority: 3, handler: '', verifier: '' },
    newTaskIssueIds: [],
    showNewTaskIssuePicker: false,

    // 裸仓库查看的分支（?ref=），有工作区的仓库用 checkout，不用这个。
    viewRef: '',
    queryPage: 1,
    // git 工作流：工作区、暂存区与 stash
    gitStatus: null,
    gitStaged: [],
    gitUnstaged: [],
    gitUntracked: [],
    gitConflicts: [],
    gitBranch: '',
    gitOperation: '',
    gitBusy: false,
    gitLoading: false,
    diffPath: '',
    diffStaged: false,
    diffResult: null,
    diffLoading: false,
    diffCanPick: false,
    commitMessage: '',
    committing: false,
    staging: false,
    stashes: [],
    stashMessage: '',
    branchDraft: '',
    newBranch: '',
    mergeSource: '',
    changesCount: 0,
    // 行级暂存：lineSel 用「行下标 -> 是否勾选」的对象，勾选状态在重渲染后保留。
    lineSel: {},
    stagingLines: false,
    // 交互式 rebase
    recentCommits: [],
    rebaseBase: '',
    rebaseTodos: [],
    rebasing: false,
    // 提交操作：范围删除选中态
    rangeMode: false,
    rangeStart: -1,
    rangeEnd: -1,

    codeStats: null,
    statsError: '',
    languageRows: [],
    contributors: [],
    commitActivity: [],

    settings: { name: '', description: '', homepage: '', default_branch: '' },
    transferTarget: '',
    transferring: false,
    deleteConfirm: '',
    deleting: false,

    syncConfig: null,
    syncDraft: { intervalHours: 0, intervalMinutes: 0, is_paused: false },
    syncLogs: [],

    init: function () {
      var r = parsePath()
      this.owner = r.owner
      this.repoName = r.repo
      this.tab = r.tab
      this.number = r.number
      this.sha = r.sha
      this.dirPath = r.sub
      this.base = '/' + r.owner + '/' + r.repo
      var qs = new URLSearchParams(window.location.search)
      this.sourceView = qs.get('source') === '1'
      // ref 是裸仓库（镜像等）的"当前查看分支"，page 让翻页在刷新后保持。
      this.viewRef = qs.get('ref') || ''
      this.queryPage = parseInt(qs.get('page'), 10) || 1
      this.ownerUrl = '/users/' + r.owner
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
      // can_manage comes from the backend because team repos require group
      // admin rights, which the client cannot derive from owner_id alone.
      this.canManage =
        !!this.repo.can_manage ||
        auth.isAdmin ||
        (!!uid && this.repo.owner_type !== 'group' && this.repo.owner_id === uid)
      this.ownerUrl = this.repo.owner_type === 'group' ? '/groups/' + this.owner : '/users/' + this.owner
      this.canCreate = auth.isAuthenticated && !auth.isGuest
      this.canComment = this.canCreate
      // 编辑文件等同于对仓库直接提交，权限要求与修改设置一致；
      // 另外必须有工作区，裸仓库只能读。
      this.canEditFile = this.canManage && !!this.repo.has_work_tree
      this.settings = {
        name: this.repo.name || '',
        description: this.repo.description || '',
        homepage: this.repo.homepage || '',
        default_branch: this.repo.default_branch || '',
      }
      this.pushUrl = this.repo.mirror_url || ''
      // 头部的分支切换需要分支列表和当前分支；异步取，不阻塞首屏。
      if (this.canManage && this.repo.has_work_tree) {
        var self = this
        this.loadBranches().catch(function () {})
        reposAPI.getGitStatus(this.owner, this.repoName).then(function (st) {
          self.gitBranch = (st && st.current_branch) || ''
          if (!self.branchDraft) self.branchDraft = self.gitBranch
        }).catch(function () {})
      } else if (!this.repo.has_work_tree) {
        // 裸仓库（镜像、全局裸仓库）不能 checkout，但查看哪个分支照样能选。
        this.gitBranch = this.viewRef || this.repo.default_branch || ''
        this.branchDraft = this.gitBranch
        this.loadBranches().catch(function () {})
      }
      try {
        if (this.tab === 'tree') await this.loadTree()
        else if (this.tab === 'commits') await this.loadCommits(this.queryPage || 1)
        else if (this.tab === 'commit') await this.loadCommit()
        else if (this.tab === 'branches') await this.loadBranches()
        else if (this.tab === 'tags') await this.loadTags()
        else if (this.tab === 'releases') await this.loadReleases()
        else if (this.tab === 'stats') await this.loadStats()
        else if (this.tab === 'tasks') await this.loadTasks()
        else if (this.tab === 'task') await this.loadTask()
        else if (this.tab === 'task-new') await this.loadOpenIssues()
        else if (this.tab === 'issues') await this.loadIssues(this.queryPage || 1)
        else if (this.tab === 'issue') await this.loadIssue()
        else if (this.tab === 'prs') await this.loadPRs(this.queryPage || 1)
        else if (this.tab === 'pr') await this.loadPR()
        else if (this.tab === 'pr-new') await this.loadBranches()
        else if (this.tab === 'changes') await this.loadGitStatus()
        else if (this.tab === 'settings') {
          if (this.canManage) await this.loadBranches()
        } else if (this.tab === 'sync') {
          if (this.canManage) await this.loadSync()
        }
      } catch (err) {
        /* each section renders its own empty state */
      } finally {
        this.loading = false
        this.highlight()
      }
    },

    // ---------- files ----------

    // 文件树内跳转的链接都要带上当前查看的分支，裸仓库切换才不会丢。
    treeUrl: function (path) {
      return this.base + '/tree/' + path +
        (this.viewRef ? '?ref=' + encodeURIComponent(this.viewRef) : '')
    },

    setQueryParam: function (key, value) {
      var p = new URLSearchParams(window.location.search)
      if (value === 1 || value === '' || value == null) p.delete(key)
      else p.set(key, value)
      var qsStr = p.toString()
      window.history.replaceState(null, '', window.location.pathname + (qsStr ? '?' + qsStr : ''))
    },

    loadTree: async function () {
      var ref = this.viewRef || 'HEAD'
      // 三个请求互不依赖，并行发出；串行时整页 spinner 会白白多等两轮往返。
      var commitPromise = reposAPI.lastCommit(this.owner, this.repoName, ref).catch(function () {
        return null
      })
      var treePromise = reposAPI.tree(this.owner, this.repoName, this.dirPath, ref)
      var readmePromise = this.dirPath ? null : this.loadReadme()
      this.lastCommit = await commitPromise
      try {
        var data = await treePromise
        var list = (data && data.entries) || []
        if (list.length === 1 && list[0].type === 'blob' && list[0].path === this.dirPath) {
          await this.openFile(this.dirPath)
          return
        }
        this.entries = list
        this.file = null
        if (readmePromise) await readmePromise
      } catch (err) {
        await this.openFile(this.dirPath)
      }
    },

    openFile: async function (path) {
      this.filePath = path || ''
      this.fileLangClass = languageClassFor(path)
      var data = await reposAPI.file(this.owner, this.repoName, path, this.viewRef)
      this.file = data || {}
      this.fileContent = (data && (data.content || data.raw)) || ''
      this.fileSize = data && data.size ? String(data.size) : ''
      var dir = this.filePath.indexOf('/') >= 0 ? this.filePath.slice(0, this.filePath.lastIndexOf('/')) : ''
      this.fileHtml = isMarkdownPath(this.filePath) ? this.markdownHtml(this.fileContent, dir) : ''
      // "查看源码" on the README card opens this file with ?source=1 so the
      // source toggle is already on, matching the README entry elsewhere.
      this.fileSource = this.sourceView && !!this.fileHtml
      this.entries = []
      this.$nextTick(this.highlight.bind(this))
    },

    // ---------- editing ----------
    // Editing writes through git and needs a checked-out working tree; a bare
    // repository only has objects, so the backend refuses those edits.

    startEdit: function () {
      this.editContent = this.fileContent
      this.editMessage = ''
      this.editing = true
    },

    cancelEdit: function () {
      this.editing = false
    },

    saveFile: async function () {
      var message = (this.editMessage || '').trim()
      if (!message) {
        toast(t('fileViewer.messageRequired'), 'error')
        return
      }
      this.savingFile = true
      try {
        await reposAPI.editFile(this.owner, this.repoName, this.filePath, this.editContent, message)
        this.editing = false
        toast(t('common.success'))
        await this.openFile(this.filePath)
        if (!this.dirPath) await this.loadReadme()
      } catch (err) {
        toast(err.message || t('common.failed'), 'error')
      } finally {
        this.savingFile = false
      }
    },

    startNewFile: function () {
      this.newFile = {
        path: this.dirPath ? this.dirPath + '/' : '',
        message: '',
        content: '',
      }
      this.showNewFile = true
    },

    createFile: async function () {
      var path = (this.newFile.path || '').trim().replace(/^\/+/, '')
      var message = (this.newFile.message || '').trim()
      if (!path) {
        toast(t('fileViewer.pathRequired'), 'error')
        return
      }
      if (!message) {
        toast(t('fileViewer.messageRequired'), 'error')
        return
      }
      this.savingFile = true
      try {
        await reposAPI.editFile(this.owner, this.repoName, path, this.newFile.content || '', message)
        this.showNewFile = false
        toast(t('common.success'))
        window.location.href = this.base + '/tree/' + path.split('/').map(encodeURIComponent).join('/')
      } catch (err) {
        toast(err.message || t('common.failed'), 'error')
      } finally {
        this.savingFile = false
      }
    },

    removeFile: async function () {
      var path = this.filePath
      var ok = await confirmBox({
        title: t('fileViewer.deleteTitle'),
        message: t('fileViewer.deleteBody', { path: path }),
        danger: true,
        confirmText: t('common.delete'),
      })
      if (!ok) return
      this.savingFile = true
      try {
        await reposAPI.deleteFile(this.owner, this.repoName, path, 'Delete ' + path)
        toast(t('fileViewer.deleted'))
        var parent = path.split('/').slice(0, -1).join('/')
        window.location.href = this.base + (parent ? '/tree/' + parent.split('/').map(encodeURIComponent).join('/') : '')
      } catch (err) {
        toast(err.message || t('common.failed'), 'error')
      } finally {
        this.savingFile = false
      }
    },

    loadReadme: async function () {
      var names = ['README.md', 'readme.md', 'README.markdown', 'README']
      this.readmeHtml = ''
      this.readmePath = ''
      for (var i = 0; i < names.length; i++) {
        try {
          var file = await reposAPI.file(this.owner, this.repoName, names[i], this.viewRef)
          if (file && file.content) {
            this.readmePath = names[i]
            this.readmeHtml = this.markdownHtml(file.content, '')
            return
          }
        } catch (err) {
          /* try the next candidate */
        }
      }
    },

    // ---------- commits / branches ----------

    loadCommits: async function (page) {
      var params = { page: page, per_page: PER_PAGE }
      // all=true 走后端 GetCommitGraph，返回带 parents 的全分支提交。
      if (this.showGraph) params.all = 'true'
      // 裸仓库查看非默认分支时，提交列表跟着 ?ref= 走。
      else if (this.viewRef) params.ref = this.viewRef
      var data = await reposAPI.commits(this.owner, this.repoName, params)
      this.commits = (data && data.commits) || []
      var total = (data && data.total) || this.commits.length
      this.commitPage = page
      this.commitTotal = total
      this.commitPages = Math.max(1, Math.ceil(total / PER_PAGE))
      this.graphLayout = this.showGraph ? computeGraphLayout(this.commits) : null
    },

    toggleGraph: async function () {
      this.showGraph = !this.showGraph
      await this.loadCommits(this.commitPage)
    },

    graphSvg: function (index) {
      return renderCommitGraphSvg(this.graphLayout, this.commits, index)
    },

    goCommitPage: async function (page) {
      if (page < 1 || page > this.commitPages) return
      await this.loadCommits(page)
      this.setQueryParam('page', page)
    },

    // ---------- 高级翻页 ----------
    // 生成 1 … 4 5 6 … 20 这种页码序列；总页数不多时全部展开。
    // 页码数字和省略号混在一个数组里，模板里用 disabled 的按钮渲染省略号。
    pageItems: function (current, total) {
      if (total <= 7) {
        var all = []
        for (var i = 1; i <= total; i++) all.push(i)
        return all
      }
      var lo = Math.max(2, current - 2)
      var hi = Math.min(total - 1, current + 2)
      var items = [1]
      if (lo > 2) items.push('…')
      for (var j = lo; j <= hi; j++) items.push(j)
      if (hi < total - 1) items.push('…')
      items.push(total)
      return items
    },

    commitPageItems: function () {
      return this.pageItems(this.commitPage, this.commitPages)
    },

    issuePageItems: function () {
      return this.pageItems(this.issuePage, this.issuePages)
    },

    prPageItems: function () {
      return this.pageItems(this.prPage, this.prPages)
    },

    goIssuePage: async function (page) {
      if (page < 1 || page > this.issuePages) return
      await this.loadIssues(page)
      this.setQueryParam('page', page)
    },

    goPrPage: async function (page) {
      if (page < 1 || page > this.prPages) return
      await this.loadPRs(page)
      this.setQueryParam('page', page)
    },

    loadBranches: async function () {
      var data = await reposAPI.branches(this.owner, this.repoName)
      this.branches = (data && data.branches) || (Array.isArray(data) ? data : [])
      // A freshly created repo has no branch listing yet, and the configured
      // default (e.g. "main") may be missing from a stale cache; keep it
      // selectable so saving settings cannot silently switch the default.
      var def = (this.repo && this.repo.default_branch) || ''
      if (def && this.branches.indexOf(def) < 0) this.branches = [def].concat(this.branches)
      // 分支下拉先于选项渲染时，select 会对不上当前分支，这里补一次默认值。
      if (this.tab === 'changes' && !this.branchDraft) {
        this.branchDraft = this.gitBranch || this.branches[0] || ''
      }
      if (this.tab === 'pr-new') {
        if (!this.newPR.target_branch) this.newPR.target_branch = def || this.branches[0] || ''
        if (!this.newPR.source_branch) this.newPR.source_branch = def || this.branches[0] || ''
      }
    },

    // ---------- tags / releases / stats ----------

    loadTags: async function () {
      try {
        var data = await reposAPI.tags(this.owner, this.repoName)
        this.tags = (data && data.tags) || (Array.isArray(data) ? data : [])
      } catch (err) {
        this.tags = []
      }
      if (this.canManage) {
        await this.loadBranches()
        if (!this.tagDraft.branch) {
          this.tagDraft.branch = (this.repo && this.repo.default_branch) || this.branches[0] || ''
        }
      }
    },

    createTag: async function () {
      var name = this.tagDraft.name.trim()
      if (!name) {
        toast(t('projectCommits.tagName'), 'error')
        return
      }
      this.savingTag = true
      try {
        await reposAPI.createTag(this.owner, this.repoName, name, this.tagDraft.branch)
        this.tagDraft.name = ''
        this.showTagForm = false
        await this.loadTags()
        toast(t('common.success'))
      } catch (err) {
        toast(err.message || t('common.failed'), 'error')
      } finally {
        this.savingTag = false
      }
    },

    deleteTag: async function (name) {
      var ok = await confirmBox({
        title: t('common.delete'),
        message: t('project.tags') + ': ' + name,
        danger: true,
        confirmText: t('common.delete'),
      })
      if (!ok) return
      try {
        await reposAPI.deleteTag(this.owner, this.repoName, name)
        await this.loadTags()
        toast(t('common.success'))
      } catch (err) {
        toast(err.message || t('common.failed'), 'error')
      }
    },

    loadReleases: async function () {
      try {
        var data = await releasesAPI.list(this.owner, this.repoName)
        this.releases = Array.isArray(data) ? data : (data && data.data) || []
      } catch (err) {
        this.releases = []
        this.releaseError = err.message || ''
      }
    },

    syncReleases: async function () {
      this.syncingReleases = true
      try {
        await releasesAPI.sync(this.owner, this.repoName)
        await this.loadReleases()
        toast(t('common.success'))
      } catch (err) {
        toast(err.message || t('common.failed'), 'error')
      } finally {
        this.syncingReleases = false
      }
    },

    loadStats: async function () {
      var results = await Promise.all([
        reposAPI.codeStats(this.owner, this.repoName).catch(function () { return null }),
        reposAPI.contributors(this.owner, this.repoName).catch(function () { return [] }),
        reposAPI.commitActivity(this.owner, this.repoName, 30).catch(function () { return null }),
      ])
      this.codeStats = results[0] || null
      this.contributors = Array.isArray(results[1]) ? results[1] : []
      this.commitActivity = (results[2] && results[2].activity) || []
      if (!this.codeStats) this.statsError = t('stats.noStats')
      var languages = (this.codeStats && this.codeStats.languages) || {}
      var total = 0
      Object.keys(languages).forEach(function (key) {
        total += languages[key]
      })
      this.languageRows = Object.keys(languages)
        .map(function (key) {
          return {
            name: key,
            lines: languages[key],
            percent: total ? Math.round((languages[key] * 1000) / total) / 10 : 0,
          }
        })
        .sort(function (a, b) {
          return b.lines - a.lines
        })
    },

    // ---------- tasks ----------

    loadTasks: async function () {
      try {
        var data = await tasksAPI.list(this.owner, this.repoName, { per_page: 100 })
        this.tasks = Array.isArray(data) ? data : (data && data.data) || []
      } catch (err) {
        this.tasks = []
        this.tasksError = err.message || ''
      }
      this.rebuildTaskColumns()
    },

    rebuildTaskColumns: function () {
      var self = this
      var columns = [
        { key: 'draft', label: t('task.draft') },
        { key: 'progress', label: t('task.inProgress') },
        { key: 'review', label: t('task.review') },
        { key: 'completed', label: t('task.completed') },
      ]
      var known = {}
      columns.forEach(function (col) {
        known[col.key] = true
      })
      // Keep unexpected states (e.g. rejected) visible instead of dropping them.
      this.tasks.forEach(function (task) {
        if (!known[task.status]) {
          known[task.status] = true
          columns.push({ key: task.status, label: taskStatus(task.status).label })
        }
      })
      this.taskColumns = columns.map(function (col) {
        return {
          key: col.key,
          label: col.label,
          tasks: self.tasks.filter(function (task) {
            return task.status === col.key
          }),
        }
      })
    },

    applyTask: function (task) {
      this.task = task || null
      this.taskGoalHtml = this.markdownHtml((task && task.goal) || '')
      this.taskDraftHtml = this.markdownHtml((task && task.draft) || '')
      var uid = this.$store.auth.user && this.$store.auth.user.id
      this.isTaskOwner = !!(task && uid && task.initiator_id === uid)
    },

    loadTask: async function () {
      try {
        this.applyTask(await tasksAPI.get(this.owner, this.repoName, this.number))
        var pair = await Promise.all([
          tasksAPI.comments(this.owner, this.repoName, this.number).catch(function () {
            return []
          }),
          tasksAPI.transitions(this.owner, this.repoName, this.number).catch(function () {
            return []
          }),
        ])
        this.taskComments = Array.isArray(pair[0]) ? pair[0] : (pair[0] && pair[0].data) || []
        this.taskTransitions = Array.isArray(pair[1]) ? pair[1] : []
      } catch (err) {
        this.taskError = err.message || t('task.notFound')
      }
    },

    refreshTask: async function () {
      try {
        this.applyTask(await tasksAPI.get(this.owner, this.repoName, this.number))
      } catch (err) {
        toast(err.message || t('common.failed'), 'error')
      }
    },

    loadOpenIssues: async function () {
      if (this.openIssuesLoaded) return
      try {
        var data = await issuesAPI.list(this.owner, this.repoName, { state: 'open', per_page: 50 })
        this.openIssues = Array.isArray(data) ? data : (data && data.data) || []
      } catch (err) {
        this.openIssues = []
      } finally {
        this.openIssuesLoaded = true
      }
    },

    linkableIssues: function (exclude) {
      var ids = exclude || []
      return this.openIssues.filter(function (issue) {
        return ids.indexOf(issue.id) < 0
      })
    },

    selectedNewTaskIssues: function () {
      var ids = this.newTaskIssueIds
      return this.openIssues.filter(function (issue) {
        return ids.indexOf(issue.id) >= 0
      })
    },

    toggleNewTaskIssuePicker: async function () {
      await this.loadOpenIssues()
      this.showNewTaskIssuePicker = !this.showNewTaskIssuePicker
    },

    toggleNewTaskIssue: function (id) {
      var index = this.newTaskIssueIds.indexOf(id)
      if (index >= 0) this.newTaskIssueIds.splice(index, 1)
      else this.newTaskIssueIds.push(id)
    },

    toggleTaskIssuePicker: async function () {
      await this.loadOpenIssues()
      this.showTaskIssuePicker = !this.showTaskIssuePicker
    },

    linkTaskIssue: async function (issueId) {
      try {
        await tasksAPI.linkIssue(this.owner, this.repoName, this.number, issueId)
        this.showTaskIssuePicker = false
        await this.refreshTask()
        toast(t('task.issueLinked'))
      } catch (err) {
        toast(err.message || t('task.linkFailed'), 'error')
      }
    },

    unlinkTaskIssue: async function (issueId) {
      try {
        await tasksAPI.unlinkIssue(this.owner, this.repoName, this.number, issueId)
        await this.refreshTask()
        toast(t('task.issueUnlinked'))
      } catch (err) {
        toast(err.message || t('task.unlinkFailed'), 'error')
      }
    },

    uploadTaskAttachments: async function (event) {
      var files = event.target.files
      if (!files || !files.length) return
      this.attachingTask = true
      try {
        for (var i = 0; i < files.length; i++) {
          var created = await tasksAPI.uploadAttachment(this.owner, this.repoName, this.number, files[i])
          if (created && created.error) throw new Error(created.error)
        }
        await this.refreshTask()
        toast(t('task.attachmentUploaded'))
      } catch (err) {
        toast(err.message || t('task.uploadFailed'), 'error')
      } finally {
        this.attachingTask = false
        event.target.value = ''
      }
    },

    deleteTaskAttachment: async function (attachment) {
      var ok = await confirmBox({
        title: t('task.confirmDelete'),
        message: t('task.confirmDeleteAttachment', { name: attachment.file_name }),
        danger: true,
        confirmText: t('common.delete'),
      })
      if (!ok) return
      this.deletingAttachment = true
      try {
        await tasksAPI.deleteAttachment(this.owner, this.repoName, this.number, attachment.id)
        await this.refreshTask()
        toast(t('task.attachmentDeleted'))
      } catch (err) {
        toast(err.message || t('task.deleteFailed'), 'error')
      } finally {
        this.deletingAttachment = false
      }
    },

    taskTransitionOptions: function () {
      var self = this
      var allowed = {
        draft: ['progress'],
        progress: ['review'],
        review: ['completed', 'rejected'],
        rejected: ['progress'],
      }
      var labels = {
        draft: 'task.draft',
        progress: 'task.inProgress',
        review: 'task.review',
        completed: 'task.completed',
        rejected: 'task.cancelled',
      }
      var status = (this.task && this.task.status) || ''
      return (allowed[status] || []).map(function (next) {
        return { value: next, label: labels[next] ? t(labels[next]) : next }
      })
    },

    transitionTask: async function (next) {
      if (!this.task) return
      this.transitioning = true
      var self = this
      try {
        var updated = await tasksAPI.transition(this.owner, this.repoName, this.number, {
          to_status: next,
        })
        if (updated) this.applyTask(updated)
        this.taskTransitions = await tasksAPI
          .transitions(this.owner, this.repoName, this.number)
          .catch(function () {
            return self.taskTransitions
          })
        toast(t('common.success'))
      } catch (err) {
        toast(err.message || t('common.failed'), 'error')
      } finally {
        this.transitioning = false
      }
    },

    createTask: async function () {
      if (!this.newTask.title.trim()) {
        toast(t('task.titleRequired'), 'error')
        return
      }
      this.creating = true
      try {
        var task = await tasksAPI.create(this.owner, this.repoName, this.newTask)
        var taskId = task && task.id
        if (taskId) {
          var self = this
          await Promise.all(
            this.newTaskIssueIds.map(function (issueId) {
              return tasksAPI
                .linkIssue(self.owner, self.repoName, taskId, issueId)
                .catch(function () {
                  /* a failed link must not drop the task that was just created */
                })
            })
          )
        }
        window.location.href = this.base + '/tasks/' + (taskId || '')
      } catch (err) {
        toast(err.message || t('task.createFailed'), 'error')
      } finally {
        this.creating = false
      }
    },

    submitTaskComment: async function () {
      var text = this.taskCommentText.trim()
      if (!text) return
      this.postingTask = true
      try {
        var created = await tasksAPI.createComment(this.owner, this.repoName, this.number, {
          body: text,
        })
        this.taskCommentText = ''
        if (created && created.id) this.taskComments.push(created)
        else await this.loadTask()
      } catch (err) {
        toast(err.message || t('issue.commentFailed'), 'error')
      } finally {
        this.postingTask = false
      }
    },

    // ---------- commit detail ----------

    loadCommit: async function () {
      // 重置需要知道这个提交离 HEAD 有多远，所以顺带取一次列表。
      await this.loadRecentCommits()
      try {
        this.commit = await reposAPI.commitDetail(this.owner, this.repoName, this.sha)
      } catch (err) {
        this.commitError = err.message || t('commitDetail.notFound')
      }
    },

    patchLines: function (patch) {
      if (!patch) return []
      var lines = String(patch).split('\n')
      var out = []
      var inHunk = false
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i]
        if (line.indexOf('@@') === 0) {
          inHunk = true
          out.push({ cls: 'diff__hunk', sign: '', text: line })
          continue
        }
        // git diff-tree prefixes the commit id, author and file headers;
        // only hunk contents below the first @@ marker are diff lines.
        if (!inHunk) continue
        if (line.charAt(0) === '\\') {
          out.push({ cls: 'diff__line diff__meta', sign: '', text: line.replace(/^\\\s?/, '') })
          continue
        }
        var sign = line.charAt(0)
        var cls = 'diff__line'
        if (sign === '+') cls += ' diff__line--add'
        else if (sign === '-') cls += ' diff__line--del'
        else sign = ' '
        out.push({ cls: cls, sign: sign, text: line.slice(1) })
      }
      return out
    },

    // ---------- issues ----------

    loadIssues: async function (page) {
      page = page || this.issuePage || 1
      try {
        var data = await issuesAPI.list(this.owner, this.repoName, { page: page, per_page: ISSUE_PER_PAGE })
        this.issues = Array.isArray(data) ? data : (data && data.data) || []
        this.issueTotal = (data && data.total) || 0
        this.issuePage = (data && data.page) || page
        this.issuePages = Math.max(1, Math.ceil(this.issueTotal / ISSUE_PER_PAGE))
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

    loadPRs: async function (page) {
      page = page || this.prPage || 1
      try {
        var data = await prsAPI.list(this.owner, this.repoName, { page: page, per_page: ISSUE_PER_PAGE })
        this.prs = Array.isArray(data) ? data : (data && data.data) || []
        this.prTotal = (data && data.total) || 0
        this.prPage = (data && data.page) || page
        this.prPages = Math.max(1, Math.ceil(this.prTotal / ISSUE_PER_PAGE))
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
        var newName = (updated && updated.name) || this.settings.name
        toast(t('projectSettings.settingsSaved'))
        // 改名后旧路径会 404，页面必须跟到新的仓库地址。
        if (newName && newName !== this.repoName) {
          window.location.href =
            '/' + encodeURIComponent(this.owner) + '/' + encodeURIComponent(newName) + '/settings'
        }
      } catch (err) {
        toast(err.message || t('projectSettings.saveFailed'), 'error')
      } finally {
        this.saving = false
      }
    },

    transferRepo: async function () {
      var target = (this.transferTarget || '').trim()
      if (!target) {
        toast(t('projectSettings.typeNewOwner'), 'error')
        return
      }
      var ok = await confirmBox({
        title: t('projectSettings.confirmTransfer'),
        message: t('projectSettings.transferWarning'),
        danger: true,
        confirmText: t('projectSettings.transferProject'),
      })
      if (!ok) return
      this.transferring = true
      try {
        await reposAPI.transfer(this.owner, this.repoName, target)
        this.transferTarget = ''
        toast(t('projectSettings.transferSuccess'))
        window.location.href = '/projects'
      } catch (err) {
        toast(err.message || t('projectSettings.transferFailed'), 'error')
      } finally {
        this.transferring = false
      }
    },

    deleteRepo: async function () {
      if (this.deleteConfirm !== this.repoName) {
        toast(t('projectSettings.typeRepoName', { repo: this.repoName }), 'error')
        return
      }
      this.deleting = true
      try {
        await reposAPI.del(this.owner, this.repoName)
        window.location.href = '/projects'
      } catch (err) {
        toast(err.message || t('projectSettings.deleteRepoFailed'), 'error')
      } finally {
        this.deleting = false
      }
    },

    // ---------- sync ----------

    syncDesc: function () {
      var remote = this.repo && this.repo.project_type !== 'local'
      return t(remote ? 'projectSettings.codeSyncDesc' : 'projectSettings.codeSyncLocalDesc')
    },

    isLocalProject: function () {
      return !this.repo || this.repo.project_type === 'local'
    },

    isRemoteProject: function () {
      return !!this.repo && ['mirror', 'public', 'private'].indexOf(this.repo.project_type) >= 0
    },

    canPushProject: function () {
      return !!this.repo && ['public', 'private', 'local'].indexOf(this.repo.project_type) >= 0
    },

    loadSync: async function () {
      var jobs = [this.loadSyncConfig(), this.loadSyncLogs()]
      if (this.isLocalProject()) jobs.push(this.loadRemotes())
      await Promise.all(jobs)
    },

    loadRemotes: async function () {
      this.loadingRemotes = true
      try {
        var data = await reposAPI.getRemotes(this.owner, this.repoName)
        this.remotes = (data && data.remotes) || []
      } catch (err) {
        this.remotes = []
      } finally {
        this.loadingRemotes = false
      }
    },

    addRemote: async function () {
      var name = (this.newRemoteName || '').trim()
      var url = (this.newRemoteUrl || '').trim()
      if (!name || !url) {
        toast(t('projectSettings.remoteUrlRequired'), 'error')
        return
      }
      this.addingRemote = true
      try {
        await reposAPI.addRemote(this.owner, this.repoName, name, url)
        this.newRemoteName = ''
        this.newRemoteUrl = ''
        toast(t('projectSettings.remoteAdded'))
        await this.loadRemotes()
      } catch (err) {
        toast(err.message || t('projectSettings.addRemoteFailed'), 'error')
      } finally {
        this.addingRemote = false
      }
    },

    removeRemote: async function (name) {
      var ok = await confirmBox({
        title: t('projectSettings.removeRemote'),
        message: name,
        danger: true,
        confirmText: t('common.delete'),
      })
      if (!ok) return
      try {
        await reposAPI.removeRemote(this.owner, this.repoName, name)
        toast(t('projectSettings.remoteRemoved'))
        await this.loadRemotes()
      } catch (err) {
        toast(err.message || t('projectSettings.removeRemoteFailed'), 'error')
      }
    },

    pushNamedRemote: async function (name) {
      this.pushingRemote = name
      try {
        await reposAPI.syncPush(this.owner, this.repoName, '', name)
        toast(t('projectSettings.pushSyncStarted'))
        await this.loadSyncLogs()
      } catch (err) {
        toast(err.message || t('projectSettings.syncFailed'), 'error')
      } finally {
        this.pushingRemote = ''
      }
    },

    pushToRemote: async function () {
      var url = (this.pushUrl || '').trim()
      if (!url) {
        toast(t('projectSettings.remoteUrlRequired'), 'error')
        return
      }
      this.syncing = true
      try {
        await reposAPI.syncPush(this.owner, this.repoName, url, '')
        toast(t('projectSettings.pushSyncStarted'))
        await this.loadSyncLogs()
      } catch (err) {
        toast(err.message || t('projectSettings.syncFailed'), 'error')
      } finally {
        this.syncing = false
      }
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
      var self = this
      return this.runSync(function () {
        return reposAPI.syncPull(self.owner, self.repoName)
      }, t('projectSettings.pullCodeStarted'))
    },

    pullIssues: async function () {
      var self = this
      return this.runSync(function () {
        return reposAPI.syncIssues(self.owner, self.repoName)
      }, t('projectSettings.issuesSyncStarted'))
    },

    refreshStats: async function () {
      var self = this
      return this.runSync(function () {
        return reposAPI.refreshStats(self.owner, self.repoName)
      }, t('projectSettings.statsRefreshed'))
    },

    // 代码拉取是同步的，议题/PR 在后台跑，返回 202 后日志里先是 running；
    // 一次点完三步，用户不用记住哪个按钮对应哪类数据。
    syncAll: async function () {
      if (this.syncing) return
      this.syncing = true
      try {
        await reposAPI.syncPull(this.owner, this.repoName)
        await reposAPI.syncIssues(this.owner, this.repoName)
        await reposAPI.refreshStats(this.owner, this.repoName)
        toast(t('projectSettings.syncAllStarted'))
      } catch (err) {
        toast(err.message || t('projectSettings.syncFailed'), 'error')
      } finally {
        this.syncing = false
        await this.loadSyncLogs()
        this.startSyncPolling()
      }
    },

    runSync: async function (fn, okMessage) {
      this.syncing = true
      try {
        await fn()
        toast(okMessage)
        await this.loadSyncLogs()
        this.startSyncPolling()
      } catch (err) {
        toast(err.message || t('projectSettings.syncFailed'), 'error')
      } finally {
        this.syncing = false
      }
    },

    // 后台同步完成后才写最终状态，页面主动轮询到 running 行消失为止。
    startSyncPolling: function () {
      var self = this
      if (this.syncPollTimer) return
      var ticks = 0
      this.syncPollTimer = setInterval(function () {
        ticks++
        self.loadSyncLogs().then(function () {
          var running = (self.syncLogs || []).some(function (log) {
            return log.status === 'running'
          })
          if (!running || ticks >= 100) {
            clearInterval(self.syncPollTimer)
            self.syncPollTimer = null
            self.loadSyncConfig()
          }
        })
      }, 3000)
    },

    // ---------- git workflow ----------

    loadGitStatus: async function () {
      this.gitLoading = true
      try {
        var st = (await reposAPI.getGitStatus(this.owner, this.repoName)) || {}
        this.gitStatus = st
        this.gitStaged = st.staged || []
        this.gitUnstaged = st.unstaged || []
        this.gitUntracked = st.untracked || []
        this.gitConflicts = st.conflict_files || []
        this.gitBranch = st.current_branch || ''
        this.gitOperation = st.rebasing ? 'rebase'
          : st.merging ? 'merge'
            : st.reverting ? 'revert'
              : st.cherry_picking ? 'cherry-pick' : ''
        // 有未完成的操作或未解决的冲突时，提交与切分支都只会继续制造麻烦。
        this.gitBusy = !!this.gitOperation || this.gitConflicts.length > 0
        this.changesCount = this.gitStaged.length + this.gitUnstaged.length + this.gitUntracked.length
        if (!this.branchDraft) this.branchDraft = this.gitBranch
      } catch (err) {
        toast(err.message || t('gitWorkflow.diffLoadFailed'), 'error')
      } finally {
        this.gitLoading = false
      }
      await this.loadStashes()
      await this.loadBranches()
      await this.loadRecentCommits()
    },

    filePaths: function (files) {
      return (files || []).map(function (f) { return f.path })
    },

    stageFiles: async function (files) {
      var paths = this.filePaths(files)
      if (!paths.length || this.staging) return
      this.staging = true
      try {
        await reposAPI.stageFiles(this.owner, this.repoName, paths)
        toast(t('gitWorkflow.stageSuccess'))
        await this.loadGitStatus()
      } catch (err) {
        toast(err.message || t('gitWorkflow.stageFailed'), 'error')
      } finally {
        this.staging = false
      }
    },

    unstageFiles: async function (files) {
      var paths = this.filePaths(files)
      if (!paths.length || this.staging) return
      this.staging = true
      try {
        await reposAPI.unstageFiles(this.owner, this.repoName, paths)
        toast(t('gitWorkflow.unstageSuccess'))
        await this.loadGitStatus()
      } catch (err) {
        toast(err.message || t('gitWorkflow.unstageFailed'), 'error')
      } finally {
        this.staging = false
      }
    },

    stageAll: function () {
      return this.stageFiles(this.gitUnstaged.concat(this.gitUntracked))
    },

    unstageAll: function () {
      return this.unstageFiles(this.gitStaged)
    },

    discardFile: async function (file, isUntracked) {
      var ok = await confirmBox({
        title: t('gitWorkflow.confirmDiscardTitle'),
        message: t('gitWorkflow.confirmDiscardBody', { path: file.path }),
        danger: true,
        confirmText: t('gitWorkflow.discard'),
      })
      if (!ok) return
      try {
        await reposAPI.discard(this.owner, this.repoName, file.path, !!isUntracked)
        if (this.diffPath === file.path) this.diffResult = null
        toast(t('gitWorkflow.discardSuccess'))
        await this.loadGitStatus()
      } catch (err) {
        toast(err.message || t('gitWorkflow.discardFailed'), 'error')
      }
    },

    openDiff: async function (file, staged) {
      this.diffPath = file.path
      this.diffStaged = !!staged
      this.lineSel = {}
      // 只有未暂存的差异能按行暂存；裸仓库没有索引可写。
      this.diffCanPick = !staged && !!(this.repo && this.repo.has_work_tree)
      this.diffLoading = true
      try {
        this.diffResult = await reposAPI.diff(this.owner, this.repoName, file.path, !!staged)
      } catch (err) {
        this.diffResult = null
        toast(err.message || t('gitWorkflow.diffLoadFailed'), 'error')
      } finally {
        this.diffLoading = false
      }
    },

    // 后端按行给出 type（hunk/added/deleted/context），这里换成和提交详情
    // 同一套 .diff__* 结构，两处样式一致。
    diffRows: function () {
      var lines = (this.diffResult && this.diffResult.lines) || []
      return lines.map(function (line) {
        var cls = 'diff__line'
        var sign = ' '
        if (line.type === 'hunk') {
          cls = 'diff__hunk'
          sign = ''
        } else if (line.type === 'added') {
          cls += ' diff__line--add'
          sign = '+'
        } else if (line.type === 'deleted') {
          cls += ' diff__line--del'
          sign = '-'
        }
        return { cls: cls, sign: sign, text: line.content }
      })
    },

    commitStaged: async function () {
      var message = (this.commitMessage || '').trim()
      if (!this.gitStaged.length) {
        toast(t('gitWorkflow.noStagedFiles'), 'error')
        return
      }
      if (!message) {
        toast(t('gitWorkflow.messageRequired'), 'error')
        return
      }
      this.committing = true
      try {
        await reposAPI.commitChanges(this.owner, this.repoName, message)
        this.commitMessage = ''
        this.diffResult = null
        this.diffPath = ''
        toast(t('gitWorkflow.commitSuccess'))
        // 提交会改动 HEAD，仓库头部的提交数与最近提交时间都要重新读。
        await this.loadGitStatus()
        this.repo = await reposAPI.get(this.owner, this.repoName)
      } catch (err) {
        toast(err.message || t('gitWorkflow.commitFailed'), 'error')
      } finally {
        this.committing = false
      }
    },

    loadStashes: async function () {
      try {
        var data = await reposAPI.stashList(this.owner, this.repoName)
        this.stashes = (data && data.stashes) || []
      } catch (err) {
        this.stashes = []
      }
    },

    saveStash: async function () {
      try {
        await reposAPI.stashSave(this.owner, this.repoName, this.stashMessage)
        this.stashMessage = ''
        this.diffResult = null
        this.diffPath = ''
        toast(t('gitWorkflow.stashSaveSuccess'))
        await this.loadGitStatus()
      } catch (err) {
        toast(err.message || t('gitWorkflow.stashSaveFailed'), 'error')
      }
    },

    stashAction: async function (kind, entry) {
      if (kind === 'drop') {
        var ok = await confirmBox({
          title: t('gitWorkflow.confirmStashDropTitle'),
          message: t('gitWorkflow.confirmStashDropBody', { index: entry.index }),
          danger: true,
          confirmText: t('gitWorkflow.discard'),
        })
        if (!ok) return
      }
      var call = kind === 'pop' ? reposAPI.stashPop
        : kind === 'apply' ? reposAPI.stashApply
          : reposAPI.stashDrop
      var okMsg = kind === 'pop' ? t('gitWorkflow.stashPopSuccess')
        : kind === 'apply' ? t('gitWorkflow.stashApplySuccess')
          : t('gitWorkflow.stashDropSuccess')
      var failMsg = kind === 'pop' ? t('gitWorkflow.stashPopFailed')
        : kind === 'apply' ? t('gitWorkflow.stashApplyFailed')
          : t('gitWorkflow.stashDropFailed')
      try {
        await call(this.owner, this.repoName, entry.index)
        toast(okMsg)
        this.diffResult = null
        this.diffPath = ''
        await this.loadGitStatus()
      } catch (err) {
        toast(err.message || failMsg, 'error')
      }
    },

    // 头部和工作流页共用：切换会改变整页内容（文件树、提交列表都跟着变），
    // 成功后直接整页重载，比在各标签页里逐个刷新可靠。
    // 裸仓库没有工作区，不能 checkout——切换的是"查看哪个分支"，
    // 用 ?ref= 记住（提交、文件、README 都按它读取）。
    switchBranch: async function () {
      var branch = this.branchDraft
      if (!branch || branch === this.gitBranch) return
      if (this.repo && !this.repo.has_work_tree) {
        var p = new URLSearchParams(window.location.search)
        if (branch === (this.repo.default_branch || '')) p.delete('ref')
        else p.set('ref', branch)
        p.delete('page')
        window.location.search = p.toString()
        return
      }
      try {
        await reposAPI.checkout(this.owner, this.repoName, branch)
        toast(t('gitWorkflow.switchSuccess', { branch: branch }))
        setTimeout(function () { window.location.reload() }, 300)
      } catch (err) {
        toast(err.message || t('gitWorkflow.switchFailed'), 'error')
        this.branchDraft = this.gitBranch
      }
    },

    createBranchFrom: async function () {
      var name = (this.newBranch || '').trim()
      if (!name) {
        toast(t('gitWorkflow.branchNamePlaceholder'), 'error')
        return
      }
      try {
        await reposAPI.createBranch(this.owner, this.repoName, name, 'HEAD')
        this.newBranch = ''
        toast(t('gitWorkflow.createBranchSuccess'))
        await this.loadGitStatus()
      } catch (err) {
        toast(err.message || t('gitWorkflow.createBranchFailed'), 'error')
      }
    },

    mergeCandidates: function () {
      var current = this.gitBranch
      return (this.branches || []).filter(function (b) { return b !== current })
    },

    mergeInto: async function (source) {
      if (!source) return
      try {
        await reposAPI.mergeBranch(this.owner, this.repoName, source, this.gitBranch)
        toast(t('gitWorkflow.mergeSuccess'))
        await this.loadGitStatus()
      } catch (err) {
        toast(err.message || t('gitWorkflow.mergeFailed'), 'error')
      }
    },

    abortGitOperation: async function () {
      if (!this.gitOperation) return
      try {
        await reposAPI.abortOperation(this.owner, this.repoName, this.gitOperation)
        toast(t('gitWorkflow.abortOp'))
        this.diffResult = null
        this.diffPath = ''
        await this.loadGitStatus()
      } catch (err) {
        toast(err.message || t('common.failed'), 'error')
      }
    },

    // ---------- 行级暂存 ----------

    pickedLines: function () {
      var sel = this.lineSel || {}
      var out = []
      for (var key in sel) {
        if (sel[key]) out.push(parseInt(key, 10))
      }
      return out
    },

    clearLines: function () {
      this.lineSel = {}
    },

    stageSelectedLines: async function () {
      var indices = this.pickedLines()
      if (!indices.length || this.stagingLines) return
      this.stagingLines = true
      try {
        await reposAPI.stagePatch(this.owner, this.repoName, this.diffPath, indices)
        toast(t('gitWorkflow.stageSuccess'))
        this.lineSel = {}
        await this.loadGitStatus()
        // 重新取未暂存的差异，勾选的行已经不在里面了。
        if (this.diffPath) {
          var path = this.diffPath
          var stillUnstaged = this.gitUnstaged.filter(function (f) { return f.path === path })
          if (stillUnstaged.length) await this.openDiff(stillUnstaged[0], false)
          else {
            this.diffResult = null
            this.diffPath = ''
          }
        }
      } catch (err) {
        toast(err.message || t('gitWorkflow.stageFailed'), 'error')
      } finally {
        this.stagingLines = false
      }
    },

    // ---------- 提交操作 ----------

    loadRecentCommits: async function () {
      try {
        var data = await reposAPI.commits(this.owner, this.repoName, { page: 1, per_page: 50 })
        this.recentCommits = (data && data.commits) || []
      } catch (err) {
        this.recentCommits = []
      }
    },

    commitIndex: function (sha) {
      for (var i = 0; i < this.recentCommits.length; i++) {
        if (this.recentCommits[i].hash === sha) return i
      }
      return -1
    },

    cherryPickCommit: async function () {
      if (!this.sha) return
      try {
        await reposAPI.cherryPick(this.owner, this.repoName, [this.sha])
        toast(t('gitWorkflow.cherryPickSuccess'))
        await this.loadRecentCommits()
        await this.loadGitStatus()
      } catch (err) {
        toast(err.message || t('gitWorkflow.cherryPickFailed'), 'error')
      }
    },

    revertCommit: async function () {
      if (!this.sha) return
      try {
        await reposAPI.revertCommit(this.owner, this.repoName, this.sha)
        toast(t('gitWorkflow.revertSuccess'))
        await this.loadRecentCommits()
        await this.loadGitStatus()
      } catch (err) {
        toast(err.message || t('gitWorkflow.revertFailed'), 'error')
      }
    },

    resetToCommit: async function () {
      var idx = this.commitIndex(this.sha)
      if (idx < 0) {
        toast(t('gitWorkflow.resetOnlyRecent'), 'error')
        return
      }
      var count = idx + 1
      var ok = await confirmBox({
        title: t('gitWorkflow.reset'),
        message: t('gitWorkflow.resetConfirm', { count: count }),
        danger: true,
        confirmText: t('gitWorkflow.reset'),
      })
      if (!ok) return
      try {
        await reposAPI.resetCommits(this.owner, this.repoName, count)
        toast(t('gitWorkflow.resetSuccess'))
        window.location.href = this.base + '/commits'
      } catch (err) {
        toast(err.message || t('gitWorkflow.resetFailed'), 'error')
      }
    },

    // ----- 范围删除：commits 列表里选两个端点 -----

    toggleRangeMode: function () {
      this.rangeMode = !this.rangeMode
      this.rangeStart = -1
      this.rangeEnd = -1
    },

    pickRange: function (index) {
      if (this.rangeStart < 0 || this.rangeEnd >= 0) {
        this.rangeStart = index
        this.rangeEnd = -1
      } else {
        this.rangeEnd = index
      }
    },

    inRange: function (index) {
      if (!this.rangeMode || this.rangeStart < 0) return false
      if (this.rangeEnd < 0) return index === this.rangeStart
      var lo = Math.min(this.rangeStart, this.rangeEnd)
      var hi = Math.max(this.rangeStart, this.rangeEnd)
      return index >= lo && index <= hi
    },

    // 列表是从新到旧，所以下标越大越旧；from 必须是更早的那个提交。
    rangeSelection: function () {
      if (this.rangeStart < 0 || this.rangeEnd < 0) return { count: 0 }
      var lo = Math.min(this.rangeStart, this.rangeEnd)
      var hi = Math.max(this.rangeStart, this.rangeEnd)
      return {
        count: hi - lo + 1,
        from: this.commits[hi] && this.commits[hi].hash,
        to: this.commits[lo] && this.commits[lo].hash,
      }
    },

    deleteRange: async function () {
      var sel = this.rangeSelection()
      if (!sel.count || !sel.from || !sel.to) return
      var ok = await confirmBox({
        title: t('gitWorkflow.deleteCommit'),
        message: t('gitWorkflow.deleteConfirm', { count: sel.count }),
        danger: true,
        confirmText: t('gitWorkflow.confirmDeleteCommits'),
      })
      if (!ok) return
      try {
        await reposAPI.deleteCommitRange(this.owner, this.repoName, sel.from, sel.to)
        toast(t('gitWorkflow.deleteSuccess'))
        this.rangeMode = false
        this.rangeStart = -1
        this.rangeEnd = -1
        await this.loadRecentCommits()
        await this.loadCommits(1)
      } catch (err) {
        toast(err.message || t('gitWorkflow.deleteFailed'), 'error')
      }
    },

    // ---------- 交互式 rebase ----------

    // todos 用列表里 base 之上的提交，按从旧到新排列（git 的执行顺序）。
    buildRebase: function () {
      var idx = this.commitIndex(this.rebaseBase)
      if (idx <= 0) {
        this.rebaseTodos = []
        return
      }
      var subset = this.recentCommits.slice(0, idx).reverse()
      this.rebaseTodos = subset.map(function (c) {
        return { action: 'pick', hash: c.hash, short: c.short_hash || c.hash.slice(0, 7), message: c.message }
      })
    },

    moveTodo: function (index, delta) {
      var next = index + delta
      if (next < 0 || next >= this.rebaseTodos.length) return
      var arr = this.rebaseTodos.slice()
      var tmp = arr[index]
      arr[index] = arr[next]
      arr[next] = tmp
      this.rebaseTodos = arr
    },

    runRebase: async function () {
      if (!this.rebaseBase) {
        toast(t('gitWorkflow.baseRequired'), 'error')
        return
      }
      if (!this.rebaseTodos.length) {
        toast(t('gitWorkflow.noCommitsForRebase'), 'error')
        return
      }
      // 工作区不干净时 git 会直接拒绝变基，先给出人话提示。
      if (this.changesCount > 0) {
        toast(t('gitWorkflow.rebaseNeedsClean'), 'error')
        return
      }
      this.rebasing = true
      try {
        await reposAPI.rebaseInteractive(this.owner, this.repoName, this.rebaseBase, this.rebaseTodos)
        toast(t('gitWorkflow.rebaseSuccess'))
        this.rebaseTodos = []
        this.rebaseBase = ''
        await this.loadGitStatus()
        await this.loadRecentCommits()
        this.repo = await reposAPI.get(this.owner, this.repoName)
      } catch (err) {
        toast(err.message || t('gitWorkflow.rebaseFailed'), 'error')
        await this.loadGitStatus()
      } finally {
        this.rebasing = false
      }
    },

    // ---------- misc ----------

    // highlight.js 从 textContent 读取源码再写回 token，因此换文件后重跑一次
    // 就能得到当前内容的着色。
    highlight: function () {
      var el = this.$refs.fileCode
      if (!window.hljs || !el || !this.fileContent) return
      // highlight.js 会跳过已标记的元素；换文件后要先清掉标记再重新着色。
      delete el.dataset.highlighted
      window.hljs.highlightElement(el)
    },

    markdownHtml: function (text, baseDir) {
      if (!text) return ''
      var html = sanitizeHtml(marked.parse(String(text)))
      // baseDir == null means "leave links alone" (comments, issue bodies, ...).
      return baseDir == null ? html : this.resolveMarkdownLinks(html, baseDir)
    },

    // README/file markdown is written relative to the repo, but the SPA serves
    // files from /tree/<path> and images from /raw/<path>. Rewrite those URLs
    // so links and screenshots in README work without manual fixes.
    resolveMarkdownLinks: function (html, baseDir) {
      var doc = new DOMParser().parseFromString(html, 'text/html')

      var links = doc.querySelectorAll('a[href]')
      for (var i = 0; i < links.length; i++) {
        var href = (links[i].getAttribute('href') || '').trim()
        if (!isRelativeHref(href)) continue
        var link = splitHref(href)
        var segs = resolveRepoPath(baseDir, link.path)
        if (!link.path || !segs.length) continue
        var path = segs.map(encodeURIComponent).join('/')
        links[i].setAttribute('href', this.base + '/tree/' + path + link.suffix)
        links[i].setAttribute('target', '_self')
        links[i].removeAttribute('rel')
      }

      var images = doc.querySelectorAll('img[src]')
      for (var j = 0; j < images.length; j++) {
        var src = (images[j].getAttribute('src') || '').trim()
        if (!isRelativeHref(src)) continue
        var img = splitHref(src)
        var imgSegs = resolveRepoPath(baseDir, img.path)
        if (!img.path || !imgSegs.length) continue
        var imgPath = imgSegs.map(encodeURIComponent).join('/')
        images[j].setAttribute('src', API_BASE + '/' + encodeURIComponent(this.owner) + '/' +
          encodeURIComponent(this.repoName) + '/raw/' + imgPath + img.suffix)
      }

      return doc.body.innerHTML
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
    statusOf: taskStatus,
    projectTypeClass: projectTypeClass,
    projectTypeLabel: projectTypeLabel,
  }
})
