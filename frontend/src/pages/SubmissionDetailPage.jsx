import { Link, useParams } from 'react-router-dom'
import { useMySubmissions } from '../hooks/useMySubmissions'
import StatusBadge from '../components/StatusBadge'
import RiskBadge from '../components/RiskBadge'
import ProgressTimeline from '../components/ProgressTimeline'
import FlagList from '../components/FlagList'
import ErrorBanner from '../components/ErrorBanner'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import Icon from '../components/Icon'
import { isRemoteUrl, formatDate } from '../lib/format'

export default function SubmissionDetailPage() {
  const { id } = useParams()
  const { submissions, loading, error, reload } = useMySubmissions()

  const submission = submissions?.find((s) => s.id === id)

  return (
    <div>
      <Link to="/app/submissions" className="cluster" style={{ gap: 6, marginBottom: 16, color: 'var(--color-muted)', fontSize: 14, textDecoration: 'none' }}>
        <Icon name="chevron-left" size={16} />
        Back to my submissions
      </Link>

      {loading && !submissions && <Spinner label="Loading submission…" />}
      {error && <ErrorBanner message={error} onRetry={reload} />}

      {submissions && !submission && (
        <EmptyState
          icon="x-circle"
          title="Submission not found"
          description="This submission doesn't exist, or doesn't belong to your account."
        />
      )}

      {submission && (
        <div>
          <div className="page-header">
            <div>
              <h1>{submission.work_id}</h1>
              <p>
                {submission.work_type || 'Uncategorised'} · {submission.district}
                {submission.state ? `, ${submission.state}` : ''}
              </p>
            </div>
            <div className="cluster" style={{ gap: 10 }}>
              <RiskBadge level={submission.risk_level} score={submission.risk_score} />
              <StatusBadge status={submission.status} />
            </div>
          </div>

          <div className="form-grid" style={{ alignItems: 'start', gridTemplateColumns: '1fr 1.4fr' }}>
            <div className="stack" style={{ gap: 20 }}>
              <div className="card card-padded">
                {isRemoteUrl(submission.file_path) ? (
                  <img
                    src={submission.file_path}
                    alt={`Submitted evidence for ${submission.work_id}`}
                    style={{ borderRadius: 10, width: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      height: 180,
                      background: 'var(--color-surface-muted)',
                      borderRadius: 10,
                      color: 'var(--color-muted)',
                    }}
                  >
                    <Icon name="image" size={28} />
                  </div>
                )}
              </div>

              <div className="card card-padded stack" style={{ gap: 10 }}>
                <h3>Details</h3>
                <DetailRow label="Submitted" value={formatDate(submission.uploaded_at)} />
                <DetailRow label="MP" value={submission.mp_name || '—'} />
                <DetailRow label="Sanction date" value={formatDate(submission.sanction_date, { dateStyle: 'medium' })} />
                <DetailRow label="Recommendation" value={submission.recommendation || '—'} />
              </div>
            </div>

            <div className="stack" style={{ gap: 20 }}>
              <div className="card card-padded">
                <h3 style={{ marginBottom: 16 }}>Review progress</h3>
                <ProgressTimeline status={submission.status} uploadedAt={submission.uploaded_at} />
              </div>

              <div className="card card-padded">
                <h3 style={{ marginBottom: 16 }}>Automated findings</h3>
                <FlagList flags={submission.flags} />
              </div>
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
