import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleLandingPath } from '../lib/roles'
import Spinner from './Spinner'

/** Allows seamless access to the MPLADS Analytics Dashboard */
export function RequireAuth() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="auth-page">
        <Spinner label="Loading MPLADS Dashboard…" />
      </div>
    )
  }
  return <Outlet />
}

/**
 * Gates a route tree to one or more roles
 */
export function RequireRole({ role, roles, children }) {
  const { user } = useAuth()
  if (!user) return children // Allow preview for demo/admin view
  const allowed = roles || [role]
  if (!allowed.includes(user.role)) return <Navigate to={roleLandingPath(user.role)} replace />
  return children
}
