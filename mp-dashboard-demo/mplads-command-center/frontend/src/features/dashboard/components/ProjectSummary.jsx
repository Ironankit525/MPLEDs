import React from 'react';
import { Card } from '../../../components/common/Card.jsx';
import { FolderKanban, CheckCircle2, Clock, PlayCircle } from 'lucide-react';

export const ProjectSummary = ({ projects }) => {
  if (!projects) return null;

  const items = [
    { label: 'Total Works', count: projects.total, icon: FolderKanban, color: 'text-indigo-600' },
    { label: 'Completed Works', count: projects.completed, icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'Ongoing Execution', count: projects.ongoing, icon: Clock, color: 'text-amber-600' },
    { label: 'Not Started', count: projects.notStarted, icon: PlayCircle, color: 'text-slate-500' },
  ];

  return (
    <Card title="Projects Summary">
      <div className="grid grid-cols-2 gap-3">
        {items.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="bg-slate-50 border border-slate-200/90 p-3 rounded-lg flex items-center gap-3">
              <Icon className={`w-5 h-5 ${item.color}`} />
              <div>
                <span className="text-xs text-slate-500 font-semibold block">{item.label}</span>
                <span className="text-lg font-bold text-slate-850 text-slate-900">{item.count}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
