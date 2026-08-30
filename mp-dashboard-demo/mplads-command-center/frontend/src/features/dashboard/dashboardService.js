import { mockDashboardService } from '../../mockServices/mockDashboardService';
// Future Real Backend API Client:
// import apiClient from '../../services/apiClient';

/**
 * Dashboard Feature Service Layer.
 * Decouples UI components from data source.
 */
export const dashboardService = {
  getDashboardData: async (mpId, financialYear) => {
    // Current (Development / Demo Mode):
    return await mockDashboardService.getDashboardData(mpId, financialYear);

    // Future Production Backend Call:
    // return await apiClient.get('/dashboard', { params: { mpId, financialYear } });
  }
};
