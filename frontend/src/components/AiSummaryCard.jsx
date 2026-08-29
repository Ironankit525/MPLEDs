import { useEffect, useRef, useState } from 'react'

// Narrative version of a page's figures, drafted server-side by an LLM
// (the /ai-summary endpoint for each role — app/report_summary.py). The
// backend answers available:false when the feature is unconfigured or
// generation failed, and this card renders nothing in that case — a page
// must never look broken because an optional third-party API is down.
//
// Refetches whenever `reloadKey` changes (i.e. on load and on Refresh).
// The first load reads the server's cache (cheap) and renders nothing
// until it arrives. A Refresh click passes refresh=true so the backend
// re-reads the database and drafts anew — and while that happens the
// card stays in place showing a loading shimmer over where the text
// was, instead of vanishing and popping back.
export default function AiSummaryCard({ fetcher, reloadKey, style }) {
  const [summary, setSummary] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const isFirstLoad = useRef(true)

  useEffect(() => {
    let cancelled = false
    const forceRefresh = !isFirstLoad.current
    isFirstLoad.current = false
    if (forceRefresh) setRefreshing(true)
    fetcher(forceRefresh)
      .then((res) => {
        if (!cancelled) setSummary(res.available ? res : null)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, reloadKey])

  // Nothing on screen until the first summary arrives; afterwards the
  // card persists through refreshes (shimmering while a new draft is
  // written) and only disappears if the feature becomes unavailable.
  if (!summary && !refreshing) return null

  return (
    <div className="chart-card" style={style} aria-busy={refreshing}>
      <div className="chart-title">Summary</div>
      {refreshing ? (
        <div style={{ display: 'grid', gap: 10, marginTop: 10, maxWidth: '72ch' }}>
          <span className="shimmer-line" style={{ width: '96%' }} />
          <span className="shimmer-line" style={{ width: '88%' }} />
          <span className="shimmer-line" style={{ width: '92%' }} />
          <span className="shimmer-line" style={{ width: '60%' }} />
        </div>
      ) : (
        summary.summary.split(/\n{2,}/).map((paragraph, i) => (
          <p key={i} style={{ margin: i === 0 ? '8px 0 0' : '10px 0 0', lineHeight: 1.6, maxWidth: '72ch' }}>
            {paragraph}
          </p>
        ))
      )}
    </div>
  )
}
