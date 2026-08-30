import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { formatCurrency } from '../../../utils/formatCurrency';
import { Eye, Filter, ArrowRight, ArrowUpRight, Search } from 'lucide-react';

export const ProjectMonitoringTable = ({ projects = [] }) => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [agencyFilter, setAgencyFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = projects.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (agencyFilter !== 'ALL' && p.agency !== agencyFilter) return false;
    if (riskFilter !== 'ALL' && p.risk !== riskFilter) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && !p.area.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'On Track':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> On Track
        </span>;
      case 'At Risk':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> At Risk
        </span>;
      case 'Delayed':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Delayed
        </span>;
      case 'Completed':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Completed
        </span>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  const getRiskBadge = (risk) => {
    switch (risk) {
      case 'High':
        return <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">High Risk</span>;
      case 'Medium':
        return <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Medium</span>;
      case 'Low':
        return <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">Low</span>;
      default:
        return null;
    }
  };

  return (
    <Card
      title="Constituency Project Monitoring"
      subtitle="Execution telemetry across line agencies & civil contractors"
      action={
        <button
          onClick={() => navigate('/projects')}
          className="text-xs font-bold text-black hover:text-slate-700 flex items-center gap-1 cursor-pointer"
        >
          <span>View All Projects</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      {/* Interactive Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 mb-4 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search project or block..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-400" /> Filters:
          </span>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="On Track">On Track</option>
            <option value="At Risk">At Risk</option>
            <option value="Delayed">Delayed</option>
            <option value="Completed">Completed</option>
          </select>

          {/* Agency filter */}
          <select
            value={agencyFilter}
            onChange={(e) => setAgencyFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Agencies</option>
            <option value="PWD">PWD</option>
            <option value="PMC">PMC</option>
            <option value="Education Dept.">Education Dept.</option>
          </select>

          {/* Risk filter */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="High">High Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="Low">Low Risk</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
              <th className="py-3 px-4">Project Name & Block</th>
              <th className="py-3 px-3">Agency</th>
              <th className="py-3 px-3">Progress</th>
              <th className="py-3 px-3">Amount</th>
              <th className="py-3 px-3">Timeline</th>
              <th className="py-3 px-3">Risk Signal</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-8 text-center text-slate-400 italic">
                  No matching projects found with the selected filters.
                </td>
              </tr>
            ) : (
              filteredProjects.map((proj) => (
                <tr
                  key={proj.id}
                  onClick={() => navigate(`/projects/${proj.id}`)}
                  className="hover:bg-slate-50/90 transition cursor-pointer group"
                >
                  <td className="py-3.5 px-4 max-w-xs">
                    <span className="font-bold text-slate-900 block truncate group-hover:text-black transition">
                      {proj.name}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {proj.area} • {proj.sector}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {proj.agency}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 border border-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-slate-900 rounded-full"
                          style={{ width: `${proj.progress}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-800">{proj.progress}%</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 font-bold text-slate-900">
                    {formatCurrency(proj.amount, true)}
                  </td>
                  <td className="py-3.5 px-3">
                    <span className={`font-semibold ${proj.timeline.includes('delayed') ? 'text-rose-700 font-bold' : 'text-slate-600'}`}>
                      {proj.timeline}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    {getRiskBadge(proj.risk)}
                  </td>
                  <td className="py-3.5 px-3">
                    {getStatusBadge(proj.status)}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <button
                      className="p-1 text-slate-400 group-hover:text-black group-hover:bg-slate-100 rounded transition"
                      title="View Dossier"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
