import React from 'react';
import { Card } from '../../../components/common/Card.jsx';
import { Calendar, CheckCircle } from 'lucide-react';

export const UpcomingActivities = () => {
  const activities = [
    { title: 'District Collectorate MPLADS Quarterly Review Meeting', date: '2026-09-05', type: 'Review' },
    { title: 'Site Inspection: Community Health Centre Haveli', date: '2026-09-12', type: 'Inspection' },
    { title: 'Inauguration: Primary School Smart Science Lab', date: '2026-09-20', type: 'Event' },
  ];

  return (
    <Card title="Upcoming Constituency Schedule">
      <div className="space-y-2.5">
        {activities.map((act, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/90">
            <Calendar className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
            <div>
              <h5 className="text-xs font-bold text-slate-800">{act.title}</h5>
              <span className="text-[11px] font-medium text-slate-500">{act.date} • {act.type}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
