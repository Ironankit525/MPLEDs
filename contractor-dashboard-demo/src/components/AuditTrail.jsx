import Icon from './Icon.jsx'
import { formatDate } from '../lib/format.js'

/**
 * Who touched a submission and when — submitted, reviewed, signed off,
 * and (if it happened) an admin override — each rendered only if that
 * step actually happened, straight off the record's own attribution
 * fields. Shared by the Stakeholder and Admin detail views so the
 * story reads identically wherever it's shown.
 */
export default function AuditTrail({ record }) {
  return (
    <div className="stack" style={{ gap: 12 }}>
      <AuditRow icon="upload" actor={record.submitted_by_username || 'Unknown submitter'} action="Submitted" at={record.uploaded_at} />
      {record.reviewed_by_username && (
        <AuditRow
          icon="inbox"
          actor={record.reviewed_by_username}
          action={record.status === 'REJECTED' ? 'Rejected' : 'Reviewed · approved'}
          at={record.reviewed_at}
          note={record.reviewer_notes}
        />
      )}
      {record.signed_off_by_username && (
        <AuditRow icon="shield" actor={record.signed_off_by_username} action="Signed off" at={record.signed_off_at} note={record.signoff_notes} />
      )}
      {record.admin_override_by_username && (
        <AuditRow
          icon="settings"
          actor={record.admin_override_by_username}
          action={`Overrode status (${record.admin_override_previous_status} → ${record.status})`}
          at={record.admin_override_at}
          note={record.admin_override_notes}
        />
      )}
    </div>
  )
}

function AuditRow({ icon, actor, action, at, note }) {
  return (
    <div className="cluster" style={{ gap: 12, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'var(--color-surface-muted)',
          color: 'var(--color-ink-soft)',
          display: 'grid',
          placeItems: 'center',
          flex: 'none',
        }}
      >
        <Icon name={icon} size={14} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14 }}>
          <strong style={{ color: 'var(--color-ink)' }}>{actor}</strong>{' '}
          <span style={{ color: 'var(--color-muted)' }}>{action}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-muted-soft)' }}>{formatDate(at)}</div>
        {note && <div style={{ fontSize: 13, color: 'var(--color-ink-soft)', marginTop: 4 }}>{note}</div>}
      </div>
    </div>
  )
}
