import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Interactive SVG Dual-Line Trend Chart (Monthly vs Cumulative)
 */
export default function ExpenditureTrendChart() {
  const [filter, setFilter] = useState('Monthly')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [hoveredPoint, setHoveredPoint] = useState(null)

  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

  // Monthly values (in Lakhs, e.g. 0.4L, 1.2L...)
  const monthlyData = [0.4, 1.1, 1.8, 2.2, 2.5, 2.5, 2.6, 2.9, 3.1, 3.4, 3.7, 3.9]
  // Cumulative values (in Lakhs)
  const cumulativeData = [0.2, 0.7, 1.2, 1.5, 1.8, 2.0, 2.1, 2.3, 2.5, 2.7, 2.9, 3.1]

  const chartWidth = 520
  const chartHeight = 160
  const paddingLeft = 32
  const paddingRight = 18
  const paddingTop = 15
  const paddingBottom = 25

  const innerWidth = chartWidth - paddingLeft - paddingRight
  const innerHeight = chartHeight - paddingTop - paddingBottom
  const maxY = 4.5

  const getCoordinates = (data) => {
    return data.map((val, idx) => {
      const x = paddingLeft + (idx / (months.length - 1)) * innerWidth
      const y = paddingTop + innerHeight - (val / maxY) * innerHeight
      return { x, y, val, month: months[idx] }
    })
  }

  const monthlyPoints = getCoordinates(monthlyData)
  const cumulativePoints = getCoordinates(cumulativeData)

  // Construct smooth SVG cubic Bezier path
  const createSmoothPath = (points) => {
    if (!points.length) return ''
    return points.reduce((acc, point, i, arr) => {
      if (i === 0) return `M ${point.x},${point.y}`
      const prev = arr[i - 1]
      const cp1x = prev.x + (point.x - prev.x) / 2
      const cp1y = prev.y
      const cp2x = prev.x + (point.x - prev.x) / 2
      const cp2y = point.y
      return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${point.x},${point.y}`
    }, '')
  }

  const monthlyPath = createSmoothPath(monthlyPoints)
  const cumulativePath = createSmoothPath(cumulativePoints)

  return (
    <div className="expenditure-trend-card">
      <div className="trend-card-header">
        <div className="trend-legend-row">
          <div className="legend-item">
            <span className="legend-dot blue-dot"></span>
            <span className="legend-line blue-line"></span>
            <span className="legend-text">Expenditure</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot green-dot"></span>
            <span className="legend-line green-line"></span>
            <span className="legend-text">Cumulative</span>
          </div>
        </div>

        <div className="trend-filter-wrap">
          <button
            type="button"
            className="filter-toggle-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <span>{filter}</span>
            <ChevronDown size={12} />
          </button>
          {dropdownOpen && (
            <div className="filter-dropdown-menu">
              {['Monthly', 'Quarterly', 'Cumulative'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`filter-opt-btn ${opt === filter ? 'active' : ''}`}
                  onClick={() => {
                    setFilter(opt)
                    setDropdownOpen(false)
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="trend-svg-wrap">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="trend-chart-svg"
          preserveAspectRatio="none"
        >
          {/* Y-Axis Grid Lines & Labels */}
          {[4, 3, 2, 1, 0].map((level) => {
            const y = paddingTop + innerHeight - (level / maxY) * innerHeight
            return (
              <g key={level} className="grid-level-group">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="#F1F5F9"
                  strokeDasharray="3 3"
                />
                <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="axis-y-label">
                  {level > 0 ? `${level}L` : '0'}
                </text>
              </g>
            )
          })}

          {/* Area Fills */}
          <path
            d={`${monthlyPath} L ${monthlyPoints[monthlyPoints.length - 1].x},${paddingTop + innerHeight} L ${monthlyPoints[0].x},${paddingTop + innerHeight} Z`}
            fill="url(#blueAreaGradient)"
            opacity="0.12"
          />

          {/* Lines */}
          <path d={monthlyPath} fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" />
          <path d={cumulativePath} fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" />

          {/* Markers */}
          {monthlyPoints.map((pt, idx) => (
            <circle
              key={`m-${idx}`}
              cx={pt.x}
              cy={pt.y}
              r={hoveredPoint?.idx === idx && hoveredPoint?.series === 'monthly' ? 5 : 3}
              fill="#FFFFFF"
              stroke="#2563EB"
              strokeWidth="2"
              onMouseEnter={() => setHoveredPoint({ idx, series: 'monthly', ...pt })}
              onMouseLeave={() => setHoveredPoint(null)}
              style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
            />
          ))}

          {cumulativePoints.map((pt, idx) => (
            <circle
              key={`c-${idx}`}
              cx={pt.x}
              cy={pt.y}
              r={hoveredPoint?.idx === idx && hoveredPoint?.series === 'cumulative' ? 5 : 3}
              fill="#FFFFFF"
              stroke="#10B981"
              strokeWidth="2"
              onMouseEnter={() => setHoveredPoint({ idx, series: 'cumulative', ...pt })}
              onMouseLeave={() => setHoveredPoint(null)}
              style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
            />
          ))}

          {/* X-Axis Labels */}
          {monthlyPoints.map((pt) => (
            <text
              key={pt.month}
              x={pt.x}
              y={chartHeight - 6}
              textAnchor="middle"
              className="axis-x-label"
            >
              {pt.month}
            </text>
          ))}

          {/* Gradients */}
          <defs>
            <linearGradient id="blueAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div
            className="chart-hover-tooltip"
            style={{
              left: `${(hoveredPoint.x / chartWidth) * 100}%`,
              top: `${(hoveredPoint.y / chartHeight) * 100}%`,
            }}
          >
            <div className="tooltip-title">{hoveredPoint.month}</div>
            <div className="tooltip-value">
              {hoveredPoint.series === 'monthly' ? 'Expenditure: ' : 'Cumulative: '}
              <strong>₹ {hoveredPoint.val.toFixed(2)} Lakhs</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
