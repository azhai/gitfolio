// Personal settings: profile fields (including the own repository directory),
// avatar upload and password change.
import Alpine from '../../lib/alpine.min.js'
import { usersAPI } from '../api.js'
import { t } from '../i18n.js'
import { toast, toastError } from '../ui.js'

Alpine.data('settings', function () {
  return {
    loading: true,
    saving: false,
    scanning: false,
    uploading: false,
    changingPassword: false,
    avatarUrl: '',
    profile: {
      username: '',
      email: '',
      full_name: '',
      bio: '',
      website: '',
      location: '',
      repo_root: '',
    },
    password: { current: '', next: '', confirm: '' },

    init: async function () {
      try {
        var me = await usersAPI.getMe()
        if (me) {
          this.avatarUrl = me.avatar || ''
          this.profile = {
            username: me.username || '',
            email: me.email || '',
            full_name: me.full_name || '',
            bio: me.bio || '',
            website: me.website || '',
            location: me.location || '',
            repo_root: me.repo_root || '',
          }
        }
      } catch (err) {
        toastError(err)
      } finally {
        this.loading = false
      }
    },

    saveProfile: async function () {
      this.saving = true
      try {
        await usersAPI.updateMe({
          full_name: this.profile.full_name,
          bio: this.profile.bio,
          website: this.profile.website,
          location: this.profile.location,
          repo_root: this.profile.repo_root,
        })
        await this.$store.auth.refresh()
        toast(t('userSettings.profileUpdated'), 'success')
      } catch (err) {
        toastError(err)
      } finally {
        this.saving = false
      }
    },

    // 扫描自有仓库目录，把未登记的 git 仓库补进系统。
    // 目录本身没设置时按钮不会出现，但直接调用还是要拦一下。
    scanRepos: async function () {
      if (!this.profile.repo_root) {
        toast(t('userSettings.needRepoRoot'), 'error')
        return
      }
      if (this.scanning) return
      this.scanning = true
      try {
        var data = await usersAPI.scanRepos()
        if (data && data.added > 0) {
          toast(t('userSettings.scanSuccess', {
            count: data.added,
            names: (data.names || []).join(', '),
          }), 'success')
        } else {
          toast(t('userSettings.scanNone'), 'info')
        }
      } catch (err) {
        toast(err.message || t('userSettings.scanFailed'), 'error')
      } finally {
        this.scanning = false
      }
    },

    uploadAvatar: async function (event) {
      var file = event.target.files && event.target.files[0]
      if (!file) return
      if (file.size > 2 * 1024 * 1024) {
        toast(t('userSettings.avatarTooLarge'), 'error')
        return
      }
      this.uploading = true
      try {
        var updated = await usersAPI.uploadAvatar(this.profile.username, file)
        if (updated && updated.avatar) this.avatarUrl = updated.avatar
        await this.$store.auth.refresh()
        toast(t('userSettings.avatarUpdated'), 'success')
      } catch (err) {
        toast(err.message || t('userSettings.avatarUploadFailed'), 'error')
      } finally {
        this.uploading = false
        event.target.value = ''
      }
    },

    changePassword: async function () {
      if (!this.password.current) {
        toast(t('userSettings.currentPasswordRequired'), 'error')
        return
      }
      if (this.password.next.length < 6) {
        toast(t('userSettings.newPasswordTooShort'), 'error')
        return
      }
      if (this.password.next !== this.password.confirm) {
        toast(t('userSettings.passwordMismatch'), 'error')
        return
      }
      this.changingPassword = true
      try {
        await usersAPI.changePassword({
          current_password: this.password.current,
          new_password: this.password.next,
        })
        this.password = { current: '', next: '', confirm: '' }
        toast(t('userSettings.passwordChanged'), 'success')
      } catch (err) {
        toastError(err)
      } finally {
        this.changingPassword = false
      }
    },

    t: t,
  }
})
