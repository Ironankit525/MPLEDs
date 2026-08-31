import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { useUser } from '../../hooks/useUser.js';
import { dashboardService } from './dashboardService.js';
import { AttentionRequired } from './components/AttentionRequired.jsx';
import { CommandKpiRow } from './components/CommandKpiRow.jsx';
import { FundPositionPipeline } from './components/FundPositionPipeline.jsx';
import { ExpenditurePerformanceChart } from './components/ExpenditurePerformanceChart.jsx';
import { ConstituencyMapSnapshot } from './components/ConstituencyMapSnapshot.jsx';
import { AgencyPerformance } from './components/AgencyPerformance.jsx';
import { IntegrityRiskSignals } from './components/IntegrityRiskSignals.jsx';
import { Loader } from '../../components/common/Loader.jsx';
import { ErrorState } from '../../components/common/ErrorState.jsx';

export const Dashboard = () => {
  const { currentMP } = useAuth();
  const { financialYear } = useUser();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = async () => {
    if (!currentMP?.id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await dashboardService.getDashboardData(currentMP.id, financialYear);
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load command center telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [currentMP?.id, financialYear]);

  if (loading) return <Loader label="Retrieving Parliamentary Command Telemetry..." />;
  if (error) return <ErrorState message={error} onRetry={loadDashboard} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* PAGE HEADING */}
      <div className="flex items-start justify-between flex-wrap gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight font-sans">
            Overview Dashboard
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Parliamentary Constituency Telemetry & Financial Overview
          </p>
        </div>
      </div>

      {/* 4. ⚠ ACTION REQUIRED ALERT SECTION */}
      <AttentionRequired alerts={data.attentionRequired} />

      {/* 5. DECISION-ORIENTED KPI OVERVIEW */}
      <CommandKpiRow kpis={data.kpis} fundPosition={data.fundPosition} />

      {/* 6. FUND POSITION & FINANCIAL FLOW */}
      <FundPositionPipeline fundPosition={data.fundPosition} financialYear={financialYear} />

      {/* 11 & 12. EXPENDITURE PERFORMANCE + CONSTITUENCY MAP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpenditurePerformanceChart
          performance={data.expenditurePerformance}
          financialYear={financialYear}
        />
        <ConstituencyMapSnapshot
          constituencyMap={data.constituencyMap}
          constituencyName={data.mp.constituency}
        />
      </div>

      {/* 13 & 14. FIELD AGENCY & CONTRACTOR PERFORMANCE */}
      <AgencyPerformance
        agencyPerformance={data.agencyPerformance}
        contractorPerformance={data.contractorPerformance}
      />

      {/* 15. INTEGRITY & RISK SIGNALS */}
      <IntegrityRiskSignals signals={data.integrityRiskSignals} />
    </div>
  );
};
