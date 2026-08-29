import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Landmark, 
  MapPin, 
  Lightbulb, 
  Building2, 
  Users, 
  FileSpreadsheet,
  ShieldAlert
} from 'lucide-react';
import { ROUTES } from '../../constants/routes';

export const Sidebar = () => {
  const navItems = [
    { label: 'Dashboard', path: ROUTES.DASHBOARD, icon: LayoutDashboard },
    { label: 'Projects', path: ROUTES.PROJECTS, icon: FolderKanban },
    { label: 'Financial Overview', path: ROUTES.FINANCE, icon: Landmark },
    { label: 'Constituency Geography', path: ROUTES.GEOGRAPHY, icon: MapPin },
    { label: 'Planning & Proposals', path: ROUTES.PLANNING, icon: Lightbulb },
    { label: 'Contractors Directory', path: ROUTES.CONTRACTORS, icon: Building2 },
    { label: 'Beneficiaries Impact', path: ROUTES.BENEFICIARIES, icon: Users },
    { label: 'Reports & Audits', path: ROUTES.REPORTS, icon: FileSpreadsheet },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-screen">
      {/* Brand Logo Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-200">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-amber-500 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/10">
          MP
        </div>
        <div>
          <h1 className="font-display font-bold text-slate-900 text-sm tracking-wide leading-none">
            MPLADS
          </h1>
          <span className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase">
            Command Center
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          MP Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Role Architecture Info Banner */}
      <div className="p-3 m-3 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-1">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          <span>Portal Status</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">
          MP Portal Active. Nodal Officer verification layer ready for integration.
        </p>
      </div>
    </aside>
  );
};
