export const ROUTES = {
  HOME: '/',
  OVERVIEW: '/admin/overview',
  PROJECTS: '/admin/projects',
  PROJECT_DETAILS: '/admin/projects/:projectId',
  MP_DETAILS: '/admin/mp/:mpId',
  AI_RISK: '/admin/ai-risk',
  AI_RISK_DETAILS: '/admin/ai-risk/:projectId',
  ANALYTICS: '/admin/analytics',
  SETTINGS: '/admin/settings',
};

export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', path: ROUTES.OVERVIEW, iconName: 'Home' },
  { id: 'projects', label: 'Projects', path: ROUTES.PROJECTS, iconName: 'FolderKanban' },
  { id: 'ai-risk', label: 'AI Risk Monitor', path: ROUTES.AI_RISK, iconName: 'ShieldCheck' },
  { id: 'analytics', label: 'Analytics & Trends', path: ROUTES.ANALYTICS, iconName: 'BarChart3' },
  { id: 'settings', label: 'Settings', path: ROUTES.SETTINGS, iconName: 'Settings' },
];
