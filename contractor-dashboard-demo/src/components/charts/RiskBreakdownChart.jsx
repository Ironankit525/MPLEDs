import Icon from '../Icon.jsx'

// Risk levels are already a severity scale (LOW -> HIGH), so this
// reuses the fixed, reserved status palette rather than categorical
// hues — a status color never impersonates a series. MEDIUM's
// "warning" step is sub-3:1 on the light surface by design (see
// dataviz skill's palette.md); the icon + visible numeric label is
// the required mitigation, not optional decoration.
const LEVELS = [
  { key: 'LOW', label: 'Low', color: 'var(--viz-status-good)', icon: 'check' },
  { key: 'MEDIUM', label: 'Medium', color: 'var(--viz-status-warning)', icon: 'alert' },
  { key: 'HIGH', label: 'High', color: 'var(--viz-status-critical)', icon: 'x-circle' },
]

export default function RiskBreakdownChart({ byRiskLevel }) {
  const max = Math.max(1, ...Object.values(byRiskLevel || {}))

  return (
    <div className="viz-root">
      <div className="chart-title">Risk level breakdown</div>
      <div>
        {LEVELS.map((level) => {
          const count = byRiskLevel?.[level.key] || 0
          const pct = Math.max(count > 0 ? 4 : 0, (count / max) * 100)
          return (
            <div className="viz-funnel-row" key={level.key} style={{ gridTemplateColumns: '90px 1fr 40px' }}>
              <span className="viz-funnel-label cluster" style={{ gap: 6 }}>
                <Icon name={level.icon} size={13} style={{ color: level.color, flex: 'none' }} />
                {level.label}
              </span>
              <div className="viz-funnel-track">
                <div className="viz-funnel-fill" style={{ width: `${pct}%`, background: level.color }} />
              </div>
              <span className="viz-funnel-value">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
