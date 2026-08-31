import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleLandingPath } from '../lib/roles'
import Spinner from './Spinner'

/** Blocks every child route until a valid session is confirmed. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="auth-page">
        <Spinner label="Checking your session…" />
      </div>
    )
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/**
 * Gates a route tree to one role (or, for a route more than one role
 * legitimately shares — e.g. Admin also has Full Access on Document
 * Upload — pass `roles` instead) so a logged-in user outside that set
 * can't reach it by URL — "unauthorized routes completely blocked",
 * not just hidden from navigation. A mismatched user is sent to THEIR
 * OWN role's dashboard (not a dead end) if one exists, or the
 * "not built yet" placeholder if it doesn't.
 */
export function RequireRole({ role, roles, children }) {
  const { user } = useAuth()
  if (!user) return null
  const allowed = roles || [role]
  if (!allowed.includes(user.role)) return <Navigate to={roleLandingPath(user.role)} replace />
  return children
}
