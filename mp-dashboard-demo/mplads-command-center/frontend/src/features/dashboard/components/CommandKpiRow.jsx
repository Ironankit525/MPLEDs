import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, Wallet, FolderKanban, CheckCircle2, Clock, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatCurrency.js';

export const CommandKpiRow = ({ kpis, fundPosition }) => {
  const navigate = useNavigate();

  if (!kpis) return null;

  const items = [
    {
      id: 'allocation',
      title: 'Annual Allocation',
      value: formatCurrency(kpis.annualAllocation, true),
      icon: Landmark,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 border-indigo-100',
      path: '/mp/finance'
    },
    {
      id: 'utilized',
      title: 'Utilized Amount',
      value: formatCurrency(kpis.utilizedAmount, true),
      icon: Wallet,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 border-emerald-100',
      path: '/mp/finance'
    },
    {
      id: 'proposed',
      title: 'Projects Proposed',
      value: kpis.projectsProposed,
      icon: FolderKanban,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 border-indigo-100',
      path: '/mp/projects'
    },
    {
      id: 'atRisk',
      title: 'Projects At Risk / Delayed',
      value: `${kpis.projectsAtRisk + (kpis.projectsDelayed || 0)}`,
      icon: AlertTriangle,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50 border-rose-100',
      path: '/mp/projects'
    },
    {
      id: 'ongoing',
      title: 'Projects Ongoing',
      value: kpis.projectsOngoing,
      icon: Clock,
      color: 'text-sky-600',
      bgColor: 'bg-sky-50 border-sky-100',
      path: '/mp/projects'
    },
    {
      id: 'completed',
      title: 'Projects Completed',
      value: kpis.projectsCompleted,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 border-emerald-100',
      path: '/mp/projects'
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            onClick={() => navigate(item.path)}
            className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs hover:shadow-md hover:border-slate-400 transition duration-200 cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg ${item.bgColor} border flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4.5 h-4.5 ${item.color}`} />
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-800 transition-colors" />
              </div>
              <span className="text-xs font-semibold text-slate-500 block leading-tight">
                {item.title}
              </span>
              <span className="text-2xl font-black font-display text-slate-900 mt-1.5 block tracking-tight">
                {item.value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
