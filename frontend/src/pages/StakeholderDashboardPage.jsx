import { useEffect, useMemo, useState } from 'react'
import { useOverview } from '../hooks/useOverview'
import { getAiSummary } from '../api/stakeholder'
import DailyVolumeChart from '../components/charts/DailyVolumeChart'
import StatusBreakdownChart from '../components/charts/StatusBreakdownChart'
import RiskBreakdownChart from '../components/charts/RiskBreakdownChart'
import ErrorBanner from '../components/ErrorBanner'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'

// The backend only returns days that had at least one submission
// (app/main.py's get_stakeholder_overview) — fill in the full 14-day
// window with zeros so the chart's x-axis represents real elapsed
// time, not just the days something happened to be uploaded.
function fillLastFourteenDays(dailyVolume) {
  const byDate = new Map((dailyVolume || []).map((d) => [d.date, d.count]))
  const days = []
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ date: key, count: byDate.get(key) || 0 })
  }
  return days
}

export default function StakeholderDashboardPage() {
  const { overview, loading, error, reload } = useOverview()
  const dailyVolume = useMemo(() => fillLastFourteenDays(overview?.daily_volume), [overview])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Processing volume, pipeline bottlenecks, and completion rate across every submission.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={reload} disabled={loading}>
          <Icon name="refresh" size={15} />
          Refresh
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && !overview && <Spinner label="Loading dashboard…" />}

      {overview && (
        <>
          <div className="stat-grid">
            <StatTile label="Total submissions" value={overview.total_submissions.toLocaleString()} />
            <StatTile label="Completion rate" value={`${overview.completion_rate}%`} sub="reached a final decision" />
            <StatTile
              label="Avg. time to decision"
              value={overview.avg_hours_to_decision != null ? `${overview.avg_hours_to_decision}h` : '—'}
              sub="submission to reviewer decision"
            />
            <StatTile
              label="High risk"
              value={(overview.by_risk_level?.HIGH || 0).toLocaleString()}
              sub="submissions scored HIGH"
            />
          </div>

          <AiSummaryCard reloadKey={overview} />

          <div className="chart-grid">
            <div className="chart-card">
              <DailyVolumeChart data={dailyVolume} />
            </div>
            <div className="stack" style={{ gap: 20 }}>
              <div className="chart-card">
                <StatusBreakdownChart byStatus={overview.by_status} />
              </div>
              <div className="chart-card">
                <RiskBreakdownChart byRiskLevel={overview.by_risk_level} />
              </div>
            </div>
          </div>

          {overview.top_flagged_districts.length > 0 && (
            <div className="chart-card" style={{ marginTop: 20 }}>
              <div className="chart-title">Districts with the most HIGH-risk submissions</div>
              <div className="viz-root">
                {overview.top_flagged_districts.map((d) => (
                  <div className="viz-funnel-row" key={d.district} style={{ gridTemplateColumns: '140px 1fr 40px' }}>
                    <span className="viz-funnel-label">{d.district}</span>
                    <div className="viz-funnel-track">
                      <div
                        className="viz-funnel-fill"
                        style={{
                          width: `${Math.max(4, (d.high_risk_count / overview.top_flagged_districts[0].high_risk_count) * 100)}%`,
                          background: 'var(--viz-status-critical)',
                        }}
                      />
                    </div>
                    <span className="viz-funnel-value">{d.high_risk_count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Narrative version of the figures above, drafted server-side by an LLM
// (GET /api/stakeholder/ai-summary). The backend answers available:false
// when the feature is unconfigured or generation failed, and this card
// renders nothing in that case — the dashboard must never look broken
// because an optional third-party API is down. Refetches whenever the
// overview object changes (i.e. on load and on Refresh); the backend
// caches by a hash of the figures, so unchanged data costs no API call.
function AiSummaryCard({ reloadKey }) {
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    let cancelled = false
    getAiSummary()
      .then((res) => {
        if (!cancelled) setSummary(res.available ? res : null)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  if (!summary) return null

  return (
    <div className="chart-card" style={{ marginBottom: 20 }}>
      <div className="chart-title">Summary</div>
      {summary.summary.split(/\n{2,}/).map((paragraph, i) => (
        <p key={i} style={{ margin: i === 0 ? '8px 0 0' : '10px 0 0', lineHeight: 1.6, maxWidth: '72ch' }}>
          {paragraph}
        </p>
      ))}
      <div className="stat-sub" style={{ marginTop: 12 }}>
        Drafted by {summary.model} from the figures on this page
        {summary.generated_at ? ` · ${new Date(summary.generated_at).toLocaleString()}` : ''}
      </div>
    </div>
  )
}

function StatTile({ label, value, sub }) {
  return (
    <div className="card stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}
