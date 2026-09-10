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

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { APP_USERS, USER_LIST, type AppUser } from '@/lib/appConfig'

interface AppUserContextValue {
  user: AppUser | null
  currentUser: AppUser | null
  setUser: (u: AppUser) => void
  allUsers: AppUser[]
}

const AppUserContext = createContext<AppUserContextValue>({
  user: null,
  currentUser: null,
  setUser: () => {},
  allUsers: USER_LIST,
})

const STORAGE_KEY = 'cardio_active_user_id'
const DEFAULT_USER_ID = 'DR_JAYACHANDRA'

export function AppUserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AppUser | null>(null)

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    const userId = stored && APP_USERS[stored] ? stored : DEFAULT_USER_ID
    setUserState(APP_USERS[userId])
  }, [])

  const setUser = (u: AppUser) => {
    localStorage.setItem(STORAGE_KEY, u.id)
    setUserState(u)
  }

  return (
    <AppUserContext.Provider value={{ user, currentUser: user, setUser, allUsers: USER_LIST }}>
      {children}
    </AppUserContext.Provider>
  )
}

export function useAppUser() {
  return useContext(AppUserContext)
}
