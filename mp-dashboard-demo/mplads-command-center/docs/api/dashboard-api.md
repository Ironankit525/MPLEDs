# Dashboard API Contract — MPLADS Command Center

> [!IMPORTANT]
> **PROVISIONAL — SUBJECT TO BACKEND TEAM CONFIRMATION**

## Endpoint

`GET /api/dashboard`

### Query Parameters
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `financialYear` | `string` | No | `2026-27` | Filter data by financial year (`2024-25`, `2025-26`, `2026-27`) |

### Headers
`Authorization: Bearer <token>`

---

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "mp": {
      "id": "MP001",
      "name": "Demo MP One",
      "constituency": "Pune",
      "state": "Maharashtra"
    },
    "financialYear": "2026-27",
    "fund": {
      "allocation": 50000000,
      "sanctioned": 42000000,
      "released": 38000000,
      "utilized": 31500000,
      "available": 8000000,
      "committed": 10500000
    },
    "projects": {
      "total": 18,
      "active": 7,
      "completed": 9,
      "ongoing": 7,
      "notStarted": 2
    },
    "beneficiaries": 245000,
    "villagesCovered": 126,
    "recentProjects": [
      {
        "id": "PRJ001",
        "name": "Community Health Centre Upgradation",
        "sector": "Healthcare",
        "sanctionedAmount": 1800000,
        "completionPercentage": 65,
        "status": "ONGOING"
      }
    ],
    "sectorAllocation": [
      { "sector": "Healthcare", "amount": 12000000, "percentage": 28.5 },
      { "sector": "Education", "amount": 10000000, "percentage": 23.8 }
    ],
    "expenditureTrend": [
      { "month": "Apr", "amount": 2500000 },
      { "month": "May", "amount": 3800000 }
    ],
    "projectStatus": [
      { "status": "COMPLETED", "count": 9 },
      { "status": "ONGOING", "count": 7 },
      { "status": "NOT_STARTED", "count": 2 }
    ]
  }
}
```
