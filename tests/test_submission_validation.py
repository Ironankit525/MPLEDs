"""Request validation that prevents primary assessment layers being skipped."""

import os

import pytest
from fastapi import HTTPException
from unittest.mock import Mock, patch

from app.config import settings
from app.main import _validate_submission_metadata, startup_event


def test_work_type_is_required() -> None:
    with pytest.raises(HTTPException) as error:
        _validate_submission_metadata(None, None)

    assert error.value.status_code == 422
    assert "work_type" in str(error.value.detail)


def test_receipt_requires_sanction_date() -> None:
    with pytest.raises(HTTPException) as error:
        _validate_submission_metadata("receipt", None)

    assert error.value.status_code == 422
    assert "sanction_date" in str(error.value.detail)


def test_regular_work_can_be_assessed_without_receipt_date() -> None:
    _validate_submission_metadata("road construction", None)


def test_vercel_startup_requires_durable_image_storage() -> None:
    with (
        patch.dict(os.environ, {"VERCEL": "1"}),
        patch("app.main.init_db") as init_db,
        patch.object(settings, "CLOUDINARY_CLOUD_NAME", ""),
        patch.object(settings, "CLOUDINARY_API_KEY", ""),
        patch.object(settings, "CLOUDINARY_API_SECRET", ""),
        pytest.raises(RuntimeError, match="Cloudinary is required on Vercel"),
    ):
        startup_event()

    # Configuration must fail before a database connection or model load.
    init_db.assert_not_called()


def test_startup_rejects_disabled_mandatory_visual_model() -> None:
    with (
        patch("app.main.init_db"),
        patch.object(settings, "ENABLE_SCREEN_MODEL", False),
        patch.object(settings, "ALLOW_VISUAL_MODEL_TEST_BYPASS", False),
        pytest.raises(RuntimeError, match="Mandatory SigLIP visual validation is disabled"),
    ):
        startup_event()


def test_startup_rejects_visual_model_load_failure() -> None:
    detector = Mock()
    detector.load.return_value = False

    with (
        patch("app.main.init_db"),
        patch("app.main.get_screen_detector", return_value=detector),
        patch.object(settings, "ENABLE_SCREEN_MODEL", True),
        patch.object(settings, "ALLOW_VISUAL_MODEL_TEST_BYPASS", False),
        pytest.raises(RuntimeError, match="Mandatory visual model.*could not load"),
    ):
        startup_event()
