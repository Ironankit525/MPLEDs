# MPLADS Verify — frontend

React + Vite dashboard for the MPLADS image fraud-detection API. One
app, four role-specific experiences, sharing a single auth layer,
router, and design system.

## Running it

The backend must be running first (see the root README):

```bash
# from the project root
ENABLE_CLIP=False uvicorn app.main:app --reload

# then, here
npm install
npm run dev          # http://localhost:5173
```

`VITE_API_URL` (in `.env`, committed, no secrets) points at the
backend — default `http://localhost:8000`. The backend's CORS config
(`app/main.py`) already allows `localhost:5173`.

To log in you need an account. Public registration always creates a
Submitter; other roles are provisioned by an admin or bootstrapped
with `scripts/create_user.py` — see the root README's **Roles**
section.

## What each role sees

| Role | Landing | Pages |
|---|---|---|
| Submitter | `/app/upload` | Upload (drag-drop + work metadata), My Submissions, submission detail with a pipeline timeline and the automated findings |
| Reviewer | `/app/queue` | Kanban queue (Pending / In Review, highest risk first), split-screen review workspace (evidence left, findings + notes + Approve/Reject right), Reviewed history |
| Stakeholder | `/app/dashboard` | Dashboard (stat tiles, daily-volume chart, pipeline + risk breakdowns), searchable/sortable Reports table, consolidated report with audit trail and final sign-off |
| Admin | `/app/admin/submissions` | All Submissions (filter, search, bulk-select + bulk status override), Users (create/role/activate), Activity log, plus Upload |

## How it's put together

```
src/
├── api/          One thin module per endpoint group over a shared
│                 fetch wrapper (client.js) that handles the base URL,
│                 bearer token, and { detail } error unwrapping.
├── context/      AuthContext — owns the token and the profile it
│                 hydrates from GET /api/auth/me on load.
├── lib/roles.js  Role → landing path. The single source of truth for
│                 role routing; both the post-login redirect and the
│                 route guard read it.
├── components/   Shared UI. Badges, dropzone, timeline, flag list,
│                 audit trail, charts, and the app shell/sidebar.
├── hooks/        One data-loading hook per view shape.
└── pages/        One component per route.
```

**Route guarding.** `RequireAuth` blocks everything under `/app` until
a session is confirmed. `RequireRole` gates each route to the role(s)
allowed on it — a mismatched user is redirected to *their own*
dashboard, not a dead end. Routes are blocked by URL, not merely
hidden from the sidebar, and the backend enforces the same matrix
independently: the frontend guard is for UX, not security.

**Freshness.** There is no websocket/push layer, so every view is
current as of its last load and offers an explicit Refresh. Nothing in
the UI claims to be live-updating.

**Design system.** Plain CSS custom properties in `index.css`, light
and dark via `prefers-color-scheme`. Status (workflow stage) and risk
(automated score) are deliberately distinct badge families so the two
axes are never conflated. Charts follow the `dataviz` skill's
validated palette: an ordinal blue ramp for the in-sequence workflow
stages, and the reserved fixed status scale for risk levels and the
rejected branch.

## Commands

```bash
npm run dev      # dev server with HMR
npm run build    # production build to dist/
npm run preview  # serve the production build
npm run lint     # oxlint
```
