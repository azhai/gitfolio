const BASE = '/api/v1'

function getToken() {
  return localStorage.getItem('gitfolio_token') || ''
}

function setToken(token) {
  if (token) {
    localStorage.setItem('gitfolio_token', token)
  } else {
    localStorage.removeItem('gitfolio_token')
  }
}

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json' }
  const t = getToken()
  if (t) h['Authorization'] = `Bearer ${t}`
  return Object.assign(h, extra)
}

async function request(url, opts = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: headers(opts.headers),
    ...opts,
  })
  if (res.status === 401) {
    setToken(null)
    var current = window.location.pathname + window.location.search + window.location.hash
    if (current === '/login' || current === '/') current = '/home'
    window.location.href = '/login?redirect=' + encodeURIComponent(current)
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  if (res.status === 204 || opts.method === 'DELETE') return null
  var json = await res.json()
  if (json && json.data !== undefined) {
    if (json.total !== undefined) return json
    return json.data
  }
  return json
}

const api = {

  get(url, params) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`${url}${qs}`, { method: 'GET' })
  },

  post(url, data) {
    return request(url, { method: 'POST', body: JSON.stringify(data) })
  },

  put(url, data) {
    return request(url, { method: 'PUT', body: JSON.stringify(data) })
  },

  del(url) {
    return request(url, { method: 'DELETE' })
  },
}

export const authAPI = {
  login(username, password) {
    return api.post('/auth/login', { username, password }).then((data) => {
      if (data.token) setToken(data.token)
      return data
    })
  },
  logout() {
    setToken(null)
    return api.post('/auth/logout').catch(() => null)
  },
  me() {
    return api.get('/user/me')
  },
  updateMe(data) {
    return api.put('/user/me', data)
  },
}

export const statsAPI = {
  get() {
    return api.get('/stats')
  },
  recentIssues(limit) {
    return api.get('/recent-issues', { limit: limit || 5 })
  },
  recentTasks(limit) {
    return api.get('/recent-tasks', { limit: limit || 5 })
  },
}

export const reposAPI = {
  list(params) {
    return api.get('/repos', params)
  },
  get(owner, repo) {
    return api.get('/' + owner + '/' + repo)
  },
  create(data) {
    return api.post('/repos', data)
  },
  detectRepo(url) {
    return api.get('/repos/github-info', { url: url })
  },
  update(owner, repo, data) {
    return api.put('/' + owner + '/' + repo, data)
  },
  del(owner, repo) {
    return api.del('/' + owner + '/' + repo)
  },
  transfer(owner, repo, newOwner) {
    return api.post('/' + owner + '/' + repo + '/transfer', { new_owner: newOwner })
  },
  tree(owner, repo, path, ref) {
    path = path || ''
    ref = ref || 'HEAD'
    var p = path ? '/' + path.split('/').map(function(s) { return encodeURIComponent(s) }).join('/') : ''
    return api.get('/' + owner + '/' + repo + '/tree' + p, { ref: ref })
  },
  file(owner, repo, path, ref) {
    ref = ref || 'HEAD'
    var encodedPath = path.split('/').map(function(s) { return encodeURIComponent(s) }).join('/')
    return api.get('/' + owner + '/' + repo + '/file/' + encodedPath, { ref: ref })
  },
  rawFile(owner, repo, path, ref) {
    ref = ref || 'HEAD'
    var encodedPath = path.split('/').map(function(s) { return encodeURIComponent(s) }).join('/')
    return api.get('/' + owner + '/' + repo + '/raw/' + encodedPath, { ref: ref })
  },
  branches(owner, repo) {
    return api.get('/' + owner + '/' + repo + '/branches')
  },
  tags(owner, repo) {
    return api.get('/' + owner + '/' + repo + '/tags')
  },
  commits(owner, repo, params) {
    return api.get('/' + owner + '/' + repo + '/commits', params)
  },
  commitDetail(owner, repo, sha) {
    return api.get('/' + owner + '/' + repo + '/commits/' + sha)
  },
  lastCommit(owner, repo, ref) {
    return api.get('/' + owner + '/' + repo + '/last-commit', { ref: ref || 'HEAD' })
  },
  contributors(owner, repo) {
    return api.get('/' + owner + '/' + repo + '/contributors')
  },
  codeStats(owner, repo) {
    return api.get('/' + owner + '/' + repo + '/code-stats')
  },
  commitActivity(owner, repo, days) {
    return api.get('/' + owner + '/' + repo + '/commit-activity', { days: days || 30 })
  },
  compare(owner, repo, basehead) {
    return api.get('/' + owner + '/' + repo + '/compare/' + basehead)
  },
  star(owner, repo) {
    return api.post('/' + owner + '/' + repo + '/star')
  },
  unstar(owner, repo) {
    return api.del('/' + owner + '/' + repo + '/star')
  },
  watch(owner, repo) {
    return api.post('/' + owner + '/' + repo + '/watch')
  },
  unwatch(owner, repo) {
    return api.del('/' + owner + '/' + repo + '/watch')
  },
  syncPull(owner, repo) {
    return api.post('/' + owner + '/' + repo + '/sync/pull')
  },
  setDefaultBranch(owner, repo, branch) {
    return api.put('/' + owner + '/' + repo + '/default-branch', { branch: branch })
  },
  createTag(owner, repo, name, branch) {
    return api.post('/' + owner + '/' + repo + '/tags', { name: name, branch: branch })
  },
  deleteTag(owner, repo, name) {
    return api.del('/' + owner + '/' + repo + '/tags/' + name)
  },
  deleteCommitRange(owner, repo, fromSHA, toSHA) {
    return api.post('/' + owner + '/' + repo + '/delete-commits', { from_sha: fromSHA, to_sha: toSHA })
  },
  revertCommit(owner, repo, sha) {
    return api.post('/' + owner + '/' + repo + '/revert', { sha })
  },
  resetCommits(owner, repo, count) {
    return api.post('/' + owner + '/' + repo + '/reset', { count })
  },
  abortOperation(owner, repo, type) {
    return api.post('/' + owner + '/' + repo + '/abort', { type })
  },
  getGitStatus(owner, repo) {
    return api.get('/' + owner + '/' + repo + '/git-status')
  },
  stageFiles(owner, repo, files) {
    return api.post('/' + owner + '/' + repo + '/stage', { files: files })
  },
  unstageFiles(owner, repo, files) {
    return api.post('/' + owner + '/' + repo + '/unstage', { files: files })
  },
  commitChanges(owner, repo, message) {
    return api.post('/' + owner + '/' + repo + '/commit', { message: message })
  },
  diff(owner, repo, filePath, staged) {
    return api.get('/' + owner + '/' + repo + '/diff', { path: filePath, staged: staged ? 'true' : 'false' })
  },
  commitFileDiff(owner, repo, sha, filePath) {
    return api.get('/' + owner + '/' + repo + '/commit-diff', { sha: sha, path: filePath })
  },
  stagePatch(owner, repo, filePath, lineIndices) {
    return api.post('/' + owner + '/' + repo + '/stage-patch', { path: filePath, line_indices: lineIndices })
  },
  discard(owner, repo, filePath, isUntracked) {
    return api.post('/' + owner + '/' + repo + '/discard', { path: filePath, is_untracked: isUntracked })
  },
  checkout(owner, repo, branch) {
    return api.post('/' + owner + '/' + repo + '/checkout', { branch: branch })
  },
  rebaseInteractive(owner, repo, base, todos) {
    return api.post('/' + owner + '/' + repo + '/rebase-interactive', { base: base, todos: todos })
  },
  stashList(owner, repo) {
    return api.get('/' + owner + '/' + repo + '/stash-list')
  },
  stashSave(owner, repo, message) {
    return api.post('/' + owner + '/' + repo + '/stash', { message: message || '' })
  },
  stashPop(owner, repo, index) {
    return api.post('/' + owner + '/' + repo + '/stash-pop', { index: index || 0 })
  },
  stashApply(owner, repo, index) {
    return api.post('/' + owner + '/' + repo + '/stash-apply', { index: index || 0 })
  },
  stashDrop(owner, repo, index) {
    return api.post('/' + owner + '/' + repo + '/stash-drop', { index: index || 0 })
  },
  syncIssues(owner, repo) {
    return api.post('/' + owner + '/' + repo + '/sync/issues')
  },
  syncPush(owner, repo, remoteUrl) {
    return api.post('/' + owner + '/' + repo + '/sync/push', { remote_url: remoteUrl || '' })
  },
  refreshStats(owner, repo) {
    return api.post('/' + owner + '/' + repo + '/refresh-stats')
  },
  retryMigrate(owner, repo) {
    return api.post('/' + owner + '/' + repo + '/retry-migrate')
  },
  getSyncConfig(owner, repo) {
    return api.get('/' + owner + '/' + repo + '/sync/config')
  },
  updateSyncConfig(owner, repo, data) {
    return api.put('/' + owner + '/' + repo + '/sync/config', data)
  },
  getSyncLogs(owner, repo) {
    return api.get('/' + owner + '/' + repo + '/sync/logs')
  },
}

export const groupsAPI = {
  list() {
    return api.get('/groups')
  },
  get(name) {
    return api.get('/groups/' + name)
  },
  create(data) {
    return api.post('/groups', data)
  },
  update(name, data) {
    return api.put('/groups/' + name, data)
  },
  members(name) {
    return api.get('/groups/' + name + '/members')
  },
  addMember(name, data) {
    return api.post('/groups/' + name + '/members', data)
  },
  removeMember(name, username) {
    return api.del('/groups/' + name + '/members/' + username)
  },
}

export const activitiesAPI = {
  list(params) {
    return api.get('/activities', params)
  },
  create(data) {
    return api.post('/activities', data)
  },
}

export const snippetsAPI = {
  list(params) {
    return api.get('/snippets', params)
  },
  get(id) {
    return api.get('/snippets/' + id)
  },
  create(data) {
    return api.post('/snippets', data)
  },
  update(id, data) {
    return api.put('/snippets/' + id, data)
  },
  del(id) {
    return api.del('/snippets/' + id)
  },
}

export const issuesAPI = {
  list(owner, repo, params) {
    return api.get('/' + owner + '/' + repo + '/issues', params)
  },
  get(owner, repo, number) {
    return api.get('/' + owner + '/' + repo + '/issues/' + number)
  },
  create(owner, repo, data) {
    return api.post('/' + owner + '/' + repo + '/issues', data)
  },
  update(owner, repo, number, data) {
    return api.put('/' + owner + '/' + repo + '/issues/' + number, data)
  },
  comments(owner, repo, number) {
    return api.get('/' + owner + '/' + repo + '/issues/' + number + '/comments')
  },
  createComment(owner, repo, number, data) {
    return api.post('/' + owner + '/' + repo + '/issues/' + number + '/comments', data)
  },
}

export const labelsAPI = {
  list(owner, repo) {
    return api.get('/' + owner + '/' + repo + '/labels')
  },
}

export const prsAPI = {
  list(owner, repo, params) {
    return api.get('/' + owner + '/' + repo + '/pull_requests', params)
  },
  get(owner, repo, number) {
    return api.get('/' + owner + '/' + repo + '/pull_requests/' + number)
  },
  create(owner, repo, data) {
    return api.post('/' + owner + '/' + repo + '/pull_requests', data)
  },
  update(owner, repo, number, data) {
    return api.put('/' + owner + '/' + repo + '/pull_requests/' + number, data)
  },
  merge(owner, repo, number) {
    return api.post('/' + owner + '/' + repo + '/pull_requests/' + number + '/merge')
  },
  close(owner, repo, number) {
    return api.post('/' + owner + '/' + repo + '/pull_requests/' + number + '/close')
  },
  reopen(owner, repo, number) {
    return api.post('/' + owner + '/' + repo + '/pull_requests/' + number + '/reopen')
  },
  commits(owner, repo, number, params) {
    return api.get('/' + owner + '/' + repo + '/pull_requests/' + number + '/commits', params)
  },
  files(owner, repo, number) {
    return api.get('/' + owner + '/' + repo + '/pull_requests/' + number + '/files')
  },
}

export const tasksAPI = {
  list(owner, repo, params) {
    return api.get('/' + owner + '/' + repo + '/tasks', params)
  },
  get(owner, repo, id) {
    return api.get('/' + owner + '/' + repo + '/tasks/' + id)
  },
  create(owner, repo, data) {
    return api.post('/' + owner + '/' + repo + '/tasks', data)
  },
  update(owner, repo, id, data) {
    return api.put('/' + owner + '/' + repo + '/tasks/' + id, data)
  },
  del(owner, repo, id) {
    return api.del('/' + owner + '/' + repo + '/tasks/' + id)
  },
  transition(owner, repo, id, data) {
    return api.post('/' + owner + '/' + repo + '/tasks/' + id + '/transition', data)
  },
  transitions(owner, repo, id) {
    return api.get('/' + owner + '/' + repo + '/tasks/' + id + '/transitions')
  },
  comments(owner, repo, id) {
    return api.get('/' + owner + '/' + repo + '/tasks/' + id + '/comments')
  },
  createComment(owner, repo, id, data) {
    return api.post('/' + owner + '/' + repo + '/tasks/' + id + '/comments', data)
  },
  linkPR(owner, repo, id, data) {
    return api.post('/' + owner + '/' + repo + '/tasks/' + id + '/pull_requests', data)
  },
  unlinkPR(owner, repo, id, prId) {
    return api.del('/' + owner + '/' + repo + '/tasks/' + id + '/pull_requests/' + prId)
  },
  taskPRs(owner, repo, id) {
    return api.get('/' + owner + '/' + repo + '/tasks/' + id + '/pull_requests')
  },
  taskCommits(owner, repo, id) {
    return api.get('/' + owner + '/' + repo + '/tasks/' + id + '/commits')
  },
  startTimer(owner, repo, id) {
    return api.post('/' + owner + '/' + repo + '/tasks/' + id + '/timer/start')
  },
  stopTimer(owner, repo, id) {
    return api.post('/' + owner + '/' + repo + '/tasks/' + id + '/timer/stop')
  },
  timeLogs(owner, repo, id) {
    return api.get('/' + owner + '/' + repo + '/tasks/' + id + '/time-logs')
  },
  timeSummary(owner, repo, id) {
    return api.get('/' + owner + '/' + repo + '/tasks/' + id + '/time-summary')
  },
  uploadAttachment(owner, repo, id, file) {
    var formData = new FormData()
    formData.append('file', file)
    return fetch('/api/v1/' + owner + '/' + repo + '/tasks/' + id + '/attachments', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken() },
      body: formData,
    }).then(function(res) { return res.json() })
  },
  deleteAttachment(owner, repo, id, attachmentId) {
    return api.del('/' + owner + '/' + repo + '/tasks/' + id + '/attachments/' + attachmentId)
  },
  linkIssue(owner, repo, id, issueId) {
    return api.post('/' + owner + '/' + repo + '/tasks/' + id + '/issues', { issue_id: issueId })
  },
  unlinkIssue(owner, repo, id, issueId) {
    return api.del('/' + owner + '/' + repo + '/tasks/' + id + '/issues/' + issueId)
  },
}

export const releasesAPI = {
  list(owner, repo) {
    return api.get('/' + owner + '/' + repo + '/releases')
  },
  get(owner, repo, tag) {
    return api.get('/' + owner + '/' + repo + '/releases/' + tag)
  },
  sync(owner, repo) {
    return api.post('/' + owner + '/' + repo + '/releases/sync')
  },
}

export const usersAPI = {
  list(params) {
    return api.get('/users', params)
  },
  create(data) {
    return api.post('/users', data)
  },
  get(username) {
    return api.get('/users/' + username)
  },
  repos(username) {
    return api.get('/users/' + username + '/repos')
  },
  getMe() {
    return api.get('/user/me')
  },
  updateMe(data) {
    return api.put('/user/me', data)
  },
  changePassword(data) {
    return api.post('/user/me/password', data)
  },
  uploadAvatar(username, file) {
    var formData = new FormData()
    formData.append('avatar', file)
    return fetch('/api/v1/users/' + username + '/avatar', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken() },
      body: formData,
    }).then(function(res) { return res.json() })
  },
  update(username, data) {
    return api.put('/users/' + username, data)
  },
}

export const adminAPI = {
  listSyncPoints() {
    return api.get('/system/admin/sync-points')
  },
  updateSyncPoint(id, data) {
    return api.put('/system/admin/sync-points/' + id, data)
  },
  listSyncLogs(limit) {
    return api.get('/system/admin/sync-logs', { limit: limit || 50 })
  },
}

export default { getToken, setToken, authAPI, statsAPI, reposAPI, groupsAPI, activitiesAPI, snippetsAPI, issuesAPI, labelsAPI, prsAPI, tasksAPI, releasesAPI, usersAPI, adminAPI }
