# Finance API Contract — MPLADS Command Center

> [!IMPORTANT]
> **PROVISIONAL — SUBJECT TO BACKEND TEAM CONFIRMATION**

## Endpoints

### 1. Get Fund Summary
`GET /api/finance/summary`

#### Query Parameters
`financialYear` (optional, default `2026-27`)

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "allocation": 50000000,
    "sanctioned": 42000000,
    "released": 38000000,
    "utilized": 31500000,
    "available": 8000000,
    "committed": 10500000,
    "utilizationRate": 82.89
  }
}
```

---

### 2. Get Monthly Expenditures
`GET /api/finance/expenditure`

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    { "month": "Apr 2026", "amount": 2500000, "category": "Healthcare" },
    { "month": "May 2026", "amount": 3800000, "category": "Education" }
  ]
}
```
