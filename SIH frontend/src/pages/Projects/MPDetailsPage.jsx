import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../../hooks/useProjects';
import { calculateMPPerformance, getStatusBadgeClass, getRiskColorClass } from '../../utils/projectAnalytics';
import { formatCurrency } from '../../utils/formatCurrency';
import { ProjectDetailsView } from '../../components/projects/ProjectDetailsView';
import { ProjectTableSection } from '../../components/projects/ProjectTableSection';
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
  const { projects: projectsData, loading, error } = useProjects();
  const [activeTab, setActiveTab] = useState('Overview');
  const [selectedProject, setSelectedProject] = useState(null);

  const mpData = useMemo(() => {
    if (!projectsData) return null;
    
    // Calculate performance for all MPs (which merges MASTER_MP_RECORDS for fallback stats)
    const records = calculateMPPerformance(projectsData);
    const record = records.find((r) => r.mpId === mpId);
    
    if (!record) return null;

    // Filter projects specifically for this MP's table
    const mpProjects = projectsData.filter((p) => p.mpId === record.mpId);

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
    <div className="min-h-[calc(100vh-72px)] bg-white flex -mt-3 sm:-mt-4 lg:-mt-5 -mx-3 sm:-mx-4 lg:-mx-5">
      {/* 35% Left Column */}
      <div className="w-[35%] shrink-0 border-r border-slate-200 p-8 min-h-full flex flex-col">
        {/* Avatar & Name */}
        <div className="flex flex-col items-center mb-8">
          <img src={dummyAvatar} alt={record.mpName} className="w-28 h-28 rounded-full object-cover mb-4" />
          <h1 className="text-xl font-semibold text-slate-900 leading-tight mb-1">{record.mpName}</h1>
          <p className="text-sm text-slate-500">#{mpId}</p>
        </div>

        {/* Member Details */}
        <div className="space-y-4 mb-8">
          <h3 className="text-[13px] font-bold text-slate-900 mb-5">Member Details</h3>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Phone</span>
            <span className="font-medium text-slate-900">91 XXXX XXXX XX</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Email</span>
            <span className="font-medium text-slate-900">{(record.mpName.split(' ')[1] || record.mpName.split(' ')[0] || 'mp').toLowerCase()}@sansad.nic.in</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Party</span>
            <span className="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md text-[13px]">
              • {record.party || 'Independent'}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">State</span>
            <span className="font-medium text-slate-900">{record.state}</span>
          </div>
        </div>

        <hr className="border-slate-100 mb-8" />

        {/* Constituency Details */}
        <div className="space-y-4 mb-8">
          <h3 className="text-[13px] font-bold text-slate-900 mb-5">Constituency</h3>
          
          <div className="flex items-start justify-between text-sm">
            <span className="text-slate-500">Region</span>
            <span className="font-medium text-slate-900 text-right">{record.constituency}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Total Projects</span>
            <span className="font-medium text-slate-900">{record.totalProjects}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Fund Utilization</span>
            <span className="font-medium text-slate-900">{record.utilization}%</span>
          </div>
        </div>

        <hr className="border-slate-100 mb-8" />

        {/* Active Projects Mini Cards */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <h3 className="text-[13px] font-bold text-slate-900">Active Projects</h3>
            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-md">{record.ongoingProjects}</span>
          </div>
          <div className="space-y-3">
            {activeTopProjects.slice(0, 3).map((proj, i) => {
              const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500'];
              const color = colors[i % colors.length];
              
              return (
                <div key={proj.id} className="p-3 border border-slate-200 rounded-xl cursor-pointer hover:border-slate-300 transition-colors group" onClick={() => setSelectedProject(proj)}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2.5 h-2.5 rounded-md ${color} shrink-0`} />
                    <h4 className="text-[15px] font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{proj.name}</h4>
                  </div>
                  <p className="text-[13px] text-slate-500 ml-[18px]">{formatCurrency(proj.expenditure)} spent • {proj.progress}% completed</p>
                </div>
              )
            })}
            {activeTopProjects.length === 0 && (
              <p className="text-sm text-slate-500">No active projects found.</p>
            )}
          </div>
        </div>
      </div>
      
      {/* 65% Right Column */}
      <div className="w-[65%] bg-white min-h-full flex flex-col">
        {/* Tabs Bar */}
        <div className="flex items-center gap-8 border-b border-slate-200 px-8 pt-6 bg-white">
          {[
            { id: 'Overview', icon: Activity },
            { id: 'Projects', icon: FolderKanban },
            { id: 'AI Audit', icon: Bot },
            { id: 'Financials', icon: FileText }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-3.5 text-[15px] font-semibold transition-colors border-b-2 relative top-[1px] ${
                  isActive 
                    ? 'border-slate-900 text-slate-900' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                {tab.id}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="p-8 flex-1">
          {activeTab === 'Overview' && (
            <div className="space-y-6">
              {/* Chart Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-lg font-semibold text-slate-900">KPI</h2>
                  <div className="flex items-center gap-3">
                    <select className="text-sm font-medium border border-slate-200 rounded-lg text-slate-700 px-3 py-1.5 focus:ring-0 focus:border-slate-300 bg-white shadow-sm cursor-pointer outline-none hover:bg-slate-50">
                      <option>Last 6 Month</option>
                    </select>
                    <button className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors shadow-sm">
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={MOCK_TREND_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}h`} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Line type="monotone" dataKey="last6" name="Last 6 Months" stroke="#3B82F6" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="prev6" name="Previous 6 Months" stroke="#CBD5E1" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Projects' && (
            <div className="animate-in fade-in duration-300 bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
               <ProjectTableSection 
                 projects={mpProjects} 
                 onSelectProject={setSelectedProject}
                 pagination={{ totalCount: mpProjects.length }}
               />
            </div>
          )}
          
          {(activeTab !== 'Overview' && activeTab !== 'Projects') && (
            <p className="text-slate-500 text-sm">Content for {activeTab} will go here.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MPDetailsPage;
