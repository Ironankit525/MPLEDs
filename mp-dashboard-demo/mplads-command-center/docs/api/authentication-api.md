# Authentication API Contract — MPLADS Command Center

> [!IMPORTANT]
> **PROVISIONAL — SUBJECT TO BACKEND TEAM CONFIRMATION**

## Endpoints

### 1. User Login
`POST /api/auth/login`

#### Request Body
```json
{
  "email": "mp.one@sansad.in",
  "password": "demoPassword123"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "USR001",
      "name": "Demo MP One",
      "email": "mp.one@sansad.in",
      "role": "MP",
      "mpId": "MP001"
    },
    "mp": {
      "id": "MP001",
      "name": "Demo MP One",
      "constituency": "Pune",
      "state": "Maharashtra",
      "party": "Demo Party"
    }
  }
}
```

---

### 2. Get Current Authenticated User
`GET /api/auth/me`

#### Headers
`Authorization: Bearer <token>`

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "USR001",
      "name": "Demo MP One",
      "email": "mp.one@sansad.in",
      "role": "MP",
      "mpId": "MP001"
    },
    "mp": {
      "id": "MP001",
      "name": "Demo MP One",
      "constituency": "Pune",
      "state": "Maharashtra",
      "party": "Demo Party"
    }
  }
}
```

---

### 3. User Logout
`POST /api/auth/logout`

#### Headers
`Authorization: Bearer <token>`

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```
