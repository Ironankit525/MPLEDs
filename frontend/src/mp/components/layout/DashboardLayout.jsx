import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

export const DashboardLayout = () => {
  return (
    <div className="flex min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Demo Disclaimer Note */}
          <div className="mb-5 px-4 py-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-center justify-between shadow-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse"></span>
              <strong>Development Notice:</strong> All data in this demo environment is fictional and used for development & validation.
            </span>
            <span className="font-bold tracking-wider text-[11px] text-amber-700 uppercase bg-amber-100/70 px-2 py-0.5 rounded">Task 01 Foundation</span>
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  );
};
