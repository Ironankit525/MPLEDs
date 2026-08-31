import React from 'react';
import { formatCurrency } from '../../../utils/formatCurrency.js';
import { getFinancialStats, getRiskCategory, getTimelineMetrics } from '../../../utils/projectCalculations.js';
import { Activity, Coins, ShieldAlert, Calendar, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';

export const ProjectExecutiveSummary = ({ project }) => {
  if (!project) return null;

  const financialStats = getFinancialStats(project.financial);
  const riskScore = project.risk?.score ?? 67;
  const riskInfo = getRiskCategory(riskScore);
  const timeline = getTimelineMetrics(project.dates?.start || project.dates?.startDate, project.dates?.expectedCompletion || project.dates?.expectedCompletionDate);

  // Overall Health Evaluation
  const isCompleted = project.status === 'COMPLETED' || project.progress?.physical === 100;
  const isAtRisk = project.risk?.score >= 60 || project.status === 'DELAYED';
  const isHealthy = !isAtRisk && (project.risk?.score <= 40);

  const healthBadge = isCompleted ? {
    label: '🟢 Completed',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  } : isAtRisk ? {
    label: '🔴 At Risk',
    bg: 'bg-rose-50 text-rose-800 border-rose-200',
  } : isHealthy ? {
    label: '🟢 Healthy',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  } : {
    label: '🟡 Monitored',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
          <span>Executive Summary</span>
        </h3>
        <span className={`px-3 py-1 text-xs font-black rounded-full border ${healthBadge.bg}`}>
          Project Health: {healthBadge.label}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* 1. Physical Progress */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-2 hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Physical Progress</span>
            <Activity className="w-4 h-4 text-sky-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 leading-none">
              {project.progress?.physical ?? 53}%
            </div>
            <div className="w-full bg-slate-100 border border-slate-200/80 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-slate-900 h-full rounded-full transition-all duration-500"
                style={{ width: `${project.progress?.physical ?? 53}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] font-medium text-slate-500 truncate">
            Stage: {project.progress?.currentStage || 'Structural Work'}
          </span>
        </div>

        {/* 2. Utilized Amount */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-2 hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Utilized Amount</span>
            <Coins className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 leading-none">
              {formatCurrency(financialStats.utilized, true)}
            </div>
            <span className="text-[10px] font-bold text-slate-500 block mt-1">
              Of {formatCurrency(financialStats.sanctioned, true)} Sanctioned
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-700 truncate">
            {financialStats.utilizationOfSanctioned}% of Budget
          </span>
        </div>

        {/* 3. Financial Progress */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-2 hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Financial Progress</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 leading-none">
              {project.progress?.financial ?? 68}%
            </div>
            <div className="w-full bg-slate-100 border border-slate-200/80 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-slate-900 h-full rounded-full transition-all duration-500"
                style={{ width: `${project.progress?.financial ?? 68}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] font-medium text-slate-500 truncate">
            Unutilized: {formatCurrency(financialStats.remainingReleased, true)}
          </span>
        </div>

        {/* 4. Risk Score */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-2 hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Risk Score</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 leading-none">
                {riskScore}
              </span>
              <span className="text-xs font-bold text-slate-400">/ 100</span>
            </div>
            <div className="w-full bg-slate-100 border border-slate-200/80 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-slate-900"
                style={{ width: `${riskScore}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-700 truncate">
            {riskInfo.label}
          </span>
        </div>

        {/* 5. Expected Completion */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-2 hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Target Date</span>
            <Calendar className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <div className="text-base font-black text-slate-900 leading-snug">
              {project.dates?.expectedCompletionDate || project.dates?.expectedCompletion || '18 Sep 2026'}
            </div>
            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
              Elapsed: {timeline.daysElapsed} days
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-500 truncate">
            {timeline.daysRemaining} days remaining
          </span>
        </div>

        {/* 6. Project Health */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-2 hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Project Health</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-lg font-black leading-snug text-slate-900">
              {healthBadge.label}
            </div>
            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
              Status: {project.status}
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-700 truncate">
            Parliamentary Review Active
          </span>
        </div>
      </div>
    </div>
  );
};
