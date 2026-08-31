import React from 'react';
import { Card } from '../../common/Card.jsx';
import { Badge } from '../../common/Badge.jsx';
import { formatDate } from '../../../utils/formatDate.js';
import { CheckCircle2, Clock, Calendar, Check, AlertCircle, Layers } from 'lucide-react';

const MILESTONE_STATUS_MAP = {
  COMPLETED: { badge: 'emerald', label: 'Completed', icon: CheckCircle2, color: 'text-emerald-600' },
  IN_PROGRESS: { badge: 'indigo', label: 'In Progress', icon: Clock, color: 'text-indigo-600' },
  DELAYED: { badge: 'rose', label: 'Delayed', icon: AlertCircle, color: 'text-rose-600' },
  PENDING: { badge: 'slate', label: 'Pending', icon: Clock, color: 'text-slate-400' },
};

export const ProjectProgressMilestones = ({ overallProgress = 0, milestones = [] }) => {
  return (
    <Card className="hover:border-indigo-200 transition">
      <div className="space-y-5">
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Project Progress & Milestone Breakdown</h3>
              <p className="text-[11px] text-slate-500">Track granular engineering and statutory milestones against planned schedules.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span>Overall Physical:</span>
            <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-sm font-black">
              {overallProgress}%
            </span>
          </div>
        </div>

        {/* Milestone Steps List */}
        {milestones.length === 0 ? (
          <p className="text-xs text-slate-400 italic p-4 text-center">No milestone schedule defined for this project.</p>
        ) : (
          <div className="space-y-3">
            {milestones.map((ms, index) => {
              const statusCfg = MILESTONE_STATUS_MAP[ms.status] || MILESTONE_STATUS_MAP.PENDING;
              const isDone = ms.progress === 100 || ms.status === 'COMPLETED';

              return (
                <div
                  key={ms.id || index}
                  className={`p-3.5 rounded-xl border transition ${
                    isDone
                      ? 'bg-emerald-50/30 border-emerald-100'
                      : ms.status === 'IN_PROGRESS'
                      ? 'bg-indigo-50/40 border-indigo-200/80'
                      : ms.status === 'DELAYED'
                      ? 'bg-rose-50/30 border-rose-200'
                      : 'bg-slate-50/60 border-slate-200/70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        isDone
                          ? 'bg-emerald-600 text-white'
                          : ms.status === 'IN_PROGRESS'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        {isDone ? (
                          <Check className="w-3 h-3 stroke-[3]" />
                        ) : (
                          <span className="text-[10px] font-black">{index + 1}</span>
                        )}
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 leading-snug">
                        {ms.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span className="text-xs font-black text-slate-800">
                        {ms.progress}%
                      </span>
                      <Badge variant={statusCfg.badge} className="text-[10px] px-2 py-0.5">
                        {statusCfg.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Milestone Progress Bar */}
                  <div className="w-full bg-slate-200/70 rounded-full h-1.5 overflow-hidden my-1.5">
                    <div
                      className="h-full bg-slate-900 rounded-full transition-all duration-500"
                      style={{ width: `${ms.progress}%` }}
                    />
                  </div>

                  {/* Planned vs Actual Date Subtext */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 pt-1 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Planned: {formatDate(ms.plannedStartDate)} → {formatDate(ms.plannedEndDate)}
                    </span>

                    {ms.actualStartDate && (
                      <span className="text-slate-600 font-semibold">
                        Actual: {formatDate(ms.actualStartDate)} {ms.actualEndDate ? `→ ${formatDate(ms.actualEndDate)}` : '(Active)'}
                      </span>
                    )}
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
