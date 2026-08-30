import React from 'react';
import { Card } from '../../../components/common/Card';
import { formatCurrency } from '../../../utils/formatCurrency';
import { Landmark, TrendingUp, CheckCircle, Wallet } from 'lucide-react';

export const FundSummary = ({ fund }) => {
  if (!fund) return null;

  const metrics = [
    { label: 'Annual Allocation Cap', amount: fund.allocation, icon: Landmark, color: 'text-indigo-700', bg: 'bg-indigo-50 border border-indigo-100' },
    { label: 'Sanctioned Amount', amount: fund.sanctioned, icon: TrendingUp, color: 'text-amber-700', bg: 'bg-amber-50 border border-amber-100' },
    { label: 'Released Amount', amount: fund.released, icon: Wallet, color: 'text-sky-700', bg: 'bg-sky-50 border border-sky-100' },
    { label: 'Utilized Amount', amount: fund.utilized, icon: CheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-50 border border-emerald-100' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m, idx) => {
        const Icon = m.icon;
        return (
          <Card key={idx} className="p-4 flex items-center gap-4 hover:border-slate-300 transition duration-200">
            <div className={`w-12 h-12 rounded-xl ${m.bg} flex items-center justify-center shrink-0 shadow-xs`}>
              <Icon className={`w-6 h-6 ${m.color}`} />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-semibold block">{m.label}</span>
              <span className="text-xl font-bold font-display text-slate-900 mt-0.5 block">
                {formatCurrency(m.amount, true)}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
