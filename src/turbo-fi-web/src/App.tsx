import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AuthScreen } from './features/auth/AuthScreen'
import { CategorizeWorkspace } from './features/categorization/CategorizeWorkspace'
import { DashboardWorkspace } from './features/dashboard/DashboardWorkspace'
import { useDashboard } from './features/dashboard/useDashboard'
import { Sidebar } from './features/layout/Sidebar'
import { PlanWorkspace } from './features/planning/PlanWorkspace'
import { api } from './lib/api'
import type { Workspace } from './types/finance'

function App() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [error, setError] = useState('')
  const [workspace, setWorkspace] = useState<Workspace>('dashboard')
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.get('/auth/me'), retry: false })
  const dashboard = useDashboard(selectedMonth, !!me.data)
  const refresh = () => queryClient.invalidateQueries()

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const data = new FormData(event.currentTarget)
    try {
      if (mode === 'register') {
        await api.post('/auth/register', { email: String(data.get('email')), password: String(data.get('password')), householdName: String(data.get('householdName')) })
      } else {
        await api.post('/auth/login', { email: String(data.get('email')), password: String(data.get('password')) })
      }
      refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in.')
    }
  }

  if (me.isLoading) return <main className="p-8">Loading Turbo Fi...</main>
  if (!me.data) return <AuthScreen mode={mode} error={error} onModeChange={setMode} onSubmit={submitAuth} />

  return <main className="app-shell">
    <Sidebar workspace={workspace} householdName={me.data.householdName} reviewCount={dashboard.data?.reviewCount ?? 0} onSelect={setWorkspace} onSignOut={async () => { await api.post('/auth/logout'); await refresh() }} />
    <div className="app-content">
      {workspace === 'dashboard' && <DashboardWorkspace month={selectedMonth} onMonthChange={setSelectedMonth} onCategorize={() => setWorkspace('categorize')} />}
      {workspace === 'categorize' && <CategorizeWorkspace />}
      {workspace === 'plan' && <PlanWorkspace month={selectedMonth} onMonthChange={setSelectedMonth} />}
    </div>
  </main>
}

export default App
