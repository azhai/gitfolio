// Renders the chrome shared by every page: top navigation, toast host, modal
// host and footer. Injected before Alpine starts so the markup is part of the
// initial component tree.
import { icon } from './icon.js'
import { t, getLanguage, setLanguage } from './i18n.js'
import { statsAPI } from './api.js'

var NAV_ITEMS = [
  { key: 'nav.dashboard', href: '/home', icon: 'house', match: ['/home'] },
  { key: 'nav.projects', href: '/projects', icon: 'folder-open', match: ['/projects'] },
  { key: 'nav.groups', href: '/groups', icon: 'users', match: ['/groups'] },
  { key: 'nav.activity', href: '/activity', icon: 'activity', match: ['/activity'] },
  { key: 'nav.snippets', href: '/snippets', icon: 'file-code', match: ['/snippets'] },
]

function isActive(item, pathname) {
  for (var i = 0; i < item.match.length; i++) {
    var prefix = item.match[i]
    if (pathname === prefix || pathname.indexOf(prefix + '/') === 0) return true
  }
  return false
}

function navLink(item, pathname) {
  var active = isActive(item, pathname) ? ' is-active' : ''
  var color = active ? '#16a34a' : '#6b7280'
  return (
    '<a class="nav-link' + active + '" href="' + item.href + '">' +
    icon(item.icon, { size: 15, color: color }) +
    '<span>' + t(item.key) + '</span></a>'
  )
}

export function topnavHTML() {
  var pathname = window.location.pathname
  var lang = getLanguage()
  return (
    '<header class="topnav">' +
    '<div class="topnav__inner">' +
    '<a class="brand" href="/home">' +
    '<img class="brand__logo" src="/logo-lagoon.svg" alt="GitFolio">' +
    '<span class="brand__name">GitFolio</span>' +
    '</a>' +
    '<nav class="nav-links">' +
    NAV_ITEMS.map(function (item) {
      return navLink(item, pathname)
    }).join('') +
    '</nav>' +
    '<div class="nav-actions">' +
    '<div class="nav-search">' +
    icon('search', { size: 14 }) +
    '<input type="search" placeholder="' + t('projects.searchPlaceholder') + '"' +
    ' @keydown.enter="if ($el.value.trim()) location.href = \'/projects?q=\' + encodeURIComponent($el.value.trim())">' +
    '</div>' +
    '<div class="lang-switch" data-lang="' + lang + '">' +
    '<div class="lang-switch__thumb"></div>' +
    '<button class="' + (lang === 'zh' ? 'is-active' : '') + '" @click="window.__setLang(\'zh\')">中文</button>' +
    '<button class="' + (lang === 'en' ? 'is-active' : '') + '" @click="window.__setLang(\'en\')">EN</button>' +
    '</div>' +
    '<a class="nav-icon-btn" href="/activity" title="' + t('nav.activity') + '">' + icon('bell', { size: 18 }) + '</a>' +
    '<div class="user-menu" x-data="{ open: false }" @click.outside="open = false">' +
    '<button class="user-menu__trigger" x-show="$store.auth.isAuthenticated" x-cloak @click="open = !open">' +
    '<span class="avatar avatar--sm" x-text="$store.auth.initials"></span>' +
    '<span class="user-menu__name" x-text="$store.auth.displayName"></span>' +
    icon('chevron-down', { size: 12, color: '#9ca3af' }) +
    '</button>' +
    '<div class="dropdown" x-show="open" x-cloak>' +
    '<a class="dropdown__item" :href="$store.auth.profileUrl">' +
    icon('user', { size: 15 }) + '<span>' + t('nav.profile') + '</span></a>' +
    '<a class="dropdown__item" href="/settings">' +
    icon('settings', { size: 15 }) + '<span>' + t('nav.settings') + '</span></a>' +
    '<a class="dropdown__item" href="/admin" x-show="$store.auth.isAdmin" x-cloak>' +
    icon('shield', { size: 15 }) + '<span>' + t('nav.admin') + '</span></a>' +
    '<div class="dropdown__sep"></div>' +
    '<button class="dropdown__item is-danger" @click="$store.auth.logout().then(() => location.href = \'/login\')">' +
    icon('log-out', { size: 15 }) + '<span>' + t('nav.logout') + '</span></button>' +
    '</div>' +
    '<a class="btn btn--primary btn--sm" href="/login" x-show="!$store.auth.isAuthenticated" x-cloak>' + t('nav.login') + '</a>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</header>'
  )
}

export function overlaysHTML() {
  return (
    '<div class="toasts" x-data>' +
    '<template x-for="item in $store.toast.items" :key="item.id">' +
    '<div class="toast" :class="item.type === \'error\' ? \'toast--error\' : (item.type === \'info\' ? \'toast--info\' : \'\')">' +
    '<span x-text="item.message"></span></div>' +
    '</template>' +
    '</div>' +
    '<div x-data x-show="$store.dialog.open" x-cloak class="modal-backdrop" @keydown.escape.window="$store.dialog.open && $store.dialog.cancel()">' +
    '<div class="modal" @click.outside="$store.dialog.open && $store.dialog.cancel()">' +
    '<div class="modal__head" x-text="$store.dialog.title"></div>' +
    '<div class="modal__body"><p x-text="$store.dialog.message"></p></div>' +
    '<div class="modal__foot">' +
    '<button class="btn" @click="$store.dialog.cancel()">' + t('common.cancel') + '</button>' +
    '<button class="btn" :class="$store.dialog.danger ? \'btn--danger\' : \'btn--primary\'" @click="$store.dialog.ok()">' +
    '<span x-text="$store.dialog.confirmText || \'' + t('common.confirm') + '\'"></span></button>' +
    '</div></div></div>'
  )
}

export function footerHTML(siteMark) {
  if (!siteMark) return '<footer class="app-footer"></footer>'
  return (
    '<footer class="app-footer">' +
    '<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">' + siteMark + '</a>' +
    '</footer>'
  )
}

export function mountShell() {
  var slot = document.getElementById('app-shell')
  if (slot) slot.outerHTML = topnavHTML()

  var footer = document.getElementById('app-footer')
  if (footer) footer.outerHTML = footerHTML('')

  document.body.insertAdjacentHTML('beforeend', overlaysHTML())

  statsAPI
    .get()
    .then(function (data) {
      if (!data || !data.site_mark) return
      var el = document.querySelector('.app-footer')
      if (el) el.outerHTML = footerHTML(data.site_mark)
    })
    .catch(function () {
      /* footer mark is optional */
    })
}

// Exposed for the injected markup; switching reloads so every string refreshes.
window.__setLang = function (lang) {
  if (setLanguage(lang)) window.location.reload()
}
