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
    similarity_metric: str = Field(..., description="Which layer found this: sha256, phash, dhash, tiled_phash, clip, orb")
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
    geometric_matches: list[MatchResponse] = Field(
        default_factory=list,
        description="ORB+RANSAC homography-verified matches (Layer 6); raw_score is the inlier count",
    )
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
    verification_status: str = Field(
        ...,
        description=(
            "Evidence state: VERIFIED, INSUFFICIENT_EVIDENCE, or "
            "REQUIRES_REVIEW. A LOW/0 risk score is not sufficient by itself."
        ),
    )
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
    screen_probability: Optional[float] = Field(
        None, description="ML probability that the upload is a rendered screen capture"
    )
    screen_model_name: Optional[str] = Field(None, description="Screen-capture model identifier/version")
    work_evidence_status: str = Field(
        "UNAVAILABLE", description="VALID, REVIEW, INVALID, UNAVAILABLE, or NOT_APPLICABLE"
    )
    work_evidence_probability: Optional[float] = Field(
        None, description="ML probability that the image is plausible local project evidence"
    )
    work_evidence_label: Optional[str] = Field(None, description="Top visual-evidence classification category")
    work_evidence_model_name: Optional[str] = Field(None, description="Visual-evidence model identifier/version")


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
    captured_latitude: Optional[float] = None
    captured_longitude: Optional[float] = None
    geolocation_accuracy: Optional[float] = None
    capture_timestamp: Optional[datetime] = None
    facing_mode: Optional[str] = None
    exif_present: Optional[bool] = None
    submitted_by_username: Optional[str] = Field(
        None, description="Username of the submitter (absent on records stored before this field existed)"
    )
    risk_score: Optional[int] = Field(None, description="Automated risk score snapshot from submit time")
    risk_level: Optional[str] = Field(None, description="LOW/MEDIUM/HIGH snapshot from submit time")
    verification_status: Optional[str] = Field(
        None,
        description="Evidence state at submit time: VERIFIED, INSUFFICIENT_EVIDENCE, or REQUIRES_REVIEW",
    )
    screen_probability: Optional[float] = Field(None, description="Screen-capture ML probability at submit time")
    screen_model_name: Optional[str] = Field(None, description="Screen-capture model identifier/version")
    work_evidence_status: Optional[str] = Field(None, description="Project-evidence validity state at submit time")
    work_evidence_probability: Optional[float] = Field(None, description="Project-evidence probability at submit time")
    work_evidence_label: Optional[str] = Field(None, description="Top project-evidence classifier label")
    work_evidence_model_name: Optional[str] = Field(None, description="Project-evidence model identifier/version")
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


# ── Projects & Submitter dashboard ────────────────────────────────────

class ProjectPhaseSchema(BaseModel):
    """One milestone. `is_complete` is set by a reviewer/admin, never by
    the contractor whose payment depends on it — see app/models.py's
    ProjectPhase docstring."""

    name: str
    order: int = 0
    is_complete: bool = False
    completed_at: Optional[datetime] = None
    completed_by_username: Optional[str] = None


class ProjectCreateRequest(BaseModel):
    """Body for `POST /api/admin/projects` — registering a sanctioned
    work and (optionally) awarding it to a contractor."""

    work_id: str = Field(..., description="MPLADS work identifier — the join key to ImageRecord.work_id")
    title: str
    district: str
    sanctioned_amount: float = Field(..., ge=0, description="Total budget for this work")
    work_type: Optional[str] = None
    state: Optional[str] = None
    mp_name: Optional[str] = None
    assigned_to_username: Optional[str] = Field(
        None, description="Contractor/submitter this work is awarded to. Unassigned projects appear on no submitter dashboard."
    )
    sanction_date: Optional[datetime] = None
    expected_completion_date: Optional[datetime] = None
    phase_names: list[str] = Field(
        default_factory=list,
        description="Milestone names in execution order; progress_percent is completed/total of these.",
    )


class ProjectAssignRequest(BaseModel):
    assigned_to_username: Optional[str] = Field(
        None, description="Set to null to unassign the work."
    )


class ProjectStatusUpdateRequest(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def _validate_status(cls, v: str) -> str:
        from app.models import PROJECT_STATUSES

        if v not in PROJECT_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(PROJECT_STATUSES)}")
        return v


class PhaseCompleteRequest(BaseModel):
    """Body for `PATCH /api/projects/{work_id}/phases/{order}` —
    reviewer/admin only."""

    is_complete: bool = True


class ProjectFinancials(BaseModel):
    """The money figures for one project (or a portfolio rollup).

    Buckets are defined by the *submission status* of each claim, so a
    rejected or still-pending claim never silently counts as spent:

      amount_utilised   = APPROVED + SIGNED_OFF   ("funds used")
      amount_disbursed  = SIGNED_OFF only          ("funds released")
      amount_pending_disbursement = APPROVED, not yet signed off
      amount_awaiting_decision    = PENDING_REVIEW + IN_REVIEW
      amount_rejected             = REJECTED (does NOT reduce the budget)
      amount_remaining  = sanctioned - amount_utilised

    Note amount_utilised == amount_disbursed + amount_pending_disbursement
    by construction; they are reported separately because "approved" and
    "actually released" are different things to a contractor chasing
    payment. Only amount_utilised is subtracted from the budget.
    """

    sanctioned_amount: float = 0.0
    amount_utilised: float = 0.0
    amount_disbursed: float = 0.0
    amount_pending_disbursement: float = 0.0
    amount_awaiting_decision: float = 0.0
    amount_rejected: float = 0.0
    amount_remaining: float = 0.0
    utilisation_percent: float = Field(
        0.0, description="amount_utilised / sanctioned_amount * 100; 0.0 when the budget is 0"
    )


class ProjectSummaryResponse(BaseModel):
    """One project as shown on the contractor's project list."""

    work_id: str
    title: str
    work_type: Optional[str] = None
    district: str
    status: str
    assigned_to_username: Optional[str] = None

    financials: ProjectFinancials

    phases: list[ProjectPhaseSchema] = Field(default_factory=list)
    progress_percent: float = Field(
        0.0,
        description=(
            "Completed phases / total phases * 100. When a project has NO phases "
            "defined, this falls back to 100 for COMPLETED and 0 otherwise — see "
            "progress_basis to tell which of the two you're looking at."
        ),
    )
    progress_basis: str = Field(
        "phases", description="'phases' (milestone-derived) or 'status' (no phases defined — coarse fallback)"
    )

    sanction_date: Optional[datetime] = None
    expected_completion_date: Optional[datetime] = None
    is_overdue: bool = False
    days_remaining: Optional[int] = Field(
        None, description="Days until expected_completion_date; negative when overdue, null when no date set"
    )

    total_submissions: int = 0
    submissions_by_status: dict[str, int] = Field(default_factory=dict)
    flagged_submissions: int = Field(0, description="Submissions whose automated risk_level was MEDIUM or HIGH")


class ProjectListResponse(BaseModel):
    projects: list[ProjectSummaryResponse] = Field(default_factory=list)
    count: int = 0


class DeadlineItem(BaseModel):
    work_id: str
    title: str
    expected_completion_date: datetime
    days_remaining: int
    is_overdue: bool


class ActionRequiredItem(BaseModel):
    """A rejected submission the contractor needs to do something about.

    `reason` is the reviewer's own note — the human explanation — not the
    detector's internal evidence.
    """

    image_id: str
    work_id: str
    uploaded_at: datetime
    reviewed_at: Optional[datetime] = None
    reason: Optional[str] = None


class DashboardSummaryResponse(BaseModel):
    """Everything on the contractor/submitter's landing dashboard, in one
    call — portfolio finances, project counts, and compliance standing.

    Scoped to the logged-in submitter: only projects assigned to them and
    only submissions they uploaded.
    """

    # ── Money ────────────────────────────────────────────────────────
    financials: ProjectFinancials

    # ── Portfolio ────────────────────────────────────────────────────
    projects_assigned: int = 0
    projects_completed: int = 0
    projects_in_progress: int = 0
    projects_not_started: int = 0
    projects_cancelled: int = 0
    projects_overdue: int = 0
    overall_progress_percent: float = Field(
        0.0, description="Mean of each assigned project's progress_percent (unweighted)"
    )

    # ── Compliance standing ──────────────────────────────────────────
    total_submissions: int = 0
    submissions_by_status: dict[str, int] = Field(default_factory=dict)
    flagged_submissions: int = 0
    action_required_count: int = Field(0, description="Rejected submissions needing resubmission")
    approval_rate: float = Field(
        0.0, description="% of decided submissions that were approved; 0.0 when none are decided yet"
    )
    average_risk_score: Optional[float] = Field(
        None, description="Mean automated risk score across this submitter's submissions"
    )
    flag_reasons: dict[str, int] = Field(
        default_factory=dict,
        description=(
            "Counts of plain-language flag categories. Deliberately NOT the raw "
            "detector codes or their numeric evidence — see app/main.py's "
            "_PUBLIC_FLAG_LABELS for why."
        ),
    )

    # ── What to do next ──────────────────────────────────────────────
    action_required: list[ActionRequiredItem] = Field(default_factory=list)
    upcoming_deadlines: list[DeadlineItem] = Field(default_factory=list)

    # ── Data-quality caveat ──────────────────────────────────────────
    unbudgeted_submission_count: int = Field(
        0,
        description=(
            "Submissions whose work_id has no Project document, so their claimed "
            "amounts are counted in no budget. Non-zero means projects need registering."
        ),
    )


class AISummaryResponse(BaseModel):
    """Narrative summary of the overview figures, drafted by an LLM
    (`GET /api/stakeholder/ai-summary`). `available=False` means the
    feature is unconfigured or the generation call failed — the client
    should render the numeric dashboard without a summary, not an error.
    """
    available: bool
    summary: Optional[str] = Field(None, description="Two paragraphs of plain prose; None when unavailable")
    model: Optional[str] = Field(None, description="Model that drafted the text, e.g. gemini-2.5-flash")
    generated_at: Optional[datetime] = Field(None, description="When this response was produced")
    cached: bool = Field(False, description="True when reused from the in-process cache (same figures)")
    reason: Optional[str] = Field(
        None, description="Why unavailable: 'not_configured' or 'generation_failed'"
    )


class AIReportTurn(BaseModel):
    """One visible message in the AI-report conversation, replayed to the
    model so follow-up questions resolve against earlier answers."""
    role: str = Field(description="'user' or 'assistant'")
    text: str

    @field_validator("role")
    @classmethod
    def _validate_role(cls, v: str) -> str:
        if v not in ("user", "assistant"):
            raise ValueError("role must be 'user' or 'assistant'")
        return v


class AIReportRequest(BaseModel):
    """Body for `POST /api/stakeholder/ai-report`."""
    question: str = Field(min_length=1, max_length=2000)
    history: list[AIReportTurn] = Field(
        default_factory=list, description="The visible conversation so far, oldest first"
    )


class AIReportResponse(BaseModel):
    """One grounded answer for the stakeholder AI-report page. Same
    availability contract as AISummaryResponse: `available=False` means
    unconfigured or the generation call failed, never an HTTP error."""
    available: bool
    answer: Optional[str] = None
    model: Optional[str] = None
    generated_at: Optional[datetime] = None
    reason: Optional[str] = Field(
        None, description="Why unavailable: 'not_configured' or 'generation_failed'"
    )


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
    visual_model_status: str = "not_loaded"
    visual_model_required: bool = True
    visual_model_name: Optional[str] = None
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
