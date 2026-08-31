# MPLADS Command Center

> **Frontend Foundation & Multi-Tenant Architecture for 700+ Members of Parliament across India**

The **MPLADS Command Center** is a scalable web platform engineered to empower Members of Parliament (MPs) to monitor, manage, and optimize their Member of Parliament Local Area Development Scheme (MPLADS) funds and development projects.

> [!IMPORTANT]
> **All data in this repository and demo environment is fictional and used only for development and testing purposes.** No actual government or constituent records are represented.

---

## Architectural Highlights

* **Single Application, 700+ MPs**: Built with a multi-tenant frontend architecture. A single unified React code base dynamically serves any authenticated MP without hardcoded MP identifiers or duplicate UI pages.
* **Pluggable Service Layer**: UI components interact exclusively with abstraction services (`src/features/*/*Service.js`). Currently, these services delegate to `mockServices/`, which can be seamlessly swapped for standard HTTP calls (`apiClient.js`) when the production backend is deployed.
* **Financial Year Awareness**: Native support for filtering funds, expenditures, and project metrics by financial years (e.g., `2024-25`, `2025-26`, `2026-27`).
* **Strict Separation of Concerns**: Presentational components are decoupled from business logic and data fetching, ensuring high testability and reusability.

---

## Directory Structure

```text
mplads-command-center/
├── README.md
├── CONTRIBUTING.md
├── .gitignore
├── .env.example
├── package.json
│
├── docs/                     # Technical, Architecture & API Documentation
│   ├── README.md
│   ├── architecture/         # System, Frontend & Auth Design Specs
│   ├── api/                  # Provisional REST API Contracts
│   └── database/             # Data Models & Schema Design
│
└── frontend/                 # React + Vite Web Application
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── app/              # Application entrypoint & Routing
        ├── components/       # Common presentational, layout, chart & project UI
        ├── constants/        # Routes, Roles, Sectors, Statuses
        ├── context/          # Auth & User state management
        ├── features/         # Domain feature views & services
        ├── hooks/            # Custom React hooks (useAuth, useProjects, etc.)
        ├── mock/             # Fictional datasets for 5 demo MPs
        ├── mockServices/     # Service implementations reading from mock datasets
        ├── services/         # Axios API Client & real backend integration adapters
        ├── styles/           # Global styles & CSS variable tokens
        └── utils/            # Formatting & error handling helpers
```

---

## Getting Started

### Prerequisites

* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher

### Installation

1. Clone the repository:
   ```bash
   cd mplads-command-center/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser at `http://localhost:5173`.

---

## Demo Authentication & MP Switching

During the foundation phase without a live backend:
1. Navigate to the `/login` screen.
2. Select any of the 5 demo MPs:
   - **MP001**: Demo MP One (Pune, Maharashtra)
   - **MP002**: Demo MP Two (Varanasi, Uttar Pradesh)
   - **MP003**: Demo MP Three (Bangalore South, Karnataka)
   - **MP004**: Demo MP Four (Wayanad, Kerala)
   - **MP005**: Demo MP Five (Kolkata North, West Bengal)
3. Instant MP Switching: You can also switch the active MP at any time using the active profile menu in the top Navigation Bar.

---

## Future Backend Integration Roadmap

When the real Express/Node backend is ready:
1. Set `VITE_API_BASE_URL` in `frontend/.env` to point to the backend instance (e.g. `http://localhost:5000/api`).
2. Update feature service modules (`src/features/*/*Service.js`) to import `apiClient` instead of `mockServices`.
3. The UI components will require **zero** modifications because they rely on feature service interfaces.

---

## Documentation

For full architecture details, data schemas, and API contracts, explore the `docs/` directory:
- [System Architecture](docs/architecture/system-architecture.md)
- [Frontend Architecture](docs/architecture/frontend-architecture.md)
- [Authentication Flow](docs/architecture/authentication-flow.md)
- [API Contracts](docs/api/api-contract.md)
- [Data Models](docs/database/data-model.md)

---

## License

Internal Development Project — All Rights Reserved.
