# Planning API Contract — MPLADS Command Center

> [!IMPORTANT]
> **PROVISIONAL — SUBJECT TO BACKEND TEAM CONFIRMATION**

## Endpoints

### 1. Get Proposed Projects
`GET /api/planning/proposals`

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "PROP001",
      "mpId": "MP001",
      "title": "Solar Powered Street Lighting in Rural Blocks",
      "sector": "Renewable Energy",
      "estimatedCost": 2500000,
      "proposedVillage": "Khed",
      "impactScore": 92,
      "urgency": "HIGH",
      "status": "UNDER_REVIEW"
    }
  ]
}
```

---

### 2. Get Priority Analysis Matrix
`GET /api/planning/priority-analysis`

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "underservedVillagesCount": 14,
    "topPrioritySectors": ["Healthcare", "Clean Water"],
    "recommendedAllocations": [
      { "sector": "Healthcare", "suggestedBudget": 15000000 }
    ]
  }
}
```
