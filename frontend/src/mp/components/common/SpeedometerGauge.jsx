import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';

export const SpeedometerGauge = ({ score = 4.8, maxScore = 5.0, label = "Empanelled Rating" }) => {
  const normalizedScore = Math.min(maxScore, Math.max(0, score));
  const targetRatio = normalizedScore / maxScore;

  const [animatedRatio, setAnimatedRatio] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    // Trigger smooth needle sweep animation on mount & when score changes
    const timer = setTimeout(() => {
      setAnimatedRatio(targetRatio);
    }, 120);

    // Counter animation for numerical display
    let startTimestamp = null;
    const duration = 1200; // ms

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(easedProgress * normalizedScore);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    const animFrame = window.requestAnimationFrame(step);

    return () => {
      clearTimeout(timer);
      window.cancelAnimationFrame(animFrame);
    };
  }, [score, targetRatio, normalizedScore]);

  // SVG Geometry Dimensions
  const width = 180;
  const height = 110;
  const cx = 90;
  const cy = 85;
  const r = 65;
  const arcLength = Math.PI * r; // ~204.2px
  const needleLength = r - 12;

  // Arc stroke dashoffset (sweeps from full offset to active ratio)
  const strokeDashoffset = arcLength * (1 - animatedRatio);

  // Needle angle in degrees: 0° is pointing left, 180° is pointing right
  const needleAngle = animatedRatio * 180;

  // Scale Ticks for 0 to 5
  const ticks = [0, 1, 2, 3, 4, 5].map((t) => {
    const tRatio = t / maxScore;
    const tAngle = Math.PI * (1 - tRatio);
    const innerR = r - 6;
    const outerR = r + 3;
    const labelR = r + 14;
    return {
      val: t,
      x1: cx + innerR * Math.cos(tAngle),
      y1: cy - innerR * Math.sin(tAngle),
      x2: cx + outerR * Math.cos(tAngle),
      y2: cy - outerR * Math.sin(tAngle),
      lx: cx + labelR * Math.cos(tAngle),
      ly: cy - labelR * Math.sin(tAngle),
    };
  });

  // Dynamic color coding based on score: Low (Red), Mid (Yellow), High (Green)
  const getScoreColorClass = (val) => {
    if (val < 2.5) return { text: 'text-red-600', star: 'fill-red-500 text-red-500' };
    if (val < 4.0) return { text: 'text-amber-600', star: 'fill-amber-500 text-amber-500' };
    return { text: 'text-emerald-600', star: 'fill-emerald-500 text-emerald-500' };
  };

  const scoreColors = getScoreColorClass(normalizedScore);

  return (
    <div className="flex flex-col items-center p-3 bg-slate-50 border border-slate-200/90 rounded-2xl shrink-0 shadow-xs hover:shadow-md transition-shadow">
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-44 h-auto select-none overflow-visible">
          <defs>
            {/* Speedometer Arc Gradient: Low (Red #ef4444) -> Mid (Yellow #eab308) -> High (Green #10b981) */}
            <linearGradient id="speedometerGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Background Track Arc */}
          <path
            d={`M ${cx - r},${cy} A ${r} ${r} 0 0 1 ${cx + r},${cy}`}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* Animated Active Gradient Progress Arc */}
          <path
            d={`M ${cx - r},${cy} A ${r} ${r} 0 0 1 ${cx + r},${cy}`}
            fill="none"
            stroke="url(#speedometerGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: 'stroke-dashoffset 1200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />

          {/* Scale Ticks */}
          {ticks.map((t) => (
            <g key={`gauge-tick-${t.val}`}>
              <line
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="#94a3b8"
                strokeWidth="1.5"
              />
              <text
                x={t.lx}
                y={t.ly + 3}
                textAnchor="middle"
                className="text-[8px] font-extrabold fill-slate-400"
              >
                {t.val}
              </text>
            </g>
          ))}

          {/* Animated Needle Pointer (Rotates around pivot cx, cy with bounce curve) */}
          <g
            style={{
              transform: `rotate(${needleAngle}deg)`,
              transformOrigin: `${cx}px ${cy}px`,
              transition: 'transform 1200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {/* Needle Line pointing Left at 0° */}
            <line
              x1={cx}
              y1={cy}
              x2={cx - needleLength}
              y2={cy}
              stroke="#0f172a"
              strokeWidth="3.5"
              strokeLinecap="round"
              className="drop-shadow-sm"
            />
            {/* Needle Tip Arrow Head */}
            <polygon
              points={`${cx - needleLength},${cy - 2.5} ${cx - needleLength - 4},${cy} ${cx - needleLength},${cy + 2.5}`}
              fill="#0f172a"
            />
          </g>

          {/* Center Hub Dot */}
          <circle cx={cx} cy={cy} r="6" fill="#0f172a" stroke="#ffffff" strokeWidth="2" />
        </svg>

        {/* Dynamic Animated Readout Overlay */}
        <div className="text-center -mt-3">
          <div className="flex items-center justify-center gap-1">
            <Star className={`w-3.5 h-3.5 ${scoreColors.star}`} />
            <span className={`text-base font-black ${scoreColors.text} leading-none`}>
              {displayScore.toFixed(1)} <span className="text-xs text-slate-400 font-bold">/ 5.0</span>
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mt-0.5">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
};
