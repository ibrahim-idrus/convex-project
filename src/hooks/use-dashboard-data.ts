import { useQuery } from '@tanstack/react-query'
import { getDashboardData } from '@/lib/mock-api'

export function useDashboardData(actorUserId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', actorUserId],
    queryFn: () => getDashboardData({ actorUserId: actorUserId ?? '' }),
    enabled: !!actorUserId,
  })
}
