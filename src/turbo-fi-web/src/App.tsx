import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthScreen } from './features/auth/AuthScreen'
import { CategorizeWorkspace } from './features/categorization/CategorizeWorkspace'
import { DashboardWorkspace } from './features/dashboard/DashboardWorkspace'
import { useDashboard } from './features/dashboard/useDashboard'
import { Sidebar } from './features/layout/Sidebar'
import { PlanWorkspace } from './features/planning/PlanWorkspace'
import { SettingsWorkspace } from './features/settings/SettingsWorkspace'
import { api } from './lib/api'
import { workspaceAtPath, workspacePaths } from './lib/routes'

function App() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [error, setError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.get('/auth/me'), retry: false })
  const dashboard = useDashboard(selectedMonth, !!me.data)
  const refresh = () => queryClient.invalidateQueries()
  const workspace = workspaceAtPath(location.pathname)

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
      await refresh()
      navigate(destinationFor(location.state), { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in.')
    }
  }

  if (me.isLoading) return <main className="p-8">Loading Turbo Fi...</main>
  if (!me.data) {
    if (location.pathname === '/login') {
      return <AuthScreen mode={mode} error={error} onModeChange={setMode} onSubmit={submitAuth} />
    }

    if (location.pathname === '/') {
      return <Navigate to="/login" replace />
    }

    if (workspace) {
      return <Navigate to="/login" replace state={{ from: location }} />
    }

    return <NotFound />
  }

  if (location.pathname === '/' || location.pathname === '/login') {
    return <Navigate to={workspacePaths.dashboard} replace />
  }

  if (!workspace) return <NotFound />

  return <main className="app-shell">
    <Sidebar workspace={workspace} householdName={me.data.householdName} reviewCount={dashboard.data?.reviewCount ?? 0} onSignOut={async () => { await api.post('/auth/logout'); await refresh() }} />
    <div className="app-content">
      {workspace === 'dashboard' && <DashboardWorkspace month={selectedMonth} onMonthChange={setSelectedMonth} onCategorize={() => navigate(workspacePaths.categorize)} />}
      {workspace === 'categorize' && <CategorizeWorkspace />}
      {workspace === 'plan' && <PlanWorkspace month={selectedMonth} onMonthChange={setSelectedMonth} />}
      {workspace === 'settings' && <SettingsWorkspace />}
    </div>
  </main>
}

function destinationFor(state: unknown): string {
  if (!isLocationState(state)) return workspacePaths.dashboard

  return workspaceAtPath(state.from.pathname) ? state.from.pathname : workspacePaths.dashboard
}

function isLocationState(state: unknown): state is { from: { pathname: string } } {
  if (typeof state !== 'object' || state === null || !('from' in state)) return false

  const { from } = state
  return typeof from === 'object' && from !== null && 'pathname' in from && typeof from.pathname === 'string'
}

function NotFound() {
  return (
    <main className="mx-auto mt-20 max-w-md rounded-2xl border border-emerald-800 bg-emerald-950/60 p-8 shadow-lg shadow-lime-950/20">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-3 text-emerald-200">The page you requested does not exist.</p>
      <Link className="mt-6 inline-block text-lime-300 hover:text-lime-200" to="/">
        Go to Turbo Fi
      </Link>
    </main>
  )
}

export default App
