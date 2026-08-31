import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRecordList } from '../hooks/useRecordList.js'
import { getStakeholderSubmissions, signOffSubmission } from '../api/stakeholder.js'
import { ApiError } from '../api/client.js'
import StatusBadge from '../components/StatusBadge.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import FlagList from '../components/FlagList.jsx'
import AuditTrail from '../components/AuditTrail.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import Spinner from '../components/Spinner.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import { isRemoteUrl } from '../lib/format.js'

/** The consolidated report: original document + reviewer's findings +
 * a full audit trail of who touched the file and when — submitted,
 * reviewed, and (if applicable) signed off. */
export default function StakeholderDetailPage() {
  const { id } = useParams()
  const { items, loading, error, reload } = useRecordList(
    getStakeholderSubmissions,
    'Could not load this submission.',
  )
  const [notes, setNotes] = useState('')
  const [signing, setSigning] = useState(false)
  const [signOffError, setSignOffError] = useState(null)

  const record = items?.find((r) => r.id === id)

  const handleSignOff = async () => {
    setSigning(true)
    setSignOffError(null)
    try {
      await signOffSubmission(id, notes.trim())
      await reload()
    } catch (err) {
      setSignOffError(err instanceof ApiError ? err.message : 'Could not record sign-off.')
    } finally {
      setSigning(false)
    }
  }

  return (
    <div>
      <Link
        to="/app/reports"
        className="cluster"
        style={{ gap: 6, marginBottom: 16, color: 'var(--color-muted)', fontSize: 14, textDecoration: 'none' }}
      >
        <Icon name="chevron-left" size={16} />
        Back to reports
      </Link>

      {loading && !items && <Spinner label="Loading submission…" />}
      {error && <ErrorBanner message={error} onRetry={reload} />}

      {items && !record && (
        <EmptyState
          icon="x-circle"
          title="Submission not found"
          description="This submission hasn't reached a final decision yet, or doesn't exist."
        />
      )}

      {record && (
        <div>
          <div className="page-header">
            <div>
              <h1>{record.work_id}</h1>
              <p>
                {record.work_type || 'Uncategorised'} · {record.district}
                {record.state ? `, ${record.state}` : ''}
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

              {record.status === 'APPROVED' && (
                <div className="card card-padded stack" style={{ gap: 12 }}>
                  <h3>Final sign-off</h3>
                  <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                    Confirms this submission is cleared for payment release.
                  </p>
                  <textarea
                    className="notes-textarea"
                    placeholder="Optional note…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  {signOffError && <ErrorBanner message={signOffError} />}
                  <button type="button" className="btn btn-approve" onClick={handleSignOff} disabled={signing}>
                    <Icon name="shield" size={16} />
                    {signing ? 'Signing off…' : 'Give final sign-off'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
