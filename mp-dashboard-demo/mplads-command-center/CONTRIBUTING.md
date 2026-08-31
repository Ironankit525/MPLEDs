# Contributing Guidelines — MPLADS Command Center

Welcome to the **MPLADS Command Center** project team! To ensure scalability across 700+ Members of Parliament and smooth integration with our future backend, all contributors must strictly adhere to the guidelines documented below.

---

## 1. Golden Rules of Architecture

### Rule #1: NEVER Hardcode MP Information
* **Do NOT** create MP-specific UI files or folders (e.g. `MP001Dashboard.jsx`, `mp002/`).
* **Do NOT** hardcode MP names, constituency names, or fund figures directly inside components.
* All components must receive data dynamically via props, hooks, or context.

### Rule #2: Strictest Service Layer Abstraction
* Presentational components **must NEVER** import data directly from `src/mock/`.
* Component structure:
  ```text
  React Component  →  Custom Hook  →  Feature Service  →  Mock Service / API Client
  ```
* UI components must remain completely agnostic of whether data originates from mock datasets or real HTTP REST endpoints.

### Rule #3: Presentational Decoupling
* Presentational components (cards, tables, buttons, metrics) must contain zero data-fetching or API logic.
* Business logic and data transformation belong in custom hooks (`src/hooks/`) or feature services (`src/features/*/`).

---

## 2. Code Organization & Naming Conventions

* **Components**: PascalCase (e.g. `ProjectCard.jsx`, `FundSummary.jsx`).
* **Hooks**: camelCase starting with `use` (e.g. `useProjects.js`, `useFinance.js`).
* **Services**: camelCase ending with `Service` (e.g. `projectService.js`, `mockProjectService.js`).
* **Constants**: UPPER_SNAKE_CASE exports in `src/constants/`.

---

## 3. Git Workflow & Branching

* **Main Branch**: `main` (Production/Staging ready code only).
* **Feature Branches**: `feature/short-description` (e.g. `feature/project-filters`).
* **Bug Fix Branches**: `bugfix/short-description` (e.g. `bugfix/fund-calculation-rounding`).

---

## 4. How to Add a New Feature

1. **Define Data Contracts**: Update `docs/api/` and `docs/database/data-model.md` if introducing new models or endpoints.
2. **Add Mock Dataset**: Add fictional data records into `src/mock/` with `mpId` associations.
3. **Implement Mock Service**: Add service methods to the relevant file in `src/mockServices/`.
4. **Implement Feature Service Interface**: Expose clean async functions in `src/features/<feature>/<feature>Service.js`.
5. **Create Hook & UI Components**: Build reusable presentational components and connect them through custom hooks.

---

## 5. Security & Fictional Data Note

* Ensure no real personal identification data or real political sensitivity data is added.
* All demo data must remain strictly fictional for development and testing.
