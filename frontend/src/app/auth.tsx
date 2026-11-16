import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, setUnauthorizedHandler, type Meta } from '../lib/api'
import type { User } from '../features/decisions/types'

interface AuthValue {
  user: User | null
  meta: Meta | null
  booting: boolean
  setUser: (user: User | null) => void
  refreshUser: () => Promise<void>
  logout: () => Promise<void>
}
const AuthContext = createContext<AuthValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is missing')
  return value
}
/** For pages rendered only inside RequireAuth. */
export function useApp() {
  const { user, ...rest } = useAuth()
  if (!user) throw new Error('useApp used outside an authenticated route')
  return { user, ...rest }
}

export function applyTheme(theme: User['theme'] | undefined) {
  const root = document.documentElement
  const dark = theme === 'dark' || (theme !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  root.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#101613' : '#f5f6f3')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [booting, setBooting] = useState(true)

  const refreshUser = useCallback(async () => {
    try { setUser((await api.session()).user) } catch { setUser(null) }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    Promise.allSettled([refreshUser(), api.meta().then(setMeta)]).finally(() => setBooting(false))
  }, [refreshUser])

  useEffect(() => {
    applyTheme(user?.theme)
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const listener = () => applyTheme(user?.theme)
    media?.addEventListener?.('change', listener)
    return () => media?.removeEventListener?.('change', listener)
  }, [user?.theme])

  const logout = useCallback(async () => {
    try { await api.logout() } finally { setUser(null) }
  }, [])

  const value = useMemo(() => ({ user, meta, booting, setUser, refreshUser, logout }), [user, meta, booting, refreshUser, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
