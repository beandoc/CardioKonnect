'use client'
/**
 * context/AppUserContext.tsx
 *
 * Provides the current application user via React context.
 * Persists the active user to localStorage so it survives page refreshes.
 *
 * In production, this would be replaced with Firebase Auth + Firestore user lookup.
 * For now, it provides a user switcher to demo multi-user access control.
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { APP_USERS, USER_LIST, type AppUser } from '@/lib/appConfig'

interface AppUserContextValue {
  user: AppUser | null
  currentUser: AppUser | null
  setUser: (u: AppUser) => void
  logout: () => void
  allUsers: AppUser[]
}

const AppUserContext = createContext<AppUserContextValue>({
  user: null,
  currentUser: null,
  setUser: () => {},
  logout: () => {},
  allUsers: USER_LIST,
})

const STORAGE_KEY = 'cardio_active_user_id'
const DEFAULT_USER_ID = 'DR_JAYACHANDRA'

export function AppUserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AppUser | null>(() => {
    if (typeof window === 'undefined') return APP_USERS[DEFAULT_USER_ID]
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && APP_USERS[stored]) return APP_USERS[stored]
      const isAuth = localStorage.getItem('cardiokonnect_auth') === 'true'
      if (isAuth) return APP_USERS[DEFAULT_USER_ID]
    } catch {}
    return APP_USERS[DEFAULT_USER_ID]
  })

  // Hydrate from localStorage after mount
  useEffect(() => {
    try {
      const isAuth = localStorage.getItem('cardiokonnect_auth') === 'true'
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && APP_USERS[stored]) {
        setUserState(APP_USERS[stored])
      } else if (isAuth) {
        setUserState(APP_USERS[DEFAULT_USER_ID])
      }
    } catch {}
  }, [])

  const setUser = useCallback((u: AppUser) => {
    try {
      localStorage.setItem(STORAGE_KEY, u.id)
      localStorage.setItem('cardiokonnect_auth', 'true')
    } catch {}
    setUserState(u)
  }, [])

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem('cardiokonnect_auth')
      localStorage.removeItem('cardiokonnect_role')
    } catch {}
    setUserState(null)
    window.location.href = '/login'
  }, [])

  const contextValue = useMemo(() => ({
    user,
    currentUser: user,
    setUser,
    logout,
    allUsers: USER_LIST,
  }), [user, setUser, logout])

  return (
    <AppUserContext.Provider value={contextValue}>
      {children}
    </AppUserContext.Provider>
  )
}

export function useAppUser() {
  return useContext(AppUserContext)
}
