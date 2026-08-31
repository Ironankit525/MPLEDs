import React from 'react';
import { Card } from '../../common/Card.jsx';
import { Badge } from '../../common/Badge.jsx';
import { History, Sparkles, Upload, Coins, CheckCircle2, ClipboardCheck, ArrowRight, User } from 'lucide-react';

const ACTIVITY_ICON_MAP = {
  ai: { icon: Sparkles, bg: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  upload: { icon: Upload, bg: 'bg-sky-50 text-sky-600 border-sky-200' },
  financial: { icon: Coins, bg: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  inspection: { icon: ClipboardCheck, bg: 'bg-amber-50 text-amber-600 border-amber-200' },
  progress: { icon: CheckCircle2, bg: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  sanction: { icon: CheckCircle2, bg: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
};

export const ActivityAuditTrail = ({ activity = [] }) => {
  return (
    <Card className="hover:border-slate-300 transition">
      <div className="space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <History className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Activity History & Cryptographic Audit Trail</h3>
              <p className="text-[11px] text-slate-500">Immutable ledger recording all contractor uploads, AI telemetries, and financial disbursements.</p>
            </div>
          </div>

          <span className="text-xs font-bold text-slate-500">
            {activity.length} Logged Events
          </span>
        </div>

        {/* Activity List */}
        {activity.length === 0 ? (
          <p className="text-xs text-slate-400 italic p-4 text-center">No lifecycle activities recorded.</p>
        ) : (
          <div className="relative pl-6 space-y-3 border-l-2 border-slate-200 ml-3 py-1">
            {activity.map((item, idx) => {
              const cfg = ACTIVITY_ICON_MAP[item.type] || ACTIVITY_ICON_MAP.progress;
              const IconComponent = cfg.icon;

              return (
                <div key={item.id || idx} className="relative group">
                  {/* Pin */}
                  <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full flex items-center justify-center border ${cfg.bg} transition-transform group-hover:scale-115`}>
                    <IconComponent className="w-2.5 h-2.5" />
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 hover:bg-slate-50 transition">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                      <span className="font-extrabold text-slate-900">
                        {item.action}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-600">
                        {item.timestamp}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5">
                      <span className="text-slate-600 font-medium">Actor: <strong className="text-slate-900">{item.actor}</strong></span>
                      {item.details && (
                        <span className="text-slate-900 font-medium italic truncate max-w-xs">{item.details}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};
