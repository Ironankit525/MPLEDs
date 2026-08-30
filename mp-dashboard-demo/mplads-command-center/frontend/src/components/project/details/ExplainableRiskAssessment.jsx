import React from 'react';
import { Card } from '../../common/Card';
import { Badge } from '../../common/Badge';
import { getRiskCategory } from '../../../utils/projectCalculations';
import { ShieldAlert, AlertTriangle, CheckCircle2, Info, Layers } from 'lucide-react';

const SEVERITY_BADGES = {
  LOW: { variant: 'emerald', label: 'Low' },
  MEDIUM: { variant: 'amber', label: 'Medium' },
  HIGH: { variant: 'rose', label: 'High' },
  CRITICAL: { variant: 'rose', label: 'Critical' },
};

export const ExplainableRiskAssessment = ({ risk = {} }) => {
  const score = risk.score ?? 42;
  const riskInfo = getRiskCategory(score);
  const factors = risk.factors || [];

  return (
    <Card className="hover:border-indigo-200 transition">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${riskInfo.bgClass}`}>
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Explainable Risk Assessment & Governance</h3>
              <p className="text-[11px] text-slate-500">Multi-factor forensic model evaluating timeline, financial velocity, and contractor track record.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-xs font-bold text-slate-500">Composite Score:</span>
            <span className={`px-3 py-1 rounded-xl text-xs font-black border ${riskInfo.bgClass}`}>
              {score} / 100 • {riskInfo.label}
            </span>
          </div>
        </div>

        {/* 1. HORIZONTAL RISK SCALE GAUGE */}
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
            <span>0 — Low (0-30)</span>
            <span>Medium (31-60)</span>
            <span>High (61-80)</span>
            <span>100 — Critical (81-100)</span>
          </div>

          {/* Segmented Bar */}
          <div className="relative h-3 rounded-full overflow-hidden bg-slate-200 flex">
            <div className="w-[30%] bg-emerald-500 opacity-80" />
            <div className="w-[30%] bg-amber-500 opacity-80" />
            <div className="w-[20%] bg-orange-500 opacity-80" />
            <div className="w-[20%] bg-rose-500 opacity-80" />

            {/* Needle indicator */}
            <div
              className="absolute top-0 bottom-0 w-1.5 bg-slate-950 shadow-md ring-2 ring-white transition-all duration-700"
              style={{ left: `calc(${score}% - 3px)` }}
            />
          </div>

          <p className="text-xs text-slate-600 font-medium pt-1">
            {riskInfo.description}
          </p>
        </div>

        {/* 2. EXPLAINABLE RISK FACTOR BREAKDOWN */}
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Explainable Factor Breakdown</span>
          </h4>

          {factors.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No granular risk factors available.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {factors.map((factor, idx) => {
                const sev = SEVERITY_BADGES[factor.severity] || SEVERITY_BADGES.LOW;
                const pct = factor.maxScore > 0 ? (factor.score / factor.maxScore) * 100 : 0;

                return (
                  <div
                    key={idx}
                    className="p-3.5 bg-white border border-slate-200/90 rounded-xl space-y-2 hover:border-indigo-200 transition shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-slate-900">
                        {factor.category}
                      </h5>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-slate-800">
                          {factor.score} <span className="text-[10px] text-slate-400">/ {factor.maxScore}</span>
                        </span>
                        <Badge variant={sev.variant} className="text-[9px] px-1.5 py-0">
                          {sev.label}
                        </Badge>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-slate-900 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug font-medium">
                      {factor.reason}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
