import { createPortal } from 'react-dom';
import { Activity, Clock } from 'lucide-react';

export const AIRiskHeader = ({
  totalActiveProjects = 0,
  lastAnalysisTime = 'Today, 10:42 AM',
}) => {
  const portalRoot = document.getElementById('topbar-actions');
  if (!portalRoot) return null;

  return createPortal(
    <div className="flex flex-col gap-1.5 justify-end">
      {/* Row 1: Currently monitoring */}
      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 justify-end">
        <Activity className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span>Currently monitoring:</span>
        <span className="font-mono font-black text-slate-900 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md text-[11px]">
          {totalActiveProjects.toLocaleString()} active projects
        </span>
      </div>

      {/* Row 2: Last analysis */}
      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 justify-end">
        <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span>Last analysis:</span>
        <span className="font-mono font-black text-slate-900 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md text-[11px]">
          {lastAnalysisTime}
        </span>
      </div>
    </div>,
    portalRoot
  );
};
