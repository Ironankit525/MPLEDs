import { mockContractorService } from '../../mockServices/mockContractorService.js';
// import apiClient from '../../services/apiClient.js';

export const contractorService = {
  getContractors: async (mpId = null) => {
    return await mockContractorService.getContractors(mpId);
    // return await apiClient.get('/contractors', { params: { mpId } });
  },

  getContractorById: async (id, mpId = null) => {
    return await mockContractorService.getContractorById(id, mpId);
    // return await apiClient.get(`/contractors/${id}`);
  }
};
