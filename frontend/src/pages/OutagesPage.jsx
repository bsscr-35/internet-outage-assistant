import { AlertTriangle, MapPin, RefreshCw, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SeverityBadge, StatusBadge } from '../components/StatusBadge'
import { fetchOutageDetails, fetchOutages } from '../services/api'
import useAutoRefresh from '../hooks/useAutoRefresh'

const numberFormatter = new Intl.NumberFormat('en-US')
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatWallClock(value) {
  if (!value) return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value)
  if (!match) return value

  const [, year, month, day, hour, minute] = match
  const hourNumber = Number(hour)
  const displayHour = hourNumber % 12 || 12
  const period = hourNumber >= 12 ? 'PM' : 'AM'
  return `${months[Number(month) - 1]} ${Number(day)}, ${year} · ${displayHour}:${minute} ${period}`
}

function getRequestErrorMessage(requestError) {
  const detail = requestError.response?.data?.message || requestError.message
  return `Unable to retrieve outage data from the backend. ${detail}`
}

function OutageDetails({ outageId, onClose, refreshVersion }) {
  const [outage, setOutage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const requestId = useRef(0)
  const requestRef = useRef(null)

  useEffect(() => {
    const requestKey = `${outageId}:${refreshVersion}:${retry}`
    if (requestRef.current?.key === requestKey || requestRef.current?.inFlight) return

    const currentRequest = ++requestId.current
    requestRef.current = { key: requestKey, inFlight: true }
    setLoading((isLoading) => isLoading || !outage)
    setError('')
    fetchOutageDetails(outageId)
      .then((result) => {
        if (requestId.current === currentRequest) setOutage(result)
      })
      .catch((requestError) => {
        if (requestId.current === currentRequest) setError(getRequestErrorMessage(requestError))
      })
      .finally(() => {
        if (requestId.current === currentRequest) {
          requestRef.current.inFlight = false
          setLoading(false)
        }
      })
  }, [outage, outageId, refreshVersion, retry])

  return (
    <section aria-labelledby="outage-details-title" className="panel outage-detail-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">INCIDENT RECORD</div>
          <h2 id="outage-details-title">Outage details</h2>
        </div>
        <button aria-label="Close outage details" className="icon-button" onClick={onClose} type="button">
          <X size={16} />
        </button>
      </div>

      {loading && (
        <div aria-live="polite" className="outage-detail-state" role="status">
          <RefreshCw className="spin" size={17} /> Loading outage details…
        </div>
      )}
      {!loading && error && !outage && (
        <div className="outage-detail-error" role="alert">
          <p>{error}</p>
          <button
            className="refresh-button"
            onClick={() => {
              setLoading(true)
              setRetry((value) => value + 1)
            }}
            type="button"
          >
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      )}
      {!loading && error && outage && <div className="inline-error" role="alert">{error}</div>}
      {!loading && outage && (
        <>
          <div className="outage-detail-identity">
            <div>
              <span className="outage-record-id">OUT-{String(outage.outageId).padStart(4, '0')}</span>
              <strong>{outage.componentName}</strong>
              <span>{outage.componentType} · Criticality {outage.componentCriticality || 'Unknown'}</span>
            </div>
            <div className="outage-badges">
              <SeverityBadge severity={outage.severity} />
              <StatusBadge status={outage.status} />
            </div>
          </div>

          <dl className="outage-facts">
            <div>
              <dt>Location</dt>
              <dd><MapPin size={13} /> {outage.locationName} · {outage.region}</dd>
            </div>
            <div>
              <dt>Cause</dt>
              <dd>{outage.cause || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Detected</dt>
              <dd>{formatWallClock(outage.detectedAt)}</dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>{formatWallClock(outage.startTime)}</dd>
            </div>
            <div>
              <dt>Ended</dt>
              <dd>{formatWallClock(outage.endTime)}</dd>
            </div>
          </dl>

          <div className="outage-related-section">
            <div className="outage-related-heading">
              <h3>Associated impacts</h3>
              <span>{outage.impacts.length}</span>
            </div>
            {outage.impacts.length === 0 ? (
              <p className="outage-related-empty">No impact records are associated with this outage.</p>
            ) : (
              <ul className="outage-related-list">
                {outage.impacts.map((impact) => (
                  <li key={impact.impactId}>
                    <div className="outage-related-meta">
                      <strong>Service #{impact.serviceId}</strong>
                      <SeverityBadge severity={impact.impactLevel} />
                    </div>
                    <p>{impact.description || 'No description recorded.'}</p>
                    <span>{numberFormatter.format(Number(impact.usersAffected) || 0)} affected users</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="outage-related-section">
            <div className="outage-related-heading">
              <h3>Recovery actions</h3>
              <span>{outage.recoveryActions.length}</span>
            </div>
            {outage.recoveryActions.length === 0 ? (
              <p className="outage-related-empty">No recovery actions are associated with this outage.</p>
            ) : (
              <ul className="outage-related-list">
                {outage.recoveryActions.map((action) => (
                  <li key={action.actionId}>
                    <div className="outage-related-meta">
                      <strong>{action.actionType}</strong>
                      <StatusBadge status={action.status} />
                    </div>
                    <p>{action.description || 'No description recorded.'}</p>
                    <span>Priority {action.priority || 'Unknown'} · Recommended {formatWallClock(action.recommendedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default function OutagesPage({ onRefreshState }) {
  const [outages, setOutages] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState('')
  const [status, setStatus] = useState('')
  const [selectedOutageId, setSelectedOutageId] = useState(null)
  const [detailRefreshVersion, setDetailRefreshVersion] = useState(0)
  const requestId = useRef(0)

  const loadData = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const result = await fetchOutages()
      if (requestId.current === currentRequest) {
        setOutages(result)
        setDetailRefreshVersion((version) => version + 1)
      }
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

  const severities = useMemo(
    () => [...new Set((outages || []).map((outage) => outage.severity).filter(Boolean))].sort(),
    [outages],
  )
  const statuses = useMemo(
    () => [...new Set((outages || []).map((outage) => outage.status).filter(Boolean))].sort(),
    [outages],
  )
  const filteredOutages = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return (outages || []).filter((outage) => {
      const matchesSearch = !query || [
        outage.componentName,
        outage.componentType,
        outage.locationName,
        outage.region,
        outage.cause,
      ].some((value) => String(value || '').toLocaleLowerCase().includes(query))
      return matchesSearch
        && (!severity || outage.severity === severity)
        && (!status || outage.status === status)
    })
  }, [outages, search, severity, status])

  const clearFilters = () => {
    setSearch('')
    setSeverity('')
    setStatus('')
  }

  if (loading && outages === null) {
    return (
      <div aria-label="Loading outage records" className="outage-loading panel" role="status">
        <RefreshCw className="spin" size={18} />
        <span>Loading live outage records…</span>
      </div>
    )
  }

  if (error && outages === null) {
    return (
      <div className="error-state" role="alert">
        <div className="error-icon"><AlertTriangle size={21} /></div>
        <div>
          <h2>Couldn’t load outage records</h2>
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
    <div className="outage-page">
      {error && <div className="inline-error" role="alert">{error}</div>}
      <section aria-label="Outage search and filters" className="panel outage-controls">
        <label className="outage-search">
          <Search aria-hidden="true" size={17} />
          <span className="visually-hidden">Search component, location or cause</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search component, location or cause"
            type="search"
            value={search}
          />
        </label>
        <label className="outage-filter">
          <span>Severity</span>
          <select onChange={(event) => setSeverity(event.target.value)} value={severity}>
            <option value="">All severities</option>
            {severities.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="outage-filter">
          <span>Status</span>
          <select onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <button className="outage-clear-filters" disabled={!search && !severity && !status} onClick={clearFilters} type="button">
          Clear
        </button>
      </section>

      <div className="outage-layout">
        <section aria-labelledby="outage-list-title" className="panel outage-list-panel">
          <div className="panel-heading outage-list-heading">
            <div>
              <div className="eyebrow">LIVE INCIDENT FEED</div>
              <h2 id="outage-list-title">All outages</h2>
            </div>
            <span className="record-count">
              {filteredOutages.length}{outages.length !== filteredOutages.length ? ` of ${outages.length}` : ''} records
            </span>
          </div>

          {loading && (
            <div aria-live="polite" className="outage-refreshing" role="status">
              <RefreshCw className="spin" size={14} /> Refreshing outage records…
            </div>
          )}
          {!loading && filteredOutages.length === 0 && (
            <div className="outage-empty">
              {outages.length === 0 ? 'No outage records found.' : 'No outages match these search and filter criteria.'}
            </div>
          )}
          <div className="outage-record-list">
            {filteredOutages.map((outage) => (
              <article
                aria-label={`Outage ${outage.outageId}: ${outage.componentName}`}
                className={`outage-record ${selectedOutageId === outage.outageId ? 'outage-record-selected' : ''}`}
                key={outage.outageId}
              >
                <div className="outage-record-topline">
                  <span className="outage-record-id">OUT-{String(outage.outageId).padStart(4, '0')}</span>
                  <div className="outage-badges">
                    <SeverityBadge severity={outage.severity} />
                    <StatusBadge status={outage.status} />
                  </div>
                </div>
                <h3>{outage.componentName}</h3>
                <p className="outage-record-cause">{outage.cause || 'Cause not recorded'}</p>
                <div className="outage-record-meta">
                  <span><MapPin size={13} /> {outage.locationName} · {outage.region}</span>
                  <span>Detected {formatWallClock(outage.detectedAt)}</span>
                </div>
                <button
                  aria-pressed={selectedOutageId === outage.outageId}
                  className="outage-details-button"
                  onClick={() => setSelectedOutageId(outage.outageId)}
                  type="button"
                >
                  {selectedOutageId === outage.outageId ? 'Viewing details' : 'View details'}
                </button>
              </article>
            ))}
          </div>
        </section>

        {selectedOutageId === null ? (
          <section aria-label="Outage details" className="panel outage-detail-empty">
            <div className="outage-detail-empty-icon"><Search size={20} /></div>
            <h2>Select an outage</h2>
            <p>Choose an incident to view its timeline, impacts and recovery actions.</p>
          </section>
        ) : (
          <OutageDetails
            key={selectedOutageId}
            onClose={() => setSelectedOutageId(null)}
            outageId={selectedOutageId}
            refreshVersion={detailRefreshVersion}
          />
        )}
      </div>
      <div className="dashboard-footnote">Outage records and associated details are served live from your database.</div>
    </div>
  )
}
