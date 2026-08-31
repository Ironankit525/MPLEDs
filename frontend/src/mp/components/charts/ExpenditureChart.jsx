import React from 'react';
import { formatCurrency } from '../../utils/formatCurrency.js';

export const ExpenditureChart = ({ data = [] }) => {
  if (!data || data.length === 0) {
    return <p className="text-xs text-slate-400 italic">No monthly expenditure data.</p>;
  }

  const maxAmount = Math.max(...data.map(d => d.amount), 1);

  return (
    <div className="pt-2">
      <div className="h-44 flex items-end gap-3 justify-between px-2">
        {data.map((item, idx) => {
          const heightPercent = (item.amount / maxAmount) * 100;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
              {/* Tooltip */}
              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2.5 py-1 rounded shadow-md pointer-events-none whitespace-nowrap z-10">
                {item.month}: {formatCurrency(item.amount)}
              </div>
              <div className="w-full bg-slate-100 border border-slate-200/60 rounded-t-lg h-36 flex items-end p-1">
                <div
                  className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t transition-all duration-500 group-hover:from-indigo-500 group-hover:to-indigo-300"
                  style={{ height: `${Math.max(heightPercent, 8)}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-slate-500">{item.month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
