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
import { sanitizeFlagsForSubmitter } from '../lib/sanitizedFlags'

const VERIFICATION_STATE = {
  VERIFIED: {
    title: 'Automated evidence checks completed',
    message: 'The available evidence passed the automated checks. Human workflow approval is still pending.',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: 'check',
  },
  REQUIRES_REVIEW: {
    title: 'This submission needs manual verification',
    message: 'One or more automated findings require a verification officer to inspect the original evidence.',
    className: 'border-red-200 bg-red-50 text-red-900',
    icon: 'alert',
  },
  INSUFFICIENT_EVIDENCE: {
    title: 'The evidence could not be fully verified',
    message: 'Required capture, location, or model evidence was unavailable. A low score is not proof of authenticity.',
    className: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: 'alert',
  },
}

const WORK_EVIDENCE_STATE = {
  VALID: ['Plausible project evidence', 'text-emerald-700'],
  REVIEW: ['Unclear — review required', 'text-amber-700'],
  INVALID: ['Not valid project evidence', 'text-red-700'],
  UNAVAILABLE: ['Model check unavailable', 'text-amber-700'],
  NOT_APPLICABLE: ['Not applicable', 'text-slate-500'],
}

function percentage(value) {
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—'
}

export default function SubmissionDetailPage() {
  const { id } = useParams()
  const { submissions, loading, error, reload } = useMySubmissions()
  const submission = submissions?.find((item) => item.id === id)

  return (
    <div className="min-h-full bg-[#f8fafc]">
      <Link
        to="/app/submissions"
        className="mb-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 no-underline shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
      >
        <Icon name="chevron-left" size={16} />
        Back to submissions
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

      {submission && <SubmissionContent submission={submission} />}
    </div>
  )
}

function SubmissionContent({ submission }) {
  const verification = VERIFICATION_STATE[submission.verification_status]
    || VERIFICATION_STATE.INSUFFICIENT_EVIDENCE
  const workEvidence = WORK_EVIDENCE_STATE[submission.work_evidence_status]
    || ['Not assessed for this older submission', 'text-slate-500']
  const flags = sanitizeFlagsForSubmitter(submission.flags)

  return (
    <div className="mx-auto max-w-[1380px]">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Submission evidence</p>
          <h1 className="text-2xl font-bold !text-slate-950">{submission.work_id}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {submission.work_type || 'Uncategorised'} · {submission.district}
            {submission.state ? `, ${submission.state}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge
            level={submission.risk_level}
            score={submission.risk_score}
            verificationStatus={submission.verification_status}
          />
          <StatusBadge status={submission.status} />
        </div>
      </header>

      <div className={`mb-5 flex items-start gap-3 rounded-xl border p-4 ${verification.className}`} role="status">
        <div className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-full bg-white/70">
          <Icon name={verification.icon} size={18} strokeWidth={2.4} />
        </div>
        <div>
          <h2 className="text-base font-bold !text-inherit">{verification.title}</h2>
          <p className="mt-1 text-sm opacity-80">{verification.message}</p>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {isRemoteUrl(submission.file_path) ? (
              <img
                src={submission.file_path}
                alt={`Submitted evidence for ${submission.work_id}`}
                className="max-h-[520px] w-full rounded-lg bg-slate-100 object-contain"
              />
            ) : (
              <div className="grid h-64 place-items-center rounded-lg bg-slate-100 text-slate-400">
                <div className="text-center">
                  <Icon name="image" size={30} />
                  <p className="mt-2 text-sm">Stored image preview unavailable</p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide !text-slate-900">Submission details</h2>
            <dl className="grid grid-cols-[minmax(110px,0.7fr)_minmax(0,1.3fr)] gap-x-4 gap-y-3 text-sm">
              <DetailRow label="Submitted" value={formatDate(submission.uploaded_at)} />
              <DetailRow label="Work type" value={submission.work_type || '—'} />
              <DetailRow label="District" value={[submission.district, submission.state].filter(Boolean).join(', ')} />
              <DetailRow label="MP" value={submission.mp_name || '—'} />
              <DetailRow label="Sanction date" value={formatDate(submission.sanction_date, { dateStyle: 'medium' })} />
            </dl>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommendation</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">
                {submission.recommendation || 'Manual review status is not available.'}
              </p>
            </div>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide !text-slate-900">Automated evidence checks</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <EvidenceCard
                label="Project-evidence validity"
                value={workEvidence[0]}
                valueClass={workEvidence[1]}
                detail={
                  typeof submission.work_evidence_probability === 'number'
                    ? `Confidence: ${percentage(submission.work_evidence_probability)}`
                    : 'No stored result for this check'
                }
              />
              <EvidenceCard
                label="Screen-capture check"
                value={
                  typeof submission.screen_probability === 'number'
                    ? `${percentage(submission.screen_probability)} screen probability`
                    : 'Unavailable'
                }
                valueClass={
                  submission.screen_probability >= 0.9
                    ? 'text-red-700'
                    : submission.screen_probability >= 0.7
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                }
                detail={submission.screen_model_name || 'Model name not stored'}
              />
              <EvidenceCard
                label="Capture date"
                value={
                  submission.photo_timestamp || submission.capture_timestamp
                    ? formatDate(submission.photo_timestamp || submission.capture_timestamp)
                    : 'Not available'
                }
                valueClass={submission.photo_timestamp || submission.capture_timestamp ? 'text-emerald-700' : 'text-amber-700'}
                detail={submission.photo_timestamp ? 'Read from the image file' : submission.capture_timestamp ? 'Reported by the capture flow' : 'Original date could not be confirmed'}
              />
              <EvidenceCard
                label="Location evidence"
                value={
                  (typeof submission.gps_latitude === 'number' && typeof submission.gps_longitude === 'number')
                    || (typeof submission.captured_latitude === 'number' && typeof submission.captured_longitude === 'number')
                    ? 'Location received'
                    : 'Not available'
                }
                valueClass={
                  typeof submission.gps_latitude === 'number' || typeof submission.captured_latitude === 'number'
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }
                detail={
                  typeof submission.gps_latitude === 'number'
                    ? 'Read from the image and compared with the claimed district'
                    : typeof submission.captured_latitude === 'number'
                      ? 'Reported by the device and compared with the claimed district'
                    : 'The project location could not be independently confirmed'
                }
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wide !text-slate-900">Automated findings</h2>
              <span className="text-xs font-semibold text-slate-500">
                {flags.length} {flags.length === 1 ? 'finding' : 'findings'}
              </span>
            </div>
            <FlagList flags={flags} />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide !text-slate-900">Human review progress</h2>
            <ProgressTimeline status={submission.status} uploadedAt={submission.uploaded_at} />
          </section>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="m-0 break-words text-right font-semibold text-slate-900">{value || '—'}</dd>
    </>
  )
}

function EvidenceCard({ label, value, detail, valueClass = 'text-slate-900' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-bold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  )
}
