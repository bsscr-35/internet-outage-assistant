import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { SeverityBadge } from '../components/StatusBadge'
import { fetchImpacts } from '../services/api'
import useAutoRefresh from '../hooks/useAutoRefresh'

const numberFormatter = new Intl.NumberFormat('en-US')

function getRequestErrorMessage(requestError) {
  const detail = requestError.response?.data?.message || requestError.message
  return `Unable to retrieve impact data from the backend. ${detail}`
}

export default function ImpactDetailsPage({ onRefreshState }) {
  const { impactId } = useParams()
  const location = useLocation()
  const routeImpact = location.state?.impact
  const initialImpact = String(routeImpact?.impactId) === impactId ? routeImpact : null
  const [impact, setImpact] = useState(initialImpact)
  const [loading, setLoading] = useState(!initialImpact)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    if (!impact) setLoading(true)
    setError('')
    try {
      const impacts = await fetchImpacts()
      const result = impacts.find((item) => String(item.impactId) === impactId)
      if (!result) {
        setImpact(null)
        setError(`No impact record with ID ${impactId} was found.`)
        return false
      }
      setImpact(result)
      return true
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
      return false
    } finally {
      setLoading(false)
    }
  }, [impact, impactId])

  const { refresh, lastSuccessfulAt } = useAutoRefresh(loadData)

  useEffect(() => {
    onRefreshState?.(refresh, loading, lastSuccessfulAt)
  }, [lastSuccessfulAt, loading, onRefreshState, refresh])

  return (
    <div className="impact-page">
      <Link
        className="component-back-button"
        state={location.state?.returnState ? { restoreListState: location.state.returnState } : undefined}
        to="/impacts"
      >
        <ArrowLeft size={15} /> Back to impact analysis
      </Link>

      {loading && (
        <div aria-label="Loading impact details" className="impact-loading panel" role="status">
          <RefreshCw className="spin" size={18} />
          <span>Loading impact details…</span>
        </div>
      )}

      {!loading && error && !impact && (
        <div className="error-state" role="alert">
          <div className="error-icon"><AlertTriangle size={21} /></div>
          <div>
            <h2>Couldn’t load impact details</h2>
            <p>{error}</p>
            <span>Check that the backend is running and VITE_API_BASE_URL is correct.</span>
          </div>
          <button className="refresh-button" onClick={refresh} type="button">
            <RefreshCw size={15} /> Try again
          </button>
        </div>
      )}

      {!loading && error && impact && <div className="inline-error" role="alert">{error}</div>}
      {!loading && impact && (
        <section aria-labelledby="impact-detail-title" className="panel impact-detail-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">IMPACT RECORD</div>
              <h2 id="impact-detail-title">Impact details</h2>
            </div>
            <span className="record-count">ID #{impact.impactId}</span>
          </div>
          <div className={`impact-detail-content ${impact.impactLevel === 'CRITICAL' ? 'impact-detail-critical' : ''}`}>
            <div className="impact-detail-topline">
              <strong>IMPACT #{impact.impactId}</strong>
              <SeverityBadge severity={impact.impactLevel} />
            </div>
            <dl className="impact-facts">
              <div><dt>Impact ID</dt><dd>{impact.impactId}</dd></div>
              <div><dt>Outage ID</dt><dd>#{impact.outageId}</dd></div>
              <div><dt>Affected service</dt><dd>{impact.serviceName || 'Service name not configured'}</dd></div>
              <div><dt>Impact level</dt><dd><SeverityBadge severity={impact.impactLevel} /></dd></div>
              <div><dt>Users affected</dt><dd>{numberFormatter.format(Number(impact.usersAffected) || 0)}</dd></div>
            </dl>
            <div className="impact-description">
              <h3>Description</h3>
              <p>{impact.description || 'No description recorded.'}</p>
            </div>
          </div>
        </section>
      )}
      <div className="dashboard-footnote">Impact information is served live from your database.</div>
    </div>
  )
}
