import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { formatCurrency } from '../../../utils/formatCurrency';
import { Users, ArrowUpRight, Sparkles } from 'lucide-react';

export const CitizenImpactAndFeedback = ({ impact, financialYear }) => {
  const navigate = useNavigate();

  if (!impact) return null;

  return (
    <Card
      title="Constituent Social Impact"
      subtitle="Tangible community outcomes delivered through grounded works"
      action={
        <button
          onClick={() => navigate('/mp/beneficiaries')}
          className="text-xs font-bold text-black hover:text-slate-700 flex items-center gap-1 cursor-pointer"
        >
          <span>Impact Dossier</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="space-y-4">
        {/* Main Beneficiaries Stat Box */}
        <div className="p-5 bg-gradient-to-r from-emerald-50 via-indigo-50 to-sky-50 border border-emerald-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-extrabold text-slate-600 block uppercase tracking-wider">
              Total Estimated Beneficiaries
            </span>
            <span className="text-3xl sm:text-4xl font-black font-display text-slate-900 mt-1 block">
              {impact.totalBeneficiaries.toLocaleString('en-IN')}
            </span>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mt-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{formatCurrency(impact.amountUtilized, true)} utilized → {impact.totalBeneficiaries.toLocaleString('en-IN')} citizens directly impacted</span>
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs shrink-0 self-end sm:self-auto">
            <Users className="w-7 h-7" />
          </div>
        </div>

        {/* Sector Breakdown Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {impact.sectors.map((sec, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-white border border-slate-200/90 rounded-xl flex items-center justify-between shadow-xs hover:border-indigo-200 transition"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{sec.icon}</span>
                <div>
                  <span className="text-xs font-bold text-slate-900 block truncate">
                    {sec.label}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {sec.percentage}% of reach
                  </span>
                </div>
              </div>
              <span className="text-sm font-extrabold font-display text-slate-900">
                {sec.count.toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
