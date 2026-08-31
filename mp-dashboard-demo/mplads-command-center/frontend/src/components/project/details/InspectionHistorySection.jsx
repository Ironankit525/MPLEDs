import React from 'react';
import { Card } from '../../common/Card.jsx';
import { Badge } from '../../common/Badge.jsx';
import { formatDate } from '../../../utils/formatDate.js';
import { ClipboardCheck, CheckCircle2, AlertTriangle, UserCheck, Calendar } from 'lucide-react';

export const InspectionHistorySection = ({ inspections = [] }) => {
  return (
    <Card className="hover:border-indigo-200 transition">
      <div className="space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <ClipboardCheck className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Inspection & Field Verification History</h3>
              <p className="text-[11px] text-slate-500">Statutory audits conducted by State Quality Monitors and District technical engineers.</p>
            </div>
          </div>

          <span className="text-xs font-bold text-slate-500">
            {inspections.length} Recorded Audits
          </span>
        </div>

        {/* Inspections List */}
        {inspections.length === 0 ? (
          <p className="text-xs text-slate-400 italic p-4 text-center">No field inspections recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {inspections.map((insp) => {
              const isPassed = insp.status === 'PASSED';

              return (
                <div
                  key={insp.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 transition hover:border-slate-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        isPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 leading-snug">
                           {insp.type}
                        </h4>
                        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-sky-600" />
                          {insp.inspector} {insp.designation && `(${insp.designation})`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {insp.date}
                      </span>
                      <Badge variant={isPassed ? 'emerald' : 'rose'} className="text-[10px]">
                        {insp.status}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 font-medium pl-8 leading-relaxed">
                    <strong className="text-slate-800 font-bold">Findings: </strong>
                    {insp.findings}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};
