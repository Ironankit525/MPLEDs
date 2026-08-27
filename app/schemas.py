"""
Pydantic request/response schemas for the MPLADS Image Fraud Detection API.

These models serve triple duty:
  1. Request validation — FastAPI uses them to reject bad input with
     clear error messages instead of raw tracebacks.
  2. Response serialization — ensures every endpoint returns a
     consistent JSON structure.
  3. API documentation — FastAPI's /docs (Swagger UI) renders these
     automatically, so developers can explore the API interactively.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ── Common sub-models ────────────────────────────────────────────────

class FlagResponse(BaseModel):
    """A single anomaly flag with full explainability.

    Every flag carries the raw evidence that triggered it so the
    dashboard can show *why* something was flagged, not just *that*
    it was flagged.
    """
    code: str = Field(..., description="Machine-readable flag code, e.g. 'PERCEPTUAL_DUPLICATE'")
    severity: str = Field(..., description="LOW, MEDIUM, or HIGH")
    message: str = Field(..., description="Human-readable explanation")
    evidence: dict[str, Any] = Field(default_factory=dict, description="Raw values that triggered the flag")
    points_added: int = Field(0, description="Risk score points this flag contributed")


class MatchResponse(BaseModel):
    """A single duplicate match found during search."""
    matched_work_id: str
    matched_district: str
    matched_mp_name: Optional[str] = None
    matched_image_path: str
    similarity_metric: str = Field(..., description="Which layer found this: sha256, phash, dhash, clip")
    raw_score: float = Field(..., description="Raw similarity value (distance or cosine sim)")
    confidence: str = Field(..., description="CERTAIN, LIKELY, or POSSIBLE")
    same_work: bool = False
    cross_work: bool = False
    cross_district: bool = False
    cross_mp: bool = False


class DuplicateReportResponse(BaseModel):
    """Unified report from all duplicate detection layers."""
    exact_matches: list[MatchResponse] = []
    perceptual_matches: list[MatchResponse] = []
    semantic_matches: list[MatchResponse] = []
    has_cross_work_match: bool = False
    has_cross_district_match: bool = False
    has_cross_mp_match: bool = False


# ── Risk assessment ──────────────────────────────────────────────────

class RiskAssessmentResponse(BaseModel):
    """The main output: a fully explainable risk assessment.

    Every point added to the risk_score is traceable to a flag
    in the flags list — no unexplained numbers.
    """
    work_id: str
    risk_score: int = Field(..., ge=0, le=100, description="Aggregate risk score, 0-100")
    risk_level: str = Field(..., description="LOW (0-29), MEDIUM (30-59), HIGH (60-100)")
    recommendation: str = Field(..., description="Human-readable action recommendation")
    flags: list[FlagResponse] = Field(default_factory=list)
    duplicate_report: Optional[DuplicateReportResponse] = None
    semantic_match_score: Optional[float] = Field(None, description="CLIP zero-shot confidence for claimed work type")
    layers_run: list[str] = Field(default_factory=list, description="Detection layers that executed")
    layers_skipped: list[str] = Field(default_factory=list, description="Detection layers that were skipped")
    processing_time_ms: int = Field(0, description="Total processing time in milliseconds")

    # Image metadata
    file_path: Optional[str] = None
    sha256: Optional[str] = None
    phash: Optional[str] = None
    dhash: Optional[str] = None
    gps_coords: Optional[list[float]] = None
    capture_date: Optional[str] = None
    exif_present: Optional[bool] = None


# ── API request models ───────────────────────────────────────────────

class ImageSubmitRequest(BaseModel):
    """Metadata sent alongside the image upload.

    The image itself is sent as a multipart file upload, not in this
    JSON body.  These fields provide the provenance context needed
    for fraud checks.
    """
    work_id: str = Field(..., description="MPLADS work identifier")
    work_type: Optional[str] = Field(None, description="Type of work, e.g. 'road construction'")
    district: str = Field(..., description="District where the work is claimed")
    state: Optional[str] = Field(None, description="State")
    mp_name: Optional[str] = Field(None, description="Name of the recommending MP")
    sanction_date: Optional[datetime] = Field(None, description="When the work was sanctioned")
    claimed_amount: Optional[float] = Field(
        None,
        description=(
            "Claimed expenditure amount, cross-checked against OCR-extracted "
            "amounts (RECEIPT_AMOUNT_MISMATCH) when work_type is "
            "'receipt'/'invoice'/'document'."
        ),
    )


# ── API response models ─────────────────────────────────────────────

class ImageRecordResponse(BaseModel):
    """An image record as returned by the API."""
    id: str
    work_id: str
    work_type: Optional[str] = None
    district: str
    state: Optional[str] = None
    mp_name: Optional[str] = None
    sanction_date: Optional[datetime] = None
    file_path: str
    sha256: str
    phash: str
    dhash: Optional[str] = None
    photo_timestamp: Optional[datetime] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    exif_present: Optional[bool] = None
    submitted_by_username: Optional[str] = Field(
        None, description="Username of the submitter (absent on records stored before this field existed)"
    )
    risk_score: Optional[int] = Field(None, description="Automated risk score snapshot from submit time")
    risk_level: Optional[str] = Field(None, description="LOW/MEDIUM/HIGH snapshot from submit time")
    recommendation: Optional[str] = None
    flags: Optional[list[dict[str, Any]]] = Field(
        None, description="Flags raised at submit time, for the submission's detail/timeline view"
    )
    status: str = Field(
        "PENDING_REVIEW", description="Human review workflow stage: PENDING_REVIEW, IN_REVIEW, APPROVED, REJECTED"
    )
    reviewed_by_username: Optional[str] = Field(None, description="Reviewer who claimed/decided this submission")
    reviewer_notes: Optional[str] = Field(None, description="The reviewer's note, set together with the decision")
    reviewed_at: Optional[datetime] = Field(None, description="When the review decision was made")
    signed_off_by_username: Optional[str] = Field(None, description="Stakeholder who gave final sign-off")
    signoff_notes: Optional[str] = Field(None, description="The stakeholder's note, set together with sign-off")
    signed_off_at: Optional[datetime] = Field(None, description="When final sign-off was given")
    admin_override_by_username: Optional[str] = Field(None, description="Admin who manually changed the status")
    admin_override_previous_status: Optional[str] = None
    admin_override_notes: Optional[str] = None
    admin_override_at: Optional[datetime] = None
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class WorkImagesResponse(BaseModel):
    """All images for a given work ID."""
    work_id: str
    images: list[ImageRecordResponse] = []
    count: int = 0


class SubmissionListResponse(BaseModel):
    """A list of image records with a count — the shape shared by the
    submitter's own history (`GET /api/images/mine`) and the reviewer's
    queue/history (`GET /api/reviews/queue`, `GET /api/reviews/history`).
    """
    images: list[ImageRecordResponse] = []
    count: int = 0


class ReviewDecisionRequest(BaseModel):
    """Body for `POST /api/reviews/{image_id}/decide`."""
    decision: str = Field(..., description="'approve' or 'reject'")
    notes: Optional[str] = Field(None, description="Reviewer's note — required when rejecting")

    @field_validator("decision")
    @classmethod
    def _validate_decision(cls, v: str) -> str:
        if v not in ("approve", "reject"):
            raise ValueError("decision must be 'approve' or 'reject'")
        return v

    @model_validator(mode="after")
    def _require_notes_on_reject(self) -> "ReviewDecisionRequest":
        if self.decision == "reject" and not (self.notes and self.notes.strip()):
            raise ValueError("notes are required when rejecting a submission")
        return self


class SignOffRequest(BaseModel):
    """Body for `POST /api/stakeholder/{image_id}/sign-off`."""
    notes: Optional[str] = Field(None, description="Optional stakeholder note")


class StakeholderOverviewResponse(BaseModel):
    """Aggregate figures for the Stakeholder dashboard: total volume,
    where submissions are sitting in the pipeline (bottlenecks), and
    how quickly they clear it (completion rate, average time-to-decision).
    """
    total_submissions: int = 0
    by_status: dict[str, int] = Field(default_factory=dict)
    by_risk_level: dict[str, int] = Field(default_factory=dict)
    completion_rate: float = Field(0.0, description="% of submissions that have reached a final decision")
    avg_hours_to_decision: Optional[float] = Field(
        None, description="Mean hours between upload and a reviewer's decision, over decided submissions"
    )
    daily_volume: list[dict[str, Any]] = Field(
        default_factory=list, description="[{date, count}] submissions per day, most recent 14 days"
    )
    top_flagged_districts: list[dict[str, Any]] = Field(default_factory=list)


# ── Admin ─────────────────────────────────────────────────────────────

class AdminUserCreate(BaseModel):
    """Body for `POST /api/admin/users` — unlike public /api/auth/register,
    an admin picks the role directly."""
    username: str
    password: str
    role: str
    agency_name: Optional[str] = None
    district: Optional[str] = None

    @field_validator("role")
    @classmethod
    def _validate_role(cls, v: str) -> str:
        from app.models import USER_ROLES

        if v not in USER_ROLES:
            raise ValueError(f"role must be one of: {', '.join(USER_ROLES)}")
        return v


class AdminUserResponse(BaseModel):
    """A user as returned by the admin user-management endpoints —
    never includes password_hash."""
    id: str
    username: str
    agency_name: Optional[str] = None
    district: Optional[str] = None
    role: str
    is_active: bool = True
    created_at: Optional[datetime] = Field(
        None, description="Absent on accounts registered before this field existed"
    )

    model_config = {"from_attributes": True}


class AdminUserListResponse(BaseModel):
    users: list[AdminUserResponse] = []
    count: int = 0


class UserRoleUpdateRequest(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def _validate_role(cls, v: str) -> str:
        from app.models import USER_ROLES

        if v not in USER_ROLES:
            raise ValueError(f"role must be one of: {', '.join(USER_ROLES)}")
        return v


class UserActiveUpdateRequest(BaseModel):
    is_active: bool


class StatusOverrideRequest(BaseModel):
    """Body for the admin single-submission status override."""
    status: str
    notes: Optional[str] = Field(None, description="Why this was manually overridden")

    @field_validator("status")
    @classmethod
    def _validate_status(cls, v: str) -> str:
        from app.models import WORKFLOW_STATUSES

        if v not in WORKFLOW_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(WORKFLOW_STATUSES)}")
        return v


class BulkStatusOverrideRequest(BaseModel):
    """Body for the admin bulk status override — the "bulk-action
    checkboxes" from the original role matrix, applied to a manual
    status correction since that's the one write action Admin has that
    naturally generalises to many rows at once."""
    image_ids: list[str] = Field(..., min_length=1)
    status: str
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def _validate_status(cls, v: str) -> str:
        from app.models import WORKFLOW_STATUSES

        if v not in WORKFLOW_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(WORKFLOW_STATUSES)}")
        return v


class BulkStatusOverrideResponse(BaseModel):
    updated_count: int
    not_found_ids: list[str] = Field(default_factory=list)


class ActivityEvent(BaseModel):
    """One row in the Admin activity log — a real event derived from
    ImageRecord's own attribution fields (who submitted/reviewed/signed
    off/overrode, and when), not a general application log. There is no
    persistent application-log store in this project (see README); this
    is deliberately scoped to user actions the database already records,
    not a claim that server/error logs are captured here too."""
    type: str = Field(..., description="submitted | in_review | approved | rejected | signed_off | admin_override")
    work_id: str
    image_id: str
    actor: Optional[str] = None
    at: datetime
    detail: Optional[str] = None


class ActivityLogResponse(BaseModel):
    events: list[ActivityEvent] = []
    count: int = 0


class DuplicateCluster(BaseModel):
    """A cluster of images that are duplicates of each other."""
    cluster_id: int
    images: list[ImageRecordResponse] = []
    match_type: str = Field(..., description="Type of match: exact, perceptual, semantic")


class DuplicatesResponse(BaseModel):
    """All detected duplicate clusters across the database."""
    clusters: list[DuplicateCluster] = []
    total_clusters: int = 0


class StatsResponse(BaseModel):
    """Aggregate statistics across the database."""
    total_images: int = 0
    by_risk_level: dict[str, int] = Field(default_factory=dict)
    top_flagged_districts: list[dict[str, Any]] = Field(default_factory=list)
    duplicate_clusters: int = 0


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    database: str = "connected"
    clip_loaded: bool = False
    clip_model: Optional[str] = None
    total_images: int = 0


class ErrorResponse(BaseModel):
    """Standardised error response."""
    detail: str
    error_code: Optional[str] = None


# ── Auth & Sessions (Phase 2) ────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    password: str
    agency_name: str
    district: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = Field(
        "submitter",
        description="The account's role, so the frontend can route to the right dashboard without a second call",
    )


class UserProfileResponse(BaseModel):
    """The logged-in user's own profile (`GET /api/auth/me`)."""
    username: str
    agency_name: Optional[str] = None
    district: Optional[str] = None
    role: str = "submitter"


class SessionCreateResponse(BaseModel):
    session_id: str
    token: str
    expires_at: datetime


class SessionValidateRequest(BaseModel):
    token: str


class SessionValidateResponse(BaseModel):
    valid: bool
    reason: Optional[str] = None
