import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { beneficiaryService } from './beneficiaryService.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Loader } from '../../components/common/Loader.jsx';
import { Users, MapPin, CheckCircle } from 'lucide-react';

export const Beneficiaries = () => {
  const { currentMP } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBeneficiaries = async () => {
      if (!currentMP?.id) return;
      setLoading(true);
      try {
        const data = await beneficiaryService.getBeneficiaries(currentMP.id);
        setBeneficiaries(data);
      } finally {
        setLoading(false);
      }
    };
    fetchBeneficiaries();
  }, [currentMP?.id]);

  if (loading) return <Loader label="Loading Beneficiary Impact Records..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Beneficiaries & Social Impact"
        description="Quantified citizen group outcomes delivered through MPLADS funded assets."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {beneficiaries.map((b) => (
          <Card key={b.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{b.targetGroup}</span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <Users className="w-4 h-4" />
                <span>{b.totalImpact.toLocaleString()} Citizens Impacted</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Location: <strong className="text-slate-700">{b.location}</strong></span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-lg flex items-start gap-2 text-xs text-slate-700">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{b.keyBenefit}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
