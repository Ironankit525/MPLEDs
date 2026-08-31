import { request } from './client'

// Total volume, pipeline bottlenecks (by-status/by-risk breakdown),
// completion rate, and average time-to-decision — the dashboard's
// summary numbers and charts.
export function getStakeholderOverview() {
  return request('/api/stakeholder/overview')
}

// Submissions that reached a Reviewer decision (APPROVED, REJECTED, or
// SIGNED_OFF) — the Stakeholder's report table. PENDING_REVIEW/IN_REVIEW
// items live in the Reviewer's queue, not here.
export function getStakeholderSubmissions() {
  return request('/api/stakeholder/submissions')
}

// Final sign-off on a reviewer-approved submission — only valid from
// status APPROVED (app/main.py's sign_off_submission).
export function signOffSubmission(id, notes) {
  return request(`/api/stakeholder/${id}/sign-off`, {
    method: 'POST',
    json: { notes: notes || undefined },
  })
}
