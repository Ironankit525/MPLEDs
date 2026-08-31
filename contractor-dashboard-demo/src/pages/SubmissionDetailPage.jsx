import { Link, useParams } from 'react-router-dom'
import { useMySubmissions } from '../hooks/useMySubmissions.js'
import StatusBadge from '../components/StatusBadge.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import ProgressTimeline from '../components/ProgressTimeline.jsx'
import FlagList from '../components/FlagList.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import Spinner from '../components/Spinner.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import { isRemoteUrl, formatDate } from '../lib/format.js'
import { sanitizeFlagsForSubmitter } from '../lib/sanitizedFlags.js'

export default function SubmissionDetailPage() {
  const { id } = useParams()
  const { submissions, loading, error, reload } = useMySubmissions()

  const submission = submissions?.find((s) => s.id === id)

  return (
    <div className="min-h-screen  p-5">
      <Link
        to="/contractor/submissions"
        className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 no-underline shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
      >
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
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-bold !text-slate-900">{submission.work_id}</h1>
              <p className="mt-0.5 text-xs text-slate-500">
                {submission.work_type || 'Uncategorised'} · {submission.district}
                {submission.state ? `, ${submission.state}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge level={submission.risk_level} score={submission.risk_score} />
              <StatusBadge status={submission.status} />
            </div>
          </div>

          <div className="form-grid" style={{ alignItems: 'start', gridTemplateColumns: '1fr 1.4fr' }}>
            <div className="stack" style={{ gap: 20 }}>
              <div className="rounded-none border border-slate-200 bg-white p-5 shadow-sm">
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

              <div className="stack rounded-none border border-slate-200 bg-white p-5 shadow-sm" style={{ gap: 10 }}>
                <h3 className="text-sm font-bold uppercase tracking-wide !text-slate-900">Details</h3>
                <DetailRow label="Submitted" value={formatDate(submission.uploaded_at)} />
                <DetailRow label="MP" value={submission.mp_name || '—'} />
                <DetailRow label="Sanction date" value={formatDate(submission.sanction_date, { dateStyle: 'medium' })} />
                <DetailRow label="Recommendation" value={submission.recommendation || '—'} />
              </div>
            </div>

            <div className="stack" style={{ gap: 20 }}>
              <div className="rounded-none border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-wide !text-slate-900">Review progress</h3>
                <ProgressTimeline status={submission.status} uploadedAt={submission.uploaded_at} />
              </div>

              <div className="rounded-none border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-wide !text-slate-900">Automated findings</h3>
                <FlagList flags={sanitizeFlagsForSubmitter(submission.flags)} />
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
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-900">{value}</span>
    </div>
  )
}
