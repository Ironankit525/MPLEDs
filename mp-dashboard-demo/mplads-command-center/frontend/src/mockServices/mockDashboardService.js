import { getMockDashboardData } from '../mock/dashboard.js';

export const mockDashboardService = {
  getDashboardData: async (mpId = "MP001", financialYear = "2026-27") => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return getMockDashboardData(mpId, financialYear);
  }
};
