import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Cat, FileUp, Inbox, Plus, WalletCards } from 'lucide-react'

type CategoryTotal = { categoryId: string; name: string; planned: number; actual: number }
type Dashboard = { month: string; reviewCount: number; categories: CategoryTotal[] }
type Account = { id: string; name: string; institution?: string }
type Category = { id: string; name: string; color?: string }
type ReviewTransaction = { id: string; transactionDate: string; description: string; amount: number; suggestedCategoryId?: string }

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${path}`, { credentials: 'include', ...init })
  if (!response.ok) throw new Error(await response.text() || 'Something went wrong.')
  return response.status === 204 ? undefined as T : response.json()
}

function App() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [error, setError] = useState('')
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<{ email: string; householdName: string }>('/auth/me'), retry: false })
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard'), enabled: !!me.data })
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: () => api<Account[]>('/accounts'), enabled: !!me.data })
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories'), enabled: !!me.data })
  const review = useQuery({ queryKey: ['review'], queryFn: () => api<ReviewTransaction[]>('/transactions/review'), enabled: !!me.data })

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
  if (!me.data) return <main className="mx-auto mt-20 max-w-md rounded-2xl bg-white p-8 shadow">
    <Cat className="mb-3 text-orange-500" size={42} /><h1 className="text-3xl font-bold">Turbo Fi</h1>
    <p className="mb-6 text-slate-600">Thoughtful household finance, with a little Turbo energy.</p>
    <form className="space-y-3" onSubmit={submitAuth}>
      {mode === 'register' && <input required name="householdName" placeholder="Household name" />}
      <input required name="email" type="email" placeholder="Email" />
      <input required name="password" minLength={10} type="password" placeholder="Password (10+ characters)" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="w-full" type="submit">{mode === 'register' ? 'Create household' : 'Sign in'}</button>
    </form>
    <button className="mt-4 w-full bg-transparent text-orange-600" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>
      {mode === 'register' ? 'Already have an invitation? Sign in' : 'Need to create the first household?'}
    </button>
  </main>

  return <main className="mx-auto max-w-6xl p-6">
    <header className="mb-8 flex items-center justify-between"><div><h1 className="flex items-center gap-2 text-3xl font-bold"><Cat className="text-orange-500" /> Turbo Fi</h1><p className="text-slate-600">{me.data.householdName} · {me.data.email}</p></div>
      <button onClick={async () => { await api('/auth/logout', { method: 'POST' }); refresh() }}>Sign out</button></header>
    <section className="mb-8 grid gap-4 md:grid-cols-3">
      <Metric icon={<BarChart3 />} label="Planned this month" value={money(dashboard.data?.categories.reduce((sum, item) => sum + item.planned, 0) ?? 0)} />
      <Metric icon={<WalletCards />} label="Actual this month" value={money(dashboard.data?.categories.reduce((sum, item) => sum + item.actual, 0) ?? 0)} />
      <Metric icon={<Inbox />} label="Waiting for review" value={String(dashboard.data?.reviewCount ?? 0)} />
    </section>
    <section className="grid gap-6 lg:grid-cols-3">
      <div className="card lg:col-span-2"><h2>Plan versus actual · {dashboard.data?.month}</h2>
        <table><thead><tr><th>Category</th><th>Planned</th><th>Actual</th><th>Variance</th></tr></thead>
          <tbody>{dashboard.data?.categories.map(item => <tr key={item.categoryId}><td>{item.name}</td><td>{money(item.planned)}</td><td>{money(item.actual)}</td><td>{money(item.actual - item.planned)}</td></tr>)}</tbody></table>
      </div>
      <ImportCard accounts={accounts.data ?? []} onImported={refresh} />
    </section>
    <section className="mt-6 grid gap-6 lg:grid-cols-2">
      <Manager title="Accounts" placeholder="Account name" onSubmit={name => api('/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(refresh)} items={accounts.data?.map(item => item.name) ?? []} />
      <Manager title="Categories" placeholder="Category name" onSubmit={name => api('/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(refresh)} items={categories.data?.map(item => item.name) ?? []} />
    </section>
    <section className="mt-6"><PlanForm accounts={accounts.data ?? []} categories={categories.data ?? []} onCreated={refresh} /></section>
    <section className="card mt-6"><h2>Review inbox</h2>
      {!review.data?.length && <p className="text-slate-600">Everything is categorized. Nice work!</p>}
      {review.data?.map(transaction => <div className="flex flex-wrap items-center justify-between gap-3 border-t py-3" key={transaction.id}>
        <span><strong>{transaction.description}</strong><small className="ml-2 text-slate-500">{transaction.transactionDate}</small></span><span>{money(transaction.amount)}</span>
        <select defaultValue={transaction.suggestedCategoryId ?? ''} onChange={async event => { if (event.target.value) { await api(`/transactions/${transaction.id}/category`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoryId: event.target.value }) }); refresh() } }}>
          <option value="">Categorize as...</option>{categories.data?.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </div>)}
    </section>
  </main>
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="card"><div className="flex gap-2 text-orange-600">{icon}<span>{label}</span></div><strong className="mt-2 block text-3xl">{value}</strong></div> }
function Manager({ title, placeholder, items, onSubmit }: { title: string; placeholder: string; items: string[]; onSubmit: (name: string) => Promise<void> }) { const [name, setName] = useState(''); return <section className="card"><h2>{title}</h2><form className="flex gap-2" onSubmit={async event => { event.preventDefault(); await onSubmit(name); setName('') }}><input required value={name} onChange={event => setName(event.target.value)} placeholder={placeholder} /><button title={`Add ${title}`}><Plus size={18} /></button></form><ul>{items.map(item => <li className="border-t py-2" key={item}>{item}</li>)}</ul></section> }
function PlanForm({ accounts, categories, onCreated }: { accounts: Account[]; categories: Category[]; onCreated: () => void }) { const [message, setMessage] = useState(''); return <section className="card"><h2>Monthly planned entry</h2><form className="grid gap-3 md:grid-cols-5" onSubmit={async event => { event.preventDefault(); const data = new FormData(event.currentTarget); try { await api('/planned-entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: data.get('name'), amount: Number(data.get('amount')), dayOfMonth: Number(data.get('day')), financialAccountId: data.get('accountId'), categoryId: data.get('categoryId') }) }); event.currentTarget.reset(); setMessage('Planned entry added.'); onCreated() } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Unable to add plan.') } }}><input required name="name" placeholder="Name" /><input required name="amount" type="number" step="0.01" placeholder="Amount" /><input required name="day" type="number" min="1" max="31" defaultValue="1" /><select required name="accountId"><option value="">Account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select><select required name="categoryId"><option value="">Category</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select><button className="md:col-span-5">Add recurring monthly plan</button></form>{message && <p className="mt-3 text-sm">{message}</p>}</section> }
function ImportCard({ accounts, onImported }: { accounts: Account[]; onImported: () => void }) { const [file, setFile] = useState<File>(); const [accountId, setAccountId] = useState(''); const [message, setMessage] = useState(''); return <section className="card"><h2 className="flex gap-2"><FileUp /> Import Wells Fargo CSV</h2><p className="mb-3 text-sm text-slate-600">Review every imported transaction before it affects your dashboard.</p><form onSubmit={async event => { event.preventDefault(); if (!file || !accountId) return; const form = new FormData(); form.append('file', file); form.append('accountId', accountId); try { const result = await api<{ imported: number; skippedDuplicates: number }>('/imports/wells-fargo', { method: 'POST', body: form }); setMessage(`${result.imported} imported, ${result.skippedDuplicates} duplicates skipped.`); onImported() } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Import failed.') } }} className="space-y-3"><select required value={accountId} onChange={event => setAccountId(event.target.value)}><option value="">Choose account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select><input required type="file" accept=".csv,text/csv" onChange={event => setFile(event.target.files?.[0])} /><button className="w-full" type="submit">Import for review</button>{message && <p className="text-sm">{message}</p>}</form></section> }
const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
export default App
