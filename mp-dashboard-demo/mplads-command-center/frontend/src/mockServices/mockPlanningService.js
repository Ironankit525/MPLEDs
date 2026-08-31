import { MOCK_PLANNING } from '../mock/planning.js';

export const mockPlanningService = {
  getProposedProjects: async (mpId = "MP001") => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return MOCK_PLANNING[mpId] || MOCK_PLANNING["MP001"];
  },

  getPriorityAnalysis: async (mpId = "MP001") => {
    await new Promise(resolve => setTimeout(resolve, 150));
    const proposals = MOCK_PLANNING[mpId] || MOCK_PLANNING["MP001"];
    return {
      highPriorityCount: proposals.filter(p => p.urgency === 'HIGH').length,
      topRequestedSector: "Water & Sanitation",
      averageImpactScore: Math.round(proposals.reduce((acc, p) => acc + p.impactScore, 0) / (proposals.length || 1)),
      proposals
    };
  }
};
