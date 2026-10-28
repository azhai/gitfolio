// Language packs and text helpers shared by every page.
import zh from './locales/zh.js'
import en from './locales/en.js'

var packs = { zh: zh, en: en }
var currentLang = localStorage.getItem('gitfolio_lang') || 'zh'
if (!packs[currentLang]) currentLang = 'zh'

function applyLangAttr(lang) {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
}

applyLangAttr(currentLang)

export function setLanguage(lang) {
  if (!packs[lang]) return false
  currentLang = lang
  localStorage.setItem('gitfolio_lang', lang)
  applyLangAttr(lang)
  return true
}

export function getLanguage() {
  return currentLang
}

export function t(key, params) {
  if (!key) return ''
  var parts = String(key).split('.')
  var obj = packs[currentLang]
  for (var i = 0; i < parts.length; i++) {
    if (obj == null) return key
    obj = obj[parts[i]]
  }
  if (obj == null) return key
  if (typeof obj === 'string' && params) {
    return obj.replace(/\{(\w+)\}/g, function (match, name) {
      return params[name] !== undefined ? params[name] : match
    })
  }
  return obj
}

export function formatDuration(ms) {
  if (!ms || ms <= 0) return '-'
  if (ms < 1000) return ms + ' ms'
  return (ms / 1000).toFixed(1) + ' s'
}

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  var d = new Date(dateStr)
  // Zero-value timestamps (0001-01-01) reach us as "1/1" and only add noise.
  if (isNaN(d.getTime()) || d.getFullYear() < 1970) return ''
  var diff = (Date.now() - d.getTime()) / 1000
  var time = packs[currentLang].time || {}
  if (diff < 10) return time.justNow || 'just now'
  if (diff < 60) return Math.floor(diff) + (time.secondsAgo || 's ago')
  if (diff < 3600) return Math.floor(diff / 60) + (time.minutesAgo || 'm ago')
  if (diff < 86400) return Math.floor(diff / 3600) + (time.hoursAgo || 'h ago')
  if (diff < 604800) return Math.floor(diff / 86400) + (time.daysAgo || 'd ago')
  return d.toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'en-US')
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  var d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'en-US')
}

// dated('创建于', value) renders "创建于 3d ago", or nothing at all when the
// backend hands us a zero timestamp. Templates bind the result with x-show so
// the label never dangles without a value.
export function dated(label, value) {
  var rel = timeAgo(value)
  return rel ? label + ' ' + rel : ''
}

export function formatDateTime(dateStr) {
  if (!dateStr) return ''
  var d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  var pad = function (n) {
    return n < 10 ? '0' + n : '' + n
  }
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  )
}

export function formatBytes(n) {
  if (!n || n < 0) return '-'
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB'
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

export { zh, en }
export default { t, setLanguage, getLanguage, timeAgo, formatDate, formatDateTime, formatBytes, formatDuration }
