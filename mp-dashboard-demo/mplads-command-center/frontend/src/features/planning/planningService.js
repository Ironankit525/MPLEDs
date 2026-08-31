import { mockPlanningService } from '../../mockServices/mockPlanningService.js';
// import apiClient from '../../services/apiClient.js';

export const planningService = {
  getProposedProjects: async (mpId) => {
    return await mockPlanningService.getProposedProjects(mpId);
    // return await apiClient.get('/planning/proposals', { params: { mpId } });
  },

  getPriorityAnalysis: async (mpId) => {
    return await mockPlanningService.getPriorityAnalysis(mpId);
    // return await apiClient.get('/planning/priority-analysis', { params: { mpId } });
  }
};
