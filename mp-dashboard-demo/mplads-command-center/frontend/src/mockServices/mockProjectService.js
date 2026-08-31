import { MOCK_PROJECTS } from '../mock/projects.js';
import { MOCK_PROJECT_DETAILS } from '../mock/projectDetailData.js';
import { normalizeProject } from '../types/project.js';

let projectsStore = [...MOCK_PROJECTS];

export const mockProjectService = {
  getProjects: async (mpId = "MP001", filters = {}) => {
    await new Promise(resolve => setTimeout(resolve, 150));
    let result = projectsStore.filter(p => p.mpId === mpId);

    if (filters.financialYear) {
      result = result.filter(p => p.financialYear === filters.financialYear);
    }
    if (filters.status) {
      result = result.filter(p => p.status === filters.status);
    }
    if (filters.sector) {
      result = result.filter(p => p.sector === filters.sector);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) || 
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.location?.village && p.location.village.toLowerCase().includes(q)) ||
        (p.location?.district && p.location.district.toLowerCase().includes(q))
      );
    }

    return result.map(p => {
      // If a rich detail object exists, enrich the summary item
      const detailed = MOCK_PROJECT_DETAILS[p.id] || Object.values(MOCK_PROJECT_DETAILS).find(d => d.id === p.id || d.altId === p.id);
      return normalizeProject(detailed || p);
    });
  },

  getProjectById: async (id) => {
    await new Promise(resolve => setTimeout(resolve, 180));
    if (!id) throw new Error('Project ID is required.');

    // Look up directly by key
    if (MOCK_PROJECT_DETAILS[id]) {
      return normalizeProject(MOCK_PROJECT_DETAILS[id]);
    }

    // Look up by id or altId inside MOCK_PROJECT_DETAILS
    const foundDetail = Object.values(MOCK_PROJECT_DETAILS).find(
      p => p.id === id || p.altId === id || p.id.toLowerCase() === id.toLowerCase() || (p.altId && p.altId.toLowerCase() === id.toLowerCase())
    );

    if (foundDetail) {
      return normalizeProject(foundDetail);
    }

    // Look up in general MOCK_PROJECTS list and construct a normalized fallback model
    const foundBasic = projectsStore.find(p => p.id === id || (p.altId && p.altId === id));
    if (foundBasic) {
      return normalizeProject(foundBasic);
    }

    // If not found in any store
    throw new Error(`Project with ID "${id}" could not be found.`);
  },

  createProject: async (projectData) => {
    await new Promise(resolve => setTimeout(resolve, 250));
    const nextNum = projectsStore.length + 1;
    const newId = `MPLADS-PUN-2026-${String(nextNum).padStart(3, '0')}`;
    const altId = `PRJ${String(nextNum).padStart(3, '0')}`;
    
    const newProject = {
      id: newId,
      altId,
      releasedAmount: 0,
      utilizedAmount: 0,
      status: "NOT_STARTED",
      completionPercentage: 0,
      startDate: new Date().toISOString().split('T')[0],
      ...projectData
    };
    projectsStore.unshift(newProject);
    return normalizeProject(newProject);
  },

  updateProject: async (id, updateData) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    const index = projectsStore.findIndex(p => p.id === id || p.altId === id);
    if (index === -1) throw new Error(`Project with ID ${id} not found.`);

    projectsStore[index] = { ...projectsStore[index], ...updateData };
    return normalizeProject(projectsStore[index]);
  }
};
