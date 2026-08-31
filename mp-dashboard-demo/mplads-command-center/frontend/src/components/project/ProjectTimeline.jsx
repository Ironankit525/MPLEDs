import React from 'react';
import { formatDate } from '../../utils/formatDate.js';
import { CheckCircle2, Clock, Calendar } from 'lucide-react';

export const ProjectTimeline = ({ startDate, expectedCompletionDate, completionPercentage }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <span>Sanctioned: {formatDate(startDate)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-amber-600" />
          <span>Target: {formatDate(expectedCompletionDate)}</span>
        </div>
      </div>

      <div className="relative pl-6 space-y-3 border-l-2 border-slate-200">
        <div className="relative">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute -left-[31px] top-0 bg-white rounded-full shadow-xs" />
          <h5 className="text-xs font-bold text-slate-800">Proposal Approved & Sanctioned</h5>
          <p className="text-[11px] text-slate-500">{formatDate(startDate)}</p>
        </div>

        <div className="relative">
          <div className={`w-3.5 h-3.5 rounded-full absolute -left-[30px] top-0 border-2 ${completionPercentage > 0 ? 'bg-indigo-600 border-indigo-200' : 'bg-white border-slate-300'}`} />
          <h5 className="text-xs font-bold text-slate-800">Physical Construction & Execution</h5>
          <p className="text-[11px] text-slate-500">{completionPercentage}% Completed</p>
        </div>

        <div className="relative">
          <div className={`w-3.5 h-3.5 rounded-full absolute -left-[30px] top-0 border-2 ${completionPercentage === 100 ? 'bg-emerald-600 border-emerald-200' : 'bg-white border-slate-300'}`} />
          <h5 className="text-xs font-bold text-slate-800">Final Verification & Handover</h5>
          <p className="text-[11px] text-slate-500">Expected {formatDate(expectedCompletionDate)}</p>
        </div>
      </div>
    </div>
  );
};
