/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, type ReactNode } from 'react'
import { login as apiLogin, register as apiRegister } from '@/lib/mock-api'
import type { RoleName, SessionUser } from '@/types/domain'

interface AuthContextValue {
  user: SessionUser | null
  isAuthenticated: boolean
  login: (payload: { email: string; password: string }) => Promise<void>
  register: (payload: {
    email: string
    password: string
    fullName: string
    campusId: string
    role: RoleName
  }) => Promise<void>
  logout: () => void
  switchRole: (role: RoleName) => void
}

const STORAGE_KEY = 'mcms-session-v1'
const ACTIVE_ROLE_KEY = 'mcms-active-role-v1'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readStoredUser() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  const parsed = JSON.parse(raw) as SessionUser

  // Session lama dari mode mock menggunakan id seperti "user_student".
  // Setelah migrasi ke Convex id valid berbentuk document id Convex.
  if (parsed.userId.startsWith('user_')) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(ACTIVE_ROLE_KEY)
    return null
  }

  return parsed
}

function getActiveRole(user: SessionUser | null): RoleName | null {
  if (!user || user.roles.length === 0) return null
  const stored = localStorage.getItem(ACTIVE_ROLE_KEY) as RoleName | null
  if (stored && user.roles.includes(stored)) return stored
  return user.roles[0]
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => readStoredUser())

  async function login(payload: { email: string; password: string }) {
    const sessionUser = await apiLogin(payload)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser))
    localStorage.setItem(ACTIVE_ROLE_KEY, sessionUser.roles[0])
    setUser(sessionUser)
  }

  async function register(payload: {
    email: string
    password: string
    fullName: string
    campusId: string
    role: RoleName
  }) {
    const sessionUser = await apiRegister(payload)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser))
    localStorage.setItem(ACTIVE_ROLE_KEY, sessionUser.roles[0])
    setUser(sessionUser)
  }

  function switchRole(role: RoleName) {
    if (!user || !user.roles.includes(role)) return
    localStorage.setItem(ACTIVE_ROLE_KEY, role)
    setUser({ ...user })
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(ACTIVE_ROLE_KEY)
    setUser(null)
  }

  const value = {
    user: user
      ? {
          ...user,
          roles: [getActiveRole(user) ?? user.roles[0], ...user.roles.filter((role) => role !== getActiveRole(user))],
        }
      : null,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    switchRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
