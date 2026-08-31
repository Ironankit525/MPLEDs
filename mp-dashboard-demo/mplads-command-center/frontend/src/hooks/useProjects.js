import { useState, useEffect, useCallback } from 'react';
import { projectService } from '../features/projects/projectService.js';
import { useAuth } from './useAuth.js';
import { useUser } from './useUser.js';
import { handleServiceError } from '../utils/errorHandler.js';

export const useProjects = (filters = {}) => {
  const { currentMP } = useAuth();
  const { financialYear } = useUser();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProjects = useCallback(async () => {
    if (!currentMP?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await projectService.getProjects(currentMP.id, {
        financialYear,
        ...filters
      });
      setProjects(data);
    } catch (err) {
      setError(handleServiceError(err, 'Failed to load projects list'));
    } finally {
      setLoading(false);
    }
  }, [currentMP?.id, financialYear, JSON.stringify(filters)]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (newProjectData) => {
    setLoading(true);
    try {
      const created = await projectService.createProject({
        mpId: currentMP.id,
        financialYear,
        ...newProjectData
      });
      await fetchProjects();
      return created;
    } catch (err) {
      throw new Error(handleServiceError(err, 'Failed to create project'));
    } finally {
      setLoading(false);
    }
  };

  return {
    projects,
    loading,
    error,
    refresh: fetchProjects,
    createProject
  };
};
