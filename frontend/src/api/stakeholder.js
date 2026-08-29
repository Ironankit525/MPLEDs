import { request } from './client'

// Total volume, pipeline bottlenecks (by-status/by-risk breakdown),
// completion rate, and average time-to-decision — the dashboard's
// summary numbers and charts.
export function getStakeholderOverview() {
  return request('/api/stakeholder/overview')
}

// Two paragraphs of plain-prose narrative drafted by an LLM from the
// same figures the overview returns. `available: false` is a normal
// response (feature unconfigured, or the generation call failed) — the
// dashboard renders numbers-only in that case, never an error.
export function getAiSummary(refresh = false) {
  return request(`/api/stakeholder/ai-summary${refresh ? '?refresh=true' : ''}`)
}

// One grounded answer from the AI report assistant. `history` is the
// visible conversation so far ([{role, text}]) so follow-up questions
// resolve; the backend replays it to the model. Same availability
// contract as the summaries: `available: false` is a normal response.
export function askAiReport(question, history = []) {
  return request('/api/stakeholder/ai-report', {
    method: 'POST',
    json: { question, history },
  })
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
