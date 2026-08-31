const user = {
  username: 'pradhanprachi442@gmail.com',
  role: 'submitter',
  agency_name: 'XYZ Contractors',
  district: 'Pune',
}

const projects = [
  { work_id: 'MP-PUN-2024-0123', district: 'Pune', state: 'Maharashtra', mp_name: 'Girish Bapat', work_type: 'bridge', sanction_date: '2024-01-15', status: 'IN_PROGRESS', progress_percent: 72, expected_completion_date: '2026-10-15T00:00:00.000Z', financials: { sanctioned_amount: 2500000, amount_utilised: 1800000 } },
  { work_id: 'MP-PUN-2024-0231', district: 'Pune', state: 'Maharashtra', mp_name: 'Girish Bapat', work_type: 'road construction', sanction_date: '2024-03-22', status: 'IN_PROGRESS', progress_percent: 48, expected_completion_date: '2026-11-30T00:00:00.000Z', financials: { sanctioned_amount: 1800000, amount_utilised: 860000 } },
  { work_id: 'MP-PUN-2024-0098', district: 'Pune', state: 'Maharashtra', mp_name: 'Girish Bapat', work_type: 'school building', sanction_date: '2023-11-05', status: 'COMPLETED', progress_percent: 100, expected_completion_date: '2024-07-20T00:00:00.000Z', financials: { sanctioned_amount: 1200000, amount_utilised: 1200000 } },
]

const submissions = []

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
    const record = { 
      id: `submission-${String(submissions.length + 1).padStart(3, '0')}`, 
      work_id: form.get('work_id') || 'MP-PUN-2026-DEMO', 
      district: form.get('district') || user.district, 
      work_type: form.get('work_type') || 'document', 
      status: 'PENDING_REVIEW', 
      risk_level: 'MEDIUM', 
      risk_score: 45, 
      uploaded_at: new Date().toISOString(), 
      mp_name: form.get('mp_name') || '', 
      sanction_date: form.get('sanction_date') || '', 
      recommendation: 'Manual verification required — automated checks raised one or more findings.', 
      flags: [
        { code: 'EXIF_STRIPPED', severity: 'MEDIUM', human_message: 'Original camera metadata is missing, so capture date and device provenance cannot be confirmed.', points_added: 15 },
        { code: 'GPS_DISTRICT_MISMATCH', severity: 'HIGH', human_message: 'The captured location is outside the claimed project district. Captured approximately 609.6 km from the claimed district centre.', points_added: 30 }
      ],
      capture_date: null,
      work_evidence_status: 'VALID',
      work_evidence_probability: 0.625,
      screen_probability: 0.0,
      screen_model_name: 'google/siglip-base-patch16-224',
      file_path: form.get('file') ? URL.createObjectURL(form.get('file')) : null
    }
    submissions.unshift(record)
    return { 
      risk_level: record.risk_level, 
      risk_score: record.risk_score, 
      recommendation: record.recommendation, 
      flags: record.flags,
      capture_date: record.capture_date,
      work_evidence_status: record.work_evidence_status,
      work_evidence_probability: record.work_evidence_probability,
      screen_probability: record.screen_probability,
      screen_model_name: record.screen_model_name,
      file_path: record.file_path
    }
  }
  throw new Error(`No mock response configured for ${options.method || 'GET'} ${path}`)
}
