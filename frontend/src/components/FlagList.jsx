import Icon from './Icon'

const SEVERITY_ICON = { LOW: 'clock', MEDIUM: 'alert', HIGH: 'x-circle' }
const SEVERITY_CLASS = { LOW: 'badge-low', MEDIUM: 'badge-medium', HIGH: 'badge-high' }

/**
 * Renders the flags array persisted on an ImageRecord (a snapshot of
 * app/risk_engine.py's ScoredFlag list at submit time) — every flag
 * already carries its own human message and evidence, so this is a
 * straight render, no re-interpretation.
 */
export default function FlagList({ flags }) {
  if (!flags || flags.length === 0) {
    return (
      <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>
        No flags were raised on this submission.
      </p>
    )
  }

  return (
    <ul className="flag-list">
      {flags.map((flag, i) => (
        <li key={`${flag.code}-${i}`} className="flag-item">
          <span className={`badge ${SEVERITY_CLASS[flag.severity] || 'badge-pending'}`} style={{ flex: 'none' }}>
            <Icon name={SEVERITY_ICON[flag.severity] || 'alert'} size={12} strokeWidth={2.4} />
            {flag.severity}
          </span>
          <div className="flag-body">
            <div className="flag-code">{flag.code}</div>
            <div className="flag-message">{flag.message}</div>
            {typeof flag.points_added === 'number' && (
              <div className="flag-points">+{flag.points_added} risk points</div>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
