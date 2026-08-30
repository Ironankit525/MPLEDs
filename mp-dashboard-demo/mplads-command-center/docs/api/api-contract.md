# API Contract Specifications — MPLADS Command Center

> [!IMPORTANT]
> **PROVISIONAL — SUBJECT TO BACKEND TEAM CONFIRMATION**
> These specifications represent the contract expected by the frontend service layer.

## Base URL Configuration

All API requests are relative to `VITE_API_BASE_URL` defined in `.env`:
`http://localhost:5000/api`

---

## Standard Response Wrappers

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Resource retrieved successfully",
  "meta": {
    "timestamp": "2026-08-29T10:00:00Z",
    "financialYear": "2026-27"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Project with ID PRJ999 was not found",
    "details": []
  }
}
```

---

## Standard HTTP Status Codes

* `200 OK`: Request succeeded.
* `201 Created`: Resource created.
* `400 Bad Request`: Validation failure.
* `401 Unauthorized`: Missing or invalid authentication token.
* `403 Forbidden`: Authenticated user lacks permission.
* `404 Not Found`: Resource does not exist.
* `500 Internal Server Error`: Server failure.
