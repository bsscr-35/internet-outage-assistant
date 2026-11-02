import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 10000,
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

export async function fetchOutages() {
  const response = await api.get('/outages')
  return response.data.outages
}

export async function fetchOutageDetails(outageId) {
  const response = await api.get(`/outages/${outageId}`)
  return response.data.outage
}

export async function fetchComponents() {
  const response = await api.get('/components')
  return response.data.components
}

export async function fetchImpacts() {
  const response = await api.get('/impacts')
  return response.data.impacts
}

export async function fetchRecoveryActions() {
  const response = await api.get('/recovery-actions')
  return response.data.actions
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

export async function fetchReportSummary() {
  const response = await api.get('/reports/summary')
  return response.data
}
