import { useState, useEffect } from 'react';
import { useAiRiskData } from '../../hooks/useAiRiskData.js';
import { AIRiskHeader } from '../../components/ai-risk/AIRiskHeader.jsx';
import { AIRiskFilterBar } from '../../components/ai-risk/AIRiskFilterBar.jsx';
import { RiskKpiCards } from '../../components/ai-risk/RiskKpiCards.jsx';
import { ProjectsRequiringAttentionTable } from '../../components/ai-risk/ProjectsRequiringAttentionTable.jsx';
import { RiskDistributionSection } from '../../components/ai-risk/RiskDistributionSection.jsx';
import { AnomalyDistributionSection } from '../../components/ai-risk/AnomalyDistributionSection.jsx';
import { StateRiskOverviewSection } from '../../components/ai-risk/StateRiskOverviewSection.jsx';
import { AgencyRiskOverviewSection } from '../../components/ai-risk/AgencyRiskOverviewSection.jsx';
import { MPRiskOverviewSection } from '../../components/ai-risk/MPRiskOverviewSection.jsx';
import { ProjectDetailsView } from '../../components/projects/ProjectDetailsView.jsx';

import { LoadingState } from '../../components/ui/LoadingState.jsx';

export const AIRiskPage = () => {
  const [selectedProject, setSelectedProject] = useState(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);

  const handleSelectProject = (proj) => {
    setSelectedProject(proj);
    window.history.pushState({ projectModalOpen: true }, '', `#project-${encodeURIComponent(proj.id)}`);
  };

  const handleCloseProject = () => {
    setSelectedProject(null);
    if (window.location.hash.startsWith('#project-')) {
      window.history.back();
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      if (selectedProject) {
        setSelectedProject(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedProject]);

  const {
    filters,
    projectsData,
    loading,
    error,
    lastAnalysisTime,
    kpis,
    riskDistribution,
    anomalyDistribution,
    stateRiskOverview,
    agencyRiskOverview,
    mpRiskOverview,
    handleFilterChange,
    applyCrossFilter,
    resetFilters,
  } = useAiRiskData();

  useEffect(() => {
    if (!loading && projectsData) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setShowSkeleton(false);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (loading && !projectsData) {
      setShowSkeleton(true);
      setIsFadingOut(false);
    }
  }, [loading, projectsData]);

  if (error) {
    return (
      <div className="p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center text-rose-800">
        <h3 className="text-base font-extrabold">Failed to load AI Risk Monitor</h3>
        <p className="text-xs mt-1 text-rose-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 relative min-h-screen">
      {showSkeleton && (
        <div 
          className={`absolute inset-0 z-50 transition-opacity duration-1000 bg-white ${
            isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <LoadingState message="Running AI Risk & Anomaly Diagnostics..." />
        </div>
      )}

      <div className={`space-y-8 transition-opacity duration-1000 ${isFadingOut ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      {/* 1. Header with System Active indicator & Counts */}
      <AIRiskHeader
        totalActiveProjects={kpis.totalActiveProjects}
        lastAnalysisTime={lastAnalysisTime}
      />

      {/* 2. Filter Bar (No FY filter, No Risk Level filter, No MP filter) */}
      <AIRiskFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={resetFilters}
      />

      {/* 3. Risk KPI Cards (Cumulative metrics for risky projects) */}
      <RiskKpiCards kpis={kpis} />

      {/* 4. Projects Requiring Attention Table (Main Section) */}
      <ProjectsRequiringAttentionTable
        projects={projectsData}
        onProjectClick={handleSelectProject}
      />

      {/* 5. Risk Distribution & Anomaly Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RiskDistributionSection data={riskDistribution} />
        <AnomalyDistributionSection data={anomalyDistribution} />
      </div>

      {/* 6. State Risk Overview */}
      <StateRiskOverviewSection
        data={stateRiskOverview}
        selectedState={filters.state}
        onStateSelect={(stName) => applyCrossFilter('state', stName)}
        onResetState={() => handleFilterChange('state', 'All States')}
      />

      {/* 7. Implementing Agency Risk & MP Risk Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <AgencyRiskOverviewSection
            data={agencyRiskOverview}
            selectedAgency={filters.agency}
            onAgencySelect={(agName) => applyCrossFilter('agency', agName)}
            onResetAgency={() => handleFilterChange('agency', 'All Agencies')}
          />
        </div>
        <div className="lg:col-span-5">
          <MPRiskOverviewSection
            data={mpRiskOverview}
            selectedMp={filters.search}
            onMpSelect={(mpName) => applyCrossFilter('search', mpName)}
            onResetMp={() => handleFilterChange('search', '')}
          />
        </div>
      </div>
      </div>

      {/* Selected Project Modal View */}
      {selectedProject && (
        <ProjectDetailsView
          project={selectedProject}
          onClose={handleCloseProject}
        />
      )}
    </div>
  );
};

export default AIRiskPage;
