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
)
from app.auth import get_current_user, create_access_token, get_password_hash, verify_password, require_role
from app.risk_engine import assess_image, RiskAssessment, ScoredFlag
from app.schemas import (
    ActivityEvent,
    ActivityLogResponse,
    AdminUserCreate,
    AdminUserListResponse,
    AdminUserResponse,
    BulkStatusOverrideRequest,
    BulkStatusOverrideResponse,
    DuplicateCluster,
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
