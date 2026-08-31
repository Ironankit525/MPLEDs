import React from 'react';
import { Badge } from '../common/Badge';

export const ProjectStatusChart = ({ statusCounts = { completed: 0, ongoing: 0, notStarted: 0 } }) => {
  const total = (statusCounts.completed || 0) + (statusCounts.ongoing || 0) + (statusCounts.notStarted || 0) || 1;

  const items = [
    { label: 'Completed', count: statusCounts.completed || 0, color: 'bg-black', badge: 'emerald' },
    { label: 'Ongoing', count: statusCounts.ongoing || 0, color: 'bg-slate-600', badge: 'indigo' },
    { label: 'Not Started', count: statusCounts.notStarted || 0, color: 'bg-slate-300', badge: 'amber' }
  ];

  return (
    <div className="space-y-4">
      {/* Visual Bar Segment */}
      <div className="h-4 w-full bg-slate-100 border border-slate-200 rounded-full flex overflow-hidden p-0.5 gap-0.5">
        {items.map((item, idx) => {
          const widthPct = (item.count / total) * 100;
          if (widthPct === 0) return null;
          return (
            <div
              key={idx}
              className={`h-full ${item.color} first:rounded-l-full last:rounded-r-full transition-all duration-500`}
              style={{ width: `${widthPct}%` }}
              title={`${item.label}: ${item.count}`}
            />
          );
        })}
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-3 gap-2">
        {items.map((item, idx) => (
          <div key={idx} className="bg-slate-50 border border-slate-200/90 p-2.5 rounded-lg text-center">
            <Badge variant={item.badge} className="mb-1">{item.label}</Badge>
            <div className="text-lg font-bold text-slate-800">{item.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
