import { AlertTriangle, Activity, BarChart3, Download, RefreshCw, Radio, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import StatCard from '../components/StatCard'
import { StatusBadge } from '../components/StatusBadge'
import { fetchReportSummary } from '../services/api'
import useAutoRefresh from '../hooks/useAutoRefresh'

const numberFormatter = new Intl.NumberFormat('en-US')
const severityColors = {
  CRITICAL: '#fb7185',
  HIGH: '#fb923c',
  MEDIUM: '#fbbf24',
  LOW: '#60a5fa',
}

function getRequestErrorMessage(requestError) {
  const detail = requestError.response?.data?.message || requestError.message
  return `Unable to retrieve report data from the backend. ${detail}`
}

function escapeCsv(value) {
  const text = String(value ?? '')
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safeText.replaceAll('"', '""')}"`
}

function downloadCsv(report) {
  const rows = [
    ['Section', 'Metric', 'Value', 'Region', 'Outages', 'Affected Users'],
    ['Summary', 'Total outages', report.totalOutages, '', '', ''],
    ['Summary', 'Affected users', report.totalAffectedUsers, '', '', ''],
    ['Summary', 'Recovery actions', report.totalRecoveryActions, '', '', ''],
    ...report.severityDistribution.map(({ severity, count }) => ['Severity', severity, count, '', '', '']),
    ...report.recoverySummary.map(({ status, count }) => ['Recovery status', status, count, '', '', '']),
    ...report.locationSummary.map(({ locationName, region, outageCount, affectedUsers }) => [
      'Location',
      locationName,
      '',
      region,
      outageCount,
      affectedUsers,
    ]),
  ]
  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'internet-outage-report.csv'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function ReportsPage({ onRefreshState }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestId = useRef(0)

  const loadData = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const result = await fetchReportSummary()
      if (requestId.current === currentRequest) setData(result)
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

  const report = useMemo(() => {
    if (!data) return null

    return {
      ...data,
      totalOutages: Number(data.summary.totalOutages) || 0,
      totalAffectedUsers: Number(data.summary.totalAffectedUsers) || 0,
      totalRecoveryActions: Number(data.summary.totalRecoveryActions) || 0,
    }
  }, [data])

  if (loading && data === null) {
    return (
      <div aria-label="Loading reports" className="module-loading panel" role="status">
        <RefreshCw className="spin" size={18} />
        <span>Preparing live network reports…</span>
      </div>
    )
  }

  if (error && data === null) {
    return (
      <div className="error-state" role="alert">
        <div className="error-icon"><AlertTriangle size={21} /></div>
        <div>
          <h2>Couldn’t load report data</h2>
          <p>{error}</p>
          <span>Check that the backend is running and VITE_API_BASE_URL is correct.</span>
        </div>
        <button className="refresh-button" onClick={refresh} type="button">
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    )
  }

  const hasReportData = report.totalOutages > 0 || report.totalRecoveryActions > 0

  return (
    <div className="reports-page">
      {error && <div className="inline-error" role="alert">{error}</div>}
      {!hasReportData ? (
        <section className="panel reports-empty">
          <BarChart3 size={22} />
          <h2>No report data available</h2>
          <p>Reports will appear when outage, impact or recovery records are present.</p>
        </section>
      ) : (
        <>
          <div className="reports-heading-row">
            <p>Live summaries calculated from outage, impact and recovery records.</p>
            <button className="refresh-button reports-export-button" onClick={() => downloadCsv(report)} type="button">
              <Download size={15} /> Export CSV
            </button>
          </div>
          <section aria-label="Report totals" className="stats-grid reports-summary-grid">
            <StatCard
              icon={Radio}
              note="All recorded incidents"
              title="Total outages"
              tone="blue"
              value={numberFormatter.format(report.totalOutages)}
            />
            <StatCard
              icon={Users}
              note="Across all impact records"
              title="Affected users"
              tone="purple"
              value={numberFormatter.format(report.totalAffectedUsers)}
            />
            <StatCard
              icon={Activity}
              note="All recorded recommendations"
              title="Recovery actions"
              tone="orange"
              value={numberFormatter.format(report.totalRecoveryActions)}
            />
            <StatCard
              icon={RefreshCw}
              note="Currently ongoing"
              title="Open outages"
              tone="red"
              value={numberFormatter.format(Number(report.summary.ongoingOutages) || 0)}
            />
          </section>
          <div className="reports-grid">
            <section aria-labelledby="report-severity-title" className="panel report-panel">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">INCIDENT BREAKDOWN</div>
                  <h2 id="report-severity-title">Severity distribution</h2>
                </div>
                <span className="record-count">{report.totalOutages} outages</span>
              </div>
              {report.severityDistribution.length === 0 ? (
                <div className="report-empty-small">No outage severity data available.</div>
              ) : (
                <div className="report-bars">
                  {report.severityDistribution.map(({ severity, count }) => {
                    const maxCount = Math.max(...report.severityDistribution.map((item) => item.count))
                    return (
                      <div className="report-bar-row" key={severity}>
                        <div className="report-bar-label">
                          <span><i style={{ backgroundColor: severityColors[severity] || '#60a5fa' }} />{severity}</span>
                          <strong>{count} · {Math.round((count / report.totalOutages) * 100)}%</strong>
                        </div>
                        <div className="report-bar-track">
                          <span style={{
                            backgroundColor: severityColors[severity] || '#60a5fa',
                            width: `${(count / maxCount) * 100}%`,
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section aria-labelledby="report-recovery-title" className="panel report-panel">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">RESPONSE PROGRESS</div>
                  <h2 id="report-recovery-title">Recovery status</h2>
                </div>
                <span className="record-count">{report.totalRecoveryActions} actions</span>
              </div>
              {report.recoverySummary.length === 0 ? (
                <div className="report-empty-small">No recovery action status data available.</div>
              ) : (
                <div className="report-status-list">
                  {report.recoverySummary.map(({ status, count }) => (
                    <div className="report-status-row" key={status}>
                      <StatusBadge status={status} />
                      <span>{count} {count === 1 ? 'action' : 'actions'}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section aria-labelledby="report-location-title" className="panel report-panel report-location-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">GEOGRAPHIC OVERVIEW</div>
                <h2 id="report-location-title">Location-wise outages</h2>
              </div>
              <span className="record-count">{report.locationSummary.length} locations</span>
            </div>
            {report.locationSummary.length === 0 ? (
              <div className="report-empty-small">No location outage data available.</div>
            ) : (
              <div className="report-location-table-wrap">
                <table className="report-location-table">
                  <thead>
                    <tr><th>LOCATION</th><th>REGION</th><th>OUTAGES</th><th>AFFECTED USERS</th></tr>
                  </thead>
                  <tbody>
                    {report.locationSummary.map((location) => (
                      <tr key={`${location.locationName}-${location.region}`}>
                        <td>{location.locationName}</td>
                        <td>{location.region}</td>
                        <td>{numberFormatter.format(location.outageCount)}</td>
                        <td>{numberFormatter.format(location.affectedUsers)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      <div className="dashboard-footnote">Report figures are calculated from live records; CSV export contains the displayed summaries.</div>
    </div>
  )
}
