import { AlertTriangle, Activity, RefreshCw, Search, ShieldAlert, Users } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SeverityBadge } from '../components/StatusBadge'
import StatCard from '../components/StatCard'
import { fetchImpacts } from '../services/api'
import useAutoRefresh from '../hooks/useAutoRefresh'

const numberFormatter = new Intl.NumberFormat('en-US')
const levelTones = {
  CRITICAL: 'red',
  HIGH: 'orange',
  MEDIUM: 'blue',
  LOW: 'green',
}

function getRequestErrorMessage(requestError) {
  const detail = requestError.response?.data?.message || requestError.message
  return `Unable to retrieve impact data from the backend. ${detail}`
}

export default function ImpactsPage({ onRefreshState }) {
  const navigate = useNavigate()
  const location = useLocation()
  const returnState = location.state?.restoreListState
  const [impacts, setImpacts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState(returnState?.search || '')
  const [impactLevel, setImpactLevel] = useState(returnState?.impactLevel || '')
  const requestId = useRef(0)
  const restoredScroll = useRef(false)

  const loadData = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const result = await fetchImpacts()
      if (requestId.current === currentRequest) setImpacts(result)
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
                    <span>Outage #{impact.outageId}</span>
                    <span>Service #{impact.serviceId}</span>
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
