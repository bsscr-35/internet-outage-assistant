export default function StatCard({ title, value, note, icon: Icon, tone }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon stat-icon-${tone}`}>
        <Icon size={18} strokeWidth={1.9} />
      </div>
      <div className="stat-card-label">{title}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-card-foot">
        <span className="stat-note">{note}</span>
      </div>
      <div className={`stat-accent stat-accent-${tone}`} />
    </article>
  )
}
