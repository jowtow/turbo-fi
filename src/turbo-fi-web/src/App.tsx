import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, BarChart3, CalendarPlus, Cat, ChevronLeft, ChevronRight, CircleCheck, FileUp, Inbox, Plus, Trash2, WalletCards } from 'lucide-react'

type CategoryTotal = { categoryId: string; name: string; planned: number; actual: number; dayOfMonth: number; isFixed: boolean }
type BurnDownPoint = { day: number; planned: number; actual: number }
type Dashboard = { month: string; reviewCount: number; categories: CategoryTotal[]; burndown: BurnDownPoint[] }
type Account = { id: string; name: string; institution?: string; isActive: boolean }
type Category = { id: string; name: string; color?: string }
type PlannedEntry = { id: string; amount: number; dayOfMonth: number; categoryId: string; isFixed: boolean }
type ReviewTransaction = { id: string; financialAccountId: string; transactionDate: string; description: string; amount: number; suggestedCategoryId?: string }
type TransferTransaction = { id: string; transactionDate: string; description: string; amount: number; destination?: string }
type ImportConflict = { index: number; description: string; transactionDate: string; amount: number; reason: string }
type ImportResult = { imported?: number; conflicts?: ImportConflict[] }

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${path}`, { credentials: 'include', ...init })
  if (!response.ok) throw new Error(await response.text() || 'Something went wrong.')
  return response.status === 204 ? undefined as T : response.json()
}
const importWellsFargo = async (form: FormData): Promise<ImportResult> => {
  const response = await fetch('/api/imports/wells-fargo', { method: 'POST', credentials: 'include', body: form })
  const body = await response.text()
  if (!response.ok && response.status !== 409) throw new Error(body || 'Import failed.')
  try {
    return JSON.parse(body) as ImportResult
  } catch {
    throw new Error('The import response could not be read.')
  }
}

function App() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [error, setError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<{ email: string; householdName: string }>('/auth/me'), retry: false })
  const dashboard = useQuery({ queryKey: ['dashboard', selectedMonth], queryFn: () => api<Dashboard>(`/dashboard?year=${selectedMonth.slice(0, 4)}&month=${Number(selectedMonth.slice(5, 7))}`), enabled: !!me.data })
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: () => api<Account[]>('/accounts'), enabled: !!me.data })
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories'), enabled: !!me.data })
  const plannedEntries = useQuery({ queryKey: ['planned-entries'], queryFn: () => api<PlannedEntry[]>('/planned-entries'), enabled: !!me.data })
  const review = useQuery({ queryKey: ['review'], queryFn: () => api<ReviewTransaction[]>('/transactions/review'), enabled: !!me.data })
  const transfers = useQuery({ queryKey: ['transfers'], queryFn: () => api<TransferTransaction[]>('/transactions/transfers'), enabled: !!me.data })

  const refresh = () => queryClient.invalidateQueries()
  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const data = new FormData(event.currentTarget)
    try {
      await api(mode === 'register' ? '/auth/register' : '/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register'
          ? { email: data.get('email'), password: data.get('password'), householdName: data.get('householdName') }
          : { email: data.get('email'), password: data.get('password') }),
      })
      refresh()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in.') }
  }
  if (me.isLoading) return <main className="p-8">Loading Turbo Fi...</main>
  if (!me.data) return <main className="mx-auto mt-20 max-w-md rounded-2xl border border-emerald-800 bg-emerald-950/60 p-8 shadow-lg shadow-lime-950/20">
    <Cat className="mb-3 text-lime-400" size={42} /><h1 className="text-3xl font-bold">Turbo Fi</h1>
    <p className="mb-6 text-emerald-200">Thoughtful household finance, with a little Turbo energy.</p>
    <form className="space-y-3" onSubmit={submitAuth}>
      {mode === 'register' && <input required name="householdName" placeholder="Household name" />}
      <input required name="email" type="email" placeholder="Email" />
      <input required name="password" minLength={10} type="password" placeholder="Password (10+ characters)" />
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button className="w-full" type="submit">{mode === 'register' ? 'Create household' : 'Sign in'}</button>
    </form>
    <button className="mt-4 w-full bg-transparent text-lime-300 hover:bg-emerald-900/60" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>
      {mode === 'register' ? 'Already have an invitation? Sign in' : 'Need to create the first household?'}
    </button>
  </main>

  return <main className="mx-auto max-w-6xl p-6">
    <header className="mb-8 flex items-center justify-between"><div><h1 className="flex items-center gap-2 text-3xl font-bold"><Cat className="text-lime-400" /> Turbo Fi</h1><p className="text-emerald-200">{me.data.householdName} · {me.data.email}</p></div>
      <button onClick={async () => { await api('/auth/logout', { method: 'POST' }); refresh() }}>Sign out</button></header>
    <section className="mb-8 grid gap-4 md:grid-cols-3">
      <Metric icon={<BarChart3 />} label="Planned this month" value={money(dashboard.data?.categories.reduce((sum, item) => sum + item.planned, 0) ?? 0)} />
      <Metric icon={<WalletCards />} label="Actual this month" value={money(dashboard.data?.categories.reduce((sum, item) => sum + item.actual, 0) ?? 0)} />
      <Metric icon={<Inbox />} label="Waiting for review" value={String(dashboard.data?.reviewCount ?? 0)} />
    </section>
    <section className="grid gap-6 lg:grid-cols-3">
      <div className="card lg:col-span-2">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="mb-1">Plan versus actual</h2><p className="text-sm text-emerald-200">Red means your attention is needed. Green means on track.</p></div>
          <MonthPicker month={selectedMonth} onChange={setSelectedMonth} />
        </div>
        <div className="overflow-x-auto"><table><thead><tr><th>Category</th><th>Plan</th><th>Actual</th><th>Signal</th></tr></thead>
          <tbody>{dashboard.data?.categories.map(item => <PlanRow key={item.categoryId} item={item} month={selectedMonth} />)}</tbody></table></div>
        {!dashboard.data?.categories.length && <p className="py-4 text-sm text-emerald-200">Add a monthly plan to start tracking your spending pace.</p>}
      </div>
      <ImportCard accounts={accounts.data ?? []} onImported={refresh} />
    </section>
    {dashboard.data && <BurnDownChart dashboard={dashboard.data} />}
    <section className="mt-6 grid gap-6 lg:grid-cols-2">
      <Manager title="Accounts" placeholder="Account name" onSubmit={name => api('/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(refresh)} items={accounts.data?.map(item => item.name) ?? []} />
      <Manager title="Categories" placeholder="Category name" onSubmit={name => api('/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(refresh)} items={categories.data?.map(item => item.name) ?? []} />
    </section>
    <section className="mt-6"><PlanForm categories={categories.data ?? []} entries={plannedEntries.data ?? []} onChanged={refresh} /></section>
    <ReviewInbox accounts={accounts.data ?? []} categories={categories.data ?? []} transactions={review.data ?? []} onChanged={refresh} />
    <Transfers transactions={transfers.data ?? []} onChanged={refresh} />
  </main>
}

function MonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const shiftMonth = (amount: number) => {
    const date = new Date(`${month}-01T12:00:00`)
    date.setMonth(date.getMonth() + amount)
    onChange(date.toISOString().slice(0, 7))
  }
  const currentMonth = new Date().toISOString().slice(0, 7)
  return <div className="flex items-center gap-1">
    <button className="bg-emerald-900 px-2 text-lime-200 hover:bg-emerald-800" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft size={18} /></button>
    <label className="sr-only" htmlFor="dashboard-month">Month</label><input className="w-36 py-1.5" id="dashboard-month" type="month" max={currentMonth} value={month} onChange={event => onChange(event.target.value)} />
    <button disabled={month >= currentMonth} className="bg-emerald-900 px-2 text-lime-200 hover:bg-emerald-800" aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRight size={18} /></button>
  </div>
}

function PlanRow({ item, month }: { item: CategoryTotal; month: string }) {
  const today = new Date()
  const displayedMonth = new Date(`${month}-01T12:00:00`)
  const isCurrentMonth = today.getFullYear() === displayedMonth.getFullYear() && today.getMonth() === displayedMonth.getMonth()
  const isPastMonth = displayedMonth < new Date(today.getFullYear(), today.getMonth(), 1)
  const hasOverrun = item.planned > 0 && item.actual > item.planned * 1.1
  const paymentShouldHavePosted = isPastMonth || (isCurrentMonth && today.getDate() >= item.dayOfMonth)
  const isMissingFixed = item.isFixed && paymentShouldHavePosted && item.actual < item.planned * 0.95
  const variance = item.actual - item.planned
  const signal = hasOverrun
    ? { label: `${money(variance)} over plan`, classes: 'bg-red-950 text-red-200', icon: <AlertTriangle size={15} /> }
    : isMissingFixed
      ? { label: 'Not fully accounted', classes: 'bg-amber-950 text-amber-200', icon: <AlertTriangle size={15} /> }
      : { label: item.isFixed ? 'Fixed payment on track' : 'Within target', classes: 'bg-lime-950 text-lime-300', icon: <CircleCheck size={15} /> }
  return <tr className={hasOverrun ? 'bg-red-950/40' : isMissingFixed ? 'bg-amber-950/40' : ''}>
    <td><div className="font-medium">{item.name}</div><span className={`text-xs ${item.isFixed ? 'text-lime-300' : 'text-emerald-300'}`}>{item.isFixed ? 'Fixed known' : 'Estimated target'}</span></td>
    <td>{money(item.planned)}</td><td className={hasOverrun ? 'font-semibold text-red-300' : ''}>{money(item.actual)}</td>
    <td><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${signal.classes}`}>{signal.icon}{signal.label}</span></td>
  </tr>
}

function BurnDownChart({ dashboard }: { dashboard: Dashboard }) {
  const totalPlan = dashboard.categories.reduce((sum, item) => sum + item.planned, 0)
  const points = dashboard.burndown ?? []
  if (!points.length || totalPlan === 0) return null
  const maxDay = points.length
  const width = 600
  const height = 170
  const padding = 16
  const point = (day: number, amount: number) => `${padding + ((day - 1) / Math.max(maxDay - 1, 1)) * (width - padding * 2)},${padding + (1 - Math.max(0, amount) / totalPlan) * (height - padding * 2)}`
  const plannedPath = points.map(item => point(item.day, totalPlan - item.planned)).join(' ')
  const actualPath = points.map(item => point(item.day, totalPlan - item.actual)).join(' ')
  return <section className="card mt-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="mb-1 flex items-center gap-2"><BarChart3 className="text-lime-400" size={20} /> Budget burn-down</h2><p className="text-sm text-emerald-200">Remaining budget through the month: actual versus planned pace.</p></div><div className="flex gap-3 text-xs font-medium"><span className="text-emerald-300">— Planned</span><span className="text-lime-300">— Actual</span></div></div>
    <svg className="h-44 w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Remaining budget actual and planned pace chart">
      <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#065f46" /><line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#065f46" />
      <polyline points={plannedPath} fill="none" stroke="#6ee7b7" strokeWidth="3" strokeDasharray="6 5" />
      <polyline points={actualPath} fill="none" stroke="#a3e635" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <text x={padding} y={height - 2} fill="#6ee7b7" fontSize="11">Day 1</text><text x={width - padding - 38} y={height - 2} fill="#6ee7b7" fontSize="11">Day {maxDay}</text>
    </svg>
  </section>
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="card"><div className="flex gap-2 text-lime-300">{icon}<span>{label}</span></div><strong className="mt-2 block text-3xl">{value}</strong></div> }
function ReviewInbox({ accounts, categories, transactions, onChanged }: { accounts: Account[]; categories: Category[]; transactions: ReviewTransaction[]; onChanged: () => Promise<void> }) {
  const [transferId, setTransferId] = useState<string>()

  return <section className="card mt-6"><h2>Review inbox</h2>
    {!transactions.length && <p className="text-emerald-200">Everything is categorized or marked as a transfer. Nice work!</p>}
    {transactions.map(transaction => <div className="border-t py-3" key={transaction.id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span><strong>{transaction.description}</strong><small className="ml-2 text-emerald-300">{transaction.transactionDate}</small></span><span>{money(transaction.amount)}</span>
        <div className="flex flex-wrap gap-2">
          <select defaultValue={transaction.suggestedCategoryId ?? ''} onChange={async event => {
            if (event.target.value) {
              await api(`/transactions/${transaction.id}/category`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoryId: event.target.value }) })
              await onChanged()
            }
          }}>
            <option value="">Categorize as...</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <button className="bg-emerald-900 text-lime-200 hover:bg-emerald-800" type="button" aria-expanded={transferId === transaction.id} onClick={() => setTransferId(current => current === transaction.id ? undefined : transaction.id)}>
            Mark as transfer
          </button>
        </div>
      </div>
      {transferId === transaction.id && <TransferDestinationForm accounts={accounts} transaction={transaction} onSaved={async () => { setTransferId(undefined); await onChanged() }} />}
    </div>)}
  </section>
}
function TransferDestinationForm({ accounts, transaction, onSaved }: { accounts: Account[]; transaction: ReviewTransaction; onSaved: () => Promise<void> }) {
  const destinationAccounts = accounts.filter(account => account.id !== transaction.financialAccountId && account.isActive)
  const [destination, setDestination] = useState(destinationAccounts[0]?.id ?? 'other')
  const [destinationName, setDestinationName] = useState('')
  const [message, setMessage] = useState('')
  const isOther = destination === 'other'

  async function saveTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    try {
      await api(`/transactions/${transaction.id}/transfer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationAccountId: isOther ? null : destination,
          destinationName: isOther ? destinationName : null,
        }),
      })
      await onSaved()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to mark this transfer.')
    }
  }

  return <form className="mt-3 grid gap-2 rounded-md bg-emerald-900/50 p-3 md:grid-cols-3" onSubmit={saveTransfer}>
    <label className="sr-only" htmlFor={`transfer-destination-${transaction.id}`}>Transfer destination</label>
    <select id={`transfer-destination-${transaction.id}`} value={destination} onChange={event => setDestination(event.target.value)}>
      {destinationAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
      <option value="other">Other destination...</option>
    </select>
    {isOther && <input required value={destinationName} onChange={event => setDestinationName(event.target.value)} maxLength={200} placeholder="Where did the transfer go?" aria-label="Other transfer destination" />}
    <button type="submit">Save transfer</button>
    {message && <p className="text-sm text-red-300 md:col-span-3" role="alert">{message}</p>}
  </form>
}
function Transfers({ transactions, onChanged }: { transactions: TransferTransaction[]; onChanged: () => Promise<void> }) {
  const [message, setMessage] = useState('')

  async function unmarkTransfer(transaction: TransferTransaction) {
    setMessage('')
    try {
      await api(`/transactions/${transaction.id}/transfer`, { method: 'DELETE' })
      await onChanged()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to unmark this transfer.')
    }
  }

  if (!transactions.length) return null
  return <section className="card mt-6"><h2>Transfers</h2>
    <p className="mb-2 text-sm text-emerald-200">Transfers are excluded from spending and budget totals.</p>
    {transactions.map(transaction => <div className="flex flex-wrap items-center justify-between gap-3 border-t py-3" key={transaction.id}>
      <span><strong>{transaction.description}</strong><small className="ml-2 text-emerald-300">{transaction.transactionDate} · To {transaction.destination ?? 'Unknown destination'}</small></span>
      <span>{money(transaction.amount)}</span>
      <button className="bg-emerald-900 text-lime-200 hover:bg-emerald-800" type="button" onClick={() => unmarkTransfer(transaction)}>Not a transfer</button>
    </div>)}
    {message && <p className="mt-2 text-sm text-red-300" role="alert">{message}</p>}
  </section>
}
function Manager({ title, placeholder, items, onSubmit }: { title: string; placeholder: string; items: string[]; onSubmit: (name: string) => Promise<void> }) { const [name, setName] = useState(''); return <section className="card"><h2>{title}</h2><form className="flex gap-2" onSubmit={async event => { event.preventDefault(); await onSubmit(name); setName('') }}><input required value={name} onChange={event => setName(event.target.value)} placeholder={placeholder} /><button title={`Add ${title}`}><Plus size={18} /></button></form><ul>{items.map(item => <li className="border-t py-2" key={item}>{item}</li>)}</ul></section> }
function PlanForm({ categories, entries, onChanged }: { categories: Category[]; entries: PlannedEntry[]; onChanged: () => Promise<void> }) {
  const [message, setMessage] = useState('')
  const plannedCategoryIds = new Set(entries.map(entry => entry.categoryId))
  const availableCategories = categories.filter(category => !plannedCategoryIds.has(category.id))
  const isReady = availableCategories.length > 0
  const categoryNames = new Map(categories.map(category => [category.id, category.name]))

  async function addPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setMessage('')
    try {
      await api('/planned-entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        amount: Number(data.get('amount')), dayOfMonth: Number(data.get('day')), categoryId: data.get('categoryId'), isFixed: data.get('isFixed') === 'on',
        }),
      })
      form.reset()
      await onChanged()
      setMessage('Plan added across all accounts.')
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to add plan.')
    }
  }

  async function removePlan(entry: PlannedEntry) {
    setMessage('')
    try {
      await api(`/planned-entries/${entry.id}`, { method: 'DELETE' })
      await onChanged()
      setMessage(`${categoryNames.get(entry.categoryId) ?? 'Plan'} removed.`)
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to remove plan.')
    }
  }

  return <section className="card">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="mb-1 flex items-center gap-2"><CalendarPlus className="text-lime-400" size={20} /> Monthly plan</h2><p className="text-sm text-emerald-200">Mark known bills as fixed; use targets for flexible spending.</p></div>
      <strong className="rounded-full bg-lime-950 px-3 py-1 text-sm text-lime-300">{entries.length} {entries.length === 1 ? 'item' : 'items'}</strong>
    </div>
    {!isReady && <p className="mb-4 rounded-md bg-amber-950 p-3 text-sm text-amber-200">{categories.length ? 'Every category already has a monthly plan.' : 'Add a category above before creating a monthly plan.'}</p>}
    <form className="grid gap-3 md:grid-cols-3" onSubmit={addPlan}>
      <input disabled={!isReady} required name="amount" type="number" step="0.01" placeholder="Amount" />
      <input disabled={!isReady} required name="day" type="number" min="1" max="31" defaultValue="1" aria-label="Day of month" />
      <select disabled={!isReady} required name="categoryId" defaultValue=""><option value="">Category</option>{availableCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
      <label className="flex items-center gap-2 text-sm font-medium text-lime-100 md:col-span-3"><input disabled={!isReady} className="h-4 w-4" name="isFixed" type="checkbox" /> Fixed known payment <span className="font-normal text-emerald-300">(mortgage, insurance, subscriptions)</span></label>
      <button disabled={!isReady} className="md:col-span-3" type="submit">Add monthly plan</button>
    </form>
    {message && <p className="mt-3 text-sm" role="status">{message}</p>}
    <div className="mt-6 overflow-x-auto">
      {!entries.length ? <p className="text-sm text-emerald-200">No monthly plans yet. Add your first expected category amount above.</p> :
        <table><thead><tr><th>Category</th><th>Amount</th><th>Type</th><th>Due day</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{entries.map(entry => { const categoryName = categoryNames.get(entry.categoryId) ?? 'Unknown category'; return <tr key={entry.id}><td className="font-medium">{categoryName}</td><td>{money(entry.amount)}</td><td><span className={`rounded-full px-2 py-1 text-xs font-medium ${entry.isFixed ? 'bg-lime-950 text-lime-300' : 'bg-emerald-900 text-emerald-200'}`}>{entry.isFixed ? 'Fixed known' : 'Target'}</span></td><td>{entry.dayOfMonth}</td><td className="text-right"><button className="bg-transparent px-2 text-red-300 hover:bg-red-950/60" title={`Remove ${categoryName}`} aria-label={`Remove ${categoryName}`} onClick={() => removePlan(entry)}><Trash2 size={18} /></button></td></tr> })}</tbody>
        </table>}
    </div>
  </section>
}
function ImportCard({ accounts, onImported }: { accounts: Account[]; onImported: () => void }) {
  const [file, setFile] = useState<File>()
  const [accountId, setAccountId] = useState('')
  const [message, setMessage] = useState('')
  const [conflicts, setConflicts] = useState<ImportConflict[]>([])
  const [descriptions, setDescriptions] = useState<Record<number, string>>({})
  const canContinue = conflicts.every(conflict => {
    const description = descriptions[conflict.index]?.trim()
    return description && description !== conflict.description
  })

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || !accountId) return
    setMessage('')
    const form = new FormData()
    form.append('file', file)
    form.append('accountId', accountId)
    if (Object.keys(descriptions).length) form.append('descriptionOverrides', JSON.stringify(descriptions))
    try {
      const result = await importWellsFargo(form)
      if (result.conflicts?.length) {
        setConflicts(result.conflicts)
        setDescriptions(current => Object.fromEntries(result.conflicts!.map(conflict => [
          conflict.index, current[conflict.index] ?? conflict.description,
        ])))
        setMessage('Update each matching description to explain how it differs, then continue the import.')
        return
      }
      setConflicts([])
      setDescriptions({})
      setMessage(`${result.imported ?? 0} transactions imported for review.`)
      await onImported()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Import failed.')
    }
  }

  return <section className="card">
    <h2 className="flex gap-2"><FileUp /> Import Wells Fargo CSV</h2>
    <p className="mb-3 text-sm text-emerald-200">Conflicting transactions are held for description review before anything is imported.</p>
    <form onSubmit={submitImport} className="space-y-3">
      <select required value={accountId} disabled={conflicts.length > 0} onChange={event => setAccountId(event.target.value)}>
        <option value="">Choose account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
      </select>
      <input required type="file" accept=".csv,text/csv" disabled={conflicts.length > 0} onChange={event => {
        setFile(event.target.files?.[0]); setConflicts([]); setDescriptions({}); setMessage('')
      }} />
      {!!conflicts.length && <div className="space-y-3 rounded-md bg-amber-950 p-3">
        <p className="text-sm font-medium text-amber-200">Matching transactions need a distinct description.</p>
        {conflicts.map(conflict => <div className="space-y-1 border-t border-amber-800 pt-3 first:border-t-0 first:pt-0" key={conflict.index}>
          <p className="text-sm text-emerald-100">{conflict.transactionDate} · {money(conflict.amount)} · {conflict.reason}</p>
          <label className="text-sm font-medium text-lime-100" htmlFor={`description-${conflict.index}`}>Description</label>
          <input id={`description-${conflict.index}`} required value={descriptions[conflict.index] ?? conflict.description} onChange={event => setDescriptions(current => ({ ...current, [conflict.index]: event.target.value }))} />
        </div>)}
      </div>}
      {!!conflicts.length && <button className="w-full bg-emerald-900 text-lime-200 hover:bg-emerald-800" type="button" onClick={() => { setConflicts([]); setDescriptions({}); setMessage('Conflict review cancelled. Choose a file to start again.') }}>Cancel conflict review</button>}
      <button className="w-full" disabled={conflicts.length > 0 && !canContinue} type="submit">{conflicts.length ? 'Continue import' : 'Import for review'}</button>
      {message && <p className="text-sm" role="status">{message}</p>}
    </form>
  </section>
}
const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
export default App
