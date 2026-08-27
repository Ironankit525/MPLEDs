// Ordinal ramp for the four in-sequence workflow stages (position in
// the ramp IS the meaning: earlier stage -> lighter blue), plus the
// reserved status-critical red for Rejected — a branch off the funnel,
// not a further step along it. See index.css's .viz-root block.
const FUNNEL_STAGES = [
  { key: 'PENDING_REVIEW', label: 'Pending Review', color: 'var(--viz-ordinal-1)' },
  { key: 'IN_REVIEW', label: 'In Review', color: 'var(--viz-ordinal-2)' },
  { key: 'APPROVED', label: 'Approved', color: 'var(--viz-ordinal-3)' },
  { key: 'SIGNED_OFF', label: 'Signed Off', color: 'var(--viz-ordinal-4)' },
]

export default function StatusBreakdownChart({ byStatus }) {
  const values = { ...byStatus }
  const max = Math.max(1, ...Object.values(values))

  return (
    <div className="viz-root">
      <div className="chart-title">Where submissions are sitting</div>
      <div>
        {FUNNEL_STAGES.map((stage) => (
          <FunnelRow key={stage.key} label={stage.label} count={values[stage.key] || 0} max={max} color={stage.color} />
        ))}
        <div style={{ borderTop: '1px dashed var(--color-border)', margin: '8px 0' }} />
        <FunnelRow label="Rejected" count={values.REJECTED || 0} max={max} color="var(--viz-status-critical)" />
      </div>
    </div>
  )
}

function FunnelRow({ label, count, max, color }) {
  const pct = Math.max(count > 0 ? 4 : 0, (count / max) * 100)
  return (
    <div className="viz-funnel-row">
      <span className="viz-funnel-label">{label}</span>
      <div className="viz-funnel-track">
        <div className="viz-funnel-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="viz-funnel-value">{count}</span>
    </div>
  )
}
