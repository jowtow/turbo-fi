import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

export function useFinanceReferenceData(enabled: boolean) {
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: () => api.get('/accounts'), enabled })
  const expenseTypes = useQuery({ queryKey: ['expense-types'], queryFn: () => api.get('/expense-types'), enabled })
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/categories'), enabled })

  return {
    accounts: accounts.data ?? [],
    expenseTypes: expenseTypes.data ?? [],
    categories: categories.data ?? [],
  }
}
