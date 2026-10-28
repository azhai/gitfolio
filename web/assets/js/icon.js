// Inline SVG icons generated from lucide, plus helpers that pick an icon for
// a file name or a status value.
import { ICONS } from './icons.js'

var DEFAULT_SIZE = 16

export function icon(name, opts) {
  var body = ICONS[name]
  if (!body) return ''
  opts = opts || {}
  var size = opts.size || DEFAULT_SIZE
  var width = opts.stroke || 2
  var cls = 'icon' + (opts.class ? ' ' + opts.class : '')
  var style = opts.color ? ' style="color:' + opts.color + '"' : ''
  return (
    '<svg class="' + cls + '" width="' + size + '" height="' + size +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + width +
    '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + style + '>' +
    body +
    '</svg>'
  )
}

export function hasIcon(name) {
  return !!ICONS[name]
}

// --- file type icons -------------------------------------------------------

var FILE_RULES = [
  { icon: 'folder', color: '#54aeff', dir: true },
  { exts: ['makefile', 'gnumakefile'], icon: 'wrench', color: '#6d8086' },
  { exts: ['.gitignore', '.dockerignore'], icon: 'file-x', color: '#f54d27' },
  { exts: ['.md', '.markdown'], icon: 'file-text', color: '#083fa1' },
  { exts: ['.go'], icon: 'file-code', color: '#00ADD8' },
  { exts: ['.js', '.jsx', '.mjs', '.cjs'], icon: 'braces', color: '#b8a400' },
  { exts: ['.ts', '.tsx'], icon: 'file-code', color: '#3178C6' },
  { exts: ['.py'], icon: 'file-code', color: '#3572A5' },
  { exts: ['.rs'], icon: 'file-code', color: '#dea584' },
  { exts: ['.java'], icon: 'file-code', color: '#b07219' },
  { exts: ['.php'], icon: 'file-code', color: '#4F5D95' },
  { exts: ['.c', '.cpp', '.cc', '.h', '.hpp'], icon: 'file-code', color: '#f34b7d' },
  { exts: ['.rb'], icon: 'file-code', color: '#701516' },
  { exts: ['.css', '.scss', '.sass', '.less'], icon: 'palette', color: '#563d7c' },
  { exts: ['.html', '.htm'], icon: 'globe', color: '#e34c26' },
  { exts: ['.json'], icon: 'braces', color: '#4b5563' },
  { exts: ['.yaml', '.yml', '.toml', '.ini'], icon: 'settings-2', color: '#a16207' },
  { exts: ['.sql'], icon: 'database', color: '#e38c00' },
  { exts: ['.sh', '.bash', '.zsh'], icon: 'terminal', color: '#3f6212' },
  { exts: ['.dockerfile'], icon: 'container', color: '#2496ed' },
  { exts: ['.vue'], icon: 'layers', color: '#41b883' },
  { exts: ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico'], icon: 'images', color: '#a074c4' },
  { exts: ['.lock'], icon: 'lock', color: '#9ca3af' },
  { exts: ['.mod'], icon: 'package', color: '#00ADD8' },
  { exts: ['.sum'], icon: 'circle-check', color: '#9ca3af' },
]

export function fileIcon(name, isDir) {
  if (isDir) return { icon: 'folder', color: '#54aeff' }
  var lower = String(name || '').toLowerCase()
  for (var i = 1; i < FILE_RULES.length; i++) {
    var rule = FILE_RULES[i]
    for (var j = 0; j < rule.exts.length; j++) {
      var ext = rule.exts[j]
      if (ext.charAt(0) === '.') {
        if (lower.endsWith(ext)) return rule
      } else if (lower === ext) {
        return rule
      }
    }
  }
  return { icon: 'file-text', color: '#8b949e' }
}

// --- semantic maps ---------------------------------------------------------

export var STATUS_ICONS = {
  open: { icon: 'circle-dot', color: '#22c55e' },
  closed: { icon: 'circle-check-big', color: '#6b7280' },
  draft: { icon: 'file-pen', color: '#9ca3af' },
  progress: { icon: 'loader', color: '#f59e0b' },
  review: { icon: 'eye', color: '#3b82f6' },
  completed: { icon: 'circle-check-big', color: '#22c55e' },
  merged: { icon: 'git-merge', color: '#8b5cf6' },
  public: { icon: 'globe', color: '#22c55e' },
  private: { icon: 'lock', color: '#dc2626' },
  mirror: { icon: 'download', color: '#3b82f6' },
  local: { icon: 'server', color: '#6b7280' },
}

export var ACTIVITY_ICONS = {
  push: { icon: 'upload', color: '#22c55e', bg: '#f0fdf4' },
  mr: { icon: 'git-pull-request', color: '#8b5cf6', bg: '#faf5ff' },
  issue: { icon: 'triangle-alert', color: '#f59e0b', bg: '#fffbeb' },
  comment: { icon: 'message-square', color: '#3b82f6', bg: '#eff6ff' },
  star: { icon: 'star', color: '#ec4899', bg: '#fdf2f8' },
  fork: { icon: 'git-fork', color: '#f97316', bg: '#fff7ed' },
  release: { icon: 'rocket', color: '#f97316', bg: '#fff7ed' },
}
