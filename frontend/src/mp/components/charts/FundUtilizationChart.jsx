import React from 'react';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatPercentage } from '../../utils/formatPercentage.js';

export const FundUtilizationChart = ({ allocation = 50000000, released = 38000000, utilized = 31500000 }) => {
  const releasedPercent = (released / allocation) * 100;
  const utilizedPercent = (utilized / released) * 100;

  return (
    <div className="space-y-5">
      {/* Allocation vs Released Bar */}
      <div>
        <div className="flex justify-between text-xs font-semibold mb-1.5">
          <span className="text-slate-600">Total Sanctioned / Released ({formatCurrency(released, true)})</span>
          <span className="text-indigo-600 font-bold">{formatPercentage(releasedPercent)} of Annual Cap</span>
        </div>
        <div className="w-full h-3 bg-slate-100 border border-slate-200/80 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-full transition-all duration-500 shadow-xs"
            style={{ width: `${Math.min(releasedPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Released vs Utilized Bar */}
      <div>
        <div className="flex justify-between text-xs font-semibold mb-1.5">
          <span className="text-slate-600">Funds Utilized ({formatCurrency(utilized, true)})</span>
          <span className="text-emerald-600 font-bold">{formatPercentage(utilizedPercent)} Utilized</span>
        </div>
        <div className="w-full h-3 bg-slate-100 border border-slate-200/80 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-full transition-all duration-500 shadow-xs"
            style={{ width: `${Math.min(utilizedPercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
