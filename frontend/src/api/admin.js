import { request } from './client'

// User management — the self-service replacement for
// scripts/create_user.py, which stays as the way to bootstrap the
// very first Admin account before any admin UI exists to log in to.
export function createUser(payload) {
  return request('/api/admin/users', {
    method: 'POST',
    json: {
      username: payload.username,
      password: payload.password,
      role: payload.role,
      agency_name: payload.agencyName || undefined,
      district: payload.district || undefined,
    },
  })
}

export function listUsers() {
  return request('/api/admin/users')
}

export function updateUserRole(userId, role) {
  return request(`/api/admin/users/${userId}/role`, { method: 'PATCH', json: { role } })
}

export function updateUserActive(userId, isActive) {
  return request(`/api/admin/users/${userId}/active`, { method: 'PATCH', json: { is_active: isActive } })
}

// Every submission, unfiltered — app/main.py's admin_list_submissions.
export function getAdminSubmissions() {
  return request('/api/admin/submissions')
}

export function overrideStatus(imageId, statusValue, notes) {
  return request(`/api/admin/submissions/${imageId}/override-status`, {
    method: 'POST',
    json: { status: statusValue, notes: notes || undefined },
  })
}

export function bulkOverrideStatus(imageIds, statusValue, notes) {
  return request('/api/admin/submissions/bulk-override-status', {
    method: 'POST',
    json: { image_ids: imageIds, status: statusValue, notes: notes || undefined },
  })
}

export function getActivity() {
  return request('/api/admin/activity')
}

// LLM-drafted operations note (accounts by role, submissions by status,
// last-7-days workflow events, override counts). `available: false` is a
// normal response (feature unconfigured or the generation call failed) —
// the activity page renders without the card in that case, never an error.
export function getAdminAiSummary() {
  return request('/api/admin/ai-summary')
}
