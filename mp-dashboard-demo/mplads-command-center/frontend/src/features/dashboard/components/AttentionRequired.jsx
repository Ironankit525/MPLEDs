import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clock, AlertCircle, FileCheck, ShieldAlert } from 'lucide-react';

export const AttentionRequired = ({ alerts = [] }) => {
  const navigate = useNavigate();

  if (!alerts || alerts.length === 0) return null;

  const severityConfig = {
    critical: {
      dot: 'bg-rose-500 ring-4 ring-rose-100',
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: AlertCircle,
      iconColor: 'text-slate-600',
      container: 'hover:border-slate-300 hover:bg-slate-50/50'
    },
    warning: {
      dot: 'bg-rose-400 ring-4 ring-rose-100',
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: AlertTriangle,
      iconColor: 'text-slate-600',
      container: 'hover:border-slate-300 hover:bg-slate-50/50'
    },
    info: {
      dot: 'bg-indigo-500 ring-4 ring-indigo-100',
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: FileCheck,
      iconColor: 'text-slate-600',
      container: 'hover:border-slate-400 hover:bg-slate-100/70'
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs transition duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Attention Required</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                {alerts.length} items require your attention
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Priority bottlenecks and verification signals requiring MP directive
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/projects')}
          className="text-xs font-bold text-black hover:text-slate-700 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
        >
          <span>View All Issues</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Alert Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {alerts.map((item) => {
          const cfg = severityConfig[item.severity] || severityConfig.warning;
          const Icon = cfg.icon;

          return (
            <div
              key={item.id}
              onClick={() => navigate(item.targetPath)}
              className={`p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/60 flex flex-col justify-between cursor-pointer transition ${cfg.container}`}
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {item.category}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                  {item.title}
                </h4>
                <p className="text-xs text-slate-600 font-medium mt-1">
                  {item.issue}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold text-black group-hover:text-slate-700 group">
                <span>{item.actionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
