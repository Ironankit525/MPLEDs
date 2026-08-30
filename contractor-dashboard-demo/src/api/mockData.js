const user = {
  username: 'pradhanprachi442@gmail.com',
  role: 'submitter',
  agency_name: 'XYZ Contractors',
  district: 'Pune',
}

const projects = [
  { work_id: 'MP-PUN-2026-0142', district: 'Pune', status: 'IN_PROGRESS', progress_percent: 72, expected_completion_date: '2026-10-15T00:00:00.000Z', financials: { sanctioned_amount: 2500000, amount_utilised: 1800000 } },
  { work_id: 'MP-PUN-2026-0187', district: 'Pune', status: 'IN_PROGRESS', progress_percent: 48, expected_completion_date: '2026-11-30T00:00:00.000Z', financials: { sanctioned_amount: 1800000, amount_utilised: 860000 } },
  { work_id: 'MP-PUN-2026-0098', district: 'Pune', status: 'COMPLETED', progress_percent: 100, expected_completion_date: '2026-07-20T00:00:00.000Z', financials: { sanctioned_amount: 1200000, amount_utilised: 1200000 } },
]

const submissions = [
  { id: 'submission-001', work_id: 'MP-PUN-2026-0142', district: 'Pune', work_type: 'road construction', status: 'PENDING_REVIEW', risk_level: 'LOW', risk_score: 14, uploaded_at: '2026-08-29T09:30:00.000Z', mp_name: 'Demo MP', sanction_date: '2026-02-12T00:00:00.000Z', recommendation: 'Evidence is consistent and awaiting officer review.', flags: [] },
  { id: 'submission-002', work_id: 'MP-PUN-2026-0187', district: 'Pune', work_type: 'water facility', status: 'IN_REVIEW', risk_level: 'MEDIUM', risk_score: 42, uploaded_at: '2026-08-27T11:15:00.000Z', mp_name: 'Demo MP', sanction_date: '2026-03-03T00:00:00.000Z', recommendation: 'Officer review is in progress.', flags: [{ code: 'IMAGE_QUALITY', human_message: 'Please ensure the next photo clearly shows the completed work.' }] },
  { id: 'submission-003', work_id: 'MP-PUN-2026-0098', district: 'Pune', work_type: 'community hall', status: 'REJECTED', risk_level: 'HIGH', risk_score: 78, uploaded_at: '2026-08-20T08:00:00.000Z', reviewed_at: '2026-08-22T10:00:00.000Z', mp_name: 'Demo MP', sanction_date: '2026-01-18T00:00:00.000Z', reviewer_notes: 'Upload a new wide-angle photo that includes the entrance and project signboard.', recommendation: 'A clearer replacement photo is required before verification can continue.', flags: [{ code: 'INSUFFICIENT_EVIDENCE', human_message: 'The project signboard is not visible in this photo.' }] },
  { id: 'submission-004', work_id: 'MP-PUN-2026-0098', district: 'Pune', work_type: 'community hall', status: 'SIGNED_OFF', risk_level: 'LOW', risk_score: 9, uploaded_at: '2026-07-17T09:45:00.000Z', reviewed_at: '2026-07-19T13:30:00.000Z', mp_name: 'Demo MP', sanction_date: '2026-01-18T00:00:00.000Z', recommendation: 'Verified and signed off.', flags: [] },
]

function summary() {
  const byStatus = submissions.reduce((counts, item) => ({ ...counts, [item.status]: (counts[item.status] || 0) + 1 }), { PENDING_REVIEW: 0, IN_REVIEW: 0, APPROVED: 0, REJECTED: 0, SIGNED_OFF: 0 })
  const sanctioned = projects.reduce((sum, item) => sum + item.financials.sanctioned_amount, 0)
  const utilised = projects.reduce((sum, item) => sum + item.financials.amount_utilised, 0)
  const actions = submissions.filter((item) => item.status === 'REJECTED')
  const decided = byStatus.APPROVED + byStatus.REJECTED + byStatus.SIGNED_OFF
  return {
    financials: { sanctioned_amount: sanctioned, amount_utilised: utilised, amount_remaining: sanctioned - utilised, utilisation_percent: Math.round((utilised / sanctioned) * 100), amount_pending_disbursement: 0, amount_awaiting_decision: 0 },
    projects_assigned: projects.length, projects_completed: 1, projects_in_progress: 2, projects_not_started: 0, projects_overdue: 0, overall_progress_percent: 73,
    total_submissions: submissions.length, submissions_by_status: byStatus, flagged_submissions: submissions.filter((item) => ['MEDIUM', 'HIGH'].includes(item.risk_level)).length,
    action_required_count: actions.length, action_required: actions.map((item) => ({ image_id: item.id, work_id: item.work_id, reason: item.reviewer_notes })),
    approval_rate: decided ? Math.round(((byStatus.APPROVED + byStatus.SIGNED_OFF) / decided) * 100) : 0,
    average_risk_score: Math.round(submissions.reduce((sum, item) => sum + item.risk_score, 0) / submissions.length),
  }
}

export function mockRequest(path, options = {}) {
  if (path === '/api/auth/me') return user
  if (path === '/api/auth/login') return { access_token: 'demo-token', token_type: 'bearer' }
  if (path === '/api/auth/register') return user
  if (path === '/api/sessions/create') return { token: 'demo-camera-session' }
  if (path === '/api/images/mine') return { images: submissions }
  if (path === '/api/dashboard/summary') return summary()
  if (path === '/api/projects/mine') return { projects }
  if (path === '/api/images/submit') {
    const form = options.form
    const record = { id: `submission-${String(submissions.length + 1).padStart(3, '0')}`, work_id: form.get('work_id') || 'MP-PUN-2026-DEMO', district: form.get('district') || user.district, work_type: form.get('work_type') || 'document', status: 'PENDING_REVIEW', risk_level: 'LOW', risk_score: 12, uploaded_at: new Date().toISOString(), mp_name: form.get('mp_name') || '', sanction_date: form.get('sanction_date') || '', recommendation: 'Demo evidence accepted and queued for verification.', flags: [] }
    submissions.unshift(record)
    return { risk_level: record.risk_level, risk_score: record.risk_score, recommendation: record.recommendation, flags: record.flags }
  }
  throw new Error(`No mock response configured for ${options.method || 'GET'} ${path}`)
}
