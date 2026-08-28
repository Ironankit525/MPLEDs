import { useEffect, useRef, useState } from 'react'

// Narrative version of a page's figures, drafted server-side by an LLM
// (the /ai-summary endpoint for each role — app/report_summary.py). The
// backend answers available:false when the feature is unconfigured or
// generation failed, and this card renders nothing in that case — a page
// must never look broken because an optional third-party API is down.
// Refetches whenever `reloadKey` changes (i.e. on load and on Refresh).
// The first load reads the server's cache (cheap); a Refresh click
// resets the card and passes refresh=true so the backend drafts anew
// instead of returning the cached text.
export default function AiSummaryCard({ fetcher, reloadKey, style }) {
  const [summary, setSummary] = useState(null)
  const isFirstLoad = useRef(true)

  useEffect(() => {
    let cancelled = false
    const forceRefresh = !isFirstLoad.current
    isFirstLoad.current = false
    if (forceRefresh) setSummary(null)
    fetcher(forceRefresh)
      .then((res) => {
        if (!cancelled) setSummary(res.available ? res : null)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, reloadKey])

  if (!summary) return null

  return (
    <div className="chart-card" style={style}>
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
