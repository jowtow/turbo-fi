import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeading } from '../../components/PageHeading'
import { api } from '../../lib/api'
import { useFinanceReferenceData } from '../finance/useFinanceReferenceData'
import { CategorizationCard } from './CategorizationCard'
import { ImportCard } from './ImportCard'

export function CategorizeWorkspace() {
  const queryClient = useQueryClient()
  const { accounts, expenseTypes, categories } = useFinanceReferenceData(true)
  const review = useQuery({ queryKey: ['review'], queryFn: () => api.get('/transactions/review') })
  const refresh = () => queryClient.invalidateQueries()

  return <div className="workspace">
    <PageHeading eyebrow="Transaction inbox" title="Categorize transactions" description="Import a CSV, confirm a category, and move immediately to the next transaction." />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <CategorizationCard accounts={accounts} expenseTypes={expenseTypes} categories={categories} transactions={review.data ?? []} onChanged={refresh} />
      <ImportCard accounts={accounts} onImported={refresh} />
    </div>
  </div>
}
