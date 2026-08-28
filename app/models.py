"""
MongoDB Data Models for the MPLADS Image Fraud Detection Module.

These models define the structure of documents stored in MongoDB.
"""

from typing import Optional, List, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field, ConfigDict, field_validator


class MongoDocument(BaseModel):
    """Shared base for every model that maps to a MongoDB document.

    Two things every subclass needs, defined once instead of repeated
    (and previously getting out of sync) in each model:

    1. ``id`` has no default in a plain ``Field(alias="_id")`` — that
       makes it impossible to build a not-yet-inserted instance (e.g.
       ``ImageRecord(work_id=..., ...)`` before the first
       ``insert_one()``), which is exactly the pattern the tests and
       ``app/main.py``'s ``_store_image_record`` both use. Optional
       with a ``None`` default fixes that.
    2. PyMongo returns ``_id`` as a ``bson.ObjectId``, not a ``str`` —
       constructing straight from a raw document
       (``ImageRecord(**doc)``, as every read in
       ``app/duplicate_search.py`` does) would otherwise fail Pydantic's
       strict string check. The validator below coerces it once, here,
       instead of every call site remembering to call ``str(doc["_id"])``
       first.
    """

    id: Optional[str] = Field(default=None, alias="_id")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("id", mode="before")
    @classmethod
    def _stringify_object_id(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        return str(v)


# Every account created through the public /api/auth/register endpoint
# is a "submitter" (a field agency officer uploading work-completion
# photos) — that endpoint has no way to self-elevate to any other role.
# reviewer/stakeholder/admin accounts are provisioned later, by an
# admin, once the Admin role's UI/endpoints exist; until then these
# values exist only so the frontend and JWT payload have a stable
# vocabulary to route on.
ROLE_SUBMITTER = "submitter"
ROLE_REVIEWER = "reviewer"
ROLE_STAKEHOLDER = "stakeholder"
ROLE_ADMIN = "admin"
USER_ROLES = (ROLE_SUBMITTER, ROLE_REVIEWER, ROLE_STAKEHOLDER, ROLE_ADMIN)

# Workflow status for a stored ImageRecord, shown to the submitter as a
# status badge / timeline stage. Every record starts PENDING_REVIEW at
# submit time regardless of its automated risk_level — the automated
# score is a signal for a human reviewer, not itself an approval.
# IN_REVIEW/APPROVED/REJECTED are written by the Reviewer role's
# endpoints (app/main.py's /api/reviews/*). SIGNED_OFF is written by
# the Stakeholder role's /api/stakeholder/{id}/sign-off — a second,
# separate confirmation on top of a Reviewer's APPROVED, modelling the
# oversight body (bank/MP office/district authority) confirming release
# of funds rather than just rubber-stamping the reviewer's call. A
# REJECTED submission has no sign-off step — there's nothing left to
# release.
STATUS_PENDING_REVIEW = "PENDING_REVIEW"
STATUS_IN_REVIEW = "IN_REVIEW"
STATUS_APPROVED = "APPROVED"
STATUS_REJECTED = "REJECTED"
STATUS_SIGNED_OFF = "SIGNED_OFF"
WORKFLOW_STATUSES = (
    STATUS_PENDING_REVIEW,
    STATUS_IN_REVIEW,
    STATUS_APPROVED,
    STATUS_REJECTED,
    STATUS_SIGNED_OFF,
)

# Statuses a Stakeholder's "fully processed / final-stage" table shows —
# anything that has reached a Reviewer decision, whether or not it's
# gone on to sign-off. PENDING_REVIEW/IN_REVIEW items are still in flux
# and belong to the Reviewer's queue, not this read-only report.
FINAL_STAGE_STATUSES = (STATUS_APPROVED, STATUS_REJECTED, STATUS_SIGNED_OFF)


# Lifecycle of a Project (a sanctioned MPLADS work), distinct from
# WORKFLOW_STATUSES above — those track one *photo submission* through
# human review; these track the *work itself* from award to completion.
# A project can be IN_PROGRESS while individual submissions against it
# are still PENDING_REVIEW, and vice versa.
PROJECT_NOT_STARTED = "NOT_STARTED"
PROJECT_IN_PROGRESS = "IN_PROGRESS"
PROJECT_COMPLETED = "COMPLETED"
PROJECT_CANCELLED = "CANCELLED"
PROJECT_STATUSES = (
    PROJECT_NOT_STARTED,
    PROJECT_IN_PROGRESS,
    PROJECT_COMPLETED,
    PROJECT_CANCELLED,
)


class ProjectPhase(BaseModel):
    """One milestone in a project's execution (e.g. "Foundation laid",
    "Phase 1 receipts submitted", "Final inspection").

    Deliberately NOT self-reported by the contractor: `is_complete` is
    written only by the Reviewer/Admin endpoints, never by the submitter
    whose payment depends on it. A contractor marking their own progress
    would defeat the point of a verification system — progress here is
    an assertion by the verifying officer, not by the claimant.
    """

    name: str
    order: int = 0
    is_complete: bool = False
    completed_at: Optional[datetime] = None
    completed_by_username: Optional[str] = None


class Project(MongoDocument):
    """A sanctioned MPLADS work — the entity that owns a budget, a
    deadline, and an assigned contractor.

    This is the missing link that makes a contractor dashboard possible.
    Before this model existed, ``work_id`` was only ever a free-text
    string stamped onto each ``ImageRecord``: there was nothing that
    knew a work's budget, who it was awarded to, or when it was due, so
    "funds remaining" / "projects assigned" / "% complete" could not be
    computed at all. Every financial and portfolio figure on the
    Submitter dashboard is a rollup of ImageRecords joined to this
    document by ``work_id``.

    ``work_id`` is the join key and is unique (see the index in
    app/database.py's init_db) — ImageRecord.work_id is free-text and
    may reference a work_id with no Project document yet (e.g. a photo
    uploaded before the work was registered); the dashboard treats
    those as unbudgeted rather than dropping them silently.
    """

    work_id: str
    title: str
    work_type: Optional[str] = None
    district: str
    state: Optional[str] = None
    mp_name: Optional[str] = None

    # Assignment — the contractor/agency this work is awarded to. Their
    # dashboard is scoped by assigned_to_user_id, so an unassigned
    # project appears on no submitter's dashboard (only the admin's).
    assigned_to_user_id: Optional[str] = None
    assigned_to_username: Optional[str] = None

    # Budget. sanctioned_amount is the denominator for every
    # "funds remaining"/"utilisation %" figure.
    sanctioned_amount: float = 0.0

    sanction_date: Optional[datetime] = None
    expected_completion_date: Optional[datetime] = None

    phases: List[ProjectPhase] = Field(default_factory=list)
    status: str = PROJECT_NOT_STARTED

    created_by_user_id: Optional[str] = None
    created_by_username: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class User(MongoDocument):
    username: str
    password_hash: str
    agency_name: Optional[str] = None
    district: Optional[str] = None
    role: str = ROLE_SUBMITTER
    # The Admin role's "permission toggle" — a deactivated account can't
    # log in (app/auth.py's login endpoint checks this) but its history
    # (submissions, reviews, sign-offs) stays intact and attributed;
    # this is a suspension, not a delete. Defaults True so every
    # existing account (created before this field existed) keeps
    # working exactly as before.
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CameraSession(MongoDocument):
    token: str
    expires_at: datetime
    is_used: bool = False
    created_by_user_id: Optional[str] = None


class District(MongoDocument):
    name: str
    state: str
    centre_latitude: float
    centre_longitude: float


class ImageRecord(MongoDocument):
    work_id: str
    work_type: Optional[str] = None
    district: str
    state: Optional[str] = None
    mp_name: Optional[str] = None
    sanction_date: Optional[datetime] = None

    # The expenditure this submission claims against its work's budget.
    # Previously this arrived as a form field on /api/images/submit, was
    # handed to the OCR layer to cross-check against the receipt
    # (RECEIPT_AMOUNT_MISMATCH), and then thrown away — nothing persisted
    # it, so no "funds utilised / remaining" figure could ever be
    # computed. Now stored, and summed by the dashboard rollup over
    # APPROVED/SIGNED_OFF records only (a claim that was rejected, or is
    # still awaiting review, must not count against the budget).
    # Optional because records stored before this field existed have no
    # value for it; the rollup treats those as 0 rather than guessing.
    claimed_amount: Optional[float] = None

    # Storage and hashing
    file_path: str
    sha256: str
    phash: str
    dhash: Optional[str] = None
    tile_phashes: Optional[str] = None

    # Raw embedding bytes (vector)
    embedding: Optional[bytes] = None

    # EXIF/GPS Metadata
    photo_timestamp: Optional[datetime] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    exif_present: Optional[bool] = None

    # Ownership — who submitted this record. Optional because records
    # inserted before this field existed won't have it; new submissions
    # always set both (see app/main.py's _store_image_record).
    submitted_by_user_id: Optional[str] = None
    submitted_by_username: Optional[str] = None

    # Snapshot of the automated risk assessment computed at submit time
    # (app/risk_engine.py's assess_image()). Previously this was returned
    # once in the submit response and then lost — nothing persisted it,
    # so a submitter's own upload history couldn't show a risk badge or
    # flag detail without re-running detection. Storing the snapshot here
    # is a read model for display; it is NOT re-derived or re-scored
    # later, so it reflects conditions at submission time.
    risk_score: Optional[int] = None
    risk_level: Optional[str] = None
    recommendation: Optional[str] = None
    flags: Optional[List[dict]] = None

    # Human review workflow stage — see STATUS_* constants above.
    status: str = STATUS_PENDING_REVIEW

    # Set by the Reviewer role's /api/reviews/* endpoints (app/main.py):
    # reviewed_by_* is populated as soon as a reviewer claims the item
    # (status -> IN_REVIEW); reviewer_notes/reviewed_at are set together
    # with the final decision (status -> APPROVED/REJECTED). The
    # automated risk_score/risk_level/flags snapshot above is never
    # edited by a reviewer — it stays an unmodified record of what the
    # engine found; reviewer_notes is where a human's read on it lives,
    # kept as a separate field rather than overwriting the evidence.
    reviewed_by_user_id: Optional[str] = None
    reviewed_by_username: Optional[str] = None
    reviewer_notes: Optional[str] = None
    reviewed_at: Optional[datetime] = None

    # Set by the Stakeholder role's /api/stakeholder/{id}/sign-off
    # (app/main.py) — only reachable from status APPROVED. A separate
    # set of fields for the same reason reviewed_by_*/reviewer_notes are
    # separate from the submitter's own data: each role's action on a
    # record is its own attributable event, not an overwrite of the
    # previous one.
    signed_off_by_user_id: Optional[str] = None
    signed_off_by_username: Optional[str] = None
    signoff_notes: Optional[str] = None
    signed_off_at: Optional[datetime] = None

    # Set by the Admin role's /api/admin/submissions/{id}/override-status
    # (app/main.py) — a manual status correction (e.g. an item stuck in
    # IN_REVIEW because a reviewer never came back to it). Deliberately
    # its own fields rather than overwriting reviewed_by_*/signed_off_by_*
    # — an admin override does not retroactively claim to BE a reviewer
    # decision or a stakeholder sign-off; the detail/audit views show it
    # as its own distinct event, alongside whatever those already say.
    admin_override_by_user_id: Optional[str] = None
    admin_override_by_username: Optional[str] = None
    admin_override_previous_status: Optional[str] = None
    admin_override_notes: Optional[str] = None
    admin_override_at: Optional[datetime] = None

    # Audit trail
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
