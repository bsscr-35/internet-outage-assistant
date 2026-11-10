import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCurrentUser, loginUser, registerUser } from '../services/api'
import AuthContext from './AuthContext'

const TOKEN_KEY = 'outage-assistant-token'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(window.sessionStorage.getItem(TOKEN_KEY)))

  useEffect(() => {
    if (!window.sessionStorage.getItem(TOKEN_KEY)) return undefined

    let active = true
    fetchCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser)
      })
      .catch((error) => {
        if (error.response?.status === 401) window.sessionStorage.removeItem(TOKEN_KEY)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const saveSession = useCallback((result) => {
    window.sessionStorage.setItem(TOKEN_KEY, result.token)
    setUser(result.user)
    return result.user
  }, [])

  const login = useCallback(async (credentials) => saveSession(await loginUser(credentials)), [saveSession])
  const register = useCallback(async (details) => saveSession(await registerUser(details)), [saveSession])
  const logout = useCallback(() => {
    window.sessionStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, loading, login, register, logout }), [
    user,
    loading,
    login,
    register,
    logout,
  ])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
