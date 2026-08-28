"""
Unified risk scoring engine for the MPLADS Image Fraud Detection Module.

This is the single entry point that orchestrates all detection layers:
  1. Compute cryptographic and perceptual hashes (Layer 1 & 2)
  2. Compute CLIP embedding if available (Layer 3)
  3. Run duplicate search across all layers
  4. Run EXIF metadata analysis
  5. Run semantic content match
  6. Aggregate all signals into a single explainable risk score

Every point added to the score is traceable to a specific flag —
no unexplained numbers.  The output is designed for a human reviewer
who needs to understand *why* an image was flagged, not just *that*
it was flagged.
"""

import logging
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

import numpy as np
from pymongo.database import Database

from app.config import settings
from app.duplicate_search import DuplicateReport, Match, search_all_layers
from app.ela_analysis import compute_ela, detect_photo_of_photo
from app.embeddings import get_clip_engine
from app.exif_analysis import Flag, analyse_metadata, extract_capture_datetime, extract_gps
from app.hashing import (
    ImageProcessingError,
    compute_dhash,
    compute_phash,
    compute_phash_rotation_robust,
    compute_sha256,
    compute_tiled_phashes,
)

logger = logging.getLogger(__name__)


# ── Internal flag representation with points ─────────────────────────

@dataclass
class ScoredFlag:
    """A flag with its associated risk score contribution.

    This is the internal representation used during scoring.  It gets
    converted to the API's FlagResponse schema before returning.
    """
    code: str
    severity: str
    message: str
    evidence: dict[str, Any] = field(default_factory=dict)
    points_added: int = 0


@dataclass
class RiskAssessment:
    """The complete risk assessment for a single image.

    Contains the risk score, level, recommendation, all flags, and
    metadata about which detection layers ran or were skipped.
    """
    work_id: str
    risk_score: int = 0
    risk_level: str = "LOW"
    recommendation: str = ""
    flags: list[ScoredFlag] = field(default_factory=list)
    duplicate_report: Optional[DuplicateReport] = None
    semantic_match_score: Optional[float] = None
    layers_run: list[str] = field(default_factory=list)
    layers_skipped: list[str] = field(default_factory=list)
    processing_time_ms: int = 0

    # Image metadata for the response
    file_path: Optional[str] = None
    sha256: Optional[str] = None
    phash: Optional[str] = None
    dhash: Optional[str] = None
    gps_coords: Optional[list[float]] = None
    capture_date: Optional[str] = None
    exif_present: Optional[bool] = None


def _get_district_coords(district: str, session: Database) -> tuple[float, float] | None:
    """Look up the centre coordinates for a district name.

    Case-insensitive exact match against the districts lookup table.

    Note: this used to be a SQLAlchemy ORM query
    (``session.query(District).filter(District.name.ilike(...))``), left
    over from before the MongoDB migration — it would have raised
    ``TypeError: 'Collection' object is not callable`` against a real
    PyMongo/mongomock ``Database``, i.e. on every single call, since
    ``session`` here is a Mongo database, not a SQLAlchemy session.

    Returns:
        (latitude, longitude) tuple, or None if district not found.
    """
    record = session.districts.find_one(
        {"name": {"$regex": f"^{re.escape(district.strip())}$", "$options": "i"}}
    )
    if record:
        return (record["centre_latitude"], record["centre_longitude"])
    return None


def _score_from_level(score: int) -> str:
    """Convert a numeric risk score to a risk level string."""
    if score <= settings.RISK_LOW_MAX:
        return "LOW"
    elif score <= settings.RISK_MEDIUM_MAX:
        return "MEDIUM"
    else:
        return "HIGH"


def _recommendation_from_level(level: str) -> str:
    """Generate an action recommendation based on risk level."""
    if level == "HIGH":
        return "Block payment pending manual verification"
    elif level == "MEDIUM":
        return "Flag for supervisory review before payment"
    else:
        return "No action required — image appears legitimate"


def assess_image(
    image_path: str,
    work_id: str,
    work_type: str | None,
    district: str,
    state: str | None,
    mp_name: str | None,
    sanction_date: datetime | None,
    session: Database,
    claimed_amount: float | None = None,
    captured_latitude: float | None = None,
    captured_longitude: float | None = None,
    geolocation_accuracy: float | None = None,
) -> RiskAssessment:
    """Run the full fraud detection pipeline on a single image.

    This is the main entry point for the risk engine.  It:
      1. Computes all hashes and (if available) the CLIP embedding
      2. Runs all three duplicate detection layers
      3. Runs EXIF metadata anomaly analysis
      4. Runs semantic content match (if CLIP available)
      5. Aggregates all signals into a single capped-at-100 score

    Every signal that adds points to the score produces a corresponding
    flag with full evidence, so the output is fully auditable.

    Args:
        image_path:    Path to the image file.
        work_id:       MPLADS work identifier.
        work_type:     Type of work (e.g. "road construction"). May be None.
        district:      Claimed district name.
        state:         State name (for context, not used in scoring).
        mp_name:       Name of the recommending MP.
        sanction_date: When the work was sanctioned (for date comparison).
        session:       Database session.
        claimed_amount: Claimed expenditure amount, for Step 5.2's OCR
                        receipt/invoice/document amount cross-check
                        (RECEIPT_AMOUNT_MISMATCH). Only used when
                        work_type is "receipt"/"invoice"/"document" — a
                        no-op otherwise. Optional and defaulted to None
                        for backward compatibility: every existing
                        caller (scripts/evaluate_detection.py,
                        scripts/measure_latency.py, the test suite)
                        works unchanged without it.
        captured_latitude:   Latitude reported by the submitting device's
        captured_longitude:  browser at capture time (navigator.geolocation),
                             if the user granted location permission. Used
                             as a fallback for the district-distance check
                             when the image carries no GPS EXIF. The
                             frontend has always sent these and the record
                             has always stored them, but until now nothing
                             read them — so GPS_MISSING fired even when the
                             device had reported a perfectly good location.
        geolocation_accuracy: Reported accuracy radius in metres. Actually
                             used, not just recorded: a fix coarser than
                             settings.GPS_DEVICE_MAX_ACCURACY_M is discarded
                             (an IP-derived fix can be 10-100+ km out and
                             would otherwise cause a false GPS_DISTRICT_MISMATCH),
                             and a usable fix's own uncertainty is subtracted
                             from the measured distance before comparing to
                             the threshold — see app/exif_analysis.py's
                             _gps_district_flag.

    Returns:
        RiskAssessment with the full explainable result.

    Raises:
        ImageProcessingError: If the image cannot be read or decoded.
    """
    start_time = time.time()
    assessment = RiskAssessment(work_id=work_id)
    total_points = 0

    # ── Step 1: Compute hashes ───────────────────────────────────────
    # These are fast and always available — no external model needed.
    try:
        sha256 = compute_sha256(image_path)
        assessment.sha256 = sha256
        assessment.layers_run.append("sha256")
    except ImageProcessingError:
        raise  # Can't proceed without reading the file

    phash_rotation_variants: Optional[list[str]] = None
    try:
        phash = compute_phash(image_path)
        assessment.phash = phash
        assessment.layers_run.append("phash")

        if settings.ENABLE_ROTATION_ROBUST_HASH:
            try:
                phash_rotation_variants = compute_phash_rotation_robust(image_path)
            except ImageProcessingError as e:
                logger.warning("Rotation-robust pHash computation failed: %s", e)
    except ImageProcessingError as e:
        logger.warning("pHash computation failed: %s", e)
        phash = None
        assessment.layers_skipped.append("phash")

    tile_hashes: Optional[list[str]] = None
    if settings.ENABLE_TILED_HASH:
        try:
            tile_hashes = compute_tiled_phashes(image_path)
        except ImageProcessingError as e:
            logger.warning("Tiled pHash computation failed: %s", e)

    try:
        dhash = compute_dhash(image_path)
        assessment.dhash = dhash
        assessment.layers_run.append("dhash")
    except ImageProcessingError as e:
        logger.warning("dHash computation failed: %s", e)
        dhash = None
        assessment.layers_skipped.append("dhash")

    # ── Step 2: Compute CLIP embedding (if available) ────────────────
    clip_engine = get_clip_engine()
    embedding: Optional[np.ndarray] = None

    if settings.ENABLE_CLIP:
        embedding = clip_engine.embed_image(image_path)
        if embedding is not None:
            assessment.layers_run.append("clip")
        else:
            assessment.layers_skipped.append("clip")
    else:
        assessment.layers_skipped.append("clip")

    # ── Step 3: Run duplicate search ─────────────────────────────────
    if phash is not None:
        dup_report = search_all_layers(
            sha256=sha256,
            phash=phash,
            dhash=dhash,
            embedding=embedding,
            work_id=work_id,
            district=district,
            mp_name=mp_name,
            session=session,
            phash_rotation_variants=phash_rotation_variants,
            tile_hashes=tile_hashes,
        )
        assessment.duplicate_report = dup_report

        # Score exact matches
        for match in dup_report.exact_matches:
            if match.cross_work:
                points = settings.WEIGHT_EXACT_MATCH_CROSS_WORK
                total_points += points
                assessment.flags.append(ScoredFlag(
                    code="EXACT_DUPLICATE",
                    severity="HIGH",
                    message=(
                        "This photograph is byte-for-byte identical to evidence "
                        "submitted for a different work."
                    ),
                    evidence={
                        "matched_work_id": match.matched_record.work_id,
                        "matched_district": match.matched_record.district,
                        "matched_image_path": match.matched_record.file_path,
                        "sha256": sha256,
                    },
                    points_added=points,
                ))

                # Additional penalty for cross-district
                if match.cross_district:
                    cd_points = settings.WEIGHT_CROSS_DISTRICT
                    total_points += cd_points
                    assessment.flags.append(ScoredFlag(
                        code="CROSS_DISTRICT_MATCH",
                        severity="HIGH",
                        message=(
                            f"The matched image belongs to a different district "
                            f"({match.matched_record.district})."
                        ),
                        evidence={
                            "candidate_district": district,
                            "matched_district": match.matched_record.district,
                        },
                        points_added=cd_points,
                    ))

                # Additional penalty for cross-MP
                if match.cross_mp:
                    cm_points = settings.WEIGHT_CROSS_MP
                    total_points += cm_points
                    assessment.flags.append(ScoredFlag(
                        code="CROSS_MP_MATCH",
                        severity="HIGH",
                        message=(
                            f"The matched image belongs to a different MP "
                            f"({match.matched_record.mp_name})."
                        ),
                        evidence={
                            "candidate_mp": mp_name,
                            "matched_mp": match.matched_record.mp_name,
                        },
                        points_added=cm_points,
                    ))

        # Score perceptual matches
        for match in dup_report.perceptual_matches:
            if match.cross_work:
                evidence: dict[str, Any] = {
                    "matched_work_id": match.matched_record.work_id,
                    "matched_district": match.matched_record.district,
                    "matched_image_path": match.matched_record.file_path,
                }

                if match.similarity_metric == "tiled_phash":
                    # Task 2.3: found via the 3x3 tiled-hash vote, not the
                    # whole-image hash — the >=TILED_HASH_MIN_MATCHING_TILES
                    # gate already IS the match decision (no separate
                    # "suspicious" sub-band the way whole-image pHash has),
                    # so this is always duplicate-tier when it fires at all.
                    matching_tiles = int(match.raw_score)
                    points = settings.WEIGHT_PERCEPTUAL_DUPLICATE_CROSS_WORK
                    severity = "HIGH"
                    code = "PERCEPTUAL_DUPLICATE"
                    msg = (
                        "This photograph matches evidence submitted for a different work "
                        f"via tiled comparison ({matching_tiles}/9 image regions match) — "
                        "likely a heavy crop or edit that defeats whole-image hashing."
                    )
                    evidence["matching_tiles"] = matching_tiles
                    evidence["tiled_hash_min_required"] = settings.TILED_HASH_MIN_MATCHING_TILES
                else:
                    dist = int(match.raw_score)
                    if match.similarity_metric == "dhash":
                        duplicate_threshold = settings.DHASH_DUPLICATE_THRESHOLD
                        evidence["dhash_distance"] = dist
                    else:
                        duplicate_threshold = settings.PHASH_DUPLICATE_THRESHOLD
                        evidence["hamming_distance"] = dist

                    if dist <= duplicate_threshold:
                        points = settings.WEIGHT_PERCEPTUAL_DUPLICATE_CROSS_WORK
                        severity = "HIGH"
                        code = "PERCEPTUAL_DUPLICATE"
                        msg = (
                            "This photograph is a near-identical match to evidence "
                            "submitted for a different work."
                        )
                    else:
                        points = settings.WEIGHT_SUSPICIOUS_PHASH
                        severity = "MEDIUM"
                        code = "PERCEPTUAL_SUSPICIOUS"
                        msg = (
                            "This photograph has suspicious similarity to evidence "
                            "submitted for a different work."
                        )

                total_points += points
                assessment.flags.append(ScoredFlag(
                    code=code,
                    severity=severity,
                    message=msg,
                    evidence=evidence,
                    points_added=points,
                ))

                # Cross-boundary penalties
                if match.cross_district:
                    cd_points = settings.WEIGHT_CROSS_DISTRICT
                    total_points += cd_points
                    assessment.flags.append(ScoredFlag(
                        code="CROSS_DISTRICT_MATCH",
                        severity="HIGH",
                        message=(
                            f"The matched image belongs to a different district "
                            f"({match.matched_record.district})."
                        ),
                        evidence={
                            "candidate_district": district,
                            "matched_district": match.matched_record.district,
                        },
                        points_added=cd_points,
                    ))

                if match.cross_mp:
                    cm_points = settings.WEIGHT_CROSS_MP
                    total_points += cm_points
                    assessment.flags.append(ScoredFlag(
                        code="CROSS_MP_MATCH",
                        severity="HIGH",
                        message=(
                            f"The matched image belongs to a different MP "
                            f"({match.matched_record.mp_name})."
                        ),
                        evidence={
                            "candidate_mp": mp_name,
                            "matched_mp": match.matched_record.mp_name,
                        },
                        points_added=cm_points,
                    ))

        # Score only the strongest cross-work CLIP neighbour. Nearby CLIP
        # embeddings are correlated evidence, not independent fraud events,
        # so charging every neighbour could turn several weak similarities into
        # an automatic HIGH-risk decision.
        semantic_cross_work_matches = [
            match for match in dup_report.semantic_matches if match.cross_work
        ]
        if semantic_cross_work_matches:
            match = max(semantic_cross_work_matches, key=lambda item: item.raw_score)
            is_duplicate_tier = (
                match.raw_score >= settings.EMBEDDING_DUPLICATE_THRESHOLD
            )
            if is_duplicate_tier:
                points = settings.WEIGHT_SEMANTIC_DUPLICATE_CROSS_WORK
                code = "SEMANTIC_DUPLICATE"
                severity = "HIGH"
                message = (
                    "This photograph is strongly semantically similar to evidence "
                    "submitted for a different work (detected by AI vision model)."
                )
            else:
                points = settings.WEIGHT_SEMANTIC_SUSPICIOUS_CROSS_WORK
                code = "SEMANTIC_SUSPICIOUS"
                severity = "MEDIUM"
                message = (
                    "AI vision found a possible semantic match to evidence submitted "
                    "for a different work. This is a review signal, not proof of a duplicate."
                )

            total_points += points
            assessment.flags.append(ScoredFlag(
                code=code,
                severity=severity,
                message=message,
                evidence={
                    "matched_work_id": match.matched_record.work_id,
                    "matched_district": match.matched_record.district,
                    "cosine_similarity": round(match.raw_score, 4),
                    "threshold": (
                        settings.EMBEDDING_DUPLICATE_THRESHOLD
                        if is_duplicate_tier
                        else settings.EMBEDDING_SUSPICIOUS_THRESHOLD
                    ),
                    "additional_semantic_matches": len(semantic_cross_work_matches) - 1,
                    "matched_image_path": match.matched_record.file_path,
                },
                points_added=points,
            ))

            # Boundary information from a duplicate-tier CLIP match is strong
            # evidence. For a suspicious-tier match, preserve it as MEDIUM
            # review context instead of presenting it as a high-confidence fact.
            boundary_severity = "HIGH" if is_duplicate_tier else "MEDIUM"
            if match.cross_district:
                cd_points = settings.WEIGHT_CROSS_DISTRICT
                total_points += cd_points
                assessment.flags.append(ScoredFlag(
                    code="CROSS_DISTRICT_MATCH",
                    severity=boundary_severity,
                    message=(
                        f"The strongest semantic match belongs to a different district "
                        f"({match.matched_record.district})."
                    ),
                    evidence={
                        "candidate_district": district,
                        "matched_district": match.matched_record.district,
                    },
                    points_added=cd_points,
                ))

            if match.cross_mp:
                cm_points = settings.WEIGHT_CROSS_MP
                total_points += cm_points
                assessment.flags.append(ScoredFlag(
                    code="CROSS_MP_MATCH",
                    severity=boundary_severity,
                    message=(
                        f"The strongest semantic match belongs to a different MP "
                        f"({match.matched_record.mp_name})."
                    ),
                    evidence={
                        "candidate_mp": mp_name,
                        "matched_mp": match.matched_record.mp_name,
                    },
                    points_added=cm_points,
                ))

    # ── Step 4: EXIF metadata analysis ───────────────────────────────
    assessment.layers_run.append("exif")

    district_coords = _get_district_coords(district, session)

    # Only treat the device fix as usable if BOTH components are present —
    # a half-supplied pair would otherwise silently become (lat, None).
    device_coords: tuple[float, float] | None = None
    if captured_latitude is not None and captured_longitude is not None:
        device_coords = (captured_latitude, captured_longitude)

    exif_flags = analyse_metadata(
        image_path, sanction_date, district, district_coords, device_coords, geolocation_accuracy
    )

    # Extract metadata for the response
    gps = extract_gps(image_path)
    capture_dt = extract_capture_datetime(image_path)
    if gps:
        assessment.gps_coords = [gps[0], gps[1]]
    elif device_coords:
        # Report the device fix so the dashboard has coordinates to show
        # for an EXIF-less submission instead of a blank location.
        assessment.gps_coords = [device_coords[0], device_coords[1]]
    if capture_dt:
        assessment.capture_date = capture_dt.isoformat()

    # Determine EXIF presence
    from app.exif_analysis import extract_exif
    exif_data = extract_exif(image_path)
    assessment.exif_present = bool(exif_data)

    # Score EXIF flags. Flags whose code is in settings.CONDITIONAL_FLAG_WEIGHTS
    # (e.g. EXIF_STRIPPED) can't be scored yet — their points/severity/message
    # depend on whether OTHER flags end up on this assessment, including the
    # semantic content-match flag which isn't computed until Step 5 below.
    # They're appended now with points_added=0 and resolved for real in
    # _resolve_conditional_flags() after all other flags are in.
    pending_conditional_flags: list[ScoredFlag] = []
    for flag in exif_flags:
        if flag.code in settings.CONDITIONAL_FLAG_WEIGHTS:
            scored = ScoredFlag(
                code=flag.code,
                severity=flag.severity,
                message=flag.human_message,
                evidence=flag.evidence,
                points_added=0,
            )
            assessment.flags.append(scored)
            pending_conditional_flags.append(scored)
        else:
            weight = _exif_flag_weight(flag.code)
            total_points += weight
            assessment.flags.append(ScoredFlag(
                code=flag.code,
                severity=flag.severity,
                message=flag.human_message,
                evidence=flag.evidence,
                points_added=weight,
            ))

    # ── Step 4.5: ELA tamper detection ────────────────────────────────
    if settings.ENABLE_ELA:
        try:
            ela_result = compute_ela(image_path)
            assessment.layers_run.append("ela")

            if ela_result.is_tampered:
                points = settings.WEIGHT_IMAGE_TAMPERED
                total_points += points
                assessment.flags.append(ScoredFlag(
                    code="IMAGE_TAMPERED",
                    severity="HIGH",
                    message=(
                        "Error Level Analysis detected inconsistent JPEG compression "
                        "regions in this photograph, indicating possible splicing, "
                        "copy-move forgery, or digital editing."
                    ),
                    evidence={
                        "max_error": round(ela_result.max_error, 1),
                        "mean_error": round(ela_result.mean_error, 1),
                        "std_error": round(ela_result.std_error, 1),
                        "suspicious_pixel_ratio": round(ela_result.suspicious_ratio, 4),
                        "ela_quality": settings.ELA_QUALITY,
                    },
                    points_added=points,
                ))

            if ela_result.is_screenshot:
                points = settings.WEIGHT_SCREENSHOT_DETECTED
                total_points += points
                assessment.flags.append(ScoredFlag(
                    code="SCREENSHOT_DETECTED",
                    severity="HIGH",
                    message=(
                        "This image has unnaturally uniform compression error levels, "
                        "indicating it is likely a screenshot or digitally generated "
                        "image rather than a camera photograph."
                    ),
                    evidence={
                        "mean_error": round(ela_result.mean_error, 1),
                        "std_error": round(ela_result.std_error, 1),
                    },
                    points_added=points,
                ))

            # Photo-of-photo detection (moiré patterns)
            if detect_photo_of_photo(image_path):
                points = settings.WEIGHT_PHOTO_OF_PHOTO
                total_points += points
                assessment.flags.append(ScoredFlag(
                    code="PHOTO_OF_PHOTO",
                    severity="HIGH",
                    message=(
                        "Frequency analysis detected moiré patterns consistent with "
                        "a photograph taken of a printed image or digital screen."
                    ),
                    evidence={
                        "detection_method": "FFT frequency analysis",
                    },
                    points_added=points,
                ))

        except Exception as e:
            logger.warning("ELA analysis failed: %s", e)
            assessment.layers_skipped.append("ela")
    else:
        assessment.layers_skipped.append("ela")

    # ── Step 5: Semantic content match ───────────────────────────────
    if work_type and embedding is not None:
        match_score = clip_engine.zero_shot_match(image_path, work_type)
        if match_score is not None:
            assessment.semantic_match_score = match_score
            if match_score < settings.SEMANTIC_MATCH_THRESHOLD:
                # Wording note: match_score is the probability the image DOES
                # depict work_type, so a LOW number means a STRONG mismatch.
                # A prior phrasing ("the confidence score is 0.1%, below the
                # 60% threshold") read to field officers as low confidence in
                # the FINDING — i.e. a weak, uncertain flag — when 0.1%
                # actually means the model is ~99.9% sure the photo does not
                # show the claimed work. Both tiers below lead with the
                # certainty of the mismatch and keep the raw match figure as
                # a parenthetical, so the number can't be read backwards.
                certainty = 1.0 - match_score

                # Two severity tiers, not one — see
                # SEMANTIC_MATCH_SEVERE_THRESHOLD's comment in app/config.py
                # for the measurement behind the split. A score this far
                # below every genuine photo this project has ever measured
                # (a portrait submitted as road-construction evidence, say)
                # is categorically different evidence from a hard-to-classify
                # but real site photo landing just under the ordinary bar,
                # and is scored — and worded — accordingly.
                if match_score < settings.SEMANTIC_MATCH_SEVERE_THRESHOLD:
                    code = "CONTENT_MISMATCH_SEVERE"
                    severity = "HIGH"
                    points = settings.WEIGHT_CONTENT_MISMATCH_SEVERE
                    message = (
                        f"This photograph does not show '{work_type}'. AI image "
                        f"analysis is {certainty:.1%} confident it does not — far "
                        f"beyond the uncertainty seen even on genuinely hard but "
                        f"real photos in this project's own calibration testing "
                        f"(lowest true match ever measured: 37.2%). "
                        f"(Match likelihood: {match_score:.1%}.)"
                    )
                else:
                    code = "CONTENT_MISMATCH"
                    severity = "MEDIUM"
                    points = settings.WEIGHT_CONTENT_MISMATCH
                    message = (
                        f"This photograph does not appear to show '{work_type}' — "
                        f"AI image analysis is {certainty:.1%} confident it does not. "
                        f"(It rates the likelihood of a genuine match at only "
                        f"{match_score:.1%}; anything under "
                        f"{settings.SEMANTIC_MATCH_THRESHOLD:.0%} is flagged.)"
                    )

                total_points += points
                assessment.flags.append(ScoredFlag(
                    code=code,
                    severity=severity,
                    message=message,
                    evidence={
                        "work_type": work_type,
                        "match_confidence": round(match_score, 4),
                        "mismatch_confidence": round(certainty, 4),
                        "threshold": settings.SEMANTIC_MATCH_THRESHOLD,
                        "severe_threshold": settings.SEMANTIC_MATCH_SEVERE_THRESHOLD,
                    },
                    points_added=points,
                ))

    # ── Step 5.2: OCR analysis (Receipts only) ───────────────────────
    # If the work type implies a receipt or document, run OCR to cross-check
    # the extracted amounts and dates.
    if work_type and work_type.lower() in ["receipt", "invoice", "document"]:
        from app.ocr_analysis import analyse_receipt
        ocr_result = analyse_receipt(
            image_path=image_path,
            sanction_date=sanction_date,
            claimed_amount=claimed_amount,
        )
        if ocr_result.available:
            if "RECEIPT_DATE_BEFORE_SANCTION" in ocr_result.flags:
                points = settings.WEIGHT_RECEIPT_DATE_MISMATCH
                total_points += points
                assessment.flags.append(ScoredFlag(
                    code="RECEIPT_DATE_BEFORE_SANCTION",
                    severity="HIGH",
                    message="OCR extracted a date on the receipt that predates the sanction date.",
                    evidence={"extracted_dates": ocr_result.extracted_dates},
                    points_added=points,
                ))
            if "RECEIPT_AMOUNT_MISMATCH" in ocr_result.flags:
                points = settings.WEIGHT_RECEIPT_AMOUNT_MISMATCH
                total_points += points
                assessment.flags.append(ScoredFlag(
                    code="RECEIPT_AMOUNT_MISMATCH",
                    severity="MEDIUM",
                    message="OCR extracted amounts that do not match the claimed amount.",
                    evidence={
                        "extracted_amounts": ocr_result.extracted_amounts,
                        "claimed_amount": claimed_amount,
                    },
                    points_added=points,
                ))
        else:
            assessment.layers_skipped.append("ocr")

    # ── Step 5.5: Resolve conditional flags ──────────────────────────
    # Now that every other flag (including semantic content-match) has
    # been computed, resolve any flags queued in pending_conditional_flags.
    total_points += _resolve_conditional_flags(assessment, pending_conditional_flags)

    # ── Step 6: Aggregate and cap ────────────────────────────────────
    assessment.risk_score = min(total_points, 100)
    assessment.risk_level = _score_from_level(assessment.risk_score)
    assessment.recommendation = _recommendation_from_level(assessment.risk_level)
    assessment.file_path = image_path

    elapsed_ms = int((time.time() - start_time) * 1000)
    assessment.processing_time_ms = elapsed_ms

    logger.info(
        "Risk assessment for work_id=%s: score=%d level=%s flags=%d time=%dms",
        work_id, assessment.risk_score, assessment.risk_level,
        len(assessment.flags), elapsed_ms,
    )

    return assessment


def _resolve_conditional_flags(assessment: RiskAssessment, pending: list[ScoredFlag]) -> int:
    """Resolve the points/severity/message for flags with context-dependent weight.

    General mechanism (Task 4): driven entirely by settings.CONDITIONAL_FLAG_WEIGHTS
    — this function never mentions a specific flag code. For each pending
    flag, picks the "with_others" branch if another flag that actually
    contributed risk (points_added > 0) is present on the assessment,
    else "alone", and mutates the ScoredFlag in place.

    Zero-point flags don't count toward "with_others" — they're purely
    informational absences (GPS_MISSING: no location from any source,
    scored 0), not an independent aggravating signal. Counting them
    would mean EXIF_STRIPPED escalates to its harsher 15-point weight
    just because a SECOND fact is also unknown, on a submission where
    nothing actually suspicious was found — exactly the alert-fatigue
    case this mechanism exists to avoid (see this file's module
    docstring / the README's Risk Scoring section), and exactly what
    happened in practice: analyse_metadata() started also reporting
    GPS_MISSING for an EXIF-less photo with no device location either,
    which is the common case (WhatsApp/web forms strip EXIF, and most
    submitters won't have granted browser geolocation) — silently
    tripping every such submission from the lenient "alone" branch to
    "with_others" with nothing genuinely new having been found.

    Args:
        assessment: The in-progress RiskAssessment (already has every
                    other flag appended — this must run after all other
                    scoring steps).
        pending:    ScoredFlag objects previously appended with
                    points_added=0, one per conditional flag raised.

    Returns:
        Total points to add to the running score (sum across `pending`).
    """
    added = 0
    for flag in pending:
        rule = settings.CONDITIONAL_FLAG_WEIGHTS.get(flag.code)
        if rule is None:
            continue  # shouldn't happen — caller only queues known codes
        other_flags_present = any(
            f.code != flag.code and f.points_added > 0 for f in assessment.flags
        )
        branch = rule["with_others"] if other_flags_present else rule["alone"]
        flag.points_added = branch["points"]
        flag.severity = branch["severity"]
        flag.message = branch["message"]
        added += branch["points"]
    return added


def _exif_flag_weight(flag_code: str) -> int:
    """Map an EXIF flag code to its risk score weight.

    Uses the configured weights from settings.  Falls back to 0
    for unknown flag codes (shouldn't happen, but defensive coding).
    """
    weights = {
        # Kept for callers/tests that use this legacy helper directly. The
        # live assessment path resolves EXIF_STRIPPED through the conditional
        # weighting table before this helper is reached.
        "EXIF_STRIPPED": settings.WEIGHT_EXIF_STRIPPED,
        "PHOTO_PREDATES_SANCTION": settings.WEIGHT_PHOTO_PREDATES_SANCTION,
        "PHOTO_FUTURE_DATED": settings.WEIGHT_PHOTO_PREDATES_SANCTION,  # Same weight as predates
        "GPS_MISSING": 0,  # GPS_MISSING is informational, scored at 0
        "GPS_DISTRICT_MISMATCH": settings.WEIGHT_GPS_MISMATCH,
        "SOFTWARE_EDITED": settings.WEIGHT_EDITING_SOFTWARE,
    }
    return weights.get(flag_code, 0)
