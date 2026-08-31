import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { useUser } from '../../hooks/useUser.js';
import { dashboardService } from './dashboardService.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { FundSummary } from './components/FundSummary.jsx';
import { ProjectSummary } from './components/ProjectSummary.jsx';
import { BeneficiarySummary } from './components/BeneficiarySummary.jsx';
import { RecentProjects } from './components/RecentProjects.jsx';
import { UpcomingActivities } from './components/UpcomingActivities.jsx';
import { FundUtilizationChart } from '../../components/charts/FundUtilizationChart.jsx';
import { ExpenditureChart } from '../../components/charts/ExpenditureChart.jsx';
import { SectorAllocationChart } from '../../components/charts/SectorAllocationChart.jsx';
import { ProjectStatusChart } from '../../components/charts/ProjectStatusChart.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Loader } from '../../components/common/Loader.jsx';
import { ErrorState } from '../../components/common/ErrorState.jsx';

export const Dashboard = () => {
  const { currentMP } = useAuth();
  const { financialYear } = useUser();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadDashboard = async () => {
      if (!currentMP?.id) return;
      setLoading(true);
      setError(null);
      try {
        const result = await dashboardService.getDashboardData(currentMP.id, financialYear);
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load dashboard telemetry');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDashboard();
    return () => { isMounted = false; };
  }, [currentMP?.id, financialYear]);

  if (loading) return <Loader label="Loading MP Telemetry..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${data.mp.name} — Command Dashboard`}
        description={`Constituency: ${data.mp.constituency}, ${data.mp.state} | Financial Year: ${financialYear}`}
      />

      {/* Top Fund Metric Cards */}
      <FundSummary fund={data.fund} />

      {/* Main Telemetry Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Financial Charts */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Fund Allocation & Utilization Metrics" subtitle={`Annual Cap: ₹5 Crore (${financialYear})`}>
            <FundUtilizationChart
              allocation={data.fund.allocation}
              released={data.fund.released}
              utilized={data.fund.utilized}
            />
          </Card>

          <Card title="Monthly Expenditure Trend" subtitle="Actual disbursements recorded in FY">
            <ExpenditureChart data={data.expenditureTrend} />
          </Card>

          <RecentProjects projects={data.recentProjects} />
        </div>

        {/* Right Column - Status, Sector & Activity */}
        <div className="space-y-6">
          <ProjectSummary projects={data.projects} />

          <Card title="Project Work Status Breakdown">
            <ProjectStatusChart statusCounts={data.projects} />
          </Card>

          <Card title="Sector-wise Fund Allocation">
            <SectorAllocationChart sectors={data.sectorAllocation} />
          </Card>

          <BeneficiarySummary
            beneficiaries={data.beneficiaries}
            villagesCovered={data.villagesCovered}
          />

          <UpcomingActivities />
        </div>
      </div>
    </div>
  );
};
