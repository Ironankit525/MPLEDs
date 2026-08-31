import { MOCK_FUNDS } from '../mock/funds.js';
import { MOCK_EXPENDITURES } from '../mock/expenditures.js';

export const mockFinanceService = {
  getFundSummary: async (mpId = "MP001", financialYear = "2026-27") => {
    await new Promise(resolve => setTimeout(resolve, 200));
    const fund = MOCK_FUNDS[mpId]?.[financialYear] || MOCK_FUNDS["MP001"]["2026-27"];
    return {
      ...fund,
      utilizationRate: fund.released > 0 ? Number(((fund.utilized / fund.released) * 100).toFixed(2)) : 0
    };
  },

  getExpenditures: async (mpId = "MP001") => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return MOCK_EXPENDITURES[mpId] || [];
  },

  getSectorAllocation: async (mpId = "MP001", financialYear = "2026-27") => {
    await new Promise(resolve => setTimeout(resolve, 150));
    const fund = MOCK_FUNDS[mpId]?.[financialYear] || MOCK_FUNDS["MP001"]["2026-27"];
    return fund.sectorAllocation || [];
  }
};
