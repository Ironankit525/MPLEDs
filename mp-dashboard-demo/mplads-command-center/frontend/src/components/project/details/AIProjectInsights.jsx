import React from 'react';
import { Card } from '../../common/Card.jsx';
import { Badge } from '../../common/Badge.jsx';
import { Sparkles, CheckCircle2, AlertTriangle, AlertCircle, Info, Lightbulb, ArrowRight } from 'lucide-react';

const SEVERITY_CONFIG = {
  positive: {
    bg: 'bg-emerald-50/70 border-emerald-200 text-emerald-950',
    badge: 'emerald',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600'
  },
  warning: {
    bg: 'bg-amber-50/70 border-amber-200 text-amber-950',
    badge: 'amber',
    icon: AlertTriangle,
    iconColor: 'text-amber-600'
  },
  critical: {
    bg: 'bg-rose-50/70 border-rose-200 text-rose-950',
    badge: 'rose',
    icon: AlertCircle,
    iconColor: 'text-rose-600'
  },
  info: {
    bg: 'bg-indigo-50/70 border-indigo-200 text-indigo-950',
    badge: 'indigo',
    icon: Info,
    iconColor: 'text-indigo-600'
  }
};

export const AIProjectInsights = ({ insights = [] }) => {
  if (!insights || insights.length === 0) return null;

  return (
    <Card className="hover:border-indigo-200 transition">
      <div className="space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">AI Monitoring Insights & Action Recommendations</h3>
              <p className="text-[11px] text-slate-500">Autonomous intelligence synthesizing evidence consistency, milestone velocity, and fiscal risks.</p>
            </div>
          </div>

          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
            {insights.length} Signals Active
          </span>
        </div>

        {/* Insights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {insights.map((item) => {
            const config = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.info;
            const IconComponent = config.icon;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border space-y-2 flex flex-col justify-between transition ${config.bg}`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <IconComponent className={`w-4 h-4 ${config.iconColor} shrink-0`} />
                      <span className="leading-snug">{item.title}</span>
                    </div>
                    <Badge variant={config.badge} className="text-[9px] uppercase tracking-wider px-1.5 py-0">
                      {item.type}
                    </Badge>
                  </div>

                  <p className="text-xs opacity-90 leading-relaxed font-medium">
                    {item.description}
                  </p>
                </div>

                {item.recommendation && (
                  <div className="pt-2 border-t border-slate-200/60 flex items-start gap-1.5 text-xs font-semibold">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="opacity-75 font-extrabold">Advisory: </strong>
                      {item.recommendation}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
