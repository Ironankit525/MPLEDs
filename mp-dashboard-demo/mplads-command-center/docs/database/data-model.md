# Data Model Specifications — MPLADS Command Center

This document outlines the core entity schemas used across the mock layer and future database models.

---

## Entity Schemas

### 1. Member of Parliament (`MP`)
```typescript
interface MP {
  id: string;             // e.g. "MP001"
  name: string;           // e.g. "Demo MP One"
  constituency: string;   // e.g. "Pune"
  state: string;          // e.g. "Maharashtra"
  party: string;          // e.g. "Demo Party"
  role: "MP" | "NODAL_OFFICER" | "ADMIN";
  avatarUrl?: string;
  email: string;
}
```

---

### 2. Project (`Project`)
```typescript
interface Location {
  village: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
}

interface Project {
  id: string;                     // e.g. "PRJ001"
  mpId: string;                   // Foreign key to MP
  name: string;                   // Project Title
  sector: "Healthcare" | "Education" | "Roads & Bridges" | "Water & Sanitation" | "Renewable Energy" | "Community Assets";
  location: Location;
  sanctionedAmount: number;       // INR
  releasedAmount: number;         // INR
  utilizedAmount: number;         // INR
  status: "ONGOING" | "COMPLETED" | "NOT_STARTED" | "DELAYED";
  startDate: string;              // ISO YYYY-MM-DD
  expectedCompletionDate: string; // ISO YYYY-MM-DD
  completionPercentage: number;   // 0 - 100
  beneficiaries: number;          // Estimated count
  contractorId: string;           // Foreign key to Contractor
  financialYear: string;          // e.g. "2026-27"
}
```

---

### 3. Fund Metrics (`FundMetrics`)
```typescript
interface FundMetrics {
  mpId: string;
  financialYear: string;
  allocation: number;             // Standard annual e.g., ₹5 Crore (50,000,000)
  sanctioned: number;
  released: number;
  utilized: number;
  available: number;
  committed: number;
}
```

---

### 4. Contractor (`Contractor`)
```typescript
interface Contractor {
  id: string;
  name: string;
  registrationNumber: string;
  rating: number;                // 1.0 - 5.0
  projectsCompleted: number;
  contactEmail: string;
  phone: string;
}
```

---

### 5. Beneficiary Report (`BeneficiaryReport`)
```typescript
interface BeneficiaryReport {
  id: string;
  mpId: string;
  projectId: string;
  projectName: string;
  beneficiaryGroup: string;      // e.g., "School Children", "Local Farmers"
  impactCount: number;
  location: string;
}
```

---

### 6. Citizen Feedback (`CitizenFeedback`)
```typescript
interface CitizenFeedback {
  id: string;
  mpId: string;
  projectId?: string;
  citizenName: string;
  rating: number;                // 1 - 5 stars
  category: "Praise" | "Suggestion" | "Grievance" | "Query";
  comment: string;
  date: string;
  status: "PENDING" | "RESOLVED" | "REVIEWED";
}
```

---

### 7. Planning Proposal (`PlanningProposal`)
```typescript
interface PlanningProposal {
  id: string;
  mpId: string;
  title: string;
  sector: string;
  estimatedCost: number;
  proposedVillage: string;
  impactScore: number;          // 0 - 100
  urgency: "HIGH" | "MEDIUM" | "LOW";
  status: "PROPOSED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
}
```
