import { AlertTriangle, Activity, RefreshCw, Search, ShieldAlert, Users } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { SeverityBadge } from '../components/StatusBadge'
import StatCard from '../components/StatCard'
import {
  createOutageImpact,
  fetchImpacts,
  fetchOutages,
  fetchServices,
} from '../services/api'
import useAutoRefresh from '../hooks/useAutoRefresh'
import useAuth from '../contexts/useAuth'

const numberFormatter = new Intl.NumberFormat('en-US')
const levelTones = {
  CRITICAL: 'red',
  HIGH: 'orange',
  MEDIUM: 'blue',
  LOW: 'green',
}

function getRequestErrorMessage(requestError, operation = 'retrieve impact data') {
  const detail = requestError.response?.data?.message || requestError.message
  return `Unable to ${operation}. ${detail}`
}

export default function ImpactsPage({ onRefreshState }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const location = useLocation()
  const returnState = location.state?.restoreListState
  const [impacts, setImpacts] = useState(null)
  const [outages, setOutages] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createError, setCreateError] = useState('')
  const [createNotice, setCreateNotice] = useState('')
  const [creating, setCreating] = useState(false)
  const [newImpact, setNewImpact] = useState({
    outageId: '',
    serviceId: '',
    impactLevel: 'MEDIUM',
    usersAffected: '0',
    description: '',
  })
  const [search, setSearch] = useState(returnState?.search || '')
  const [impactLevel, setImpactLevel] = useState(returnState?.impactLevel || '')
  const requestId = useRef(0)
  const restoredScroll = useRef(false)
  const creatingRef = useRef(false)

  const loadData = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const [result, outageRows, serviceRows] = await Promise.all([
        fetchImpacts(),
        fetchOutages(),
        fetchServices(),
      ])
      if (requestId.current === currentRequest) {
        setImpacts(result)
        setOutages(outageRows)
        setServices(serviceRows)
        setNewImpact((current) => ({
          ...current,
          outageId: outageRows.some((outage) => String(outage.outageId) === current.outageId)
            ? current.outageId
            : String(outageRows.find((outage) => Number(outage.outageId) === 9)?.outageId ?? outageRows[0]?.outageId ?? ''),
          serviceId: serviceRows.some((service) => String(service.serviceId) === current.serviceId)
            ? current.serviceId
            : '',
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

  const handleCreateImpact = async (event) => {
    event.preventDefault()
    if (creatingRef.current || !user) return

    creatingRef.current = true
    setCreating(true)
    setCreateError('')
    setCreateNotice('')
    try {
      const impact = await createOutageImpact(newImpact.outageId, {
        serviceId: Number(newImpact.serviceId),
        impactLevel: newImpact.impactLevel,
        usersAffected: Number(newImpact.usersAffected),
        description: newImpact.description.trim(),
      })
      setCreateNotice(`Impact #${impact.impactId} was saved to MySQL.`)
      setNewImpact((current) => ({ ...current, serviceId: '', description: '' }))
      await refresh()
    } catch (requestError) {
      setCreateError(getRequestErrorMessage(requestError, 'save impact'))
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }

  useEffect(() => {
    onRefreshState?.(refresh, loading, lastSuccessfulAt)
  }, [lastSuccessfulAt, loading, onRefreshState, refresh])

  useLayoutEffect(() => {
    if (!loading && !restoredScroll.current && returnState) {
      window.scrollTo(0, returnState.scrollY || 0)
      restoredScroll.current = true
    }
  }, [loading, returnState])

  const levels = useMemo(
    () => [...new Set((impacts || []).map((impact) => impact.impactLevel).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right)),
    [impacts],
  )
  const levelSummaries = useMemo(() => {
    const counts = (impacts || []).reduce((summary, impact) => {
      const level = impact.impactLevel || 'UNKNOWN'
      summary[level] = (summary[level] || 0) + 1
      return summary
    }, {})
    if (!Object.hasOwn(counts, 'CRITICAL')) counts.CRITICAL = 0
    return Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  }, [impacts])
  const totalAffectedUsers = useMemo(
    () => (impacts || []).reduce((total, impact) => total + (Number(impact.usersAffected) || 0), 0),
    [impacts],
  )
  const filteredImpacts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return (impacts || []).filter((impact) => {
      const matchesSearch = !query || [
        impact.outageId,
        impact.description,
      ].some((value) => String(value ?? '').toLocaleLowerCase().includes(query))
      return matchesSearch && (!impactLevel || impact.impactLevel === impactLevel)
    })
  }, [impacts, search, impactLevel])

  if (loading && impacts === null) {
    return (
      <div aria-label="Loading impact records" className="impact-loading panel" role="status">
        <RefreshCw className="spin" size={18} />
        <span>Loading live impact records…</span>
      </div>
    )
  }

  if (error && impacts === null) {
    return (
      <div className="error-state" role="alert">
        <div className="error-icon"><AlertTriangle size={21} /></div>
        <div>
          <h2>Couldn’t load impact records</h2>
          <p>{error}</p>
          <span>Check that the backend is running and VITE_API_BASE_URL is correct.</span>
        </div>
        <button className="refresh-button" onClick={refresh} type="button">
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    )
  }

  const summaryCards = [
    {
      title: 'Impact records',
      value: numberFormatter.format(impacts.length),
      note: 'Database records',
      icon: Activity,
      tone: 'blue',
    },
    {
      title: 'Affected users',
      value: numberFormatter.format(totalAffectedUsers),
      note: 'Sum across impact records',
      icon: Users,
      tone: 'purple',
    },
    ...levelSummaries.map(([level, count]) => ({
      title: `${level} impacts`,
      value: numberFormatter.format(count),
      note: 'Records at this level',
      icon: level === 'CRITICAL' ? ShieldAlert : Activity,
      tone: levelTones[level] || 'blue',
    })),
  ]

  return (
    <div className="impact-page">
      {error && <div className="inline-error" role="alert">{error}</div>}
      {user ? (
        <section aria-labelledby="create-impact-title" className="panel report-form-panel">
          <div className="panel-heading">
            <div><div className="eyebrow">INCIDENT SERVICE IMPACT</div><h2 id="create-impact-title">Record an outage impact</h2></div>
          </div>
          <p className="report-form-intro">Record an observed impact against an existing outage and service. Duplicate outage/service entries are rejected.</p>
          {createError && <div className="inline-error" role="alert">{createError}</div>}
          {createNotice && <div className="inline-success" role="status">{createNotice}</div>}
          <form className="report-form" onSubmit={handleCreateImpact}>
            <label>
              <span>Outage</span>
              <select name="outageId" onChange={(event) => setNewImpact((current) => ({ ...current, outageId: event.target.value }))} required value={newImpact.outageId}>
                <option value="">Select an outage</option>
                {outages.map((outage) => (
                  <option key={outage.outageId} value={outage.outageId}>
                    OUT-{String(outage.outageId).padStart(4, '0')} · {outage.componentName} · {outage.locationName} · {outage.status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Affected service</span>
              <select name="serviceId" onChange={(event) => setNewImpact((current) => ({ ...current, serviceId: event.target.value }))} required value={newImpact.serviceId}>
                <option value="">Select a service</option>
                {services.map((service) => <option key={service.serviceId} value={service.serviceId}>{service.serviceName}</option>)}
              </select>
            </label>
            <label>
              <span>Impact level</span>
              <select name="impactLevel" onChange={(event) => setNewImpact((current) => ({ ...current, impactLevel: event.target.value }))} value={newImpact.impactLevel}>
                {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((level) => <option key={level}>{level}</option>)}
              </select>
            </label>
            <label>
              <span>Affected users</span>
              <input min="0" name="usersAffected" onChange={(event) => setNewImpact((current) => ({ ...current, usersAffected: event.target.value }))} required type="number" value={newImpact.usersAffected} />
            </label>
            <label className="report-form-wide">
              <span>Observed impact description</span>
              <textarea maxLength={255} name="description" onChange={(event) => setNewImpact((current) => ({ ...current, description: event.target.value }))} rows={2} value={newImpact.description} />
            </label>
            <div className="report-form-actions">
              <button className="auth-submit" disabled={creating || outages.length === 0 || services.length === 0} type="submit">
                {creating ? 'Saving impact…' : 'Save impact'}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <p className="outage-related-empty">Sign in to record an impact for an existing outage. <Link to="/login">Sign in</Link></p>
      )}
      <section aria-label="Impact summaries" className="stats-grid impact-summary-grid">
        {summaryCards.map((card) => (
          <StatCard {...card} key={card.title} />
        ))}
      </section>

      <section aria-label="Impact search and filters" className="panel impact-controls">
        <label className="impact-search">
          <Search aria-hidden="true" size={17} />
          <span className="visually-hidden">Search by outage ID or description</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search outage ID or description"
            type="search"
            value={search}
          />
        </label>
        <label className="impact-filter">
          <span>Impact level</span>
          <select onChange={(event) => setImpactLevel(event.target.value)} value={impactLevel}>
            <option value="">All impact levels</option>
            {levels.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>
        <button
          className="outage-clear-filters"
          disabled={!search && !impactLevel}
          onClick={() => {
            setSearch('')
            setImpactLevel('')
          }}
          type="button"
        >
          Clear
        </button>
      </section>

      <div className="impact-layout">
        <section aria-labelledby="impact-records-title" className="panel impact-records-panel">
          <div className="panel-heading impact-records-heading">
            <div>
              <div className="eyebrow">SERVICE DISRUPTION</div>
              <h2 id="impact-records-title">Outage impacts</h2>
            </div>
            <span className="record-count">
              {filteredImpacts.length}{impacts.length !== filteredImpacts.length ? ` of ${impacts.length}` : ''} records
            </span>
          </div>

          {loading && (
            <div aria-live="polite" className="impact-refreshing" role="status">
              <RefreshCw className="spin" size={14} /> Refreshing impact records…
            </div>
          )}
          {!loading && filteredImpacts.length === 0 && (
            <div className="impact-empty">
              {impacts.length === 0
                ? 'No impact records found.'
                : 'No impact records match these search and filter criteria.'}
            </div>
          )}
          {filteredImpacts.length > 0 && (
            <div className="impact-record-list">
              {filteredImpacts.map((impact) => (
                <article
                  className={`impact-record ${impact.impactLevel === 'CRITICAL' ? 'impact-record-critical' : ''}`}
                  key={impact.impactId}
                >
                  <div className="impact-record-heading">
                    <span className="impact-record-id">IMPACT #{impact.impactId}</span>
                    <SeverityBadge severity={impact.impactLevel} />
                  </div>
                  <p>{impact.description || 'No description recorded.'}</p>
                  <div className="impact-record-meta">
                    <span>OUT-{String(impact.outageId).padStart(4, '0')} · {impact.componentName} · {impact.locationName}, {impact.region} · {impact.outageStatus}</span>
                    <span>{impact.serviceName || 'Service name not configured'}</span>
                    <span>{numberFormatter.format(Number(impact.usersAffected) || 0)} users affected</span>
                  </div>
                  <button
                    className="impact-details-button"
                    onClick={() => navigate(`/impacts/${impact.impactId}`, {
                      state: {
                        impact,
                        returnState: {
                          search,
                          impactLevel,
                          scrollY: window.scrollY,
                        },
                      },
                    })}
                    type="button"
                  >
                    View details
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      <div className="dashboard-footnote">Impact records and summary metrics are served live from your database.</div>
    </div>
  )
}
