# MPLADS Image Fraud Detection Module - System Architecture

## Executive Summary

The MPLADS Image Module is a full-stack fraud detection system built to verify submitted work images against historical duplicates and metadata anomalies. It uses a **6-layer detection pipeline** orchestrated by a risk scoring engine to flag potentially fraudulent submissions across multiple detection dimensions: cryptographic, perceptual, semantic, geometric, metadata, and content anomalies.

### Tech Stack
- **Backend**: FastAPI (Python 3.10+), MongoDB Atlas (cloud persistence), JWT auth
- **Frontend**: React + Vite, TypeScript component-based UI
- **Detection Models**: SHA-256, pHash/dHash (perceptual), CLIP (semantic), SIFT (geometric), EasyOCR (text)
- **Storage**: MongoDB + Cloudinary for images

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (React)                      │
│  Dashboard | Submission Form | Review Queue | Admin Panel       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend (Python)                       │
│                                                                   │
│  ┌──────────────────┐                                            │
│  │  Auth Service    │  JWT tokens, bcrypt, role-based access   │
│  └────────┬─────────┘                                            │
│           │                                                       │
│  ┌────────▼──────────────────────────────────────────┐         │
│  │        Request Routing Layer (main.py)            │         │
│  │  ┌──────────┬────────────┬──────────┬────────┐   │         │
│  │  │ Auth     │ Submission │ Review   │ Admin  │   │         │
│  │  │ Routes   │ Routes     │ Routes   │ Routes │   │         │
│  │  └──────────┴────────────┴──────────┴────────┘   │         │
│  └────────┬──────────────────────────────────────────┘         │
│           │                                                       │
│  ┌────────▼──────────────────────────────────────────┐         │
│  │       Risk Engine Orchestrator (risk_engine.py)   │         │
│  │                                                   │         │
│  │   ┌─────────────────────────────────────────┐   │         │
│  │   │  6-Layer Detection Pipeline             │   │         │
│  │   │                                         │   │         │
│  │   │  Layer 1: SHA-256 (Exact)              │   │         │
│  │   │    ↓                                    │   │         │
│  │   │  Layer 2: pHash/dHash (Perceptual)    │   │         │
│  │   │    ↓                                    │   │         │
│  │   │  Layer 3: CLIP (Semantic)             │   │         │
│  │   │    ↓                                    │   │         │
│  │   │  Layer 4: EXIF + ELA (Metadata)       │   │         │
│  │   │    ↓                                    │   │         │
│  │   │  Layer 5: OCR (Text Extraction)       │   │         │
│  │   │    ↓                                    │   │         │
│  │   │  Layer 6: SIFT+RANSAC (Geometric)     │   │         │
│  │   └─────────────────────────────────────────┘   │         │
│  │                    ↓                             │         │
│  │  ┌─────────────────────────────────────┐       │         │
│  │  │  Risk Scorer (aggregation & flags)  │       │         │
│  │  │  Output: Risk Level (LOW/MED/HIGH)  │       │         │
│  │  └─────────────────────────────────────┘       │         │
│  └────────┬──────────────────────────────────────────┘         │
│           │                                                       │
│  ┌────────▼────────────────────────────┐                      │
│  │  Data Layer (models.py + schemas)   │                      │
│  │  User | ImageRecord | Project       │                      │
│  │  CameraSession | District           │                      │
│  └────────┬────────────────────────────┘                      │
│           │                                                       │
└───────────┼───────────────────────────────────────────────────┘
            │
┌───────────▼───────────────────────────────────────────────────┐
│              MongoDB Atlas (Persistent Storage)                │
│  Collections: users | image_records | projects | sessions     │
│              camera_sessions | districts                       │
└───────────────────────────────────────────────────────────────┘
```

---

## 1. Backend Architecture

### 1.1 FastAPI Application Structure (main.py - 2,292 lines)

The main application file is organized into 5 route groups plus initialization.

#### A. Authentication & Session Routes
- `POST /api/auth/register` - Create new user with role
- `POST /api/auth/login` - Generate JWT token (24-hour expiry)
- `GET /api/auth/me` - Fetch current user details
- `POST /api/sessions/create` - Generate a one-time camera session token
- `POST /api/sessions/validate` - Validate a camera session token

**Implementation**:
- Uses `bcrypt` for password hashing
- JWT secret stored in `Settings.JWT_SECRET_KEY`
- Token includes user_id, role, exp timestamp
- All endpoints return schema-validated responses

#### B. Image Submission Routes
- `POST /api/images/submit` - Submit image for risk assessment
  - File upload handling
  - Calls risk_engine.assess_image()
  - Stores ImageRecord in MongoDB
  - Returns RiskAssessmentResponse
- `POST /api/images/check` - Dry-run duplicate check
- `GET /api/images/mine` - Fetch user's own submissions
- `GET /api/images/{work_id}` - Fetch image records by work ID

**Key Logic**:
- File validation (size ≤ 10MB, extensions in allowed list)
- Cloudinary upload for persistence
- Risk assessment happens synchronously
- Workflow status starts as `PENDING_REVIEW`

#### C. Reviewer Routes
- `GET /api/reviews/queue` - Fetch pending images awaiting review
- `GET /api/reviews/history` - Fetch already reviewed images
- `POST /api/reviews/{image_id}/claim` - Claim an image for review
- `POST /api/reviews/{image_id}/decide` - Submit review decision
  - approve/reject with optional comments
  - Updates workflow status
- `GET /api/reviews/ai-summary` - Get AI summary of pending reviews

**Workflow Transition**:
```
PENDING_REVIEW
    ↓ (reviewer claims)
IN_REVIEW
    ├─ (reviewer approves)
    │   ↓
    │ APPROVED → awaiting stakeholder sign-off
    │
    └─ (reviewer rejects)
        ↓
        REJECTED → terminal
```

#### D. Stakeholder Routes
- `GET /api/stakeholder/overview` - High-level stats and workflow summary
- `GET /api/stakeholder/submissions` - Get fully processed submissions
- `POST /api/stakeholder/{image_id}/sign-off` - Confirm or deny a project completion
- `GET /api/stakeholder/ai-summary` - Gemini AI executive summary of stakeholders queue
- `POST /api/stakeholder/ai-report` - Generate detailed AI report for submissions

#### E. Admin Routes
- `POST /api/admin/users` - Create a user directly with any role
- `GET /api/admin/users` - List all users with pagination
- `PATCH /api/admin/users/{user_id}/role` - Change user role
- `PATCH /api/admin/users/{user_id}/active` - Activate/Deactivate user
- `GET /api/admin/submissions` - Get all submissions (unfiltered)
- `POST /api/admin/submissions/{image_id}/override-status` - Force image status override
- `POST /api/admin/submissions/bulk-override-status` - Bulk status override
- `GET /api/admin/activity` - Fetch admin activity log
- `GET /api/admin/ai-summary` - Gemini AI summary of the system

#### F. Project Routes
- `POST /api/admin/projects` - Create new project
- `GET /api/admin/projects` - List projects (Admin)
- `PATCH /api/admin/projects/{work_id}/assign` - Assign a contractor to a project
- `PATCH /api/admin/projects/{work_id}/status` - Update project status
- `PATCH /api/projects/{work_id}/phases/{order}` - Update a project phase
- `GET /api/projects/mine` - List assigned projects
- `GET /api/dashboard/summary` - Get dashboard stats

#### G. Statistics & Common Routes
- `GET /api/stats` - General statistics
- `GET /api/duplicates` - Fetch duplicate clusters across all layers
- `GET /health` - Health check status

---

### 1.2 Role-Based Access Control (auth.py - 104 lines)

**4 User Roles** (hierarchy):
1. **Submitter** - Can only submit images and see own submissions
2. **Reviewer** - Can view review queue, approve/reject, see all submissions
3. **Stakeholder** - Can see approved items, sign off on projects
4. **Admin** - Full access: user mgmt, status overrides, district management

**Token Flow**:
```
User login → bcrypt verify password
    ↓
Generate JWT (user_id, role, exp=now+24h)
    ↓
Token returned in response
    ↓
Client stores in localStorage
    ↓
All subsequent requests: Authorization: Bearer {token}
    ↓
Verify JWT secret + expiry + role scopes
    ↓
Inject current_user into request context
```

---

## 2. Risk Engine Architecture (risk_engine.py - 931 lines)

### 2.1 The 6 Detection Layers

#### Layer 1: SHA-256 Cryptographic Hash
**Purpose**: Detect byte-identical image duplicates

**Detection**: Hash current image, query MongoDB for matches
- If found: Mark as **EXACT_DUPLICATE** (60 points)

**Limitations**: Zero tolerance for byte changes (re-encoding fails this)

---

#### Layer 2: Perceptual Hashing (pHash/dHash)
**Purpose**: Detect resized, recompressed, and rotated copies

**pHash (Perceptual Hash via DCT)**:
- Captures low-frequency image features using Discrete Cosine Transform
- Thresholds: Hamming distance ≤ 5: DUPLICATE (50 pts), 6-10: SUSPICIOUS (25 pts)

**dHash (Difference Hash via Gradients)**:
- Captures gradient structure (edge patterns)
- More robust to lighting changes
- Thresholds: ≤ 3: DUPLICATE, 4-6: SUSPICIOUS

**Rotation Robustness**:
- Rotation-robust pHash computed as minimum Hamming distance across 4 rotations (0°, 90°, 180°, 270°)

**Known Limitation**:
- Cropping at ~12% per edge defeats pHash thresholds
- Workaround: dHash as fallback (less sensitive to cropping)

---

#### Layer 3: CLIP Semantic Embeddings
**Purpose**: Detect same scene photographed from different angles/lighting

**Model**: OpenAI's CLIP (ViT-B/32, 512-dim embeddings)
- Lazy-loaded (~600 MB on first use)

**Thresholds**:
- Cosine similarity ≥ 0.92: **DUPLICATE** (35 points)
- 0.85-0.91: **SUSPICIOUS** (15 points)
- < 0.10: **SEVERE_CONTENT_MISMATCH** (65 points)

**Known Issue**:
- Synthetic test corpus causes 100% false positives on CLIP
- Needs real photo calibration (data/real_images/ incomplete)

---

#### Layer 4: EXIF & ELA Analysis

**EXIF Metadata** (exif_analysis.py - 494 lines):
- Extract: photo_datetime, GPS coordinates, software (camera/editor), orientation
- Checks: Photo date validation, GPS district mismatch, editing detection

**Flags**:
- `EXIF_STRIPPED`: 5 points alone, 15 points with other flags (conditional weighting)
- `PHOTO_BEFORE_SANCTION`: 30 points (photo datetime < project sanction_date)
- `GPS_LOCATION_MISMATCH`: 30 points (GPS district ≠ claimed district, >2 km tolerance)

**ELA (Error Level Analysis)**:
- Re-compress image at 95% quality, compare original vs re-compressed
- High difference regions indicate tampering

**Flags**:
- `SPLICING_DETECTED`: 35 points
- `SCREENSHOT_DETECTED`: 25 points (disabled by default)
- `PHOTO_OF_PHOTO`: 25 points (moiré patterns)

---

#### Layer 5: OCR Text Extraction (ocr_analysis.py - 261 lines)

**Purpose**: Verify receipt/invoice dates and amounts match claims

**Engine**: EasyOCR (Tesseract-based)
- Lazy-loaded ~65 MB on first use
- Supports 80+ languages

**Validation**:
- `RECEIPT_DATE_BEFORE_SANCTION`: 25 points (OCR date < sanction_date)
- `RECEIPT_AMOUNT_MISMATCH`: 20 points (OCR amount ≠ claimed amount, ±5% tolerance)

**Limitations**: Unreliable on handwritten receipts; can be disabled gracefully

---

#### Layer 6: Geometric Keypoint Matching (keypoint_match.py - 366 lines)

**Purpose**: Detect heavily cropped or rotated duplicates

**Technique**: SIFT keypoints + RANSAC homography verification

**Process**:
1. Extract SIFT keypoints and descriptors from both images
2. Feature matching (BFMatcher or FLANN)
3. Lowe's ratio test (0.75 threshold) to filter good matches
4. RANSAC homography estimation
5. Count inlier matches after RANSAC

**Requirement**: ≥15 inlier matches after RANSAC = DUPLICATE

**Handles**:
- 90% crops (if enough features remain)
- Rotations (SIFT is rotation-invariant)
- Perspective distortion (homography models affine transforms)

---

### 2.2 Risk Scoring Algorithm

**Aggregation Logic**:
```
Score = 0
For each layer:
  - Add points based on flag severity
  - Track layers_run and layers_skipped

Conditional Weighting:
  - EXIF_STRIPPED: 5 pts alone, 15 pts with other flags

Cross-District Penalties:
  - Duplicate in different district: +20 pts
  - Duplicate in different MP: +20 pts

Cap Score at 100

Risk Level:
  - LOW (0-29): Likely legitimate
  - MEDIUM (30-59): Requires investigation
  - HIGH (60-100): Strong evidence of fraud
```

**Graceful Degradation**:
- CLIP disabled → continues without Layer 3
- EasyOCR not installed → Layer 5 skipped
- Keypoint matching disabled → Layer 6 unavailable
- `layers_run` and `layers_skipped` track availability

---

## 3. Data Models & MongoDB Schema (models.py - 313 lines)

### 3.1 User Collection
```python
{
  _id: ObjectId,
  username: str (unique),
  password_hash: str,
  agency_name: str | null,
  district: str | null,
  role: str ('submitter'|'reviewer'|'stakeholder'|'admin'),
  is_active: bool,
  created_at: datetime
}
```

**Indexes**: username (unique), role, district

---

### 3.2 ImageRecord Collection
```python
{
  _id: ObjectId,
  work_id: str,
  work_type: str | null,
  district: str,
  state: str | null,
  mp_name: str | null,
  sanction_date: datetime | null,
  claimed_amount: float | null,
  
  # Storage and hashing
  file_path: str,
  sha256: str,
  phash: str,
  dhash: str | null,
  tile_phashes: str | null,
  
  # Embeddings and features
  embedding: bytes | null,
  orb_features: bytes | null,
  color_signature: bytes | null,
  
  # EXIF/GPS Metadata
  photo_timestamp: datetime | null,
  gps_latitude: float | null,
  gps_longitude: float | null,
  exif_present: bool | null,
  
  # Ownership
  submitted_by_user_id: str | null,
  submitted_by_username: str | null,
  
  # Risk assessment
  risk_score: int | null,
  risk_level: str | null,
  recommendation: str | null,
  flags: [dict] | null,
  
  # Workflow
  status: str (PENDING_REVIEW|IN_REVIEW|APPROVED|REJECTED|SIGNED_OFF),
  reviewed_by_user_id: str | null,
  reviewed_by_username: str | null,
  reviewer_notes: str | null,
  reviewed_at: datetime | null,
  
  signed_off_by_user_id: str | null,
  signed_off_by_username: str | null,
  signoff_notes: str | null,
  signed_off_at: datetime | null,
  
  admin_override_by_user_id: str | null,
  admin_override_by_username: str | null,
  admin_override_previous_status: str | null,
  admin_override_notes: str | null,
  admin_override_at: datetime | null,
  
  # Audit
  uploaded_at: datetime
}
```

**Indexes**: work_id, status, sha256_hash, risk_level

---

### 3.3 Project Collection
```python
{
  _id: ObjectId,
  work_id: str,
  title: str,
  work_type: str | null,
  district: str,
  state: str | null,
  mp_name: str | null,
  
  assigned_to_user_id: str | null,
  assigned_to_username: str | null,
  
  sanctioned_amount: float,
  sanction_date: datetime | null,
  expected_completion_date: datetime | null,
  
  phases: [
    {name: str, order: int, is_complete: bool, completed_at: datetime | null, completed_by_username: str | null}
  ],
  
  status: str (NOT_STARTED|IN_PROGRESS|COMPLETED|CANCELLED),
  
  created_by_user_id: str | null,
  created_by_username: str | null,
  created_at: datetime
}
```

---

### 3.4 CameraSession Collection
```python
{
  _id: ObjectId,
  token: str,
  expires_at: datetime,
  is_used: bool,
  created_by_user_id: str | null
}
```

**Purpose**: Gate image submissions to authenticated sessions (prevents token reuse)

---

### 3.5 District Collection
```python
{
  _id: ObjectId,
  name: str,
  state: str,
  centre_latitude: float,
  centre_longitude: float
}
```

---

## 4. Database Architecture (database.py - 138 lines)

**MongoDB Atlas Cloud Connection**:
- Connection: pymongo MongoClient with cluster credentials
- Database: `mplads_fraud_detection`
- Collections: users, image_records, projects, camera_sessions, districts

**BSON Type Handling**:
- MongoDB ObjectId stored as `_id`
- Pydantic models coerce ObjectId to string for API responses
- MongoDocument base class handles serialization/deserialization

---

## 5. Request/Response Validation (schemas.py - 678 lines)

Pydantic models define the API contract:

**Request Schemas**:
- `ImageSubmitRequest`: file, work_id, work_type, claimed_amount, claimed_district
- `ReviewDecisionRequest`: decision (approve/reject), comments
- `ProjectCreateRequest`: work_id, title, sanctioned_amount, phases
- `AdminUserUpdateRequest`: role, is_active

**Response Schemas**:
- `RiskAssessmentResponse`: score, risk_level, flags, layers_run, duplicate_matches, metadata_anomalies
- `ImageRecordResponse`: file_path, risk_score, risk_level, status, submitted_at, reviewed_at
- `UserResponse`: username, role, agency_name, district, is_active
- `ProjectResponse`: work_id, title, sanctioned_amount, status, phases, images_submitted

All responses include proper error messages (422 validation, 401 auth, 403 forbidden, 404 not found)

---

## 6. Configuration Management (config.py - 590 lines)

**Settings Class** contains all tunable parameters:

**Hashing Thresholds**:
- `PHASH_DUPLICATE_THRESHOLD = 5` (Hamming distance)
- `PHASH_SUSPICIOUS_THRESHOLD = 10`
- `DHASH_DUPLICATE_THRESHOLD = 3`
- `DHASH_SUSPICIOUS_THRESHOLD = 6`

**CLIP Thresholds**:
- `CLIP_DUPLICATE_THRESHOLD = 0.92` (cosine similarity)
- `CLIP_SUSPICIOUS_THRESHOLD = 0.85`
- `CLIP_SEVERE_MISMATCH_THRESHOLD = 0.10`

**Risk Weights** (points):
- Exact duplicate: 60
- Perceptual duplicate: 50
- Semantic duplicate: 35
- Cross-district match: +20
- Photo before sanction: 30
- GPS mismatch: 30
- Content mismatch (severe): 65
- ELA splicing: 35
- ELA screenshot: 25
- OCR date mismatch: 25
- OCR amount mismatch: 20

**Feature Flags**:
- `ENABLE_CLIP = True`
- `ENABLE_KEYPOINT_MATCH = True`
- `ENABLE_OCR = True`
- `ENABLE_ELA = True`

**File Upload**:
- `MAX_UPLOAD_SIZE = 10 * 1024 * 1024` (10 MB)
- `ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'tiff']`

---

## 7. Frontend Architecture

**Technology**: React + Vite + TypeScript

**Key Components**:
- `Dashboard.tsx` - Overview of submissions and stats
- `SubmissionForm.tsx` - Image upload and project selection
- `ReviewQueue.tsx` - Paginated list of pending reviews
- `ReviewDetail.tsx` - Individual submission review with risk breakdown
- `AdminPanel.tsx` - User management, district management, overrides
- `ProjectManagement.tsx` - Create/edit projects

**State Management**: React Context (hooks-based)
- `AuthContext` - Current user, login/logout
- `ProjectContext` - Active project, submission history
- `RiskContext` - Risk assessment details, flag explanations

**API Integration**:
- Axios client with JWT token in Authorization header
- All requests include `Bearer {token}` from localStorage

---

## 8. API Request/Response Flow

### Image Submission Flow
```
1. Client: POST /api/images/submit
   {
     file: File,
     work_id: str,
     work_type: str,
     claimed_amount: int,
     claimed_district: str
   }

2. Backend:
   a) Validate JWT token + role (submitter/admin)
   b) Validate file (size, extension)
   c) Upload to Cloudinary
   d) Call risk_engine.assess_image()
      - Run all 6 detection layers
      - Compute risk_score
      - Collect flags
   e) Create ImageRecord in MongoDB
      {
        file_path: str,
        sha256_hash: str,
        phash: str,
        clip_embedding: bytes,
        risk_score: int,
        risk_level: str,
        risk_flags: [...],
        status: 'PENDING_REVIEW',
        submitted_by: str,
        submitted_at: datetime
      }
   f) Return RiskAssessmentResponse

3. Client: Display risk_level badge + detailed flags
   - If HIGH: alert reviewer
   - If MEDIUM: highlight for manual review
   - If LOW: auto-approve option (optional)
```

### Review Workflow
```
1. Reviewer: GET /api/reviews/queue
   - Returns all PENDING_REVIEW images sorted by risk_score (HIGH first)

2. Reviewer: GET /api/reviews/{id}
   - Returns ImageRecord with full details + duplicate matches

3. Reviewer: PATCH /api/reviews/{id}
   {
     decision: 'approve' | 'reject',
     comments: str
   }
   - Updates status: IN_REVIEW → APPROVED | REJECTED
   - Records reviewed_by, review_timestamp, review_comments

4. Stakeholder: GET /api/stakeholder/overview
   - Returns APPROVED images awaiting sign-off

5. Stakeholder: POST /api/stakeholder/{id}/sign-off
   - Updates status: APPROVED → SIGNED_OFF
   - Updates project.status to COMPLETED if all images signed off
```

---

## 9. Workflow Status Diagram

```
PENDING_REVIEW
    ↓ (reviewer action)
IN_REVIEW
    ├─ APPROVED (reviewer approves)
    │      ↓ (stakeholder action)
    │  SIGNED_OFF (stakeholder confirms)
    │      ↓ (project complete if all signed off)
    │  Project.status → COMPLETED
    │
    └─ REJECTED (reviewer rejects)
           ↓ (no sign-off needed)
           Terminal state
```

---

## 10. Known Limitations & Issues

### 1. Synthetic Test Data Problem
- **Issue**: Programmatically-generated test images (solid gradients) cause 100% false positives on CLIP and ELA
- **Impact**: Cannot validate detection accuracy with synthetic corpus
- **Solution**: Needs real photo calibration (data/real_images/ incomplete; requires 30 photos, 3 same-scene pairs, 10 geotagged photos)

### 2. pHash Crop Sensitivity
- **Issue**: Cropping at ~12% per edge (cumulative ~48% area loss) defeats pHash thresholds
- **Impact**: Heavily cropped duplicates may not be detected by Layer 2
- **Workaround**: dHash as fallback (less sensitive to cropping)
- **Root Cause**: Algorithm limitation (DCT on small regions loses low-frequency info)

### 3. Model Loading Latency
- **CLIP**: Lazy-loads ~600 MB on first submission (20-30 second delay)
- **EasyOCR**: Loads ~65 MB on first receipt submission (10-15 second delay)
- **Solution**: Pre-load models on application startup OR run in warm pool

### 4. EXIF Conditional Weighting
- **Issue**: EXIF_STRIPPED flag has context-dependent severity (5 pts alone, 15 pts combined)
- **Current Implementation**: Hardcoded in risk_engine.py
- **Improvement**: Could use machine learning to learn optimal weights from historical approvals/rejections

### 5. BSON ObjectId Handling
- **Issue**: MongoDB `_id` is ObjectId, Pydantic expects string
- **Current Solution**: MongoDocument base class with custom serializer
- **Improvement**: Could use PyObjectId wrapper for cleaner code

### 6. Embedding Dimension Consistency
- **Issue**: CLIP embedding dimension must stay constant (512 for ViT-B/32)
- **Risk**: If model is upgraded or changed, stored embeddings become incompatible
- **Solution**: Add schema migration tool + model version field in ImageRecord

---

## 11. Deployment & Configuration

### Environment Variables
```bash
# MongoDB
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority

# JWT
SECRET_KEY=your_secret_key_here

# Cloudinary
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name

# Google Gemini (for AI summaries)
GEMINI_API_KEY=...

# Feature Flags
ENABLE_CLIP=true
ENABLE_KEYPOINT_MATCH=true
ENABLE_OCR=true
ENABLE_ELA=true
```

### Docker Deployment
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app/ .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Startup Sequence
1. Initialize MongoDB connection
2. Create indexes
3. Load config thresholds
4. (Optional) Pre-load CLIP and EasyOCR models
5. Start FastAPI server on port 8000

---

## 12. Unresolved Questions & Future Work

1. **Real Photo Calibration**: data/real_images/ folder incomplete - needs curated dataset of 30+ real field photos with ground truth duplicates
2. **Model Upgrades**: Need strategy for upgrading CLIP or OCR models without re-processing entire image history
3. **Distributed Processing**: Current risk_engine.assess_image() runs synchronously - could benefit from async task queue (Celery/RabbitMQ) for large-scale deployments
4. **Accuracy Metrics**: No formal confusion matrix or ROC curve analysis - would need labeled test set with ground truth fraud labels
5. **Cross-Scene Detection**: Current CLIP threshold (0.92) may be too strict for recognizing same site across seasons/weather; could benefit from active learning feedback loop
6. **Mobile App Integration**: Frontend is web-only; mobile app submission (iOS/Android) would need camera integration and offline support

---

## 13. Key Takeaways

**Detection Philosophy**:
- **Layered approach**: Each layer catches different fraud patterns (exact, resized, recontextualized, tampered, misreported)
- **Additive scoring**: Multiple weak signals combine into strong evidence
- **Explainability**: Every flag has a reason; reviewers see full breakdown
- **Graceful degradation**: System works even if individual layers fail

**Risk Model**:
- Designed for India's MPLADS context (receipts in regional languages, GPS verification against district boundaries)
- Assumes work images are field photos (EXIF-tagged, natural lighting, high resolution)
- False positive rate traded for recall (better to flag and require review than miss fraud)

**Architecture Strengths**:
- Clear separation of concerns (routes, risk engine, data layer)
- MongoDB flexibility for schema evolution
- Fast exact/perceptual matching via hashes
- Semantic matching via CLIP embeddings
- Robust geometric verification via SIFT+RANSAC

**Architecture Weaknesses**:
- Synchronous risk assessment (no async/queue)
- Single-model deployment (no ensemble)
- No active learning or feedback loop
- Limited multi-modal analysis (text-only OCR, image-only vision)
- No temporal/contextual fraud detection (pattern of submissions, submission timing)

