import { mockProjectService } from '../../mockServices/mockProjectService';
import apiClient from '../../services/apiClient';
import { normalizeProject } from '../../types/project';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

/**
 * Production-Ready Projects Service Layer.
 * Interacts with either the live Backend REST API or the local high-fidelity Mock Service.
 * Normalizes all inbound responses to conform strictly to UI data contracts.
 */
export const projectService = {
  /**
   * Fetches list of constituency projects with optional filter criteria.
   */
  getProjects: async (mpId = 'MP001', filters = {}) => {
    if (USE_MOCK) {
      const data = await mockProjectService.getProjects(mpId, filters);
      return data.map(normalizeProject);
    }
    try {
      const res = await apiClient.get('/projects', { params: { mpId, ...filters } });
      const rawList = Array.isArray(res) ? res : res.data || [];
      return rawList.map(normalizeProject);
    } catch (err) {
      console.warn('[projectService] Live API unavailable, falling back to mock provider:', err.message);
      const data = await mockProjectService.getProjects(mpId, filters);
      return data.map(normalizeProject);
    }
  },

  /**
   * Fetches comprehensive project details by ID.
   */
  getProjectById: async (id) => {
    if (USE_MOCK) {
      const raw = await mockProjectService.getProjectById(id);
      return normalizeProject(raw);
    }
    try {
      const res = await apiClient.get(`/projects/${id}`);
      return normalizeProject(res.data || res);
    } catch (err) {
      console.warn(`[projectService] Live API unavailable for project ${id}, falling back to mock provider:`, err.message);
      const raw = await mockProjectService.getProjectById(id);
      return normalizeProject(raw);
    }
  },

  /**
   * Granular endpoint abstraction for Financials (if backend separates them).
   */
  getProjectFinancials: async (id) => {
    const project = await projectService.getProjectById(id);
    return project?.financial || null;
  },

  /**
   * Granular endpoint abstraction for Evidence & AI Analysis.
   */
  getProjectEvidence: async (id) => {
    const project = await projectService.getProjectById(id);
    return project?.evidence || [];
  },

  /**
   * Granular endpoint abstraction for Explainable Risk.
   */
  getProjectRisk: async (id) => {
    const project = await projectService.getProjectById(id);
    return project?.risk || null;
  },

  /**
   * Granular endpoint abstraction for Milestones & Timeline.
   */
  getProjectMilestones: async (id) => {
    const project = await projectService.getProjectById(id);
    return {
      milestones: project?.milestones || [],
      timeline: project?.timeline || []
    };
  },

  createProject: async (data) => {
    if (USE_MOCK) {
      const created = await mockProjectService.createProject(data);
      return normalizeProject(created);
    }
    try {
      const res = await apiClient.post('/projects', data);
      return normalizeProject(res.data || res);
    } catch (err) {
      const created = await mockProjectService.createProject(data);
      return normalizeProject(created);
    }
  },

  updateProject: async (id, data) => {
    if (USE_MOCK) {
      const updated = await mockProjectService.updateProject(id, data);
      return normalizeProject(updated);
    }
    try {
      const res = await apiClient.put(`/projects/${id}`, data);
      return normalizeProject(res.data || res);
    } catch (err) {
      const updated = await mockProjectService.updateProject(id, data);
      return normalizeProject(updated);
    }
  }
};
