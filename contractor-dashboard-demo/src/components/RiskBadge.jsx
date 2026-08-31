// Automated risk_level from app/risk_engine.py — LOW (0-29), MEDIUM
// (30-59), HIGH (60-100). This is a computed signal for a reviewer,
// not a decision — kept visually distinct from StatusBadge so the two
// axes (automated score vs. human workflow stage) never get conflated.
const LEVEL_CLASS = {
  LOW: '!border-emerald-200 !bg-emerald-50 !text-emerald-700',
  MEDIUM: '!border-amber-200 !bg-amber-50 !text-amber-700',
  HIGH: '!border-red-200 !bg-red-50 !text-red-700',
}

export default function RiskBadge({ level, score }) {
  if (!level) return null
  const className = LEVEL_CLASS[level] || '!border-slate-200 !bg-slate-50 !text-slate-700'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {level} RISK{typeof score === 'number' ? ` · ${score}` : ''}
    </span>
  )
}
