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
  Layers,
  X,
  AlertTriangle,
  Image as ImageIcon,
  ChevronRight
} from 'lucide-react';


const getGradeBadgeVariant = (grade) => {
  if (!grade) return 'slate';
  const g = grade.toUpperCase().trim();
  if (g.includes('A+') || g.includes('GRADE A') || g === 'A') return 'emerald';
  if (g.includes('B+') || g.includes('GRADE B+') || g === 'B+') return 'indigo';
  if (g.includes('B') || g.includes('GRADE B')) return 'amber';
  if (g.includes('C') || g.includes('D')) return 'rose';
  return 'slate';
};

export const ContractorDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentMP } = useAuth();

  const [contractor, setContractor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);

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
          className="inline-flex items-center gap-2 text-xs font-bold text-black hover:text-slate-700 transition"
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
    <>
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
                <Badge variant={getGradeBadgeVariant(contractor.performanceCategory)}>
                  {contractor.performanceCategory}
                </Badge>
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

          <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 block">Sanctioned Budget</span>
            <strong className="text-lg font-black text-slate-900 mt-1 block">{formatCurrency(sanctionedAmount, true)}</strong>
            <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">Total Awarded</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 block">Funds Utilized</span>
            <strong className="text-lg font-black text-slate-900 mt-1 block">{formatCurrency(utilizedAmount, true)}</strong>
            <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">{utilizationRate}% Executed</span>
          </div>
        </div>

        {/* Execution Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-700">Overall Financial Execution Rate</span>
            <span className="text-slate-900 font-extrabold text-sm">{utilizationRate}% Utilized</span>
          </div>
          <div className="w-full h-3 bg-slate-100 border border-slate-200/80 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-slate-900 rounded-full transition-all duration-500"
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
                    <strong className="text-slate-900 font-bold block mt-0.5">
                      {formatCurrency(project.utilizedAmount, true)}
                    </strong>
                  </div>
                </div>

                {/* Progress Gauge Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600">Work Completion</span>
                    <span className="text-slate-900 font-extrabold">{project.completionPercentage}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 border border-slate-200/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-900 rounded-full transition-all duration-500"
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
                    className="text-black hover:text-slate-700 font-bold hover:underline transition"
                  >
                    View Project →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section: Work Evidence Submissions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <span>AI Verification Logs & Submissions</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time audit reports, photo forensics, and verification records for this contractor's works.
            </p>
          </div>

          <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-xs font-bold">
            {contractor.totalSubmissions || 0} Submissions
          </span>
        </div>

        {(!contractor.recentSubmissions || contractor.recentSubmissions.length === 0) ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-2">
            <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">No Submissions Logged</h4>
            <p className="text-xs text-slate-400">This contractor hasn't uploaded any work-evidence photos yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {contractor.recentSubmissions.map((sub) => {
              const riskColor = 
                sub.risk_level === 'HIGH' ? 'bg-red-50 text-red-700 border-red-200' :
                sub.risk_level === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-emerald-50 text-emerald-700 border-emerald-200';
              
              return (
                <div
                  key={sub.id}
                  onClick={() => setSelectedSub(sub)}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row gap-5 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group"
                >
                  {sub.file_path && (
                    <div className="w-full md:w-32 h-32 rounded-xl overflow-hidden bg-slate-50 border border-slate-200/60 flex-shrink-0">
                      <img 
                        src={sub.file_path} 
                        alt="Submitted evidence" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        style={{ mixBlendMode: 'multiply' }}
                      />
                    </div>
                  )}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400">{sub.id}</span>
                        <span className="text-xs font-semibold text-slate-500 ml-2">Work ID: {sub.work_id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${riskColor}`}>
                          {sub.risk_level} RISK • {sub.risk_score}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-600">
                      <div className="font-semibold text-slate-800 mb-1">AI Verdict:</div>
                      {sub.recommendation}
                    </div>

                    {sub.flags && sub.flags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {sub.flags.map((flag, idx) => (
                          <span key={idx} className="px-2 py-0.5 text-[10px] font-medium bg-red-50 text-red-600 rounded border border-red-100">
                            {flag.code}: {flag.human_message || flag.message}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-indigo-500 font-semibold">Click to view full submission details →</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {/* ── SUBMISSION DETAIL MODAL ── */}
    {selectedSub && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedSub(null); }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Submission Detail</p>
              <h2 className="text-lg font-extrabold text-slate-900">{selectedSub.work_id}</h2>
              <p className="text-xs text-slate-500">{selectedSub.project_type} · {selectedSub.district}, {selectedSub.state}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Risk Badge */}
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                selectedSub.risk_level === 'HIGH' ? 'bg-red-50 text-red-700 border-red-200' :
                selectedSub.risk_level === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {selectedSub.risk_level} RISK · {selectedSub.risk_score}
              </span>
              <button
                onClick={() => setSelectedSub(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LEFT: Photo */}
            <div className="space-y-4">
              {selectedSub.file_path ? (
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img
                    src={selectedSub.file_path}
                    alt="Submission evidence"
                    className="w-full object-cover max-h-72"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center h-48">
                  <ImageIcon className="w-10 h-10 text-slate-300" />
                </div>
              )}

              {/* Details table */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Details</h3>
                {[
                  { label: 'Submitted', value: selectedSub.submitted_at ? new Date(selectedSub.submitted_at).toLocaleString('en-IN') : '—' },
                  { label: 'MP', value: selectedSub.mp_name || contractor?.name || '—' },
                  { label: 'Agency', value: selectedSub.agency_name || '—' },
                  { label: 'Recommendation', value: selectedSub.recommendation || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-4 text-xs">
                    <span className="text-slate-500 font-semibold shrink-0">{label}</span>
                    <span className="text-slate-800 text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: Review Progress + Automated Findings */}
            <div className="space-y-4">
              {/* Review Progress */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-4">Review Progress</h3>
                {[
                  { label: 'Submitted', desc: `Uploaded on ${selectedSub.submitted_at ? new Date(selectedSub.submitted_at).toLocaleString('en-IN') : '—'}`, done: true },
                  { label: 'Pending Review', desc: 'Waiting for a verification officer to pick this up.', done: false, active: true },
                  { label: 'In Review', desc: 'A verification officer is checking the evidence.', done: false },
                  { label: 'Approved', desc: 'Awaiting a final decision.', done: false },
                  { label: 'Signed Off', desc: 'Awaiting a final decision first.', done: false },
                ].map((step, i) => (
                  <div key={i} className="flex gap-3 mb-3 last:mb-0">
                    <div className="flex flex-col items-center">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        step.done ? 'bg-emerald-500 border-emerald-500' :
                        step.active ? 'border-indigo-500 bg-indigo-50' :
                        'border-slate-300'
                      }`}>
                        {step.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                        {step.active && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                      </div>
                      {i < 4 && <div className="w-px h-6 bg-slate-200 mt-1" />}
                    </div>
                    <div className="pb-2">
                      <p className={`text-xs font-bold ${ step.done ? 'text-emerald-700' : step.active ? 'text-indigo-700' : 'text-slate-400' }`}>{step.label}</p>
                      <p className="text-[11px] text-slate-500">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Automated Check Details */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className={`p-4 border-b ${
                  selectedSub.risk_level === 'HIGH' ? 'bg-red-50/30 border-red-100' :
                  selectedSub.risk_level === 'MEDIUM' ? 'bg-amber-50/30 border-amber-100' :
                  'bg-emerald-50/30 border-emerald-100'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                      selectedSub.risk_level === 'HIGH' ? 'bg-red-50 text-red-700 border-red-200' :
                      selectedSub.risk_level === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        selectedSub.risk_level === 'HIGH' ? 'bg-red-500' :
                        selectedSub.risk_level === 'MEDIUM' ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`} />
                      {selectedSub.risk_level} RISK · {selectedSub.risk_score}
                    </span>
                  </div>
                  
                  <h3 className={`font-bold text-sm ${
                    selectedSub.risk_level === 'HIGH' ? 'text-red-800' :
                    selectedSub.risk_level === 'MEDIUM' ? 'text-amber-800' :
                    'text-emerald-800'
                  }`}>
                    {selectedSub.risk_score === 0 
                      ? 'System cleared' 
                      : (selectedSub.recommendation?.split('—')[0]?.trim() || selectedSub.recommendation)}
                  </h3>
                  
                  {(selectedSub.risk_score === 0 || selectedSub.recommendation?.includes('—')) && (
                    <p className={`text-xs mt-0.5 mb-3 ${
                      selectedSub.risk_level === 'HIGH' ? 'text-red-600' :
                      selectedSub.risk_level === 'MEDIUM' ? 'text-amber-600' :
                      'text-emerald-600'
                    }`}>
                      {selectedSub.risk_score === 0 
                        ? 'automated checks raised no findings.' 
                        : selectedSub.recommendation.split('—')[1]?.trim()}
                    </p>
                  )}

                  <div className="mt-3 space-y-1.5 text-[11px] text-slate-600">
                    <p><span className="font-semibold text-slate-500">Capture date:</span> {selectedSub.capture_date ? new Date(selectedSub.capture_date).toLocaleString('en-IN') : 'Unavailable in the uploaded file'}</p>
                    <p><span className="font-semibold text-slate-500">Project-evidence validity:</span> {selectedSub.work_evidence_status || 'UNKNOWN'} ({selectedSub.work_evidence_probability !== undefined ? (selectedSub.work_evidence_probability * 100).toFixed(1) : 0}% confidence)</p>
                    <p><span className="font-semibold text-slate-500">Screen-capture model:</span> {selectedSub.screen_probability !== undefined ? (selectedSub.screen_probability * 100).toFixed(1) : 0}% ({selectedSub.screen_model_name || 'google/siglip-base-patch16-224'})</p>
                  </div>
                </div>

                {selectedSub.flags && selectedSub.flags.length > 0 ? (
                  <div className="p-4">
                    <h3 className="text-sm font-bold text-slate-800 mb-4">Automated findings</h3>
                    <div className="space-y-4">
                      {selectedSub.flags.map((flag, idx) => {
                        const isHigh = flag.severity === 'HIGH' || flag.risk_points >= 20 || flag.points_added >= 20;
                        return (
                          <div key={idx} className="space-y-1">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                              isHigh ? 'bg-[#4B2323] text-red-50' : 'bg-[#5B4210] text-amber-50'
                            }`}>
                              <AlertTriangle className="w-3 h-3" />
                              {flag.severity || (isHigh ? 'HIGH' : 'MEDIUM')}
                            </span>
                            <p className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{flag.code}</p>
                            <p className="text-[11px] text-slate-500 leading-relaxed">{flag.human_message || flag.message}</p>
                            {(flag.points_added || flag.risk_points) && (
                              <p className="text-[11px] text-slate-800 font-semibold">+{flag.points_added || flag.risk_points} risk points</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <p className="text-xs font-semibold text-emerald-700">No anomalies detected by automated checks.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
