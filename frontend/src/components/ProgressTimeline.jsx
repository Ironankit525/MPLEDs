import Icon from './Icon'

const STAGE_ORDER = { PENDING_REVIEW: 0, IN_REVIEW: 1, APPROVED: 2, REJECTED: 2, SIGNED_OFF: 3 }

function formatDate(value) {
  if (!value) return null
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return null
  }
}

/**
 * Visual pipeline stage tracker for a submission's detail view.
 * Reflects the workflow `status` persisted on the ImageRecord
 * (app/models.py) — not a live push feed. There's no Reviewer role or
 * websocket/poll backend yet to move a record past PENDING_REVIEW, so
 * every submission today will show that as its current stage; the
 * later stages render now so the same component keeps working once
 * the Reviewer role starts writing IN_REVIEW/APPROVED/REJECTED.
 */
export default function ProgressTimeline({ status, uploadedAt }) {
  const stageIndex = STAGE_ORDER[status] ?? 0
  const isRejected = status === 'REJECTED'

  const steps = [
    {
      key: 'submitted',
      title: 'Submitted',
      description: formatDate(uploadedAt) || 'Upload received',
      complete: true,
      current: false,
    },
    {
      key: 'pending',
      title: 'Pending Review',
      description: 'Waiting for a verification officer to pick this up.',
      complete: stageIndex > 0,
      current: stageIndex === 0,
    },
    {
      key: 'in_review',
      title: 'In Review',
      description: 'A verification officer is checking the evidence.',
      complete: stageIndex > 1,
      current: stageIndex === 1,
    },
    {
      key: 'decision',
      title: isRejected ? 'Rejected' : 'Approved',
      description:
        stageIndex >= 2
          ? isRejected
            ? 'This submission was rejected. Check the notes on your submission for next steps.'
            : 'A verification officer approved this submission.'
          : 'Awaiting a final decision.',
      complete: stageIndex >= 2,
      current: false,
      rejected: stageIndex >= 2 && isRejected,
    },
  ]

  // A rejected submission has no sign-off step — there's nothing left
  // to release. An approved one continues to a Stakeholder's final
  // sign-off, which is what actually releases funds.
  if (!isRejected) {
    steps.push({
      key: 'signoff',
      title: 'Signed Off',
      description:
        stageIndex >= 3
          ? 'Final sign-off given — payment can be released.'
          : stageIndex === 2
            ? 'Awaiting final sign-off from the oversight authority.'
            : 'Awaiting a final decision first.',
      complete: stageIndex >= 3,
      current: stageIndex === 2,
    })
  }

  return (
    <div className="timeline">
      {steps.map((step, i) => (
        <div
          key={step.key}
          className={[
            'timeline-step',
            step.complete && !step.rejected ? 'is-complete' : '',
            step.current ? 'is-current' : '',
            step.rejected ? 'is-rejected' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="timeline-rail">
            <div className="timeline-dot">
              {step.rejected ? (
                <Icon name="x-circle" size={12} strokeWidth={2.4} />
              ) : step.complete ? (
                <Icon name="check" size={12} strokeWidth={2.6} />
              ) : (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
              )}
            </div>
            {i < steps.length - 1 && <div className="timeline-line" />}
          </div>
          <div className="timeline-content">
            <h4 className="!text-slate-900">{step.title}</h4>
            <p className="!text-slate-600">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
