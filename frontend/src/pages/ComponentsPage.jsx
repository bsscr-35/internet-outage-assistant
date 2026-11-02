import { AlertTriangle, MapPin, RefreshCw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SeverityBadge, StatusBadge } from '../components/StatusBadge'
import { fetchComponents } from '../services/api'
import useAutoRefresh from '../hooks/useAutoRefresh'

function getRequestErrorMessage(requestError) {
  const detail = requestError.response?.data?.message || requestError.message
  return `Unable to retrieve network component data from the backend. ${detail}`
}

export default function ComponentsPage({ onRefreshState }) {
  const navigate = useNavigate()
  const [components, setComponents] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [criticality, setCriticality] = useState('')
  const requestId = useRef(0)

  const loadData = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const result = await fetchComponents()
      if (requestId.current === currentRequest) setComponents(result)
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

  const types = useMemo(
    () => [...new Set((components || []).map((component) => component.componentType).filter(Boolean))].sort(),
    [components],
  )
  const statuses = useMemo(
    () => [...new Set((components || []).map((component) => component.status).filter(Boolean))].sort(),
    [components],
  )
  const criticalities = useMemo(
    () => [...new Set((components || []).map((component) => component.criticality).filter(Boolean))].sort(),
    [components],
  )
  const filteredComponents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return (components || []).filter((component) => {
      const matchesSearch = !query || [
        component.componentName,
        component.ipAddress,
        component.locationName,
      ].some((value) => String(value || '').toLocaleLowerCase().includes(query))
      return matchesSearch
        && (!type || component.componentType === type)
        && (!status || component.status === status)
        && (!criticality || component.criticality === criticality)
    })
  }, [components, search, type, status, criticality])
  const clearFilters = () => {
    setSearch('')
    setType('')
    setStatus('')
    setCriticality('')
  }

  if (loading && components === null) {
    return (
      <div aria-label="Loading network components" className="component-loading panel" role="status">
        <RefreshCw className="spin" size={18} />
        <span>Loading live network components…</span>
      </div>
    )
  }

  if (error && components === null) {
    return (
      <div className="error-state" role="alert">
        <div className="error-icon"><AlertTriangle size={21} /></div>
        <div>
          <h2>Couldn’t load network components</h2>
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
    <div className="component-page">
      {error && <div className="inline-error" role="alert">{error}</div>}
      <section aria-label="Network component search and filters" className="panel component-controls">
        <label className="component-search">
          <Search aria-hidden="true" size={17} />
          <span className="visually-hidden">Search component name, IP address or location</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, IP address or location"
            type="search"
            value={search}
          />
        </label>
        <label className="component-filter">
          <span>Type</span>
          <select onChange={(event) => setType(event.target.value)} value={type}>
            <option value="">All types</option>
            {types.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="component-filter">
          <span>Status</span>
          <select onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <label className="component-filter">
          <span>Criticality</span>
          <select onChange={(event) => setCriticality(event.target.value)} value={criticality}>
            <option value="">All levels</option>
            {criticalities.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <button
          className="outage-clear-filters"
          disabled={!search && !type && !status && !criticality}
          onClick={clearFilters}
          type="button"
        >
          Clear
        </button>
      </section>

      <section aria-labelledby="components-list-title" className="panel component-list-panel">
        <div className="panel-heading component-list-heading">
          <div>
            <div className="eyebrow">INFRASTRUCTURE INVENTORY</div>
            <h2 id="components-list-title">Network components</h2>
          </div>
          <span className="record-count">
            {filteredComponents.length}{components.length !== filteredComponents.length ? ` of ${components.length}` : ''} components
          </span>
        </div>

        {loading && (
          <div aria-live="polite" className="component-refreshing" role="status">
            <RefreshCw className="spin" size={14} /> Refreshing component records…
          </div>
        )}
        {!loading && filteredComponents.length === 0 && (
          <div className="component-empty">
            {components.length === 0
              ? 'No network components found.'
              : 'No components match these search and filter criteria.'}
          </div>
        )}
        {filteredComponents.length > 0 && (
          <div className="component-table-wrap">
            <table className="component-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>COMPONENT</th>
                  <th>TYPE</th>
                  <th>IP ADDRESS</th>
                  <th>STATUS</th>
                  <th>CRITICALITY</th>
                  <th>LOCATION</th>
                  <th><span className="visually-hidden">Details</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredComponents.map((component) => (
                  <tr
                    key={component.componentId}
                  >
                    <td>#{component.componentId}</td>
                    <td className="component-name-cell">{component.componentName}</td>
                    <td>{component.componentType}</td>
                    <td className="component-ip-cell">{component.ipAddress || '—'}</td>
                    <td><StatusBadge status={component.status} /></td>
                    <td><SeverityBadge severity={component.criticality} /></td>
                    <td>
                      <span className="component-location">
                        <MapPin size={12} /> {component.locationName}
                        <small>{component.region}</small>
                      </span>
                    </td>
                    <td>
                      <button
                        aria-label={`View details for ${component.componentName}`}
                        className="component-details-button"
                        onClick={() => navigate(`/components/${component.componentId}`, { state: { component } })}
                        type="button"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="dashboard-footnote">Component inventory is served live from your database.</div>
    </div>
  )
}
