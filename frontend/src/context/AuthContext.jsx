import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { apiGet, apiPost } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiGet('/auth/me')
      setUser(data.user ?? null)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    apiGet('/auth/me')
      .then(data => {
        if (!cancelled) setUser(data.user ?? null)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiPost('/auth/logout')
    } finally {
      setUser(null)
      window.location.href = '/'
    }
  }, [])

  const applySession = useCallback((sessionUser) => {
    setUser(sessionUser)
  }, [])

  return (
    <AuthContext.Provider value={{ user, authLoading, refreshUser, logout, applySession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.')
  return ctx
}
