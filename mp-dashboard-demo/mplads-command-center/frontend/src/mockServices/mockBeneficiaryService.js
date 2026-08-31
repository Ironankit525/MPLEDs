import { MOCK_BENEFICIARIES } from '../mock/beneficiaries.js';

export const mockBeneficiaryService = {
  getBeneficiaries: async (mpId = "MP001") => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return MOCK_BENEFICIARIES[mpId] || MOCK_BENEFICIARIES["MP001"];
  }
};
