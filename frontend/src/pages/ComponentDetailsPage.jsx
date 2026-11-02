import { AlertTriangle, ArrowLeft, MapPin, Network, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { SeverityBadge, StatusBadge } from '../components/StatusBadge'
import { fetchComponents } from '../services/api'
import useAutoRefresh from '../hooks/useAutoRefresh'

function getRequestErrorMessage(requestError) {
  const detail = requestError.response?.data?.message || requestError.message
  return `Unable to retrieve network component data from the backend. ${detail}`
}

export default function ComponentDetailsPage({ onRefreshState }) {
  const { componentId } = useParams()
  const location = useLocation()
  const routeComponent = location.state?.component
  const initialComponent = String(routeComponent?.componentId) === componentId ? routeComponent : null
  const [component, setComponent] = useState(initialComponent)
  const [loading, setLoading] = useState(!initialComponent)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    if (!component) setLoading(true)
    setError('')
    try {
      const components = await fetchComponents()
      const result = components.find((item) => String(item.componentId) === componentId)
      if (!result) {
        setComponent(null)
        setError(`No network component with ID ${componentId} was found.`)
        return false
      }
      setComponent(result)
      return true
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError))
      return false
    } finally {
      setLoading(false)
    }
  }, [component, componentId])

  const { refresh, lastSuccessfulAt } = useAutoRefresh(loadData)

  useEffect(() => {
    onRefreshState?.(refresh, loading, lastSuccessfulAt)
  }, [lastSuccessfulAt, loading, onRefreshState, refresh])

  return (
    <div className="component-page">
      <Link className="component-back-button" to="/components">
        <ArrowLeft size={15} /> Back to components
      </Link>

      {loading && (
        <div aria-label="Loading component details" className="component-loading panel" role="status">
          <RefreshCw className="spin" size={18} />
          <span>Loading component details…</span>
        </div>
      )}

      {!loading && error && !component && (
        <div className="error-state" role="alert">
          <div className="error-icon"><AlertTriangle size={21} /></div>
          <div>
            <h2>Couldn’t load component details</h2>
            <p>{error}</p>
            <span>Check that the backend is running and VITE_API_BASE_URL is correct.</span>
          </div>
          <button className="refresh-button" onClick={refresh} type="button">
            <RefreshCw size={15} /> Try again
          </button>
        </div>
      )}

      {!loading && error && component && <div className="inline-error" role="alert">{error}</div>}
      {!loading && component && (
        <section aria-labelledby="component-details-title" className="panel component-detail-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">COMPONENT RECORD</div>
              <h2 id="component-details-title">Component details</h2>
            </div>
            <span className="record-count">ID #{component.componentId}</span>
          </div>
          <div className="component-detail-content">
            <div className="component-detail-identity">
              <div className="component-detail-icon"><Network size={20} /></div>
              <div>
                <span>COMPONENT #{component.componentId}</span>
                <h3>{component.componentName}</h3>
                <p>{component.componentType}</p>
              </div>
            </div>
            <dl className="component-facts">
              <div><dt>Component ID</dt><dd>{component.componentId}</dd></div>
              <div><dt>Component name</dt><dd>{component.componentName}</dd></div>
              <div><dt>Component type</dt><dd>{component.componentType}</dd></div>
              <div><dt>IP address</dt><dd>{component.ipAddress || 'Not recorded'}</dd></div>
              <div><dt>Operational status</dt><dd><StatusBadge status={component.status} /></dd></div>
              <div><dt>Criticality</dt><dd><SeverityBadge severity={component.criticality} /></dd></div>
              <div><dt>Location name</dt><dd><MapPin size={12} /> {component.locationName}</dd></div>
              <div><dt>Region</dt><dd>{component.region}</dd></div>
            </dl>
          </div>
        </section>
      )}
      <div className="dashboard-footnote">Component information is served live from your database.</div>
    </div>
  )
}
