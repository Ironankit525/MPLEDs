import { createPortal } from 'react-dom';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

export const ProjectHeader = ({ lastUpdated = '27 Aug 2026', refreshing = false, onRefresh }) => {
  const portalRoot = document.getElementById('topbar-actions');
  if (!portalRoot) return null;

  return createPortal(
    <div className="flex items-center gap-4 shrink-0">
      <div className="flex flex-col items-end gap-1.5 hidden sm:flex">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span>Last updated</span>
          <span className="font-mono font-black text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg text-xs">
            {lastUpdated}
          </span>
        </div>
        
        <div className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Data up to date</span>
        </div>
      </div>

      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="text-slate-500 hover:text-slate-800 transition-colors focus:outline-none"
          title="Refresh Data"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>,
    portalRoot
  );
};
