import React from 'react';
import { Card } from '../../common/Card.jsx';
import { Badge } from '../../common/Badge.jsx';
import { CheckCircle2, Clock, Calendar, GitCommit, ArrowDown, Flag } from 'lucide-react';

export const ProjectTimelineSteps = ({ timeline = [] }) => {
  if (!timeline || timeline.length === 0) return null;

  return (
    <Card className="hover:border-slate-300 transition">
      <div className="space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <GitCommit className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Project Lifecycle Timeline</h3>
              <p className="text-[11px] text-slate-500">Statutory sanction stages, tendering milestones, and execution progression.</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {timeline.filter(t => t.status === 'COMPLETED').length} / {timeline.length} Stages Passed
          </span>
        </div>

        {/* Step Flow */}
        <div className="relative pl-6 space-y-4 border-l-2 border-slate-200 ml-3 py-1">
          {timeline.map((step, idx) => {
            const isCompleted = step.status === 'COMPLETED';
            const isCurrent = step.status === 'CURRENT';

            return (
              <div key={step.id || idx} className="relative group">
                {/* Node Icon */}
                <div className={`absolute -left-[31px] top-0.5 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${
                  isCompleted
                    ? 'w-4.5 h-4.5 bg-slate-900 text-white shadow-xs'
                    : isCurrent
                    ? 'w-4.5 h-4.5 bg-slate-900 text-white ring-4 ring-slate-200 shadow-sm animate-pulse'
                    : 'w-4 h-4 bg-white border-2 border-slate-300'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : isCurrent ? (
                    <Clock className="w-3 h-3" />
                  ) : null}
                </div>

                {/* Content */}
                <div className={`p-3 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-slate-50/80 border-slate-800 shadow-2xs'
                    : isCompleted
                    ? 'bg-white border-slate-200 hover:bg-slate-50/50'
                    : 'bg-white/60 border-slate-200 opacity-60'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-800">
                      {step.stage || `Stage ${idx + 1}`}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      {step.date}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 mt-0.5">
                    {step.title}
                  </h4>

                  {step.description && (
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed font-medium">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
