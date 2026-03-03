import { useAuth } from '@/features/auth/auth-context'

export function useCurrentRole() {
  const { user } = useAuth()
  return user?.roles[0] ?? null
}
