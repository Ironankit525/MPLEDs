import React from 'react';
import { Loader2 } from 'lucide-react';

export const Loader = ({ label = 'Loading Telemetry...' }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      <span className="text-sm font-semibold tracking-wide">{label}</span>
    </div>
  );
};
