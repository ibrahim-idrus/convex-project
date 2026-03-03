import { useEffect, useState } from 'react'
import {
  Bell,
  Calendar,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Shield,
  UserRound,
  X,
} from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import type { RoleName } from '@/types/domain'
import { hasPermission, type Permission } from '@/types/rbac'

const menuItems: Array<{
  path: string
  label: string
  icon: typeof LayoutDashboard
  permissions?: Permission[]
}> = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/profile', label: 'Profile', icon: UserRound },
  { path: '/academic', label: 'Academic', icon: GraduationCap, permissions: ['manage:subjects', 'input:grades', 'view:grades'] },
  { path: '/finance', label: 'Finance', icon: CreditCard, permissions: ['manage:payments', 'view:payments'] },
  { path: '/chat', label: 'Chat', icon: MessageSquare, permissions: ['chat:send'] },
  { path: '/admin', label: 'Administration', icon: Shield, permissions: ['manage:announcements'] },
]

const PROFILE_PHOTO_STORAGE_KEY_PREFIX = 'mcms-profile-photo-v1'
const PROFILE_PHOTO_UPDATED_EVENT = 'profile-photo-updated'

function profilePhotoStorageKey(userId: string) {
  return `${PROFILE_PHOTO_STORAGE_KEY_PREFIX}:${userId}`
}

function roleLabel(role: RoleName) {
  return role
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

export function AppShell() {
  const { user, logout, switchRole } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setProfilePhoto(null)
      return
    }

    const readPhoto = () => {
      setProfilePhoto(localStorage.getItem(profilePhotoStorageKey(user.userId)))
    }

    readPhoto()
    window.addEventListener(PROFILE_PHOTO_UPDATED_EVENT, readPhoto)
    window.addEventListener('storage', readPhoto)

    return () => {
      window.removeEventListener(PROFILE_PHOTO_UPDATED_EVENT, readPhoto)
      window.removeEventListener('storage', readPhoto)
    }
  }, [user?.userId])

  if (!user) return null

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#e6eef9,#f5f8fc_60%)] p-3 lg:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1440px] grid-cols-1 gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="hidden rounded-3xl border border-[#d6dfec] bg-white p-5 shadow-[0_20px_40px_-30px_rgba(9,37,78,0.7)] lg:block">
          <SidebarContent onNavigate={() => undefined} roles={user.roles} />
        </aside>

        <div className="rounded-3xl border border-[#d6dfec] bg-white shadow-[0_20px_40px_-30px_rgba(9,37,78,0.7)]">
          <header className="flex items-center justify-between border-b border-[#e2e9f2] px-4 py-3 lg:px-6 lg:py-4">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setIsOpen(true)}>
                <Menu className="size-5 text-[#153b73]" />
              </Button>
              <Link to="/dashboard" className="text-lg font-extrabold text-[#0f2f5f] lg:text-xl">
                Multi-Campus College Management
              </Link>
            </div>

            <div className="flex items-center gap-2 lg:gap-3">
              <Badge variant="outline" className="hidden lg:inline-flex">
                Active Role: {roleLabel(user.roles[0])}
              </Badge>
              <select
                className="h-9 rounded-lg border border-[#d5deeb] bg-[#eff4fb] px-2 text-xs text-[#12315e] lg:h-10 lg:text-sm"
                value={user.roles[0]}
                onChange={(event) => switchRole(event.target.value as RoleName)}
              >
                {user.roles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
              <Button size="icon" variant="ghost" className="relative">
                <Bell className="size-5 text-[#143b74]" />
                <span className="absolute right-2 top-2 size-2 rounded-full bg-[#ff5959]" />
              </Button>
              <Link to="/profile" aria-label="Open profile page">
                <Avatar className="size-9 border border-[#dce4ef]">
                  {profilePhoto && <AvatarImage src={profilePhoto} alt={`Foto profil ${user.fullName}`} />}
                  <AvatarFallback className="bg-[#ffd7cf] text-xs font-bold text-[#143d74]">
                    {user.fullName
                      .split(' ')
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <Button variant="outline" className="hidden lg:inline-flex" onClick={logout}>
                Logout
              </Button>
            </div>
          </header>

          <main className="p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-[#0d2448]/30 lg:hidden" onClick={() => setIsOpen(false)}>
          <aside className="h-full w-72 bg-white p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-extrabold text-[#0f2f5f]">Navigation</span>
              <Button size="icon" variant="ghost" onClick={() => setIsOpen(false)}>
                <X className="size-5" />
              </Button>
            </div>
            <SidebarContent onNavigate={() => setIsOpen(false)} roles={user.roles} />
            <Button variant="outline" className="mt-4 w-full" onClick={logout}>
              Logout
            </Button>
          </aside>
        </div>
      )}
    </div>
  )
}

function SidebarContent({
  onNavigate,
  roles,
}: {
  onNavigate: () => void
  roles: RoleName[]
}) {
  const visibleMenu = menuItems.filter((item) => {
    if (!item.permissions || item.permissions.length === 0) return true
    return item.permissions.some((permission) => hasPermission(roles, permission))
  })

  return (
    <>
      <div className="mb-8 flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-[#173d74] text-white">
          <GraduationCap className="size-6" />
        </div>
        <div>
          <p className="text-lg font-extrabold text-[#0f2f5f]">EduCentral</p>
          <p className="text-xs text-[#6c809d]">Academic Platform</p>
        </div>
      </div>

      <nav className="space-y-2">
        {visibleMenu.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                isActive ? 'bg-[#133a73] text-white' : 'text-[#516887] hover:bg-[#eff4fb]',
              )
            }
          >
            <item.icon className="size-4.5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-8 rounded-xl border border-[#dce5f1] bg-[#f5f8fd] p-3">
        <p className="text-xs font-semibold tracking-wide text-[#5f7391]">Current Term</p>
        <p className="mt-1 text-sm font-bold text-[#102f5f]">Fall 2026/2027</p>
        <p className="text-xs text-[#6d819f]">Week 9 of 16</p>
      </div>

      <div className="mt-3 rounded-xl border border-[#dce5f1] bg-[#f5f8fd] p-3 text-xs text-[#5f7391]">
        <div className="mb-1 flex items-center gap-2 font-semibold">
          <Calendar className="size-4" /> Timeline
        </div>
        <p>Target delivery: 1 month</p>
      </div>
    </>
  )
}
