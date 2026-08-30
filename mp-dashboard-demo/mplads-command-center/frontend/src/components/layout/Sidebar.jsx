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
      {/* Brand Header with Official Ashoka Stambha Emblem */}
      <div className="h-[72px] pt-2 px-3 flex items-center shrink-0 select-none justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center w-full min-w-0 px-2.5 py-1.5 h-12 cursor-pointer rounded-xl hover:bg-slate-200/50 transition-colors group select-none text-left focus:outline-none"
        >
          <div className="flex items-center justify-center shrink-0 w-9 h-9 select-none">
            <AshokStambhLogo className="w-9 h-9 shrink-0 pointer-events-none" theme="light" />
          </div>
          <div
            className={`flex flex-col leading-tight overflow-hidden transition-all duration-300 ease-in-out pl-3 select-none ${
              isCollapsed && !mobileOpen
                ? 'opacity-0 max-w-0 min-w-0 pointer-events-none'
                : 'opacity-100 max-w-[150px]'
            }`}
          >
            <span className="font-extrabold text-slate-900 text-base tracking-tight font-sans whitespace-nowrap select-none">
              MPLADS AI
            </span>
            <span className="text-[9px] text-slate-500 font-medium leading-snug whitespace-nowrap select-none">
              Command Center
            </span>
          </div>
        </button>

        {/* Mobile close button */}
        {mobileOpen && (
          <button
            onClick={onMobileClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
            title="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
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
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2.5 text-sm relative group transition-all duration-300 ease-in-out ${
                      isActive
                        ? isCollapsed && !mobileOpen
                          ? 'text-slate-900 font-bold ml-3 mr-0 rounded-l-2xl z-20'
                          : 'bg-white text-slate-900 font-bold mx-3 rounded-xl shadow-xs border border-slate-200/80 z-20'
                        : isCollapsed && !mobileOpen
                        ? 'text-slate-600 hover:text-slate-900 font-medium ml-3 mr-0 rounded-l-2xl z-10'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium mx-3 rounded-xl z-10'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Morphing "Tail": Retracts into main page when deactivating, emerges out when activating (in collapsed mode) */}
                      {isCollapsed && !mobileOpen && (
                        <div
                          className={`absolute inset-0 bg-white rounded-l-2xl pointer-events-none origin-right transition-transform duration-350 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                            isActive ? 'scale-x-100' : 'scale-x-0'
                          }`}
                        >
                          {/* Top Concave Inverted Corner Arc */}
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            className="absolute -top-4 right-0 w-4 h-4 pointer-events-none"
                          >
                            <path d="M16 0 C16 8.84 8.84 16 0 16 H 16 V 0 Z" fill="#ffffff" />
                          </svg>

                          {/* Bottom Concave Inverted Corner Arc */}
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            className="absolute -bottom-4 right-0 w-4 h-4 pointer-events-none"
                          >
                            <path d="M0 0 C8.84 0 16 7.16 16 16 V 0 H 0 Z" fill="#ffffff" />
                          </svg>
                        </div>
                      )}

                      <div className="w-8 h-8 flex items-center justify-center shrink-0 relative z-10">
                        <Icon
                          className={`w-5 h-5 shrink-0 transition-transform duration-200 ${
                            isActive ? 'text-slate-900 scale-105' : 'text-slate-500 group-hover:text-slate-900'
                          }`}
                        />
                      </div>
                      
                      <span
                        className={`tracking-wide whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out pl-2 relative z-10 ${
                          isCollapsed && !mobileOpen
                            ? 'opacity-0 max-w-0 min-w-0'
                            : 'opacity-100 max-w-[160px]'
                        }`}
                      >
                        {item.label}
                      </span>

                      {/* Tooltip on Hover when Collapsed */}
                      {isCollapsed && !mobileOpen && (
                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap shadow-lg">
                          {item.label}
                        </div>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom Status Card: AI Risk Engine Status */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isCollapsed && !mobileOpen
            ? 'opacity-0 max-h-0 m-0 p-0 border-0 pointer-events-none'
            : 'opacity-100 max-h-52 p-4 m-3 rounded-xl bg-white/80 border border-slate-200/80 text-slate-700 shadow-xs'
        }`}
      >
        <div className="text-xs font-bold text-slate-900 tracking-wide mb-1.5 whitespace-nowrap">
          AI Risk Engine Status
        </div>
        <div className="flex items-center gap-2 mb-3 whitespace-nowrap">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-emerald-700">Active</span>
        </div>
        <div className="pt-2 border-t border-slate-200">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold whitespace-nowrap">
            Last Updated
          </div>
          <div className="text-xs text-slate-800 font-mono mt-0.5 whitespace-nowrap">
            10 May 2025, 10:30 AM
          </div>
        </div>
      </div>
      
      {/* Logout Button */}
      <div className="p-3 flex justify-center">
        <button
          onClick={() => {
            document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            window.location.href = isLocal ? 'http://localhost:3000/' : 'https://inspiring-lebkuchen-67d55f.netlify.app/';
          }}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
          title="Log Out"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
    </aside>
  );
};
