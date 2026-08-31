import React from 'react';
import { Card } from '../../../components/common/Card.jsx';
import { Users, MapPin } from 'lucide-react';

export const BeneficiarySummary = ({ beneficiaries = 245000, villagesCovered = 126 }) => {
  return (
    <Card title="Constituency Reach">
      <div className="space-y-3">
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/90 p-3.5 rounded-lg">
          <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">Total Estimated Beneficiaries</span>
            <span className="text-xl font-bold font-display text-slate-900">{beneficiaries.toLocaleString('en-IN')} Citizens</span>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/90 p-3.5 rounded-lg">
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">Gram Panchayats & Villages Covered</span>
            <span className="text-xl font-bold font-display text-slate-900">{villagesCovered} Villages</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
