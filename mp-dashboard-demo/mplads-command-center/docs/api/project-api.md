# Project API Contract — MPLADS Command Center

> [!IMPORTANT]
> **PROVISIONAL — SUBJECT TO BACKEND TEAM CONFIRMATION**

## Endpoints

### 1. List Projects
`GET /api/projects`

#### Query Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `financialYear` | `string` | No | Financial year string |
| `status` | `string` | No | `ONGOING`, `COMPLETED`, `NOT_STARTED` |
| `sector` | `string` | No | Sector filter (e.g. `Healthcare`, `Education`) |
| `search` | `string` | No | Search text in project title/village |

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "PRJ001",
      "mpId": "MP001",
      "name": "Community Health Centre Upgradation",
      "sector": "Healthcare",
      "location": {
        "village": "Haveli",
        "district": "Pune",
        "state": "Maharashtra",
        "latitude": 18.5204,
        "longitude": 73.8567
      },
      "sanctionedAmount": 1800000,
      "releasedAmount": 1500000,
      "utilizedAmount": 1200000,
      "status": "ONGOING",
      "startDate": "2026-04-10",
      "expectedCompletionDate": "2026-10-10",
      "completionPercentage": 65,
      "beneficiaries": 4200,
      "contractorId": "CON001"
    }
  ]
}
```

---

### 2. Get Single Project Details
`GET /api/projects/:id`

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "PRJ001",
    "mpId": "MP001",
    "name": "Community Health Centre Upgradation",
    "sector": "Healthcare",
    "location": {
      "village": "Haveli",
      "district": "Pune",
      "state": "Maharashtra",
      "latitude": 18.5204,
      "longitude": 73.8567
    },
    "sanctionedAmount": 1800000,
    "releasedAmount": 1500000,
    "utilizedAmount": 1200000,
    "status": "ONGOING",
    "startDate": "2026-04-10",
    "expectedCompletionDate": "2026-10-10",
    "completionPercentage": 65,
    "beneficiaries": 4200,
    "contractor": {
      "id": "CON001",
      "name": "Apex Infrastructure Ltd",
      "rating": 4.8
    }
  }
}
```

---

### 3. Create Project Proposal
`POST /api/projects`

#### Request Body
```json
{
  "name": "New High School Computer Lab",
  "sector": "Education",
  "village": "Shirur",
  "sanctionedAmount": 1200000,
  "expectedCompletionDate": "2026-12-31"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "PRJ019",
    "mpId": "MP001",
    "name": "New High School Computer Lab",
    "status": "NOT_STARTED",
    "completionPercentage": 0
  }
}
```
