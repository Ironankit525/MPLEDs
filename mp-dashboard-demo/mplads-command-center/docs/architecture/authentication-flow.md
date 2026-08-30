# Authentication Flow Architecture — MPLADS Command Center

## Development / Demo Auth Mode

During the foundation phase, authentication is handled via `AuthContext.jsx` and `mockAuthService.js`:

```text
                             ┌───────────────────────┐
                             │  User visits /login   │
                             └───────────┬───────────┘
                                         │
                                         ▼
                             ┌───────────────────────┐
                             │  Select Demo MP ID    │
                             │  (e.g., MP001/MP002)  │
                             └───────────┬───────────┘
                                         │
                                         ▼
                             ┌───────────────────────┐
                             │  Click 'Demo Login'   │
                             └───────────┬───────────┘
                                         │
                                         ▼
                             ┌───────────────────────┐
                             │ Mock Auth Service     │
                             │ Returns User & MP Profile│
                             └───────────┬───────────┘
                                         │
                                         ▼
                             ┌───────────────────────┐
                             │ Store in AuthContext  │
                             │ & localStorage        │
                             └───────────┬───────────┘
                                         │
                                         ▼
                             ┌───────────────────────┐
                             │ Navigate to /dashboard│
                             └───────────────────────┘
```

### Active MP Switching in Header
In the top Navigation Bar (`Navbar.jsx`), authenticated users can instantly switch the active demo MP (e.g. from `MP001` to `MP002`).
This invokes `switchMP(mpId)` in `AuthContext`, triggering dynamic re-fetching of all metrics across all active views without requiring a page reload.

---

## Production JWT Integration Plan

When integrating the production Express backend:

1. **Login Request**:
   * Client posts credentials (`email`, `password`) to `POST /api/auth/login`.
   * Server responds with JWT Bearer Token and MP metadata.

2. **Session Persistence**:
   * Token is saved in secure `httpOnly` cookie or memory with refresh token flow.
   * `apiClient.js` attaches `Authorization: Bearer <token>` header automatically via Axios interceptor.

3. **Backend Authorization**:
   * Backend decodes token, verifies `mpId` claim, and scopes all queries (`WHERE mp_id = req.user.mpId`).
