import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../api/client'
import ErrorBanner from '../components/ErrorBanner'

export default function RegisterPage() {
  const { register, login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', agencyName: '', district: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await register(form)
      // Registration doesn't return a token — log in immediately so the
      // new field officer lands straight on the upload page, not back
      // at the login form they just filled in.
      await login({ username: form.username, password: form.password })
      navigate('/contractor/upload', { replace: true })
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
        <h1>Register Your Agency</h1>
        <p className="subtitle">
          Public registration creates a Submitter account for uploading evidence. Reviewer and
          admin accounts are set up separately.
        </p>

        {error && <ErrorBanner message={error} />}

        <form className="stack" style={{ gap: 16, marginTop: 16 }} onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="agencyName">
              Agency name
            </label>
            <input
              id="agencyName"
              className="input"
              value={form.agencyName}
              onChange={update('agencyName')}
              placeholder="e.g. PWD Pune"
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="district">
              District
            </label>
            <input
              id="district"
              className="input"
              value={form.district}
              onChange={update('district')}
              placeholder="e.g. Pune"
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="reg-username">
              Username
            </label>
            <input
              id="reg-username"
              className="input"
              value={form.username}
              onChange={update('username')}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="reg-password">
              Password
            </label>
            <input
              id="reg-password"
              type="password"
              className="input"
              value={form.password}
              onChange={update('password')}
              autoComplete="new-password"
              required
              minLength={4}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
