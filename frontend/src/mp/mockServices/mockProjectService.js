import { MOCK_PROJECTS } from '../mock/projects';

let projectsStore = [...MOCK_PROJECTS];

export const mockProjectService = {
  getProjects: async (mpId = "MP001", filters = {}) => {
    await new Promise(resolve => setTimeout(resolve, 200));
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
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.location.village.toLowerCase().includes(q));
    }

    return result;
  },

  getProjectById: async (id) => {
    await new Promise(resolve => setTimeout(resolve, 150));
    const project = projectsStore.find(p => p.id === id);
    if (!project) {
      throw new Error(`Project with ID ${id} not found.`);
    }
    return project;
  },

  createProject: async (projectData) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const newProject = {
      id: `PRJ${String(projectsStore.length + 1).padStart(3, '0')}`,
      releasedAmount: 0,
      utilizedAmount: 0,
      status: "NOT_STARTED",
      completionPercentage: 0,
      startDate: new Date().toISOString().split('T')[0],
      ...projectData
    };
    projectsStore.unshift(newProject);
    return newProject;
  },

  updateProject: async (id, updateData) => {
    await new Promise(resolve => setTimeout(resolve, 250));
    const index = projectsStore.findIndex(p => p.id === id);
    if (index === -1) throw new Error(`Project with ID ${id} not found.`);

    projectsStore[index] = { ...projectsStore[index], ...updateData };
    return projectsStore[index];
  }
};
