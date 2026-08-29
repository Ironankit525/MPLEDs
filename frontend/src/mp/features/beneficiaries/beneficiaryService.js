import { mockBeneficiaryService } from '../../mockServices/mockBeneficiaryService';
// import apiClient from '../../services/apiClient';

export const beneficiaryService = {
  getBeneficiaries: async (mpId) => {
    return await mockBeneficiaryService.getBeneficiaries(mpId);
    // return await apiClient.get('/beneficiaries', { params: { mpId } });
  }
};
