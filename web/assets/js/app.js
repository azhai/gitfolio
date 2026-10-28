// Entry point for every page: registers Alpine stores/components, mounts the
// shared chrome, loads the page module and finally starts Alpine.
import Alpine from '../lib/alpine.min.js'

import { authStore } from './auth.js'
import { toastStore, dialogStore, toast, toastError } from './ui.js'
import {
  t,
  timeAgo,
  formatDate,
  formatDateTime,
  formatBytes,
  formatDuration,
  getLanguage,
  setLanguage,
} from './i18n.js'
import { icon, fileIcon, hasIcon, STATUS_ICONS, ACTIVITY_ICONS } from './icon.js'
import { mountShell } from './shell.js'

window.Alpine = Alpine

// Templates call these directly; Alpine resolves unknown identifiers on window.
window.t = t
window.icon = icon
window.fileIcon = fileIcon
window.toast = toast
window.toastError = toastError
window.fmt = { timeAgo, formatDate, formatDateTime, formatBytes, formatDuration }
window.lang = { get: getLanguage, set: setLanguage }

Alpine.store('auth', authStore)
Alpine.store('toast', toastStore)
Alpine.store('dialog', dialogStore)

// x-icon="name" or x-icon="{ name: 'star', size: 14, color: '#f59e0b' }"
Alpine.directive('icon', function (el, params, utils) {
  var evaluate = utils.evaluate
  var effect = utils.effect
  effect(function () {
    var value = evaluate(params.expression)
    if (!value) {
      el.innerHTML = ''
      return
    }
    if (typeof value === 'string') {
      el.innerHTML = icon(value)
    } else {
      el.innerHTML = icon(value.name, value)
    }
  })
})

// Shared helpers used by page components.
export var shared = { t, timeAgo, formatDate, formatDateTime, formatBytes, formatDuration, icon, fileIcon, hasIcon, STATUS_ICONS, ACTIVITY_ICONS, toast, toastError }

async function boot() {
  mountShell()
  await Alpine.store('auth').load()

  var page = document.body.dataset.page
  if (page) {
    try {
      await import('./pages/' + page + '.js')
    } catch (err) {
      console.error('failed to load page module: ' + page, err)
    }
  }

  Alpine.start()
}

boot()
