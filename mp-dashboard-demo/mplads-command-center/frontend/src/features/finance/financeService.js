import { mockFinanceService } from '../../mockServices/mockFinanceService';
// import apiClient from '../../services/apiClient';

/**
 * Financial Management Feature Service Layer.
 */
export const financeService = {
  getFundSummary: async (mpId, financialYear) => {
    return await mockFinanceService.getFundSummary(mpId, financialYear);
    // return await apiClient.get('/finance/summary', { params: { mpId, financialYear } });
  },

  getExpenditure: async (mpId) => {
    return await mockFinanceService.getExpenditures(mpId);
    // return await apiClient.get('/finance/expenditure', { params: { mpId } });
  },

  getSectorAllocation: async (mpId, financialYear) => {
    return await mockFinanceService.getSectorAllocation(mpId, financialYear);
    // return await apiClient.get('/finance/sector-allocation', { params: { mpId, financialYear } });
  }
};
