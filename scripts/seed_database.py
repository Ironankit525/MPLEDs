"""
Seed the MPLADS database with real sample photographs.

Round 2 change: this script used to generate synthetic gradient/shape
images. Synthetic images have low visual entropy and produce artificially
distinct perceptual hashes — they're unusable for threshold calibration.
It now loads real photographs from data/real_images/ instead (see
data/real_images/README.md for what to add there) and inserts them as
"clean" work-completion records, giving scripts/calibrate_thresholds.py
and scripts/evaluate_detection.py a realistic baseline corpus to work
against.

Usage:
    python -m scripts.seed_database [--real-images-dir data/real_images] [--count 30]
"""

import argparse
import logging
import re
import shutil
import sys
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
from random import Random

from PIL import Image

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import IMAGES_DIR, PROJECT_ROOT, settings
from app.database import db, init_db
from app.hashing import compute_sha256, compute_phash, compute_dhash, hamming_distance
from app.exif_analysis import extract_exif, extract_gps, extract_capture_datetime
from app.models import ImageRecord

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Deterministic randomness for reproducible seeds (sanction-date spread)
rng = Random(42)

DEFAULT_REAL_IMAGES_DIR = PROJECT_ROOT / "data" / "real_images"

# ── Sample data for generating realistic records ────────────────────
# NOTE: scripts/evaluate_detection.py imports these two tables directly
# and depends on their exact order/content to reproduce the same
# district/work_id assignment scheme it uses for its own baseline
# ingestion (which in turn must match what fraud_manifest.json's
# hardcoded original_work_id values assume). Do not reorder or edit
# without checking scripts/evaluate_detection.py.

# These strings must be exact keys in app/config.py's WORK_TYPE_PROMPTS —
# they weren't (this list used to read "community hall construction",
# "drinking water facility", "drainage system", "bridge construction",
# "public toilet", "park development", "bus shelter", "street lighting").
# app/embeddings.py's zero_shot_match() does a plain dict .get() on the
# lowercased work_type, with a single generic prompt as the fallback for
# a miss — so 8 of these 10 were silently getting the weak generic
# prompt instead of WORK_TYPE_PROMPTS' tailored multi-prompt list, no
# matter how well-labeled or well-matched the underlying photo was. This
# was a second, independent cause of the near-zero content-match
# calibration numbers (see README's Calibration section), on top of the
# corpus's content/label problems themselves.
WORK_TYPES = [
    "road construction",
    "community hall",
    "school building",
    "water facility",
    "drainage",
    "bridge",
    "toilet",
    "park",
    "hospital",
    "electricity",
]

DISTRICTS_AND_MPS = [
    ("Pune", "Maharashtra", "Girish Bapat"),
    ("Nagpur", "Maharashtra", "Nitin Gadkari"),
    ("Lucknow", "Uttar Pradesh", "Rajnath Singh"),
    ("Varanasi", "Uttar Pradesh", "Narendra Modi"),
    ("Jaipur", "Rajasthan", "Ramcharan Bohra"),
    ("Patna", "Bihar", "Ravi Shankar Prasad"),
    ("Bhopal", "Madhya Pradesh", "Pragya Thakur"),
    ("Chennai", "Tamil Nadu", "Dayanidhi Maran"),
    ("Kolkata", "West Bengal", "Sudip Bandyopadhyay"),
    ("Bengaluru Urban", "Karnataka", "P C Mohan"),
]

_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")

_WORK_TYPE_BY_SLUG = {wt.replace(" ", "_"): wt for wt in WORK_TYPES}


def _work_type_from_filename(path: Path) -> str | None:
    """If a file is named ``<work_type_with_underscores>_<NN>.ext`` (e.g.
    ``road_construction_01.jpg``), return the real work type it names.

    Real, correctly-labeled photos (see data/real_images/README.md) are
    named this way specifically so their true category doesn't depend on
    index-cycling through WORK_TYPES — the same corpus/labeling problem
    diagnosed in the README's Calibration section for the *previous*
    (arbitrary, content-blind) real_N.jpg naming. Returns None for any
    file that doesn't follow the convention, so the caller falls back to
    cycling for those — kept for backward compatibility, not because
    cycling is preferred.
    """
    stem = re.sub(r"_\d+$", "", path.stem.lower())
    return _WORK_TYPE_BY_SLUG.get(stem)


def _load_real_images(real_images_dir: Path, min_count: int = 20) -> list[Path]:
    """Find real photographs directly inside `real_images_dir` (not `pairs/`).

    Raises SystemExit with a clear, actionable message if the directory
    is missing or contains fewer than `min_count` images — there is no
    synthetic fallback anymore, since synthetic images defeat the whole
    point of this script (real-world threshold calibration).
    """
    readme_hint = real_images_dir / "README.md"
    if not real_images_dir.exists():
        raise SystemExit(
            f"{real_images_dir} does not exist. Create it and add {min_count}-40 real "
            f"photographs (construction sites, roads, buildings, public infrastructure). "
            f"See {readme_hint} for instructions."
        )

    found = sorted(
        p for p in real_images_dir.iterdir()
        if p.is_file() and p.suffix.lower() in _IMAGE_EXTENSIONS
    )

    if len(found) < min_count:
        raise SystemExit(
            f"Only {len(found)} real photo(s) found in {real_images_dir} "
            f"(need at least {min_count}). Add {min_count}-40 real photographs of "
            f"construction sites, roads, buildings, or public infrastructure. "
            f"See {readme_hint} for instructions."
        )

    return found


def _warn_if_low_variety(images: list[Path]) -> None:
    """Print non-fatal warnings if the calibration set lacks real-world variety.

    A calibration set that's all one dimension, one camera, or full of
    near-duplicate shots will produce misleadingly tight distributions
    in scripts/calibrate_thresholds.py.
    """
    # ── Dimension variety ─────────────────────────────────────────
    dims: list[tuple[int, int]] = []
    for p in images:
        try:
            with Image.open(p) as img:
                dims.append(img.size)
        except Exception as e:
            logger.warning("Could not open %s for dimension check: %s", p.name, e)

    if dims:
        common_dim, common_count = Counter(dims).most_common(1)[0]
        frac = common_count / len(dims)
        if frac > 0.8:
            logger.warning(
                "%.0f%% of images share the same dimensions (%s) — this calibration "
                "set may not reflect real-world device variety.",
                frac * 100, common_dim,
            )

    # ── Same-camera-source check (EXIF Make/Model) ──────────────────
    makes: list[tuple] = []
    for p in images:
        exif = extract_exif(str(p))
        make_model = (exif.get("Make"), exif.get("Model"))
        if any(make_model):
            makes.append(make_model)

    if makes:
        common_make, common_count = Counter(makes).most_common(1)[0]
        frac = common_count / len(makes)
        if frac > 0.8:
            logger.warning(
                "%.0f%% of images with EXIF report the same camera (%s) — "
                "this calibration set may not reflect real-world device variety.",
                frac * 100, common_make,
            )
    else:
        logger.warning(
            "None of the %d images have EXIF Make/Model — cannot check camera "
            "variety. This usually also means EXIF was stripped before adding "
            "them here; see data/real_images/README.md.",
            len(images),
        )

    # ── Near-duplicate check ─────────────────────────────────────────
    hashes: list[tuple[Path, str]] = []
    for p in images:
        try:
            hashes.append((p, compute_phash(str(p))))
        except Exception as e:
            logger.warning("Could not hash %s: %s", p.name, e)

    near_dup_pairs = 0
    total_pairs = 0
    for i in range(len(hashes)):
        for j in range(i + 1, len(hashes)):
            total_pairs += 1
            if hamming_distance(hashes[i][1], hashes[j][1]) <= settings.PHASH_SUSPICIOUS_THRESHOLD:
                near_dup_pairs += 1

    if total_pairs and (near_dup_pairs / total_pairs) > 0.1:
        logger.warning(
            "%d/%d image pairs (%.0f%%) are near-duplicates (pHash distance <= %d) — "
            "this calibration set may contain too many similar/repeated photos.",
            near_dup_pairs, total_pairs, 100 * near_dup_pairs / total_pairs,
            settings.PHASH_SUSPICIOUS_THRESHOLD,
        )


def seed_database(real_images_dir: Path | None = None, count: int | None = None) -> None:
    """Load real photographs and insert them into the database as clean records.

    Args:
        real_images_dir: Directory containing real photos. Defaults to
                          data/real_images/.
        count:            Maximum number of images to seed. Defaults to
                           all images found (still subject to min_count=20
                           inside _load_real_images).
    """
    init_db()
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    real_images_dir = real_images_dir or DEFAULT_REAL_IMAGES_DIR
    found_images = _load_real_images(real_images_dir)
    _warn_if_low_variety(found_images)

    if count is not None:
        found_images = found_images[:count]

    try:
        existing = db.image_records.count_documents({})
        if existing > 0:
            logger.info("Database already has %d records. Skipping seed.", existing)
            return

        now = datetime.utcnow()
        eighteen_months_days = 18 * 30.44
        generated = 0
        # Collected and inserted in a single insert_many() at the end, so a
        # failure partway through leaves nothing behind — the closest
        # equivalent to the all-or-nothing session.commit()/rollback() this
        # used to rely on before the MongoDB migration.
        pending_docs: list[dict] = []

        for i, source_path in enumerate(found_images):
            # Identity scheme MUST match scripts/evaluate_detection.py's
            # own baseline-ingestion logic (see module docstring above).
            district, state, mp_name = DISTRICTS_AND_MPS[i % len(DISTRICTS_AND_MPS)]
            work_type = _work_type_from_filename(source_path) or WORK_TYPES[i % len(WORK_TYPES)]
            work_id = f"MP-{district[:3].upper()}-2024-{i + 1:04d}"

            # Sanction dates spread uniformly over the last 18 months
            sanction_date = now - timedelta(days=rng.uniform(0, eighteen_months_days))

            # Copy — never re-encode — to preserve real camera EXIF byte-for-byte
            dest_path = IMAGES_DIR / source_path.name
            shutil.copy2(source_path, dest_path)

            sha256 = compute_sha256(str(dest_path))
            phash = compute_phash(str(dest_path))
            dhash = compute_dhash(str(dest_path))
            exif_present = bool(extract_exif(str(dest_path)))
            gps = extract_gps(str(dest_path))
            capture_dt = extract_capture_datetime(str(dest_path))

            record = ImageRecord(
                work_id=work_id,
                work_type=work_type,
                district=district,
                state=state,
                mp_name=mp_name,
                sanction_date=sanction_date,
                file_path=str(dest_path),
                sha256=sha256,
                phash=phash,
                dhash=dhash,
                photo_timestamp=capture_dt,
                gps_latitude=gps[0] if gps else None,
                gps_longitude=gps[1] if gps else None,
                exif_present=exif_present,
                uploaded_at=datetime.utcnow(),
            )
            pending_docs.append(record.model_dump(by_alias=True, exclude={"id"}))
            generated += 1
            logger.info("Seeded: %s (%s, %s) <- %s", work_id, work_type, district, source_path.name)

        if pending_docs:
            db.image_records.insert_many(pending_docs)
        logger.info("Successfully seeded %d real images.", generated)

    except Exception:
        logger.exception("Failed to seed database.")
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Seed the MPLADS database with real photographs from data/real_images/."
    )
    parser.add_argument(
        "--real-images-dir", type=Path, default=None,
        help="Directory of real photos (default: data/real_images)",
    )
    parser.add_argument(
        "--count", type=int, default=None,
        help="Max number of images to seed (default: all found)",
    )
    args = parser.parse_args()
    seed_database(args.real_images_dir, args.count)
