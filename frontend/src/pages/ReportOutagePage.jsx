import { AlertTriangle, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOutage, fetchComponents, fetchLocations, fetchServices } from '../services/api'

const NEW_OPTION = 'new'

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || 'The outage report could not be submitted.'
}

const initialValues = {
  locationId: '',
  locationName: '',
  region: '',
  componentId: NEW_OPTION,
  componentName: '',
  componentType: '',
  criticality: 'MEDIUM',
  severity: 'MEDIUM',
  cause: '',
  serviceId: '',
}

export default function ReportOutagePage() {
  const navigate = useNavigate()
  const [locations, setLocations] = useState([])
  const [components, setComponents] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [values, setValues] = useState(initialValues)

  useEffect(() => {
    let active = true
    Promise.all([fetchLocations(), fetchComponents(), fetchServices()])
      .then(([locationRows, componentRows, serviceRows]) => {
        if (active) {
          setLocations(locationRows)
          setComponents(componentRows)
          setServices(serviceRows)
        }
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const selectedLocation = locations.find(
    (location) => String(location.locationId) === values.locationId,
  )
  const locationComponents = useMemo(
    () => components.filter((component) => String(component.locationId) === values.locationId),
    [components, values.locationId],
  )
  const isNewLocation = values.locationId === NEW_OPTION
  const isNewComponent = isNewLocation || values.componentId === NEW_OPTION

  const handleChange = (event) => {
    setError('')
    const { name, value } = event.target
    setValues((current) => ({
      ...current,
      [name]: value,
      ...(name === 'locationId' ? { componentId: NEW_OPTION } : {}),
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const impacts = values.serviceId
        ? [{
            serviceId: Number(values.serviceId),
            impactLevel: values.severity,
            usersAffected: 0,
            description: values.cause.trim(),
          }]
        : []
      const newComponent = {
        componentName: values.componentName.trim(),
        componentType: values.componentType.trim(),
        criticality: values.criticality,
      }
      const locationAndComponent = isNewLocation
        ? {
            newLocation: {
              locationName: values.locationName.trim(),
              region: values.region.trim(),
            },
            newComponent,
          }
        : values.componentId === NEW_OPTION
          ? { locationId: Number(values.locationId), newComponent }
          : { locationId: Number(values.locationId), componentId: Number(values.componentId) }

      const outage = await createOutage({
        ...locationAndComponent,
        severity: values.severity,
        cause: values.cause.trim(),
        impacts,
      })
      navigate('/outages', { state: { createdOutage: outage } })
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="report-page">
      <section className="panel report-form-panel">
        <div className="panel-heading">
          <div><div className="eyebrow">INCIDENT INTAKE</div><h2>Report an internet outage</h2></div>
        </div>
        {error && <div className="inline-error" role="alert"><AlertTriangle size={15} /> {error}</div>}
        {loading ? (
          <div className="module-loading" role="status">Loading locations, components, and services...</div>
        ) : (
          <form className="report-form" onSubmit={handleSubmit}>
            <label>
              <span>Location</span>
              <select name="locationId" onChange={handleChange} required value={values.locationId}>
                <option value="">Select a location</option>
                {locations.map((location) => (
                  <option key={location.locationId} value={location.locationId}>
                    {location.locationName} · {location.region}
                  </option>
                ))}
                <option value={NEW_OPTION}>Add a new location</option>
              </select>
            </label>

            {isNewLocation && (
              <>
                <label>
                  <span>Location Name</span>
                  <input
                    autoComplete="organization"
                    maxLength={100}
                    name="locationName"
                    onChange={handleChange}
                    required
                    value={values.locationName}
                  />
                </label>
                <label>
                  <span>Region</span>
                  <input
                    maxLength={100}
                    name="region"
                    onChange={handleChange}
                    required
                    value={values.region}
                  />
                </label>
              </>
            )}

            {selectedLocation && locationComponents.length > 0 && (
              <label>
                <span>Network Component</span>
                <select name="componentId" onChange={handleChange} required value={values.componentId}>
                  <option value={NEW_OPTION}>Add a new component</option>
                  {locationComponents.map((component) => (
                    <option key={component.componentId} value={component.componentId}>
                      {component.componentName} · {component.componentType}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {isNewComponent && (
              <>
                <label>
                  <span>Component Name</span>
                  <input
                    maxLength={100}
                    name="componentName"
                    onChange={handleChange}
                    required
                    value={values.componentName}
                  />
                </label>
                <label>
                  <span>Component Type</span>
                  <input
                    maxLength={50}
                    name="componentType"
                    onChange={handleChange}
                    placeholder="For example, router or switch"
                    required
                    value={values.componentType}
                  />
                </label>
                <label>
                  <span>Component Criticality</span>
                  <select name="criticality" onChange={handleChange} required value={values.criticality}>
                    {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((criticality) => (
                      <option key={criticality}>{criticality}</option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <label>
              <span>Severity</span>
              <select name="severity" onChange={handleChange} required value={values.severity}>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((severity) => <option key={severity}>{severity}</option>)}
              </select>
            </label>

            <label>
              <span>Service Impact <small>Optional</small></span>
              <select disabled={loading} name="serviceId" onChange={handleChange} value={values.serviceId}>
                <option value="">No service impact recorded</option>
                {services.map((service) => (
                  <option key={service.serviceId} value={service.serviceId}>{service.serviceName}</option>
                ))}
              </select>
            </label>

            <label className="report-form-wide">
              <span>Cause or Symptoms</span>
              <textarea
                maxLength={255}
                name="cause"
                onChange={handleChange}
                placeholder="Describe the issue"
                rows={3}
                value={values.cause}
              />
            </label>

            <div className="report-form-actions">
              <button
                className="auth-submit"
                disabled={submitting || loading || !values.locationId}
                type="submit"
              >
                <Send size={15} /> {submitting ? 'Submitting...' : 'Submit Outage Report'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
