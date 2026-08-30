// All data in the demo environment is fictional and used only for development/testing.

export const MOCK_PROJECTS = [
  // MP001 - Pune (Maharashtra)
  {
    id: "PRJ001",
    mpId: "MP001",
    financialYear: "2026-27",
    name: "Community Health Centre Upgradation",
    sector: "Healthcare",
    location: {
      village: "Haveli",
      district: "Pune",
      state: "Maharashtra",
      latitude: 18.5204,
      longitude: 73.8567
    },
    sanctionedAmount: 1800000,
    releasedAmount: 1500000,
    utilizedAmount: 1200000,
    status: "ONGOING",
    startDate: "2026-04-10",
    expectedCompletionDate: "2026-10-10",
    completionPercentage: 65,
    beneficiaries: 4200,
    contractorId: "CON001"
  },
  {
    id: "PRJ002",
    mpId: "MP001",
    financialYear: "2026-27",
    name: "Primary School Science & Smart Lab",
    sector: "Education",
    location: {
      village: "Shirur",
      district: "Pune",
      state: "Maharashtra",
      latitude: 18.8288,
      longitude: 74.3734
    },
    sanctionedAmount: 2200000,
    releasedAmount: 2200000,
    utilizedAmount: 2200000,
    status: "COMPLETED",
    startDate: "2025-06-01",
    expectedCompletionDate: "2026-01-15",
    completionPercentage: 100,
    beneficiaries: 1800,
    contractorId: "CON002"
  },
  {
    id: "PRJ003",
    mpId: "MP001",
    financialYear: "2026-27",
    name: "Rural Concrete Connecting Road - Phase II",
    sector: "Roads & Bridges",
    location: {
      village: "Mulshi",
      district: "Pune",
      state: "Maharashtra",
      latitude: 18.5026,
      longitude: 73.5131
    },
    sanctionedAmount: 4500000,
    releasedAmount: 3000000,
    utilizedAmount: 2100000,
    status: "ONGOING",
    startDate: "2026-02-15",
    expectedCompletionDate: "2026-11-30",
    completionPercentage: 45,
    beneficiaries: 8500,
    contractorId: "CON003"
  },
  {
    id: "PRJ004",
    mpId: "MP001",
    financialYear: "2025-26",
    name: "RO Water Treatment Plant Installation",
    sector: "Water & Sanitation",
    location: {
      village: "Bhor",
      district: "Pune",
      state: "Maharashtra",
      latitude: 18.1564,
      longitude: 73.8443
    },
    sanctionedAmount: 1200000,
    releasedAmount: 1200000,
    utilizedAmount: 1200000,
    status: "COMPLETED",
    startDate: "2025-04-10",
    expectedCompletionDate: "2025-09-15",
    completionPercentage: 100,
    beneficiaries: 3400,
    contractorId: "CON001"
  },

  // MP002 - Varanasi (Uttar Pradesh)
  {
    id: "PRJ005",
    mpId: "MP002",
    financialYear: "2026-27",
    name: "Ghat Solar Illumination & Safety Lighting",
    sector: "Renewable Energy",
    location: {
      village: "Assi Ghat Area",
      district: "Varanasi",
      state: "Uttar Pradesh",
      latitude: 25.2882,
      longitude: 82.9997
    },
    sanctionedAmount: 3500000,
    releasedAmount: 2800000,
    utilizedAmount: 2400000,
    status: "ONGOING",
    startDate: "2026-03-01",
    expectedCompletionDate: "2026-09-30",
    completionPercentage: 70,
    beneficiaries: 25000,
    contractorId: "CON004"
  },
  {
    id: "PRJ006",
    mpId: "MP002",
    financialYear: "2026-27",
    name: "Handloom Craftsmen Common Facility Centre",
    sector: "Community Assets",
    location: {
      village: "Lohta",
      district: "Varanasi",
      state: "Uttar Pradesh",
      latitude: 25.3211,
      longitude: 82.9341
    },
    sanctionedAmount: 5000000,
    releasedAmount: 4000000,
    utilizedAmount: 1800000,
    status: "ONGOING",
    startDate: "2026-01-20",
    expectedCompletionDate: "2026-12-15",
    completionPercentage: 35,
    beneficiaries: 6200,
    contractorId: "CON005"
  },

  // MP003 - Bangalore South (Karnataka)
  {
    id: "PRJ007",
    mpId: "MP003",
    financialYear: "2026-27",
    name: "Government College Digital E-Learning Hub",
    sector: "Education",
    location: {
      village: "Jayanagar",
      district: "Bengaluru",
      state: "Karnataka",
      latitude: 12.9250,
      longitude: 77.5938
    },
    sanctionedAmount: 4000000,
    releasedAmount: 4000000,
    utilizedAmount: 3800000,
    status: "COMPLETED",
    startDate: "2025-10-01",
    expectedCompletionDate: "2026-03-31",
    completionPercentage: 100,
    beneficiaries: 9500,
    contractorId: "CON002"
  },

  // MP004 - Wayanad (Kerala)
  {
    id: "PRJ008",
    mpId: "MP004",
    financialYear: "2026-27",
    name: "Tribal Village Rainwater Harvesting Network",
    sector: "Water & Sanitation",
    location: {
      village: "Meppadi",
      district: "Wayanad",
      state: "Kerala",
      latitude: 11.5541,
      longitude: 76.1264
    },
    sanctionedAmount: 2800000,
    releasedAmount: 2000000,
    utilizedAmount: 1600000,
    status: "ONGOING",
    startDate: "2026-02-01",
    expectedCompletionDate: "2026-08-31",
    completionPercentage: 55,
    beneficiaries: 3100,
    contractorId: "CON001"
  },

  // MP005 - Kolkata North (West Bengal)
  {
    id: "PRJ009",
    mpId: "MP005",
    financialYear: "2026-27",
    name: "Heritage Ward Maternity Clinic Modernization",
    sector: "Healthcare",
    location: {
      village: "Shyambazar",
      district: "Kolkata",
      state: "West Bengal",
      latitude: 22.6000,
      longitude: 88.3700
    },
    sanctionedAmount: 3200000,
    releasedAmount: 2500000,
    utilizedAmount: 2100000,
    status: "ONGOING",
    startDate: "2026-03-15",
    expectedCompletionDate: "2026-10-31",
    completionPercentage: 60,
    beneficiaries: 7800,
    contractorId: "CON005"
  }
];
