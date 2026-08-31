import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecordList } from '../hooks/useRecordList.js'
import { getStakeholderSubmissions } from '../api/stakeholder.js'
import StatusBadge from '../components/StatusBadge.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import Spinner from '../components/Spinner.jsx'
import Icon from '../components/Icon.jsx'
import { formatDate } from '../lib/format.js'

const COLUMNS = [
  { key: 'work_id', label: 'Work ID' },
  { key: 'district', label: 'District' },
  { key: 'risk_score', label: 'Risk' },
  { key: 'status', label: 'Status' },
  { key: 'uploaded_at', label: 'Submitted' },
  { key: 'reviewed_by_username', label: 'Reviewed by' },
]

export default function StakeholderReportsPage() {
  const { items, loading, error, reload } = useRecordList(
    getStakeholderSubmissions,
    'Could not load the report table.',
  )
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'uploaded_at', dir: 'desc' })

  const rows = useMemo(() => {
    if (!items) return []
    const q = query.trim().toLowerCase()
    const filtered = q
      ? items.filter((r) =>
          [r.work_id, r.district, r.work_type, r.submitted_by_username, r.reviewed_by_username]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(q)),
        )
      : items

    const sorted = [...filtered].sort((a, b) => {
      const av = a[sort.key] ?? ''
      const bv = b[sort.key] ?? ''
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [items, query, sort])

  const toggleSort = (key) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>Fully processed submissions — approved, rejected, or signed off.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={reload} disabled={loading}>
          <Icon name="refresh" size={15} />
          Refresh
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && !items && <Spinner label="Loading reports…" />}

      {items && items.length === 0 && (
        <EmptyState icon="history" title="Nothing processed yet" description="Fully decided submissions will show up here." />
      )}

      {items && items.length > 0 && (
        <>
          <div className="table-toolbar">
            <input
              className="input table-search"
              placeholder="Search work ID, district, officer…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
              {rows.length} of {items.length}
            </span>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th key={col.key} className="is-sortable" onClick={() => toggleSort(col.key)}>
                      {col.label}
                      {sort.key === col.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/app/report/${r.id}`)}>
                    <td className="cell-work-id">{r.work_id}</td>
                    <td>{r.district}</td>
                    <td>
                      <RiskBadge level={r.risk_level} score={r.risk_score} />
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>{formatDate(r.uploaded_at, { dateStyle: 'medium' })}</td>
                    <td>{r.reviewed_by_username || '—'}</td>
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
