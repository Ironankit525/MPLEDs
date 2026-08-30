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
  PieChart,
  Pie,
  Cell
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

  const [tableSearch, setTableSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ sortBy: 'id', sortOrder: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const mpData = useMemo(() => {
    if (!projectsData) return null;
    
    // Calculate performance for all MPs (which merges MASTER_MP_RECORDS for fallback stats)
    const records = calculateMPPerformance(projectsData);
    const record = records.find((r) => r.mpId === mpId);
    
    if (!record) return null;

    // Filter projects specifically for this MP's table
    const mpProjects = projectsData.filter((p) => p.mpId === record.mpId);

    return { record, mpProjects };
  }, [projectsData, mpId]);

  const processedProjects = useMemo(() => {
    if (!mpData?.mpProjects) return [];
    let result = [...mpData.mpProjects];

    // Search
    if (tableSearch) {
      const lower = tableSearch.toLowerCase();
      result = result.filter((p) =>
        p.name?.toLowerCase().includes(lower) ||
        p.id?.toLowerCase().includes(lower) ||
        p.district?.toLowerCase().includes(lower) ||
        p.state?.toLowerCase().includes(lower) ||
        p.projectType?.toLowerCase().includes(lower)
      );
    }

    // Sort
    if (sortConfig.sortBy) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.sortBy];
        let bVal = b[sortConfig.sortBy];

        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();

        if (aVal < bVal) return sortConfig.sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [mpData, tableSearch, sortConfig]);

  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedProjects.slice(start, start + pageSize);
  }, [processedProjects, currentPage]);

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

  const { record, mpProjects } = mpData;
  const dummyAvatar = DUMMY_AVATAR; // Simplified to just one dummy for now
  
  // TABS
  const tabs = ['Overview', 'Projects', 'AI Audit', 'Financials'];

  return (
    <div className="min-h-[calc(100vh-72px)] bg-white flex -mt-3 sm:-mt-4 lg:-mt-5 -mx-3 sm:-mx-4 lg:-mx-5">
      {/* 35% Left Column */}
      <div className="w-[35%] shrink-0 border-r border-slate-200 p-8 flex flex-col sticky top-0 h-[calc(100vh-72px)] overflow-hidden">
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

      </div>
      
      {/* 65% Right Column */}
      <div className="w-[65%] bg-white min-h-full flex flex-col">
        {/* Tabs Bar */}
        <div className="flex items-center gap-8 border-b border-slate-200 px-8 pt-6 bg-white">
          {[
            { id: 'Overview', icon: Activity },
            { id: 'Projects', icon: FolderKanban }
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
          {activeTab === 'Overview' && (() => {
            const utilColor = `hsl(${(record.utilization / 100) * 120}, 85%, 45%)`;
            const riskColor = `hsl(${(record.averageRiskScore / 100) * 120}, 85%, 45%)`; // 0=Red, 100=Green
            
            const utilData = [
              { name: 'Utilized', value: record.utilization },
              { name: 'Unutilized', value: Math.max(0, 100 - record.utilization) }
            ];
            
            const riskData = [
              { name: 'Risk Score', value: record.averageRiskScore },
              { name: 'Safe', value: Math.max(0, 100 - record.averageRiskScore) }
            ];

            const unutilizedBalance = Math.max(0, record.sanctionedAmount - record.expenditure);

            return (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Fund Utilization Donut */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col items-center">
                    <h2 className="text-base font-bold text-slate-800 mb-6">Fund Utilization</h2>
                    <div className="h-48 w-full relative flex items-end justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={utilData}
                            cx="50%"
                            cy="100%"
                            startAngle={180}
                            endAngle={0}
                            innerRadius={70}
                            outerRadius={90}
                            paddingAngle={0}
                            dataKey="value"
                            stroke="none"
                            cornerRadius={4}
                          >
                            <Cell key="cell-0" fill={utilColor} />
                            <Cell key="cell-1" fill="#F1F5F9" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute bottom-2 text-center">
                        <span className="text-3xl font-black text-slate-900">{record.utilization}%</span>
                      </div>
                    </div>
                  </div>

                  {/* AI Risk Score Donut */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col items-center">
                    <h2 className="text-base font-bold text-slate-800 mb-6">AI Risk Score</h2>
                    <div className="h-48 w-full relative flex items-end justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={riskData}
                            cx="50%"
                            cy="100%"
                            startAngle={180}
                            endAngle={0}
                            innerRadius={70}
                            outerRadius={90}
                            paddingAngle={0}
                            dataKey="value"
                            stroke="none"
                            cornerRadius={4}
                          >
                            <Cell key="cell-0" fill={riskColor} />
                            <Cell key="cell-1" fill="#F1F5F9" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute bottom-2 text-center">
                        <span className="text-3xl font-black text-slate-900">{record.averageRiskScore}</span>
                        <span className="text-sm text-slate-400 font-bold">/100</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financials Section */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-base font-bold text-slate-800 mb-6">Financials</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Sanctioned</span>
                      <span className="text-xl font-black text-slate-900 font-mono">{formatCurrency(record.sanctionedAmount)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Expenditure Incurred</span>
                      <span className="text-xl font-black text-emerald-600 font-mono">{formatCurrency(record.expenditure)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Unutilized Balance</span>
                      <span className="text-xl font-black text-amber-500 font-mono">{formatCurrency(unutilizedBalance)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Sanctioned Works</span>
                      <span className="text-xl font-black text-indigo-600">{record.totalProjects}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === 'Projects' && (
            <div className="animate-in fade-in duration-300 bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
               <ProjectTableSection 
                 projects={paginatedProjects} 
                 onSelectProject={setSelectedProject}
                 tableSearch={tableSearch}
                 onTableSearchChange={(val) => { setTableSearch(val); setCurrentPage(1); }}
                 sortConfig={sortConfig}
                 onSort={(field) => {
                   setSortConfig((prev) => ({
                     sortBy: field,
                     sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc'
                   }));
                 }}
                 pagination={{ 
                   currentPage, 
                   totalPages: Math.ceil(processedProjects.length / pageSize),
                   totalCount: processedProjects.length,
                   setPage: setCurrentPage,
                   pageSize,
                   setPageSize: () => {}
                 }}
               />
            </div>
          )}
          
          {(activeTab !== 'Overview' && activeTab !== 'Projects') && (
            <p className="text-slate-500 text-sm">Content for {activeTab} will go here.</p>
          )}
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
