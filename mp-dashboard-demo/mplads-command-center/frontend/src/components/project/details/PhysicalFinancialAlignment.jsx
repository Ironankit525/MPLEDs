import React from 'react';
import { Card } from '../../common/Card';
import { Badge } from '../../common/Badge';
import { getProgressAlignment } from '../../../utils/projectCalculations';
import { Scale, CheckCircle2, AlertTriangle, ArrowRightLeft, TrendingUp } from 'lucide-react';

export const PhysicalFinancialAlignment = ({ physical = 0, financial = 0 }) => {
  const alignment = getProgressAlignment(physical, financial);

  return (
    <Card className="hover:border-indigo-200 transition">
      <div className="space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Physical vs Financial Progress Alignment</h3>
              <p className="text-[11px] text-slate-500">Cross-verifying on-ground physical delivery with public fund disbursements.</p>
            </div>
          </div>

          <Badge variant={alignment.badgeVariant}>
            {alignment.status === 'HEALTHY' ? 'Healthy' : alignment.status === 'CRITICAL_MISMATCH' ? 'Discrepancy' : 'Variance'}
          </Badge>
        </div>

        {/* Progress Comparison Gauges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Physical Progress */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700">Physical Completion</span>
              <span className="text-slate-900 text-sm font-black">{physical}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-200/70 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-900 rounded-full transition-all duration-500"
                style={{ width: `${physical}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              Verified by engineering inspections & AI telemetry
            </span>
          </div>

          {/* Financial Progress */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700">Financial Utilization</span>
              <span className="text-slate-900 text-sm font-black">{financial}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-200/70 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-900 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(financial, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              Recorded in PFMS / District Treasury vouchers
            </span>
          </div>
        </div>

        {/* Dynamic Status Alert Box */}
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${alignment.bgColor} ${alignment.borderColor}`}>
          {alignment.status === 'HEALTHY' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}

          <div className="space-y-0.5">
            <strong className={`text-xs font-extrabold block ${alignment.textColor}`}>
              {alignment.label} {alignment.difference !== 0 && `(${alignment.difference > 0 ? `+${alignment.difference}%` : `${alignment.difference}%`})`}
            </strong>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {alignment.description}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};
