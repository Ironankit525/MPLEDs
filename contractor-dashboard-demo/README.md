# Submitter Dashboard Demo

A standalone frontend demo of the MPLADS submitter dashboard. It uses local mock data, so no API server or database is required.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). The demo opens as a pre-authenticated submitter account.

## Demo routes

- `/app/submissions` — dashboard and interactive **View Submission** links
- `/app/submissions/submission-001` — preloaded pending submission
- `/app/upload` — upload flow; uploaded entries are added to the in-memory demo list
- `/app/settings` — submitter profile

Mock data and response handlers are in `src/api/mockData.js`. Replace `src/api/client.js` with a real API client when integrating a backend.
