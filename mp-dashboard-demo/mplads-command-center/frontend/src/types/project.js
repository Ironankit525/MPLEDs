/**
 * Data contracts and normalization utilities for MPLADS Projects (MP-Facing Portal).
 */

/**
 * Normalizes any backend or mock project response into a uniform, robust Project contract.
 * @param {Object} raw 
 * @returns {Object} Normalized project
 */
export const normalizeProject = (raw) => {
  if (!raw) return null;

  const id = raw.id || raw.projectId || 'PRJ-UNKNOWN';
  const title = raw.title || raw.name || raw.basicInfo?.title || 'Untitled Project';
  const sector = raw.sector || raw.basicInfo?.sector || raw.category || 'General Infrastructure';
  const description = raw.description || raw.basicInfo?.description || `MPLADS development initiative in ${raw.location?.village || raw.location?.district || 'the constituency'}.`;
  
  // Location normalization
  const location = {
    village: raw.location?.village || raw.location?.area || raw.basicInfo?.location?.area || 'Local Area',
    area: raw.location?.area || raw.location?.village || raw.basicInfo?.location?.area || 'Local Area',
    district: raw.location?.district || raw.basicInfo?.location?.district || 'District HQ',
    constituency: raw.location?.constituency || raw.basicInfo?.location?.constituency || 'Constituency',
    state: raw.location?.state || raw.basicInfo?.location?.state || 'State',
    latitude: raw.location?.latitude ?? raw.basicInfo?.location?.latitude ?? 18.5204,
    longitude: raw.location?.longitude ?? raw.basicInfo?.location?.longitude ?? 73.8567,
    mapsUrl: raw.location?.mapsUrl || `https://www.google.com/maps?q=${raw.location?.latitude ?? 18.5204},${raw.location?.longitude ?? 73.8567}`,
  };

  // Status
  const status = raw.status || 'ONGOING';

  // Dates
  const dates = {
    proposal: raw.dates?.proposal || raw.dates?.proposalDate || raw.proposalDate || '2025-11-15',
    sanction: raw.dates?.sanction || raw.dates?.sanctionDate || raw.sanctionDate || raw.startDate || '2026-01-10',
    workOrder: raw.dates?.workOrder || raw.dates?.workOrderDate || raw.workOrderDate || '2026-02-01',
    start: raw.dates?.start || raw.dates?.startDate || raw.startDate || '2026-02-15',
    expectedCompletion: raw.dates?.expectedCompletion || raw.dates?.expectedCompletionDate || raw.expectedCompletionDate || '2026-09-18',
    actualCompletion: raw.dates?.actualCompletion || raw.dates?.actualCompletionDate || null,
    lastUpdated: raw.dates?.lastUpdated || raw.lastUpdated || 'Updated 30 Aug 2026, 10:24 AM',
  };

  // Progress
  const physicalProgress = raw.progress?.physical ?? raw.completionPercentage ?? 53;
  const estimatedCost = raw.financial?.estimatedCost ?? raw.estimatedCost ?? 3140000;
  const sanctionedAmt = raw.financial?.sanctioned ?? raw.financial?.sanctionedAmount ?? raw.sanctionedAmount ?? 3000000;
  const releasedAmt = raw.financial?.released ?? raw.financial?.releasedAmount ?? raw.releasedAmount ?? 2400000;
  const utilizedAmt = raw.financial?.utilized ?? raw.financial?.utilizedAmount ?? raw.utilizedAmount ?? 2040000;
  
  const financialProgress = raw.progress?.financial ?? (sanctionedAmt > 0 ? Math.round((utilizedAmt / sanctionedAmt) * 1000) / 10 : 68.0);

  const progress = {
    physical: physicalProgress,
    financial: financialProgress,
    currentStage: raw.progress?.currentStage || (physicalProgress >= 100 ? 'Completed & Handover' : physicalProgress >= 50 ? 'Structural Work' : 'Foundation Works'),
    lastUpdated: dates.lastUpdated,
  };

  // Financial
  const financial = {
    estimatedCost,
    sanctioned: sanctionedAmt,
    released: releasedAmt,
    utilized: utilizedAmt,
    remainingReleased: Math.max(0, releasedAmt - utilizedAmt),
    unreleased: Math.max(0, sanctionedAmt - releasedAmt),
    payments: Array.isArray(raw.financial?.payments) ? raw.financial.payments : (raw.payments || []),
  };

  // Expenditure Review & Cost Analysis
  const expenditureReview = raw.expenditureReview || {
    categories: [
      { name: 'Material Procurement (Cement, Steel, Bricks)', amount: 1240000, percentage: 60.8, status: 'VERIFIED' },
      { name: 'Machinery & Heavy Equipment Rental', amount: 240000, percentage: 11.8, status: 'VERIFIED' },
      { name: 'Labor & Skilled Masonry Wages', amount: 310000, percentage: 15.2, status: 'VERIFIED' },
      { name: 'Site Utilities & Electrical Infrastructure', amount: 170000, percentage: 8.3, status: 'REQUIRES_REVIEW' },
      { name: 'Supervision & Quality Testing Charges', amount: 80000, percentage: 3.9, status: 'VERIFIED' },
    ],
    aiCostReview: {
      status: 'VARIANCE_DETECTED',
      verifiedCount: 4,
      reviewCount: 1,
      summary: '4 expenditure vouchers match standard CPWD/State Schedule of Rates. 1 electrical utility claim exhibits +18% variance above district reference rate.',
      varianceItem: {
        item: 'Site Temporary Electrical Infrastructure & Transformer Laying',
        claimedAmount: 170000,
        benchmarkAmount: 144000,
        variancePercentage: 18,
        explanation: 'Claimed invoice for electrical panel wiring exceeds district PWD benchmark by 18%.',
        recommendation: 'Request itemized tax invoice and verification certificate from Assistant Engineer before final payment sign-off.'
      }
    }
  };

  // Risk
  const riskScore = raw.risk?.score ?? 67;
  const riskLevel = raw.risk?.level || (riskScore > 60 ? 'HIGH' : riskScore > 30 ? 'MEDIUM' : 'LOW');
  const risk = {
    score: riskScore,
    level: riskLevel,
    factors: Array.isArray(raw.risk?.factors) ? raw.risk.factors : [
      { category: 'Schedule Risk', score: 18, maxScore: 25, severity: 'HIGH', reason: 'Project is 12 days behind the planned baseline due to monsoon casting delays.' },
      { category: 'Financial Risk', score: 15, maxScore: 20, severity: 'HIGH', reason: 'Financial utilization (68%) is 15 percentage points ahead of physical progress (53%).' },
      { category: 'Execution Risk', score: 14, maxScore: 20, severity: 'MEDIUM', reason: 'Current structural milestone has experienced slower-than-planned labor mobilization.' },
      { category: 'Evidence Risk', score: 10, maxScore: 15, severity: 'MEDIUM', reason: 'Latest 50% milestone photos require additional human technical verification.' },
      { category: 'Citizen Feedback Risk', score: 10, maxScore: 20, severity: 'MEDIUM', reason: '2 citizen suggestions registered requesting ambulance bay expansion.' },
    ],
  };

  // Contractor
  const contractor = {
    id: raw.contractor?.id || raw.contractorId || 'CON-BLD-045',
    name: raw.contractor?.name || 'BuildTech India Solutions Pvt. Ltd.',
    registrationNumber: raw.contractor?.registrationNumber || 'MH-REG-2019-8841',
    workOrderNumber: raw.contractor?.workOrderNumber || `WO-PUN-2026-045`,
    performanceScore: raw.contractor?.performanceScore ?? 78,
    riskLevel: raw.contractor?.riskLevel || 'Medium',
    status: raw.contractor?.status || 'Ongoing',
    assignedProjects: raw.contractor?.assignedProjects ?? 3,
    completedProjects: raw.contractor?.completedProjects ?? 18,
    delayedProjects: raw.contractor?.delayedProjects ?? 1,
    onTimePercentage: raw.contractor?.onTimePercentage ?? 85,
    delaySignal: raw.contractor?.delaySignal || null,
    contactPerson: raw.contractor?.contactPerson || 'Rajesh Sharma (Project Lead)',
    phone: raw.contractor?.phone || '+91 98220 11998',
    email: raw.contractor?.email || 'contact@buildtech.demo',
  };

  // Milestone Stages & Evidence Track (25%, 50%, 75%, 100%)
  const milestoneTracks = Array.isArray(raw.milestoneTracks) ? raw.milestoneTracks : [
    { id: 'M25', percentage: 25, label: '25% Milestone', stageName: 'Foundation & Plinth Level', status: 'COMPLETED', photoCount: 3, photosUploaded: true },
    { id: 'M50', percentage: 50, label: '50% Milestone', stageName: 'Structural RCC Columns & Slab', status: 'COMPLETED', photoCount: 3, photosUploaded: true },
    { id: 'M75', percentage: 75, label: '75% Milestone', stageName: 'Brickwork & Interior Conduits', status: 'PENDING', photoCount: 0, photosUploaded: false },
    { id: 'M100', percentage: 100, label: '100% Milestone', stageName: 'Finishing & Final Handover', status: 'PENDING', photoCount: 0, photosUploaded: false },
  ];

  // Milestones
  const milestones = Array.isArray(raw.milestones) ? raw.milestones : [];

  // Timeline
  const timeline = Array.isArray(raw.timeline) ? raw.timeline : [];

  // Evidence
  const evidence = Array.isArray(raw.evidence) ? raw.evidence : [];

  // Before / After Evidence
  const beforeAfter = raw.beforeAfter || null;

  // Documents
  const documents = Array.isArray(raw.documents) ? raw.documents : [];

  // Inspections
  const inspections = Array.isArray(raw.inspections) ? raw.inspections : [];

  // Citizen Feedback
  const citizenFeedback = Array.isArray(raw.citizenFeedback) ? raw.citizenFeedback : [];

  // Activity
  const activity = Array.isArray(raw.activity) ? raw.activity : [];

  // AI Insights
  const aiInsights = Array.isArray(raw.aiInsights) ? raw.aiInsights : [];

  return {
    id,
    mpId: raw.mpId || 'MP001',
    constituencyId: raw.constituencyId || raw.location?.constituency || 'Pune',
    title,
    sector,
    description,
    location,
    status,
    dates,
    progress,
    financial,
    expenditureReview,
    risk,
    contractor,
    milestoneTracks,
    milestones,
    timeline,
    evidence,
    beforeAfter,
    documents,
    inspections,
    citizenFeedback,
    activity,
    aiInsights,
    beneficiaries: raw.beneficiaries || 4200,
    financialYear: raw.financialYear || '2026-27',
  };
};
