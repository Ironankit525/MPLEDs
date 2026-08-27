"""
Task 2.2 / 3.3: Empirical threshold calibration against real photographs.

Every threshold in app/config.py (PHASH_*, EMBEDDING_*, SEMANTIC_MATCH_THRESHOLD)
was originally picked by guessing against synthetic gradient/shape images.
This script MEASURES the actual separation between "same photo, modified"
and "genuinely different photo" on real photographs, and prints a
recommendation — it never edits config.py itself. A human applies the
recommended values after reviewing the justification.

Modes:
    --mode phash      pHash Hamming distance calibration (Task 2.2)
    --mode embedding  CLIP embedding cosine-similarity calibration (needs CLIP)
    --mode semantic   CLIP zero-shot SEMANTIC_MATCH_THRESHOLD calibration (Task 3.3, needs CLIP)
    --mode all        Run all three

Usage:
    python -m scripts.calibrate_thresholds --mode phash
    python -m scripts.calibrate_thresholds --mode all
"""

import argparse
import itertools
import logging
import sys
import tempfile
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from random import Random
from typing import Any, Optional

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import PROJECT_ROOT, settings
from app.exif_analysis import extract_exif, extract_gps
from app.hashing import compute_phash, hamming_distance
from scripts.generate_fraud_cases import (
    RECOMPRESS_QUALITY,
    _transform_crop,
    _transform_resize,
    _transform_rotate,
    _transform_watermark,
)
from scripts.seed_database import (
    DEFAULT_REAL_IMAGES_DIR,
    WORK_TYPES,
    _load_real_images,
    _work_type_from_filename,
)

logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

TRANSFORMS = {
    "resize": _transform_resize,
    "crop": _transform_crop,
    "watermark": _transform_watermark,
    "rotate": _transform_rotate,
}


# ── Report dataclasses ───────────────────────────────────────────────

@dataclass
class DistributionStats:
    label: str
    n: int
    min: float = 0.0
    p5: float = 0.0
    p50: float = 0.0
    p90: float = 0.0
    p95: float = 0.0
    max: float = 0.0
    by_group: Optional[dict[str, "DistributionStats"]] = None


@dataclass
class ThresholdRecommendation:
    setting_name: str
    current_value: float
    recommended_value: float
    tp_rate: float
    fp_rate: float
    justification: str


@dataclass
class CorpusValidationResult:
    passed: bool
    count: int
    count_required: int
    pairs_count: int
    pairs_required: int
    exif_gps_count: int
    exif_gps_required: int
    dimension_warning: Optional[str]
    similar_subject_pairs: int
    similar_subject_total_pairs: int
    missing: list[str] = field(default_factory=list)


@dataclass
class CalibrationReport:
    generated_at: str
    metric: str  # "phash_hamming" | "embedding_cosine" | "semantic_zero_shot"
    distribution_a: DistributionStats  # the "positive"/should-be-caught class
    distribution_b: DistributionStats  # the "negative"/should-not-be-flagged class
    overlap_detected: bool
    hardest_transform: Optional[str]
    recommendations: list[ThresholdRecommendation] = field(default_factory=list)


# ── Stats + threshold sweep helpers ─────────────────────────────────

def _stats(label: str, values: list[float], by_group: Optional[dict[str, DistributionStats]] = None) -> DistributionStats:
    if not values:
        return DistributionStats(label=label, n=0, by_group=by_group)
    arr = np.asarray(values, dtype=float)
    return DistributionStats(
        label=label, n=len(values),
        min=float(np.min(arr)), p5=float(np.percentile(arr, 5)),
        p50=float(np.percentile(arr, 50)), p90=float(np.percentile(arr, 90)),
        p95=float(np.percentile(arr, 95)), max=float(np.max(arr)),
        by_group=by_group,
    )


def _sweep_lower_is_positive(
    positive_vals: list[float], negative_vals: list[float], max_fp_rate: float, candidates: list[float],
) -> tuple[float, float, float]:
    """Metrics where a LOW value indicates the positive (should-be-caught) class
    (e.g. pHash Hamming distance, or CLIP zero-shot score for a MISMATCH).

    Classification rule: value <= t => positive. Returns the LARGEST t (from
    ascending `candidates`) whose false-positive rate on `negative_vals`
    stays at or below `max_fp_rate`, plus the tp/fp rate achieved at that t.
    """
    best_t, best_tp, best_fp = candidates[0], 0.0, 0.0
    for t in candidates:
        fp_rate = (sum(1 for v in negative_vals if v <= t) / len(negative_vals)) if negative_vals else 0.0
        if fp_rate <= max_fp_rate:
            tp_rate = (sum(1 for v in positive_vals if v <= t) / len(positive_vals)) if positive_vals else 0.0
            best_t, best_tp, best_fp = t, tp_rate, fp_rate
        else:
            break  # fp_rate is monotonically non-decreasing in t
    return best_t, best_tp, best_fp


def _sweep_higher_is_positive(
    positive_vals: list[float], negative_vals: list[float], max_fp_rate: float, candidates: list[float],
) -> tuple[float, float, float]:
    """Metrics where a HIGH value indicates the positive class (e.g. CLIP
    cosine similarity for a duplicate).

    Classification rule: value >= t => positive. Returns the SMALLEST t
    (from descending `candidates`) whose false-positive rate on
    `negative_vals` stays at or below `max_fp_rate`.
    """
    best_t, best_tp, best_fp = candidates[-1], 0.0, 0.0
    for t in reversed(candidates):
        fp_rate = (sum(1 for v in negative_vals if v >= t) / len(negative_vals)) if negative_vals else 0.0
        if fp_rate <= max_fp_rate:
            tp_rate = (sum(1 for v in positive_vals if v >= t) / len(positive_vals)) if positive_vals else 0.0
            best_t, best_tp, best_fp = t, tp_rate, fp_rate
        else:
            break
    return best_t, best_tp, best_fp


def _apply_transforms_to_scratch(source: Path, tmp_dir: Path) -> dict[str, Path]:
    """Apply every transform in TRANSFORMS + recompression to `source`,
    saving each variant into `tmp_dir`. Returns {transform_name: path}.

    Reuses the EXACT SAME transform functions scripts/generate_fraud_cases.py
    uses to build the fraud test cases, per the task's own instruction to
    "generate the same transformations the fraud generator uses" — not a
    reimplementation.
    """
    img = Image.open(source)
    out: dict[str, Path] = {}
    for name, transform_fn in TRANSFORMS.items():
        variant = transform_fn(img)
        dest = tmp_dir / f"{source.stem}_{name}.jpg"
        variant.save(dest, "JPEG", quality=90)
        out[name] = dest

    recompressed = tmp_dir / f"{source.stem}_recompress.jpg"
    Image.open(source).convert("RGB").save(recompressed, "JPEG", quality=RECOMPRESS_QUALITY)
    out["recompress"] = recompressed
    return out


# ── Task 3.1: real-photo corpus validation gate ─────────────────────

def validate_real_corpus(
    real_images_dir: Path,
    count_required: int = 30,
    pairs_required: int = 3,
    exif_gps_required: int = 10,
) -> CorpusValidationResult:
    """Check data/real_images/ meets the minimum bar for a meaningful
    calibration run, BEFORE running anything expensive. Does not fall
    back to synthetic images and does not proceed with a partial corpus
    — a caller must stop and report `missing` verbatim if not `passed`.
    """
    exts = (".jpg", ".jpeg", ".png", ".webp")
    images = (
        sorted(p for p in real_images_dir.iterdir() if p.is_file() and p.suffix.lower() in exts)
        if real_images_dir.exists() else []
    )
    pairs_dir = real_images_dir / "pairs"
    pairs_images = (
        sorted(p for p in pairs_dir.iterdir() if p.is_file() and p.suffix.lower() in exts)
        if pairs_dir.exists() else []
    )
    pairs_count = len(pairs_images) // 2  # each pair = 2 photos of the same scene

    exif_gps_count = sum(1 for p in images if extract_gps(str(p)) is not None)

    dims: list[tuple[int, int]] = []
    for p in images:
        try:
            with Image.open(p) as img:
                dims.append(img.size)
        except Exception:
            pass
    dimension_warning = None
    if dims:
        common_dim, cnt = Counter(dims).most_common(1)[0]
        if cnt / len(dims) > 0.8:
            dimension_warning = (
                f"{cnt}/{len(dims)} images share identical dimensions {common_dim} "
                f"— suggests a single source (one camera/one shoot), not real-world variety."
            )

    similar_subject_pairs = 0
    total_pairs = 0
    if len(images) >= 2:
        hashes = [(p, compute_phash(str(p))) for p in images]
        for i in range(len(hashes)):
            for j in range(i + 1, len(hashes)):
                total_pairs += 1
                if hamming_distance(hashes[i][1], hashes[j][1]) <= settings.PHASH_SUSPICIOUS_THRESHOLD:
                    similar_subject_pairs += 1

    missing: list[str] = []
    if len(images) < count_required:
        missing.append(
            f"Count: need >= {count_required} images in {real_images_dir}, found {len(images)} "
            f"({count_required - len(images)} more needed)."
        )
    if pairs_count < pairs_required:
        missing.append(
            f"Pairs: need >= {pairs_required} same-scene pairs in {pairs_dir}, found {pairs_count} "
            f"({(pairs_required - pairs_count) * 2} more photos needed, as {pairs_required - pairs_count} pairs)."
        )
    if exif_gps_count < exif_gps_required:
        missing.append(
            f"EXIF+GPS: need >= {exif_gps_required} images carrying GPS in EXIF, found {exif_gps_count} "
            f"({exif_gps_required - exif_gps_count} more needed — check data/real_images/README.md's "
            f"'keep original camera EXIF intact' instruction)."
        )

    return CorpusValidationResult(
        passed=(len(missing) == 0),
        count=len(images), count_required=count_required,
        pairs_count=pairs_count, pairs_required=pairs_required,
        exif_gps_count=exif_gps_count, exif_gps_required=exif_gps_required,
        dimension_warning=dimension_warning,
        similar_subject_pairs=similar_subject_pairs, similar_subject_total_pairs=total_pairs,
        missing=missing,
    )


def print_corpus_validation(result: CorpusValidationResult, real_images_dir: Path) -> None:
    print("REAL-PHOTO CORPUS VALIDATION")
    print(f"  Directory: {real_images_dir}")
    print(f"  Count:          {result.count} / {result.count_required} required")
    print(f"  Same-scene pairs: {result.pairs_count} / {result.pairs_required} required")
    print(f"  Images with EXIF GPS: {result.exif_gps_count} / {result.exif_gps_required} required")
    if result.dimension_warning:
        print(f"  WARNING: {result.dimension_warning}")
    if result.similar_subject_total_pairs:
        print(
            f"  Similar-subject pairs (pHash distance <= {settings.PHASH_SUSPICIOUS_THRESHOLD}): "
            f"{result.similar_subject_pairs} / {result.similar_subject_total_pairs} total pairs"
        )
    print()
    if result.passed:
        print("CORPUS OK — proceeding.")
    else:
        print("CORPUS INADEQUATE — stopping. Exactly what's missing:")
        for m in result.missing:
            print(f"  - {m}")
        print()
        print("Not proceeding with a partial corpus and not falling back to synthetic images.")
    print()


# ── Task 2.2: pHash calibration ─────────────────────────────────────

def calibrate_phash(real_images_dir: str) -> CalibrationReport:
    images = _load_real_images(Path(real_images_dir))
    original_hashes = {p: compute_phash(str(p)) for p in images}

    dist_a_all: list[float] = []
    dist_a_by_transform: dict[str, list[float]] = defaultdict(list)

    with tempfile.TemporaryDirectory(prefix="mplads_calib_phash_") as tmp:
        tmp_path = Path(tmp)
        for p in images:
            variants = _apply_transforms_to_scratch(p, tmp_path)
            for name, variant_path in variants.items():
                dist = hamming_distance(original_hashes[p], compute_phash(str(variant_path)))
                dist_a_all.append(dist)
                dist_a_by_transform[name].append(dist)

    dist_b_all: list[float] = [
        hamming_distance(original_hashes[a], original_hashes[b])
        for a, b in itertools.combinations(images, 2)
    ]

    stats_a = _stats("TRUE DUPLICATES", dist_a_all, by_group={
        name: _stats(name, vals) for name, vals in dist_a_by_transform.items()
    })
    stats_b = _stats("DIFFERENT IMAGES", dist_b_all)

    overlap = bool(dist_a_all and dist_b_all and stats_a.p95 >= stats_b.p5)
    hardest = (
        max(dist_a_by_transform.items(), key=lambda kv: np.percentile(kv[1], 95))[0]
        if dist_a_by_transform else None
    )

    max_val = int(max([*dist_a_all, *dist_b_all, 0]))
    candidates = list(range(0, max_val + 1))
    dup_t, dup_tp, dup_fp = _sweep_lower_is_positive(dist_a_all, dist_b_all, 0.01, candidates)
    susp_t, susp_tp, susp_fp = _sweep_lower_is_positive(dist_a_all, dist_b_all, 0.05, candidates)

    recommendations = [
        ThresholdRecommendation(
            "PHASH_DUPLICATE_THRESHOLD", settings.PHASH_DUPLICATE_THRESHOLD, dup_t,
            round(dup_tp * 100, 1), round(dup_fp * 100, 2),
            "Largest Hamming-distance threshold keeping the false-positive rate on "
            "genuinely different images at or below 1%.",
        ),
        ThresholdRecommendation(
            "PHASH_SUSPICIOUS_THRESHOLD", settings.PHASH_SUSPICIOUS_THRESHOLD, susp_t,
            round(susp_tp * 100, 1), round(susp_fp * 100, 2),
            "Wider net for manual review — false-positive rate at or below 5%.",
        ),
    ]
    if overlap and hardest:
        recommendations.append(ThresholdRecommendation(
            "(ENABLE_ROTATION_ROBUST_HASH, not a threshold change)", 0, 0, 0, 0,
            f"Distributions overlap — no single global threshold is both safe and "
            f"complete. '{hardest}' is the hardest transform to catch (highest p95 "
            f"Hamming distance among transforms). NOT recommending a global threshold "
            f"increase to compensate — that would raise false positives on every case. "
            f"ENABLE_ROTATION_ROBUST_HASH targets this specifically by hashing rotated "
            f"variants of the incoming image and taking the minimum distance.",
        ))

    return CalibrationReport(
        generated_at=datetime.utcnow().isoformat(), metric="phash_hamming",
        distribution_a=stats_a, distribution_b=stats_b,
        overlap_detected=overlap, hardest_transform=hardest,
        recommendations=recommendations,
    )


# ── Task 2.2 (CLIP variant): embedding cosine-similarity calibration ─

def calibrate_embedding(real_images_dir: str) -> CalibrationReport:
    from app.embeddings import get_clip_engine
    engine = get_clip_engine()

    images = _load_real_images(Path(real_images_dir))
    original_embeddings = {}
    for p in images:
        emb = engine.embed_image(str(p))
        if emb is None:
            raise SystemExit(
                "CLIP is not available (torch/transformers not installed, or the "
                "model failed to load) — cannot run embedding calibration. Run "
                "`python -m scripts.download_models` first to verify CLIP works."
            )
        original_embeddings[p] = emb

    dist_a_all: list[float] = []
    dist_a_by_transform: dict[str, list[float]] = defaultdict(list)

    with tempfile.TemporaryDirectory(prefix="mplads_calib_emb_") as tmp:
        tmp_path = Path(tmp)
        for p in images:
            variants = _apply_transforms_to_scratch(p, tmp_path)
            for name, variant_path in variants.items():
                variant_emb = engine.embed_image(str(variant_path))
                if variant_emb is None:
                    continue
                sim = float(np.dot(original_embeddings[p], variant_emb))
                dist_a_all.append(sim)
                dist_a_by_transform[name].append(sim)

    dist_b_all: list[float] = [
        float(np.dot(original_embeddings[a], original_embeddings[b]))
        for a, b in itertools.combinations(images, 2)
    ]

    stats_a = _stats("TRUE DUPLICATES", dist_a_all, by_group={
        name: _stats(name, vals) for name, vals in dist_a_by_transform.items()
    })
    stats_b = _stats("DIFFERENT IMAGES", dist_b_all)

    overlap = bool(dist_a_all and dist_b_all and stats_a.p5 <= stats_b.p95)
    hardest = (
        min(dist_a_by_transform.items(), key=lambda kv: np.percentile(kv[1], 5))[0]
        if dist_a_by_transform else None
    )

    candidates = [i / 1000 for i in range(0, 1001)]
    dup_t, dup_tp, dup_fp = _sweep_higher_is_positive(dist_a_all, dist_b_all, 0.01, candidates)
    susp_t, susp_tp, susp_fp = _sweep_higher_is_positive(dist_a_all, dist_b_all, 0.05, candidates)

    recommendations = [
        ThresholdRecommendation(
            "EMBEDDING_DUPLICATE_THRESHOLD", settings.EMBEDDING_DUPLICATE_THRESHOLD, round(dup_t, 3),
            round(dup_tp * 100, 1), round(dup_fp * 100, 2),
            "Smallest cosine-similarity threshold keeping the false-positive rate on "
            "genuinely different images at or below 1%.",
        ),
        ThresholdRecommendation(
            "EMBEDDING_SUSPICIOUS_THRESHOLD", settings.EMBEDDING_SUSPICIOUS_THRESHOLD, round(susp_t, 3),
            round(susp_tp * 100, 1), round(susp_fp * 100, 2),
            "Wider net for manual review — false-positive rate at or below 5%.",
        ),
    ]

    return CalibrationReport(
        generated_at=datetime.utcnow().isoformat(), metric="embedding_cosine",
        distribution_a=stats_a, distribution_b=stats_b,
        overlap_detected=overlap, hardest_transform=hardest,
        recommendations=recommendations,
    )


# ── Task 3.3: SEMANTIC_MATCH_THRESHOLD calibration ──────────────────

def calibrate_semantic_match(real_images_dir: str) -> CalibrationReport:
    from app.embeddings import get_clip_engine
    engine = get_clip_engine()

    images = _load_real_images(Path(real_images_dir))
    rng = Random(42)

    # "Positive" class = a WRONG work-type claim (should be flagged CONTENT_MISMATCH).
    # "Negative" class = the CORRECT work-type claim (must not be flagged).
    #
    # correct_type MUST be what the photo actually depicts, not an
    # arbitrary index-cycled guess — this calibration measures CLIP's
    # ability to tell correct from wrong, which is meaningless if the
    # "correct" label was never actually correct. Photos named per
    # _work_type_from_filename's convention (see seed_database.py) carry
    # their real label; anything else falls back to cycling, same as
    # before, and the corpus validator's counts should be read with that
    # in mind for unlabeled images.
    wrong_scores: list[float] = []
    correct_scores: list[float] = []

    for i, p in enumerate(images):
        correct_type = _work_type_from_filename(p) or WORK_TYPES[i % len(WORK_TYPES)]
        correct_score = engine.zero_shot_match(str(p), correct_type)
        if correct_score is None:
            raise SystemExit(
                "CLIP is not available — cannot run semantic-match calibration. "
                "Run `python -m scripts.download_models` first."
            )
        correct_scores.append(correct_score)

        wrong_candidates = [w for w in WORK_TYPES if w != correct_type]
        for wrong_type in rng.sample(wrong_candidates, k=min(3, len(wrong_candidates))):
            wrong_score = engine.zero_shot_match(str(p), wrong_type)
            if wrong_score is not None:
                wrong_scores.append(wrong_score)

    stats_a = _stats("WRONG WORK TYPE (should flag)", wrong_scores)
    stats_b = _stats("CORRECT WORK TYPE (must not flag)", correct_scores)

    overlap = bool(wrong_scores and correct_scores and stats_a.p95 >= stats_b.p5)

    candidates = [i / 1000 for i in range(0, 1001)]
    t, tp, fp = _sweep_lower_is_positive(wrong_scores, correct_scores, 0.05, candidates)

    recommendations = [
        ThresholdRecommendation(
            "SEMANTIC_MATCH_THRESHOLD", settings.SEMANTIC_MATCH_THRESHOLD, round(t, 3),
            round(tp * 100, 1), round(fp * 100, 2),
            "Largest confidence threshold keeping the false-flag rate on genuinely "
            "correct work-type photos at or below 5%.",
        ),
    ]

    return CalibrationReport(
        generated_at=datetime.utcnow().isoformat(), metric="semantic_zero_shot",
        distribution_a=stats_a, distribution_b=stats_b,
        overlap_detected=overlap, hardest_transform=None,
        recommendations=recommendations,
    )


# ── Reporting ────────────────────────────────────────────────────────

_METRIC_LABELS = {
    "phash_hamming": "pHash Hamming distance",
    "embedding_cosine": "CLIP embedding cosine similarity",
    "semantic_zero_shot": "CLIP zero-shot match confidence",
}


def _fmt(x: float) -> str:
    return str(int(x)) if float(x).is_integer() else f"{x:.3f}"


def print_calibration_report(report: CalibrationReport) -> None:
    metric_label = _METRIC_LABELS.get(report.metric, report.metric)
    a, b = report.distribution_a, report.distribution_b

    print("THRESHOLD CALIBRATION REPORT")
    print()
    print(f"{metric_label} — {a.label} (n={a.n})")
    print(f"  min={_fmt(a.min)}  p50={_fmt(a.p50)}  p90={_fmt(a.p90)}  p95={_fmt(a.p95)}  max={_fmt(a.max)}")
    print()
    print(f"{metric_label} — {b.label} (n={b.n})")
    print(f"  min={_fmt(b.min)}  p5={_fmt(b.p5)}  p50={_fmt(b.p50)}  p90={_fmt(b.p90)}  max={_fmt(b.max)}")
    print()

    if report.overlap_detected:
        print(f"SEPARATION: {a.label} and {b.label} distributions OVERLAP -> no single threshold is both safe and complete")
    else:
        print(f"SEPARATION: clean gap between {a.label} and {b.label} distributions")

    if report.hardest_transform and a.by_group:
        print(f"HARDEST TO CATCH: '{report.hardest_transform}' (extreme-tail value among transforms)")
        for name, s in sorted(a.by_group.items(), key=lambda kv: -kv[1].p95):
            print(f"    {name:<12} p95={_fmt(s.p95)}  max={_fmt(s.max)}")
    print()

    for rec in report.recommendations:
        if rec.setting_name.startswith("("):
            print(f"NOTE: {rec.justification}")
        else:
            print(f"RECOMMENDED {rec.setting_name}: {rec.recommended_value}  (current default: {rec.current_value})")
            print(f"  (catches {rec.tp_rate}% of the '{a.label}' class, {rec.fp_rate}% false-positive rate on '{b.label}')")
            print(f"  {rec.justification}")
    print()


# ── CLI ──────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Empirically calibrate detection thresholds against real photographs."
    )
    parser.add_argument("--real-images-dir", type=Path, default=None)
    parser.add_argument("--mode", choices=["phash", "embedding", "semantic", "all"], default="phash")
    args = parser.parse_args()

    real_images_dir_path = args.real_images_dir or DEFAULT_REAL_IMAGES_DIR
    validation = validate_real_corpus(real_images_dir_path)
    print_corpus_validation(validation, real_images_dir_path)
    if not validation.passed:
        sys.exit(1)

    real_images_dir = str(real_images_dir_path)
    modes = ["phash", "embedding", "semantic"] if args.mode == "all" else [args.mode]

    dispatch = {
        "phash": calibrate_phash,
        "embedding": calibrate_embedding,
        "semantic": calibrate_semantic_match,
    }
    for mode in modes:
        report = dispatch[mode](real_images_dir)
        print_calibration_report(report)


if __name__ == "__main__":
    main()
