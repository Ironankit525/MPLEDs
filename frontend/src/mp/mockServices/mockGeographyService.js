import { MOCK_GEOGRAPHY } from '../mock/geography';

export const mockGeographyService = {
  getConstituencyData: async (mpId = "MP001") => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return MOCK_GEOGRAPHY[mpId] || MOCK_GEOGRAPHY["MP001"];
  },

  getDevelopmentGaps: async (mpId = "MP001") => {
    await new Promise(resolve => setTimeout(resolve, 150));
    const geo = MOCK_GEOGRAPHY[mpId] || MOCK_GEOGRAPHY["MP001"];
    return geo.developmentGaps || [];
  }
};
