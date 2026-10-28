'use client'
/**
 * context/AppUserContext.tsx
 *
 * Provides the current application user via React context.
 *
 * Credentials are checked server-side by /api/login; the signed-in user id is
 * kept in localStorage so the session survives refreshes. Every data read is
 * scoped to that user's site via setDataScope.
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { APP_USERS, type AppUser } from '@/lib/appConfig'
import { setDataScope, writeAudit } from '@/lib/firestore'

interface AppUserContextValue {
  user: AppUser | null
  currentUser: AppUser | null
  /** True until the stored session has been read on the client. */
  authLoading: boolean
  login: (u: AppUser) => void
  logout: () => void
}

const AppUserContext = createContext<AppUserContextValue>({
  user: null,
  currentUser: null,
  authLoading: true,
  login: () => {},
  logout: () => {},
})

const STORAGE_KEY = 'cardio_active_user_id'

function applyScope(u: AppUser | null) {
  setDataScope(u ? { siteId: u.siteId, global: u.role === 'SuperAdmin', uid: `session:${u.id}`, userId: u.id } : null)
}

export function AppUserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AppUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const syncFromStorage = () => {
      let stored: string | null = null
      try {
        stored = localStorage.getItem(STORAGE_KEY)
      } catch {}
      const u = stored && APP_USERS[stored] ? APP_USERS[stored] : null
      applyScope(u)
      setUserState(u)
      setAuthLoading(false)
    }

    syncFromStorage()
    window.addEventListener('storage', syncFromStorage)
    return () => window.removeEventListener('storage', syncFromStorage)
  }, [])

  const login = useCallback((u: AppUser) => {
    try {
      localStorage.setItem(STORAGE_KEY, u.id)
      localStorage.setItem('cardiokonnect_auth', 'true')
    } catch {}
    applyScope(u)
    setUserState(u)
  }, [])

  const logout = useCallback(() => {
    // Record the logout while the session scope is still set.
    writeAudit('LOGOUT', 'session', user?.id ?? '', '')
      .catch(() => {})
      .finally(() => {
        try {
          localStorage.removeItem(STORAGE_KEY)
          localStorage.removeItem('cardiokonnect_auth')
          localStorage.removeItem('cardiokonnect_role')
        } catch {}
        applyScope(null)
        setUserState(null)
        window.location.href = '/login'
      })
  }, [user])

  const contextValue = useMemo(() => ({
    user,
    currentUser: user,
    authLoading,
    login,
    logout,
  }), [user, authLoading, login, logout])

  return (
    <AppUserContext.Provider value={contextValue}>
      {children}
    </AppUserContext.Provider>
  )
}

export function useAppUser() {
  return useContext(AppUserContext)
}
