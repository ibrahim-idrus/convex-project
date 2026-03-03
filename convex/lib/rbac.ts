import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

type Ctx = QueryCtx | MutationCtx

type RoleName = 'super_admin' | 'campus_admin' | 'lecturer' | 'student' | 'finance'

export type Permission =
  | 'full:system'
  | 'manage:subjects'
  | 'manage:semesters'
  | 'manage:lecturers'
  | 'view:reports'
  | 'input:grades'
  | 'take:attendance'
  | 'view:grades'
  | 'view:attendance'
  | 'view:payments'
  | 'manage:payments'
  | 'generate:invoices'
  | 'manage:scholarships'
  | 'manage:announcements'
  | 'chat:send'

const rolePermissionMap: Record<RoleName, Permission[]> = {
  super_admin: ['full:system'],
  campus_admin: [
    'manage:subjects',
    'manage:semesters',
    'manage:lecturers',
    'view:reports',
    'manage:announcements',
    'chat:send',
  ],
  lecturer: ['input:grades', 'take:attendance', 'chat:send'],
  student: ['view:grades', 'view:attendance', 'view:payments', 'chat:send'],
  finance: ['manage:payments', 'generate:invoices', 'manage:scholarships', 'view:reports', 'chat:send'],
}

function can(roles: RoleName[], permission: Permission): boolean {
  if (roles.includes('super_admin')) return true
  return roles.some((role) => rolePermissionMap[role].includes(permission))
}

export async function getUserRoles(ctx: Ctx, userId: Id<'users'>): Promise<RoleName[]> {
  const userRoleRows = await ctx.db
    .query('user_roles')
    .withIndex('by_user', (query) => query.eq('userId', userId))
    .collect()

  const roles = await Promise.all(userRoleRows.map((row) => ctx.db.get(row.roleId)))
  return roles.filter((role): role is NonNullable<typeof role> => role !== null).map((role) => role.name)
}

export async function requirePermission(
  ctx: Ctx,
  userId: Id<'users'>,
  permission: Permission,
) {
  const roles = await getUserRoles(ctx, userId)
  if (!can(roles, permission)) {
    throw new Error(`FORBIDDEN: Missing permission ${permission}`)
  }
  return roles
}
