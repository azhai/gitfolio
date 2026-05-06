import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../api/index'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(function() {
    return authAPI.me().then(function(data) {
      if (data) setUser(data)
      return data
    }).catch(function() {
      setUser(null)
      return null
    })
  }, [])

  useEffect(function() {
    var token = localStorage.getItem('gitfolio_token')
    if (!token) {
      setLoading(false)
      return
    }
    fetchMe().finally(function() {
      setLoading(false)
    })
  }, [fetchMe])

  const login = async function(username, password) {
    var data = await authAPI.login(username, password)
    if (data && data.user) {
      setUser(data.user)
    }
    return data
  }

  const register = async function(regData) {
    var data = await authAPI.register(regData)
    return data
  }

  const logout = async function() {
    try {
      await authAPI.logout()
    } catch(e) {}
    localStorage.removeItem('gitfolio_token')
    setUser(null)
  }

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser: fetchMe,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  var ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default AuthContext
