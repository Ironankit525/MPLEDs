import { MOCK_GEOGRAPHY } from '../mock/geography';
import { MOCK_PROJECTS } from '../mock/projects';

export const mockGeographyService = {
  getConstituencyData: async (mpId = "MP001") => {
    await new Promise(resolve => setTimeout(resolve, 200));
    const geo = MOCK_GEOGRAPHY[mpId] || MOCK_GEOGRAPHY["MP001"];
    const projects = MOCK_PROJECTS.filter(p => p.mpId === mpId);
    return { ...geo, projects };
  },

  getDevelopmentGaps: async (mpId = "MP001") => {
    await new Promise(resolve => setTimeout(resolve, 150));
    const geo = MOCK_GEOGRAPHY[mpId] || MOCK_GEOGRAPHY["MP001"];
    return geo.developmentGaps || [];
  }
};
