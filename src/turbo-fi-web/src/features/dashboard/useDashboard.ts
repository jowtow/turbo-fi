import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { monthParams } from '../../lib/format'

export function useDashboard(month: string, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', month],
    queryFn: () => api.get(`/dashboard?${monthParams(month)}`),
    enabled,
  })
}
