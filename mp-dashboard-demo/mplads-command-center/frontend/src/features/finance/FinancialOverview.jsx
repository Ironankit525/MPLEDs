import React from 'react';
import { useFinance } from '../../hooks/useFinance.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { FundUtilizationChart } from '../../components/charts/FundUtilizationChart.jsx';
import { ExpenditureChart } from '../../components/charts/ExpenditureChart.jsx';
import { SectorAllocationChart } from '../../components/charts/SectorAllocationChart.jsx';
import { Loader } from '../../components/common/Loader.jsx';
import { ErrorState } from '../../components/common/ErrorState.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';

export const FinancialOverview = () => {
  const { fundSummary, expenditures, sectorAllocation, loading, error, refresh } = useFinance();

  if (loading) return <Loader label="Loading Financial Telemetry..." />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!fundSummary) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="MPLADS Financial Overview"
        description="Comprehensive audit trail of fund allocations, release tranches, and actual utilization."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="text-center p-4">
          <span className="text-xs text-slate-500 font-semibold block">Allocated Cap</span>
          <span className="text-2xl font-bold font-display text-slate-900">{formatCurrency(fundSummary.allocation, true)}</span>
        </Card>
        <Card className="text-center p-4">
          <span className="text-xs text-slate-500 font-semibold block">Released Amount</span>
          <span className="text-2xl font-bold font-display text-slate-900">{formatCurrency(fundSummary.released, true)}</span>
        </Card>
        <Card className="text-center p-4">
          <span className="text-xs text-slate-500 font-semibold block">Utilized Amount</span>
          <span className="text-2xl font-bold font-display text-slate-900">{formatCurrency(fundSummary.utilized, true)}</span>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Fund Utilization Rate">
          <FundUtilizationChart
            allocation={fundSummary.allocation}
            released={fundSummary.released}
            utilized={fundSummary.utilized}
          />
        </Card>

        <Card title="Sector Allocation">
          <SectorAllocationChart sectors={sectorAllocation} />
        </Card>
      </div>

      <Card>
        <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginBottom: '16px', fontFamily: 'Inter, ui-sans-serif, sans-serif' }}>
          Monthly Expenditure Disbursals
        </h3>
        <ExpenditureChart data={expenditures} />
      </Card>
    </div>
  );
};
