import { request } from './client.js'

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
