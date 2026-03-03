import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth-context'
import { hasPermission, type Permission } from '@/types/rbac'

export function RequireAuth() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />
  return <Outlet />
}

export function RequirePermission({ permission }: { permission: Permission }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/auth/login" replace />

  const allowed = hasPermission(user.roles, permission)
  if (!allowed) return <Navigate to="/dashboard" replace />

  return <Outlet />
}

export function RequireAnyPermission({ permissions }: { permissions: Permission[] }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/auth/login" replace />

  const allowed = permissions.some((permission) => hasPermission(user.roles, permission))
  if (!allowed) return <Navigate to="/dashboard" replace />

  return <Outlet />
}
