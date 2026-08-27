import { useMemo, useState } from 'react'

const HEIGHT = 160
const MAX_BAR_WIDTH = 24
const GAP = 2

function formatDay(iso) {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

/**
 * Single-series column chart — submissions per day, last 14 days.
 * One hue (dataviz skill: single series needs no legend). Zero-count
 * days still render a hit column so they're reachable on hover/focus,
 * just with no visible fill above the baseline.
 */
export default function DailyVolumeChart({ data }) {
  const [hovered, setHovered] = useState(null)
  const [showTable, setShowTable] = useState(false)

  const max = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data])
  const n = data.length
  const barWidth = Math.min(MAX_BAR_WIDTH, 100 / n - GAP)

  return (
    <div className="viz-root">
      <div className="chart-title">Submissions per day (last 14 days)</div>
      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 100 ${HEIGHT}`}
          preserveAspectRatio="none"
          width="100%"
          height={HEIGHT}
          role="img"
          aria-label="Bar chart of submissions per day over the last 14 days"
        >
          {/* Baseline */}
          <line x1="0" y1={HEIGHT - 1} x2="100" y2={HEIGHT - 1} stroke="var(--viz-grid)" strokeWidth="1" />

          {data.map((d, i) => {
            const x = i * (100 / n) + (100 / n - barWidth) / 2
            const barHeight = d.count > 0 ? Math.max(2, (d.count / max) * (HEIGHT - 24)) : 0
            const y = HEIGHT - 1 - barHeight
            const isHovered = hovered === i
            return (
              <g
                key={d.date}
                tabIndex={0}
                role="button"
                aria-label={`${formatDay(d.date)}: ${d.count} submission${d.count === 1 ? '' : 's'}`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                style={{ cursor: 'pointer', outline: 'none' }}
              >
                {/* Full-height transparent hit target, bigger than the visible bar */}
                <rect x={x - 1} y={0} width={barWidth + 2} height={HEIGHT} fill="transparent" />
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={barWidth < 8 ? 2 : 4}
                  fill="var(--viz-series-1)"
                  opacity={isHovered ? 1 : 0.85}
                />
              </g>
            )
          })}
        </svg>

        {hovered !== null && (
          <div
            className="viz-bar-tooltip"
            style={{
              left: `${(hovered * (100 / n) + 100 / n / 2)}%`,
              top: HEIGHT - Math.max(2, (data[hovered].count / max) * (HEIGHT - 24)) - 10,
            }}
          >
            {formatDay(data[hovered].date)} · <span className="value">{data[hovered].count}</span>
          </div>
        )}
      </div>

      <button type="button" className="viz-table-toggle" onClick={() => setShowTable((v) => !v)}>
        {showTable ? 'Hide' : 'View'} as table
      </button>
      {showTable && (
        <table className="viz-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Submissions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date}>
                <td>{formatDay(d.date)}</td>
                <td>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
