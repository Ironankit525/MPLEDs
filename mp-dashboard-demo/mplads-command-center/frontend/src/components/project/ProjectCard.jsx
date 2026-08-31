import React from 'react';
import { Card } from '../common/Card.jsx';
import { Badge } from '../common/Badge.jsx';
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS } from '../../constants/projectStatus.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { MapPin, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ProjectCard = ({ project }) => {
  const navigate = useNavigate();
  if (!project) return null;

  const badgeVariant = PROJECT_STATUS_COLORS[project.status] || 'slate';
  const title = project.title || project.name || 'Untitled Project';
  const completionPercentage = project.progress?.physical ?? project.completionPercentage ?? 0;
  const sanctioned = project.financial?.sanctioned ?? project.sanctionedAmount ?? 0;
  const utilized = project.financial?.utilized ?? project.utilizedAmount ?? 0;

  return (
    <Card 
      className="hover:border-indigo-300 hover:shadow-md transition duration-200 cursor-pointer flex flex-col justify-between" 
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{project.sector}</span>
            <h4 className="text-base font-bold text-slate-900 line-clamp-1 mt-0.5">{title}</h4>
          </div>
          <Badge variant={badgeVariant}>
            {PROJECT_STATUS_LABELS[project.status] || project.status}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{project.location?.village || project.location?.area}, {project.location?.district}</span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-500">Physical Progress</span>
            <span className="text-slate-900 font-bold">{completionPercentage}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 border border-slate-200/70 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-black via-slate-900 to-slate-800 rounded-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Financial Metrics */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-400 text-[11px] font-medium block">Sanctioned</span>
            <span className="font-bold text-slate-900">{formatCurrency(sanctioned, true)}</span>
          </div>
          <div>
            <span className="text-slate-400 text-[11px] font-medium block">Utilized</span>
            <span className="font-bold text-slate-900">{formatCurrency(utilized, true)}</span>
          </div>
        </div>
      </div>

      {/* Explicit View Details Action Strip */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
        <span className="text-[11px] font-mono text-slate-400 font-semibold">{project.id}</span>
        <span className="text-black font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
          <span>View Details</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Card>
  );
};
