"""
FastAPI application for the MPLADS Image Fraud Detection Module.

Provides a REST API for:
  - Checking an image against the database (dry run, no storage)
  - Submitting an image (assess + store)
  - Querying images by work ID
  - Viewing detected duplicate clusters
  - Aggregate statistics
  - Health check

All responses use Pydantic models so the auto-generated /docs (Swagger UI)
renders with full schema documentation.
"""

import dataclasses
import logging
import shutil
import uuid
import cloudinary
import cloudinary.uploader
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pymongo.database import Database

from app.config import settings, IMAGES_DIR
from app.database import get_db, init_db
from app.embeddings import get_clip_engine
from app.hashing import ImageProcessingError
from app.models import (
    ImageRecord,
    CameraSession,
    User,
    ROLE_SUBMITTER,
    ROLE_REVIEWER,
    ROLE_STAKEHOLDER,
    ROLE_ADMIN,
    STATUS_PENDING_REVIEW,
    STATUS_IN_REVIEW,
    STATUS_APPROVED,
    STATUS_REJECTED,
    STATUS_SIGNED_OFF,
    FINAL_STAGE_STATUSES,
    WORKFLOW_STATUSES,
    PROJECT_NOT_STARTED,
    PROJECT_IN_PROGRESS,
    PROJECT_COMPLETED,
    PROJECT_CANCELLED,
    PROJECT_STATUSES,
)
from app.auth import get_current_user, create_access_token, get_password_hash, verify_password, require_role
from app.report_summary import (
    generate_admin_summary,
    generate_overview_summary,
    generate_reviewer_summary,
)
from app.risk_engine import assess_image, RiskAssessment, ScoredFlag
from app.schemas import (
    ActionRequiredItem,
    ActivityEvent,
    ActivityLogResponse,
    AdminUserCreate,
    AISummaryResponse,
    AdminUserListResponse,
    AdminUserResponse,
    BulkStatusOverrideRequest,
    BulkStatusOverrideResponse,
    DashboardSummaryResponse,
    DeadlineItem,
    DuplicateCluster,
    PhaseCompleteRequest,
    ProjectAssignRequest,
    ProjectCreateRequest,
    ProjectFinancials,
    ProjectListResponse,
    ProjectPhaseSchema,
    ProjectStatusUpdateRequest,
    ProjectSummaryResponse,
    DuplicatesResponse,
    ErrorResponse,
    FlagResponse,
    HealthResponse,
    ImageRecordResponse,
    MatchResponse,
    DuplicateReportResponse,
    ReviewDecisionRequest,
    RiskAssessmentResponse,
    SignOffRequest,
    StakeholderOverviewResponse,
    StatsResponse,
    StatusOverrideRequest,
    SubmissionListResponse,
    UserActiveUpdateRequest,
    UserRoleUpdateRequest,
    WorkImagesResponse,
    UserCreate,
    TokenResponse,
    UserProfileResponse,
    SessionCreateResponse,
    SessionValidateRequest,
    SessionValidateResponse,
)

# ── Logging ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── App initialisation ──────────────────────────────────────────────
app = FastAPI(
    title="MPLADS Image Fraud Detection API",
    description=(
        "Multi-layer fraud detection for MPLADS work-completion photographs. "
        "Detects exact duplicates, perceptual duplicates (resized/cropped), "
        "semantic duplicates (same scene, different angle), EXIF anomalies, "
        "GPS mismatches, and content-type mismatches."
    ),
    version="1.0.0",
    responses={422: {"model": ErrorResponse}},
)

# ── CORS ─────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    """Initialise the database on application startup."""
    init_db()
    if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET:
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True
        )
        logger.info("Cloudinary storage configured.")
    logger.info("MPLADS Image Fraud Detection API started.")


# ── Helpers ──────────────────────────────────────────────────────────

def _validate_upload(file: UploadFile) -> None:
    """Validate file size and extension before processing.

    Raises HTTPException with 422 status for invalid uploads.
    """
    # Check extension
    if file.filename:
        ext = Path(file.filename).suffix.lower()
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Invalid file type '{ext}'. "
                    f"Allowed types: {', '.join(settings.ALLOWED_EXTENSIONS)}"
                ),
            )

    # Check file size (read content-length header if available)
    if file.size is not None and file.size > settings.MAX_UPLOAD_SIZE_BYTES:
        max_mb = settings.MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)
        raise HTTPException(
            status_code=422,
            detail=f"File too large ({file.size / (1024*1024):.1f} MB). Maximum size is {max_mb:.0f} MB.",
        )


def _save_upload(file: UploadFile) -> Path:
    """Save an uploaded file to data/images/ with a UUID filename.

    Preserves the original extension for content-type handling.

    Returns:
        Path to the saved file.
    """
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    dest = IMAGES_DIR / filename

    with open(dest, "wb") as out:
        shutil.copyfileobj(file.file, out)

    return dest


def _assessment_to_response(assessment: RiskAssessment) -> RiskAssessmentResponse:
    """Convert internal RiskAssessment to the API response schema."""
    flags = [
        FlagResponse(
            code=f.code,
            severity=f.severity,
            message=f.message,
            evidence=f.evidence,
            points_added=f.points_added,
        )
        for f in assessment.flags
    ]

    # Convert duplicate report
    dup_response = None
    if assessment.duplicate_report:
        dr = assessment.duplicate_report
        dup_response = DuplicateReportResponse(
            exact_matches=[
                MatchResponse(
                    matched_work_id=m.matched_record.work_id,
                    matched_district=m.matched_record.district,
                    matched_mp_name=m.matched_record.mp_name,
                    matched_image_path=m.matched_record.file_path or "",
                    similarity_metric=m.similarity_metric,
                    raw_score=m.raw_score,
                    confidence=m.confidence,
                    same_work=m.same_work,
                    cross_work=m.cross_work,
                    cross_district=m.cross_district,
                    cross_mp=m.cross_mp,
                )
                for m in dr.exact_matches
            ],
            perceptual_matches=[
                MatchResponse(
                    matched_work_id=m.matched_record.work_id,
                    matched_district=m.matched_record.district,
                    matched_mp_name=m.matched_record.mp_name,
                    matched_image_path=m.matched_record.file_path or "",
                    similarity_metric=m.similarity_metric,
                    raw_score=m.raw_score,
                    confidence=m.confidence,
                    same_work=m.same_work,
                    cross_work=m.cross_work,
                    cross_district=m.cross_district,
                    cross_mp=m.cross_mp,
                )
                for m in dr.perceptual_matches
            ],
            semantic_matches=[
                MatchResponse(
                    matched_work_id=m.matched_record.work_id,
                    matched_district=m.matched_record.district,
                    matched_mp_name=m.matched_record.mp_name,
                    matched_image_path=m.matched_record.file_path or "",
                    similarity_metric=m.similarity_metric,
                    raw_score=m.raw_score,
                    confidence=m.confidence,
                    same_work=m.same_work,
                    cross_work=m.cross_work,
                    cross_district=m.cross_district,
                    cross_mp=m.cross_mp,
                )
                for m in dr.semantic_matches
            ],
            has_cross_work_match=dr.has_cross_work_match,
            has_cross_district_match=dr.has_cross_district_match,
            has_cross_mp_match=dr.has_cross_mp_match,
        )

    return RiskAssessmentResponse(
        work_id=assessment.work_id,
        risk_score=assessment.risk_score,
        risk_level=assessment.risk_level,
        recommendation=assessment.recommendation,
        flags=flags,
        duplicate_report=dup_response,
        semantic_match_score=assessment.semantic_match_score,
        layers_run=assessment.layers_run,
        layers_skipped=assessment.layers_skipped,
        processing_time_ms=assessment.processing_time_ms,
        file_path=assessment.file_path,
        sha256=assessment.sha256,
        phash=assessment.phash,
        dhash=assessment.dhash,
        gps_coords=assessment.gps_coords,
        capture_date=assessment.capture_date,
        exif_present=assessment.exif_present,
    )


def _record_to_response(r: dict) -> ImageRecordResponse:
    """Convert a raw Mongo image_records document to the API schema.

    ``ImageRecordResponse.id`` is a plain ``str`` field (not aliased to
    ``_id`` the way ``MongoDocument`` subclasses are), so a raw find()
    document — which carries ``_id`` as a ``bson.ObjectId`` — has to be
    normalised before it validates. Every read of image_records shares
    this conversion instead of each call site remembering to do it.
    """
    doc = dict(r)
    doc["id"] = str(doc.pop("_id"))
    return ImageRecordResponse(**doc)


def _store_image_record(
    assessment: RiskAssessment,
    work_id: str,
    work_type: str | None,
    district: str,
    state: str | None,
    mp_name: str | None,
    sanction_date: datetime | None,
    local_file_path: str,
    storage_path: str,
    session: Database,
    current_user: dict,
    claimed_amount: float | None = None,
    captured_latitude: float | None = None,
    captured_longitude: float | None = None,
    geolocation_accuracy: float | None = None,
    capture_timestamp: datetime | None = None,
    facing_mode: str | None = None,
    session_token: str | None = None,
) -> ImageRecord:
    """Create and persist an ImageRecord from the assessment results."""
    import json

    import numpy as np
    from app.exif_analysis import extract_gps, extract_capture_datetime
    from app.hashing import compute_tiled_phashes, ImageProcessingError

    # Serialize embedding if available
    embedding_bytes = None
    if assessment.duplicate_report is not None:
        # The embedding was computed during assessment; re-compute or
        # retrieve from the engine
        clip_engine = get_clip_engine()
        emb = clip_engine.embed_image(local_file_path)
        if emb is not None:
            embedding_bytes = emb.tobytes()

    # Tiled pHashes (Round 3, Task 2.3) — only computed/stored when the
    # feature is enabled. Stored records need these persisted so future
    # candidates can be compared against them without re-reading files.
    tile_phashes_json = None
    if settings.ENABLE_TILED_HASH:
        try:
            tile_phashes_json = json.dumps(compute_tiled_phashes(local_file_path))
        except ImageProcessingError as e:
            logger.warning("Tiled pHash computation failed for storage: %s", e)

    gps = extract_gps(local_file_path)
    capture_dt = extract_capture_datetime(local_file_path)

    record_dict = {
        "work_id": work_id,
        "work_type": work_type,
        "district": district,
        "state": state,
        "mp_name": mp_name,
        "sanction_date": sanction_date,
        "claimed_amount": claimed_amount,
        "file_path": storage_path,
        "sha256": assessment.sha256 or "",
        "phash": assessment.phash or "",
        "dhash": assessment.dhash,
        "embedding": embedding_bytes,
        "tile_phashes": tile_phashes_json,
        "photo_timestamp": capture_dt,
        "gps_latitude": gps[0] if gps else None,
        "gps_longitude": gps[1] if gps else None,
        "exif_present": assessment.exif_present,
        "captured_latitude": captured_latitude,
        "captured_longitude": captured_longitude,
        "geolocation_accuracy": geolocation_accuracy,
        "capture_timestamp": capture_timestamp,
        "facing_mode": facing_mode,
        "session_token": session_token,
        "submitted_by_user_id": current_user.get("id"),
        "submitted_by_username": current_user.get("username"),
        # Snapshot of the assessment already computed above — persisted
        # so the submitter's history/detail view can show a risk badge
        # and flag list without re-running detection later.
        "risk_score": assessment.risk_score,
        "risk_level": assessment.risk_level,
        "recommendation": assessment.recommendation,
        "flags": [dataclasses.asdict(f) for f in assessment.flags],
        "status": STATUS_PENDING_REVIEW,
        "uploaded_at": datetime.utcnow(),
    }
    result = session.image_records.insert_one(record_dict)
    record_dict["_id"] = str(result.inserted_id)
    return ImageRecord(**record_dict)


# ── Endpoints ────────────────────────────────────────────────────────

@app.post(
    "/api/images/check",
    response_model=RiskAssessmentResponse,
    summary="Check an image (dry run)",
    description="Upload and assess an image against the database WITHOUT storing it.",
)
async def check_image(
    file: UploadFile = File(...),
    work_id: str = Form(...),
    district: str = Form(...),
    work_type: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    mp_name: Optional[str] = Form(None),
    sanction_date: Optional[str] = Form(None),
    claimed_amount: Optional[float] = Form(None),
    # Accepted here too so the dry run genuinely mirrors /submit — without
    # these, /check would report GPS_MISSING on a submission that /submit
    # would score fine, which defeats the point of a preview.
    captured_latitude: Optional[float] = Form(None),
    captured_longitude: Optional[float] = Form(None),
    geolocation_accuracy: Optional[float] = Form(None),
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_SUBMITTER, ROLE_ADMIN)),
) -> RiskAssessmentResponse:
    """Upload + assess an image without storing it.  Dry run."""
    _validate_upload(file)

    # Save temporarily for processing
    saved_path = _save_upload(file)
    try:
        parsed_date = None
        if sanction_date:
            try:
                parsed_date = datetime.fromisoformat(sanction_date)
            except ValueError:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid sanction_date format: '{sanction_date}'. Use ISO format (YYYY-MM-DD).",
                )

        assessment = assess_image(
            image_path=str(saved_path),
            work_id=work_id,
            work_type=work_type,
            district=district,
            state=state,
            mp_name=mp_name,
            sanction_date=parsed_date,
            session=db,
            claimed_amount=claimed_amount,
            captured_latitude=captured_latitude,
            captured_longitude=captured_longitude,
            geolocation_accuracy=geolocation_accuracy,
        )
        return _assessment_to_response(assessment)
    except ImageProcessingError as e:
        raise HTTPException(status_code=422, detail=str(e))
    finally:
        # Clean up — dry run, don't store
        if saved_path.exists():
            saved_path.unlink()


@app.post(
    "/api/images/submit",
    response_model=RiskAssessmentResponse,
    summary="Submit an image",
    description="Upload, assess, AND store an image in the database.",
)
async def submit_image(
    file: UploadFile = File(...),
    work_id: str = Form(...),
    district: str = Form(...),
    work_type: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    mp_name: Optional[str] = Form(None),
    sanction_date: Optional[str] = Form(None),
    claimed_amount: Optional[float] = Form(None),
    captured_latitude: Optional[float] = Form(None),
    captured_longitude: Optional[float] = Form(None),
    geolocation_accuracy: Optional[float] = Form(None),
    capture_timestamp: Optional[str] = Form(None),
    facing_mode: Optional[str] = Form(None),
    session_token: Optional[str] = Form(None),
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_SUBMITTER, ROLE_ADMIN)),
) -> RiskAssessmentResponse:
    """Upload, assess, AND store an image in the database."""
    _validate_upload(file)

    saved_path = _save_upload(file)
    try:
        parsed_date = None
        if sanction_date:
            try:
                parsed_date = datetime.fromisoformat(sanction_date)
            except ValueError:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid sanction_date format: '{sanction_date}'. Use ISO format (YYYY-MM-DD).",
                )

        assessment = assess_image(
            image_path=str(saved_path),
            work_id=work_id,
            work_type=work_type,
            district=district,
            state=state,
            mp_name=mp_name,
            sanction_date=parsed_date,
            session=db,
            claimed_amount=claimed_amount,
            captured_latitude=captured_latitude,
            captured_longitude=captured_longitude,
            geolocation_accuracy=geolocation_accuracy,
        )

        # Check and consume the session token if provided
        if session_token:
            cam_session = db.sessions.find_one({"token": session_token})
            if not cam_session:
                raise HTTPException(status_code=400, detail="Invalid session token.")
            if cam_session.get("is_used"):
                raise HTTPException(status_code=400, detail="Session token already used.")
            if cam_session.get("expires_at") < datetime.utcnow():
                raise HTTPException(status_code=400, detail="Session token expired.")
            db.sessions.update_one({"_id": cam_session["_id"]}, {"$set": {"is_used": True}})

        parsed_capture_ts = None
        if capture_timestamp:
            try:
                parsed_capture_ts = datetime.fromisoformat(capture_timestamp.replace('Z', '+00:00'))
            except ValueError:
                pass

        # Upload to Cloudinary if configured
        final_storage_path = str(saved_path)
        if settings.CLOUDINARY_CLOUD_NAME:
            try:
                upload_res = cloudinary.uploader.upload(str(saved_path))
                final_storage_path = upload_res.get("secure_url")
            except Exception as e:
                logger.error(f"Cloudinary upload failed: {e}")

        # Store the image record
        _store_image_record(
            assessment=assessment,
            work_id=work_id,
            work_type=work_type,
            district=district,
            state=state,
            mp_name=mp_name,
            sanction_date=parsed_date,
            local_file_path=str(saved_path),
            storage_path=final_storage_path,
            session=db,
            current_user=current_user,
            claimed_amount=claimed_amount,
            captured_latitude=captured_latitude,
            captured_longitude=captured_longitude,
            geolocation_accuracy=geolocation_accuracy,
            capture_timestamp=parsed_capture_ts,
            facing_mode=facing_mode,
            session_token=session_token,
        )

        return _assessment_to_response(assessment)
    except ImageProcessingError as e:
        # Clean up on error
        if saved_path.exists():
            saved_path.unlink()
        raise HTTPException(status_code=422, detail=str(e))
    finally:
        # Clean up local temporary file if it was successfully uploaded to Cloudinary
        if settings.CLOUDINARY_CLOUD_NAME and saved_path.exists():
            saved_path.unlink()


@app.get(
    "/api/images/mine",
    response_model=SubmissionListResponse,
    summary="Get my submissions",
    description="All images the logged-in user has submitted, most recent first — the Submitter dashboard's upload history.",
)
async def get_my_submissions(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> SubmissionListResponse:
    """Own-files-only upload history for the Submitter role.

    Filters on submitted_by_user_id rather than username so a rename
    (if that's ever added) wouldn't silently orphan someone's history.
    Records stored before this field existed (submitted_by_user_id is
    None) are intentionally excluded — they have no owner to attribute
    them to, so showing them under any user's history would be wrong.

    Registered BEFORE /api/images/{work_id} — Starlette matches routes
    in registration order, and a literal path has to come before a
    path-parameter route it would otherwise be swallowed by (a request
    for /api/images/mine would otherwise bind work_id="mine").
    """
    records = list(
        db.image_records.find({"submitted_by_user_id": current_user["id"]}).sort("uploaded_at", -1)
    )
    images = [_record_to_response(r) for r in records]
    return SubmissionListResponse(images=images, count=len(images))


@app.get(
    "/api/images/{work_id}",
    response_model=WorkImagesResponse,
    summary="Get images for a work ID",
    description="All images for a work ID. A Submitter sees only their own; Reviewer/Stakeholder/Admin see every submission for the work.",
)
async def get_work_images(
    work_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> WorkImagesResponse:
    """Get images for a work ID, scoped to what the caller may see.

    This used to return every image for the work_id to ANY authenticated
    caller, which leaked one agency's evidence (its Cloudinary URL, the
    submitting officer's username, GPS, and the full risk assessment) to
    an unrelated Submitter who merely guessed or enumerated a work ID —
    work IDs are predictable, sequential-looking strings like
    MP-PUN-2024-0231. Row 2 of the role matrix is explicit that a
    Submitter sees "own files only", so the filter is applied here
    rather than trusting the caller not to ask.
    """
    query: dict = {"work_id": work_id}
    if current_user.get("role", ROLE_SUBMITTER) == ROLE_SUBMITTER:
        query["submitted_by_user_id"] = current_user["id"]

    records = list(db.image_records.find(query))

    images = [_record_to_response(r) for r in records]
    return WorkImagesResponse(
        work_id=work_id,
        images=images,
        count=len(images),
    )


# ── Reviewer workflow ────────────────────────────────────────────────
# The Reviewer role (District/Nodal Verification Officer) claims a
# submission out of a shared queue, then approves or rejects it. There
# is no per-reviewer assignment mechanism (that would need workload
# distribution logic this module doesn't have) — "assigned" in the
# original role matrix is implemented as a shared queue instead: any
# reviewer can see and claim anything in it, and claiming records who
# has it so a second reviewer sees that it's taken (and gets a 409 if
# they try to claim it too) rather than two people working the same
# submission blind. The automated risk_score/risk_level/flags are never
# edited by a reviewer — reviewer_notes is a separate field precisely
# so the original evidence and the human's read on it don't collide.


def _object_id_or_404(id_str: str, not_found_detail: str = "Submission not found.") -> ObjectId:
    try:
        return ObjectId(id_str)
    except InvalidId:
        raise HTTPException(status_code=404, detail=not_found_detail)


def _user_to_response(u: dict) -> AdminUserResponse:
    """Normalises a raw users document for the admin endpoints: `_id` ->
    `id`, password_hash dropped, and legacy-document defaults filled in
    (role/is_active weren't always set — see register()'s comment)."""
    doc = dict(u)
    doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    doc.setdefault("role", ROLE_SUBMITTER)
    doc.setdefault("is_active", True)
    return AdminUserResponse(**doc)


@app.get(
    "/api/reviews/queue",
    response_model=SubmissionListResponse,
    summary="Get the review queue",
    description="Submissions awaiting a decision (PENDING_REVIEW or IN_REVIEW), highest risk first — the Reviewer dashboard's worklist.",
)
async def get_review_queue(
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_REVIEWER)),
) -> SubmissionListResponse:
    records = list(
        db.image_records.find({"status": {"$in": [STATUS_PENDING_REVIEW, STATUS_IN_REVIEW]}}).sort(
            [("risk_score", -1), ("uploaded_at", 1)]
        )
    )
    images = [_record_to_response(r) for r in records]
    return SubmissionListResponse(images=images, count=len(images))


@app.get(
    "/api/reviews/history",
    response_model=SubmissionListResponse,
    summary="Get reviewed submissions",
    description="Submissions with a reviewer decision (APPROVED, REJECTED, or since-signed-off), most recently decided first.",
)
async def get_review_history(
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_REVIEWER)),
) -> SubmissionListResponse:
    # Uses FINAL_STAGE_STATUSES (APPROVED/REJECTED/SIGNED_OFF), not just
    # APPROVED/REJECTED — a Stakeholder's later sign-off moves status to
    # SIGNED_OFF, and a reviewer's own decision history shouldn't lose
    # an item just because a later role acted on it too.
    records = list(
        db.image_records.find({"status": {"$in": list(FINAL_STAGE_STATUSES)}}).sort("reviewed_at", -1)
    )
    images = [_record_to_response(r) for r in records]
    return SubmissionListResponse(images=images, count=len(images))


@app.get(
    "/api/reviews/ai-summary",
    response_model=AISummaryResponse,
    summary="Get an AI-drafted briefing of the review queue",
    description=(
        "Two paragraphs of plain prose written by an LLM from queue figures the "
        "backend computes (pending/claimed counts, risk breakdown, longest wait, "
        "recent decision volume). Returns available=false (not an error) when "
        "GEMINI_API_KEY is unset or generation fails."
    ),
)
async def get_reviewer_ai_summary(
    refresh: bool = False,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_REVIEWER)),
) -> AISummaryResponse:
    if not settings.GEMINI_API_KEY:
        return AISummaryResponse(available=False, reason="not_configured")

    now = datetime.now(timezone.utc)
    queue = list(
        db.image_records.find(
            {"status": {"$in": [STATUS_PENDING_REVIEW, STATUS_IN_REVIEW]}},
            {"status": 1, "risk_level": 1, "district": 1, "uploaded_at": 1},
        )
    )

    pending_count = 0
    in_review_count = 0
    queue_by_risk: dict[str, int] = {}
    high_risk_districts: dict[str, int] = {}
    oldest_pending_hours: Optional[float] = None
    for r in queue:
        if r.get("status") == STATUS_IN_REVIEW:
            in_review_count += 1
        else:
            pending_count += 1
            uploaded_at = r.get("uploaded_at")
            if uploaded_at is not None:
                if uploaded_at.tzinfo is None:
                    uploaded_at = uploaded_at.replace(tzinfo=timezone.utc)
                waited = round((now - uploaded_at).total_seconds() / 3600, 1)
                if waited >= 0 and (oldest_pending_hours is None or waited > oldest_pending_hours):
                    oldest_pending_hours = waited
        risk = r.get("risk_level")
        if risk:
            queue_by_risk[risk] = queue_by_risk.get(risk, 0) + 1
            if risk == "HIGH" and r.get("district"):
                high_risk_districts[r["district"]] = high_risk_districts.get(r["district"], 0) + 1

    # Counted in Python (not with a $gte query) for the same
    # mongomock-compatibility reason as the stakeholder overview: stored
    # reviewed_at values are tz-naive in some writers and tz-aware in
    # others, and comparing those inside a Mongo query is unreliable.
    seven_days_ago = now - timedelta(days=7)
    decided_last_7_days = 0
    for r in db.image_records.find({"reviewed_at": {"$ne": None}}, {"reviewed_at": 1}):
        reviewed_at = r.get("reviewed_at")
        if reviewed_at is None:
            continue
        if reviewed_at.tzinfo is None:
            reviewed_at = reviewed_at.replace(tzinfo=timezone.utc)
        if reviewed_at >= seven_days_ago:
            decided_last_7_days += 1

    result = generate_reviewer_summary(
        force_refresh=refresh,
        figures={
            "pending_count": pending_count,
            "in_review_count": in_review_count,
            "queue_by_risk_level": queue_by_risk,
            "oldest_pending_hours": oldest_pending_hours,
            "high_risk_districts": sorted(
                ({"district": d, "count": c} for d, c in high_risk_districts.items()),
                key=lambda x: x["count"],
                reverse=True,
            )[:5],
            "decided_last_7_days": decided_last_7_days,
        }
    )
    if result is None:
        return AISummaryResponse(available=False, reason="generation_failed")

    return AISummaryResponse(
        available=True,
        summary=result.summary,
        model=result.model,
        generated_at=datetime.now(timezone.utc),
        cached=result.cached,
    )


@app.post(
    "/api/reviews/{image_id}/claim",
    response_model=ImageRecordResponse,
    summary="Claim a submission for review",
    description="Moves a submission from PENDING_REVIEW to IN_REVIEW under the calling reviewer. 409s if another reviewer already has it.",
)
async def claim_review(
    image_id: str,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_REVIEWER)),
) -> ImageRecordResponse:
    oid = _object_id_or_404(image_id)
    record = db.image_records.find_one({"_id": oid})
    if not record:
        raise HTTPException(status_code=404, detail="Submission not found.")

    status_now = record.get("status", STATUS_PENDING_REVIEW)
    if status_now == STATUS_IN_REVIEW and record.get("reviewed_by_user_id") not in (None, current_user["id"]):
        raise HTTPException(
            status_code=409,
            detail=f"Already being reviewed by {record.get('reviewed_by_username') or 'another reviewer'}.",
        )
    if status_now not in (STATUS_PENDING_REVIEW, STATUS_IN_REVIEW):
        raise HTTPException(status_code=400, detail=f"Cannot claim a submission with status {status_now}.")

    db.image_records.update_one(
        {"_id": oid},
        {
            "$set": {
                "status": STATUS_IN_REVIEW,
                "reviewed_by_user_id": current_user["id"],
                "reviewed_by_username": current_user["username"],
            }
        },
    )
    return _record_to_response(db.image_records.find_one({"_id": oid}))


@app.post(
    "/api/reviews/{image_id}/decide",
    response_model=ImageRecordResponse,
    summary="Approve or reject a submission",
    description="Records a final decision (approve/reject) with a note. Notes are required when rejecting.",
)
async def decide_review(
    image_id: str,
    body: ReviewDecisionRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_REVIEWER)),
) -> ImageRecordResponse:
    oid = _object_id_or_404(image_id)
    record = db.image_records.find_one({"_id": oid})
    if not record:
        raise HTTPException(status_code=404, detail="Submission not found.")

    status_now = record.get("status", STATUS_PENDING_REVIEW)
    if status_now not in (STATUS_PENDING_REVIEW, STATUS_IN_REVIEW):
        raise HTTPException(
            status_code=400, detail=f"This submission already has a final decision ({status_now})."
        )

    new_status = STATUS_APPROVED if body.decision == "approve" else STATUS_REJECTED
    db.image_records.update_one(
        {"_id": oid},
        {
            "$set": {
                "status": new_status,
                "reviewed_by_user_id": current_user["id"],
                "reviewed_by_username": current_user["username"],
                "reviewer_notes": body.notes,
                "reviewed_at": datetime.now(timezone.utc),
            }
        },
    )
    return _record_to_response(db.image_records.find_one({"_id": oid}))


# ── Stakeholder dashboard & sign-off ────────────────────────────────
# The Stakeholder role (an oversight body — bank/MP office/district
# authority) has read-only visibility into the whole pipeline plus one
# write action: a final sign-off on a Reviewer-approved submission,
# confirming release of funds. It's a second, separate confirmation
# layered on top of the Reviewer's APPROVED decision, not a rubber
# stamp of it — see STATUS_SIGNED_OFF's docstring in app/models.py.
#
# The aggregates below are computed in plain Python over find({})
# rather than a Mongo aggregation pipeline — this project's own
# documented posture (README's "Scaling to Production") is that
# brute-force is the deliberate prototype-stage choice, and it keeps
# this endpoint correct against both real MongoDB and the mongomock
# the test suite runs against, whose aggregation-operator support is
# partial.


def _compute_stakeholder_overview(db: Database) -> StakeholderOverviewResponse:
    """The overview aggregates, shared by /overview and /ai-summary so the
    narrative is always written from exactly the numbers the dashboard shows."""
    records = list(
        db.image_records.find(
            {},
            {"status": 1, "risk_level": 1, "district": 1, "uploaded_at": 1, "reviewed_at": 1},
        )
    )

    total = len(records)
    by_status: dict[str, int] = dict.fromkeys(WORKFLOW_STATUSES, 0)
    by_risk_level: dict[str, int] = {}
    district_high_risk: dict[str, int] = {}
    decision_hours: list[float] = []
    daily_counts: dict[str, int] = {}
    fourteen_days_ago = datetime.now(timezone.utc) - timedelta(days=14)

    for r in records:
        status_val = r.get("status") or STATUS_PENDING_REVIEW
        by_status[status_val] = by_status.get(status_val, 0) + 1

        risk = r.get("risk_level")
        if risk:
            by_risk_level[risk] = by_risk_level.get(risk, 0) + 1
            if risk == "HIGH" and r.get("district"):
                district_high_risk[r["district"]] = district_high_risk.get(r["district"], 0) + 1

        uploaded_at = r.get("uploaded_at")
        if uploaded_at is not None:
            if uploaded_at.tzinfo is None:
                uploaded_at = uploaded_at.replace(tzinfo=timezone.utc)
            if uploaded_at >= fourteen_days_ago:
                day_key = uploaded_at.date().isoformat()
                daily_counts[day_key] = daily_counts.get(day_key, 0) + 1

            reviewed_at = r.get("reviewed_at")
            if reviewed_at is not None:
                if reviewed_at.tzinfo is None:
                    reviewed_at = reviewed_at.replace(tzinfo=timezone.utc)
                delta_hours = (reviewed_at - uploaded_at).total_seconds() / 3600
                if delta_hours >= 0:
                    decision_hours.append(delta_hours)

    completed = sum(by_status.get(s, 0) for s in FINAL_STAGE_STATUSES)
    completion_rate = round((completed / total) * 100, 1) if total else 0.0
    avg_hours = round(sum(decision_hours) / len(decision_hours), 1) if decision_hours else None
    daily_volume = [{"date": day, "count": count} for day, count in sorted(daily_counts.items())]
    top_flagged_districts = sorted(
        ({"district": d, "high_risk_count": c} for d, c in district_high_risk.items()),
        key=lambda x: x["high_risk_count"],
        reverse=True,
    )[:5]

    return StakeholderOverviewResponse(
        total_submissions=total,
        by_status=by_status,
        by_risk_level=by_risk_level,
        completion_rate=completion_rate,
        avg_hours_to_decision=avg_hours,
        daily_volume=daily_volume,
        top_flagged_districts=top_flagged_districts,
    )


@app.get(
    "/api/stakeholder/overview",
    response_model=StakeholderOverviewResponse,
    summary="Get dashboard aggregates",
    description="Total volume, pipeline bottlenecks, completion rate, and time-to-decision — the Stakeholder dashboard's summary numbers.",
)
async def get_stakeholder_overview(
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_STAKEHOLDER)),
) -> StakeholderOverviewResponse:
    return _compute_stakeholder_overview(db)


@app.get(
    "/api/stakeholder/ai-summary",
    response_model=AISummaryResponse,
    summary="Get an AI-drafted narrative of the overview figures",
    description=(
        "Two paragraphs of plain prose written by an LLM from the same aggregates "
        "/api/stakeholder/overview returns — the numbers are computed here, the model "
        "only phrases them. Returns available=false (not an error) when GEMINI_API_KEY "
        "is unset or generation fails, so the dashboard degrades to numbers-only."
    ),
)
async def get_stakeholder_ai_summary(
    refresh: bool = False,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_STAKEHOLDER)),
) -> AISummaryResponse:
    if not settings.GEMINI_API_KEY:
        return AISummaryResponse(available=False, reason="not_configured")

    overview = _compute_stakeholder_overview(db)
    result = generate_overview_summary(overview.model_dump(), force_refresh=refresh)
    if result is None:
        return AISummaryResponse(available=False, reason="generation_failed")

    return AISummaryResponse(
        available=True,
        summary=result.summary,
        model=result.model,
        generated_at=datetime.now(timezone.utc),
        cached=result.cached,
    )


@app.get(
    "/api/stakeholder/submissions",
    response_model=SubmissionListResponse,
    summary="Get fully processed submissions",
    description="Submissions that have reached a Reviewer decision (APPROVED, REJECTED, or SIGNED_OFF) — the Stakeholder's report table.",
)
async def get_stakeholder_submissions(
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_STAKEHOLDER)),
) -> SubmissionListResponse:
    records = list(db.image_records.find({"status": {"$in": list(FINAL_STAGE_STATUSES)}}).sort("reviewed_at", -1))
    images = [_record_to_response(r) for r in records]
    return SubmissionListResponse(images=images, count=len(images))


@app.post(
    "/api/stakeholder/{image_id}/sign-off",
    response_model=ImageRecordResponse,
    summary="Give final sign-off",
    description="Confirms release of funds on a reviewer-approved submission. Only reachable from status APPROVED.",
)
async def sign_off_submission(
    image_id: str,
    body: SignOffRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_STAKEHOLDER)),
) -> ImageRecordResponse:
    oid = _object_id_or_404(image_id)
    record = db.image_records.find_one({"_id": oid})
    if not record:
        raise HTTPException(status_code=404, detail="Submission not found.")

    status_now = record.get("status", STATUS_PENDING_REVIEW)
    if status_now != STATUS_APPROVED:
        raise HTTPException(
            status_code=400,
            detail=f"Sign-off requires a reviewer-approved submission (current status: {status_now}).",
        )

    db.image_records.update_one(
        {"_id": oid},
        {
            "$set": {
                "status": STATUS_SIGNED_OFF,
                "signed_off_by_user_id": current_user["id"],
                "signed_off_by_username": current_user["username"],
                "signoff_notes": body.notes,
                "signed_off_at": datetime.now(timezone.utc),
            }
        },
    )
    return _record_to_response(db.image_records.find_one({"_id": oid}))


# ── Projects & the Submitter (contractor) dashboard ─────────────────
# A Project is the entity that owns a budget, a deadline, and an
# assignee — see app/models.py's Project docstring for why none of the
# contractor dashboard's financial or portfolio figures were computable
# before it existed.
#
# Every aggregate below is a plain Python loop over find() results
# rather than a Mongo aggregation pipeline, matching the deliberate
# choice already documented above /api/stakeholder/overview: it keeps
# these endpoints correct against both real MongoDB and the mongomock
# the test suite runs on, whose aggregation-operator support is partial.

# Plain-language categories shown to the CONTRACTOR in place of raw
# detector output. This is a security boundary, not just wording: a
# flag's `evidence` dict carries the exact numbers that produced it
# (pHash Hamming distance vs. threshold, GPS radius in km, CLIP cosine
# similarity). Handing those to the person being screened tells them
# precisely how much further to crop, or how far off-site they can
# stray, before the next upload clears — it turns the detector into a
# tuning aid for evasion.
#
# The reviewer/stakeholder/admin surfaces are unchanged and still return
# full evidence; only this submitter-facing rollup is reduced to
# categories. An unrecognised code falls back to a generic label rather
# than leaking the raw code itself.
_PUBLIC_FLAG_LABELS: dict[str, str] = {
    "EXACT_DUPLICATE": "Photo already submitted for another work",
    "PERCEPTUAL_DUPLICATE": "Photo already submitted for another work",
    "PERCEPTUAL_SUSPICIOUS": "Photo closely resembles an earlier submission",
    "SEMANTIC_DUPLICATE": "Photo shows a site already submitted for another work",
    "SEMANTIC_SUSPICIOUS": "Photo resembles a site submitted for another work",
    "CROSS_DISTRICT_MATCH": "Matching photo belongs to a different district",
    "CROSS_MP_MATCH": "Matching photo belongs to a different constituency",
    "CONTENT_MISMATCH": "Photo may not show the declared type of work",
    "CONTENT_MISMATCH_SEVERE": "Photo does not show the declared type of work",
    "EXIF_STRIPPED": "Photo metadata is missing",
    "GPS_MISSING": "Photo has no location data",
    "GPS_DISTRICT_MISMATCH": "Photo location does not match the work site",
    "PHOTO_PREDATES_SANCTION": "Photo was taken before the work was sanctioned",
    "PHOTO_FUTURE_DATED": "Photo carries an invalid capture date",
    "SOFTWARE_EDITED": "Photo was processed with image-editing software",
    "IMAGE_TAMPERED": "Photo shows signs of editing",
    "SCREENSHOT_DETECTED": "File appears to be a screenshot, not a camera photo",
    "PHOTO_OF_PHOTO": "Appears to be a photo of a printed photo or a screen",
    "RECEIPT_AMOUNT_MISMATCH": "Receipt amount does not match the claimed amount",
    "RECEIPT_DATE_BEFORE_SANCTION": "Receipt is dated before the work was sanctioned",
}
_GENERIC_FLAG_LABEL = "Flagged for manual verification"

# risk_level values that count as "flagged" on the contractor's view.
_FLAGGED_RISK_LEVELS = ("MEDIUM", "HIGH")


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    """Normalise a datetime read back from Mongo to timezone-aware UTC.

    PyMongo returns naive datetimes (BSON has no offset), so comparing
    one against datetime.now(timezone.utc) raises TypeError. Same
    normalisation the stakeholder overview does inline.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _compute_financials(records: list[dict], sanctioned_amount: float) -> ProjectFinancials:
    """Roll a set of submissions up into the money figures.

    Bucketed by each submission's workflow status so that a claim which
    was rejected, or is still sitting in the review queue, never counts
    as spent — see ProjectFinancials' docstring for the exact
    definitions. Records with no claimed_amount (submitted before that
    field was persisted) contribute 0 rather than being guessed at.
    """
    disbursed = 0.0
    pending_disbursement = 0.0
    awaiting_decision = 0.0
    rejected = 0.0

    for r in records:
        amount = r.get("claimed_amount") or 0.0
        status_val = r.get("status") or STATUS_PENDING_REVIEW
        if status_val == STATUS_SIGNED_OFF:
            disbursed += amount
        elif status_val == STATUS_APPROVED:
            pending_disbursement += amount
        elif status_val == STATUS_REJECTED:
            rejected += amount
        else:  # PENDING_REVIEW / IN_REVIEW
            awaiting_decision += amount

    utilised = disbursed + pending_disbursement
    return ProjectFinancials(
        sanctioned_amount=round(sanctioned_amount, 2),
        amount_utilised=round(utilised, 2),
        amount_disbursed=round(disbursed, 2),
        amount_pending_disbursement=round(pending_disbursement, 2),
        amount_awaiting_decision=round(awaiting_decision, 2),
        amount_rejected=round(rejected, 2),
        amount_remaining=round(sanctioned_amount - utilised, 2),
        utilisation_percent=round((utilised / sanctioned_amount) * 100, 1) if sanctioned_amount else 0.0,
    )


def _project_progress(project: dict) -> tuple[float, str]:
    """Return (percent, basis) for a project's completion.

    Phase-derived when milestones are defined. With no phases there is
    nothing real to measure, so it falls back to the coarse
    status-derived value and says so via `basis` — reporting a
    confident-looking 0%/100% without flagging which of the two
    calculations produced it would be misleading on a dashboard whose
    whole purpose is to be trusted.
    """
    phases = project.get("phases") or []
    if phases:
        complete = sum(1 for p in phases if p.get("is_complete"))
        return round((complete / len(phases)) * 100, 1), "phases"
    return (100.0 if project.get("status") == PROJECT_COMPLETED else 0.0), "status"


def _project_to_summary(project: dict, records: list[dict]) -> ProjectSummaryResponse:
    """Build one project's dashboard row from the project document and
    the submissions made against it."""
    now = datetime.now(timezone.utc)
    expected = _as_utc(project.get("expected_completion_date"))
    status_val = project.get("status") or PROJECT_NOT_STARTED

    days_remaining = None
    is_overdue = False
    if expected is not None:
        days_remaining = (expected - now).days
        # A finished or abandoned work can't be "overdue" — only live
        # ones can still be late.
        is_overdue = expected < now and status_val not in (PROJECT_COMPLETED, PROJECT_CANCELLED)

    by_status: dict[str, int] = dict.fromkeys(WORKFLOW_STATUSES, 0)
    flagged = 0
    for r in records:
        by_status[r.get("status") or STATUS_PENDING_REVIEW] = (
            by_status.get(r.get("status") or STATUS_PENDING_REVIEW, 0) + 1
        )
        if r.get("risk_level") in _FLAGGED_RISK_LEVELS:
            flagged += 1

    progress, basis = _project_progress(project)

    return ProjectSummaryResponse(
        work_id=project["work_id"],
        title=project.get("title", ""),
        work_type=project.get("work_type"),
        district=project.get("district", ""),
        status=status_val,
        assigned_to_username=project.get("assigned_to_username"),
        financials=_compute_financials(records, project.get("sanctioned_amount") or 0.0),
        phases=[ProjectPhaseSchema(**p) for p in sorted(project.get("phases") or [], key=lambda p: p.get("order", 0))],
        progress_percent=progress,
        progress_basis=basis,
        sanction_date=project.get("sanction_date"),
        expected_completion_date=project.get("expected_completion_date"),
        is_overdue=is_overdue,
        days_remaining=days_remaining,
        total_submissions=len(records),
        submissions_by_status=by_status,
        flagged_submissions=flagged,
    )


def _resolve_assignee(db: Database, username: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Look up (user_id, username) for an assignment, or (None, None) to
    unassign. 404s on an unknown username rather than silently creating
    a project nobody can see."""
    if not username:
        return None, None
    user = db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail=f"No user named '{username}'.")
    return str(user["_id"]), user["username"]


@app.post(
    "/api/admin/projects",
    response_model=ProjectSummaryResponse,
    summary="Register a sanctioned work",
    description="Creates a Project — the budget/deadline/assignee record that the contractor dashboard rolls up against.",
)
async def create_project(
    body: ProjectCreateRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_ADMIN)),
) -> ProjectSummaryResponse:
    if db.projects.find_one({"work_id": body.work_id}):
        raise HTTPException(status_code=409, detail=f"A project already exists for work_id '{body.work_id}'.")

    assignee_id, assignee_name = _resolve_assignee(db, body.assigned_to_username)

    doc = {
        "work_id": body.work_id,
        "title": body.title,
        "work_type": body.work_type,
        "district": body.district,
        "state": body.state,
        "mp_name": body.mp_name,
        "assigned_to_user_id": assignee_id,
        "assigned_to_username": assignee_name,
        "sanctioned_amount": body.sanctioned_amount,
        "sanction_date": body.sanction_date,
        "expected_completion_date": body.expected_completion_date,
        "phases": [
            {"name": name, "order": i, "is_complete": False, "completed_at": None, "completed_by_username": None}
            for i, name in enumerate(body.phase_names)
        ],
        "status": PROJECT_NOT_STARTED,
        "created_by_user_id": current_user.get("id"),
        "created_by_username": current_user.get("username"),
        "created_at": datetime.now(timezone.utc),
    }
    result = db.projects.insert_one(doc)
    doc["_id"] = result.inserted_id

    # A brand-new project has no submissions yet, but reuse the same
    # builder so the response shape can never drift from the list view's.
    records = list(db.image_records.find({"work_id": body.work_id}))
    return _project_to_summary(doc, records)


@app.get(
    "/api/admin/projects",
    response_model=ProjectListResponse,
    summary="List all projects",
    description="Every registered work with its financial and progress rollup — the Admin's project register.",
)
async def list_all_projects(
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_ADMIN)),
) -> ProjectListResponse:
    projects = list(db.projects.find().sort("created_at", -1))
    records_by_work: dict[str, list[dict]] = {}
    for r in db.image_records.find({}, {"work_id": 1, "status": 1, "risk_level": 1, "claimed_amount": 1}):
        records_by_work.setdefault(r.get("work_id"), []).append(r)

    summaries = [_project_to_summary(p, records_by_work.get(p["work_id"], [])) for p in projects]
    return ProjectListResponse(projects=summaries, count=len(summaries))


@app.patch(
    "/api/admin/projects/{work_id}/assign",
    response_model=ProjectSummaryResponse,
    summary="Assign or reassign a work",
    description="Awards a project to a contractor (or unassigns it with a null username).",
)
async def assign_project(
    work_id: str,
    body: ProjectAssignRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_ADMIN)),
) -> ProjectSummaryResponse:
    project = db.projects.find_one({"work_id": work_id})
    if not project:
        raise HTTPException(status_code=404, detail=f"No project for work_id '{work_id}'.")

    assignee_id, assignee_name = _resolve_assignee(db, body.assigned_to_username)
    db.projects.update_one(
        {"work_id": work_id},
        {"$set": {"assigned_to_user_id": assignee_id, "assigned_to_username": assignee_name}},
    )
    updated = db.projects.find_one({"work_id": work_id})
    return _project_to_summary(updated, list(db.image_records.find({"work_id": work_id})))


@app.patch(
    "/api/admin/projects/{work_id}/status",
    response_model=ProjectSummaryResponse,
    summary="Set a project's lifecycle status",
    description="NOT_STARTED / IN_PROGRESS / COMPLETED / CANCELLED. Distinct from a submission's review status.",
)
async def update_project_status(
    work_id: str,
    body: ProjectStatusUpdateRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_ADMIN)),
) -> ProjectSummaryResponse:
    project = db.projects.find_one({"work_id": work_id})
    if not project:
        raise HTTPException(status_code=404, detail=f"No project for work_id '{work_id}'.")

    db.projects.update_one({"work_id": work_id}, {"$set": {"status": body.status}})
    updated = db.projects.find_one({"work_id": work_id})
    return _project_to_summary(updated, list(db.image_records.find({"work_id": work_id})))


@app.patch(
    "/api/projects/{work_id}/phases/{order}",
    response_model=ProjectSummaryResponse,
    summary="Mark a project milestone complete",
    description="Reviewer/Admin only — a contractor cannot mark their own progress, since progress drives payment.",
)
async def set_phase_completion(
    work_id: str,
    order: int,
    body: PhaseCompleteRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_REVIEWER, ROLE_ADMIN)),
) -> ProjectSummaryResponse:
    """Deliberately gated to Reviewer/Admin, not the assigned submitter.

    Progress percentage feeds the funds/completion view an oversight body
    reads, so letting the contractor set it would let the claimant
    certify their own work — the exact conflict of interest this module
    exists to remove.
    """
    project = db.projects.find_one({"work_id": work_id})
    if not project:
        raise HTTPException(status_code=404, detail=f"No project for work_id '{work_id}'.")

    phases = project.get("phases") or []
    target = next((p for p in phases if p.get("order") == order), None)
    if target is None:
        raise HTTPException(status_code=404, detail=f"Project '{work_id}' has no phase with order {order}.")

    target["is_complete"] = body.is_complete
    target["completed_at"] = datetime.now(timezone.utc) if body.is_complete else None
    target["completed_by_username"] = current_user.get("username") if body.is_complete else None

    db.projects.update_one({"work_id": work_id}, {"$set": {"phases": phases}})
    updated = db.projects.find_one({"work_id": work_id})
    return _project_to_summary(updated, list(db.image_records.find({"work_id": work_id})))


@app.get(
    "/api/projects/mine",
    response_model=ProjectListResponse,
    summary="My assigned projects",
    description="Every work awarded to the logged-in contractor, with per-project budget, progress, and submission counts.",
)
async def get_my_projects(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ProjectListResponse:
    projects = list(db.projects.find({"assigned_to_user_id": current_user["id"]}))

    # Scope submissions to the caller's OWN uploads, not every upload
    # against the work_id: another agency's submission on a shared work
    # is not this contractor's to see (same own-files-only rule
    # /api/images/mine follows).
    records_by_work: dict[str, list[dict]] = {}
    for r in db.image_records.find(
        {"submitted_by_user_id": current_user["id"]},
        {"work_id": 1, "status": 1, "risk_level": 1, "claimed_amount": 1},
    ):
        records_by_work.setdefault(r.get("work_id"), []).append(r)

    summaries = [_project_to_summary(p, records_by_work.get(p["work_id"], [])) for p in projects]
    summaries.sort(key=lambda s: (not s.is_overdue, s.work_id))  # overdue first
    return ProjectListResponse(projects=summaries, count=len(summaries))


@app.get(
    "/api/dashboard/summary",
    response_model=DashboardSummaryResponse,
    summary="Contractor dashboard summary",
    description="One call for the whole Submitter landing page: portfolio finances, project counts, compliance standing, and what needs action.",
)
async def get_dashboard_summary(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> DashboardSummaryResponse:
    """Portfolio rollup for the logged-in contractor.

    Scoped two ways at once — projects assigned to this user, and
    submissions uploaded by this user. Submissions whose work_id has no
    Project document can't be attributed to any budget; rather than
    dropping them silently (which would make the money figures quietly
    understate reality) they're counted in unbudgeted_submission_count
    so the dashboard can say so.
    """
    user_id = current_user["id"]
    projects = list(db.projects.find({"assigned_to_user_id": user_id}))
    my_work_ids = {p["work_id"] for p in projects}

    all_my_records = list(db.image_records.find({"submitted_by_user_id": user_id}))

    budgeted_records: list[dict] = []
    unbudgeted_count = 0
    records_by_work: dict[str, list[dict]] = {}
    for r in all_my_records:
        work_id = r.get("work_id")
        if work_id in my_work_ids:
            budgeted_records.append(r)
            records_by_work.setdefault(work_id, []).append(r)
        else:
            unbudgeted_count += 1

    # ── Money ────────────────────────────────────────────────────────
    total_sanctioned = sum(p.get("sanctioned_amount") or 0.0 for p in projects)
    financials = _compute_financials(budgeted_records, total_sanctioned)

    # ── Portfolio ────────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    counts = dict.fromkeys(PROJECT_STATUSES, 0)
    overdue = 0
    progress_values: list[float] = []
    deadlines: list[DeadlineItem] = []

    for p in projects:
        status_val = p.get("status") or PROJECT_NOT_STARTED
        counts[status_val] = counts.get(status_val, 0) + 1

        percent, _basis = _project_progress(p)
        progress_values.append(percent)

        expected = _as_utc(p.get("expected_completion_date"))
        if expected is not None and status_val not in (PROJECT_COMPLETED, PROJECT_CANCELLED):
            days = (expected - now).days
            if expected < now:
                overdue += 1
            deadlines.append(
                DeadlineItem(
                    work_id=p["work_id"],
                    title=p.get("title", ""),
                    expected_completion_date=p["expected_completion_date"],
                    days_remaining=days,
                    is_overdue=expected < now,
                )
            )

    deadlines.sort(key=lambda d: d.days_remaining)

    # ── Compliance standing ──────────────────────────────────────────
    by_status: dict[str, int] = dict.fromkeys(WORKFLOW_STATUSES, 0)
    flagged = 0
    risk_scores: list[int] = []
    flag_reasons: dict[str, int] = {}
    action_required: list[ActionRequiredItem] = []

    for r in all_my_records:
        status_val = r.get("status") or STATUS_PENDING_REVIEW
        by_status[status_val] = by_status.get(status_val, 0) + 1

        if r.get("risk_level") in _FLAGGED_RISK_LEVELS:
            flagged += 1

        score = r.get("risk_score")
        if score is not None:
            risk_scores.append(score)

        for f in r.get("flags") or []:
            label = _PUBLIC_FLAG_LABELS.get(f.get("code"), _GENERIC_FLAG_LABEL)
            flag_reasons[label] = flag_reasons.get(label, 0) + 1

        if status_val == STATUS_REJECTED:
            action_required.append(
                ActionRequiredItem(
                    image_id=str(r["_id"]),
                    work_id=r.get("work_id", ""),
                    uploaded_at=r["uploaded_at"],
                    reviewed_at=r.get("reviewed_at"),
                    reason=r.get("reviewer_notes"),
                )
            )

    action_required.sort(key=lambda a: a.uploaded_at, reverse=True)

    decided = by_status.get(STATUS_APPROVED, 0) + by_status.get(STATUS_SIGNED_OFF, 0) + by_status.get(STATUS_REJECTED, 0)
    approved = by_status.get(STATUS_APPROVED, 0) + by_status.get(STATUS_SIGNED_OFF, 0)

    return DashboardSummaryResponse(
        financials=financials,
        projects_assigned=len(projects),
        projects_completed=counts.get(PROJECT_COMPLETED, 0),
        projects_in_progress=counts.get(PROJECT_IN_PROGRESS, 0),
        projects_not_started=counts.get(PROJECT_NOT_STARTED, 0),
        projects_cancelled=counts.get(PROJECT_CANCELLED, 0),
        projects_overdue=overdue,
        overall_progress_percent=round(sum(progress_values) / len(progress_values), 1) if progress_values else 0.0,
        total_submissions=len(all_my_records),
        submissions_by_status=by_status,
        flagged_submissions=flagged,
        action_required_count=len(action_required),
        approval_rate=round((approved / decided) * 100, 1) if decided else 0.0,
        average_risk_score=round(sum(risk_scores) / len(risk_scores), 1) if risk_scores else None,
        flag_reasons=flag_reasons,
        action_required=action_required[:20],
        upcoming_deadlines=deadlines[:10],
        unbudgeted_submission_count=unbudgeted_count,
    )


# ── Admin: user management & full override control ──────────────────
# The Admin role has Full Access everywhere per the original role
# matrix — user management, every submission, and a manual status
# override none of the other three roles get. Two things from the
# original UI spec are deliberately NOT built here, stated plainly
# rather than faked:
#   - "System Logs": there's no persistent application/error log store
#     in this project (just stdout, via uvicorn's own logger). What IS
#     real and IS built below is an activity log derived from the
#     audit fields every ImageRecord already carries (who submitted /
#     reviewed / signed off / overrode, and when) — a user-action log,
#     not a claim that server/error logs are captured here too.
#   - "Global Settings": app/config.py's Settings loads once at process
#     startup from environment variables; there is no runtime-mutable
#     settings store for the risk engine to read from instead. A
#     settings form that silently changed nothing would be worse than
#     not building one.


@app.post(
    "/api/admin/users",
    response_model=AdminUserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a user with any role",
    description="Unlike public /api/auth/register (always Submitter), an admin picks the role directly.",
)
async def admin_create_user(
    body: AdminUserCreate,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_ADMIN)),
) -> AdminUserResponse:
    if db.users.find_one({"username": body.username}):
        raise HTTPException(status_code=400, detail="Username already registered")

    user_dict = {
        "username": body.username,
        "password_hash": get_password_hash(body.password),
        "agency_name": body.agency_name,
        "district": body.district,
        "role": body.role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    result = db.users.insert_one(user_dict)
    user_dict["_id"] = result.inserted_id
    return _user_to_response(user_dict)


@app.get("/api/admin/users", response_model=AdminUserListResponse, summary="List all users")
async def admin_list_users(
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_ADMIN)),
) -> AdminUserListResponse:
    users = [_user_to_response(u) for u in db.users.find({}).sort("created_at", -1)]
    return AdminUserListResponse(users=users, count=len(users))


@app.patch("/api/admin/users/{user_id}/role", response_model=AdminUserResponse, summary="Change a user's role")
async def admin_update_user_role(
    user_id: str,
    body: UserRoleUpdateRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_ADMIN)),
) -> AdminUserResponse:
    oid = _object_id_or_404(user_id, "User not found.")
    if not db.users.find_one({"_id": oid}):
        raise HTTPException(status_code=404, detail="User not found.")
    db.users.update_one({"_id": oid}, {"$set": {"role": body.role}})
    return _user_to_response(db.users.find_one({"_id": oid}))


@app.patch(
    "/api/admin/users/{user_id}/active",
    response_model=AdminUserResponse,
    summary="Activate or deactivate a user",
    description="A deactivated account can't log in and loses access on its next request even with an existing token (app/auth.py's get_current_user checks this too) — history stays intact, nothing is deleted.",
)
async def admin_update_user_active(
    user_id: str,
    body: UserActiveUpdateRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_ADMIN)),
) -> AdminUserResponse:
    oid = _object_id_or_404(user_id, "User not found.")
    if not db.users.find_one({"_id": oid}):
        raise HTTPException(status_code=404, detail="User not found.")
    if str(oid) == current_user["id"] and not body.is_active:
        raise HTTPException(status_code=400, detail="You can't deactivate your own account.")
    db.users.update_one({"_id": oid}, {"$set": {"is_active": body.is_active}})
    return _user_to_response(db.users.find_one({"_id": oid}))


@app.get(
    "/api/admin/submissions",
    response_model=SubmissionListResponse,
    summary="Get every submission",
    description="Unfiltered — every ImageRecord regardless of status, for the Admin 'All Submissions' table.",
)
async def admin_list_submissions(
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_ADMIN)),
) -> SubmissionListResponse:
    records = list(db.image_records.find({}).sort("uploaded_at", -1))
    images = [_record_to_response(r) for r in records]
    return SubmissionListResponse(images=images, count=len(images))


def _apply_status_override(
    db: Database, oid: ObjectId, new_status: str, notes: Optional[str], current_user: dict
) -> Optional[dict]:
    record = db.image_records.find_one({"_id": oid})
    if not record:
        return None
    previous_status = record.get("status", STATUS_PENDING_REVIEW)
    db.image_records.update_one(
        {"_id": oid},
        {
            "$set": {
                "status": new_status,
                "admin_override_by_user_id": current_user["id"],
                "admin_override_by_username": current_user["username"],
                "admin_override_previous_status": previous_status,
                "admin_override_notes": notes,
                "admin_override_at": datetime.now(timezone.utc),
            }
        },
    )
    return db.image_records.find_one({"_id": oid})


@app.post(
    "/api/admin/submissions/{image_id}/override-status",
    response_model=ImageRecordResponse,
    summary="Manually override a submission's status",
    description="Sets status directly to any workflow value — for correcting an item stuck mid-pipeline. Recorded as its own audit event, not a substitute reviewer/stakeholder action.",
)
async def admin_override_status(
    image_id: str,
    body: StatusOverrideRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_ADMIN)),
) -> ImageRecordResponse:
    oid = _object_id_or_404(image_id)
    updated = _apply_status_override(db, oid, body.status, body.notes, current_user)
    if updated is None:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return _record_to_response(updated)


@app.post(
    "/api/admin/submissions/bulk-override-status",
    response_model=BulkStatusOverrideResponse,
    summary="Manually override status on multiple submissions",
    description="The bulk-action checkboxes from the original role matrix — applies one status override to many submissions at once.",
)
async def admin_bulk_override_status(
    body: BulkStatusOverrideRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_ADMIN)),
) -> BulkStatusOverrideResponse:
    updated_count = 0
    not_found_ids: list[str] = []
    for image_id in body.image_ids:
        try:
            oid = ObjectId(image_id)
        except InvalidId:
            not_found_ids.append(image_id)
            continue
        updated = _apply_status_override(db, oid, body.status, body.notes, current_user)
        if updated is None:
            not_found_ids.append(image_id)
        else:
            updated_count += 1
    return BulkStatusOverrideResponse(updated_count=updated_count, not_found_ids=not_found_ids)


@app.get(
    "/api/admin/activity",
    response_model=ActivityLogResponse,
    summary="Get the recent activity log",
    description="Submit/review/sign-off/override events derived from ImageRecord's own attribution fields, most recent first. Not an application/error log — see this section's module comment.",
)
async def admin_get_activity(
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_ADMIN)),
) -> ActivityLogResponse:
    records = list(
        db.image_records.find(
            {},
            {
                "work_id": 1,
                "status": 1,
                "submitted_by_username": 1,
                "uploaded_at": 1,
                "reviewed_by_username": 1,
                "reviewer_notes": 1,
                "reviewed_at": 1,
                "signed_off_by_username": 1,
                "signoff_notes": 1,
                "signed_off_at": 1,
                "admin_override_by_username": 1,
                "admin_override_previous_status": 1,
                "admin_override_notes": 1,
                "admin_override_at": 1,
            },
        )
    )

    events: list[ActivityEvent] = []
    for r in records:
        image_id = str(r["_id"])
        work_id = r.get("work_id", "")

        if r.get("uploaded_at"):
            events.append(
                ActivityEvent(
                    type="submitted",
                    work_id=work_id,
                    image_id=image_id,
                    actor=r.get("submitted_by_username"),
                    at=r["uploaded_at"],
                )
            )
        if r.get("reviewed_by_username") and r.get("reviewed_at"):
            events.append(
                ActivityEvent(
                    type="rejected" if r.get("status") == STATUS_REJECTED else "approved",
                    work_id=work_id,
                    image_id=image_id,
                    actor=r["reviewed_by_username"],
                    at=r["reviewed_at"],
                    detail=r.get("reviewer_notes"),
                )
            )
        if r.get("signed_off_by_username") and r.get("signed_off_at"):
            events.append(
                ActivityEvent(
                    type="signed_off",
                    work_id=work_id,
                    image_id=image_id,
                    actor=r["signed_off_by_username"],
                    at=r["signed_off_at"],
                    detail=r.get("signoff_notes"),
                )
            )
        if r.get("admin_override_by_username") and r.get("admin_override_at"):
            prev = r.get("admin_override_previous_status") or "?"
            note = r.get("admin_override_notes")
            detail = f"{prev} → {r.get('status')}" + (f": {note}" if note else "")
            events.append(
                ActivityEvent(
                    type="admin_override",
                    work_id=work_id,
                    image_id=image_id,
                    actor=r["admin_override_by_username"],
                    at=r["admin_override_at"],
                    detail=detail,
                )
            )

    events.sort(key=lambda e: e.at, reverse=True)
    events = events[:50]
    return ActivityLogResponse(events=events, count=len(events))


@app.get(
    "/api/admin/ai-summary",
    response_model=AISummaryResponse,
    summary="Get an AI-drafted operations note for the whole system",
    description=(
        "Two paragraphs of plain prose written by an LLM from system figures the "
        "backend computes (accounts by role, submissions by status, last-7-days "
        "workflow events, override counts). Returns available=false (not an "
        "error) when GEMINI_API_KEY is unset or generation fails."
    ),
)
async def get_admin_ai_summary(
    refresh: bool = False,
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_ADMIN)),
) -> AISummaryResponse:
    if not settings.GEMINI_API_KEY:
        return AISummaryResponse(available=False, reason="not_configured")

    users_by_role: dict[str, int] = {}
    inactive_users = 0
    users_total = 0
    for u in db.users.find({}, {"role": 1, "is_active": 1}):
        users_total += 1
        role = u.get("role") or ROLE_SUBMITTER
        users_by_role[role] = users_by_role.get(role, 0) + 1
        if u.get("is_active") is False:
            inactive_users += 1

    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)

    def _within_week(value) -> bool:
        if value is None:
            return False
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value >= seven_days_ago

    submissions_total = 0
    by_status: dict[str, int] = dict.fromkeys(WORKFLOW_STATUSES, 0)
    events_last_7_days: dict[str, int] = {}
    admin_overrides_total = 0
    for r in db.image_records.find(
        {},
        {
            "status": 1,
            "uploaded_at": 1,
            "reviewed_at": 1,
            "reviewed_by_username": 1,
            "signed_off_at": 1,
            "admin_override_at": 1,
            "admin_override_by_username": 1,
        },
    ):
        submissions_total += 1
        status_val = r.get("status") or STATUS_PENDING_REVIEW
        by_status[status_val] = by_status.get(status_val, 0) + 1

        if _within_week(r.get("uploaded_at")):
            events_last_7_days["submitted"] = events_last_7_days.get("submitted", 0) + 1
        if r.get("reviewed_by_username") and _within_week(r.get("reviewed_at")):
            decision = "rejected" if r.get("status") == STATUS_REJECTED else "approved"
            events_last_7_days[decision] = events_last_7_days.get(decision, 0) + 1
        if _within_week(r.get("signed_off_at")):
            events_last_7_days["signed_off"] = events_last_7_days.get("signed_off", 0) + 1
        if r.get("admin_override_by_username"):
            admin_overrides_total += 1
            if _within_week(r.get("admin_override_at")):
                events_last_7_days["admin_override"] = events_last_7_days.get("admin_override", 0) + 1

    result = generate_admin_summary(
        force_refresh=refresh,
        figures={
            "users_total": users_total,
            "users_by_role": users_by_role,
            "inactive_users": inactive_users,
            "submissions_total": submissions_total,
            "by_status": by_status,
            "events_last_7_days": events_last_7_days,
            "admin_overrides_total": admin_overrides_total,
        }
    )
    if result is None:
        return AISummaryResponse(available=False, reason="generation_failed")

    return AISummaryResponse(
        available=True,
        summary=result.summary,
        model=result.model,
        generated_at=datetime.now(timezone.utc),
        cached=result.cached,
    )


@app.get(
    "/api/duplicates",
    response_model=DuplicatesResponse,
    summary="Get all duplicate clusters",
    description="Find all groups of images that are duplicates of each other.",
)
async def get_duplicates(
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_REVIEWER, ROLE_STAKEHOLDER, ROLE_ADMIN)),
) -> DuplicatesResponse:
    """Find all duplicate clusters across the database.

    Groups images by SHA-256 hash to find exact duplicate clusters.

    Oversight view, so it's gated to the three oversight roles: a
    cluster inherently exposes OTHER agencies' submissions (that's the
    point of it), which a Submitter has no entitlement to under row 2
    of the role matrix.
    """
    pipeline = [
        {"$group": {"_id": "$sha256", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}}
    ]
    dup_hashes = list(db.image_records.aggregate(pipeline))

    clusters = []
    for i, doc in enumerate(dup_hashes):
        sha256 = doc["_id"]
        records = list(db.image_records.find({"sha256": sha256}))
        images = [_record_to_response(r) for r in records]
        clusters.append(DuplicateCluster(
            cluster_id=i + 1,
            images=images,
            match_type="exact",
        ))

    return DuplicatesResponse(
        clusters=clusters,
        total_clusters=len(clusters),
    )


@app.get(
    "/api/stats",
    response_model=StatsResponse,
    summary="Get aggregate statistics",
    description="Counts of images by risk level, top flagged districts, etc.",
)
async def get_stats(
    db: Database = Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_REVIEWER, ROLE_STAKEHOLDER, ROLE_ADMIN)),
) -> StatsResponse:
    """Get aggregate statistics across the database.

    Same gating rationale as /api/duplicates above — system-wide
    counts are an oversight view, not something a Submitter sees.
    """
    total = db.image_records.count_documents({})

    pipeline_dup = [
        {"$group": {"_id": "$sha256", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}}
    ]
    dup_count = len(list(db.image_records.aggregate(pipeline_dup)))

    pipeline_top = [
        {"$group": {"_id": "$district", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_districts = list(db.image_records.aggregate(pipeline_top))

    # Counted in Python rather than a $group pipeline for the same
    # reason the stakeholder overview is (see its section comment):
    # correctness against both real MongoDB and the mongomock the test
    # suite runs on. Was previously hardcoded to {} — a stub from
    # before risk_level was persisted on the record at submit time.
    by_risk_level: dict[str, int] = {}
    for r in db.image_records.find({}, {"risk_level": 1}):
        level = r.get("risk_level")
        if level:
            by_risk_level[level] = by_risk_level.get(level, 0) + 1

    return StatsResponse(
        total_images=total,
        by_risk_level=by_risk_level,
        top_flagged_districts=[
            {"district": d["_id"], "image_count": d["count"]} for d in top_districts if d["_id"]
        ],
        duplicate_clusters=dup_count,
    )


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description="Liveness check — reports database connectivity and CLIP model status.",
)
async def health_check(
    db: Database = Depends(get_db),
) -> HealthResponse:
    """Health check endpoint."""
    # Check database connectivity
    try:
        total = db.image_records.count_documents({})
        db_status = "connected"
    except Exception:
        total = 0
        db_status = "error"

    # Check CLIP status
    clip_engine = get_clip_engine()
    clip_loaded = clip_engine.is_available

    return HealthResponse(
        status="ok" if db_status == "connected" else "degraded",
        database=db_status,
        clip_loaded=clip_loaded,
        clip_model=settings.CLIP_MODEL_NAME if clip_loaded else None,
        total_images=total,
    )


# ── Auth & Sessions ──────────────────────────────────────────────────

@app.post("/api/auth/register", summary="Register a new user", status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, db: Database = Depends(get_db)):
    """Create a new user account (for the hackathon demo)."""
    existing_user = db.users.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    db_user = {
        "username": user.username,
        "password_hash": hashed_password,
        "agency_name": user.agency_name,
        "district": user.district,
        # Public self-registration only ever creates a Submitter — there
        # is no field on UserCreate to request another role. Reviewer /
        # Stakeholder / Admin accounts are provisioned by an admin via
        # POST /api/admin/users (or scripts/create_user.py, to bootstrap
        # the very first admin before any admin account exists to log
        # in with).
        "role": ROLE_SUBMITTER,
        "is_active": True,
        # This dict is inserted directly rather than built from the
        # User pydantic model, so its field defaults (created_at's
        # included) don't apply automatically — set explicitly here.
        # Accounts registered before this fix won't have created_at;
        # AdminUserResponse treats it as Optional for exactly that reason.
        "created_at": datetime.now(timezone.utc),
    }
    db.users.insert_one(db_user)
    return {"message": "User created successfully"}


@app.post("/api/auth/login", response_model=TokenResponse, summary="Login for access token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Database = Depends(get_db)):
    """Authenticate and return a JWT bearer token."""
    user = db.users.find_one({"username": form_data.username})
    if not user or not verify_password(form_data.password, user['password_hash']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.get("is_active", True):
        # Same check as get_current_user, but caught here first so a
        # deactivated user gets a clear reason at login instead of a
        # token that then fails on the very first authenticated call.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account has been deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Accounts created before the role field existed default to
    # ROLE_SUBMITTER here (via .get) rather than failing login.
    role = user.get("role", ROLE_SUBMITTER)
    access_token = create_access_token(data={"sub": user["username"], "role": role})
    return {"access_token": access_token, "token_type": "bearer", "role": role}


@app.get("/api/auth/me", response_model=UserProfileResponse, summary="Get my profile")
async def get_my_profile(current_user: dict = Depends(get_current_user)) -> UserProfileResponse:
    """The logged-in user's own profile — role-based routing reads this
    (or the JWT's `role` claim) to decide which dashboard to land on."""
    return UserProfileResponse(
        username=current_user["username"],
        agency_name=current_user.get("agency_name"),
        district=current_user.get("district"),
        role=current_user.get("role", ROLE_SUBMITTER),
    )


@app.post("/api/sessions/create", response_model=SessionCreateResponse, summary="Create a camera session")
async def create_camera_session(
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Generate a one-time session token valid for 10 minutes."""
    import secrets
    from datetime import timedelta
    
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    session_record = {
        "token": token,
        "expires_at": expires_at,
        "created_by_user_id": current_user['id'],
        "is_used": False
    }
    result = db.sessions.insert_one(session_record)
    
    return SessionCreateResponse(
        session_id=str(result.inserted_id),
        token=token,
        expires_at=expires_at
    )


@app.post("/api/sessions/validate", response_model=SessionValidateResponse, summary="Validate a session token")
async def validate_camera_session(
    request: SessionValidateRequest,
    db: Database = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Check if a token is valid, unused, and unexpired."""
    cam_session = db.sessions.find_one({"token": request.token})
    if not cam_session:
        return SessionValidateResponse(valid=False, reason="Invalid token")
    if cam_session.get("is_used"):
        return SessionValidateResponse(valid=False, reason="Token already used")
    if cam_session.get("expires_at") < datetime.utcnow():
        return SessionValidateResponse(valid=False, reason="Token expired")
        
    return SessionValidateResponse(valid=True)
