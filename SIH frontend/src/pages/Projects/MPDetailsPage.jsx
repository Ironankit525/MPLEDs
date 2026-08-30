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
      {/* 30% Left Column */}
      <div className="w-[30%] shrink-0 border-r border-slate-200 p-6 min-h-full flex flex-col">
        <p className="text-slate-500">Left Column (30%)</p>
      </div>
      
      {/* 70% Right Column */}
      <div className="w-[70%] p-6 bg-slate-50 min-h-full flex flex-col">
        <p className="text-slate-500">Right Column (70%)</p>
      </div>
    </div>
  );
};

export default MPDetailsPage;
