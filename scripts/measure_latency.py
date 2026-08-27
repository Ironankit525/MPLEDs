"""
Task 3.4: Measure per-image latency of each detection layer.

Reports mean latency for hashing-only, EXIF-only, CLIP-embedding-only, and
the full assess_image() pipeline, averaged over real images. Feeds the
README's Validation section and the "should CLIP move to an async worker"
recommendation (triggered if CLIP embedding exceeds ~800ms/image on CPU).

Usage:
    python -m scripts.measure_latency --images-dir data/real_images
"""

import argparse
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app.embeddings as embeddings_module
from app.config import PROJECT_ROOT, settings
from app.database import SEED_DISTRICTS
from app.exif_analysis import analyse_metadata, extract_capture_datetime, extract_gps
from app.hashing import compute_dhash, compute_phash, compute_sha256
from app.models import District
from app.risk_engine import assess_image

DEFAULT_IMAGES_DIR = PROJECT_ROOT / "data" / "real_images"
ASYNC_WORKER_THRESHOLD_MS = 800


@dataclass
class LatencyRow:
    stage: str
    mean_ms: float
    n: int


def _load_images(images_dir: Path, n_samples: int) -> list[Path]:
    exts = (".jpg", ".jpeg", ".png", ".webp")
    found = sorted(p for p in images_dir.iterdir() if p.is_file() and p.suffix.lower() in exts)
    if not found:
        raise FileNotFoundError(f"No images found in {images_dir}")
    return found[:n_samples]


def measure_latency(images_dir: str, n_samples: int = 20) -> list[LatencyRow]:
    images = _load_images(Path(images_dir), n_samples)
    rows: list[LatencyRow] = []

    # ── Hashing only ───────────────────────────────────────────────
    t0 = time.time()
    for p in images:
        compute_sha256(str(p))
        compute_phash(str(p))
        compute_dhash(str(p))
    rows.append(LatencyRow("hashing_only", 1000 * (time.time() - t0) / len(images), len(images)))

    # ── EXIF only ──────────────────────────────────────────────────
    t0 = time.time()
    for p in images:
        analyse_metadata(str(p), sanction_date=None, district=None, district_coords=None)
        extract_gps(str(p))
        extract_capture_datetime(str(p))
    rows.append(LatencyRow("exif_only", 1000 * (time.time() - t0) / len(images), len(images)))

    # ── CLIP embedding only (skipped cleanly if unavailable) ─────────
    embeddings_module._clip_engine_instance = None
    with patch.object(settings, "ENABLE_CLIP", True):
        from app.embeddings import get_clip_engine
        engine = get_clip_engine()
        engine._ensure_loaded()
        if engine.is_available:
            t0 = time.time()
            for p in images:
                engine.embed_image(str(p))
            rows.append(LatencyRow("clip_embedding_only", 1000 * (time.time() - t0) / len(images), len(images)))
        else:
            rows.append(LatencyRow("clip_embedding_only", -1.0, 0))
    embeddings_module._clip_engine_instance = None

    # ── Full pipeline (uses assess_image()'s own processing_time_ms) ─
    # Throwaway in-memory MongoDB via mongomock — never touches the real
    # DATABASE_URL. Predates the MongoDB migration: this used to build a
    # temporary SQLAlchemy/SQLite database, which stopped being possible
    # once SQLAlchemy left the dependency set entirely.
    import mongomock

    session = mongomock.MongoClient().latency_db
    for name, state, lat, lon in SEED_DISTRICTS:
        district = District(name=name, state=state, centre_latitude=lat, centre_longitude=lon)
        session.districts.insert_one(district.model_dump(by_alias=True, exclude={"id"}))

    full_times = []
    for i, p in enumerate(images):
        assessment = assess_image(
            image_path=str(p), work_id=f"LATENCY-TEST-{i:04d}", work_type="road construction",
            district="Pune", state="Maharashtra", mp_name=None,
            sanction_date=datetime(2024, 1, 1), session=session,
        )
        full_times.append(assessment.processing_time_ms)

    rows.append(LatencyRow("full_pipeline", sum(full_times) / len(full_times) if full_times else 0.0, len(full_times)))
    return rows


def print_latency_report(rows: list[LatencyRow]) -> None:
    print("PER-LAYER LATENCY (mean per image)")
    print(f"{'Stage':<24}{'Mean (ms)':>12}{'n':>6}")
    print("-" * 42)
    for r in rows:
        if r.mean_ms < 0:
            print(f"{r.stage:<24}{'N/A (CLIP unavailable)':>18}")
        else:
            print(f"{r.stage:<24}{r.mean_ms:>12.1f}{r.n:>6}")
    print()

    clip_row = next((r for r in rows if r.stage == "clip_embedding_only"), None)
    if clip_row and clip_row.mean_ms > ASYNC_WORKER_THRESHOLD_MS:
        print(
            f"NOTE: CLIP embedding averages {clip_row.mean_ms:.0f}ms/image on CPU, above the "
            f"~{ASYNC_WORKER_THRESHOLD_MS}ms guideline for staying on the request path. "
            f"Production deployment should move it to an async background worker rather "
            f"than blocking /api/images/submit."
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Measure per-image latency of each detection layer.")
    parser.add_argument("--images-dir", type=Path, default=DEFAULT_IMAGES_DIR)
    parser.add_argument("--n-samples", type=int, default=20)
    args = parser.parse_args()

    rows = measure_latency(str(args.images_dir), args.n_samples)
    print_latency_report(rows)
