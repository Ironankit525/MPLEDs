import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext.jsx';
import { DashboardLayout } from './components/layout/DashboardLayout.jsx';
import { ROUTES } from './constants/routes.js';

// Page Placeholders
import OverviewPage from './pages/Overview/OverviewPage.jsx';
import ProjectsPage from './pages/Projects/ProjectsPage.jsx';
import ProjectDetailsPage from './pages/Projects/ProjectDetailsPage.jsx';
import MPDetailsPage from './pages/Projects/MPDetailsPage.jsx';
import AIRiskPage from './pages/AIRisk/AIRiskPage.jsx';
import AIRiskDetailsPage from './pages/AIRisk/AIRiskDetailsPage.jsx';
import AnalyticsPage from './pages/Analytics/AnalyticsPage.jsx';
import SettingsPage from './pages/Settings/SettingsPage.jsx';

import { AuthGuard } from './components/AuthGuard.jsx';
import { useApp } from './context/AppContext.jsx';

function RootRedirect() {
  const { dashboardPreferences } = useApp();
  let target = dashboardPreferences?.landingPage || ROUTES.OVERVIEW;
  if (target && !target.startsWith('/admin')) {
    target = ROUTES.OVERVIEW;
  }
  return <Navigate to={target} replace />;
}

export function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route element={<AuthGuard allowedRoles={['admin']} />}>
            <Route path="/admin" element={<DashboardLayout />}>
              <Route index element={<RootRedirect />} />
              <Route path="overview" element={<OverviewPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:projectId" element={<ProjectDetailsPage />} />
              <Route path="mp/:mpId" element={<MPDetailsPage />} />
              <Route path="ai-risk" element={<AIRiskPage />} />
              <Route path="ai-risk/:projectId" element={<AIRiskDetailsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to={ROUTES.OVERVIEW} replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
