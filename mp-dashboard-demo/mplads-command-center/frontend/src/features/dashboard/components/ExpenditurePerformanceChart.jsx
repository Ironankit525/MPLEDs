import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { formatCurrency } from '../../../utils/formatCurrency';

export const ExpenditurePerformanceChart = ({ performance, financialYear }) => {
  const [activeMonth, setActiveMonth] = useState(null);

  if (!performance || !performance.months) return null;

  const { months } = performance;
  const maxVal = Math.max(...months.map((m) => Math.max(m.planned, m.actual)), 10000000);

  return (
    <Card
      title="Expenditure Performance"
      subtitle={`Planned vs Actual disbursements — FY ${financialYear}`}
    >
      {/* Custom Bar Comparison Chart */}
      <div className="pt-6">
        <div className="h-56 flex items-end gap-2 sm:gap-4 justify-between px-2">
          {months.map((m, idx) => {
            const plannedHeight = (m.planned / maxVal) * 100;
            const actualHeight = (m.actual / maxVal) * 100;
            const isProjected = m.month.includes('Proj');
            const isHovered = activeMonth === idx;

            return (
              <div
                key={idx}
                onMouseEnter={() => setActiveMonth(idx)}
                onMouseLeave={() => setActiveMonth(null)}
                className="flex-1 flex flex-col items-center gap-2 group relative cursor-pointer"
              >
                {/* Floating Tooltip */}
                {isHovered && (
                  <div className="absolute -top-16 bg-slate-900 text-white text-[11px] px-3 py-1.5 rounded-lg shadow-xl pointer-events-none whitespace-nowrap z-20 animate-fadeIn border border-slate-700">
                    <div className="font-bold border-b border-slate-700 pb-0.5 mb-1">{m.month}</div>
                    <div className="text-slate-300">Planned: <span className="text-white font-bold">{formatCurrency(m.planned)}</span></div>
                    <div className="text-slate-300">Actual: <span className="text-white font-bold">{formatCurrency(m.actual)}</span></div>
                  </div>
                )}

                {/* Bars Pair Container */}
                <div className="w-full bg-slate-100/70 border border-slate-200/80 rounded-t-xl h-44 flex items-end justify-center gap-1 sm:gap-1.5 p-1 relative">
                  {/* Planned Bar */}
                  <div
                    className="w-1/2 bg-gradient-to-t from-slate-400 to-slate-200 hover:from-slate-500 hover:to-slate-300 border border-slate-300 rounded-t transition-all duration-500"
                    style={{ height: `${Math.max(plannedHeight, 6)}%` }}
                    title={`Planned: ${formatCurrency(m.planned)}`}
                  />
                  {/* Actual Bar */}
                  <div
                    className={`w-1/2 rounded-t transition-all duration-500 ${
                      isProjected
                        ? 'bg-gradient-to-t from-slate-700 to-slate-500 opacity-75'
                        : 'bg-gradient-to-t from-black via-slate-900 to-slate-700 group-hover:from-black group-hover:to-slate-600 shadow-xs'
                    }`}
                    style={{ height: `${Math.max(actualHeight, 6)}%` }}
                    title={`Actual: ${formatCurrency(m.actual)}`}
                  />
                </div>

                {/* Month Label */}
                <span className={`text-[11px] font-bold text-center ${isHovered ? 'text-black font-extrabold' : 'text-slate-500'}`}>
                  {m.month.split(' ')[0]}
                  {isProjected && <span className="text-[9px] text-slate-500 block leading-none font-semibold">*Proj</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart Legend (placed below the graph) */}
      <div className="flex items-center justify-between flex-wrap gap-y-2 mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gradient-to-t from-slate-400 to-slate-200 border border-slate-300" />
            <span>Planned Expenditure</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gradient-to-t from-black to-slate-700" />
            <span>Actual Ground Disbursals</span>
          </div>
        </div>
        <span className="text-[11px] text-slate-400 font-medium italic">
          Hover over bars for exact breakdown
        </span>
      </div>
    </Card>
  );
};
