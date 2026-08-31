import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../api/client'
import { roleLandingPath } from '../lib/roles'
import ErrorBanner from '../components/ErrorBanner'
import Icon from '../components/Icon'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      // Route by the role the login response actually returned, not
      // AuthContext's `user` — that's updated asynchronously inside
      // login() and isn't guaranteed to be re-rendered into this
      // closure yet. A hardcoded '/contractor/upload' fallback here used to
      // "work" for every non-Submitter role purely by accident: they'd
      // land there, fail RequireRole's check, and get bounced onward —
      // which breaks the moment a route (like Upload) legitimately
      // allows more than one role, since then there's nothing left to
      // bounce them.
      const data = await login({ username, password })
      const from = location.state?.from
      navigate(from && from !== '/login' ? from : roleLandingPath(data.role), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="card card-padded auth-card">
        <div className="brand">
          <span className="brand-mark">MP</span>
          MPLADS Verify
        </div>
        <h1>Field Agency Sign In</h1>
        <p className="subtitle">Submit and track work-completion photo evidence.</p>

        {error && <ErrorBanner message={error} />}

        <form className="stack" style={{ gap: 16, marginTop: 16 }} onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
            {!submitting && <Icon name="chevron-left" size={16} style={{ transform: 'rotate(180deg)' }} />}
          </button>
        </form>

        <p className="auth-switch">
          New field agency? <Link to="/register">Register an account</Link>
        </p>
      </div>
    </div>
  )
}
