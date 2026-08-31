import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/common/Card.jsx';
import { formatCurrency } from '../../../utils/formatCurrency.js';
import { AlertTriangle, Clock, CheckCircle2, CircleDashed, ArrowRight } from 'lucide-react';

export const ProjectHealth = ({ projectHealth }) => {
  const navigate = useNavigate();

  if (!projectHealth) return null;

  const total = projectHealth.totalProjects || 12;
  const onTrackPct = ((projectHealth.onTrack / total) * 100).toFixed(0);
  const atRiskPct = ((projectHealth.atRisk / total) * 100).toFixed(0);
  const delayedPct = ((projectHealth.delayed / total) * 100).toFixed(0);

  const healthCards = [
    {
      key: 'onTrack',
      label: 'On Track',
      count: projectHealth.onTrack,
      pct: onTrackPct,
      color: 'text-emerald-700',
      dot: 'bg-emerald-500',
      bg: 'bg-emerald-50 border-emerald-200'
    },
    {
      key: 'atRisk',
      label: 'At Risk',
      count: projectHealth.atRisk,
      pct: atRiskPct,
      color: 'text-amber-700',
      dot: 'bg-amber-500',
      bg: 'bg-amber-50 border-amber-200'
    },
    {
      key: 'delayed',
      label: 'Delayed',
      count: projectHealth.delayed,
      pct: delayedPct,
      color: 'text-rose-700',
      dot: 'bg-rose-500',
      bg: 'bg-rose-50 border-rose-200'
    },
    {
      key: 'notStarted',
      label: 'Not Started',
      count: projectHealth.notStarted,
      pct: 0,
      color: 'text-slate-600',
      dot: 'bg-slate-300',
      bg: 'bg-slate-50 border-slate-200'
    }
  ];

  return (
    <Card
      title="Project Execution Health"
      subtitle="Ground execution status and schedule adherence"
    >
      {/* Horizontal Multi-Segment Distribution Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5">
          <span>Portfolio Health Distribution</span>
          <span className="font-bold text-slate-800">{total} Total Works</span>
        </div>
        <div className="h-3.5 w-full bg-slate-100 border border-slate-200 rounded-full flex overflow-hidden p-0.5 gap-0.5 shadow-xs">
          <div
            className="h-full bg-black first:rounded-l-full transition-all duration-500"
            style={{ width: `${(projectHealth.onTrack / total) * 100}%` }}
            title={`On Track: ${projectHealth.onTrack}`}
          />
          <div
            className="h-full bg-slate-500 transition-all duration-500"
            style={{ width: `${(projectHealth.atRisk / total) * 100}%` }}
            title={`At Risk: ${projectHealth.atRisk}`}
          />
          <div
            className="h-full bg-slate-300 last:rounded-r-full transition-all duration-500"
            style={{ width: `${(projectHealth.delayed / total) * 100}%` }}
            title={`Delayed: ${projectHealth.delayed}`}
          />
        </div>
      </div>

      {/* Health Badges Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {healthCards.map((item) => (
          <div
            key={item.key}
            onClick={() => navigate('/mp/projects')}
            className={`p-3 rounded-xl border ${item.bg} flex items-center justify-between cursor-pointer hover:shadow-xs transition`}
          >
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${item.dot}`} />
                <span className="text-xs font-bold text-slate-700">{item.label}</span>
              </div>
              <div className="text-xl font-extrabold font-display text-slate-900">
                {item.count}
              </div>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              {item.pct}%
            </span>
          </div>
        ))}
      </div>

      {/* Delayed Project Funds Impact Callout */}
      <div
        onClick={() => navigate('/mp/projects')}
        className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 flex items-center justify-between gap-3 cursor-pointer hover:bg-rose-50 transition"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-rose-950 block">
              {formatCurrency(projectHealth.delayedProjectsFund, true)} currently associated with delayed projects
            </span>
            <span className="text-[11px] font-medium text-rose-800 block">
              2 projects exceeding timeline milestones by &gt;14 days
            </span>
          </div>
        </div>
        <span className="text-xs font-bold text-black flex items-center gap-1 shrink-0">
          <span>Review</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Card>
  );
};
