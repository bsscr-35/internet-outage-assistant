import { AlertTriangle, Activity, RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SeverityBadge, StatusBadge } from '../components/StatusBadge'
import { fetchRecoveryActions, fetchRecoveryLogs, fetchRecoveryStatusAudit } from '../services/api'
import formatDatabaseDateTime from '../utils/formatDatabaseDateTime'
import useAutoRefresh from '../hooks/useAutoRefresh'

function getRequestErrorMessage(requestError) {
  const detail = requestError.response?.data?.message || requestError.message
  return `Unable to retrieve recovery data from the backend. ${detail}`
}

export default function RecoveryPage({ onRefreshState }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [selectedAction, setSelectedAction] = useState(null)
  const requestId = useRef(0)

  const loadData = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const [actions, logs, audit] = await Promise.all([
        fetchRecoveryActions(),
        fetchRecoveryLogs(),
        fetchRecoveryStatusAudit(),
      ])
      if (requestId.current === currentRequest) {
        setData({ actions, logs, audit })
        setSelectedAction((selected) => selected
          ? actions.find((action) => action.actionId === selected.actionId) || selected
          : selected)
      }
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

  const statuses = useMemo(
    () => [...new Set((data?.actions || []).map((action) => action.status).filter(Boolean))].sort(),
    [data],
  )
  const filteredActions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return (data?.actions || []).filter((action) => {
      const matchesSearch = !query || [
        action.actionId,
        action.outageId,
        action.actionType,
        action.description,
      ].some((value) => String(value ?? '').toLocaleLowerCase().includes(query))
      return matchesSearch && (!status || action.status === status)
    })
  }, [data, search, status])
  const selectedLogs = selectedAction
    ? (data?.logs || []).filter((log) => log.actionId === selectedAction.actionId)
    : []
  const selectedAudit = selectedAction
    ? (data?.audit || []).filter((entry) => entry.actionId === selectedAction.actionId)
    : []

  if (loading && data === null) {
    return (
      <div aria-label="Loading recovery actions" className="module-loading panel" role="status">
        <RefreshCw className="spin" size={18} />
        <span>Loading live recovery actions…</span>
      </div>
    )
  }

  if (error && data === null) {
    return (
      <div className="error-state" role="alert">
        <div className="error-icon"><AlertTriangle size={21} /></div>
        <div>
          <h2>Couldn’t load recovery actions</h2>
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
    <div className="operations-page">
      {error && <div className="inline-error" role="alert">{error}</div>}
      <section aria-label="Recovery action filters" className="panel operations-controls">
        <label className="operations-search">
          <span className="visually-hidden">Search recovery actions</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search action, outage ID or description"
            type="search"
            value={search}
          />
        </label>
        <label className="operations-filter">
          <span>Status</span>
          <select onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <button
          className="outage-clear-filters"
          disabled={!search && !status}
          onClick={() => {
            setSearch('')
            setStatus('')
          }}
          type="button"
        >
          Clear
        </button>
      </section>

      <div className="operations-layout">
        <section aria-labelledby="recovery-actions-title" className="panel operations-list-panel">
          <div className="panel-heading operations-list-heading">
            <div>
              <div className="eyebrow">RESPONSE WORKFLOW</div>
              <h2 id="recovery-actions-title">Recovery actions</h2>
            </div>
            <span className="record-count">{filteredActions.length} actions</span>
          </div>
          {loading && (
            <div className="module-refreshing" role="status">
              <RefreshCw className="spin" size={14} /> Refreshing recovery records…
            </div>
          )}
          {!loading && filteredActions.length === 0 && (
            <div className="module-empty">
              {data.actions.length === 0 ? 'No recovery actions found.' : 'No actions match these filters.'}
            </div>
          )}
          {filteredActions.length > 0 && (
            <div className="operations-record-list">
              {filteredActions.map((action) => (
                <article
                  className={`operations-record ${selectedAction?.actionId === action.actionId ? 'operations-record-selected' : ''}`}
                  key={action.actionId}
                >
                  <div className="operations-record-heading">
                    <span className="operations-record-id">ACTION #{action.actionId} · OUTAGE #{action.outageId}</span>
                    <StatusBadge status={action.status} />
                  </div>
                  <h3>{action.actionType}</h3>
                  <p>{action.description || 'No description recorded.'}</p>
                  <div className="operations-record-meta">
                    <SeverityBadge severity={action.priority} />
                    <span>Recommended {formatDatabaseDateTime(action.recommendedAt)}</span>
                  </div>
                  <button
                    aria-pressed={selectedAction?.actionId === action.actionId}
                    className="operations-details-button"
                    onClick={() => setSelectedAction(action)}
                    type="button"
                  >
                    {selectedAction?.actionId === action.actionId ? 'Viewing details' : 'View details'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="recovery-detail-title" className="panel operations-detail-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">ACTION RECORD</div>
              <h2 id="recovery-detail-title">Recovery details</h2>
            </div>
            {selectedAction && (
              <button aria-label="Clear selected action" className="icon-button" onClick={() => setSelectedAction(null)} type="button">
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
          {selectedAction ? (
            <>
              <div className="operations-detail-summary">
                <div className="operations-detail-topline">
                  <strong>{selectedAction.actionType}</strong>
                  <StatusBadge status={selectedAction.status} />
                </div>
                <p>{selectedAction.description || 'No description recorded.'}</p>
                <dl className="operations-facts">
                  <div><dt>Action ID</dt><dd>#{selectedAction.actionId}</dd></div>
                  <div><dt>Outage ID</dt><dd>#{selectedAction.outageId}</dd></div>
                  <div><dt>Priority</dt><dd><SeverityBadge severity={selectedAction.priority} /></dd></div>
                  <div><dt>Recommended</dt><dd>{formatDatabaseDateTime(selectedAction.recommendedAt)}</dd></div>
                </dl>
              </div>
              <div className="operations-related">
                <h3><Activity size={14} /> Execution logs <span>{selectedLogs.length}</span></h3>
                {selectedLogs.length === 0 ? (
                  <p className="operations-related-empty">No execution logs for this action.</p>
                ) : selectedLogs.map((log) => (
                  <div className="operations-related-record" key={log.recoveryId}>
                    <div className="operations-detail-topline">
                      <strong>RECOVERY #{log.recoveryId}</strong>
                      <StatusBadge status={log.status} />
                    </div>
                    <p>{log.remarks || 'No remarks recorded.'}</p>
                    <span>{log.assignedTo || 'Unassigned'} · Started {formatDatabaseDateTime(log.startedAt)}</span>
                  </div>
                ))}
              </div>
              <div className="operations-related">
                <h3><ShieldCheck size={14} /> Status history <span>{selectedAudit.length}</span></h3>
                {selectedAudit.length === 0 ? (
                  <p className="operations-related-empty">No status changes recorded.</p>
                ) : selectedAudit.map((entry) => (
                  <div className="operations-related-record" key={entry.auditId}>
                    <div className="operations-detail-topline">
                      <strong>{entry.oldStatus} → {entry.newStatus}</strong>
                      <span>{formatDatabaseDateTime(entry.changedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="operations-detail-empty">
              <div className="outage-detail-empty-icon"><Activity size={20} /></div>
              <h3>Select a recovery action</h3>
              <p>View its recommendation, execution logs and recorded status changes.</p>
            </div>
          )}
        </section>
      </div>
      <div className="dashboard-footnote">Recovery actions and execution history are read-only database records.</div>
    </div>
  )
}
