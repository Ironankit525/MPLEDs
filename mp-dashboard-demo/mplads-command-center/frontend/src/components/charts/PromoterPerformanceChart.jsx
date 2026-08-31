import React, { useState } from 'react';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { TrendingUp, Activity, DollarSign, Award } from 'lucide-react';

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

const PROMOTER_PALETTE = [
  { stroke: '#2563eb', fill: '#dbeafe', label: 'Indigo/Blue' }, // Apex Infra / CON001
  { stroke: '#16a34a', fill: '#dcfce7', label: 'Emerald/Green' }, // Vanguard / CON002
  { stroke: '#d97706', fill: '#fef3c7', label: 'Amber/Yellow' }, // Sahyadri / CON003
  { stroke: '#9333ea', fill: '#f3e8ff', label: 'Purple' }, // Purvanchal / CON004
  { stroke: '#e11d48', fill: '#ffe4e6', label: 'Rose' }, // Eastern / CON005
];

// Helper to compute smooth cubic spline path
const getCubicSplinePath = (points) => {
  if (!points || points.length === 0) return '';
  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) / 2;
    const cp1y = p0.y;
    const cp2x = p0.x + (p1.x - p0.x) / 2;
    const cp2y = p1.y;
    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
  }
  return path;
};

// Helper for closed gradient area path
const getAreaPath = (points, bottomY) => {
  const linePath = getCubicSplinePath(points);
  if (!linePath) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x},${bottomY} L ${first.x},${bottomY} Z`;
};

export const PromoterPerformanceChart = ({ contractors = [], isGlobalScope = false }) => {
  const [metricMode, setMetricMode] = useState('progress'); // 'progress' | 'expenditure' | 'rating'
  const [hoveredPromoterId, setHoveredPromoterId] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null); // { promoter, point }

  if (!contractors || contractors.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 italic bg-slate-50 rounded-2xl border border-slate-200">
        No promoter performance data available for comparison.
      </div>
    );
  }

  // Consume promoter series and historical performance vectors directly from single source of truth
  const promoterSeries = contractors.map((c, index) => {
    const colorObj = PROMOTER_PALETTE[index % PROMOTER_PALETTE.length];
    const history = c.performanceHistory || [];

    const progressPoints = history.map((h) => h.progress ?? 0);
    const expenditurePoints = history.map((h) => h.expenditure ?? 0);
    const ratingPoints = history.map((h) => h.rating ?? 0);

    return {
      ...c,
      color: colorObj.stroke,
      fillColor: colorObj.fill,
      progressPoints,
      expenditurePoints,
      ratingPoints,
    };
  });

  // Determine Y-axis range based on metric mode
  let yMin = 0;
  let yMax = 100;
  let unitLabel = '%';

  if (metricMode === 'progress') {
    yMin = 0;
    yMax = 100;
    unitLabel = '% Progress';
  } else if (metricMode === 'expenditure') {
    const allExp = promoterSeries.flatMap((s) => s.expenditurePoints);
    yMax = Math.max(...allExp, 10);
    yMin = 0;
    unitLabel = '₹ Lakhs';
  } else if (metricMode === 'rating') {
    yMin = 0;
    yMax = 5.0;
    unitLabel = 'Score / 5.0';
  }

  // Dimensions for SVG Canvas
  const width = 800;
  const height = 320;
  const paddingLeft = 55;
  const paddingRight = 55;
  const paddingTop = 35;
  const paddingBottom = 45;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Convert monthly data points to SVG coordinates
  const seriesWithCoords = promoterSeries.map((series) => {
    const values =
      metricMode === 'progress'
        ? series.progressPoints
        : metricMode === 'expenditure'
        ? series.expenditurePoints
        : series.ratingPoints;

    const coords = values.map((val, idx) => {
      const x = paddingLeft + (idx / (MONTHS.length - 1)) * chartWidth;
      const normalizedY = (val - yMin) / (yMax - yMin || 1);
      const y = paddingTop + chartHeight - normalizedY * chartHeight;
      return { x, y, val, month: MONTHS[idx], monthIdx: idx };
    });

    return {
      ...series,
      values,
      coords,
      splinePath: getCubicSplinePath(coords),
      areaPath: getAreaPath(coords, paddingTop + chartHeight),
    };
  });

  // Calculate ticks for Y-Axes
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount + 1 }).map((_, i) => {
    const val = yMin + (i / tickCount) * (yMax - yMin);
    const normalizedY = i / tickCount;
    const y = paddingTop + chartHeight - normalizedY * chartHeight;
    return { val: metricMode === 'expenditure' ? val.toFixed(0) : val.toFixed(metricMode === 'rating' ? 1 : 0), y };
  });

  // Lead series for gradient area background (first or hovered)
  const leadSeries =
    seriesWithCoords.find((s) => s.id === hoveredPromoterId) || seriesWithCoords[0];

  // Tooltip Box Positioning math (inside SVG space)
  let tooltipBoxX = 0;
  let tooltipBoxY = 0;
  if (hoveredNode) {
    const pt = hoveredNode.point;
    // Align X box position
    if (pt.x > width - 220) {
      tooltipBoxX = pt.x - 205;
    } else if (pt.x < 150) {
      tooltipBoxX = pt.x + 5;
    } else {
      tooltipBoxX = pt.x - 100;
    }

    // Align Y box position (above or below point)
    if (pt.y < paddingTop + 75) {
      tooltipBoxY = pt.y + 12; // place below
    } else {
      tooltipBoxY = pt.y - 68; // place above
    }
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-5">
      {/* Header Controls & View Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4.5 h-4.5 text-slate-900" />
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Promoter Performance & Comparative Analysis
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Multi-line comparative curves tracking civil promoters' work execution trajectories and quality scores over time.
          </p>
        </div>

        {/* Metric Selector Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
          <button
            onClick={() => {
              setMetricMode('progress');
              setHoveredNode(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              metricMode === 'progress'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Work Execution (% Progress)
            </span>
          </button>
          <button
            onClick={() => {
              setMetricMode('expenditure');
              setHoveredNode(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              metricMode === 'expenditure'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              Financial Expenditure (₹ Lakhs)
            </span>
          </button>
          <button
            onClick={() => {
              setMetricMode('rating');
              setHoveredNode(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              metricMode === 'rating'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              Quality Score (5.0 Max)
            </span>
          </button>
        </div>
      </div>

      {/* SVG Multi-Line Chart Canvas */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-white p-2 border border-slate-200">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          {/* Horizontal Background Grid Lines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={tick.y}
                x2={width - paddingRight}
                y2={tick.y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            </g>
          ))}

          {/* Left Y-Axis Scale Markers & Ticks */}
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={height - paddingBottom}
            stroke="#cbd5e1"
            strokeWidth={1.5}
          />
          {yTicks.map((tick, i) => (
            <g key={`left-tick-${i}`}>
              <line
                x1={paddingLeft - 4}
                y1={tick.y}
                x2={paddingLeft}
                y2={tick.y}
                stroke="#64748b"
                strokeWidth={2}
              />
              <rect
                x={paddingLeft - 42}
                y={tick.y - 8}
                width={32}
                height={16}
                rx={4}
                fill="#f1f5f9"
                stroke="#e2e8f0"
              />
              <text
                x={paddingLeft - 26}
                y={tick.y + 4}
                textAnchor="middle"
                className="text-[9px] font-bold fill-slate-900"
              >
                {tick.val}
              </text>
            </g>
          ))}

          {/* Right Y-Axis Scale Markers & Ticks */}
          <line
            x1={width - paddingRight}
            y1={paddingTop}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke="#cbd5e1"
            strokeWidth={1.5}
          />
          {yTicks.map((tick, i) => (
            <g key={`right-tick-${i}`}>
              <line
                x1={width - paddingRight}
                y1={tick.y}
                x2={width - paddingRight + 4}
                y2={tick.y}
                stroke="#64748b"
                strokeWidth={2}
              />
              <rect
                x={width - paddingRight + 10}
                y={tick.y - 8}
                width={32}
                height={16}
                rx={4}
                fill="#f1f5f9"
                stroke="#e2e8f0"
              />
              <text
                x={width - paddingRight + 26}
                y={tick.y + 4}
                textAnchor="middle"
                className="text-[9px] font-bold fill-slate-900"
              >
                {tick.val}
              </text>
            </g>
          ))}

          {/* X-Axis Line & Month Ticks */}
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke="#cbd5e1"
            strokeWidth={1.5}
          />
          {MONTHS.map((month, idx) => {
            const x = paddingLeft + (idx / (MONTHS.length - 1)) * chartWidth;
            return (
              <g key={`month-tick-${idx}`}>
                <line
                  x1={x}
                  y1={height - paddingBottom}
                  x2={x}
                  y2={height - paddingBottom + 5}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                />
                <rect
                  x={x - 18}
                  y={height - paddingBottom + 10}
                  width={36}
                  height={18}
                  rx={5}
                  fill="#f1f5f9"
                  stroke="#e2e8f0"
                />
                <text
                  x={x}
                  y={height - paddingBottom + 23}
                  textAnchor="middle"
                  className="text-[10px] font-extrabold fill-slate-900"
                >
                  {month}
                </text>
              </g>
            );
          })}

          {/* Vertical Crosshair Guideline when node is hovered */}
          {hoveredNode && (
            <line
              x1={hoveredNode.point.x}
              y1={paddingTop}
              x2={hoveredNode.point.x}
              y2={height - paddingBottom}
              stroke={hoveredNode.promoter.color}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              className="pointer-events-none transition-all duration-150"
            />
          )}

          {/* Multi-Line Curves */}
          {seriesWithCoords.map((series) => {
            const isHovered = hoveredPromoterId === series.id;
            const isAnyHovered = hoveredPromoterId !== null;
            const opacity = isAnyHovered ? (isHovered ? 1.0 : 0.25) : 0.9;
            const strokeWidth = isHovered ? 4 : 2.8;

            return (
              <g key={`line-group-${series.id}`} className="transition-opacity duration-300">
                {/* Smooth Spline Curve Path */}
                <path
                  d={series.splinePath}
                  fill="none"
                  stroke={series.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity }}
                  className="transition-all duration-300 shadow-sm"
                />

                {/* Data Points (Visible Circle + Wide Invisible Hit Target) */}
                {series.coords.map((pt, idx) => {
                  const isNodeHovered =
                    hoveredNode &&
                    hoveredNode.promoter.id === series.id &&
                    hoveredNode.point.monthIdx === idx;

                  return (
                    <g key={`node-${series.id}-${idx}`}>
                      {/* Visible Node Circle */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isNodeHovered ? 7.5 : isHovered ? 5.5 : 4.5}
                        fill={isNodeHovered ? '#ffffff' : series.color}
                        stroke={isNodeHovered ? series.color : '#ffffff'}
                        strokeWidth={isNodeHovered ? 3.5 : 2.5}
                        style={{ opacity }}
                        className="pointer-events-none transition-all duration-150"
                      />

                      {/* Wide Invisible Hit Target Overlay (r=16) for rock-solid hover stability */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={16}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => {
                          setHoveredPromoterId(series.id);
                          setHoveredNode({ promoter: series, point: pt });
                        }}
                        onMouseLeave={() => {
                          setHoveredPromoterId(null);
                          setHoveredNode(null);
                        }}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Native SVG Tooltip Callout Box (Guaranteed 100% pixel-perfect alignment) */}
          {hoveredNode && (
            <g
              transform={`translate(${tooltipBoxX}, ${tooltipBoxY})`}
              className="pointer-events-none transition-all duration-150"
            >
              {/* Tooltip Background Card */}
              <rect
                x="0"
                y="0"
                width="200"
                height="56"
                rx="10"
                fill="#0f172a"
                stroke="#334155"
                strokeWidth="1.5"
                className="shadow-xl"
              />

              {/* Promoter Indicator Circle & Title */}
              <circle cx="16" cy="18" r="5" fill={hoveredNode.promoter.color} />
              <text
                x="28"
                y="22"
                fill="#f8fafc"
                fontSize="11"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                {hoveredNode.promoter.name.length > 22
                  ? `${hoveredNode.promoter.name.substring(0, 20)}...`
                  : hoveredNode.promoter.name}
              </text>

              {/* Month Label */}
              <text
                x="16"
                y="41"
                fill="#94a3b8"
                fontSize="10"
                fontWeight="500"
                fontFamily="sans-serif"
              >
                Month: <tspan fill="#ffffff" fontWeight="bold">{hoveredNode.point.month}</tspan>
              </text>

              {/* Exact Metric Value */}
              <text
                x="184"
                y="41"
                textAnchor="end"
                fill="#fbbf24"
                fontSize="11"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                {metricMode === 'progress' && `${hoveredNode.point.val}% Progress`}
                {metricMode === 'expenditure' && `₹${hoveredNode.point.val} L`}
                {metricMode === 'rating' && `${hoveredNode.point.val} / 5.0 ★`}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Interactive Bottom Legend Bar */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-slate-100">
        {seriesWithCoords.map((s) => {
          const isHovered = hoveredPromoterId === s.id;
          return (
            <button
              key={`legend-${s.id}`}
              onMouseEnter={() => setHoveredPromoterId(s.id)}
              onMouseLeave={() => setHoveredPromoterId(null)}
              onClick={() => setHoveredPromoterId(hoveredPromoterId === s.id ? null : s.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                isHovered
                  ? 'bg-slate-900 text-white border-slate-800 shadow-sm scale-105'
                  : 'bg-slate-50 text-slate-900 border-slate-200/90 hover:bg-slate-100'
              }`}
            >
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate max-w-[160px]">{s.name}</span>
              <span className="text-[10px] font-semibold opacity-70">
                ({metricMode === 'progress' ? `${s.mpAvgProgress}%` : `${s.rating}★`})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
