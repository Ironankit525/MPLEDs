import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getToken, setToken as persistToken } from '../api/client.js'
import { getProfile, login as apiLogin, register as apiRegister } from '../api/auth.js'

const AuthContext = createContext(null)

/**
 * Owns the logged-in user's token + profile (username, agency_name,
 * district, role). Hydrates from localStorage on load by calling
 * GET /api/auth/me — that both confirms the stored token is still
 * valid and gets the role that role-based routing redirects on,
 * without decoding the JWT client-side.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // 'loading' | 'authenticated' | 'anonymous'
  const [status, setStatus] = useState('loading')

  const hydrate = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setUser(null)
      setStatus('anonymous')
      return
    }
    try {
      const profile = await getProfile()
      setUser(profile)
      setStatus('authenticated')
    } catch {
      // Token missing/expired/rejected — clear it rather than get stuck
      // in a loop of failed authenticated calls.
      persistToken(null)
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const login = useCallback(
    async (credentials) => {
      const data = await apiLogin(credentials)
      persistToken(data.access_token)
      await hydrate()
      return data
    },
    [hydrate],
  )

  const register = useCallback((payload) => apiRegister(payload), [])

  const logout = useCallback(() => {
    persistToken(null)
    setUser(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo(
    () => ({ user, status, login, register, logout, refreshProfile: hydrate }),
    [user, status, login, register, logout, hydrate],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
