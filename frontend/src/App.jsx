import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { RequireAuth, RequireRole } from './components/RouteGuards'
import { roleLandingPath } from './lib/roles'
import Spinner from './components/Spinner'
import AppShell from './components/layout/AppShell'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import UploadPage from './pages/UploadPage'
import SubmissionsPage from './pages/SubmissionsPage'
import SubmissionDetailPage from './pages/SubmissionDetailPage'
import ReviewQueuePage from './pages/ReviewQueuePage'
import ReviewHistoryPage from './pages/ReviewHistoryPage'
import ReviewWorkspacePage from './pages/ReviewWorkspacePage'
import StakeholderDashboardPage from './pages/StakeholderDashboardPage'
import StakeholderAiReportPage from './pages/StakeholderAiReportPage'
import StakeholderReportsPage from './pages/StakeholderReportsPage'
import StakeholderDetailPage from './pages/StakeholderDetailPage'
import AdminSubmissionsPage from './pages/AdminSubmissionsPage'
import AdminSubmissionDetailPage from './pages/AdminSubmissionDetailPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminActivityPage from './pages/AdminActivityPage'
import SettingsPage from './pages/SettingsPage'
import UnsupportedRolePage from './pages/UnsupportedRolePage'
import NotFoundPage from './pages/NotFoundPage'
import ProjectDetailsDashboardPage from './pages/ProjectDetailsDashboardPage'

/** Sends a visitor to the right place for their session: the login
 * page if signed out, or their role's landing page (lib/roles.js) if
 * signed in. */
function IndexRedirect() {
  const { status, user } = useAuth()
  if (status === 'loading') {
    return (
      <div className="auth-page">
        <Spinner label="Loading…" />
      </div>
    )
  }
  if (status === 'anonymous') return <Navigate to="/login" replace />
  return <Navigate to="/app/projects/MP-BR-205-412" replace />
}

/** The index route under /app */
function AppIndexRedirect() {
  return <Navigate to="/app/projects/MP-BR-205-412" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<IndexRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/app/unsupported-role" element={<UnsupportedRolePage />} />

        <Route path="/app" element={<AppShell />}>
          <Route index element={<AppIndexRedirect />} />

          {/* Primary MPLADS AI-Powered Project Dashboard Routes */}
          <Route path="overview" element={<ProjectDetailsDashboardPage />} />
          <Route path="projects" element={<ProjectDetailsDashboardPage />} />
          <Route path="projects/:id" element={<ProjectDetailsDashboardPage />} />
          <Route path="financials" element={<ProjectDetailsDashboardPage />} />
          <Route path="ai-risk-monitor" element={<ProjectDetailsDashboardPage />} />
          <Route path="alerts" element={<ProjectDetailsDashboardPage />} />
          <Route path="analytics" element={<ProjectDetailsDashboardPage />} />
          <Route path="map-view" element={<ProjectDetailsDashboardPage />} />
          <Route path="agency-performance" element={<ProjectDetailsDashboardPage />} />
          <Route path="compliance" element={<ProjectDetailsDashboardPage />} />
          <Route path="data-export" element={<ProjectDetailsDashboardPage />} />
          <Route path="help" element={<ProjectDetailsDashboardPage />} />

          {/* Submitter Workflow */}
          <Route
            path="upload"
            element={
              <RequireRole roles={['submitter', 'admin']}>
                <UploadPage />
              </RequireRole>
            }
          />
          <Route
            path="submissions"
            element={
              <RequireRole role="submitter">
                <SubmissionsPage />
              </RequireRole>
            }
          />
          <Route
            path="submissions/:id"
            element={
              <RequireRole role="submitter">
                <SubmissionDetailPage />
              </RequireRole>
            }
          />

          {/* Reviewer */}
          <Route
            path="queue"
            element={
              <RequireRole role="reviewer">
                <ReviewQueuePage />
              </RequireRole>
            }
          />
          <Route
            path="history"
            element={
              <RequireRole role="reviewer">
                <ReviewHistoryPage />
              </RequireRole>
            }
          />
          <Route
            path="review/:id"
            element={
              <RequireRole role="reviewer">
                <ReviewWorkspacePage />
              </RequireRole>
            }
          />

          {/* Stakeholder */}
          <Route
            path="dashboard"
            element={
              <RequireRole role="stakeholder">
                <StakeholderDashboardPage />
              </RequireRole>
            }
          />
          <Route
            path="ai-report"
            element={
              <RequireRole role="stakeholder">
                <StakeholderAiReportPage />
              </RequireRole>
            }
          />
          <Route
            path="reports"
            element={
              <RequireRole role="stakeholder">
                <StakeholderReportsPage />
              </RequireRole>
            }
          />
          <Route
            path="report/:id"
            element={
              <RequireRole role="stakeholder">
                <StakeholderDetailPage />
              </RequireRole>
            }
          />

          {/* Admin */}
          <Route
            path="admin/submissions"
            element={
              <RequireRole role="admin">
                <AdminSubmissionsPage />
              </RequireRole>
            }
          />
          <Route
            path="admin/submissions/:id"
            element={
              <RequireRole role="admin">
                <AdminSubmissionDetailPage />
              </RequireRole>
            }
          />
          <Route
            path="admin/users"
            element={
              <RequireRole role="admin">
                <AdminUsersPage />
              </RequireRole>
            }
          />
          <Route
            path="admin/activity"
            element={
              <RequireRole role="admin">
                <AdminActivityPage />
              </RequireRole>
            }
          />

          {/* Shared Settings */}
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
