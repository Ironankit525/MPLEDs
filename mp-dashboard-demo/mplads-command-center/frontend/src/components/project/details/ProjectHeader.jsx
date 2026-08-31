import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../common/Badge.jsx';
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS } from '../../../constants/projectStatus.js';
import { ArrowLeft, MapPin, Calendar, Copy, Check, Clock, ShieldCheck, Tag } from 'lucide-react';

export const ProjectHeader = ({ project }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!project) return null;

  const handleCopyId = () => {
    navigator.clipboard?.writeText(project.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const badgeVariant = PROJECT_STATUS_COLORS[project.status] || 'indigo';

  return (
    <div className="space-y-4">
      {/* Top Navigation & Updated Timestamp */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate('/projects')}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-black hover:text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1.5 bg-white border border-slate-200/80 px-2.5 py-1 rounded-lg shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Last updated: <strong className="text-slate-700">{project.dates?.lastUpdated || 'Recently synchronized'}</strong></span>
          </span>
        </div>
      </div>

      {/* Main Header Banner Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-800 rounded-lg text-xs font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3 text-indigo-600" />
                {project.sector || 'Infrastructure'}
              </span>

              <span className="text-slate-300">•</span>

              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>{project.location?.village || project.location?.area}, {project.location?.district} ({project.location?.state})</span>
              </span>

              <span className="text-slate-300">•</span>

              <span className="text-xs font-medium text-slate-500">
                FY: <strong className="text-slate-900">{project.financialYear || '2026-27'}</strong>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {project.title || project.name}
            </h1>

            {project.description && (
              <p className="text-xs sm:text-sm text-slate-600 max-w-4xl leading-relaxed">
                {project.description}
              </p>
            )}
          </div>

          {/* Status Badge & Project ID */}
          <div className="flex lg:flex-col items-end justify-between lg:justify-center gap-3 shrink-0">
            <Badge variant={badgeVariant} className="text-sm px-3.5 py-1.5 font-extrabold shadow-2xs">
              {PROJECT_STATUS_LABELS[project.status] || project.status}
            </Badge>

            <button
              onClick={handleCopyId}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 transition cursor-pointer"
              title="Click to copy Project ID"
            >
              <span className="text-slate-400 font-sans font-semibold text-[11px]">ID:</span>
              <span>{project.id}</span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* Quick Reference Breadcrumbs / Sub-meta */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 pt-1">
          <div className="flex flex-wrap items-center gap-4">
            <span>Constituency: <strong className="text-slate-900">{project.location?.constituency || 'Pune'}</strong></span>
            <span>Block/Area: <strong className="text-slate-900">{project.location?.area || project.location?.village}</strong></span>
            <span>Beneficiaries: <strong className="text-slate-900">{project.beneficiaries?.toLocaleString() || '4,200'} Citizens</strong></span>
          </div>

          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>MPLADS Sanctioned Work</span>
          </div>
        </div>
      </div>
    </div>
  );
};
