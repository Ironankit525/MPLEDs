// Thin fetch wrapper shared by every api/*.js module. Handles the base
// URL, bearer-token attachment, and turning a non-2xx response into a
// typed error the UI can read a human message off of — the backend
// (app/main.py) always returns { detail: "..." } on error, per
// app/schemas.py's ErrorResponse.

// Production uses the same Vercel origin for both services, so /api requests
// stay relative and automatically work on previews and custom domains. Local
// development may still opt into a separate FastAPI origin via frontend/.env.
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const TOKEN_STORAGE_KEY = 'mplads_token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    // localStorage can throw in a locked-down browser context (private
    // mode + blocked storage). Treat as "no token" rather than crash.
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
    else localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // Same as above — storage being unavailable shouldn't crash login.
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * @param {string} path - e.g. '/api/images/mine'
 * @param {object} opts
 * @param {'GET'|'POST'|'PATCH'|'DELETE'} [opts.method]
 * @param {object} [opts.json] - sent as an application/json body
 * @param {FormData} [opts.form] - sent as multipart/form-data
 * @param {URLSearchParams} [opts.urlEncoded] - sent as application/x-www-form-urlencoded
 * @param {boolean} [opts.auth] - attach the bearer token (default true)
 */
export async function request(path, opts = {}) {
  const { method = 'GET', json, form, urlEncoded, auth = true } = opts
  const headers = {}
  let body

  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form !== undefined) {
    // Do NOT set Content-Type — the browser fills in the multipart
    // boundary itself. Setting it manually breaks the upload.
    body = form
  } else if (urlEncoded !== undefined) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = urlEncoded
  }

  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body })
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0)
  }

  if (!res.ok) {
    let message = res.statusText || 'Request failed'
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') message = data.detail
    } catch {
      // Non-JSON error body — fall back to statusText above.
    }
    throw new ApiError(message, res.status)
  }

  if (res.status === 204) return null
  return res.json()
}

export { API_BASE_URL }
