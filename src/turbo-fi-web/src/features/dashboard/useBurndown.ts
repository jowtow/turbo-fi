import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { monthParams } from '../../lib/format'

export function useBurndown(month: string, expenseTypeId?: string, categoryId?: string) {
  let params = monthParams(month)
  if (expenseTypeId) params += `&expenseTypeId=${expenseTypeId}`
  if (categoryId) params += `&categoryId=${categoryId}`
  return useQuery({
    queryKey: ['burndown', month, expenseTypeId, categoryId],
    queryFn: () => api.get(`/dashboard/burndown?${params}`),
  })
}
