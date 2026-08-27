"""
Task 1: Detection-rate evaluation harness for the MPLADS fraud detection module.

This is the single most important script in the project. Before it existed,
"the module detects fraud" was an unverified claim — 62 unit tests checked
individual functions in isolation, but nobody had ever run the full
assess_image() pipeline against the fraud_manifest.json ground truth and
counted how many cases it actually catches.

Round 3 change: reports THREE separate metrics rather than one conflated
number — a severity improvement (e.g. rotation-robust hashing moving a
case from MEDIUM to HIGH) is not the same thing as a detection improvement
(a flag that previously never fired), and collapsing them together hides
which one actually happened:

  Detection rate      Expected flag code appears in actual flags
  Severity accuracy   Case's risk LEVEL matches its expected_risk_level
  False positive rate Held-out clean images that raise any flag above LOW

Cases that can only be caught by a disabled layer (currently: CLIP) are
reported as SKIPPED, not FAILED, and excluded from both the detection and
severity denominators — conflating "cannot run" with "ran and failed"
understates what the hash/EXIF layers actually catch on their own.

What it does:
  1. Builds a throwaway temporary database (never touches data/mplads.db).
  2. Ingests a baseline "previously uploaded" corpus exactly as the real
     /api/images/submit endpoint would (via app.main._store_image_record).
  3. Runs every fraud case from fraud_manifest.json through assess_image()
     in DRY-RUN mode (assess, don't store) and checks whether the expected
     flag actually fired, and whether the risk level matches.
  4. Runs a held-out slice of the clean corpus — images NEVER added to the
     baseline — through assess_image() as false-positive controls.
  5. For every FAILING case, prints a diagnosis: the raw measured values
     (pHash/dHash/rotation-robust distances, cosine similarity, or raw
     EXIF values) and whether it looks like a bug, a too-tight threshold,
     or a genuine algorithm limitation.
  6. Prints a plain-text report, writes evaluation_report.json, and
     appends one line to evaluation_history.jsonl for --compare.

Usage:
    python -m scripts.evaluate_detection --no-clip
    python -m scripts.evaluate_detection --clip
    python -m scripts.evaluate_detection --no-clip --compare
"""

import argparse
import json
import logging
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pymongo.database import Database
import app.embeddings as embeddings_module
from app.config import PROJECT_ROOT, settings
from app.exif_analysis import extract_capture_datetime, extract_exif, extract_gps
from app.hashing import compute_dhash, compute_phash, compute_phash_rotation_robust, hamming_distance
from app.main import _store_image_record
from app.models import District
from app.database import SEED_DISTRICTS
from app.risk_engine import assess_image
from scripts.seed_database import DISTRICTS_AND_MPS, WORK_TYPES

# Keep this script's own output readable — assess_image() logs one INFO
# line per image internally, which would otherwise interleave with the
# printed tables below.
logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_MANIFEST = PROJECT_ROOT / "data" / "fraud_cases" / "fraud_manifest.json"
DEFAULT_CLEAN_IMAGES_DIR = PROJECT_ROOT / "data" / "images"
DEFAULT_OUTPUT = PROJECT_ROOT / "evaluation_report.json"
DEFAULT_HISTORY = PROJECT_ROOT / "evaluation_history.jsonl"

BASELINE_SANCTION_BASE = datetime(2024, 1, 15)
RISK_LEVEL_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}

# Static case_type -> primary detection layer mapping, verified against
# fraud_manifest.json's 10 cases (sums to 10/10):
#   exact_duplicate                                        -> sha256
#   resized/cropped/watermarked/rotated/recompressed_dup.  -> phash
#   exif_stripped, backdated_photo, wrong_district          -> exif
#   content_mismatch                                        -> clip
CASE_TYPE_LAYER: dict[str, str] = {
    "exact_duplicate": "sha256",
    "resized_duplicate": "phash",
    "cropped_duplicate": "phash",
    "watermarked_duplicate": "phash",
    "rotated_duplicate": "phash",
    "recompressed_duplicate": "phash",
    "exif_stripped": "exif",
    "backdated_photo": "exif",
    "wrong_district": "exif",
    "content_mismatch": "clip",
}
ALL_LAYERS = ["sha256", "phash", "clip", "exif"]


# ── Result dataclasses ────────────────────────────────────────────────

@dataclass
class CaseResult:
    case_name: str
    file: str
    expected_flags: list[str]
    actual_flags: list[str]
    score: int
    level: str
    expected_risk_level: str
    passed: bool           # detection: expected flag code present in actual flags
    severity_correct: bool  # level == expected_risk_level (only meaningful when status != SKIP)
    status: str             # "PASS" | "FAIL" | "SKIP"
    layer: str
    diagnosis: Optional[str] = None  # populated for FAIL (and SKIP, briefly)


@dataclass
class FPCaseResult:
    file: str
    work_id: str
    score: int
    level: str
    flags_raised: list[str]
    is_false_positive: bool


@dataclass
class LayerContribution:
    layer: str
    cases_caught: int
    cases_missed: int


@dataclass
class EvaluationReport:
    generated_at: str
    enable_clip: bool
    corpus: str  # "synthetic" | "real"
    config_snapshot: dict[str, Any]
    case_results: list[CaseResult] = field(default_factory=list)

    detection_count: int = 0
    detection_applicable_total: int = 0
    detection_rate_pct: float = 0.0
    skipped_case_names: list[str] = field(default_factory=list)

    severity_count: int = 0
    severity_applicable_total: int = 0
    severity_rate_pct: float = 0.0

    fp_results: list[FPCaseResult] = field(default_factory=list)
    fp_count: int = 0
    fp_total: int = 0
    fp_rate_pct: float = 0.0

    layer_contributions: list[LayerContribution] = field(default_factory=list)


# ── Temp database setup ─────────────────────────────────────────────

def _build_temp_db() -> Database:
    """Create a fresh, throwaway in-memory MongoDB (via mongomock) seeded
    with districts.

    Predates the MongoDB migration: this used to build a real throwaway
    SQLite file via SQLAlchemy (deliberately separate from the app's
    real database, per the original docstring below), but SQLAlchemy is
    no longer even installed in this project — that migration touched
    every other database access path (app/database.py, app/risk_engine.py,
    every test fixture) except this one, which is why it raised
    ``NameError: name 'create_engine' is not defined`` the moment this
    function actually ran. mongomock needs no on-disk file or engine to
    dispose afterwards, so there's no session-factory/engine pair to
    return any more — just the database handle itself, matching the
    ``db_session`` fixture pattern used throughout tests/.

    Never touches app.database.init_db() / the real DATABASE_URL — this
    is a fully separate, in-memory client.
    """
    import mongomock

    client = mongomock.MongoClient()
    db = client.eval_db
    for name, state, lat, lon in SEED_DISTRICTS:
        district = District(name=name, state=state, centre_latitude=lat, centre_longitude=lon)
        db.districts.insert_one(district.model_dump(by_alias=True, exclude={"id"}))
    return db


def _config_snapshot() -> dict[str, Any]:
    return {
        "PHASH_DUPLICATE_THRESHOLD": settings.PHASH_DUPLICATE_THRESHOLD,
        "PHASH_SUSPICIOUS_THRESHOLD": settings.PHASH_SUSPICIOUS_THRESHOLD,
        "DHASH_DUPLICATE_THRESHOLD": settings.DHASH_DUPLICATE_THRESHOLD,
        "DHASH_SUSPICIOUS_THRESHOLD": settings.DHASH_SUSPICIOUS_THRESHOLD,
        "EMBEDDING_DUPLICATE_THRESHOLD": settings.EMBEDDING_DUPLICATE_THRESHOLD,
        "EMBEDDING_SUSPICIOUS_THRESHOLD": settings.EMBEDDING_SUSPICIOUS_THRESHOLD,
        "SEMANTIC_MATCH_THRESHOLD": settings.SEMANTIC_MATCH_THRESHOLD,
        "GPS_MAX_DISTANCE_KM": settings.GPS_MAX_DISTANCE_KM,
        "ENABLE_ROTATION_ROBUST_HASH": getattr(settings, "ENABLE_ROTATION_ROBUST_HASH", None),
        "ENABLE_TILED_HASH": getattr(settings, "ENABLE_TILED_HASH", None),
    }


def _git_commit_hash() -> Optional[str]:
    """Short git commit hash, or None if not in a git repo (this project isn't)."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(PROJECT_ROOT), capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    return None


# ── Baseline ingestion ──────────────────────────────────────────────

def _ingest_baseline(image_paths: list[Path], session: Database) -> None:
    """Store each image as a normal submission (same path /api/images/submit uses).

    Uses EXACTLY the identity scheme scripts/seed_database.py uses —
    sorted index cycling through DISTRICTS_AND_MPS/WORK_TYPES, work_id =
    f"MP-{district[:3].upper()}-2024-{i+1:04d}". This is load-bearing:
    fraud_manifest.json's cases 1-7 hardcode
    original_work_id="MP-PUN-2024-0001", which only exists in this DB if
    index 0 resolves to Pune exactly as it does here.
    """
    for i, path in enumerate(image_paths):
        district, state, mp_name = DISTRICTS_AND_MPS[i % len(DISTRICTS_AND_MPS)]
        work_type = WORK_TYPES[i % len(WORK_TYPES)]
        sanction_date = BASELINE_SANCTION_BASE + timedelta(days=i * 10)
        work_id = f"MP-{district[:3].upper()}-2024-{i + 1:04d}"

        assessment = assess_image(
            image_path=str(path),
            work_id=work_id,
            work_type=work_type,
            district=district,
            state=state,
            mp_name=mp_name,
            sanction_date=sanction_date,
            session=session,
        )
        _store_image_record(
            assessment=assessment,
            work_id=work_id,
            work_type=work_type,
            district=district,
            state=state,
            mp_name=mp_name,
            sanction_date=sanction_date,
            # No real Cloudinary upload happens in this offline harness —
            # local and "storage" path are the same file. _store_image_record's
            # two-path split (local_file_path vs. storage_path) exists for
            # app/main.py's submit handler, which uploads local_file_path to
            # Cloudinary and records the resulting URL as storage_path.
            local_file_path=str(path),
            storage_path=str(path),
            session=session,
            # The offline harness has no authenticated request context. The
            # production endpoint supplies this value from Depends(); an
            # empty mapping preserves the same storage path without attaching
            # a synthetic submitter to evaluation records.
            current_user={},
        )


# ── Task 2.1: failure diagnosis ─────────────────────────────────────

def _diagnose_failure(
    case: dict,
    image_path: Path,
    clean_images_dir: Path,
    layer: str,
    enable_clip: bool,
) -> str:
    """Print the raw measured values behind a FAILED case and classify why.

    Returns one of three classifications, stated plainly:
      (a) THRESHOLD TOO TIGHT — the signal exists but sits outside the
          configured band. Do not fix by nudging the threshold here —
          that's calibration's job (Task 3), not a per-case patch.
      (b) ALGORITHM LIMITATION — the signal genuinely is not present in
          the measurement at all (e.g. cropping removes the visual
          content pHash keys off).
      (c) BUG — the code did not run the check it was supposed to run.
    """
    source_name = case.get("source")
    source_path = clean_images_dir / source_name if source_name else None

    if layer == "phash":
        if not (source_path and source_path.exists()):
            return "BUG: manifest 'source' image not found — cannot compare against baseline."

        cand_phash = compute_phash(str(image_path))
        cand_dhash = compute_dhash(str(image_path))
        src_phash = compute_phash(str(source_path))
        src_dhash = compute_dhash(str(source_path))
        phash_dist = hamming_distance(cand_phash, src_phash)
        dhash_dist = hamming_distance(cand_dhash, src_dhash)
        rotation_variants = compute_phash_rotation_robust(str(image_path))
        rotation_min_dist = min(hamming_distance(h, src_phash) for h in rotation_variants)

        threshold = settings.PHASH_DUPLICATE_THRESHOLD
        suspicious = settings.PHASH_SUSPICIOUS_THRESHOLD
        dhash_threshold = settings.DHASH_DUPLICATE_THRESHOLD
        dhash_suspicious = settings.DHASH_SUSPICIOUS_THRESHOLD
        detail = (
            f"pHash distance={phash_dist} (PHASH_DUPLICATE_THRESHOLD={threshold}, "
            f"PHASH_SUSPICIOUS_THRESHOLD={suspicious}), "
            f"dHash distance={dhash_dist} (DHASH_DUPLICATE_THRESHOLD={dhash_threshold}, "
            f"DHASH_SUSPICIOUS_THRESHOLD={dhash_suspicious}), "
            f"rotation-robust min distance={rotation_min_dist}"
        )
        if rotation_min_dist <= suspicious or dhash_dist <= dhash_suspicious:
            # The signal WAS inside a configured band somewhere — if this
            # case still failed, something's wrong in the wiring, not the
            # threshold value itself.
            return (
                f"BUG: {detail} — at least one configured hash check is within its "
                "suspicious band but the case still failed to flag."
            )
        elif rotation_min_dist <= suspicious * 2:
            return f"THRESHOLD TOO TIGHT: {detail} — signal exists but sits outside the configured band."
        else:
            return (
                f"ALGORITHM LIMITATION: {detail} — the transformation removes enough visual "
                f"structure that pHash (even rotation-robust) and dHash cannot see the signal at all. "
                f"No global threshold change would catch this without inflating false positives."
            )

    if layer == "exif":
        exif = extract_exif(str(image_path))
        gps = extract_gps(str(image_path))
        capture_dt = extract_capture_datetime(str(image_path))
        detail = f"exif_present={bool(exif)}, gps={gps}, capture_date={capture_dt}, expected_flags={case['expected_flags']}"
        if not exif:
            return f"ALGORITHM LIMITATION: {detail} — no EXIF at all, so the underlying rule has nothing to check."
        return f"BUG: {detail} — the raw data needed for the rule is present but the flag didn't fire."

    if layer == "clip":
        if not enable_clip:
            return "SKIPPED: this case requires CLIP (Layer 3), which is disabled in this run."
        from app.embeddings import get_clip_engine
        engine = get_clip_engine()
        work_type = case.get("work_type", "")
        score = engine.zero_shot_match(str(image_path), work_type)
        threshold = settings.SEMANTIC_MATCH_THRESHOLD
        detail = f"CLIP zero-shot confidence={score}, SEMANTIC_MATCH_THRESHOLD={threshold}"
        if score is None:
            return f"BUG: {detail} — CLIP was enabled but zero_shot_match returned None."
        if abs(score - threshold) < 0.1:
            return f"THRESHOLD TOO TIGHT: {detail} — close to the boundary."
        return f"ALGORITHM LIMITATION: {detail} — confidence is far from the threshold in either direction."

    if layer == "sha256":
        return "BUG: exact SHA-256 comparison has no threshold — a failure here means the source isn't in the baseline or the harness's work_id/district assignment is misaligned."

    return "No diagnosis available for this layer."


# ── Fraud case evaluation (dry run — never stored) ──────────────────

def _evaluate_fraud_cases(
    manifest: dict, fraud_cases_dir: Path, clean_images_dir: Path, session: Database, enable_clip: bool,
) -> list[CaseResult]:
    results: list[CaseResult] = []
    for case in manifest["cases"]:
        image_path = fraud_cases_dir / case["file"]
        sanction_date = None
        if case.get("sanction_date"):
            sanction_date = datetime.fromisoformat(case["sanction_date"])

        assessment = assess_image(
            image_path=str(image_path),
            work_id=case["work_id"],
            work_type=case.get("work_type"),
            district=case["district"],
            state=None,
            mp_name=None,
            sanction_date=sanction_date,
            session=session,
        )

        actual_codes = [f.code for f in assessment.flags]
        expected = case["expected_flags"]
        passed = any(code in actual_codes for code in expected)
        layer = CASE_TYPE_LAYER.get(case["case_type"], "unknown")
        expected_level = case.get("expected_risk_level", case.get("expected_risk", "UNKNOWN"))

        is_clip_only_and_disabled = (layer == "clip" and not enable_clip)
        if is_clip_only_and_disabled:
            status = "SKIP"
            severity_correct = False  # not meaningful; excluded from the denominator anyway
            diagnosis = _diagnose_failure(case, image_path, clean_images_dir, layer, enable_clip)
        elif passed:
            status = "PASS"
            severity_correct = (assessment.risk_level == expected_level)
            diagnosis = None
        else:
            status = "FAIL"
            severity_correct = False
            diagnosis = _diagnose_failure(case, image_path, clean_images_dir, layer, enable_clip)

        results.append(CaseResult(
            case_name=case["case_type"],
            file=case["file"],
            expected_flags=expected,
            actual_flags=actual_codes,
            score=assessment.risk_score,
            level=assessment.risk_level,
            expected_risk_level=expected_level,
            passed=passed,
            severity_correct=severity_correct,
            status=status,
            layer=layer,
            diagnosis=diagnosis,
        ))
    return results


# ── False-positive controls (dry run, held-out novel images) ────────

def _evaluate_fp_controls(
    holdout_images: list[Path],
    session: Database,
    start_index: int,
) -> list[FPCaseResult]:
    """Assess held-out images that were NEVER added to the baseline.

    These are genuinely novel content with no duplicate anywhere in the
    database — unlike resubmitting a baseline image under a new work_id
    (which would correctly trigger EXACT_DUPLICATE, a true positive, not
    a false alarm), this actually measures "does a legitimate new photo
    of a different site get spuriously flagged?"
    """
    results: list[FPCaseResult] = []
    for j, path in enumerate(holdout_images):
        i = start_index + j
        district, state, mp_name = DISTRICTS_AND_MPS[i % len(DISTRICTS_AND_MPS)]
        work_type = WORK_TYPES[i % len(WORK_TYPES)]
        sanction_date = BASELINE_SANCTION_BASE + timedelta(days=i * 10)
        work_id = f"MP-{district[:3].upper()}-2024-CTRL-{i + 1:04d}"

        assessment = assess_image(
            image_path=str(path),
            work_id=work_id,
            work_type=work_type,
            district=district,
            state=state,
            mp_name=mp_name,
            sanction_date=sanction_date,
            session=session,
        )
        flags_raised = [f.code for f in assessment.flags]
        results.append(FPCaseResult(
            file=path.name,
            work_id=work_id,
            score=assessment.risk_score,
            level=assessment.risk_level,
            flags_raised=flags_raised,
            is_false_positive=(assessment.risk_level != "LOW"),
        ))
    return results


# ── Top-level orchestration ─────────────────────────────────────────

def evaluate(
    manifest_path: str,
    clean_images_dir: str,
    enable_clip: bool,
    fraud_cases_dir: Optional[str] = None,
    fp_holdout_fraction: float = 0.3,
    corpus: str = "synthetic",
) -> EvaluationReport:
    """Run the full evaluation and return a machine-readable report.

    Args:
        manifest_path:       Path to fraud_manifest.json.
        clean_images_dir:    Directory of clean baseline images.
        enable_clip:         Whether to run with Layer 3 (CLIP) enabled.
        fraud_cases_dir:     Directory containing the fraud case images.
                              Defaults to manifest_path's parent directory.
        fp_holdout_fraction: Fraction of clean images held out (never
                              ingested into the baseline) to use as
                              false-positive controls. The remaining
                              images become the stored baseline corpus —
                              sorted-index identity must stay stable for
                              the fraud manifest's cross-work matches to
                              resolve, so the holdout is taken from the
                              END of the sorted list, not the start.
        corpus:               Label only ("synthetic" or "real") — recorded
                              in the report/history log, doesn't change
                              behaviour. Set to "real" when clean_images_dir
                              points at data/real_images.
    """
    manifest_file = Path(manifest_path)
    clean_dir = Path(clean_images_dir)
    fraud_dir = Path(fraud_cases_dir) if fraud_cases_dir else manifest_file.parent

    with open(manifest_file) as f:
        manifest = json.load(f)

    all_clean = sorted(clean_dir.glob("clean_*.jpg")) + sorted(clean_dir.glob("clean_*.png"))
    if not all_clean:
        raise FileNotFoundError(f"No clean_*.jpg/clean_*.png images found in {clean_dir}")

    n_holdout = max(1, round(len(all_clean) * fp_holdout_fraction))
    if n_holdout >= len(all_clean):
        n_holdout = 1  # always keep at least one baseline image
    baseline_images = all_clean[: len(all_clean) - n_holdout]
    holdout_images = all_clean[len(baseline_images):]

    session = _build_temp_db()
    with patch.object(settings, "ENABLE_CLIP", enable_clip):
        # Reset the CLIP singleton so a flipped ENABLE_CLIP takes
        # effect within this call rather than reusing a stale
        # _load_attempted decision from a previous evaluate() call
        # in the same process.
        embeddings_module._clip_engine_instance = None

        _ingest_baseline(baseline_images, session)
        case_results = _evaluate_fraud_cases(manifest, fraud_dir, clean_dir, session, enable_clip)
        fp_results = _evaluate_fp_controls(holdout_images, session, start_index=len(baseline_images))

    # Don't leak a CLIP engine instance built under a patched setting.
    embeddings_module._clip_engine_instance = None

    skipped = [c for c in case_results if c.status == "SKIP"]
    applicable = [c for c in case_results if c.status != "SKIP"]

    detection_count = sum(1 for c in applicable if c.passed)
    detection_applicable_total = len(applicable)
    severity_count = sum(1 for c in applicable if c.severity_correct)
    severity_applicable_total = len(applicable)

    fp_count = sum(1 for r in fp_results if r.is_false_positive)
    fp_total = len(fp_results)

    layer_contributions = [
        LayerContribution(
            layer=layer,
            cases_caught=sum(1 for c in applicable if c.layer == layer and c.passed),
            cases_missed=sum(1 for c in applicable if c.layer == layer and not c.passed),
        )
        for layer in ALL_LAYERS
    ]

    return EvaluationReport(
        generated_at=datetime.utcnow().isoformat(),
        enable_clip=enable_clip,
        corpus=corpus,
        config_snapshot=_config_snapshot(),
        case_results=case_results,
        detection_count=detection_count,
        detection_applicable_total=detection_applicable_total,
        detection_rate_pct=round(100 * detection_count / detection_applicable_total, 1) if detection_applicable_total else 0.0,
        skipped_case_names=[c.case_name for c in skipped],
        severity_count=severity_count,
        severity_applicable_total=severity_applicable_total,
        severity_rate_pct=round(100 * severity_count / severity_applicable_total, 1) if severity_applicable_total else 0.0,
        fp_results=fp_results,
        fp_count=fp_count,
        fp_total=fp_total,
        fp_rate_pct=round(100 * fp_count / fp_total, 1) if fp_total else 0.0,
        layer_contributions=layer_contributions,
    )


# ── Reporting ────────────────────────────────────────────────────────

def print_report(report: EvaluationReport) -> None:
    print("FRAUD DETECTION EVALUATION")
    print(
        f"Config: ENABLE_CLIP={report.enable_clip} | corpus={report.corpus} | "
        f"phash_threshold={report.config_snapshot['PHASH_DUPLICATE_THRESHOLD']} | "
        f"embedding_threshold={report.config_snapshot['EMBEDDING_DUPLICATE_THRESHOLD']}"
    )
    print()

    header = f"{'CASE':<26} {'EXPECTED FLAG':<42} {'ACTUAL/EXP LEVEL':<20} {'SCORE':>5}  STATUS"
    print(header)
    print("-" * len(header))
    for c in report.case_results:
        expected_str = "/".join(c.expected_flags)
        level_str = f"{c.level}/{c.expected_risk_level}" if c.status != "SKIP" else "-"
        print(f"{c.case_name:<26} {expected_str:<42} {level_str:<20} {c.score:>5}  {c.status}")
    print("-" * len(header))

    skip_note = f"  [{len(report.skipped_case_names)} case(s) skipped: {', '.join(report.skipped_case_names)}]" if report.skipped_case_names else ""
    print(
        f"DETECTION RATE: {report.detection_count}/{report.detection_applicable_total} applicable "
        f"({report.detection_rate_pct}%){skip_note}"
    )
    print(
        f"SEVERITY ACCURACY: {report.severity_count}/{report.severity_applicable_total} applicable "
        f"({report.severity_rate_pct}%)  [level matches expected_risk_level]"
    )
    print()

    failing = [c for c in report.case_results if c.status == "FAIL"]
    if failing:
        print("DIAGNOSIS FOR FAILING CASES")
        for c in failing:
            print(f"  {c.case_name}:")
            print(f"    expected={c.expected_flags}  actual={c.actual_flags}  score={c.score}  level={c.level}")
            print(f"    {c.diagnosis}")
        print()

    print(f"FALSE POSITIVE CHECK  (held-out images never added to the baseline, corpus={report.corpus})")
    fp_header = f"{'CLEAN IMAGE':<26}{'SCORE':>6}  {'LEVEL':<8} FLAGS RAISED"
    print(fp_header)
    print("-" * len(fp_header))
    for r in report.fp_results:
        flags_str = ", ".join(r.flags_raised) if r.flags_raised else "-"
        print(f"{r.file:<26}{r.score:>6}  {r.level:<8} {flags_str}")
    print("-" * len(fp_header))
    print(f"FALSE POSITIVE RATE: {report.fp_count}/{report.fp_total} ({report.fp_rate_pct}%)")
    print()

    print("PER-LAYER CONTRIBUTION")
    print(f"{'Layer':<15}{'Cases caught':<15}Cases missed")
    for lc in report.layer_contributions:
        print(f"{lc.layer:<15}{lc.cases_caught:<15}{lc.cases_missed}")
    print()


# ── Task 1.3: regression log + --compare ────────────────────────────

def _history_line(report: EvaluationReport) -> dict[str, Any]:
    return {
        "timestamp": report.generated_at,
        "git_commit": _git_commit_hash(),
        "config_snapshot": report.config_snapshot,
        "enable_clip": report.enable_clip,
        "corpus": report.corpus,
        "detection_rate_pct": report.detection_rate_pct,
        "detection_count": report.detection_count,
        "detection_applicable_total": report.detection_applicable_total,
        "severity_rate_pct": report.severity_rate_pct,
        "severity_count": report.severity_count,
        "severity_applicable_total": report.severity_applicable_total,
        "fp_rate_pct": report.fp_rate_pct,
        "fp_count": report.fp_count,
        "fp_total": report.fp_total,
        # Per-case status/level so --compare can diff individual cases —
        # the task's own --compare example needs this even though it
        # isn't literally one of "the three metrics".
        "cases": [
            {
                "case_name": c.case_name, "status": c.status, "level": c.level,
                "expected_risk_level": c.expected_risk_level,
            }
            for c in report.case_results
        ],
    }


def append_history(report: EvaluationReport, history_path: Path) -> None:
    with open(history_path, "a") as f:
        f.write(json.dumps(_history_line(report)) + "\n")


def _read_history(history_path: Path) -> list[dict[str, Any]]:
    if not history_path.exists():
        return []
    lines = []
    with open(history_path) as f:
        for line in f:
            line = line.strip()
            if line:
                lines.append(json.loads(line))
    return lines


def _case_transition_note(
    prev_status: str, prev_level: str, prev_expected: str,
    curr_status: str, curr_level: str, curr_expected: str,
) -> str:
    """Describe what changed for one case between two runs.

    Severity comparisons are relative to expected_risk_level, not raw
    level rank — a level DROPPING from HIGH to MEDIUM is a correction,
    not a regression, if MEDIUM is what was actually expected. Comparing
    raw rank alone would call that "degraded," which is backwards.
    """
    if prev_status != curr_status:
        if prev_status == "SKIP" and curr_status == "PASS":
            return "CLIP enabled"
        if prev_status == "SKIP" and curr_status == "FAIL":
            return "CLIP enabled, still fails"
        if prev_status == "FAIL" and curr_status == "PASS":
            return "fixed"
        if prev_status == "PASS" and curr_status == "FAIL":
            return "REGRESSION"
        if curr_status == "SKIP":
            return "CLIP disabled"
        return "status changed"

    if prev_status == "FAIL":
        return "still fails (level changed — config difference, not a fix)" if prev_level != curr_level else "no change"

    if prev_status == "PASS" and prev_level != curr_level:
        prev_correct = (prev_level == prev_expected)
        curr_correct = (curr_level == curr_expected)
        if not prev_correct and curr_correct:
            return "severity corrected"
        if prev_correct and not curr_correct:
            return "severity REGRESSED"
        prev_rank = RISK_LEVEL_ORDER.get(prev_level, -1)
        curr_rank = RISK_LEVEL_ORDER.get(curr_level, -1)
        return "severity improved" if curr_rank > prev_rank else "severity degraded"

    return "no change"


def print_compare(current: EvaluationReport, history_path: Path) -> None:
    """Diff `current` against the last entry already in evaluation_history.jsonl
    (i.e. the run BEFORE this one — call this before append_history())."""
    history = _read_history(history_path)
    if not history:
        print("No previous run in evaluation_history.jsonl to compare against.")
        print()
        return

    previous = history[-1]
    prev_cases = {c["case_name"]: c for c in previous.get("cases", [])}

    print(f"CHANGES SINCE LAST RUN ({previous['timestamp']} -> {current.generated_at})")
    for c in current.case_results:
        prev = prev_cases.get(c.case_name)
        if prev is None:
            print(f"  {c.case_name:<24} (new case)")
            continue
        prev_label = "SKIP" if prev["status"] == "SKIP" else prev["level"]
        curr_label = "SKIP" if c.status == "SKIP" else c.level
        note = _case_transition_note(
            prev["status"], prev["level"], prev.get("expected_risk_level", prev["level"]),
            c.status, c.level, c.expected_risk_level,
        )
        marker = "  ⚠" if "REGRESS" in note else ""
        print(f"  {c.case_name:<24} {prev_label:<8}-> {curr_label:<8} ({note}){marker}")

    def _delta_line(label: str, prev_val: float, curr_val: float, higher_is_better: bool) -> None:
        delta = round(curr_val - prev_val, 1)
        sign = "+" if delta >= 0 else ""
        regressed = (delta < 0 if higher_is_better else delta > 0)
        marker = "  ⚠ REGRESSION" if regressed and delta != 0 else ""
        print(f"{label}: {prev_val}% -> {curr_val}%  ({sign}{delta}){marker}")

    print()
    _delta_line("Detection", previous["detection_rate_pct"], current.detection_rate_pct, higher_is_better=True)
    _delta_line("Severity accuracy", previous["severity_rate_pct"], current.severity_rate_pct, higher_is_better=True)
    _delta_line("False positives", previous["fp_rate_pct"], current.fp_rate_pct, higher_is_better=False)
    print()


# ── CLI ──────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Evaluate the MPLADS fraud detection pipeline against fraud_manifest.json."
    )
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--clean-images-dir", type=Path, default=DEFAULT_CLEAN_IMAGES_DIR)
    parser.add_argument("--fraud-cases-dir", type=Path, default=None)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--history", type=Path, default=DEFAULT_HISTORY)
    parser.add_argument("--corpus", choices=["synthetic", "real"], default="synthetic")
    parser.add_argument(
        "--fp-holdout-fraction", type=float, default=0.3,
        help="Fraction of clean images held out as false-positive controls (default 0.3).",
    )
    parser.add_argument("--compare", action="store_true", help="Diff against the previous evaluation_history.jsonl entry.")
    clip_group = parser.add_mutually_exclusive_group()
    clip_group.add_argument("--clip", action="store_true", help="Enable CLIP (Layer 3) during evaluation.")
    clip_group.add_argument("--no-clip", action="store_true", help="Disable CLIP — hash + EXIF only (default).")
    args = parser.parse_args()

    enable_clip = bool(args.clip)

    report = evaluate(
        manifest_path=str(args.manifest),
        clean_images_dir=str(args.clean_images_dir),
        enable_clip=enable_clip,
        fraud_cases_dir=str(args.fraud_cases_dir) if args.fraud_cases_dir else None,
        fp_holdout_fraction=args.fp_holdout_fraction,
        corpus=args.corpus,
    )
    print_report(report)

    if args.compare:
        print_compare(report, args.history)

    with open(args.output, "w") as f:
        json.dump(asdict(report), f, indent=2)
    print(f"Full report written to: {args.output}")

    append_history(report, args.history)
    print(f"Appended to: {args.history}")


if __name__ == "__main__":
    main()
