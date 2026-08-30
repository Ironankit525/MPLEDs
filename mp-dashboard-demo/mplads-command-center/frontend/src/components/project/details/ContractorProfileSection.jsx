import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../common/Card';
import { Badge } from '../../common/Badge';
import { 
  Building2, 
  Phone, 
  Mail, 
  Star, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ShieldCheck, 
  FileText 
} from 'lucide-react';

export const ContractorProfileSection = ({ contractor = {} }) => {
  const navigate = useNavigate();

  if (!contractor || !contractor.id) {
    return (
      <Card title="Contractor & Implementing Agency">
        <p className="text-xs text-slate-400 italic">No contractor assigned yet.</p>
      </Card>
    );
  }

  const handleNavigateContractor = () => {
    navigate(`/contractors/${contractor.id}`);
  };

  return (
    <Card className="hover:border-indigo-200 transition">
      <div className="space-y-5">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold shrink-0 shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  ID: {contractor.id}
                </span>
                <Badge variant="slate">
                  {contractor.riskLevel || 'Medium'} Risk
                </Badge>
              </div>
              <h4 className="text-base font-extrabold text-slate-900 mt-0.5 leading-snug">
                {contractor.name}
              </h4>
            </div>
          </div>

          <button
            onClick={handleNavigateContractor}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-900 text-black hover:text-white border border-slate-200 hover:border-slate-900 rounded-xl text-xs font-bold transition cursor-pointer self-start sm:self-center"
          >
            <span>View Full Directory Profile</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Delay Signal Alert if present */}
        {contractor.delaySignal && (() => {
          const isHigh = contractor.riskLevel === 'High' || contractor.delayedProjects >= 2;
          const isMedium = contractor.riskLevel === 'Medium' || (contractor.delayedProjects || 0) > 0;

          const titleColor = isHigh ? 'text-rose-700' : isMedium ? 'text-amber-700' : 'text-slate-900';
          const iconColor = isHigh ? 'text-rose-600' : isMedium ? 'text-amber-600' : 'text-slate-700';

          return (
            <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-600 font-medium">
              <AlertTriangle className={`w-4 h-4 ${iconColor} shrink-0 mt-0.5`} />
              <div>
                <strong className={`font-extrabold block ${titleColor}`}>
                  Contractor Performance Risk Signal:
                </strong>
                <p className="mt-0.5 text-slate-600">{contractor.delaySignal}</p>
              </div>
            </div>
          );
        })()}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Performance Score</span>
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <strong className="text-base font-black text-slate-900">{contractor.performanceScore ?? 78}%</strong>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Completed Works</span>
            <strong className="text-base font-black text-slate-900 mt-1 block">
              {contractor.completedProjects ?? 24} Projects
            </strong>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">On-Time Rate</span>
            <strong className="text-base font-black text-slate-900 mt-1 block">
              {contractor.onTimePercentage ?? 88}%
            </strong>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Delayed Works</span>
            <strong className="text-base font-black text-slate-900 mt-1 block">
              {contractor.delayedProjects ?? 1} Project
            </strong>
          </div>
        </div>

        {/* Work Order & Contact Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl text-xs">
          <div className="space-y-1 text-slate-600">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Work Order: <strong className="text-slate-900 font-mono">{contractor.workOrderNumber || 'WO-PENDING'}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Registration: <strong className="text-slate-900">{contractor.registrationNumber || 'Not available'}</strong></span>
            </div>
          </div>

          <div className="space-y-1 text-slate-600">
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-sky-600" />
              <span>Contact: <strong className="text-slate-900">{contractor.contactPerson || 'Not available'}</strong> ({contractor.phone || 'N/A'})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-violet-600" />
              <span>Email: <strong className="text-slate-900">{contractor.email || 'Not available'}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
