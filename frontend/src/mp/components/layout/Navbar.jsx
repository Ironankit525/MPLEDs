import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';
import { FINANCIAL_YEARS } from '../../constants/financialYears';
import { Calendar, User, LogOut, ChevronDown } from 'lucide-react';

export const Navbar = () => {
  const { currentMP, availableMPs, switchMP, logout } = useAuth();
  const { financialYear, setFinancialYear } = useUser();

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Active MP Indicator */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
          {currentMP?.avatar ? (
            <img src={currentMP.avatar} alt={currentMP.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-5 h-5 text-slate-500" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">{currentMP?.name || 'Demo Member of Parliament'}</h2>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
              Lok Sabha
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Constituency: <span className="text-slate-700 font-semibold">{currentMP?.constituency}, {currentMP?.state}</span>
          </p>
        </div>
      </div>

      {/* Global Controls: Financial Year & MP Switcher */}
      <div className="flex items-center gap-3">
        {/* Financial Year Selector */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-xs">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-semibold text-slate-500">FY:</span>
          <select
            value={financialYear}
            onChange={(e) => setFinancialYear(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
          >
            {FINANCIAL_YEARS.map((fy) => (
              <option key={fy} value={fy} className="bg-white text-slate-900">
                {fy}
              </option>
            ))}
          </select>
        </div>

        {/* Demo MP Switcher Dropdown */}
        <div className="flex items-center gap-2 bg-indigo-50/70 border border-indigo-200 rounded-lg px-3 py-1.5 shadow-xs">
          <span className="text-xs font-semibold text-indigo-800">Switch MP:</span>
          <select
            value={currentMP?.id || 'MP001'}
            onChange={(e) => switchMP(e.target.value)}
            className="bg-transparent text-xs font-bold text-indigo-900 focus:outline-none cursor-pointer"
          >
            {availableMPs.map((mp) => (
              <option key={mp.id} value={mp.id} className="bg-white text-slate-900">
                {mp.name} ({mp.constituency})
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-indigo-600 pointer-events-none" />
        </div>

        {/* Logout Action */}
        <button
          onClick={logout}
          title="Logout Demo Session"
          className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
