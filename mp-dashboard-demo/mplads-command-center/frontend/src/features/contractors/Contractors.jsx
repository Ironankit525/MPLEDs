import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { contractorService } from './contractorService.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Loader } from '../../components/common/Loader.jsx';
import { PromoterPerformanceChart } from '../../components/charts/PromoterPerformanceChart.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { 
  Building2, 
  Star, 
  Phone, 
  Mail, 
  CheckCircle2, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  FolderKanban, 
  Award, 
  Coins, 
  Layers,
  ArrowRight
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

export const Contractors = () => {
  const navigate = useNavigate();
  const { currentMP } = useAuth();
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState('mp'); // 'mp' | 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [expandedContractorId, setExpandedContractorId] = useState(null);

  useEffect(() => {
    const fetchContractors = async () => {
      setLoading(true);
      try {
        const mpId = currentMP?.id || 'MP001';
        const data = await contractorService.getContractors(mpId);
        setContractors(data);
      } catch (err) {
        console.error('Error fetching contractors:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchContractors();
  }, [currentMP]);

  if (loading) return <Loader label="Loading Registered Promoters & Contractors Directory..." />;

  const isMpScope = scope === 'mp';

  // Filter contractors based on scope, search query, and category
  const filteredContractors = contractors.filter((c) => {
    // If MP scope, only include promoters that have projects assigned under current MP
    if (isMpScope && c.mpProjectsCount === 0) {
      return false;
    }

    // Category filter
    if (categoryFilter !== 'ALL' && c.performanceCategory !== categoryFilter) {
      return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = c.name.toLowerCase().includes(q);
      const regMatch = c.registrationNumber.toLowerCase().includes(q);
      const contactMatch = c.contactPerson.toLowerCase().includes(q);
      return nameMatch || regMatch || contactMatch;
    }

    return true;
  });

  // Calculate executive aggregate metrics
  const totalPromoters = filteredContractors.length;
  const totalProjectsAllocated = filteredContractors.reduce(
    (sum, c) => sum + (isMpScope ? c.mpProjectsCount : c.globalProjectsCount),
    0
  );
  const totalSanctionedBudget = filteredContractors.reduce(
    (sum, c) => sum + (isMpScope ? c.mpTotalSanctioned : c.globalTotalSanctioned),
    0
  );
  const avgRating = totalPromoters > 0
    ? (filteredContractors.reduce((sum, c) => sum + c.rating, 0) / totalPromoters).toFixed(1)
    : '0.0';

  const toggleExpand = (id) => {
    setExpandedContractorId(expandedContractorId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Empanelled Promoters & Civil Contractors Directory"
        description="Comprehensive registry of promoters executing MPLADS infrastructure projects across constituency jurisdictions."
      />

      {/* Top Executive Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Promoters Active</span>
            <span className="text-xl font-extrabold text-slate-900">{totalPromoters} Promoters</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Work Orders Assigned</span>
            <span className="text-xl font-extrabold text-slate-900">{totalProjectsAllocated} Projects</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Budget Awarded</span>
            <span className="text-xl font-extrabold text-slate-900">{formatCurrency(totalSanctionedBudget, true)}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 shrink-0">
            <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Avg Rating Score</span>
            <span className="text-xl font-extrabold text-slate-900">{avgRating} / 5.0 Rating</span>
          </div>
        </div>
      </div>

      {/* Scope Switcher & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
        {/* Scope Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setScope('mp')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              scope === 'mp'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Current MP Promoters ({currentMP?.name || 'Pune MP'})
          </button>
          <button
            onClick={() => setScope('all')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              scope === 'all'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Empanelled Promoters ({contractors.length})
          </button>
        </div>

        {/* Search & Category Inputs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 max-w-xl">
          {/* Search Box */}
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search promoter name, registration ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:bg-white transition"
            />
          </div>

          {/* Grade Category Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-500 cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="Grade A">Grade A</option>
              <option value="Grade B+">Grade B+</option>
            </select>
          </div>
        </div>
      </div>

      {/* Comparative Performance Visual Charts Section */}
      <PromoterPerformanceChart contractors={filteredContractors} isGlobalScope={!isMpScope} />

      {/* Promoter Cards Section Title */}
      <div className="flex items-center justify-between pt-2">
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Layers className="w-4.5 h-4.5 text-slate-900" />
          <span>Promoter Directory Cards ({filteredContractors.length})</span>
        </h3>
        <span className="text-xs text-slate-500 font-medium">
          Showing promoters for {isMpScope ? currentMP?.name || 'Selected Constituency' : 'All Empanelled Registrations'}
        </span>
      </div>

      {/* Promoter Cards Grid */}
      {filteredContractors.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
          <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
          <h4 className="text-base font-bold text-slate-700">No Promoters Found</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No promoter matches the active filters or scope criteria. Try clearing search terms or toggling to all empanelled promoters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredContractors.map((c) => {
            const projects = isMpScope ? c.assignedProjects : c.allProjects;
            const sanctionedAmount = isMpScope ? c.mpTotalSanctioned : c.globalTotalSanctioned;
            const utilizedAmount = isMpScope ? c.mpTotalUtilized : c.globalTotalUtilized;
            const utilizationRate = isMpScope ? c.mpUtilizationRate : c.globalUtilizationRate;
            const isExpanded = expandedContractorId === c.id;

            return (
              <div key={c.id} className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs hover:shadow-md hover:border-slate-300 transition-all space-y-5 flex flex-col justify-between">
                <div className="space-y-5">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                        {c.registrationNumber}
                      </span>
                      <h4 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1 leading-snug">{c.name}</h4>
                    </div>
                    <Badge variant={getGradeBadgeVariant(c.performanceCategory)}>
                      {c.performanceCategory}
                    </Badge>
                  </div>

                  {/* Minimal KPI Metrics Cards (Bigger Data Points) */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl text-center">
                      <span className="text-xs font-semibold text-slate-500 block">Rating Score</span>
                      <div className="flex items-center justify-center gap-1.5 mt-1">
                        <Star className="w-4 h-4 fill-slate-900 text-slate-900 shrink-0" />
                        <span className="text-xl font-black text-slate-900">{c.rating}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl text-center">
                      <span className="text-xs font-semibold text-slate-500 block">Sanctioned Funds</span>
                      <div className="text-lg sm:text-xl font-black text-slate-900 mt-1 truncate">
                        {formatCurrency(sanctionedAmount, true)}
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl text-center">
                      <span className="text-xs font-semibold text-slate-500 block">Assigned Works</span>
                      <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                        {projects.length} {projects.length === 1 ? 'Work' : 'Works'}
                      </div>
                    </div>
                  </div>

                  {/* Minimal Financial Execution Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700">Financial Execution</span>
                      <span className="text-slate-900 font-extrabold text-sm">{utilizationRate}% Utilized</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 border border-slate-200/80 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-900 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(utilizationRate, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Collapsible Assigned Projects Breakdown */}
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/60">
                    <button
                      onClick={() => toggleExpand(c.id)}
                      className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-800 hover:bg-slate-100/80 transition"
                    >
                      <span className="flex items-center gap-2">
                        <FolderKanban className="w-4 h-4 text-slate-700" />
                        <span>Assigned Projects under Promoter ({projects.length})</span>
                      </span>
                      <span className="flex items-center gap-1 text-xs font-bold text-black">
                        {isExpanded ? 'Hide Works' : 'View Works'}
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="p-3 border-t border-slate-200/80 space-y-2 bg-white">
                        {projects.length === 0 ? (
                          <p className="text-xs text-slate-400 italic p-2">No assigned projects under current scope.</p>
                        ) : (
                          projects.map((p) => (
                            <div
                              key={p.id}
                              className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl space-y-2 text-xs hover:bg-slate-100 transition"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="text-[11px] font-bold text-slate-400">{p.id} • {p.sector}</span>
                                  <h5 className="text-sm font-bold text-slate-900 leading-snug mt-0.5">{p.name}</h5>
                                </div>
                                <span
                                  className={`px-2.5 py-1 text-[11px] font-extrabold rounded-full shrink-0 ${
                                    p.status === 'COMPLETED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {p.status}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-xs text-slate-600 font-semibold pt-1 border-t border-slate-200/60">
                                <span>Sanctioned: <strong className="text-slate-900 font-bold">{formatCurrency(p.sanctionedAmount, true)}</strong></span>
                                <span>Progress: <strong className="text-slate-900 font-bold">{p.completionPercentage}%</strong></span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Minimal Essential Contact Footer with View Details Button */}
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Contact: <strong className="text-slate-900 font-bold">{c.contactPerson}</strong></span>
                  </div>

                  <button
                    onClick={() => navigate(`/mp/contractors/${c.id}`)}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-900 text-black hover:text-white border border-slate-200 hover:border-slate-900 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
