import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../../hooks/useProject';

import { ProjectSkeletonLoader } from '../../components/project/details/ProjectSkeletonLoader';
import { ProjectHeader } from '../../components/project/details/ProjectHeader';
import { ProjectExecutiveSummary } from '../../components/project/details/ProjectExecutiveSummary';
import { ProjectTimelineSteps } from '../../components/project/details/ProjectTimelineSteps';
import { ProjectFinancialsFlow } from '../../components/project/details/ProjectFinancialsFlow';
import { PhysicalFinancialAlignment } from '../../components/project/details/PhysicalFinancialAlignment';
import { ExpenditureReviewSection } from '../../components/project/details/ExpenditureReviewSection';
import { ExplainableRiskAssessment } from '../../components/project/details/ExplainableRiskAssessment';
import { ContractorProfileSection } from '../../components/project/details/ContractorProfileSection';
import { AIEvidenceVerification } from '../../components/project/details/AIEvidenceVerification';
import { ProjectLocationMapSection } from '../../components/project/details/ProjectLocationMapSection';
import { InspectionHistorySection } from '../../components/project/details/InspectionHistorySection';
import { ActivityAuditTrail } from '../../components/project/details/ActivityAuditTrail';

import { ErrorState } from '../../components/common/ErrorState';
import { Button } from '../../components/common/Button';
import { ArrowLeft, AlertCircle, ShieldAlert, Lock } from 'lucide-react';

export const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { 
    project, 
    loading, 
    error, 
    isAccessRestricted, 
    restrictedDetails, 
    refresh 
  } = useProject(id);

  // 1. Loading State with Skeleton Loader
  if (loading) {
    return <ProjectSkeletonLoader />;
  }

  // 2. Critical Security: Access Restricted (Constituency Data Isolation)
  if (isAccessRestricted) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto pt-12 text-center">
        <div className="p-8 bg-white border border-rose-200 rounded-2xl space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-extrabold uppercase tracking-wider">
              Constituency Access Restricted
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-2">
              Cross-Constituency Project Protected
            </h2>
            <p className="text-xs text-slate-600 mt-1.5 max-w-md mx-auto leading-relaxed">
              This project (<code className="font-mono font-bold text-slate-800">{restrictedDetails?.projectId || id}</code>) belongs to <strong>{restrictedDetails?.projectConstituency}</strong> constituency. Under parliamentary data governance, you are authorized to monitor projects solely within your constituency (<strong>{restrictedDetails?.userConstituency}</strong>).
            </p>
          </div>
          <div className="pt-2">
            <Button icon={ArrowLeft} onClick={() => navigate('/mp/projects')} className="mx-auto">
              Back to My Constituency Projects
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Error State with Retry
  if (error) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto pt-10">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/mp/projects')}>
          Back to Projects
        </Button>
        <ErrorState
          title="Unable to load project details"
          message={error || 'Please check network connection or retry later.'}
          onRetry={refresh}
        />
      </div>
    );
  }

  // 4. Project Not Found State
  if (!project) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto pt-12 text-center">
        <div className="p-8 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Project Not Found</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              The requested MPLADS project dossier (ID: <code className="font-mono text-slate-700">{id}</code>) could not be located.
            </p>
          </div>
          <Button icon={ArrowLeft} onClick={() => navigate('/mp/projects')} className="mx-auto">
            Back to Projects Directory
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. PROJECT HEADER */}
      <ProjectHeader project={project} />

      {/* 2. EXECUTIVE SUMMARY */}
      <ProjectExecutiveSummary project={project} />

      {/* 3. PROJECT TIMELINE */}
      <ProjectTimelineSteps timeline={project.timeline} />

      {/* 6. FINANCIAL OVERVIEW & MONEY FLOW */}
      <ProjectFinancialsFlow financial={project.financial} />

      {/* 7. PHYSICAL VS FINANCIAL PROGRESS */}
      <PhysicalFinancialAlignment
        physical={project.progress?.physical}
        financial={project.progress?.financial}
      />

      {/* 8. EXPENDITURE REVIEW */}
      <ExpenditureReviewSection expenditureReview={project.expenditureReview} />

      {/* 9. RISK ASSESSMENT & EXPLAINABLE FACTORS */}
      <ExplainableRiskAssessment risk={project.risk} />

      {/* 10. EXECUTING CONTRACTOR */}
      <ContractorProfileSection contractor={project.contractor} />

      {/* 11. SITE PROGRESS & AI EVIDENCE (SIGNATURE TRACKER & INTERPRETATION) */}
      <AIEvidenceVerification
        evidence={project.evidence}
        milestoneTracks={project.milestoneTracks}
        beforeAfter={project.beforeAfter}
      />

      {/* 12. PROJECT LOCATION & MAP */}
      <ProjectLocationMapSection
        location={project.location}
        projectTitle={project.title}
        sector={project.sector}
      />

      {/* 13. FIELD VERIFICATION & INSPECTION */}
      <InspectionHistorySection inspections={project.inspections} />

      {/* 14. ACTIVITY HISTORY */}
      <ActivityAuditTrail activity={project.activity} />
    </div>
  );
};
