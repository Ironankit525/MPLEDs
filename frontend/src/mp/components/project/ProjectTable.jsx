import React from 'react';
import { Badge } from '../common/Badge';
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS } from '../../constants/projectStatus';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';

export const ProjectTable = ({ projects = [] }) => {
  const navigate = useNavigate();

  if (!projects || projects.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
            <th className="py-3.5 px-4">Project Title</th>
            <th className="py-3.5 px-4">Sector</th>
            <th className="py-3.5 px-4">Location</th>
            <th className="py-3.5 px-4">Sanctioned</th>
            <th className="py-3.5 px-4">Utilized</th>
            <th className="py-3.5 px-4">Progress</th>
            <th className="py-3.5 px-4">Status</th>
            <th className="py-3.5 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {projects.map((proj) => {
            const badgeVariant = PROJECT_STATUS_COLORS[proj.status] || 'slate';
            return (
              <tr key={proj.id} className="hover:bg-slate-50/80 transition duration-150">
                <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs truncate">
                  {proj.name}
                </td>
                <td className="py-3.5 px-4 text-slate-700 font-medium">{proj.sector}</td>
                <td className="py-3.5 px-4 text-slate-500 text-xs">
                  {proj.location?.village}, {proj.location?.district}
                </td>
                <td className="py-3.5 px-4 font-semibold text-slate-800">{formatCurrency(proj.sanctionedAmount, true)}</td>
                <td className="py-3.5 px-4 font-semibold text-emerald-700">{formatCurrency(proj.utilizedAmount, true)}</td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-slate-100 border border-slate-200/80 rounded-full h-2 overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${proj.completionPercentage}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">{proj.completionPercentage}%</span>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <Badge variant={badgeVariant}>
                    {PROJECT_STATUS_LABELS[proj.status] || proj.status}
                  </Badge>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <button
                    onClick={() => navigate(`/projects/${proj.id}`)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
