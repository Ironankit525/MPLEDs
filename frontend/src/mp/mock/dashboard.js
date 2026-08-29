// All data in the demo environment is fictional and used only for development/testing.

import { MOCK_MPS } from './mps';
import { MOCK_FUNDS } from './funds';
import { MOCK_PROJECTS } from './projects';
import { MOCK_EXPENDITURES } from './expenditures';
import { MOCK_GEOGRAPHY } from './geography';

export const getMockDashboardData = (mpId = "MP001", financialYear = "2026-27") => {
  const mp = MOCK_MPS.find(m => m.id === mpId) || MOCK_MPS[0];
  const mpFunds = MOCK_FUNDS[mpId]?.[financialYear] || MOCK_FUNDS["MP001"]["2026-27"];
  const mpProjects = MOCK_PROJECTS.filter(p => p.mpId === mpId);
  const mpExpenditures = MOCK_EXPENDITURES[mpId] || [];
  const mpGeo = MOCK_GEOGRAPHY[mpId] || MOCK_GEOGRAPHY["MP001"];

  const projectCounts = {
    total: mpProjects.length,
    active: mpProjects.filter(p => p.status === 'ONGOING').length,
    completed: mpProjects.filter(p => p.status === 'COMPLETED').length,
    ongoing: mpProjects.filter(p => p.status === 'ONGOING').length,
    notStarted: mpProjects.filter(p => p.status === 'NOT_STARTED').length,
  };

  const totalBeneficiaries = mpProjects.reduce((acc, p) => acc + (p.beneficiaries || 0), 0);

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

    fund: {
      allocation: mpFunds.allocation,
      sanctioned: mpFunds.sanctioned,
      released: mpFunds.released,
      utilized: mpFunds.utilized,
      available: mpFunds.available,
      committed: mpFunds.committed
    },

    projects: projectCounts,

    beneficiaries: totalBeneficiaries > 0 ? totalBeneficiaries : 245000,

    villagesCovered: mpGeo.villagesCovered || 126,

    recentProjects: mpProjects.slice(0, 5),

    sectorAllocation: mpFunds.sectorAllocation || [],

    expenditureTrend: mpExpenditures.map(exp => ({
      month: exp.month,
      amount: exp.amount,
      sector: exp.sector
    })),

    projectStatus: [
      { status: "COMPLETED", count: projectCounts.completed, label: "Completed" },
      { status: "ONGOING", count: projectCounts.ongoing, label: "Ongoing" },
      { status: "NOT_STARTED", count: projectCounts.notStarted, label: "Not Started" }
    ]
  };
};
