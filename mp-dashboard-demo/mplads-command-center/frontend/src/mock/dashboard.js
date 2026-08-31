// All data in the demo environment is fictional and used only for development/testing.

import { MOCK_MPS } from './mps';
import { MOCK_FUNDS } from './funds';
import { MOCK_PROJECTS } from './projects';
import { MOCK_EXPENDITURES } from './expenditures';
import { MOCK_GEOGRAPHY } from './geography';

export const getMockDashboardData = (mpId = "MP001", financialYear = "2026-27") => {
  const mp = MOCK_MPS.find(m => m.id === mpId) || MOCK_MPS[0];
  const mpFunds = MOCK_FUNDS[mpId]?.[financialYear] || MOCK_FUNDS["MP001"]["2026-27"];
  const mpGeo = MOCK_GEOGRAPHY[mpId] || MOCK_GEOGRAPHY["MP001"];

  // Coherent Fictional Command Center Telemetry for MP001 (Pune, 2026-27)
  const isPuneDefault = mpId === "MP001" && financialYear === "2026-27";

  const allocation = mpFunds.allocation || 50000000;
  const sanctioned = mpFunds.sanctioned || 42000000;
  const released = mpFunds.released || 38000000;
  const utilized = mpFunds.utilized || 31500000;
  const unutilizedReleased = released - utilized; // 6,500,000 (₹65L)
  const remainingAllocation = allocation - sanctioned; // 8,000,000 or remaining unallocated + unspent

  return {
    mp: {
      id: mp.id,
      name: mp.name,
      constituency: mp.constituency,
      state: mp.state,
      party: mp.party,
      avatar: mp.avatar
    },

    financialYear: financialYear,
    lastUpdated: "29 Aug 2026, 10:32 AM",

    // Section 4: Action Required Alert Section
    attentionRequired: [
      {
        id: "ALT001",
        severity: "critical", // red
        title: "Road Improvement Project",
        issue: "18 days behind schedule",
        actionLabel: "View Project",
        targetPath: "/mp/projects/PRJ003",
        category: "Delayed Execution",
        area: "Mulshi Block"
      },
      {
        id: "ALT002",
        severity: "warning", // amber/orange
        title: "Payment Not Utilized",
        issue: "₹24L released funds have not yet been utilized",
        actionLabel: "View Funds",
        targetPath: "/finance",
        category: "Payment Not Utilized",
        area: "Haveli Block"
      },
      {
        id: "ALT003",
        severity: "warning", // amber/orange
        title: "Contractor Payment Pending",
        issue: "Payment pending for 12 days",
        actionLabel: "Review Payment",
        targetPath: "/mp/contractors",
        category: "Verification Required",
        area: "Pune Cantonment"
      }
    ],

    // Section 5: Decision-Oriented KPIs
    kpis: {
      annualAllocation: allocation,
      utilizedAmount: utilized,
      utilizationPct: ((utilized / allocation) * 100).toFixed(1), // 63.0%
      projectsProposed: 12,
      projectsCompleted: 7,
      projectsOngoing: 4,
      projectsAtRisk: 1,
      projectsDelayed: 2
    },

    // Section 6 & 7: Fund Flow & Financial Utilization
    fundPosition: {
      annualAllocation: allocation, // ₹5.00 Cr
      sanctioned: sanctioned, // ₹4.20 Cr
      released: released, // ₹3.80 Cr
      utilized: utilized, // ₹3.15 Cr
      unutilizedReleased: unutilizedReleased, // ₹65L
      remainingAllocation: 12000000, // ₹1.20 Cr
      sanctionedPctOfAllocation: 84.0,
      releasedPctOfAllocation: 76.0,
      utilizedPctOfAllocation: 63.0,
      unutilizedPctOfReleased: 17.1,
      utilizedPctOfReleased: 82.9
    },

    // Section 8: Project Pipeline Stages
    projectPipeline: [
      { stage: "Proposed", count: 12, label: "12 Proposed", description: "Identified in Annual Plan", status: "proposed" },
      { stage: "Technically Approved", count: 10, label: "10 Technically Approved", description: "DPR & Estimates Vetted", status: "approved" },
      { stage: "Sanctioned", count: 9, label: "9 Sanctioned", description: "Administrative Sanction Issued", status: "sanctioned" },
      { stage: "Started", count: 7, label: "7 Started", description: "Work Orders Released & Grounded", status: "started" },
      { stage: "Completed", count: 7, label: "7 Completed", description: "Handed over to community", status: "completed" }
    ],

    // Section 9: Project Health Metrics
    projectHealth: {
      onTrack: 7,
      atRisk: 3,
      delayed: 2,
      notStarted: 0,
      delayedProjectsFund: 4800000, // ₹48L associated with delayed works
      totalProjects: 12
    },

    // Section 10: Monitoring Table Projects
    monitoringProjects: [
      {
        id: "PRJ003",
        name: "Rural Concrete Connecting Road - Phase II",
        agency: "PWD",
        sector: "Roads & Bridges",
        area: "Mulshi",
        progress: 82,
        amount: 4800000,
        timeline: "12 days remaining",
        risk: "Low",
        status: "On Track",
        healthKey: "onTrack",
        contractor: "ABC Infrastructure Ltd."
      },
      {
        id: "PRJ011",
        name: "Community Hall Construction & Solar Roof",
        agency: "PMC",
        sector: "Community Assets",
        area: "Kothrud",
        progress: 54,
        amount: 3200000,
        timeline: "18 days delayed",
        risk: "Medium",
        status: "At Risk",
        healthKey: "atRisk",
        contractor: "Sahyadri Construction Corp"
      },
      {
        id: "PRJ001",
        name: "Community Health Centre Upgradation",
        agency: "PWD",
        sector: "Healthcare",
        area: "Haveli",
        progress: 65,
        amount: 1800000,
        timeline: "8 days remaining",
        risk: "Low",
        status: "On Track",
        healthKey: "onTrack",
        contractor: "ABC Infrastructure Ltd."
      },
      {
        id: "PRJ012",
        name: "Primary School Science Lab & Smart Class",
        agency: "Education Dept.",
        sector: "Education",
        area: "Shirur",
        progress: 21,
        amount: 1800000,
        timeline: "27 days delayed",
        risk: "High",
        status: "Delayed",
        healthKey: "delayed",
        contractor: "Apex InfraTech Pvt Ltd"
      },
      {
        id: "PRJ002",
        name: "Smart Water ATM & Piped Distribution",
        agency: "PMC",
        sector: "Water & Sanitation",
        area: "Parvati",
        progress: 100,
        amount: 2200000,
        timeline: "Completed",
        risk: "Low",
        status: "Completed",
        healthKey: "completed",
        contractor: "Apex InfraTech Pvt Ltd"
      },
      {
        id: "PRJ013",
        name: "Ambedkar Nagar Anganwadi Modernization",
        agency: "PMC",
        sector: "Education",
        area: "Kasba Peth",
        progress: 42,
        amount: 1600000,
        timeline: "14 days delayed",
        risk: "Medium",
        status: "Delayed",
        healthKey: "delayed",
        contractor: "Sahyadri Construction Corp"
      }
    ],

    // Section 11: Expenditure Performance (Planned vs Actual)
    expenditurePerformance: {
      plannedTotal: 36000000, // ₹3.60 Cr
      actualTotal: 31500000, // ₹3.15 Cr
      achievementPct: 87.5,
      months: [
        { month: "Apr 2026", planned: 4000000, actual: 3500000, cumulativePlanned: 4000000, cumulativeActual: 3500000 },
        { month: "May 2026", planned: 5500000, actual: 4800000, cumulativePlanned: 9500000, cumulativeActual: 8300000 },
        { month: "Jun 2026", planned: 7000000, actual: 6200000, cumulativePlanned: 16500000, cumulativeActual: 14500000 },
        { month: "Jul 2026", planned: 6000000, actual: 5100000, cumulativePlanned: 22500000, cumulativeActual: 19600000 },
        { month: "Aug 2026", planned: 5000000, actual: 4400000, cumulativePlanned: 27500000, cumulativeActual: 24000000 },
        { month: "Sep 2026 (Proj)", planned: 8500000, actual: 7500000, cumulativePlanned: 36000000, cumulativeActual: 31500000 }
      ]
    },

    // Section 12: Constituency Development Map Snapshot (12 Projects Across 6 Areas)
    constituencyMap: {
      totalProjects: 12,
      areasCount: 6,
      center: [18.5204, 73.8567],
      areas: [
        { name: "Shivajinagar", projectsCount: 2, status: "Healthy" },
        { name: "Kothrud", projectsCount: 3, status: "At Risk" },
        { name: "Haveli", projectsCount: 2, status: "Healthy" },
        { name: "Kasba Peth", projectsCount: 2, status: "Delayed" },
        { name: "Parvati", projectsCount: 2, status: "Completed" },
        { name: "Hadapsar", projectsCount: 1, status: "Healthy" }
      ],
      pins: [
        { id: "P1", name: "Road Improvement (Mulshi)", x: 22, y: 38, area: "Mulshi / Kothrud", status: "On Track", amount: "₹48L", agency: "PWD", progress: 82 },
        { id: "P2", name: "CHC Upgradation", x: 68, y: 72, area: "Haveli", status: "On Track", amount: "₹18L", agency: "PWD", progress: 65 },
        { id: "P3", name: "Community Hall Construction", x: 40, y: 48, area: "Kothrud", status: "At Risk", amount: "₹32L", agency: "PMC", progress: 54 },
        { id: "P4", name: "Primary School Science Lab", x: 80, y: 30, area: "Shirur", status: "Delayed", amount: "₹18L", agency: "Education Dept.", progress: 21 },
        { id: "P5", name: "Water ATM & Piped Network", x: 50, y: 65, area: "Parvati", status: "Completed", amount: "₹22L", agency: "PMC", progress: 100 },
        { id: "P6", name: "Anganwadi Modernization", x: 48, y: 42, area: "Kasba Peth", status: "Delayed", amount: "₹16L", agency: "PMC", progress: 42 },
        { id: "P7", name: "Solar Street Light Array", x: 35, y: 25, area: "Shivajinagar", status: "Completed", amount: "₹14L", agency: "PWD", progress: 100 },
        { id: "P8", name: "Veterinary Care Dispensary", x: 60, y: 35, area: "Hadapsar", status: "Proposed", amount: "₹25L", agency: "PWD", progress: 0 }
      ]
    },

    // Section 13: Agency Performance
    agencyPerformance: [
      { name: "PWD", fullName: "Public Works Department", projects: 5, onTrack: 4, delayed: 1, utilization: "91%", status: "Good", alert: null },
      { name: "PMC", fullName: "Pune Municipal Corporation", projects: 4, onTrack: 2, delayed: 2, utilization: "68%", status: "Needs Attention", alert: "PMC — 2 delayed projects" },
      { name: "Education Dept.", fullName: "District Education Directorate", projects: 3, onTrack: 3, delayed: 0, utilization: "95%", status: "Excellent", alert: null }
    ],

    // Section 14: Contractor Performance
    contractorPerformance: [
      {
        name: "ABC Infrastructure Ltd.",
        projects: 4,
        completed: 3,
        delayed: 1,
        avgCompletionDays: "142 days",
        paymentStatus: "2 milestones pending",
        riskSignal: "Payment verification pending",
        riskLevel: "Medium"
      },
      {
        name: "Sahyadri Construction Corp",
        projects: 5,
        completed: 2,
        delayed: 2,
        avgCompletionDays: "188 days",
        paymentStatus: "1 invoice under audit",
        riskSignal: "Site inspection gap flagged",
        riskLevel: "High"
      },
      {
        name: "Apex InfraTech Pvt Ltd",
        projects: 3,
        completed: 2,
        delayed: 0,
        avgCompletionDays: "120 days",
        paymentStatus: "All settlements cleared",
        riskSignal: "No risk signals detected",
        riskLevel: "Low"
      }
    ],

    // Section 15: Integrity & Risk Signals
    integrityRiskSignals: [
      {
        id: "SIG001",
        level: "critical", // red
        title: "Payment vs Physical Progress Mismatch",
        count: 2,
        unit: "projects",
        description: "Disbursement pace exceeds ground execution percentage by >15%",
        investigatePath: "/mp/projects"
      },
      {
        id: "SIG002",
        level: "warning", // amber
        title: "Unusual Cost Variation",
        count: 2,
        unit: "projects",
        description: "Revised estimates deviate from initial approved technical sanction",
        investigatePath: "/mp/projects"
      },
      {
        id: "SIG003",
        level: "warning", // amber
        title: "Repeated Contractor Delays",
        count: 1,
        unit: "agency",
        description: "Vendor flagged for concurrent project delay across 2 wards",
        investigatePath: "/mp/contractors"
      }
    ],

    // Section 16: Citizen Impact
    citizenImpact: {
      totalBeneficiaries: 48250,
      amountUtilized: utilized, // ₹3.15 Cr
      sectors: [
        { label: "Water & Sanitation", icon: "🚰", count: 15200, percentage: 31.5, color: "text-sky-600 bg-sky-50 border-sky-200" },
        { label: "Education & Schools", icon: "🏫", count: 12400, percentage: 25.7, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
        { label: "Rural Infrastructure", icon: "🛣", count: 12050, percentage: 25.0, color: "text-amber-600 bg-amber-50 border-amber-200" },
        { label: "Healthcare & Clinics", icon: "🏥", count: 8600, percentage: 17.8, color: "text-emerald-600 bg-emerald-50 border-emerald-200" }
      ]
    },

    // Section 17: Citizen Feedback
    citizenFeedbackSummary: {
      total: 37,
      resolved: 28,
      underReview: 6,
      escalated: 3,
      ongoingLinkedCount: 3,
      highlightText: "3 issues linked directly to ongoing road & water works",
      freshness: "Synced 2 hrs ago"
    }
  };
};
