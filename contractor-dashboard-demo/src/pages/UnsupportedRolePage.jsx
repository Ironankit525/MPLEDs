import { useAuth } from '../context/AuthContext'
import EmptyState from '../components/EmptyState'

/**
 * Where a logged-in Reviewer/Stakeholder/Admin lands today. Only the
 * Submitter dashboard exists (this build's scope) — showing them the
 * Submitter UI mislabeled as theirs would be worse than an honest
 * "not built yet" placeholder, and RequireRole blocks the submitter
 * routes outright rather than leaking any of that UI to them.
 */
export default function UnsupportedRolePage() {
  const { user, logout } = useAuth()

  return (
    <div className="auth-page">
      <div className="card card-padded auth-card" style={{ maxWidth: 460 }}>
        <EmptyState
          icon="shield"
          title={`No dashboard yet for "${user?.role}"`}
          description="Only the Submitter dashboard has been built so far. Your account and role are saved — check back once this role's UI ships."
        />
        <button type="button" className="btn btn-secondary btn-block" onClick={logout} style={{ marginTop: 8 }}>
          Log out
        </button>
      </div>
    </div>
  )
}
