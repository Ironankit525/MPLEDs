# System Architecture — MPLADS Command Center

## Executive Overview

The **MPLADS Command Center** is a multi-tenant web platform designed to serve **700+ Members of Parliament (Lok Sabha & Rajya Sabha)** across all Indian States and Union Territories.

Each MP receives an annual MPLADS allocation (demo allocation: **₹5 Crore**) to execute local constituency development projects across healthcare, education, drinking water, sanitation, and rural connectivity.

---

## Core Architectural Principles

```text
                               ┌────────────────────────────────┐
                               │       ONE REACT FRONTEND       │
                               └───────────────┬────────────────┘
                                               │
                                               ▼
                               ┌────────────────────────────────┐
                               │       AUTHENTICATED USER       │
                               └───────────────┬────────────────┘
                                               │
                                               ▼
                               ┌────────────────────────────────┐
                               │           CURRENT MP           │
                               └───────────────┬────────────────┘
                                               │
                                               ▼
                               ┌────────────────────────────────┐
                               │         SERVICE LAYER          │
                               └───────┬────────────────┬───────┘
                                       │                │
                                       ▼                ▼
                                  (MOCK DATA)     (REAL BACKEND)
                                    Current          Future
```

1. **Multi-Tenant Single Codebase**:
   * One single web client serves all 700+ MPs.
   * No MP-specific pages or static files exist in the repository.
   * Data context is determined dynamically by the logged-in session.

2. **Strict Data Isolation**:
   * The client never requests `GET /api/all-mp-data`.
   * Requests pass through authorization middleware on the backend (or mock filter on the client during development) to ensure an MP can only access records where `mpId === currentMP.id`.

3. **Pluggable Backend Layer**:
   * UI components rely strictly on feature services (`src/features/*/*Service.js`).
   * Transition from mock data (`src/mockServices/`) to backend (`src/services/apiClient.js`) requires modifying service functions only; UI components remain unchanged.

---

## Role-Based Scope Strategy

The platform architecture accommodates three primary user roles defined in `src/constants/roles.js`:

* **`MP`**: Decision support, fund monitoring, project proposal review, expenditure tracking, constituent feedback oversight.
* **`NODAL_OFFICER`**: Verification workflow, field report approvals, AI anomaly detection (verification checks, physical progress inspection). *Implemented in future phase.*
* **`ADMIN`**: Platform configuration, MP master profile updates, global audit logs. *Implemented in future phase.*

For Task 01, routing and RBAC structures prepare placeholders for `/mp/*`, `/nodal/*`, and `/admin/*`, with full implementation focused on the MP view.
