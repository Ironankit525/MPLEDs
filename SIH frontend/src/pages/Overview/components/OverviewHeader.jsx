import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

export const OverviewHeader = ({
  lastUpdated,
  refreshing,
  onRefresh,
}) => {
  const formattedTime = lastUpdated
    ? new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(lastUpdated)
    : '26 Aug 2026, 10:32 AM';

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-16">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
          Overview Dashboard
        </h1>
        
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="flex flex-col items-end gap-1.5 hidden sm:flex">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>Last updated</span>
            <span className="font-mono font-black text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg text-xs">
              {formattedTime}
            </span>
          </div>
          
          <div className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Data up to date</span>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="text-slate-500 hover:text-slate-800 transition-colors focus:outline-none"
          title="Refresh Data"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
};
