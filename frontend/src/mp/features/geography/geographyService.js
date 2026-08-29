import { mockGeographyService } from '../../mockServices/mockGeographyService';
// import apiClient from '../../services/apiClient';

export const geographyService = {
  getConstituencyData: async (mpId) => {
    return await mockGeographyService.getConstituencyData(mpId);
    // return await apiClient.get('/geography/constituency', { params: { mpId } });
  },

  getDevelopmentGaps: async (mpId) => {
    return await mockGeographyService.getDevelopmentGaps(mpId);
    // return await apiClient.get('/geography/gaps', { params: { mpId } });
  }
};
