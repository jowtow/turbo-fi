import { AlertTriangle, ArrowRight, BarChart3, CircleCheck, Inbox, WalletCards } from 'lucide-react'
import { Metric } from '../../components/Metric'
import { MonthPicker } from '../../components/MonthPicker'
import { PageHeading } from '../../components/PageHeading'
import { money, monthLabel } from '../../lib/format'
import type { CategoryTotal, ExpenseTypeTotal } from '../../types/finance'
import { useDashboard } from './useDashboard'

type DashboardWorkspaceProps = {
  month: string
  onMonthChange: (month: string) => void
  onCategorize: () => void
}

export function DashboardWorkspace({ month, onMonthChange, onCategorize }: DashboardWorkspaceProps) {
  const dashboard = useDashboard(month, true)
  const expenseTypes = dashboard.data?.expenseTypes ?? []
  const planned = expenseTypes.reduce((sum, item) => sum + item.planned, 0)
  const actual = expenseTypes.reduce((sum, item) => sum + item.actual, 0)

  return <div className="workspace">
    <PageHeading eyebrow="Operating view" title={monthLabel(month)} actions={<MonthPicker month={month} onChange={onMonthChange} />} />
    <section className="mb-7 grid gap-4 md:grid-cols-3">
      <Metric icon={<BarChart3 />} label="Planned" value={money(planned)} />
      <Metric icon={<WalletCards />} label="Actual spending" value={money(actual)} />
      <Metric icon={<Inbox />} label="To categorize" value={String(dashboard.data?.reviewCount ?? 0)} action={dashboard.data?.reviewCount ? <button className="mt-3 bg-emerald-900 text-lime-200 hover:bg-emerald-800" onClick={onCategorize}>Review transactions <ArrowRight size={16} className="ml-1 inline" /></button> : undefined} />
    </section>
    <section className="card">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="mb-1 text-xl">Planned versus actual</h2><p className="text-sm text-emerald-200">Expense types are ordered by actual spending; categories by their larger planned or actual amount.</p></div><span className={`rounded-full px-3 py-1 text-sm font-medium ${actual > planned ? 'bg-red-950 text-red-200' : 'bg-lime-950 text-lime-300'}`}>{money(actual - planned)} {actual > planned ? 'over' : 'remaining'}</span></div>
      <div className="overflow-x-auto"><table><thead><tr><th>Category</th><th>Plan</th><th>Actual</th><th>Variance</th><th>Status</th></tr></thead><tbody>
        {expenseTypes.map(expenseType => <ExpenseTypeGroup key={expenseType.expenseTypeId} expenseType={expenseType} />)}
      </tbody></table></div>
      {!expenseTypes.length && <p className="py-5 text-sm text-emerald-200">Create a monthly plan to start tracking this month.</p>}
    </section>
  </div>
}

function ExpenseTypeGroup({ expenseType }: { expenseType: ExpenseTypeTotal }) {
  return <><tr><th className="bg-emerald-950/70 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-lime-300" colSpan={5} scope="rowgroup">{expenseType.name}<span className="ml-3 normal-case tracking-normal text-emerald-300">{expenseType.categories.length} categories · {money(expenseType.actual)} actual</span></th></tr>{expenseType.categories.map(item => <DashboardRow key={item.categoryId} item={item} />)}</>
}

function DashboardRow({ item }: { item: CategoryTotal }) {
  const overPlan = item.planned > 0 && item.actual > item.planned
  const status = overPlan ? { label: 'Over plan', classes: 'bg-red-950 text-red-200', icon: <AlertTriangle size={14} /> } : { label: 'On track', classes: 'bg-lime-950 text-lime-300', icon: <CircleCheck size={14} /> }

  return <tr className={overPlan ? 'bg-red-950/25' : ''}><td><strong>{item.name}</strong><span className="ml-2 text-xs text-emerald-300">{item.isFixed ? 'Fixed' : 'Target'}</span></td><td>{money(item.planned)}</td><td className={overPlan ? 'font-semibold text-red-300' : ''}>{money(item.actual)}</td><td className={item.actual - item.planned > 0 ? 'text-red-300' : 'text-lime-300'}>{money(item.actual - item.planned)}</td><td><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${status.classes}`}>{status.icon}{status.label}</span></td></tr>
}

