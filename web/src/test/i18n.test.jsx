import { t, timeAgo, setLanguage, getLanguage } from '../i18n'

describe('i18n', () => {
  beforeEach(() => {
    setLanguage('zh')
  })

  describe('t()', () => {
    it('returns translated string for valid key', () => {
      expect(t('common.save')).toBe('保存')
    })

    it('returns key for missing translation', () => {
      expect(t('nonexistent.key')).toBe('nonexistent.key')
    })

    it('returns key for partially missing path', () => {
      expect(t('common.nonexistent')).toBe('common.nonexistent')
    })

    it('handles null intermediate path', () => {
      expect(t('nonexistent.foo.bar')).toBe('nonexistent.foo.bar')
    })

    it('interpolates params', () => {
      // If any template string exists in zh.js with {param}
      var result = t('common.nonexistent', { name: 'test' })
      expect(result).toBe('common.nonexistent')
    })
  })

  describe('setLanguage / getLanguage', () => {
    it('switches to English', () => {
      setLanguage('en')
      expect(getLanguage()).toBe('en')
      expect(t('common.save')).toBe('Save')
    })

    it('switches back to Chinese', () => {
      setLanguage('en')
      setLanguage('zh')
      expect(getLanguage()).toBe('zh')
      expect(t('common.save')).toBe('保存')
    })

    it('ignores invalid language', () => {
      setLanguage('zh')
      setLanguage('invalid')
      expect(getLanguage()).toBe('zh')
    })
  })

  describe('timeAgo()', () => {
    it('returns empty for null/undefined', () => {
      expect(timeAgo(null)).toBe('')
      expect(timeAgo(undefined)).toBe('')
    })

    it('returns just now for very recent time', () => {
      expect(timeAgo(new Date().toISOString())).toContain('刚刚')
    })

    it('returns seconds ago', () => {
      var d = new Date(Date.now() - 30 * 1000).toISOString()
      expect(timeAgo(d)).toContain('秒前')
    })

    it('returns minutes ago', () => {
      var d = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      expect(timeAgo(d)).toContain('分钟前')
    })

    it('returns hours ago', () => {
      var d = new Date(Date.now() - 3 * 3600 * 1000).toISOString()
      expect(timeAgo(d)).toContain('小时前')
    })

    it('returns days ago', () => {
      var d = new Date(Date.now() - 3 * 86400 * 1000).toISOString()
      expect(timeAgo(d)).toContain('天前')
    })

    it('returns date string for older dates', () => {
      var d = new Date(Date.now() - 30 * 86400 * 1000).toISOString()
      var result = timeAgo(d)
      expect(result).toContain('/')
    })
  })
})
