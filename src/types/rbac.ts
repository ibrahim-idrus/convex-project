import type { RoleName } from '@/types/domain'

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

export const rolePermissionMap: Record<RoleName, Permission[]> = {
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

export function hasPermission(roles: RoleName[], permission: Permission): boolean {
  if (roles.includes('super_admin')) return true
  return roles.some((role) => rolePermissionMap[role].includes(permission))
}
