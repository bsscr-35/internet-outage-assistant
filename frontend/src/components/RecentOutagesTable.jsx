import { MapPin } from 'lucide-react'
import { SeverityBadge, StatusBadge } from './StatusBadge'

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatWallClock(value) {
  if (!value) return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value)
  if (!match) return value

  const [, year, month, day, hour, minute] = match
  const hourNumber = Number(hour)
  const displayHour = hourNumber % 12 || 12
  const period = hourNumber >= 12 ? 'PM' : 'AM'
  return `${months[Number(month) - 1]} ${Number(day)}, ${year} · ${displayHour}:${minute} ${period}`
}

export default function RecentOutagesTable({ outages }) {
  return (
    <section aria-labelledby="recent-outages-title" className="panel outages-panel">
      <div className="panel-heading table-panel-heading">
        <div>
          <div className="eyebrow">LIVE INCIDENT FEED</div>
          <h2 id="recent-outages-title">Recent outages</h2>
        </div>
        <span className="record-count">{outages.length} records</span>
      </div>
      {outages.length === 0 ? (
        <div className="table-empty">No outage records found.</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>INCIDENT</th>
                <th>COMPONENT / LOCATION</th>
                <th>SEVERITY</th>
                <th>DETECTED</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {outages.map((outage) => (
                <tr key={outage.outageId}>
                  <td>
                    <div className="incident-cell">
                      <span className={`incident-indicator incident-${outage.severity?.toLowerCase()}`} />
                      <span>
                        <strong>OUT-{String(outage.outageId).padStart(4, '0')}</strong>
                        <small>{outage.cause || 'Network incident'}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="component-cell">
                      <strong>{outage.componentName}</strong>
                      <span><MapPin size={12} />{outage.locationName} · {outage.region}</span>
                    </div>
                  </td>
                  <td><SeverityBadge severity={outage.severity} /></td>
                  <td className="date-cell">{formatWallClock(outage.detectedAt)}</td>
                  <td><StatusBadge status={outage.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="table-footer">
        <span>Showing latest incidents from your network</span>
        <span className="table-live"><span className="footer-live-dot" />Live data</span>
      </div>
    </section>
  )
}
