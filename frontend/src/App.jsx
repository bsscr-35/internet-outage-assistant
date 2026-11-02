import { useCallback, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import PageHeader from './components/PageHeader'
import Sidebar from './components/Sidebar'
import ComponentsPage from './pages/ComponentsPage'
import ComponentDetailsPage from './pages/ComponentDetailsPage'
import DashboardPage from './pages/DashboardPage'
import ImpactsPage from './pages/ImpactsPage'
import ImpactDetailsPage from './pages/ImpactDetailsPage'
import OutagesPage from './pages/OutagesPage'
import RecoveryPage from './pages/RecoveryPage'
import RecoveryLogsPage from './pages/RecoveryLogsPage'
import VerificationPage from './pages/VerificationPage'
import ReportsPage from './pages/ReportsPage'
import './App.css'

const pageTitles = {
  '/': ['Dashboard', 'Your network at a glance. Stay ahead of every incident.'],
  '/outages': ['Outages', 'Monitor and investigate network incidents.'],
  '/components': ['Network Components', 'View the infrastructure connected to your network.'],
  '/impacts': ['Impact Analysis', 'Understand how incidents affect your services.'],
  '/recovery': ['Recovery Management', 'Coordinate recommended recovery actions.'],
  '/recovery-logs': ['Recovery Logs', 'Review the history of recovery activity.'],
  '/verification': ['Service Verification', 'Track post-recovery service checks.'],
  '/reports': ['Reports', 'Explore incident trends and network performance.'],
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [refresh, setRefresh] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastSuccessfulAt, setLastSuccessfulAt] = useState(null)
  const location = useLocation()
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

  const supportsRefresh = ['/', '/outages', '/components', '/impacts', '/recovery', '/recovery-logs', '/verification', '/reports']
    .includes(location.pathname)
    || location.pathname.startsWith('/components/')
    || location.pathname.startsWith('/impacts/')

  return (
    <div className="app-shell min-h-screen">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onToggle={() => setCollapsed((value) => !value)}
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
        />
        <div className="page-content">
          <Routes>
            <Route element={<DashboardPage onRefreshState={registerRefresh} />} path="/" />
            <Route element={<OutagesPage onRefreshState={registerRefresh} />} path="/outages" />
            <Route element={<ComponentsPage onRefreshState={registerRefresh} />} path="/components" />
            <Route element={<ComponentDetailsPage onRefreshState={registerRefresh} />} path="/components/:componentId" />
            <Route element={<ImpactsPage onRefreshState={registerRefresh} />} path="/impacts" />
            <Route element={<ImpactDetailsPage onRefreshState={registerRefresh} />} path="/impacts/:impactId" />
            <Route element={<RecoveryPage onRefreshState={registerRefresh} />} path="/recovery" />
            <Route element={<RecoveryLogsPage onRefreshState={registerRefresh} />} path="/recovery-logs" />
            <Route element={<VerificationPage onRefreshState={registerRefresh} />} path="/verification" />
            <Route element={<ReportsPage onRefreshState={registerRefresh} />} path="/reports" />
            <Route element={<Navigate replace to="/" />} path="*" />
          </Routes>
        </div>
      </main>
    </div>
  )
}
