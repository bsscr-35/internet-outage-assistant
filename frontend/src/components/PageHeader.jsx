import { Menu, RefreshCw } from 'lucide-react'

export default function PageHeader({
  title,
  subtitle,
  onRefresh,
  refreshing,
  onMenu,
  autoRefreshEnabled,
  lastSuccessfulAt,
}) {
  return (
    <header className="page-header">
      <div className="page-heading">
        <button
          aria-label="Open navigation"
          className="icon-button mobile-menu"
          onClick={onMenu}
          type="button"
        >
          <Menu size={20} />
        </button>
        <div>
          <div className="breadcrumb">Workspace <span>/</span> Operations</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="header-actions">
        {autoRefreshEnabled && (
          <div
            aria-label={`Automatic refresh enabled. Last successful refresh: ${lastSuccessfulAt
              ? lastSuccessfulAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
              : 'not yet'}`}
            className="auto-refresh-status"
            title="Data refreshes automatically every 30 seconds"
          >
            <span className="auto-refresh-dot" />
            <span>Auto refresh</span>
            <span className="auto-refresh-time">
              {lastSuccessfulAt
                ? `· ${lastSuccessfulAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : '· Waiting'}
            </span>
          </div>
        )}
        {onRefresh && (
          <button
            className="refresh-button"
            disabled={refreshing}
            onClick={onRefresh}
            type="button"
          >
            <RefreshCw className={refreshing ? 'spin' : ''} size={15} />
            <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
          </button>
        )}
        <div aria-label="Network operations user" className="user-avatar">SO</div>
      </div>
    </header>
  )
}
