"""Test-wide safety defaults for heavyweight optional model runtimes."""

import pytest
from unittest.mock import patch

from app.config import settings


@pytest.fixture(autouse=True)
def disable_screen_model_for_tests():
    """Avoid downloading SigLIP in unit tests; ML behavior is mocked explicitly."""
    with (
        patch.object(settings, "ENABLE_SCREEN_MODEL", False),
        patch.object(settings, "ALLOW_VISUAL_MODEL_TEST_BYPASS", True),
    ):
        yield
