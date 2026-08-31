import { mockBeneficiaryService } from '../../mockServices/mockBeneficiaryService.js';
// import apiClient from '../../services/apiClient.js';

export const beneficiaryService = {
  getBeneficiaries: async (mpId) => {
    return await mockBeneficiaryService.getBeneficiaries(mpId);
    // return await apiClient.get('/beneficiaries', { params: { mpId } });
  }
};
