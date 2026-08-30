import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../../hooks/useProjects';
import { calculateMPPerformance, getStatusBadgeClass, getRiskColorClass } from '../../utils/projectAnalytics';
import { formatCurrency } from '../../utils/formatCurrency';
import { ProjectDetailsView } from '../../components/projects/ProjectDetailsView';
import { MPSkeletonPreloader } from '../../components/ui/SkeletonPreloader';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { MapPin, Phone, Mail, Calendar, ArrowLeft, ArrowUpRight, CheckCircle2, AlertTriangle, FileText, Briefcase, Activity, FolderKanban, Bot, Hash } from 'lucide-react';

const DUMMY_AVATAR = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80';

// Mock trend data for KPI
const MOCK_TREND_DATA = [
  { month: 'Jan', last6: 0, prev6: 0 },
  { month: 'Feb', last6: 3.8, prev6: 3.5 },
  { month: 'Mar', last6: 3.2, prev6: 4.1 },
  { month: 'Apr', last6: 3.9, prev6: 2.8 },
  { month: 'May', last6: 6.5, prev6: 5.8 },
  { month: 'Jun', last6: 5.8, prev6: 6.2 },
  { month: 'Jul', last6: 7.5, prev6: 7.0 },
];

export const MPDetailsPage = () => {
  const { mpId } = useParams();
  const navigate = useNavigate();
  const { projectsData, loading, error } = useProjects();
  const [activeTab, setActiveTab] = useState('Overview');
  const [selectedProject, setSelectedProject] = useState(null);

  // Compute MP specific data
  const mpData = useMemo(() => {
    if (!projectsData || projectsData.length === 0) return null;
    const mpProjects = projectsData.filter((p) => p.mpId === mpId);
    if (mpProjects.length === 0) return null;

    const record = calculateMPPerformance(mpProjects[0].mpName, mpProjects);
    
    // Pick the top 4 active projects for progress bars
    const activeTopProjects = mpProjects
      .filter((p) => p.progress < 100)
      .sort((a, b) => b.expenditure - a.expenditure)
      .slice(0, 4);

    return { record, mpProjects, activeTopProjects };
  }, [projectsData, mpId]);

  if (loading) {
    return (
      <div className="w-full h-screen bg-white pt-10 px-6">
        <MPSkeletonPreloader />
      </div>
    );
  }

  if (error || !mpData) {
    return (
      <div className="p-8 text-center bg-white min-h-[50vh] flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold text-slate-800">MP Profile Not Found</h2>
        <button onClick={() => navigate(-1)} className="mt-4 text-indigo-600 font-bold hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  const { record, mpProjects, activeTopProjects } = mpData;
  const dummyAvatar = DUMMY_AVATAR; // Simplified to just one dummy for now
  
  // TABS
  const tabs = ['Overview', 'Projects', 'AI Audit', 'Financials'];

  return (
    <div className="min-h-full bg-slate-50/50 p-2 sm:p-4 lg:p-6 mb-16">
      {/* Breadcrumb Header */}
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 mb-6 font-sans">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>MPs Directory</span>
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-bold">{record.mpName}</span>
        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-bold text-xs ml-1 border border-indigo-100">
          • {record.house}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ==================================================== */}
        {/* LEFT COLUMN: PROFILE SIDEBAR */}
        {/* ==================================================== */}
        <div className="w-full lg:w-[320px] shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
          {/* Avatar & Name */}
          <div className="flex flex-col items-center border-b border-slate-100 pb-6 mb-6">
            <img src={dummyAvatar} alt={record.mpName} className="w-24 h-24 rounded-full object-cover border-2 border-slate-100 shadow-sm mb-4" />
            <h1 className="text-lg font-bold text-slate-900 text-center leading-tight mb-1">{record.mpName}</h1>
            <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">#{mpId}</p>
          </div>

          {/* Member Details */}
          <div className="space-y-3.5 mb-8">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">Member Details</h3>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-2"><Phone className="w-3.5 h-3.5"/> Phone</span>
              <span className="font-bold text-slate-900 font-mono">+91 {Math.floor(Math.random() * 9000000000) + 1000000000}</span>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-2"><Mail className="w-3.5 h-3.5"/> Email</span>
              <span className="font-bold text-slate-900">{record.mpName.split(' ')[1]?.toLowerCase()}@sansad.nic.in</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-2"><Briefcase className="w-3.5 h-3.5"/> Party</span>
              <span className="font-bold text-slate-900">{record.party || 'Independent'}</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-2"><Calendar className="w-3.5 h-3.5"/> State</span>
              <span className="font-bold text-slate-900">{record.state}</span>
            </div>
          </div>

          {/* Constituency Address */}
          <div className="space-y-3.5 mb-8">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">Constituency</h3>
            
            <div className="flex items-start justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-2 shrink-0"><MapPin className="w-3.5 h-3.5"/> Region</span>
              <span className="font-bold text-slate-900 text-right leading-tight max-w-[150px]">{record.constituency}</span>
            </div>
            
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500 flex items-center gap-2"><Hash className="w-3.5 h-3.5"/> Total Projects</span>
              <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{record.totalProjects}</span>
            </div>
          </div>

          {/* Active Projects Mini Cards */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Active Projects</h3>
              <span className="bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{record.ongoingProjects}</span>
            </div>
            <div className="space-y-2.5">
              {activeTopProjects.slice(0, 3).map((proj, i) => {
                const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500'];
                const color = colors[i % colors.length];
                
                return (
                  <div key={proj.id} className="p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all group" onClick={() => setSelectedProject(proj)}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${color} shrink-0`} />
                      <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{proj.name}</h4>
                    </div>
                    <p className="text-[10px] text-slate-500 ml-4 font-semibold">{formatCurrency(proj.expenditure)} spent • {proj.progress}% completed</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* RIGHT COLUMN: TABS & MAIN CONTENT */}
        {/* ==================================================== */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-slate-200 mb-6 overflow-x-auto hide-scrollbar px-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-bold transition-all whitespace-nowrap border-b-2 ${
                  activeTab === tab
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab === 'Overview' && <Activity className="w-4 h-4 inline-block mr-2 align-text-bottom text-slate-400" />}
                {tab === 'Projects' && <FolderKanban className="w-4 h-4 inline-block mr-2 align-text-bottom text-slate-400" />}
                {tab === 'AI Audit' && <Bot className="w-4 h-4 inline-block mr-2 align-text-bottom text-slate-400" />}
                {tab === 'Financials' && <FileText className="w-4 h-4 inline-block mr-2 align-text-bottom text-slate-400" />}
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="w-full">
            {/* ----------------- OVERVIEW TAB ----------------- */}
            {activeTab === 'Overview' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Chart Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-base font-bold text-slate-900">KPI / Fund Utilization (₹ Cr)</h2>
                    <div className="flex items-center gap-2">
                      <select className="text-[11px] font-bold border border-slate-200 rounded-lg text-slate-700 px-3 py-1.5 focus:ring-0 focus:border-slate-300 bg-slate-50">
                        <option>Last 6 Months</option>
                      </select>
                      <button className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors">
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={MOCK_TREND_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}k`} />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line type="monotone" dataKey="last6" name="Last 6 Months" stroke="#3B82F6" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="prev6" name="Previous 6 Months" stroke="#CBD5E1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-0.5 bg-blue-500" />
                      <span className="text-xs font-bold text-slate-600">Last 6 Months</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-0.5 bg-slate-300 border border-slate-300 border-dashed" />
                      <span className="text-xs font-bold text-slate-600">Previous 6 Months</span>
                    </div>
                  </div>
                </div>

                {/* Progress Bars Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-base font-bold text-slate-900">Project Completion</h2>
                    <button className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors">
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    {activeTopProjects.map((proj, i) => {
                      const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500'];
                      const color = colors[i % colors.length];
                      
                      return (
                        <div key={proj.id} className="group cursor-pointer" onClick={() => setSelectedProject(proj)}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[13px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{proj.name}</span>
                            <span className="text-xs font-bold text-slate-700">{proj.progress}%</span>
                          </div>
                          <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                            <div className={`h-full ${color} rounded-l-full transition-all duration-1000 ease-out`} style={{ width: `${proj.progress}%` }} />
                            {proj.progress < 100 && (
                              <div className="h-full flex-1 border-y border-r border-slate-200/60 rounded-r-full" style={{
                                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.03) 4px, rgba(0,0,0,0.03) 8px)'
                              }} />
                            )}
                          </div>
                        </div>
                      )
                    })}
                    
                    {activeTopProjects.length === 0 && (
                      <div className="text-center py-6 text-sm text-slate-500 font-medium">
                        No active projects currently available.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- PROJECTS TAB ----------------- */}
            {activeTab === 'Projects' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
                <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Sanctioned Infrastructure Works 
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{mpProjects.length}</span>
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase font-black tracking-wider text-[10px] border-b border-slate-200">
                        <th className="p-4 pl-6">Project</th>
                        <th className="p-4">Sector</th>
                        <th className="p-4">Sanctioned</th>
                        <th className="p-4">Spent</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 pr-6 text-center">AI Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {mpProjects.map((proj) => {
                        const sBadge = getStatusBadgeClass(proj.status);
                        const rBadge = getRiskColorClass(proj.riskScore);
                        return (
                          <tr key={proj.id} onClick={() => setSelectedProject(proj)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                            <td className="p-4 pl-6">
                              <span className="font-mono font-bold text-slate-400 text-[10px] block mb-0.5">{proj.id}</span>
                              <span className="font-bold text-slate-900 text-[13px] block group-hover:text-indigo-600 transition-colors">{proj.name}</span>
                            </td>
                            <td className="p-4">
                              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-bold text-[10px] whitespace-nowrap">{proj.projectType}</span>
                            </td>
                            <td className="p-4 font-mono font-bold whitespace-nowrap">{formatCurrency(proj.sanctionedAmount)}</td>
                            <td className="p-4 font-mono font-bold whitespace-nowrap">{formatCurrency(proj.expenditure)}</td>
                            <td className="p-4 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${sBadge.bg}`}>{sBadge.label}</span>
                            </td>
                            <td className="p-4 pr-6 text-center">
                              <span className={`px-2.5 py-1 rounded-full font-mono text-[10px] font-bold border ${rBadge.bg}`}>{proj.riskScore}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ----------------- AI AUDIT TAB ----------------- */}
            {activeTab === 'AI Audit' && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl border border-slate-800 p-6 sm:p-8 space-y-6 shadow-lg shadow-indigo-900/10 animate-in fade-in duration-300">
                <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/20">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">AI Compliance Audit</h4>
                      <p className="text-xs text-slate-400 font-medium mt-1">Automated diagnostics for {record.constituency}</p>
                    </div>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-400 text-[11px] font-bold px-3 py-1.5 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    System Audit Active
                  </span>
                </div>

                <div className="p-6 bg-slate-900/80 rounded-2xl border border-slate-800 text-sm space-y-5 leading-relaxed">
                  <p className="font-medium text-slate-300">
                    <strong className="text-white text-base">Audit Findings</strong><br/><br/>
                    Financial fund utilization rate for <strong>{record.mpName}</strong> is verified at <strong>{record.utilization}%</strong>. Physical milestone progress across {record.totalProjects} sanctioned works reflects an average AI risk score of <strong>{record.averageRiskScore}/100</strong>.
                  </p>
                  
                  <div className="flex flex-col gap-3 pt-2">
                    {record.delayedProjects > 0 ? (
                      <div className="flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                        <p className="text-amber-200/90 font-medium text-sm leading-relaxed">
                          <strong className="text-amber-400 block mb-1">System Notice</strong>
                          {record.delayedProjects} ongoing infrastructure works currently flag execution delay risks. Recommended for nodal officer field inspection to clear bottlenecks.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                        <p className="text-emerald-200/90 font-medium text-sm leading-relaxed">
                          All sanctioned works in {record.constituency} are executing according to approved schedule. No critical anomalies detected by spatial monitoring.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- FINANCIALS TAB ----------------- */}
            {activeTab === 'Financials' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 animate-in fade-in duration-300">
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center group hover:border-slate-300 transition-colors">
                  <span className="text-[11px] uppercase font-black tracking-wider text-slate-400 mb-2">Total Fund Sanctioned</span>
                  <span className="text-3xl font-mono font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{formatCurrency(record.totalSanctioned)}</span>
                </div>
                <div className="bg-emerald-50/50 p-6 sm:p-8 rounded-2xl border border-emerald-100 flex flex-col justify-center items-center text-center">
                  <span className="text-[11px] uppercase font-black tracking-wider text-emerald-600/80 mb-2">Fund Utilization</span>
                  <span className="text-3xl font-mono font-black text-emerald-600">{record.utilization}%</span>
                </div>
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center group hover:border-slate-300 transition-colors">
                  <span className="text-[11px] uppercase font-black tracking-wider text-slate-400 mb-2">Completed Works</span>
                  <span className="text-3xl font-mono font-black text-slate-900">{record.completedProjects}</span>
                </div>
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center group hover:border-slate-300 transition-colors">
                  <span className="text-[11px] uppercase font-black tracking-wider text-slate-400 mb-2">Ongoing Works</span>
                  <span className="text-3xl font-mono font-black text-slate-900">{record.ongoingProjects}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Project Modal View */}
      {selectedProject && (
        <ProjectDetailsView project={selectedProject} onClose={() => setSelectedProject(null)} />
      )}
    </div>
  );
};

export default MPDetailsPage;
