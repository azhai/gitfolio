// Dashboard: counters plus the most recent projects, issues and tasks.
import Alpine from '../../lib/alpine.min.js'
import { reposAPI, statsAPI } from '../api.js'
import { t, timeAgo } from '../i18n.js'
import { projectTypeClass, projectTypeLabel, repoUrl, taskStatus } from '../model.js'

Alpine.data('dashboard', function () {
  return {
    loading: true,
    repos: [],
    issues: [],
    tasks: [],
    cards: [],

    init: function () {
      var self = this
      Promise.all([
        statsAPI.get().catch(function () {
          return null
        }),
        reposAPI.list({ per_page: 5 }).catch(function () {
          return []
        }),
        statsAPI.recentIssues(5).catch(function () {
          return []
        }),
        statsAPI.recentTasks(5).catch(function () {
          return []
        }),
      ]).then(function (result) {
        var s = result[0] || {}
        self.repos = Array.isArray(result[1]) ? result[1] : (result[1] && result[1].data) || []
        self.issues = Array.isArray(result[2]) ? result[2] : []
        self.tasks = Array.isArray(result[3]) ? result[3] : []
        self.cards = [
          {
            label: t('dashboard.totalRepos'),
            value: s.total_repos || 0,
            sub: (s.total_repos || 0) + ' ' + t('dashboard.totalReposUnit'),
          },
          {
            label: t('issue.openIssue'),
            value: s.open_issues || 0,
            sub: (s.closed_issues || 0) + ' ' + t('dashboard.closedIssues'),
          },
          {
            label: t('pr.mergeRequest'),
            value: s.open_prs || 0,
            sub: (s.closed_prs || 0) + ' ' + t('pr.closed'),
          },
          {
            label: t('dashboard.totalStars'),
            value: s.total_stars || 0,
            sub: (s.total_forks || 0) + ' ' + t('dashboard.totalForks'),
          },
        ]
        self.loading = false
      })
    },

    t: t,
    timeAgo: timeAgo,
    repoUrl: repoUrl,
    projectTypeClass: projectTypeClass,
    projectTypeLabel: projectTypeLabel,
    statusOf: taskStatus,
  }
})
