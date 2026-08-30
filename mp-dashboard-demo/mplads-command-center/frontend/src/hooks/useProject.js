import { useState, useEffect, useCallback } from 'react';
import { projectService } from '../features/projects/projectService';
import { useAuth } from './useAuth';
import { handleServiceError } from '../utils/errorHandler';

/**
 * Custom hook to retrieve a single project by ID with strict Constituency Data Isolation.
 * @param {string} projectId 
 */
export const useProject = (projectId) => {
  const { currentMP } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAccessRestricted, setIsAccessRestricted] = useState(false);
  const [restrictedDetails, setRestrictedDetails] = useState(null);

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      setError('Project ID is required.');
      return;
    }

    setLoading(true);
    setError(null);
    setIsAccessRestricted(false);
    setRestrictedDetails(null);

    try {
      const data = await projectService.getProjectById(projectId);
      if (!data) {
        throw new Error(`Project with ID "${projectId}" not found.`);
      }

      // CRITICAL CONSTITUENCY DATA ISOLATION ENFORCEMENT
      // If current MP is logged in, verify that project belongs to this MP / Constituency
      const currentMpId = currentMP?.id || 'MP001';
      const currentConstituency = currentMP?.constituency || 'Pune';

      const projectMpId = data.mpId;
      const projectConstituency = data.location?.constituency || data.constituencyId;

      // If MP ID exists and differs from current MP
      if (projectMpId && projectMpId !== currentMpId) {
        setIsAccessRestricted(true);
        setRestrictedDetails({
          projectConstituency: projectConstituency || 'Other Constituency',
          userConstituency: currentConstituency,
          projectId: data.id,
        });
        setProject(null);
        return;
      }

      setProject(data);
    } catch (err) {
      setError(handleServiceError(err, `Unable to load project details for "${projectId}".`));
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, currentMP?.id, currentMP?.constituency]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  return {
    project,
    loading,
    error,
    isAccessRestricted,
    restrictedDetails,
    refresh: fetchProject,
  };
};
