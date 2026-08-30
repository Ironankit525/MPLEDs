import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Menu } from 'lucide-react';

export const Navbar = ({ onHamburgerClick }) => {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 h-20 min-h-[5rem] bg-white border-b border-slate-100 px-6 sm:px-8 flex items-center justify-between transition-all">
      {/* Single row on md+ */}
      <div className="flex items-center justify-between gap-2 h-full w-full">

        {/* LEFT — Hamburger (mobile only) + Profile */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Hamburger: visible < md */}
          <button
            onClick={onHamburgerClick}
            className="md:hidden p-2 -ml-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition shrink-0"
            title="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Avatar */}
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 md:w-5 md:h-5 text-slate-500" />
            )}
          </div>

          {/* Name & Role */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900 truncate max-w-[140px] sm:max-w-none">
                {user?.username || 'Contractor'}
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium leading-none">
              {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Authorized User'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
