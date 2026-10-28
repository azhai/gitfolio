// Presentation metadata for domain values shared across pages.
import { t } from './i18n.js'

export var PROJECT_TYPES = [
  { value: 'local', label: 'projectType.local', desc: 'projectType.localDesc' },
  { value: 'mirror', label: 'projectType.mirror', desc: 'projectType.mirrorDesc' },
  { value: 'public', label: 'projectType.public', desc: 'projectType.publicDesc' },
  { value: 'private', label: 'projectType.private', desc: 'projectType.privateDesc' },
]

var TYPE_CLASS = {
  mirror: 'badge--blue',
  public: 'badge--green',
  private: 'badge--amber',
  local: 'badge--gray',
}

var TYPE_LABEL = {
  mirror: 'project.mirror',
  public: 'project.public',
  private: 'project.private',
  local: 'common.local',
}

export function projectTypeLabel(type) {
  return t(TYPE_LABEL[type] || 'common.local')
}

export function projectTypeClass(type) {
  return TYPE_CLASS[type] || 'badge--gray'
}

export var TASK_STATUS = {
  draft: { bg: '#f3f4f6', color: '#6b7280', label: 'task.draft' },
  todo: { bg: '#dbeafe', color: '#2563eb', label: 'task.todo' },
  progress: { bg: '#fef3c7', color: '#d97706', label: 'task.inProgress' },
  in_progress: { bg: '#fef3c7', color: '#d97706', label: 'task.inProgress' },
  review: { bg: '#ede9fe', color: '#7c3aed', label: 'task.review' },
  completed: { bg: '#dcfce7', color: '#16a34a', label: 'task.completed' },
  done: { bg: '#dcfce7', color: '#16a34a', label: 'task.done' },
  rejected: { bg: '#fef2f2', color: '#dc2626', label: 'task.cancelled' },
  cancelled: { bg: '#fef2f2', color: '#dc2626', label: 'task.cancelled' },
}

export function taskStatus(status) {
  var meta = TASK_STATUS[status] || TASK_STATUS.draft
  return { bg: meta.bg, color: meta.color, label: t(meta.label) }
}

export var TASK_STATUS_ORDER = ['draft', 'progress', 'review', 'completed', 'rejected']

export function repoUrl(repo) {
  return '/' + repo.owner + '/' + repo.name
}

export function initials(name) {
  if (!name) return '?'
  return String(name).slice(0, 2).toUpperCase()
}

export function shortSha(sha) {
  return sha ? String(sha).slice(0, 7) : ''
}
