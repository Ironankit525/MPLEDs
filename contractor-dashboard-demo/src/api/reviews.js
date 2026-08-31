import { request } from './client.js'

// Submissions awaiting a decision (PENDING_REVIEW or IN_REVIEW),
// highest automated risk first — the Reviewer dashboard's worklist.
export function getReviewQueue() {
  return request('/api/reviews/queue')
}

// Submissions with a final decision (APPROVED or REJECTED).
export function getReviewHistory() {
  return request('/api/reviews/history')
}

// PENDING_REVIEW -> IN_REVIEW under the calling reviewer. Also the way
// the workspace page loads a single record (there's no GET-by-id
// endpoint) — calling it again for an item you already have claimed is
// harmless (app/main.py's claim_review treats re-claiming your own
// IN_REVIEW item as a no-op, not a conflict).
export function claimReview(id) {
  return request(`/api/reviews/${id}/claim`, { method: 'POST' })
}

// decision: 'approve' | 'reject'. notes are required by the backend
// when rejecting (app/schemas.py's ReviewDecisionRequest).
export function decideReview(id, decision, notes) {
  return request(`/api/reviews/${id}/decide`, {
    method: 'POST',
    json: { decision, notes: notes || undefined },
  })
}
