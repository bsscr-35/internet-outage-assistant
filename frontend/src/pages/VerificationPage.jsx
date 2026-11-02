import { AlertTriangle, CheckCircle2, RefreshCw, Search, ShieldCheck, Wifi } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StatusBadge } from '../components/StatusBadge'
import StatCard from '../components/StatCard'
import { fetchServiceVerifications } from '../services/api'
import formatDatabaseDateTime from '../utils/formatDatabaseDateTime'
import useAutoRefresh from '../hooks/useAutoRefresh'

const numberFormatter = new Intl.NumberFormat('en-US')

function getRequestErrorMessage(requestError) {
  const detail = requestError.response?.data?.message || requestError.message
  return `Unable to retrieve service verification data from the backend. ${detail}`
}

export default function VerificationPage({ onRefreshState }) {
  const [verifications, setVerifications] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [serviceStatus, setServiceStatus] = useState('')
  const [connectivityStatus, setConnectivityStatus] = useState('')
  const requestId = useRef(0)

  const loadData = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const result = await fetchServiceVerifications()
      if (requestId.current === currentRequest) setVerifications(result)
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

  const serviceStatuses = useMemo(
    () => [...new Set((verifications || []).map((entry) => entry.serviceStatus).filter(Boolean))].sort(),
    [verifications],
  )
  const connectivityStatuses = useMemo(
    () => [...new Set((verifications || []).map((entry) => entry.connectivityStatus).filter(Boolean))].sort(),
    [verifications],
  )
  const summaryCards = useMemo(() => {
    const restored = (verifications || []).filter((entry) => entry.serviceStatus?.toUpperCase() === 'RESTORED').length
    const connected = (verifications || []).filter((entry) => entry.connectivityStatus?.toUpperCase() === 'CONNECTED').length
    return [
      { title: 'Verifications', value: numberFormatter.format(verifications?.length || 0), note: 'Recorded checks', icon: ShieldCheck, tone: 'blue' },
      { title: 'Service restored', value: numberFormatter.format(restored), note: 'Service status restored', icon: CheckCircle2, tone: 'green' },
      { title: 'Connected', value: numberFormatter.format(connected), note: 'Connectivity checks passed', icon: Wifi, tone: 'purple' },
    ]
  }, [verifications])
  const filteredVerifications = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return (verifications || []).filter((entry) => {
      const matchesSearch = !query || [
        entry.verificationId,
        entry.outageId,
        entry.verifiedBy,
      ].some((value) => String(value ?? '').toLocaleLowerCase().includes(query))
      return matchesSearch
        && (!serviceStatus || entry.serviceStatus === serviceStatus)
        && (!connectivityStatus || entry.connectivityStatus === connectivityStatus)
    })
  }, [verifications, search, serviceStatus, connectivityStatus])

  if (loading && verifications === null) {
    return (
      <div aria-label="Loading service verifications" className="module-loading panel" role="status">
        <RefreshCw className="spin" size={18} />
        <span>Loading live service verification records…</span>
      </div>
    )
  }

  if (error && verifications === null) {
    return (
      <div className="error-state" role="alert">
        <div className="error-icon"><AlertTriangle size={21} /></div>
        <div>
          <h2>Couldn’t load verification records</h2>
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
      <section aria-label="Verification summaries" className="stats-grid operations-summary-grid">
        {summaryCards.map((card) => <StatCard {...card} key={card.title} />)}
      </section>
      <section aria-label="Verification search and filters" className="panel operations-controls">
        <label className="operations-search">
          <Search aria-hidden="true" size={16} />
          <span className="visually-hidden">Search outage ID or verified by</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search outage ID or verified by"
            type="search"
            value={search}
          />
        </label>
        <label className="operations-filter">
          <span>Service</span>
          <select onChange={(event) => setServiceStatus(event.target.value)} value={serviceStatus}>
            <option value="">All service statuses</option>
            {serviceStatuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <label className="operations-filter">
          <span>Connectivity</span>
          <select onChange={(event) => setConnectivityStatus(event.target.value)} value={connectivityStatus}>
            <option value="">All connectivity</option>
            {connectivityStatuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <button
          className="outage-clear-filters"
          disabled={!search && !serviceStatus && !connectivityStatus}
          onClick={() => {
            setSearch('')
            setServiceStatus('')
            setConnectivityStatus('')
          }}
          type="button"
        >
          Clear
        </button>
      </section>

      <section aria-labelledby="verification-title" className="panel verification-list-panel">
        <div className="panel-heading operations-list-heading">
          <div>
            <div className="eyebrow">POST-RECOVERY CHECKS</div>
            <h2 id="verification-title">Service verification</h2>
          </div>
          <span className="record-count">{filteredVerifications.length} records</span>
        </div>
        {loading && (
          <div className="module-refreshing" role="status">
            <RefreshCw className="spin" size={14} /> Refreshing verification records…
          </div>
        )}
        {!loading && filteredVerifications.length === 0 && (
          <div className="module-empty">
            {verifications.length === 0 ? 'No service verification records found.' : 'No verifications match these filters.'}
          </div>
        )}
        {filteredVerifications.length > 0 && (
          <div className="verification-record-list">
            {filteredVerifications.map((entry) => (
              <article className="verification-record" key={entry.verificationId}>
                <div className="verification-record-heading">
                  <strong>VERIFICATION #{entry.verificationId}</strong>
                  <span>Outage #{entry.outageId}</span>
                </div>
                <div className="verification-record-facts">
                  <div><small>VERIFIED AT</small><span>{formatDatabaseDateTime(entry.verificationTime)}</span></div>
                  <div><small>SERVICE STATUS</small><StatusBadge status={entry.serviceStatus} /></div>
                  <div><small>CONNECTIVITY</small><StatusBadge status={entry.connectivityStatus} /></div>
                  <div><small>VERIFIED BY</small><span>{entry.verifiedBy || 'Not recorded'}</span></div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <div className="dashboard-footnote">Service verification checks are served live from your database.</div>
    </div>
  )
}
