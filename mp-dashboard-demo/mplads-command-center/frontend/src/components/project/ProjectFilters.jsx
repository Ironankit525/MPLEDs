import React from 'react';
import { SECTORS } from '../../constants/sectors.js';
import { PROJECT_STATUS } from '../../constants/projectStatus.js';
import { Search, Filter } from 'lucide-react';

export const ProjectFilters = ({ filters, onChange }) => {
  return (
    <div className="bg-white border border-slate-200/90 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between mb-6 shadow-xs">
      {/* Search Input */}
      <div className="relative w-full md:w-72">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search project title or village..."
          value={filters.search || ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
        />
      </div>

      {/* Filter Selects */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className="flex items-center gap-1 text-slate-500 text-xs shrink-0 font-medium">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>Filter:</span>
        </div>

        {/* Sector Filter */}
        <select
          value={filters.sector || ''}
          onChange={(e) => onChange({ ...filters, sector: e.target.value })}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer transition"
        >
          <option value="">All Sectors</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={filters.status || ''}
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer transition"
        >
          <option value="">All Statuses</option>
          {Object.keys(PROJECT_STATUS).map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
