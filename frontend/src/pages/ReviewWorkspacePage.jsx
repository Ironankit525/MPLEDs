import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { claimReview, decideReview, getReviewHistory, getReviewQueue } from '../api/reviews'
import { ApiError } from '../api/client'
import RiskBadge from '../components/RiskBadge'
import StatusBadge from '../components/StatusBadge'
import FlagList from '../components/FlagList'
import ErrorBanner from '../components/ErrorBanner'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import Icon from '../components/Icon'
import { isRemoteUrl, formatDate } from '../lib/format'

/**
 * Loads exactly one submission for the split-screen workspace. There's
 * no GET-by-id endpoint (app/main.py deliberately doesn't have one for
 * reviews) — claim IS the read for anything still open, since it's
 * idempotent for the reviewer who already holds it. A 409 (someone
 * else has it) or 400 (already decided) falls back to scanning the
 * queue/history list for the same id, so this page still has
 * something to show in read-only mode.
 */
function useReviewItem(id) {
  const [state, setState] = useState({ phase: 'loading', record: null, message: null })

  const load = useCallback(async () => {
    setState({ phase: 'loading', record: null, message: null })
    try {
      const record = await claimReview(id)
      setState({ phase: 'active', record, message: null })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const queue = await getReviewQueue().catch(() => null)
        const record = queue?.images.find((i) => i.id === id) || null
        setState({ phase: 'locked', record, message: err.message })
        return
      }
      if (err instanceof ApiError && err.status === 400) {
        const history = await getReviewHistory().catch(() => null)
        const record = history?.images.find((i) => i.id === id) || null
        setState({ phase: 'decided', record, message: err.message })
        return
      }
      if (err instanceof ApiError && err.status === 404) {
        setState({ phase: 'not-found', record: null, message: null })
        return
      }
      setState({
        phase: 'error',
        record: null,
        message: err instanceof ApiError ? err.message : 'Could not load this submission.',
      })
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  return { ...state, reload: load }
}

export default function ReviewWorkspacePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { phase, record, message, reload } = useReviewItem(id)
  const [notes, setNotes] = useState('')
  const [decisionError, setDecisionError] = useState(null)
  const [deciding, setDeciding] = useState(null) // 'approve' | 'reject' | null

  const handleDecide = async (decision) => {
    if (decision === 'reject' && !notes.trim()) {
      setDecisionError('Add a note explaining the rejection before submitting it.')
      return
    }
    setDecisionError(null)
    setDeciding(decision)
    try {
      await decideReview(id, decision, notes.trim())
      navigate('/app/queue', { replace: true })
    } catch (err) {
      setDecisionError(err instanceof ApiError ? err.message : 'Could not record the decision.')
      setDeciding(null)
    }
  }

  return (
    <div>
      <Link
        to="/app/queue"
        className="cluster"
        style={{ gap: 6, marginBottom: 16, color: 'var(--color-muted)', fontSize: 14, textDecoration: 'none' }}
      >
        <Icon name="chevron-left" size={16} />
        Back to queue
      </Link>

      {phase === 'loading' && <Spinner label="Loading submission…" />}
      {phase === 'not-found' && (
        <EmptyState icon="x-circle" title="Submission not found" description="This submission doesn't exist." />
      )}
      {phase === 'error' && <ErrorBanner message={message} onRetry={reload} />}

      {record && (
        <div>
          {phase === 'locked' && (
            <div className="review-banner review-banner-locked">
              <Icon name="inbox" size={16} />
              {message || 'Someone else is already reviewing this submission.'}
            </div>
          )}
          {phase === 'decided' && (
            <div className="review-banner review-banner-decided">
              <Icon name="check" size={16} />
              Already decided by {record.reviewed_by_username || 'a reviewer'} on {formatDate(record.reviewed_at)}.
            </div>
          )}

          <div className="page-header">
            <div>
              <h1>{record.work_id}</h1>
              <p>
                {record.work_type || 'Uncategorised'} · {record.district} · submitted by{' '}
                {record.submitted_by_username || 'unknown'}
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

              <div className="card card-padded stack" style={{ gap: 10 }}>
                <h3>Submission details</h3>
                <DetailRow label="Submitted" value={formatDate(record.uploaded_at)} />
                <DetailRow label="State" value={record.state || '—'} />
                <DetailRow label="MP" value={record.mp_name || '—'} />
                <DetailRow label="Sanction date" value={formatDate(record.sanction_date, { dateStyle: 'medium' })} />
                <DetailRow label="Recommendation" value={record.recommendation || '—'} />
              </div>
            </div>

            <div className="card stack" style={{ gap: 0 }}>
              <div className="card-padded stack" style={{ gap: 16 }}>
                <h3>Automated findings</h3>
                <FlagList flags={record.flags} />

                <hr className="divider" style={{ margin: '4px 0' }} />

                <div className="field">
                  <label className="field-label" htmlFor="reviewer-notes">
                    Reviewer notes {phase === 'active' && <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>(required to reject)</span>}
                  </label>
                  {phase === 'active' ? (
                    <textarea
                      id="reviewer-notes"
                      className="notes-textarea"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="What did you check? Why are you approving or rejecting this?"
                    />
                  ) : (
                    <p style={{ fontSize: 14, color: 'var(--color-ink-soft)' }}>{record.reviewer_notes || '—'}</p>
                  )}
                </div>

                {decisionError && <ErrorBanner message={decisionError} />}
              </div>

              {phase === 'active' && (
                <div className="sticky-actions">
                  <button
                    type="button"
                    className="btn btn-approve"
                    style={{ flex: 1 }}
                    disabled={deciding !== null}
                    onClick={() => handleDecide('approve')}
                  >
                    <Icon name="check" size={16} />
                    {deciding === 'approve' ? 'Approving…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-reject"
                    style={{ flex: 1 }}
                    disabled={deciding !== null}
                    onClick={() => handleDecide('reject')}
                  >
                    <Icon name="x-circle" size={16} />
                    {deciding === 'reject' ? 'Rejecting…' : 'Reject'}
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

function DetailRow({ label, value }) {
  return (
    <div className="spread" style={{ fontSize: 14 }}>
      <span style={{ color: 'var(--color-muted)' }}>{label}</span>
      <span style={{ color: 'var(--color-ink)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
