import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  CircleAlert,
  Radio,
  MapPinned,
  ListChecks,
  Users,
  Wifi,
  RefreshCw,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { fetchDashboardData } from '../services/api'
import useAutoRefresh from '../hooks/useAutoRefresh'
import { DashboardError, DashboardLoading } from '../components/LoadState'
import RecentOutagesTable from '../components/RecentOutagesTable'
import SeverityChart from '../components/SeverityChart'
import StatCard from '../components/StatCard'

const numberFormatter = new Intl.NumberFormat('en-US')

function getRequestErrorMessage(requestError) {
  const detail = requestError.response?.data?.message || requestError.message
  return `Unable to retrieve live data from the backend. ${detail}`
}

export default function DashboardPage({ onRefreshState }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchDashboardData()
      setData(result)
      return true
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const { refresh, lastSuccessfulAt } = useAutoRefresh(loadData)

  useEffect(() => {
    onRefreshState?.(refresh, loading, lastSuccessfulAt)
  }, [lastSuccessfulAt, loading, onRefreshState, refresh])

  if (loading && !data) return <DashboardLoading />
  if (error && !data) return <DashboardError message={error} onRetry={refresh} />

  const stats = data.stats
  const cards = [
    { title: 'Total outages', value: stats.totalOutages, note: 'Tracked incidents', icon: Radio, tone: 'blue' },
    { title: 'Ongoing outages', value: stats.ongoingOutages, note: 'Marked ongoing', icon: Wifi, tone: 'red' },
    { title: 'Resolved outages', value: stats.resolvedOutages, note: 'Marked resolved', icon: CheckCircle2, tone: 'green' },
    { title: 'Recovery actions', value: stats.totalRecoveryActions, note: 'Recorded actions', icon: Activity, tone: 'orange' },
    { title: 'Recovery logs', value: stats.totalRecoveryLogs, note: 'Recorded activity', icon: ListChecks, tone: 'blue' },
    { title: 'Completed recovery', value: stats.completedRecoveryActions, note: 'Completed actions', icon: CheckCircle2, tone: 'green' },
    { title: 'Recovery in progress', value: stats.inProgressRecoveryActions, note: 'Active actions', icon: RefreshCw, tone: 'orange' },
    { title: 'Affected locations', value: stats.affectedLocations, note: 'Locations with outages', icon: MapPinned, tone: 'blue' },
    { title: 'Critical severity', value: stats.criticalOutages, note: 'Critical records', icon: AlertOctagon, tone: 'red' },
    { title: 'High severity', value: stats.highSeverityOutages, note: 'High severity records', icon: CircleAlert, tone: 'orange' },
    { title: 'Affected users', value: stats.totalAffectedUsers, note: 'Across outage impacts', icon: Users, tone: 'purple' },
  ]

  return (
    <div className="dashboard-content">
      {error && <div className="inline-error" role="alert">{error}</div>}
      <section aria-label="Outage statistics" className="stats-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {cards.map((card) => (
          <StatCard
            {...card}
            key={card.title}
            value={numberFormatter.format(Number(card.value) || 0)}
          />
        ))}
      </section>
      <div className="dashboard-grid">
        <SeverityChart outages={data.outages} />
        <section className="panel health-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">INCIDENT MONITORING</div>
              <h2>Current response pulse</h2>
            </div>
            <span className="health-chip"><span className="online-dot" />Live outage data</span>
          </div>
          <div className="health-visual">
            <div className="health-orbit orbit-outer" />
            <div className="health-orbit orbit-inner" />
            <div className="health-core"><Wifi size={27} /></div>
            <span className="orbit-node node-one" />
            <span className="orbit-node node-two" />
            <span className="orbit-node node-three" />
          </div>
          <div className="health-summary">
            <span className="health-summary-label">Open incidents in database</span>
            <strong>{numberFormatter.format(Number(stats.ongoingOutages) || 0)} ongoing</strong>
            <small>Based on recorded outage status</small>
          </div>
          <div className="health-footer">
            <span>Total tracked outages</span>
            <strong>{numberFormatter.format(Number(stats.totalOutages) || 0)}</strong>
          </div>
        </section>
      </div>
      <RecentOutagesTable outages={data.outages} />
      <div className="dashboard-footnote">
        Data is served live from your outage management database.
      </div>
    </div>
  )
}
