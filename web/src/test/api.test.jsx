import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock localStorage
var store = {}
var localStorageMock = {
  getItem: vi.fn(function(key) { return store[key] || null }),
  setItem: vi.fn(function(key, value) { store[key] = value }),
  removeItem: vi.fn(function(key) { delete store[key] }),
  clear: vi.fn(function() { store = {} }),
}
vi.stubGlobal('localStorage', localStorageMock)

// Must import after mocking
var api = await import('../api/index')

describe('API module', () => {
  beforeEach(() => {
    store = {}
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()
  })

  describe('setToken / getToken', () => {
    it('stores token in localStorage', () => {
      api.default.setToken('test-token-123')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('gitfolio_token', 'test-token-123')
    })

    it('removes token when null', () => {
      api.default.setToken(null)
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('gitfolio_token')
    })

    it('retrieves token from localStorage', () => {
      store['gitfolio_token'] = 'my-token'
      var token = api.default.getToken()
      expect(token).toBe('my-token')
    })

    it('returns empty string when no token', () => {
      var token = api.default.getToken()
      expect(token).toBe('')
    })
  })

  describe('authAPI', () => {
    it('has login method', () => {
      expect(typeof api.authAPI.login).toBe('function')
    })

    it('has logout method', () => {
      expect(typeof api.authAPI.logout).toBe('function')
    })

    it('has me method', () => {
      expect(typeof api.authAPI.me).toBe('function')
    })
  })

  describe('reposAPI', () => {
    it('has all required methods', () => {
      var methods = ['list', 'get', 'create', 'update', 'del', 'tree', 'file', 'branches', 'tags', 'commits', 'star', 'unstar']
      methods.forEach(function(method) {
        expect(typeof api.reposAPI[method]).toBe('function')
      })
    })
  })

  describe('issuesAPI', () => {
    it('has all required methods', () => {
      var methods = ['list', 'get', 'create', 'update', 'comments', 'createComment']
      methods.forEach(function(method) {
        expect(typeof api.issuesAPI[method]).toBe('function')
      })
    })
  })

  describe('tasksAPI', () => {
    it('has all required methods', () => {
      var methods = ['list', 'get', 'create', 'update', 'del', 'transition', 'comments', 'startTimer', 'stopTimer']
      methods.forEach(function(method) {
        expect(typeof api.tasksAPI[method]).toBe('function')
      })
    })
  })
})
