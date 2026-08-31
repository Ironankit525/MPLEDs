import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { ShieldAlert, AlertCircle, AlertTriangle, FileCheck, ArrowRight, ArrowUpRight, Scale } from 'lucide-react';

export const IntegrityRiskSignals = ({ signals = [] }) => {
  const navigate = useNavigate();

  if (!signals || signals.length === 0) return null;

  const levelStyles = {
    critical: {
      dot: 'bg-rose-500',
    },
    warning: {
      dot: 'bg-amber-500',
    },
    notice: {
      dot: 'bg-indigo-500',
    }
  };

  return (
    <Card
      title="Integrity & Risk Signals"
      subtitle="Automated anomaly detection and governance verification triggers"
      action={
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {signals.length} Signals Active
          </span>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {signals.map((sig) => {
          const cfg = levelStyles[sig.level] || levelStyles.notice;

          return (
            <div
              key={sig.id}
              onClick={() => navigate(sig.investigatePath)}
              className="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-slate-800 hover:bg-slate-50/80 hover:shadow-md flex flex-col justify-between cursor-pointer transition-all duration-200 group"
            >
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Risk Signal
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 leading-snug group-hover:text-black transition">
                  {sig.title}
                </h4>

                <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                  {sig.description}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-900 group-hover:text-black">
                <span>Investigate</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
