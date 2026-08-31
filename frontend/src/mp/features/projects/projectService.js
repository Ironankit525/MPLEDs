import { mockProjectService } from '../../mockServices/mockProjectService.js';
// import apiClient from '../../services/apiClient.js';

/**
 * Projects Feature Service Layer.
 */
export const projectService = {
  getProjects: async (mpId, filters) => {
    return await mockProjectService.getProjects(mpId, filters);
    // return await apiClient.get('/projects', { params: { mpId, ...filters } });
  },

  getProjectById: async (id) => {
    return await mockProjectService.getProjectById(id);
    // return await apiClient.get(`/projects/${id}`);
  },

  createProject: async (data) => {
    return await mockProjectService.createProject(data);
    // return await apiClient.post('/projects', data);
  },

  updateProject: async (id, data) => {
    return await mockProjectService.updateProject(id, data);
    // return await apiClient.put(`/projects/${id}`, data);
  }
};
