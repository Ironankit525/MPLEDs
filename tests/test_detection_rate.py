"""
Slow regression test: runs the full detection-rate evaluation harness
(scripts/evaluate_detection.py) against the real fraud_manifest.json and
asserts the measured numbers stay above the acceptance bar.

This is intentionally NOT part of the fast unit-test suite — it exercises
the full assess_image() pipeline against ~13 real images through a
throwaway SQLite database, which is orders of magnitude slower than the
other 62 tests. Run explicitly with:

    pytest tests/test_detection_rate.py -v
    pytest -m slow -v

Excluded from a default run via -m "not slow".
"""

import pytest

from app.config import PROJECT_ROOT
from scripts.evaluate_detection import evaluate

MANIFEST_PATH = PROJECT_ROOT / "data" / "fraud_cases" / "fraud_manifest.json"
CLEAN_IMAGES_DIR = PROJECT_ROOT / "data" / "images"


@pytest.mark.slow
def test_detection_rate_meets_acceptance_bar() -> None:
    """Measured detection rate must be >= 90% and false-positive rate <= 10%.

    Runs with ENABLE_CLIP=False (hash + EXIF layers only) so this test
    doesn't require torch/transformers to be installed — the CLIP-enabled
    number is measured separately via `evaluate_detection.py --clip` and
    reported in the README, not gated by this fast-ish regression test.
    """
    report = evaluate(
        manifest_path=str(MANIFEST_PATH),
        clean_images_dir=str(CLEAN_IMAGES_DIR),
        enable_clip=False,
    )

    assert report.detection_rate_pct >= 90.0, (
        f"Detection rate {report.detection_rate_pct}% is below the 90% acceptance bar. "
        f"Failing cases: {[c.case_name for c in report.case_results if not c.passed]}"
    )
    assert report.fp_rate_pct <= 10.0, (
        f"False-positive rate {report.fp_rate_pct}% exceeds the 10% acceptance bar. "
        f"Flagged controls: {[r.file for r in report.fp_results if r.is_false_positive]}"
    )
