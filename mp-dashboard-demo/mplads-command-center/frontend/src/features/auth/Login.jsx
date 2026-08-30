import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { AshokStambhLogo } from '../../components/common/AshokStambhLogo';

export const Login = () => {
  const { availableMPs, loginAsMP } = useAuth();
  const [selectedMpId, setSelectedMpId] = useState(availableMPs[0]?.id || 'MP001');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await loginAsMP(selectedMpId);
      navigate('/dashboard');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/80 flex items-center justify-center p-4 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px]">
      <div className="max-w-md w-full space-y-6">
        {/* Logo & Header */}
        <div className="text-center space-y-2">
          <div className="w-20 h-20 mx-auto flex items-center justify-center">
            <AshokStambhLogo className="w-20 h-20" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-extrabold font-display text-slate-900 tracking-tight">
              MPLADS
            </h1>
            <span className="px-2 py-0.5 rounded text-xs font-black bg-gradient-to-r from-indigo-600 to-indigo-700 text-white tracking-wider shadow-xs">
              AI
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-xs mx-auto font-medium">
            National AI Decision Support & Governance Platform for Members of Parliament
          </p>
        </div>

        {/* Demo Login Form */}
        <Card className="p-6 shadow-md border-slate-200">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-lg">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Demo Environment — Select MP Profile</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Select Demo Member of Parliament (MP):
              </label>
              <div className="relative">
                <select
                  value={selectedMpId}
                  onChange={(e) => setSelectedMpId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white cursor-pointer appearance-none shadow-xs transition"
                >
                  {availableMPs.map((mp) => (
                    <option key={mp.id} value={mp.id} className="bg-white text-slate-900 py-1">
                      {mp.name} — {mp.constituency} ({mp.state})
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">
                  ▼
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full py-3"
              icon={UserCheck}
            >
              {submitting ? 'Authenticating Session...' : 'Enter Command Center'}
            </Button>
          </form>
        </Card>

        {/* Footer Disclaimer */}
        <p className="text-center text-[11px] text-slate-400">
          Task 01 Foundation • All data is fictional for development purposes.
        </p>
      </div>
    </div>
  );
};
