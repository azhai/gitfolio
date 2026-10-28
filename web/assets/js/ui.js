// Small UI helpers: toasts, confirm dialogs, clipboard, formatting.

var toastSeq = 0

export var toastStore = {
  items: [],
  push: function (message, type, timeout) {
    if (!message) return
    var id = ++toastSeq
    this.items.push({ id: id, message: message, type: type || 'success' })
    var self = this
    setTimeout(function () {
      self.remove(id)
    }, timeout || 3600)
  },
  remove: function (id) {
    this.items = this.items.filter(function (item) {
      return item.id !== id
    })
  },
}

export var dialogStore = {
  open: false,
  title: '',
  message: '',
  confirmText: '',
  danger: false,
  _resolve: null,
  ask: function (opts) {
    var self = this
    this.title = opts.title || ''
    this.message = opts.message || ''
    this.confirmText = opts.confirmText || ''
    this.danger = !!opts.danger
    this.open = true
    return new Promise(function (resolve) {
      self._resolve = resolve
    })
  },
  settle: function (value) {
    this.open = false
    if (this._resolve) {
      this._resolve(value)
      this._resolve = null
    }
  },
  ok: function () {
    this.settle(true)
  },
  cancel: function () {
    this.settle(false)
  },
}

function store(name) {
  return window.Alpine && window.Alpine.store(name)
}

export function toast(message, type) {
  var s = store('toast')
  if (s) s.push(message, type)
  else console.log('[toast]', type || 'info', message)
}

export function toastError(err) {
  var message = err && err.message ? err.message : String(err)
  toast(message, 'error')
}

export function confirmBox(opts) {
  var s = store('dialog')
  if (!s) return Promise.resolve(window.confirm(opts.message || opts.title || ''))
  return s.ask(opts)
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      var el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    toast('Copied')
    return true
  } catch (e) {
    toastError(e)
    return false
  }
}

export function debounce(fn, wait) {
  var timer = null
  return function () {
    var args = arguments
    var self = this
    clearTimeout(timer)
    timer = setTimeout(function () {
      fn.apply(self, args)
    }, wait || 250)
  }
}

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Query string / path helpers ------------------------------------------------

export function query(name) {
  return new URLSearchParams(window.location.search).get(name) || ''
}

// Owner/repo live at the first two path segments: /<owner>/<repo>/<tab>/...
export function projectRef() {
  var parts = window.location.pathname.split('/').filter(Boolean)
  if (parts.length < 2) return { owner: '', repo: '', rest: [] }
  return { owner: decodeURIComponent(parts[0]), repo: decodeURIComponent(parts[1]), rest: parts.slice(2) }
}

export function go(url, replace) {
  if (replace) window.location.replace(url)
  else (window.location.href = url)
}
