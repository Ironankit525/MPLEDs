import React from 'react';

// Sample data structure for projects
const DEFAULT_PROJECTS = [
  {
    id: 'PRJ-101',
    name: 'Solar Lamp Installation Phase 2',
    district: 'Nagpur',
    progress: 75,
    status: 'IN_PROGRESS', // IN_PROGRESS, COMPLETED, DELAYED, ON_HOLD
    budgetUtilized: '₹12,50,000 / ₹15,00,000',
    deadline: '15 Sep 2026',
    flagged: false,
  },
  {
    id: 'PRJ-102',
    name: 'Rural Road Reconstruction',
    district: 'Pune',
    progress: 40,
    status: 'DELAYED',
    budgetUtilized: '₹8,00,000 / ₹20,00,000',
    deadline: '30 Oct 2026',
    flagged: true,
  },
  {
    id: 'PRJ-103',
    name: 'Community Center Renovation',
    district: 'Nashik',
    progress: 100,
    status: 'COMPLETED',
    budgetUtilized: '₹5,00,000 / ₹5,00,000',
    deadline: '01 Aug 2026',
    flagged: false,
  },
];

const STATUS_CONFIG = {
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-blue-100', text: 'text-blue-700' },
  COMPLETED: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-700' },
  DELAYED: { label: 'Delayed', bg: 'bg-amber-100', text: 'text-amber-700' },
  ON_HOLD: { label: 'On Hold', bg: 'bg-rose-100', text: 'text-rose-700' },
};

export default function ProjectStatusPanel({ projects = DEFAULT_PROJECTS }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Project Status</h3>
          <p className="text-xs text-gray-500">Track real-time progress and deadlines</p>
        </div>
        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
          {projects.length} Active Projects
        </span>
      </div>

      <div className="space-y-4">
        {projects.map((project) => {
          const statusStyle = STATUS_CONFIG[project.status] || STATUS_CONFIG.IN_PROGRESS;

          return (
            <div
              key={project.id}
              className="p-3.5 rounded-lg border border-gray-100 bg-slate-50/50 hover:bg-slate-100/50 transition-colors"
            >
              {/* Top Row: Title & Status Badge */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm text-gray-900">{project.name}</h4>
                    {project.flagged && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                        Flagged
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {project.id} • {project.district}
                  </p>
                </div>

                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}
                >
                  {statusStyle.label}
                </span>
              </div>

              {/* Middle Row: Progress Bar */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Progress</span>
                  <span className="font-semibold">{project.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      project.progress === 100
                        ? 'bg-green-500'
                        : project.status === 'DELAYED'
                        ? 'bg-amber-500'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              {/* Bottom Row: Key Details */}
              <div className="flex justify-between items-center text-xs text-gray-500 pt-1 border-t border-gray-100">
                <span>Budget: {project.budgetUtilized}</span>
                <span>Deadline: {project.deadline}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}