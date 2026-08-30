import React, { useState } from 'react'

/**
 * Interactive Donut Chart with customizable segments and center metric
 */
export default function DonutChart({
  segments = [],
  size = 170,
  strokeWidth = 24,
  centerValue = '43%',
  centerLabel = 'Overall Progress',
  className = '',
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((sum, seg) => sum + (seg.value || 0), 0)

  let cumulativePercent = 0

  return (
    <div className={`donut-chart-wrap ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
        {/* Background track if empty */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#F1F5F9"
          strokeWidth={strokeWidth}
        />
        {/* Segments */}
        {segments.map((seg, idx) => {
          const segPercent = total > 0 ? seg.value / total : 0
          const strokeDashoffset = circumference - segPercent * circumference
          const rotationAngle = cumulativePercent * 360 - 90

          cumulativePercent += segPercent

          const isHovered = hoveredIdx === idx

          return (
            <circle
              key={seg.label || idx}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={`${circumference * segPercent} ${circumference}`}
              strokeDashoffset={0}
              transform={`rotate(${rotationAngle} ${size / 2} ${size / 2})`}
              className="donut-segment"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                transition: 'stroke-width 0.2s ease, filter 0.2s ease',
                filter: isHovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' : 'none',
                cursor: 'pointer',
              }}
            />
          )
        })}
      </svg>
      {/* Center Label */}
      <div className="donut-center-text">
        <span className="donut-center-val">{centerValue}</span>
        {centerLabel && <span className="donut-center-sub">{centerLabel}</span>}
      </div>
    </div>
  )
}
