// import apiClient from '../../services/apiClient';

export const reportService = {
  getAvailableReports: async (mpId, financialYear) => {
    return [
      { id: 'REP001', title: `Annual MPLADS Fund Expenditure Statement (${financialYear})`, category: 'Financial', format: 'PDF' },
      { id: 'REP002', title: 'Constituency Project Physical Progress Audit', category: 'Projects', format: 'PDF' },
      { id: 'REP003', title: 'Sector-wise Fund Allocation & Beneficiary Impact', category: 'Analytics', format: 'XLSX' }
    ];
  }
};
