import React from 'react';
import { Badge } from '../common/Badge';
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS } from '../../constants/projectStatus';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { useNavigate } from 'react-router-dom';
import { Eye, ArrowRight } from 'lucide-react';

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
            const title = proj.title || proj.name || 'Untitled';
            const physicalProgress = proj.progress?.physical ?? proj.completionPercentage ?? 0;
            const sanctioned = proj.financial?.sanctioned ?? proj.sanctionedAmount ?? 0;
            const utilized = proj.financial?.utilized ?? proj.utilizedAmount ?? 0;

            return (
              <tr 
                key={proj.id} 
                className="hover:bg-slate-50/80 transition duration-150 cursor-pointer"
                onClick={() => navigate(`/projects/${proj.id}`)}
              >
                <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs truncate">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 font-bold block">{proj.id}</span>
                    <span className="font-bold text-slate-900">{title}</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-slate-700 font-medium">{proj.sector}</td>
                <td className="py-3.5 px-4 text-slate-500 text-xs">
                  {proj.location?.village || proj.location?.area}, {proj.location?.district}
                </td>
                <td className="py-3.5 px-4 font-semibold text-slate-800">{formatCurrency(sanctioned, true)}</td>
                <td className="py-3.5 px-4 font-semibold text-slate-900">{formatCurrency(utilized, true)}</td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-slate-100 border border-slate-200/80 rounded-full h-2 overflow-hidden">
                      <div className="bg-slate-900 h-full rounded-full" style={{ width: `${physicalProgress}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">{physicalProgress}%</span>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <Badge variant={badgeVariant}>
                    {PROJECT_STATUS_LABELS[proj.status] || proj.status}
                  </Badge>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/projects/${proj.id}`);
                    }}
                    className="p-1.5 text-slate-600 hover:text-black hover:bg-slate-100 rounded-lg transition inline-flex items-center gap-1 text-xs font-bold"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline">View</span>
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
