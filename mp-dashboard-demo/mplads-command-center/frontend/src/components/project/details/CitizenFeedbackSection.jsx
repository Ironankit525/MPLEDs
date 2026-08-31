import React from 'react';
import { Card } from '../../common/Card.jsx';
import { Badge } from '../../common/Badge.jsx';
import { MessageSquare, Star, CheckCircle2, Clock, AlertTriangle, MapPin, User } from 'lucide-react';

export const CitizenFeedbackSection = ({ feedback = [] }) => {
  const total = feedback.length;
  const resolved = feedback.filter(f => f.status === 'RESOLVED').length;
  const underReview = feedback.filter(f => f.status === 'UNDER_REVIEW').length;
  const escalated = feedback.filter(f => f.status === 'ESCALATED').length;

  return (
    <Card className="hover:border-indigo-200 transition">
      <div className="space-y-5">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Citizen Feedback & Public Grievances</h3>
              <p className="text-[11px] text-slate-500">Beneficiary community submissions from constituency feedback kiosks.</p>
            </div>
          </div>

          <span className="text-xs font-bold text-slate-500">
            {total} Submissions
          </span>
        </div>

        {/* Counter KPI Strip */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total</span>
            <strong className="text-base font-black text-slate-900 mt-0.5 block">{total}</strong>
          </div>

          <div className="p-2.5 bg-emerald-50/60 border border-emerald-100 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Resolved</span>
            <strong className="text-base font-black text-emerald-800 mt-0.5 block">{resolved}</strong>
          </div>

          <div className="p-2.5 bg-amber-50/60 border border-amber-100 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Review</span>
            <strong className="text-base font-black text-amber-800 mt-0.5 block">{underReview}</strong>
          </div>

          <div className="p-2.5 bg-rose-50/60 border border-rose-100 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">Escalated</span>
            <strong className="text-base font-black text-rose-800 mt-0.5 block">{escalated}</strong>
          </div>
        </div>

        {/* Feedback Items List */}
        {feedback.length === 0 ? (
          <p className="text-xs text-slate-400 italic p-4 text-center">No citizen feedback received yet.</p>
        ) : (
          <div className="space-y-3">
            {feedback.map((item) => {
              const isResolved = item.status === 'RESOLVED';
              const isEscalated = item.status === 'ESCALATED';

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border space-y-2 transition ${
                    isEscalated
                      ? 'bg-rose-50/40 border-rose-200'
                      : isResolved
                      ? 'bg-white border-slate-200/90'
                      : 'bg-amber-50/30 border-amber-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 leading-snug">
                          {item.citizenName || 'Local Citizen'}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-rose-500" />
                          {item.location} • Category: <strong className="text-slate-700">{item.category}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      {item.rating && (
                        <div className="flex items-center gap-0.5 text-amber-500">
                          {[...Array(item.rating)].map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      )}
                      <span className="text-[10px] font-medium text-slate-400">{item.date}</span>
                      <Badge variant={isResolved ? 'emerald' : isEscalated ? 'rose' : 'amber'} className="text-[9px]">
                        {item.status}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed font-medium pl-8">
                    "{item.message}"
                  </p>

                  {item.resolution && (
                    <div className="ml-8 p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-[11px] text-slate-600 space-y-0.5">
                      <span className="font-extrabold text-emerald-800 flex items-center gap-1 text-[10px] uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Official Action / Resolution:
                      </span>
                      <p className="text-slate-700 font-medium">{item.resolution}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};
