import { request } from './client.js'

// Public self-registration — the backend hardcodes every account created
// this way to role "submitter" (app/main.py's register()). There is no
// UI path to create a Reviewer/Stakeholder/Admin account yet; those get
// provisioned once the Admin role's slice exists.
export function register({ username, password, agencyName, district }) {
  return request('/api/auth/register', {
    method: 'POST',
    auth: false,
    json: { username, password, agency_name: agencyName, district },
  })
}

// /api/auth/login expects OAuth2PasswordRequestForm — form-encoded, not
// JSON — so this can't reuse the `json` shortcut on request().
export function login({ username, password }) {
  const form = new URLSearchParams()
  form.set('username', username)
  form.set('password', password)
  return request('/api/auth/login', { method: 'POST', auth: false, urlEncoded: form })
}

export function getProfile() {
  return request('/api/auth/me')
}
