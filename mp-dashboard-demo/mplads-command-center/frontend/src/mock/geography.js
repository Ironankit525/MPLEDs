// All data in the demo environment is fictional and used only for development/testing.

export const MOCK_GEOGRAPHY = {
  MP001: {
    constituency: "Pune",
    state: "Maharashtra",
    totalBlocks: 6,
    totalVillages: 142,
    villagesCovered: 126,
    developmentGaps: [
      { id: "GAP001", block: "Velhe", issue: "Lack of cold storage for perishable agricultural produce", severity: "HIGH" },
      { id: "GAP002", block: "Bhor East", issue: "Under-equipped primary health sub-centres", severity: "MEDIUM" },
      { id: "GAP003", block: "Khed South", issue: "Narrow access roads for emergency vehicles", severity: "HIGH" }
    ],
    mapBoundary: {
      center: [18.5204, 73.8567],
      zoom: 10
    }
  },
  MP002: {
    constituency: "Varanasi",
    state: "Uttar Pradesh",
    totalBlocks: 8,
    totalVillages: 180,
    villagesCovered: 154,
    developmentGaps: [
      { id: "GAP004", block: "Sewapuri", issue: "High fluoride content in groundwater supply", severity: "CRITICAL" },
      { id: "GAP005", block: "Pindra", issue: "Inadequate rural electrification in secondary schools", severity: "HIGH" }
    ],
    mapBoundary: {
      center: [25.3176, 82.9739],
      zoom: 11
    }
  },
  MP003: {
    constituency: "Bangalore South",
    state: "Karnataka",
    totalBlocks: 4,
    totalVillages: 45,
    villagesCovered: 42,
    developmentGaps: [
      { id: "GAP006", block: "Gottigere", issue: "Urban stormwater drainage overflow during monsoon", severity: "HIGH" }
    ],
    mapBoundary: {
      center: [12.9250, 77.5938],
      zoom: 12
    }
  },
  MP004: {
    constituency: "Wayanad",
    state: "Kerala",
    totalBlocks: 5,
    totalVillages: 88,
    villagesCovered: 68,
    developmentGaps: [
      { id: "GAP007", block: "Mananthavady", issue: "Frequent landslide susceptibility along forest roads", severity: "CRITICAL" }
    ],
    mapBoundary: {
      center: [11.6854, 76.1320],
      zoom: 10
    }
  },
  MP005: {
    constituency: "Kolkata North",
    state: "West Bengal",
    totalBlocks: 3,
    totalVillages: 28,
    villagesCovered: 28,
    developmentGaps: [
      { id: "GAP008", block: "Burrabazar", issue: "Aging underground sewerage infrastructure", severity: "HIGH" }
    ],
    mapBoundary: {
      center: [22.5726, 88.3639],
      zoom: 13
    }
  }
};
