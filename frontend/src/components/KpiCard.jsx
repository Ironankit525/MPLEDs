import React from 'react';

export default function KpiCard({ title, value, badgeColor, icon }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-center">
      {icon && <span className="mr-2 text-xl">{icon}</span>}
      <div className="flex-1">
        <h4 className="text-sm font-medium text-gray-600 mb-1">{title}</h4>
        <p className="text-2xl font-semibold text-gray-800">
          {badgeColor ? (
            <span className={`inline-block px-2 py-0.5 rounded ${badgeColor}`}>{value}</span>
          ) : (
            value
          )}
        </p>
      </div>
    </div>
  );
}
