// Activity feed.
import Alpine from '../../lib/alpine.min.js'
import { activitiesAPI } from '../api.js'
import { t, timeAgo } from '../i18n.js'
import { ACTIVITY_ICONS } from '../icon.js'

Alpine.data('activity', function () {
  return {
    loading: true,
    activities: [],

    init: async function () {
      try {
        var data = await activitiesAPI.list({ per_page: 50 })
        this.activities = Array.isArray(data) ? data : (data && data.data) || []
      } catch (err) {
        this.activities = []
      } finally {
        this.loading = false
      }
    },

    meta: function (type) {
      return ACTIVITY_ICONS[type] || ACTIVITY_ICONS.push
    },

    t: t,
    timeAgo: timeAgo,
  }
})
