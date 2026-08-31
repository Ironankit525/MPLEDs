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
import StakeholderReportsPage from './pages/StakeholderReportsPage'
import StakeholderDetailPage from './pages/StakeholderDetailPage'
import AdminSubmissionsPage from './pages/AdminSubmissionsPage'
import AdminSubmissionDetailPage from './pages/AdminSubmissionDetailPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminActivityPage from './pages/AdminActivityPage'
import SettingsPage from './pages/SettingsPage'
import UnsupportedRolePage from './pages/UnsupportedRolePage'
import NotFoundPage from './pages/NotFoundPage'

/** Sends a visitor to the right place for their session: the login
 * page if signed out, or their role's landing page (lib/roles.js) if
 * signed in. A role with no dashboard built yet lands on the
 * "not built" placeholder, same as RequireRole would send them. */
function IndexRedirect() {
  const { status, user } = useAuth()
  if (status === 'loading') {
    return (
      <div className="auth-page">
        <Spinner label="Loading…" />
      </div>
    )
  }
  if (status === 'anonymous') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    window.location.href = isLocal ? 'http://localhost:3000/' : 'https://inspiring-lebkuchen-67d55f.netlify.app/';
    return null;
  }
  return <Navigate to={roleLandingPath(user?.role)} replace />
}

/** The index route under /app — same idea as IndexRedirect, but only
 * reached once auth + role are known, so it can assume `user` exists. */
function AppIndexRedirect() {
  const { user } = useAuth()
  return <Navigate to={roleLandingPath(user?.role)} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<IndexRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/contractor/unsupported-role" element={<UnsupportedRolePage />} />

        <Route path="/contractor" element={<AppShell />}>
          <Route index element={<AppIndexRedirect />} />

          {/* Submitter (Admin also has Full Access on Document Upload) */}
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

          {/* Shared across every role that has a dashboard at all */}
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
