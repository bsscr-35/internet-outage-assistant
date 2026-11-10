import { AlertTriangle, Activity, CheckCircle2, RefreshCw, Search, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StatusBadge } from '../components/StatusBadge'
import StatCard from '../components/StatCard'
import { fetchRecoveryLogs } from '../services/api'
import formatDatabaseDateTime from '../utils/formatDatabaseDateTime'
import useAutoRefresh from '../hooks/useAutoRefresh'

const numberFormatter = new Intl.NumberFormat('en-US')

function getRequestErrorMessage(requestError) {
  const detail = requestError.response?.data?.message || requestError.message
  return `Unable to retrieve recovery logs from the backend. ${detail}`
}

export default function RecoveryLogsPage({ onRefreshState }) {
  const [logs, setLogs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const requestId = useRef(0)

  const loadData = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const result = await fetchRecoveryLogs()
      if (requestId.current === currentRequest) setLogs(result)
      return requestId.current === currentRequest
    } catch (requestError) {
      if (requestId.current === currentRequest) setError(getRequestErrorMessage(requestError))
      return false
    } finally {
      if (requestId.current === currentRequest) setLoading(false)
    }
  }, [])

  const { refresh, lastSuccessfulAt } = useAutoRefresh(loadData)

  useEffect(() => {
    onRefreshState?.(refresh, loading, lastSuccessfulAt)
  }, [lastSuccessfulAt, loading, onRefreshState, refresh])

  const statuses = useMemo(
    () => [...new Set((logs || []).map((log) => log.status).filter(Boolean))].sort(),
    [logs],
  )
  const summaryCards = useMemo(() => {
    const completed = (logs || []).filter((log) => log.status?.toUpperCase() === 'COMPLETED').length
    const inProgress = (logs || []).filter((log) => log.status?.toUpperCase() === 'IN_PROGRESS').length
    return [
      { title: 'Recovery logs', value: numberFormatter.format(logs?.length || 0), note: 'Execution records', icon: Activity, tone: 'blue' },
      { title: 'Completed', value: numberFormatter.format(completed), note: 'Completed executions', icon: CheckCircle2, tone: 'green' },
      { title: 'In progress', value: numberFormatter.format(inProgress), note: 'Active executions', icon: RefreshCw, tone: 'orange' },
      { title: 'Assigned technicians', value: numberFormatter.format(new Set((logs || []).map((log) => log.assignedTo).filter(Boolean)).size), note: 'Unique assignees', icon: Users, tone: 'purple' },
    ]
  }, [logs])
  const filteredLogs = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return (logs || []).filter((log) => {
      const matchesSearch = !query || [
        log.recoveryId,
        log.actionId,
        log.outageId,
        log.actionType,
        log.assignedTo,
        log.remarks,
      ].some((value) => String(value ?? '').toLocaleLowerCase().includes(query))
      return matchesSearch && (!status || log.status === status)
    })
  }, [logs, search, status])

  if (loading && logs === null) {
    return (
      <div aria-label="Loading recovery logs" className="module-loading panel" role="status">
        <RefreshCw className="spin" size={18} />
        <span>Loading live recovery execution history…</span>
      </div>
    )
  }

  if (error && logs === null) {
    return (
      <div className="error-state" role="alert">
        <div className="error-icon"><AlertTriangle size={21} /></div>
        <div>
          <h2>Couldn’t load recovery logs</h2>
          <p>{error}</p>
          <span>Check that the backend is running and VITE_API_BASE_URL is correct.</span>
        </div>
        <button className="refresh-button" onClick={refresh} type="button">
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    )
  }

  return (
    <div className="operations-page">
      {error && <div className="inline-error" role="alert">{error}</div>}
      <section aria-label="Recovery log summaries" className="stats-grid operations-summary-grid">
        {summaryCards.map((card) => <StatCard {...card} key={card.title} />)}
      </section>
      <section aria-label="Recovery log search and filters" className="panel operations-controls">
        <label className="operations-search">
          <Search aria-hidden="true" size={16} />
          <span className="visually-hidden">Search recovery ID, action, outage or technician</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search recovery, action, outage or technician"
            type="search"
            value={search}
          />
        </label>
        <label className="operations-filter">
          <span>Status</span>
          <select onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <button
          className="outage-clear-filters"
          disabled={!search && !status}
          onClick={() => {
            setSearch('')
            setStatus('')
          }}
          type="button"
        >
          Clear
        </button>
      </section>

      <section aria-labelledby="recovery-logs-title" className="panel operations-list-panel">
        <div className="panel-heading operations-list-heading">
          <div>
            <div className="eyebrow">EXECUTION HISTORY</div>
            <h2 id="recovery-logs-title">Recovery logs</h2>
          </div>
          <span className="record-count">{filteredLogs.length} records</span>
        </div>
        {loading && (
          <div className="module-refreshing" role="status">
            <RefreshCw className="spin" size={14} /> Refreshing recovery logs…
          </div>
        )}
        {!loading && filteredLogs.length === 0 && (
          <div className="module-empty">
            {logs.length === 0 ? 'No recovery logs found.' : 'No recovery logs match these filters.'}
          </div>
        )}
        {filteredLogs.length > 0 && (
          <div className="recovery-log-table-wrap">
            <table className="recovery-log-table">
              <thead>
                <tr>
                  <th>RECOVERY</th>
                  <th>ACTION / OUTAGE</th>
                  <th>AFFECTED SERVICES</th>
                  <th>ASSIGNED TECHNICIAN</th>
                  <th>STARTED</th>
                  <th>COMPLETED</th>
                  <th>LOG STATUS</th>
                  <th>ACTION STATUS</th>
                  <th>REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.recoveryId}>
                    <td>#{log.recoveryId}</td>
                    <td><strong>{log.actionType || `Action #${log.actionId}`}</strong><small>Action #{log.actionId} · OUT-{String(log.outageId).padStart(4, '0')} · {log.componentName} · {log.locationName}, {log.region}</small></td>
                    <td>{log.serviceNames?.join(', ') || 'No service impact recorded'}</td>
                    <td>{log.assignedTo || 'Unassigned'}</td>
                    <td>{formatDatabaseDateTime(log.startedAt)}</td>
                    <td>{formatDatabaseDateTime(log.completedAt)}</td>
                    <td><StatusBadge status={log.status} /></td>
                    <td><StatusBadge status={log.actionStatus} /></td>
                    <td className="recovery-log-remarks">{log.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="dashboard-footnote">Recovery execution history is served live from your database.</div>
    </div>
  )
}
