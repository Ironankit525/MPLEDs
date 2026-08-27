// Where each role lands after login / at "/", and what its sidebar
// shows. A role with no entry here has no dashboard built yet and goes
// to the UnsupportedRolePage placeholder — that's Stakeholder and Admin
// today. Shared between App.jsx's index redirect and RouteGuards' role
// gate so a Reviewer hitting a Submitter-only URL (or vice versa) lands
// on THEIR OWN dashboard, not a dead end.
export const ROLE_LANDING_PATH = {
  submitter: '/app/upload',
  reviewer: '/app/queue',
  stakeholder: '/app/dashboard',
  admin: '/app/admin/submissions',
}

export function roleLandingPath(role) {
  return ROLE_LANDING_PATH[role] || '/app/unsupported-role'
}
