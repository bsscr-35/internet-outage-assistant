import { AlertTriangle, CheckCircle2, RefreshCw, Search, ShieldCheck, Wifi } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../components/StatusBadge'
import StatCard from '../components/StatCard'
import {
  createServiceVerification,
  fetchImpacts,
  fetchOutages,
  fetchServiceVerifications,
} from '../services/api'
import formatDatabaseDateTime from '../utils/formatDatabaseDateTime'
import useAutoRefresh from '../hooks/useAutoRefresh'
import useAuth from '../contexts/useAuth'

const numberFormatter = new Intl.NumberFormat('en-US')

function getRequestErrorMessage(requestError, operation = 'retrieve service verification data') {
  const detail = requestError.response?.data?.message || requestError.message
  return `Unable to ${operation}. ${detail}`
}

export default function VerificationPage({ onRefreshState }) {
  const { user } = useAuth()
  const [verifications, setVerifications] = useState(null)
  const [outages, setOutages] = useState([])
  const [impacts, setImpacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createError, setCreateError] = useState('')
  const [createNotice, setCreateNotice] = useState('')
  const [creating, setCreating] = useState(false)
  const [newVerification, setNewVerification] = useState({
    outageId: '',
    serviceStatus: '',
    connectivityStatus: '',
  })
  const [search, setSearch] = useState('')
  const [serviceStatus, setServiceStatus] = useState('')
  const [connectivityStatus, setConnectivityStatus] = useState('')
  const requestId = useRef(0)
  const creatingRef = useRef(false)

  const loadData = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const [result, outageRows, impactRows] = await Promise.all([
        fetchServiceVerifications(),
        fetchOutages(),
        fetchImpacts(),
      ])
      if (requestId.current === currentRequest) {
        setVerifications(result)
        setOutages(outageRows)
        setImpacts(impactRows)
        const eligibleIds = outageRows
          .filter((outage) => outage.status?.toUpperCase() === 'ONGOING'
            && impactRows.some((impact) => Number(impact.outageId) === Number(outage.outageId)))
          .map((outage) => String(outage.outageId))
        setNewVerification((current) => ({
          ...current,
          outageId: eligibleIds.includes(current.outageId) ? current.outageId : eligibleIds[0] || '',
        }))
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

  const eligibleOutages = useMemo(
    () => outages.filter((outage) => outage.status?.toUpperCase() === 'ONGOING'
      && impacts.some((impact) => Number(impact.outageId) === Number(outage.outageId))),
    [outages, impacts],
  )

  const handleCreateVerification = async (event) => {
    event.preventDefault()
    if (creatingRef.current || !user) return

    creatingRef.current = true
    setCreating(true)
    setCreateError('')
    setCreateNotice('')
    try {
      const verification = await createServiceVerification({
        outageId: Number(newVerification.outageId),
        serviceStatus: newVerification.serviceStatus,
        connectivityStatus: newVerification.connectivityStatus,
      })
      setCreateNotice(`Verification #${verification.verificationId} was saved to MySQL.`)
      setNewVerification((current) => ({ ...current, serviceStatus: '', connectivityStatus: '' }))
      await refresh()
    } catch (requestError) {
      setCreateError(getRequestErrorMessage(requestError, 'save service check'))
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }

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
      {user ? (
        <section aria-labelledby="create-verification-title" className="panel report-form-panel">
          <div className="panel-heading">
            <div><div className="eyebrow">OBSERVED POST-RECOVERY CHECK</div><h2 id="create-verification-title">Record a service check</h2></div>
          </div>
          <p className="report-form-intro">Select the result you actually observed. A successful result can be recorded only after all recovery actions for the outage are completed.</p>
          {createError && <div className="inline-error" role="alert">{createError}</div>}
          {createNotice && <div className="inline-success" role="status">{createNotice}</div>}
          {eligibleOutages.length === 0 ? (
            <div className="module-empty">No ongoing outage with a recorded service impact is ready for verification.</div>
          ) : (
            <form className="report-form" onSubmit={handleCreateVerification}>
              <label>
                <span>Outage and impacted service</span>
                <select onChange={(event) => setNewVerification((current) => ({ ...current, outageId: event.target.value }))} required value={newVerification.outageId}>
                  {eligibleOutages.map((outage) => {
                    return (
                      <option key={outage.outageId} value={outage.outageId}>
                        OUT-{String(outage.outageId).padStart(4, '0')} · {outage.componentName} · {outage.locationName} · {outage.serviceNames?.join(', ') || 'No service name configured'}
                      </option>
                    )
                  })}
                </select>
              </label>
              <label>
                <span>Observed service status</span>
                <select onChange={(event) => setNewVerification((current) => ({ ...current, serviceStatus: event.target.value }))} required value={newVerification.serviceStatus}>
                  <option value="">Select observed status</option>
                  <option value="DOWN">DOWN</option>
                  <option value="RESTORED">RESTORED</option>
                </select>
              </label>
              <label>
                <span>Observed connectivity</span>
                <select onChange={(event) => setNewVerification((current) => ({ ...current, connectivityStatus: event.target.value }))} required value={newVerification.connectivityStatus}>
                  <option value="">Select connectivity result</option>
                  <option value="DISCONNECTED">DISCONNECTED</option>
                  <option value="CONNECTED">CONNECTED</option>
                </select>
              </label>
              <div className="report-form-actions">
                <button className="auth-submit" disabled={creating || !newVerification.outageId} type="submit">
                  {creating ? 'Saving check…' : 'Save observed check'}
                </button>
              </div>
            </form>
          )}
        </section>
      ) : (
        <p className="outage-related-empty">Sign in to record an observed service check. <Link to="/login">Sign in</Link></p>
      )}
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
                  <span>OUT-{String(entry.outageId).padStart(4, '0')} · {entry.componentName} · {entry.locationName}, {entry.region}</span>
                </div>
                <div className="verification-record-facts">
                  <div><small>AFFECTED SERVICES</small><span>{entry.serviceNames?.join(', ') || 'No impact service recorded'}</span></div>
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
