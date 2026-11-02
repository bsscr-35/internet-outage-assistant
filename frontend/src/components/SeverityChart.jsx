import { useMemo } from 'react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

const severityColors = {
  CRITICAL: '#fb7185',
  HIGH: '#fb923c',
  MEDIUM: '#fbbf24',
  LOW: '#38bdf8',
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null

  return (
    <div className="chart-tooltip">
      <span className="tooltip-dot" style={{ background: payload[0].payload.color }} />
      <span>{payload[0].name}</span>
      <strong>{payload[0].value}</strong>
      <small>outages</small>
    </div>
  )
}

export default function SeverityChart({ outages }) {
  const data = useMemo(() => {
    const counts = outages.reduce((result, outage) => {
      const severity = outage.severity?.toUpperCase() || 'UNKNOWN'
      result[severity] = (result[severity] || 0) + 1
      return result
    }, {})

    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        color: severityColors[name] || '#94a3b8',
      }))
      .sort((a, b) => b.value - a.value)
  }, [outages])

  const total = outages.length

  return (
    <section aria-labelledby="severity-title" className="panel severity-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">INCIDENT BREAKDOWN</div>
          <h2 id="severity-title">Outage severity</h2>
        </div>
        <span className="panel-period">All time</span>
      </div>
      {total === 0 ? (
        <div className="empty-chart">No outage records to display.</div>
      ) : (
        <div className="severity-content">
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={66}
                  outerRadius={88}
                  paddingAngle={4}
                  stroke="none"
                >
                  {data.map((entry) => (
                    <Cell fill={entry.color} key={entry.name} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <strong>{total}</strong>
              <span>Total events</span>
            </div>
          </div>
          <div className="severity-legend">
            {data.map((item) => (
              <div className="legend-row" key={item.name}>
                <span className="legend-label">
                  <span className="legend-dot" style={{ background: item.color }} />
                  {item.name.charAt(0) + item.name.slice(1).toLowerCase()}
                </span>
                <span className="legend-count">{item.value}</span>
                <span className="legend-percent">
                  {Math.round((item.value / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="chart-footer">
        <span className="footer-live-dot" />
        Distribution based on outage records
      </div>
    </section>
  )
}
