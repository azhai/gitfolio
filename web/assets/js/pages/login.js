// Login page: form validation, then redirect back to ?redirect=.
import Alpine from '../../lib/alpine.min.js'
import { t, getLanguage } from '../i18n.js'

Alpine.data('loginPage', function () {
  return {
    form: { username: '', password: '' },
    error: '',
    loading: false,
    redirect: '/home',

    init: function () {
      var params = new URLSearchParams(window.location.search)
      this.redirect = params.get('redirect') || '/home'
      var self = this
      // Auth resolves before Alpine starts, so the store is already populated.
      if (this.$store.auth.isAuthenticated) {
        window.location.replace(this.redirect)
      }
      document.documentElement.lang = getLanguage() === 'zh' ? 'zh-CN' : 'en'
      self.$nextTick(function () {
        var input = document.getElementById('username')
        if (input) input.focus()
      })
    },

    t: t,

    submit: async function () {
      this.error = ''
      var username = this.form.username.trim()
      if (!username) {
        this.error = t('auth.enterUsername')
        return
      }
      if (!this.form.password) {
        this.error = t('auth.enterPassword')
        return
      }
      this.loading = true
      try {
        await this.$store.auth.login(username, this.form.password)
        window.location.replace(this.redirect)
      } catch (err) {
        this.error = (err && err.message) || t('auth.invalidCredentials')
      } finally {
        this.loading = false
      }
    },
  }
})
