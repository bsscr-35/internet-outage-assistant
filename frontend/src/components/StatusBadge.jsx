export function SeverityBadge({ severity }) {
  const value = severity?.toLowerCase() || 'unknown'
  return <span className={`badge severity-badge badge-${value}`}>{severity || 'Unknown'}</span>
}

export function StatusBadge({ status }) {
  const value = status?.toLowerCase().replaceAll('_', '-') || 'unknown'
  return <span className={`badge status-badge badge-${value}`}>{status?.replaceAll('_', ' ') || 'Unknown'}</span>
}
