import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { contractorService } from './contractorService.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Loader } from '../../components/common/Loader.jsx';
import { ErrorState } from '../../components/common/ErrorState.jsx';
import { SpeedometerGauge } from '../../components/common/SpeedometerGauge.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { ROUTES } from '../../constants/routes.js';
import { 
  Building2, 
  Star, 
  Phone, 
  Mail, 
  CheckCircle2, 
  ArrowLeft, 
  FolderKanban, 
  MapPin, 
  Calendar, 
  Coins, 
  ShieldCheck, 
  Clock, 
  Layers 
} from 'lucide-react';

export const ContractorDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentMP } = useAuth();

  const [contractor, setContractor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPromoterDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const mpId = currentMP?.id || 'MP001';
        const data = await contractorService.getContractorById(id, mpId);
        setContractor(data);
      } catch (err) {
        console.error('Error fetching promoter details:', err);
        setError(`Failed to retrieve promoter with ID "${id}".`);
      } finally {
        setLoading(false);
      }
    };

    fetchPromoterDetails();
  }, [id, currentMP]);

  if (loading) return <Loader label="Retrieving Promoter Profile & Project History..." />;

  if (error || !contractor) {
    return (
      <div className="space-y-4">
        <Link
          to={ROUTES.CONTRACTORS}
          className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Promoters Directory</span>
        </Link>
        <ErrorState message={error || 'Promoter record not found.'} />
      </div>
    );
  }

  const allProjects = contractor.allProjects || contractor.assignedProjects || [];
  const sanctionedAmount = contractor.globalTotalSanctioned || contractor.mpTotalSanctioned || 0;
  const utilizedAmount = contractor.globalTotalUtilized || contractor.mpTotalUtilized || 0;
  const utilizationRate = contractor.globalUtilizationRate || contractor.mpUtilizationRate || 0;

  return (
    <div className="space-y-6">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(ROUTES.CONTRACTORS)}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Promoters Directory</span>
        </button>

        <span className="text-xs font-semibold text-slate-400">
          ID: {contractor.id} • {contractor.registrationNumber}
        </span>
      </div>

      {/* Promoter Profile Hero Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold shrink-0 shadow-md">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {contractor.registrationNumber}
                </span>
                <Badge variant="emerald">{contractor.performanceCategory}</Badge>
                <span className="text-xs text-slate-500 flex items-center gap-1 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Empanelled Vendor
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 leading-snug">
                {contractor.name}
              </h1>
            </div>
          </div>

          <SpeedometerGauge score={contractor.rating} maxScore={5.0} label="Empanelled Score" />
        </div>

        {/* Basic Data & Financial KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 block">Contact Signatory</span>
            <strong className="text-sm font-bold text-slate-900 mt-1 block truncate">{contractor.contactPerson}</strong>
            <span className="text-[11px] text-slate-500 block mt-0.5">{contractor.phone}</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 block">Corporate Email</span>
            <strong className="text-xs font-bold text-slate-900 mt-1 block truncate">{contractor.email}</strong>
            <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">Verified Corporate</span>
          </div>

          <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl">
            <span className="text-xs font-bold text-indigo-700 block">Sanctioned Budget</span>
            <strong className="text-lg font-black text-indigo-900 mt-1 block">{formatCurrency(sanctionedAmount, true)}</strong>
            <span className="text-[11px] text-indigo-700 font-semibold block mt-0.5">Total Awarded</span>
          </div>

          <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl">
            <span className="text-xs font-bold text-emerald-700 block">Funds Utilized</span>
            <strong className="text-lg font-black text-emerald-900 mt-1 block">{formatCurrency(utilizedAmount, true)}</strong>
            <span className="text-[11px] text-emerald-700 font-semibold block mt-0.5">{utilizationRate}% Executed</span>
          </div>
        </div>

        {/* Execution Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-700">Overall Financial Execution Rate</span>
            <span className="text-emerald-700 font-extrabold text-sm">{utilizationRate}% Utilized</span>
          </div>
          <div className="w-full h-3 bg-slate-100 border border-slate-200/80 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(utilizationRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Section: All Projects Executed by Promoter */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-indigo-600" />
              <span>All Projects Executed by Promoter</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete list of civil infrastructure projects awarded to and executed by {contractor.name}.
            </p>
          </div>

          <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-xs font-bold">
            {allProjects.length} {allProjects.length === 1 ? 'Project' : 'Projects'} Total
          </span>
        </div>

        {allProjects.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-2">
            <FolderKanban className="w-8 h-8 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">No Projects Found</h4>
            <p className="text-xs text-slate-400">There are no active or completed projects linked to this promoter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {allProjects.map((project) => (
              <div
                key={project.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-indigo-300 transition-all space-y-4"
              >
                {/* Project Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400">{project.id}</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-md">
                        {project.sector}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1 leading-snug">
                      {project.name}
                    </h3>
                  </div>

                  <Badge variant={project.status === 'COMPLETED' ? 'emerald' : 'amber'}>
                    {project.status}
                  </Badge>
                </div>

                {/* Location Info */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    {project.location?.village}, {project.location?.district}, {project.location?.state}
                  </span>
                </div>

                {/* Financial KPI Summary */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block">Sanctioned</span>
                    <strong className="text-slate-900 font-bold block mt-0.5">
                      {formatCurrency(project.sanctionedAmount, true)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block">Released</span>
                    <strong className="text-slate-800 font-bold block mt-0.5">
                      {formatCurrency(project.releasedAmount, true)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block">Utilized</span>
                    <strong className="text-emerald-700 font-bold block mt-0.5">
                      {formatCurrency(project.utilizedAmount, true)}
                    </strong>
                  </div>
                </div>

                {/* Progress Gauge Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600">Work Completion</span>
                    <span className="text-indigo-700 font-extrabold">{project.completionPercentage}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 border border-slate-200/80 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        project.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${project.completionPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Dates & Link Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Target: {project.expectedCompletionDate}
                  </span>

                  <Link
                    to={`/projects/${project.id}`}
                    className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline transition"
                  >
                    View Project →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
