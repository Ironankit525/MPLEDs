import { Link } from 'react-router-dom'
import { useActivity } from '../hooks/useActivity'
import EmptyState from '../components/EmptyState'
import ErrorBanner from '../components/ErrorBanner'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import { formatDate } from '../lib/format'

const EVENT_CONFIG = {
  submitted: { icon: 'upload', verb: 'submitted' },
  approved: { icon: 'check', verb: 'approved' },
  rejected: { icon: 'x-circle', verb: 'rejected' },
  signed_off: { icon: 'shield', verb: 'signed off' },
  admin_override: { icon: 'settings', verb: 'manually overrode' },
}

export default function AdminActivityPage() {
  const { events, loading, error, reload } = useActivity()

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Activity</h1>
          <p>Who submitted, reviewed, signed off, or overrode a submission — most recent 50 events.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={reload} disabled={loading}>
          <Icon name="refresh" size={15} />
          Refresh
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && !events && <Spinner label="Loading activity…" />}
      {events && events.length === 0 && <EmptyState icon="history" title="No activity yet" />}

      {events && events.length > 0 && (
        <div className="card card-padded">
          <ul className="activity-list">
            {events.map((e, i) => {
              const config = EVENT_CONFIG[e.type] || { icon: 'clock', verb: e.type }
              return (
                <li key={`${e.image_id}-${e.type}-${i}`} className="activity-item">
                  <span className={`activity-icon type-${e.type}`}>
                    <Icon name={config.icon} size={14} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14 }}>
                      <strong style={{ color: 'var(--color-ink)' }}>{e.actor || 'Unknown'}</strong>{' '}
                      <span style={{ color: 'var(--color-muted)' }}>{config.verb}</span>{' '}
                      <Link to={`/contractor/admin/submissions/${e.image_id}`} style={{ fontWeight: 700 }}>
                        {e.work_id}
                      </Link>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted-soft)' }}>{formatDate(e.at)}</div>
                    {e.detail && <div style={{ fontSize: 13, color: 'var(--color-ink-soft)', marginTop: 2 }}>{e.detail}</div>}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
