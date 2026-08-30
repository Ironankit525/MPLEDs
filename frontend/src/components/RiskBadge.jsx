// Automated risk_level from app/risk_engine.py — LOW (0-29), MEDIUM
// (30-59), HIGH (60-100). This is a computed signal for a reviewer,
// not a decision — kept visually distinct from StatusBadge so the two
// axes (automated score vs. human workflow stage) never get conflated.
const LEVEL_CLASS = { LOW: 'badge-low', MEDIUM: 'badge-medium', HIGH: 'badge-high' }

export default function RiskBadge({ level, score }) {
  if (!level) return null
  const className = LEVEL_CLASS[level] || 'badge-pending'
  return (
    <span className={`badge ${className}`}>
      <span className="badge-dot" />
      {level} RISK{typeof score === 'number' ? ` · ${score}` : ''}
    </span>
  )
}
