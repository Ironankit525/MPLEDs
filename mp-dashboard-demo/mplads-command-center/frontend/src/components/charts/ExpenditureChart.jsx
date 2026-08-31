import React, { useState } from 'react';
import { formatCurrency } from '../../utils/formatCurrency.js';

export const ExpenditureChart = ({ data = [] }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data || data.length === 0) {
    return <p className="text-xs text-slate-400 italic p-4">No monthly expenditure data.</p>;
  }

  // Dimensions & Padding
  const width = 640;
  const height = 220;
  const padding = { top: 30, right: 30, bottom: 46, left: 72 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const rawMax = Math.max(...data.map(d => d.amount), 100000);
  // Round max to nice upper bound
  const maxVal = Math.ceil(rawMax / 250000) * 250000 || rawMax;

  // Calculate points
  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * plotWidth;
    const y = padding.top + plotHeight - (d.amount / maxVal) * plotHeight;
    return { x, y, ...d, index: i };
  });

  // Smooth cubic bezier path generator
  const getCurvedPath = (pts) => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  };

  const linePath = getCurvedPath(points);
  const baselineY = padding.top + plotHeight;
  const areaPath = points.length > 1
    ? `${linePath} L ${points[points.length - 1].x},${baselineY} L ${points[0].x},${baselineY} Z`
    : '';

  // Y-axis ticks (4 ticks: 0, 25%, 50%, 75%, 100%)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
    const val = maxVal * pct;
    const y = padding.top + plotHeight - pct * plotHeight;
    let label = '';
    if (val >= 10000000) {
      label = `₹${(val / 10000000).toFixed(1)}Cr`;
    } else if (val >= 100000) {
      label = `₹${(val / 100000).toFixed(0)}L`;
    } else if (val >= 1000) {
      label = `${(val / 1000).toFixed(0)}K`;
    } else {
      label = `${val}`;
    }
    return { val, y, label };
  });

  return (
    <div className="relative w-full overflow-hidden select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
      >
        <defs>
          {/* Dot Glow Filter */}
          <filter id="dotGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.2" />
          </filter>
        </defs>

        {/* Horizontal Gridlines & Y-Axis Labels */}
        {yTicks.map((tick, idx) => (
          <g key={idx}>
            <line
              x1={padding.left}
              y1={tick.y}
              x2={width - padding.right}
              y2={tick.y}
              stroke="#f1f5f9"
              strokeWidth="1.2"
              strokeDasharray={idx === 0 ? 'none' : '4 4'}
            />
            <text
              x={padding.left - 10}
              y={tick.y + 4}
              textAnchor="end"
              fontSize="9"
              fontWeight="500"
              fill="#64748b"
              fontFamily="Inter, ui-sans-serif, sans-serif"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* Smooth Curved Line in Black */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#0f172a"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Circular Dots on Data Points in Black */}
        {points.map((pt, idx) => {
          const isHovered = hoveredIdx === idx;
          return (
            <g
              key={idx}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Vertical guideline on hover */}
              {isHovered && (
                <line
                  x1={pt.x}
                  y1={padding.top}
                  x2={pt.x}
                  y2={baselineY}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}

              {/* Outer halo for hover */}
              {isHovered && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="11"
                  fill="#0f172a"
                  fillOpacity="0.12"
                />
              )}

              {/* Data Point Dot */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 6.5 : 5}
                fill="#0f172a"
                stroke="#ffffff"
                strokeWidth="2.5"
                filter="url(#dotGlow)"
                className="transition-all duration-200"
              />

              {/* X-Axis Month Label */}
              <text
                x={pt.x}
                y={baselineY + 26}
                textAnchor="middle"
                fontSize="9"
                fontWeight="500"
                fill={isHovered ? '#0f172a' : '#475569'}
                fontFamily="Inter, ui-sans-serif, sans-serif"
              >
                {pt.month}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredIdx !== null && points[hoveredIdx] && (
        <div
          className="absolute z-20 bg-slate-900 text-white px-3 py-2 rounded-xl shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full transition-all duration-150 border border-slate-700"
          style={{
            left: `${(points[hoveredIdx].x / width) * 100}%`,
            top: `${(points[hoveredIdx].y / height) * 100}%`,
            marginTop: '-12px',
            fontFamily: 'Inter, ui-sans-serif, sans-serif',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.4 }}>
            {points[hoveredIdx].month}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', lineHeight: 1.5 }}>
            {formatCurrency(points[hoveredIdx].amount, true)}
          </div>
        </div>
      )}
    </div>
  );
};
