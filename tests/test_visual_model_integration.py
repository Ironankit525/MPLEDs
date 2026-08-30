"""Integration checks for the mandatory SigLIP visual-evidence model.

These tests deliberately load the real checkpoint. They complement the fast
mocked risk-engine tests and catch processor, prompt, dependency and model-cache
regressions that mocks cannot reveal.
"""

from pathlib import Path
from unittest.mock import patch

from PIL import Image, ImageDraw
import pytest

import app.screen_detection as screen_module
from app.config import PROJECT_ROOT, settings


pytestmark = pytest.mark.requires_visual_model


@pytest.fixture(scope="module")
def detector():
    with patch.object(settings, "ENABLE_SCREEN_MODEL", True):
        screen_module.reset_screen_detector()
        instance = screen_module.get_screen_detector()
        assert instance.load(), (
            "Mandatory SigLIP model could not load. Install requirements.lock "
            "and pre-download the configured model before deployment."
        )
        yield instance
        screen_module.reset_screen_detector()


def test_real_project_photo_passes_work_evidence(detector) -> None:
    result = detector.predict_work_evidence(
        str(PROJECT_ROOT / "data" / "real_images" / "bridge_01.jpg"),
        "bridge",
    )

    assert result.available
    assert result.top_category == "valid_project_evidence"
    assert result.valid_probability is not None
    assert result.valid_probability >= settings.WORK_EVIDENCE_VALID_THRESHOLD


def test_non_project_garden_display_is_rejected(detector) -> None:
    result = detector.predict_work_evidence(
        str(PROJECT_ROOT / "data" / "real_images" / "park_02.jpg"),
        "park",
    )

    assert result.available
    assert result.top_category != "valid_project_evidence"
    assert result.top_probability is not None
    assert result.valid_probability is not None
    assert result.top_probability >= settings.WORK_EVIDENCE_INVALID_THRESHOLD
    assert result.top_probability - result.valid_probability >= settings.WORK_EVIDENCE_INVALID_MARGIN


def test_generated_dashboard_is_detected_as_screen(detector, tmp_path: Path) -> None:
    path = tmp_path / "dashboard-screen.png"
    image = Image.new("RGB", (1200, 800), "#f5f7fb")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 1200, 72), fill="#172033")
    draw.text((35, 25), "MPLADS REVIEW DASHBOARD", fill="white")
    draw.rectangle((0, 72, 240, 800), fill="#202a3e")
    labels = (
        "Risk score: 65 HIGH",
        "Submission pending review",
        "Automated findings",
        "Approve    Reject",
    )
    for index, label in enumerate(labels):
        top = 110 + index * 150
        draw.rectangle((280, top, 1160, top + 120), fill="white", outline="#cbd5e1", width=3)
        draw.text((310, top + 25), label, fill="#172033")
    image.save(path)

    result = detector.predict(str(path))

    assert result.available
    assert result.screen_probability is not None
    assert result.screen_probability >= settings.SCREEN_MODEL_HIGH_THRESHOLD


@pytest.mark.parametrize("filename", ["bridge_01.jpg", "electricity_01.jpg", "hospital_01.jpg"])
def test_real_camera_photos_are_not_screens(detector, filename: str) -> None:
    result = detector.predict(str(PROJECT_ROOT / "data" / "real_images" / filename))

    assert result.available
    assert result.screen_probability is not None
    assert result.screen_probability < settings.SCREEN_MODEL_REVIEW_THRESHOLD
