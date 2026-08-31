import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRecordList } from '../hooks/useRecordList'
import { getAdminSubmissions, overrideStatus } from '../api/admin'
import { ApiError } from '../api/client'
import StatusBadge from '../components/StatusBadge'
import RiskBadge from '../components/RiskBadge'
import FlagList from '../components/FlagList'
import AuditTrail from '../components/AuditTrail'
import ErrorBanner from '../components/ErrorBanner'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import Icon from '../components/Icon'
import { isRemoteUrl } from '../lib/format'

const STATUSES = ['PENDING_REVIEW', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SIGNED_OFF']

export default function AdminSubmissionDetailPage() {
  const { id } = useParams()
  const { items, loading, error, reload } = useRecordList(getAdminSubmissions, 'Could not load this submission.')
  const record = items?.find((r) => r.id === id)

  const [overrideStatusValue, setOverrideStatusValue] = useState('')
  const [overrideNotes, setOverrideNotes] = useState('')
  const [applying, setApplying] = useState(false)
  const [overrideError, setOverrideError] = useState(null)

  const handleOverride = async () => {
    if (!overrideStatusValue) return
    setOverrideError(null)
    setApplying(true)
    try {
      await overrideStatus(id, overrideStatusValue, overrideNotes.trim())
      setOverrideNotes('')
      setOverrideStatusValue('')
      await reload()
    } catch (err) {
      setOverrideError(err instanceof ApiError ? err.message : 'Could not apply the override.')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div>
      <Link
        to="/contractor/admin/submissions"
        className="cluster"
        style={{ gap: 6, marginBottom: 16, color: 'var(--color-muted)', fontSize: 14, textDecoration: 'none' }}
      >
        <Icon name="chevron-left" size={16} />
        Back to all submissions
      </Link>

      {loading && !items && <Spinner label="Loading submission…" />}
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {items && !record && <EmptyState icon="x-circle" title="Submission not found" />}

      {record && (
        <div>
          <div className="page-header">
            <div>
              <h1>{record.work_id}</h1>
              <p>
                {record.work_type || 'Uncategorised'} · {record.district}
                {record.state ? `, ${record.state}` : ''} · submitted by {record.submitted_by_username || 'unknown'}
              </p>
            </div>
            <div className="cluster" style={{ gap: 10 }}>
              <RiskBadge level={record.risk_level} score={record.risk_score} />
              <StatusBadge status={record.status} />
            </div>
          </div>

          <div className="review-split">
            <div className="stack" style={{ gap: 20 }}>
              <div className="review-image-frame">
                {isRemoteUrl(record.file_path) ? (
                  <img src={record.file_path} alt={`Submitted evidence for ${record.work_id}`} />
                ) : (
                  <div className="review-image-placeholder">
                    <Icon name="image" size={28} />
                  </div>
                )}
              </div>

              <div className="card card-padded stack" style={{ gap: 16 }}>
                <h3>Automated findings</h3>
                <p style={{ fontSize: 14, color: 'var(--color-ink)' }}>{record.recommendation}</p>
                <FlagList flags={record.flags} />
              </div>
            </div>

            <div className="stack" style={{ gap: 20 }}>
              <div className="card card-padded stack" style={{ gap: 12 }}>
                <h3>Audit trail</h3>
                <AuditTrail record={record} />
              </div>

              <div className="card card-padded stack" style={{ gap: 12 }}>
                <h3>Manual override</h3>
                <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                  Sets status directly — for correcting a submission stuck mid-pipeline. Recorded as its own event,
                  not a substitute reviewer decision or sign-off.
                </p>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="field">
                    <label className="field-label" htmlFor="override-status">
                      New status
                    </label>
                    <select
                      id="override-status"
                      className="input"
                      value={overrideStatusValue}
                      onChange={(e) => setOverrideStatusValue(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {STATUSES.map((s) => (
                        <option key={s} value={s} disabled={s === record.status}>
                          {s.replace('_', ' ')}
                          {s === record.status ? ' (current)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <textarea
                  className="notes-textarea"
                  placeholder="Why is this being overridden?"
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                />
                {overrideError && <ErrorBanner message={overrideError} />}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleOverride}
                  disabled={applying || !overrideStatusValue}
                >
                  <Icon name="settings" size={16} />
                  {applying ? 'Applying…' : 'Apply override'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
