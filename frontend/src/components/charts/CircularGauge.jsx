import React from 'react'

/**
 * Radial / Circular Gauge for Risk Scores and Progress metrics
 */
export default function CircularGauge({
  value = 93,
  max = 100,
  size = 140,
  strokeWidth = 10,
  variant = 'risk', // 'risk' | 'progress' | 'utilization'
  label = 'Critical Risk',
  sublabel = '/100',
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percent = Math.min(Math.max(value / max, 0), 1)
  const strokeDashoffset = circumference - percent * circumference

  // Color selection based on variant & value
  let strokeColor = '#DC2626' // Red
  let trackColor = '#FEE2E2' // Light Red

  if (variant === 'risk') {
    if (value < 30) {
      strokeColor = '#10B981'
      trackColor = '#D1FAE5'
    } else if (value < 60) {
      strokeColor = '#F59E0B'
      trackColor = '#FEF3C7'
    } else {
      strokeColor = '#E11D48'
      trackColor = '#FFE4E6'
    }
  } else if (variant === 'utilization') {
    strokeColor = '#10B981'
    trackColor = '#E2E8F0'
  }

  return (
    <div className="circular-gauge-container" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="gauge-svg">
        {/* Background Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Active Stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="gauge-center-content">
        <div className="gauge-value-row">
          <span className="gauge-main-value" style={{ color: strokeColor }}>
            {value}
          </span>
          {sublabel && <span className="gauge-sublabel">{sublabel}</span>}
        </div>
        {label && <span className="gauge-status-text" style={{ color: strokeColor }}>{label}</span>}
      </div>
    </div>
  )
}
