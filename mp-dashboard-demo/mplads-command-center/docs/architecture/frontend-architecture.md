# Frontend Architecture — MPLADS Command Center

## Layered Design & Unidirectional Data Flow

The frontend application follows a strict unidirectional data flow:

```text
React Presentational Component (e.g. ProjectCard.jsx)
        ↑ (props)
Custom Hook (e.g. useProjects.js)
        ↑ (returns state & actions)
Feature Service (e.g. projectService.js)
        ↑ (delegates call)
Mock Service (mockProjectService.js)  <-- SWAPPABLE -->  API Client (apiClient.js)
        ↑                                                     ↑
Mock Data (projects.js)                                Express REST API
```

---

## Directory Responsibilities

### `src/app/`
* `App.jsx`: Global provider wrappers (`AuthContext`, `UserContext`, Router).
* `AppRoutes.jsx`: Central router definition using constants from `src/constants/routes.js`.
* `main.jsx`: Vite entry point rendering React root.

### `src/components/`
Pure presentational components:
* `common/`: General UI primitives (`Button`, `Card`, `Badge`, `Modal`, `Loader`, `EmptyState`, `ErrorState`).
* `layout/`: App Shell (`Sidebar`, `Navbar`, `DashboardLayout`, `PageHeader`).
* `charts/`: Chart representations (`FundUtilizationChart`, `ExpenditureChart`, `SectorAllocationChart`, `ProjectStatusChart`).
* `project/`: Domain presentational widgets (`ProjectCard`, `ProjectTable`, `ProjectStatus`, `ProjectTimeline`, `ProjectFilters`).

### `src/features/`
Domain features grouped by business capability:
* Each feature folder (e.g., `dashboard`, `projects`, `finance`, `geography`, `planning`, `contractors`, `beneficiaries`, `feedback`, `reports`) contains views, feature-specific subcomponents, and a feature service abstraction (e.g., `projectService.js`).

### `src/context/` & `src/hooks/`
* `AuthContext.jsx`: Manages current user session, active MP ID, and login/logout methods.
* `UserContext.jsx`: Manages user preferences, active financial year state, and global filters.
* Custom hooks (`useAuth`, `useUser`, `useProjects`, `useFinance`) expose state and action triggers to components.

### `src/mock/` & `src/mockServices/`
* Fictional datasets isolated strictly in `src/mock/`.
* Async service methods simulating network latencies in `src/mockServices/`.

---

## Code Isolation Guidelines

1. Presentational components **must not** contain `useEffect` data fetching logic.
2. Presentational components **must not** reference `src/mock/` or `Axios`.
3. Financial currency amounts must always be rendered using `formatCurrency(val)` utility.
4. Dates must always be formatted using `formatDate(dateStr)` utility.
