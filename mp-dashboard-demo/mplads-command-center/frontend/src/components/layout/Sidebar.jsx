import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Landmark, 
  MapPin, 
  Building2, 
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { ROUTES } from '../../constants/routes';
import { AshokStambhLogo } from '../common/AshokStambhLogo';

export const Sidebar = ({ isCollapsed = false, onToggle, mobileOpen = false, onMobileClose }) => {
  const navGroups = [
    {
      title: 'OVERVIEW',
      items: [
        { label: 'Dashboard', path: ROUTES.DASHBOARD, icon: LayoutDashboard }
      ]
    },
    {
      title: 'DEVELOPMENT',
      items: [
        { label: 'Projects', path: ROUTES.PROJECTS, icon: FolderKanban },
        { label: 'Constituency Geography', path: ROUTES.GEOGRAPHY, icon: MapPin }
      ]
    },
    {
      title: 'FINANCIAL',
      items: [
        { label: 'Financial Overview', path: ROUTES.FINANCE, icon: Landmark },
        { label: 'Contractors Directory', path: ROUTES.CONTRACTORS, icon: Building2 }
      ]
    }
  ];

  return (
    <aside
      className={`
        flex flex-col shrink-0 z-50 overflow-hidden transition-all duration-300 ease-in-out
        bg-slate-100 md:bg-transparent

        /* Desktop: full-height sidebar in the fixed h-screen layout */
        md:relative md:h-full
        ${isCollapsed ? 'md:w-20' : 'md:w-64'}

        /* Mobile: fixed drawer that slides in from left */
        fixed inset-y-0 left-0 h-full w-64
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}
    >
      {/* Brand Logo Header with Toggle Button */}
      <div
        className={`h-16 shrink-0 flex items-center justify-between transition-all select-none ${
          isCollapsed ? 'px-2 md:justify-center' : 'px-4'
        }`}
      >
        <div
          className="flex items-center gap-2.5 overflow-hidden cursor-pointer group/logo hover:opacity-80 transition"
          onClick={onToggle}
          title={isCollapsed ? 'Click to expand sidebar' : 'Click to collapse sidebar'}
        >
          <div className="transition-transform group-hover/logo:scale-105 shrink-0">
            <AshokStambhLogo className="w-9 h-9 shrink-0" theme="light" />
          </div>
          {/* Always show text on mobile drawer; respect collapsed state on desktop */}
          <div className={`min-w-0 transition-opacity duration-200 ${isCollapsed ? 'hidden md:hidden' : 'block'}`}>
            <h1 className="font-display font-extrabold text-slate-900 text-sm tracking-tight leading-none truncate group-hover/logo:text-slate-700 transition-colors">
              MPLADS AI
            </h1>
            <span className="text-[11px] font-semibold text-slate-500 block mt-1 leading-tight truncate">
              Monitoring Platform
            </span>
          </div>
        </div>

        {/* Desktop collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className={`p-1 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 transition cursor-pointer shrink-0 ${
            isCollapsed ? 'hidden' : 'hidden md:block'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
          title="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-2.5 py-3.5 space-y-3.5 overflow-y-auto overflow-x-hidden">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-0.5">
            {/* Show group labels on mobile drawer and desktop expanded */}
            {(!isCollapsed || mobileOpen) ? (
              <div className="px-2.5 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider transition-opacity">
                {group.title}
              </div>
            ) : (
              gIdx > 0 && <div className="my-1.5 border-t border-slate-100" />
            )}

            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onMobileClose} // close drawer on mobile nav
                  title={isCollapsed && !mobileOpen ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-xl transition-all ${
                      isCollapsed && !mobileOpen
                        ? 'justify-center px-0 py-2.5 w-10 mx-auto'
                        : 'px-3 py-2 text-xs font-semibold'
                    } ${
                      isActive
                        ? 'bg-slate-900 text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {(!isCollapsed || mobileOpen) && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Status Banner / Toggle Pill */}
      {isCollapsed && !mobileOpen ? (
        <div className="shrink-0 p-2.5 border-t border-slate-100 flex flex-col items-center gap-2">
          <button
            onClick={onToggle}
            title="Expand Sidebar"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div
            title="Portal Status: MP Active"
            className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 cursor-help"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
        </div>
      ) : (
        <div className="shrink-0 p-2.5 m-2.5 bg-slate-50 border border-slate-200 rounded-xl transition-all">
          <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-700 mb-0.5">
            <span className="flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-amber-600" />
              <span>Portal Status</span>
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-[10px] text-slate-500 leading-snug">
            MP Portal Active. Verification layer ready.
          </p>
        </div>
      )}
    </aside>
  );
};
