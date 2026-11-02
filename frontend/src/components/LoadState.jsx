import { AlertTriangle, RefreshCw } from 'lucide-react'

export function DashboardLoading() {
  return (
    <div aria-label="Loading dashboard data" className="dashboard-loading" role="status">
      <div className="loading-message"><RefreshCw className="spin" size={18} /> Loading live network data…</div>
      <div className="loading-stat-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((item) => <div className="skeleton-card" key={item} />)}
      </div>
      <div className="skeleton-panel" />
    </div>
  )
}

export function DashboardError({ message, onRetry }) {
  return (
    <div className="error-state" role="alert">
      <div className="error-icon"><AlertTriangle size={21} /></div>
      <div>
        <h2>Couldn’t load dashboard data</h2>
        <p>{message}</p>
        <span>Check that the backend is running and VITE_API_BASE_URL is correct.</span>
      </div>
      <button className="refresh-button" onClick={onRetry} type="button">
        <RefreshCw size={15} /> Try again
      </button>
    </div>
  )
}
