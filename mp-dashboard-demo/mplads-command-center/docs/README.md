# MPLADS Command Center Documentation

Welcome to the technical documentation repository for the **MPLADS Command Center**.

This directory contains complete architectural guidelines, data schemas, and API contracts for developers working on both frontend UI components and future backend API services.

---

## Documentation Index

### 1. Architecture Specs (`docs/architecture/`)
* [System Architecture](architecture/system-architecture.md): Multi-tenant architecture serving 700+ MPs, data isolation, and future backend integration.
* [Frontend Architecture](architecture/frontend-architecture.md): Service abstraction layer, feature directory structure, custom hooks, and presentational decoupling.
* [Authentication Flow](architecture/authentication-flow.md): Demo MP selector mechanism vs production JWT/session flow.

### 2. Provisional API Contracts (`docs/api/`)
> [!NOTE]
> All endpoints are **PROVISIONAL — SUBJECT TO BACKEND TEAM CONFIRMATION**.
* [API Contract Overview](api/api-contract.md): REST conventions, standard response structure, and status codes.
* [Authentication API](api/authentication-api.md): `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`.
* [Dashboard API](api/dashboard-api.md): `/api/dashboard` aggregated telemetry metrics.
* [Project API](api/project-api.md): `/api/projects`, `/api/projects/:id` CRUD contracts.
* [Finance API](api/finance-api.md): `/api/finance/summary`, `/api/finance/expenditure`.
* [Planning API](api/planning-api.md): `/api/planning/proposals`, priority scoring.

### 3. Database & Data Models (`docs/database/`)
* [Data Models](database/data-model.md): Detailed schemas for MPs, Projects, Funds, Expenditures, Contractors, Beneficiaries, Citizen Feedback, and Planning Proposals.
