import { lazy, Suspense, useCallback, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import PageHeader from './components/PageHeader'
import Sidebar from './components/Sidebar'
import './App.css'
import useAuth from './contexts/useAuth'

const AuthPage = lazy(() => import('./pages/AuthPage'))
const ComponentsPage = lazy(() => import('./pages/ComponentsPage'))
const ComponentDetailsPage = lazy(() => import('./pages/ComponentDetailsPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ImpactsPage = lazy(() => import('./pages/ImpactsPage'))
const ImpactDetailsPage = lazy(() => import('./pages/ImpactDetailsPage'))
const LocationsPage = lazy(() => import('./pages/LocationsPage'))
const OutagesPage = lazy(() => import('./pages/OutagesPage'))
const RecoveryPage = lazy(() => import('./pages/RecoveryPage'))
const RecoveryLogsPage = lazy(() => import('./pages/RecoveryLogsPage'))
const ReportOutagePage = lazy(() => import('./pages/ReportOutagePage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const VerificationPage = lazy(() => import('./pages/VerificationPage'))

const pageTitles = {
  '/': ['Dashboard', 'Your network at a glance. Stay ahead of every incident.'],
  '/outages': ['Outages', 'Monitor and investigate network incidents.'],
  '/components': ['Network Components', 'View the infrastructure connected to your network.'],
  '/impacts': ['Impact Analysis', 'Understand how incidents affect your services.'],
  '/recovery': ['Recovery Management', 'Coordinate recommended recovery actions.'],
  '/recovery-logs': ['Recovery Logs', 'Review the history of recovery activity.'],
  '/verification': ['Service Verification', 'Track post-recovery service checks.'],
  '/reports': ['Reports', 'Explore incident trends and network performance.'],
  '/locations': ['Locations', 'Review incident and impact summaries for each location.'],
  '/report': ['Report an outage', 'Submit a new incident report to the operations team.'],
  '/login': ['Sign in', 'Access incident reporting and recovery actions.'],
  '/register': ['Create account', 'Register for incident reporting and response tools.'],
}

function RequireAuth({ children }) {
  const { loading, user } = useAuth()
  const location = useLocation()
  if (loading) return <div className="module-loading panel" role="status">Checking your sign-in…</div>
  if (!user) return <Navigate replace state={{ from: location }} to="/login" />
  return children
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [refresh, setRefresh] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastSuccessfulAt, setLastSuccessfulAt] = useState(null)
  const location = useLocation()
  const { user, logout } = useAuth()
  const [title, subtitle] = location.pathname.startsWith('/impacts/')
    ? ['Impact Details', 'Review the affected outage, service and users.']
    : location.pathname.startsWith('/components/')
    ? ['Component Details', 'Review the selected network component.']
    : pageTitles[location.pathname] || pageTitles['/']

  const registerRefresh = useCallback((refreshData, loading, refreshedAt) => {
    setRefresh(() => refreshData)
    setRefreshing(loading)
    setLastSuccessfulAt(refreshedAt)
  }, [])

  const handleRefresh = async () => {
    if (!refresh || refreshing) return
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }

  const supportsRefresh = ['/', '/outages', '/components', '/impacts', '/recovery', '/recovery-logs', '/verification', '/reports', '/locations']
    .includes(location.pathname)
    || location.pathname.startsWith('/components/')
    || location.pathname.startsWith('/impacts/')

  return (
    <div className="app-shell min-h-screen">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onSignOut={logout}
        onToggle={() => setCollapsed((value) => !value)}
        user={user}
      />
      <main className={`main-content ${collapsed ? 'main-content-expanded' : ''}`}>
        <PageHeader
          onMenu={() => setMobileOpen(true)}
          onRefresh={supportsRefresh ? handleRefresh : undefined}
          autoRefreshEnabled={supportsRefresh}
          lastSuccessfulAt={lastSuccessfulAt}
          refreshing={refreshing}
          subtitle={subtitle}
          title={title}
          user={user}
        />
        <div className="page-content">
          <Suspense fallback={<div className="module-loading panel" role="status">Loading page…</div>}>
            <Routes>
              <Route element={<RequireAuth><DashboardPage onRefreshState={registerRefresh} /></RequireAuth>} path="/" />
              <Route element={<RequireAuth><OutagesPage onRefreshState={registerRefresh} /></RequireAuth>} path="/outages" />
              <Route element={<RequireAuth><ComponentsPage onRefreshState={registerRefresh} /></RequireAuth>} path="/components" />
              <Route element={<RequireAuth><ComponentDetailsPage onRefreshState={registerRefresh} /></RequireAuth>} path="/components/:componentId" />
              <Route element={<RequireAuth><ImpactsPage onRefreshState={registerRefresh} /></RequireAuth>} path="/impacts" />
              <Route element={<RequireAuth><ImpactDetailsPage onRefreshState={registerRefresh} /></RequireAuth>} path="/impacts/:impactId" />
              <Route element={<RequireAuth><RecoveryPage onRefreshState={registerRefresh} /></RequireAuth>} path="/recovery" />
              <Route element={<RequireAuth><RecoveryLogsPage onRefreshState={registerRefresh} /></RequireAuth>} path="/recovery-logs" />
              <Route element={<RequireAuth><VerificationPage onRefreshState={registerRefresh} /></RequireAuth>} path="/verification" />
              <Route element={<RequireAuth><ReportsPage onRefreshState={registerRefresh} /></RequireAuth>} path="/reports" />
              <Route element={<RequireAuth><LocationsPage onRefreshState={registerRefresh} /></RequireAuth>} path="/locations" />
              <Route element={<RequireAuth><ReportOutagePage /></RequireAuth>} path="/report" />
              <Route element={<AuthPage mode="login" />} path="/login" />
              <Route element={<AuthPage mode="register" />} path="/register" />
              <Route element={<Navigate replace to="/" />} path="*" />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  )
}
