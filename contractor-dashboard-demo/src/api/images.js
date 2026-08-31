import { request } from './client.js'

// Mints a single-use camera-session token immediately before upload —
// the anti-fraud gate this whole module exists for (see README's "Auth
// + camera-session anti-fraud gate"). Best-effort: if this fails, the
// submit can still proceed without a session_token — /api/images/submit
// treats it as optional.
export function createCameraSession() {
  return request('/api/sessions/create', { method: 'POST' })
}

/**
 * @param {File} file
 * @param {object} fields - work_id, district, work_type, state, mp_name,
 *   sanction_date, claimed_amount, captured_latitude, captured_longitude,
 *   geolocation_accuracy, capture_timestamp, facing_mode — matches the
 *   form fields /api/images/submit accepts (app/main.py).
 * @param {string} [sessionToken]
 */
export function submitImage(file, fields, sessionToken) {
  const form = new FormData()
  form.append('file', file)
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      form.append(key, value)
    }
  })
  if (sessionToken) form.append('session_token', sessionToken)
  return request('/api/images/submit', { method: 'POST', form })
}

// Own-files-only upload history (/api/images/mine) — this is what the
// Submitter dashboard's "My Submissions" list and detail view read.
export function getMySubmissions() {
  return request('/api/images/mine')
}
