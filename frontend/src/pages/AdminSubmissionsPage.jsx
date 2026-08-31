import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecordList } from '../hooks/useRecordList.js'
import { getAdminSubmissions, bulkOverrideStatus } from '../api/admin.js'
import { ApiError } from '../api/client.js'
import StatusBadge from '../components/StatusBadge.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import Spinner from '../components/Spinner.jsx'
import Icon from '../components/Icon.jsx'
import { formatDate } from '../lib/format.js'

const STATUSES = ['PENDING_REVIEW', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SIGNED_OFF']

export default function AdminSubmissionsPage() {
  const { items, loading, error, reload } = useRecordList(getAdminSubmissions, 'Could not load submissions.')
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [bulkStatus, setBulkStatus] = useState('APPROVED')
  const [bulkNotes, setBulkNotes] = useState('')
  const [bulkError, setBulkError] = useState(null)
  const [applying, setApplying] = useState(false)

  const rows = useMemo(() => {
    if (!items) return []
    let out = items
    if (statusFilter) out = out.filter((r) => r.status === statusFilter)
    const q = query.trim().toLowerCase()
    if (q) {
      out = out.filter((r) =>
        [r.work_id, r.district, r.work_type, r.submitted_by_username, r.reviewed_by_username]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q)),
      )
    }
    return out
  }, [items, query, statusFilter])

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))))
  }

  const handleBulkApply = async () => {
    setBulkError(null)
    setApplying(true)
    try {
      await bulkOverrideStatus(Array.from(selected), bulkStatus, bulkNotes.trim())
      setSelected(new Set())
      setBulkNotes('')
      await reload()
    } catch (err) {
      setBulkError(err instanceof ApiError ? err.message : 'Could not apply the bulk override.')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>All Submissions</h1>
          <p>Every submission, every status — filter, search, and override in bulk.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={reload} disabled={loading}>
          <Icon name="refresh" size={15} />
          Refresh
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && !items && <Spinner label="Loading submissions…" />}

      {items && items.length === 0 && <EmptyState icon="inbox" title="No submissions yet" />}

      {items && items.length > 0 && (
        <>
          {selected.size > 0 && (
            <div className="bulk-action-bar">
              <strong>{selected.size} selected</strong>
              <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    Set to {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
              <input
                placeholder="Reason (optional)…"
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                style={{ minWidth: 200 }}
              />
              <button type="button" className="btn btn-primary" onClick={handleBulkApply} disabled={applying}>
                {applying ? 'Applying…' : 'Apply'}
              </button>
              <button type="button" className="btn btn-ghost" style={{ color: 'inherit' }} onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </div>
          )}
          {bulkError && <ErrorBanner message={bulkError} />}

          <div className="table-toolbar">
            <input
              className="input table-search"
              placeholder="Search work ID, district, officer…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select className="input" style={{ maxWidth: 200 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
              {rows.length} of {items.length}
            </span>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-check">
                    <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} />
                  </th>
                  <th>Work ID</th>
                  <th>District</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Submitted by</th>
                  <th>Reviewed by</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/app/admin/submissions/${r.id}`)}>
                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} />
                    </td>
                    <td className="cell-work-id">{r.work_id}</td>
                    <td>{r.district}</td>
                    <td>
                      <RiskBadge level={r.risk_level} score={r.risk_score} />
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>{r.submitted_by_username || '—'}</td>
                    <td>{r.reviewed_by_username || '—'}</td>
                    <td>{formatDate(r.uploaded_at, { dateStyle: 'medium' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
