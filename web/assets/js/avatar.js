// Avatar rendering shared by the user directory, profile pages and admin table.
// A remote avatar is used when present; a failing URL degrades to initials
// instead of leaving a broken-image glyph in the middle of a table row.

function initialsOf(name) {
  var raw = String(name || '').trim()
  if (!raw) return '?'
  // Keep letters/digits only so paths or e-mails do not leak separators.
  var cleaned = raw.replace(/[^0-9A-Za-z\u4e00-\u9fa5]/g, '')
  if (!cleaned) return '?'
  return cleaned.slice(0, 2).toUpperCase()
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function avatarHtml(url, name) {
  var initials = escapeHtml(initialsOf(name))
  if (!url || /^https?:\/\/via\.placeholder\.com/.test(url)) return initials
  var safe = escapeHtml(url)
  return (
    '<img src="' + safe + '" alt="" loading="lazy" referrerpolicy="no-referrer" ' +
    "onerror=\"this.onerror=null;this.replaceWith(document.createTextNode('" + initials + "'))\">"
  )
}

export function initials(name) {
  return initialsOf(name)
}
