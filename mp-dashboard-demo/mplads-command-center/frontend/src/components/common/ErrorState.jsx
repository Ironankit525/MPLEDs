import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export const ErrorState = ({ title = 'Failed to load data', message, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-rose-50 border border-rose-200 rounded-xl text-center">
      <AlertCircle className="w-10 h-10 text-rose-600 mb-2" />
      <h4 className="text-base font-bold text-rose-900">{title}</h4>
      <p className="text-sm text-rose-700/80 mt-1 mb-4">{message || 'An error occurred while fetching information.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} icon={RefreshCw}>
          Retry Request
        </Button>
      )}
    </div>
  );
};
