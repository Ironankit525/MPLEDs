import { MOCK_CONTRACTORS } from '../mock/contractors';
import { MOCK_PROJECTS } from '../mock/projects';

export const mockContractorService = {
  getContractors: async (mpId = null) => {
    await new Promise(resolve => setTimeout(resolve, 200));

    return MOCK_CONTRACTORS.map(contractor => {
      const allProjects = MOCK_PROJECTS.filter(p => p.contractorId === contractor.id);
      const mpProjects = mpId ? allProjects.filter(p => p.mpId === mpId) : allProjects;

      const totalSanctioned = mpProjects.reduce((sum, p) => sum + (p.sanctionedAmount || 0), 0);
      const totalUtilized = mpProjects.reduce((sum, p) => sum + (p.utilizedAmount || 0), 0);
      const activeCount = mpProjects.filter(p => p.status === 'ONGOING').length;
      const completedCount = mpProjects.filter(p => p.status === 'COMPLETED').length;
      const avgProgress = mpProjects.length > 0
        ? Math.round(mpProjects.reduce((sum, p) => sum + (p.completionPercentage || 0), 0) / mpProjects.length)
        : 0;

      const globalSanctioned = allProjects.reduce((sum, p) => sum + (p.sanctionedAmount || 0), 0);
      const globalUtilized = allProjects.reduce((sum, p) => sum + (p.utilizedAmount || 0), 0);
      const globalActive = allProjects.filter(p => p.status === 'ONGOING').length;
      const globalCompleted = allProjects.filter(p => p.status === 'COMPLETED').length;
      const globalAvgProgress = allProjects.length > 0
        ? Math.round(allProjects.reduce((sum, p) => sum + (p.completionPercentage || 0), 0) / allProjects.length)
        : 0;

      return {
        ...contractor,
        mpProjectsCount: mpProjects.length,
        mpActiveCount: activeCount,
        mpCompletedCount: completedCount,
        mpTotalSanctioned: totalSanctioned,
        mpTotalUtilized: totalUtilized,
        mpUtilizationRate: totalSanctioned > 0 ? Math.round((totalUtilized / totalSanctioned) * 100) : 0,
        mpAvgProgress: avgProgress,
        assignedProjects: mpProjects,

        // Global metrics across all MPs
        globalProjectsCount: allProjects.length,
        globalActiveCount: globalActive,
        globalCompletedCount: globalCompleted,
        globalTotalSanctioned: globalSanctioned,
        globalTotalUtilized: globalUtilized,
        globalUtilizationRate: globalSanctioned > 0 ? Math.round((globalUtilized / globalSanctioned) * 100) : 0,
        globalAvgProgress: globalAvgProgress,
        allProjects: allProjects
      };
    });
  },

  getContractorById: async (id, mpId = null) => {
    await new Promise(resolve => setTimeout(resolve, 150));
    const contractors = await mockContractorService.getContractors(mpId);
    const contractor = contractors.find(c => c.id === id);
    if (!contractor) throw new Error(`Contractor with ID ${id} not found.`);
    return contractor;
  }
};
