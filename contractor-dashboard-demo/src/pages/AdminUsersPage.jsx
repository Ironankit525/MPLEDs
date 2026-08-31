import { useState } from 'react'
import { useUsers } from '../hooks/useUsers'
import { useAuth } from '../context/AuthContext'
import { createUser, updateUserActive, updateUserRole } from '../api/admin'
import { ApiError } from '../api/client'
import ErrorBanner from '../components/ErrorBanner'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import { formatDate } from '../lib/format'

const ROLES = ['submitter', 'reviewer', 'stakeholder', 'admin']

function emptyForm() {
  return { username: '', password: '', role: 'reviewer', agencyName: '', district: '' }
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const { users, loading, error, reload } = useUsers()
  const [form, setForm] = useState(emptyForm())
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [rowError, setRowError] = useState(null)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreateError(null)
    setCreating(true)
    try {
      await createUser(form)
      setForm(emptyForm())
      await reload()
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Could not create the user.')
    } finally {
      setCreating(false)
    }
  }

  const handleRoleChange = async (userId, role) => {
    setRowError(null)
    try {
      await updateUserRole(userId, role)
      await reload()
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : 'Could not update role.')
    }
  }

  const handleToggleActive = async (u) => {
    setRowError(null)
    try {
      await updateUserActive(u.id, !u.is_active)
      await reload()
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : 'Could not update status.')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p>Create accounts for any role, change roles, and deactivate access.</p>
        </div>
      </div>

      <div className="card card-padded stack" style={{ gap: 16, marginBottom: 24 }}>
        <h3>Create user</h3>
        {createError && <ErrorBanner message={createError} />}
        <form onSubmit={handleCreate} className="stack" style={{ gap: 16 }}>
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="new-username">
                Username
              </label>
              <input id="new-username" className="input" value={form.username} onChange={update('username')} required />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="new-password">
                Password
              </label>
              <input
                id="new-password"
                type="password"
                className="input"
                value={form.password}
                onChange={update('password')}
                required
                minLength={4}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="new-role">
                Role
              </label>
              <select id="new-role" className="input" value={form.role} onChange={update('role')}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="new-agency">
                Agency name
              </label>
              <input id="new-agency" className="input" value={form.agencyName} onChange={update('agencyName')} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="new-district">
                District
              </label>
              <input id="new-district" className="input" value={form.district} onChange={update('district')} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={creating}>
            {creating ? 'Creating…' : 'Create account'}
          </button>
        </form>
      </div>

      {rowError && <ErrorBanner message={rowError} />}
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && !users && <Spinner label="Loading users…" />}

      {users && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Agency</th>
                <th>District</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ cursor: 'default' }}>
                  <td className="cell-work-id">{u.username}</td>
                  <td>
                    <select
                      className="role-select"
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={u.id === currentUser?.id}
                      title={u.id === currentUser?.id ? "You can't change your own role" : undefined}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{u.agency_name || '—'}</td>
                  <td>{u.district || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className={`active-toggle ${u.is_active ? 'is-active' : 'is-inactive'}`}
                      onClick={() => handleToggleActive(u)}
                      disabled={u.id === currentUser?.id}
                      title={u.id === currentUser?.id ? "You can't deactivate your own account" : undefined}
                    >
                      <Icon name={u.is_active ? 'check' : 'x-circle'} size={11} strokeWidth={2.6} style={{ marginRight: 4, verticalAlign: -1 }} />
                      {u.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>{formatDate(u.created_at, { dateStyle: 'medium' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
