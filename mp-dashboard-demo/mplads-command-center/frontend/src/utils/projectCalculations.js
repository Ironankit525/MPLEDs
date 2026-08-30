/**
 * Centralized calculation and derived selector utilities for MPLADS Projects (MP-Facing Portal).
 */

/**
 * Calculates money flow and utilization metrics.
 * @param {Object} financial - { estimatedCost, sanctioned, released, utilized }
 */
export const getFinancialStats = (financial = {}) => {
  const estimatedCost = financial.estimatedCost || financial.sanctioned || 0;
  const sanctioned = financial.sanctioned || 0;
  const released = financial.released || 0;
  const utilized = financial.utilized || 0;

  const remainingReleased = Math.max(0, released - utilized);
  const unreleased = Math.max(0, sanctioned - released);
  const unutilizedFromSanctioned = Math.max(0, sanctioned - utilized);
  const utilizationOfSanctioned = sanctioned > 0 ? (utilized / sanctioned) * 100 : 0;
  const utilizationOfReleased = released > 0 ? (utilized / released) * 100 : 0;
  const releasePercentage = sanctioned > 0 ? (released / sanctioned) * 100 : 0;

  return {
    estimatedCost,
    sanctioned,
    released,
    utilized,
    remainingReleased,
    unreleased,
    unutilizedFromSanctioned,
    utilizationOfSanctioned: Math.round(utilizationOfSanctioned * 10) / 10,
    utilizationOfReleased: Math.round(utilizationOfReleased * 10) / 10,
    releasePercentage: Math.round(releasePercentage * 10) / 10,
  };
};

/**
 * Computes Physical vs Financial alignment and severity tier.
 * @param {number} physicalProgress 
 * @param {number} financialProgress 
 */
export const getProgressAlignment = (physicalProgress = 0, financialProgress = 0) => {
  const diff = Math.round((financialProgress - physicalProgress) * 10) / 10;

  if (diff >= 15) {
    return {
      status: 'CRITICAL_MISMATCH',
      difference: diff,
      label: 'Significant Variance',
      alertHeadline: `Financial progress is ${diff} percentage points ahead of physical progress.`,
      description: `Disbursements recorded (68%) lead on-site verified completion (53%) by ${diff}%. Physical verification and itemized voucher review are advised.`,
      badgeVariant: 'rose',
      textColor: 'text-rose-700',
      bgColor: 'bg-white',
      borderColor: 'border-slate-200',
      signal: 'Verification recommended',
    };
  }

  if (diff > 5) {
    return {
      status: 'MODERATE_MISMATCH',
      difference: diff,
      label: 'Moderate Variance',
      alertHeadline: `Financial progress is ${diff} percentage points ahead of physical progress.`,
      description: `Disbursements are pacing slightly ahead of field execution (+${diff}%). Recommended to monitor upcoming milestone delivery.`,
      badgeVariant: 'amber',
      textColor: 'text-amber-700',
      bgColor: 'bg-white',
      borderColor: 'border-slate-200',
      signal: 'Monitor milestone pace',
    };
  }

  if (diff < -15) {
    return {
      status: 'PHYSICAL_AHEAD',
      difference: diff,
      label: 'Physical Progress Ahead of Payments',
      alertHeadline: `On-ground construction is leading fund disbursements by ${Math.abs(diff)}%.`,
      description: `Contractor delivery is ahead of billed disbursements. Ready for next scheduled tranche release upon MB submission.`,
      badgeVariant: 'sky',
      textColor: 'text-sky-700',
      bgColor: 'bg-white',
      borderColor: 'border-slate-200',
      signal: 'Ready for tranche release',
    };
  }

  return {
    status: 'HEALTHY',
    difference: diff,
    label: 'Healthy Alignment',
    alertHeadline: 'Physical and financial execution are well synchronized.',
    description: `Physical progress (${physicalProgress}%) and financial utilization (${financialProgress}%) are balanced within normal variance limits.`,
    badgeVariant: 'emerald',
    textColor: 'text-emerald-700',
    bgColor: 'bg-white',
    borderColor: 'border-slate-200',
    signal: 'Execution on track',
  };
};

/**
 * Evaluates risk score into category tiers.
 * 0–30 Low, 31–60 Medium, 61–80 High, 81–100 Critical
 * @param {number} score 
 */
export const getRiskCategory = (score = 0) => {
  const num = Math.min(100, Math.max(0, score));
  if (num <= 30) {
    return {
      level: 'LOW',
      label: 'Low Risk',
      color: 'emerald',
      bgClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      barClass: 'bg-emerald-500',
      textClass: 'text-emerald-700',
      description: 'Project is progressing satisfactorily with low schedule and financial variance.',
    };
  }
  if (num <= 60) {
    return {
      level: 'MEDIUM',
      label: 'Medium Risk',
      color: 'amber',
      bgClass: 'bg-amber-50 text-amber-800 border-amber-200',
      barClass: 'bg-amber-500',
      textClass: 'text-amber-700',
      description: 'Moderate risk indicators observed. Attention recommended on milestone deliverables.',
    };
  }
  if (num <= 80) {
    return {
      level: 'HIGH',
      label: 'High Risk',
      color: 'orange',
      bgClass: 'bg-orange-50 text-orange-800 border-orange-200',
      barClass: 'bg-orange-500',
      textClass: 'text-orange-700',
      description: 'High risk flags present. Review of schedule timeline and payment alignment advised.',
    };
  }
  return {
    level: 'CRITICAL',
    label: 'Critical Risk',
    color: 'rose',
    bgClass: 'bg-rose-50 text-rose-800 border-rose-200',
    barClass: 'bg-rose-500',
    textClass: 'text-rose-700',
    description: 'Critical variances detected. Immediate parliamentary inquiry or field inspection recommended.',
  };
};

/**
 * Calculates days elapsed from start date and estimated total duration.
 * @param {string} startDate 
 * @param {string} expectedCompletionDate 
 */
export const getTimelineMetrics = (startDate, expectedCompletionDate) => {
  const start = startDate ? new Date(startDate) : new Date('2026-02-15');
  const end = expectedCompletionDate ? new Date(expectedCompletionDate) : new Date('2026-09-18');
  const now = new Date('2026-08-30'); // Reference local date

  const totalDurationMs = Math.max(1, end.getTime() - start.getTime());
  const elapsedMs = Math.max(0, now.getTime() - start.getTime());
  const remainingMs = Math.max(0, end.getTime() - now.getTime());

  const daysTotal = Math.round(totalDurationMs / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.round(elapsedMs / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.round(remainingMs / (1000 * 60 * 60 * 24));
  const timeProgress = Math.min(100, Math.round((daysElapsed / daysTotal) * 100));

  return {
    daysTotal,
    daysElapsed,
    daysRemaining,
    timeProgress,
    isOverdue: now > end,
  };
};
