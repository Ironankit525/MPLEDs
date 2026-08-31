import Icon from './Icon.jsx'

// Workflow status (app/models.py's STATUS_* constants) — where the
// submission sits in the human review pipeline. Distinct from
// RiskBadge: this is who has looked at it, not how risky it scored.
const STATUS_CONFIG = {
  PENDING_REVIEW: { label: 'Pending Review', className: 'badge-pending', icon: 'clock' },
  IN_REVIEW: { label: 'In Review', className: 'badge-in_review', icon: 'inbox' },
  APPROVED: { label: 'Approved', className: 'badge-approved', icon: 'check' },
  REJECTED: { label: 'Rejected', className: 'badge-rejected', icon: 'x-circle' },
  SIGNED_OFF: { label: 'Signed Off', className: 'badge-signed_off', icon: 'shield' },
}

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || {
    label: status || 'Unknown',
    className: 'badge-pending',
    icon: 'clock',
  }
  return (
    <span className={`badge ${config.className}`}>
      <Icon name={config.icon} size={12} strokeWidth={2.4} />
      {config.label}
    </span>
  )
}

export { STATUS_CONFIG }
