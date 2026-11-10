import { AlertTriangle, MapPin, Plus, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import useAutoRefresh from '../hooks/useAutoRefresh'
import useAuth from '../contexts/useAuth'
import { createLocation, fetchLocations } from '../services/api'

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || 'Unable to retrieve location information.'
}

export default function LocationsPage({ onRefreshState }) {
  const route = useLocation()
  const createdOutage = route.state?.createdOutage
  const { user } = useAuth()
  const [locations, setLocations] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ locationName: '', region: '' })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setLocations(await fetchLocations())
      return true
    } catch (requestError) {
      setError(getErrorMessage(requestError))
      return false
    } finally {
      setLoading(false)
    }
  }, [])
  const { refresh, lastSuccessfulAt } = useAutoRefresh(loadData)

  const handleCreateLocation = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const location = await createLocation(form)
      setSuccess(`${location.locationName} was added.`)
      setForm({ locationName: '', region: '' })
      setShowForm(false)
      await loadData()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    onRefreshState?.(refresh, loading, lastSuccessfulAt)
  }, [lastSuccessfulAt, loading, onRefreshState, refresh])

  if (loading && locations === null) {
    return <div className="module-loading panel" role="status"><RefreshCw className="spin" size={18} /> Loading location records…</div>
  }
  if (error && locations === null) {
    return (
      <div className="error-state" role="alert">
        <div className="error-icon"><AlertTriangle size={21} /></div>
        <div><h2>Couldn’t load location information</h2><p>{error}</p></div>
        <button className="refresh-button" onClick={refresh} type="button"><RefreshCw size={15} /> Try again</button>
      </div>
    )
  }

  return (
    <div className="locations-page">
      {error && <div className="inline-error" role="alert">{error}</div>}
      {success && <div className="inline-success" role="status">{success}</div>}
      {createdOutage && (
        <div className="inline-success" role="status">
          OUT-{String(createdOutage.outageId).padStart(4, '0')} was saved for {createdOutage.componentName} at {createdOutage.locationName}, {createdOutage.region}. Location totals below are refreshed from MySQL.{' '}
          <Link to="/outages">View outages</Link>
        </div>
      )}
      <div className="management-actions">
        {user ? (
          <button className="auth-submit" onClick={() => setShowForm((visible) => !visible)} type="button">
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? 'Cancel' : 'Add location'}
          </button>
        ) : (
          <Link className="management-sign-in" to="/login">Sign in to add a location</Link>
        )}
      </div>
      {showForm && (
        <form className="panel management-form" onSubmit={handleCreateLocation}>
          <label>
            <span>Location name</span>
            <input maxLength={100} onChange={(event) => setForm((current) => ({ ...current, locationName: event.target.value }))} required value={form.locationName} />
          </label>
          <label>
            <span>Region</span>
            <input maxLength={100} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))} required value={form.region} />
          </label>
          <button className="auth-submit" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save location'}</button>
        </form>
      )}
      <section className="locations-grid" aria-label="Outages by location">
        {locations.map((location) => (
          <article className="panel location-card" key={location.locationId}>
            <div className="location-card-heading">
              <span className="location-icon"><MapPin size={17} /></span>
              <div><h2>{location.locationName}</h2><span>{location.region}</span></div>
            </div>
            <div className="location-card-stats">
              <div><span>Total outages</span><strong>{location.outageCount}</strong></div>
              <div><span>Ongoing</span><strong className={location.ongoingOutages ? 'location-ongoing' : ''}>{location.ongoingOutages}</strong></div>
              <div><span>Affected users</span><strong>{Number(location.affectedUsers).toLocaleString()}</strong></div>
            </div>
          </article>
        ))}
      </section>
      <p className="dashboard-footnote">Location summaries are aggregated from the current MySQL outage and impact records.</p>
    </div>
  )
}
