import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = window.sessionStorage.getItem('outage-assistant-token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export async function fetchDashboardData() {
  const [statsResponse, outagesResponse] = await Promise.all([
    api.get('/dashboard/stats'),
    api.get('/outages'),
  ])

  return {
    stats: statsResponse.data.stats,
    outages: outagesResponse.data.outages,
  }
}

export async function registerUser(user) {
  const response = await api.post('/auth/register', user)
  return response.data
}

export async function loginUser(credentials) {
  const response = await api.post('/auth/login', credentials)
  return response.data
}

export async function fetchCurrentUser() {
  const response = await api.get('/auth/me')
  return response.data.user
}

export async function fetchOutages() {
  const response = await api.get('/outages')
  return response.data.outages
}

export async function createOutage(outage) {
  const response = await api.post('/outages', outage)
  return response.data.outage
}

export async function updateOutageStatus(outageId, status) {
  const response = await api.patch(`/outages/${outageId}/status`, { status })
  return response.data.outage
}

export async function fetchOutageDetails(outageId) {
  const response = await api.get(`/outages/${outageId}`)
  return response.data.outage
}

export async function fetchComponents() {
  const response = await api.get('/components')
  return response.data.components
}

export async function createComponent(component) {
  const response = await api.post('/components', component)
  return response.data.component
}

export async function fetchServices() {
  const response = await api.get('/services')
  return response.data.services
}

export async function fetchLocations() {
  const response = await api.get('/locations')
  return response.data.locations
}

export async function createLocation(location) {
  const response = await api.post('/locations', location)
  return response.data.location
}

export async function fetchImpacts() {
  const response = await api.get('/impacts')
  return response.data.impacts
}

export async function createOutageImpact(outageId, impact) {
  const response = await api.post(`/outages/${outageId}/impacts`, impact)
  return response.data.impact
}

export async function fetchRecoveryActions() {
  const response = await api.get('/recovery-actions')
  return response.data.actions
}

export async function fetchRecoveryActionsForOutage(outageId) {
  const response = await api.get(`/outages/${outageId}/recovery-actions`)
  return response.data.actions
}

export async function createRecoveryAction(action) {
  const response = await api.post('/recovery-actions', action)
  return response.data.action
}

export async function updateRecoveryActionStatus(actionId, update) {
  const response = await api.patch(`/recovery-actions/${actionId}/status`, update)
  return response.data.action
}

export async function fetchRecoveryLogs() {
  const response = await api.get('/recovery-logs')
  return response.data.logs
}

export async function fetchRecoveryStatusAudit() {
  const response = await api.get('/recovery-status-audit')
  return response.data.audit
}

export async function fetchServiceVerifications() {
  const response = await api.get('/service-verifications')
  return response.data.verifications
}

export async function createServiceVerification(verification) {
  const response = await api.post('/service-verifications', verification)
  return response.data.verification
}

export async function fetchReportSummary() {
  const response = await api.get('/reports/summary')
  return response.data
}
