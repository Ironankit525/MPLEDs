import React from 'react';

export const ProjectSkeletonLoader = () => {
  return (
    <div className="space-y-6 animate-pulse select-none">
      {/* Top Back & Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 bg-slate-200 rounded-xl" />
        <div className="h-4 w-44 bg-slate-200 rounded-md" />
      </div>

      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-indigo-100 rounded-md" />
            <div className="h-7 w-80 bg-slate-200 rounded-lg" />
            <div className="h-4 w-60 bg-slate-100 rounded-md" />
          </div>
          <div className="h-8 w-28 bg-slate-200 rounded-full" />
        </div>
      </div>

      {/* KPI Row Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-2">
            <div className="h-3 w-20 bg-slate-200 rounded-sm" />
            <div className="h-6 w-16 bg-slate-300 rounded-md" />
            <div className="h-2 w-full bg-slate-100 rounded-full" />
          </div>
        ))}
      </div>

      {/* Signature Feature Skeleton */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4">
        <div className="h-6 w-56 bg-slate-200 rounded-md" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-slate-100 rounded-xl" />
          <div className="space-y-3">
            <div className="h-5 w-40 bg-slate-200 rounded-md" />
            <div className="h-4 w-full bg-slate-100 rounded-md" />
            <div className="h-4 w-5/6 bg-slate-100 rounded-md" />
            <div className="h-20 bg-slate-50 border border-slate-200 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-64 bg-white border border-slate-200 rounded-2xl p-6" />
          <div className="h-64 bg-white border border-slate-200 rounded-2xl p-6" />
        </div>
        <div className="space-y-6">
          <div className="h-64 bg-white border border-slate-200 rounded-2xl p-6" />
          <div className="h-64 bg-white border border-slate-200 rounded-2xl p-6" />
        </div>
      </div>
    </div>
  );
};
