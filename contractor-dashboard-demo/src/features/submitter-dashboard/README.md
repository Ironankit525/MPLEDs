# Submitter dashboard UI

This feature contains the submitter-facing experience:

- `SubmitterDashboardPage.jsx` — `/contractor/submissions`
- `SubmitterUploadPage.jsx` — `/contractor/upload`
- `SubmitterSettingsPage.jsx` — `/contractor/settings`

The dashboard includes KPI cards, an action centre, finance and project panels, a searchable works table,
an activity feed, and audit-report export.

## Integrating it elsewhere

1. Copy this folder into the target frontend's `src/features` directory.
2. Use Tailwind CSS in the target app and install the peer UI dependencies: `react`, `react-router-dom`, `lucide-react`, and `jspdf`.
3. Provide equivalents for `useMySubmissions` and `request`, or adapt the two imports at the top of `SubmitterDashboardPage.jsx` to the target app's data layer.
4. Add routes that render `SubmitterDashboardPage`, `SubmitterUploadPage`, and `SubmitterSettingsPage`.

The component expects these existing API responses:

- `GET /api/dashboard/summary`
- `GET /api/projects/mine`
- the submission list returned by `useMySubmissions`

Keep data fetching at the feature boundary; the dashboard derives its cards and table rows from those responses rather than storing sample data in the UI.
