import zh from './zh'
import en from './en'

var currentLang = localStorage.getItem('gitfolio_lang') || 'zh'
var langPacks = { zh, en }

function applyLangAttr(lang) {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
}

applyLangAttr(currentLang)

export function setLanguage(lang) {
  if (langPacks[lang]) {
    currentLang = lang
    localStorage.setItem('gitfolio_lang', lang)
    applyLangAttr(lang)
  }
}

export function getLanguage() {
  return currentLang
}

export function t(key, params) {
  var parts = key.split('.')
  var obj = langPacks[currentLang]
  for (var i = 0; i < parts.length; i++) {
    if (obj == null) return key
    obj = obj[parts[i]]
  }
  if (obj == null) return key
  if (typeof obj === 'string' && params) {
    return obj.replace(/\{(\w+)\}/g, function(match, paramKey) {
      return params[paramKey] !== undefined ? params[paramKey] : match
    })
  }
  return obj
}

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  var d = new Date(dateStr)
  var diff = (Date.now() - d.getTime()) / 1000
  var time = langPacks[currentLang].time
  if (diff < 10) return time.justNow
  if (diff < 60) return Math.floor(diff) + time.secondsAgo
  if (diff < 3600) return Math.floor(diff / 60) + time.minutesAgo
  if (diff < 86400) return Math.floor(diff / 3600) + time.hoursAgo
  if (diff < 604800) return Math.floor(diff / 86400) + time.daysAgo
  var locale = currentLang === 'zh' ? 'zh-CN' : 'en-US'
  return d.toLocaleDateString(locale)
}

export { default as zh } from './zh'
export { default as en } from './en'

export default { t, setLanguage, getLanguage, timeAgo, zh, en }
