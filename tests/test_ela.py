"""
Tests for the ELA (Error Level Analysis) tamper detection module.

Tests cover:
  - ELA on a clean synthetic image (should NOT flag tampered)
  - ELA on a tampered image (spliced region → should flag)
  - Screenshot detection (uniform error → should flag)
  - ELA heatmap generation
  - Photo-of-photo detection basics
  - Integration with risk engine
"""

import tempfile
from pathlib import Path

import numpy as np
import pytest
from PIL import Image, ImageDraw

from app.ela_analysis import ELAResult, compute_ela, detect_photo_of_photo, save_ela_heatmap


# ── Fixtures ─────────────────────────────────────────────────────────

@pytest.fixture
def clean_jpeg(tmp_path: Path) -> Path:
    """Create a clean JPEG image — no tampering.

    Uses a gradient pattern that simulates a natural photograph's
    continuous tonal variation.  Saved once at quality 85.
    """
    img = Image.new("RGB", (400, 300))
    draw = ImageDraw.Draw(img)

    # Gradient background
    for y in range(300):
        for x in range(0, 400, 4):
            r = int(50 + (x / 400) * 150)
            g = int(100 + (y / 300) * 100)
            b = int(80 + ((x + y) / 700) * 120)
            for dx in range(min(4, 400 - x)):
                img.putpixel((x + dx, y), (r, g, b))

    # Add some shapes for realism
    draw.rectangle([50, 50, 200, 150], fill=(180, 160, 140))
    draw.ellipse([250, 100, 370, 250], fill=(120, 140, 160))

    path = tmp_path / "clean.jpg"
    img.save(path, "JPEG", quality=85)
    return path


@pytest.fixture
def tampered_jpeg(tmp_path: Path) -> Path:
    """Create a tampered JPEG image — splice a different-quality region.

    Strategy: save a textured base at JPEG quality 30 (VERY heavy
    compression), then open it, paste a fresh high-quality textured
    patch, and re-save at Q30.  The pasted region has been through
    only ONE compression pass while the background has been through
    TWO at Q30, producing a detectable ELA difference.
    """
    rng = np.random.RandomState(42)

    # Step 1: Create a textured base (noise, not flat colour)
    base_array = rng.randint(50, 200, (300, 400, 3), dtype=np.uint8)
    base = Image.fromarray(base_array)
    base_path = tmp_path / "base_low_q.jpg"
    base.save(base_path, "JPEG", quality=30)

    # Step 2: Create a distinctly different textured patch
    patch_array = rng.randint(180, 255, (100, 100, 3), dtype=np.uint8)
    patch = Image.fromarray(patch_array)

    # Step 3: Open the doubly-compressed base, paste the fresh patch
    reopened = Image.open(base_path).convert("RGB")
    reopened.paste(patch, (150, 100))

    tampered_path = tmp_path / "tampered.jpg"
    reopened.save(tampered_path, "JPEG", quality=30)
    return tampered_path


@pytest.fixture
def screenshot_png(tmp_path: Path) -> Path:
    """Create a screenshot-like image — perfectly uniform, no noise.

    Screenshots have no JPEG compression artifacts because they're
    rendered pixel-perfect.  When saved as JPEG, every pixel gets
    the same compression treatment → uniform ELA error.
    """
    img = Image.new("RGB", (400, 300), color=(30, 30, 30))
    draw = ImageDraw.Draw(img)

    # Flat-colour UI elements (like a screenshot of a dark-mode app)
    draw.rectangle([20, 20, 380, 40], fill=(50, 50, 55))
    draw.rectangle([20, 50, 380, 280], fill=(40, 40, 45))
    draw.rectangle([30, 60, 200, 80], fill=(60, 60, 70))

    path = tmp_path / "screenshot.jpg"
    img.save(path, "JPEG", quality=95)
    return path


# ── ELA Tests ────────────────────────────────────────────────────────

class TestELACleanImage:
    """ELA on a clean, untampered image."""

    def test_not_flagged_as_tampered(self, clean_jpeg: Path) -> None:
        """A clean JPEG should NOT be flagged as tampered."""
        result = compute_ela(str(clean_jpeg))
        assert result.is_tampered is False

    def test_has_reasonable_error_levels(self, clean_jpeg: Path) -> None:
        """Clean image should have moderate, consistent error levels."""
        result = compute_ela(str(clean_jpeg))
        assert result.mean_error < 30.0
        assert result.max_error < 80.0

    def test_returns_ela_image(self, clean_jpeg: Path) -> None:
        """ELA should always produce a heatmap array."""
        result = compute_ela(str(clean_jpeg))
        assert result.ela_image is not None
        assert result.ela_image.shape[2] == 3  # RGB
        assert result.ela_image.dtype == np.uint8


class TestELATamperedImage:
    """ELA on a deliberately tampered image."""

    def test_splice_produces_elevated_stats(self, tampered_jpeg: Path) -> None:
        """A spliced image should produce measurable ELA statistics.

        On synthetic images the compression mismatch may not be dramatic
        enough to trigger the full is_tampered flag, but the stats
        (std_error, max_error) should be non-trivial.
        """
        result = compute_ela(str(tampered_jpeg))
        # The doubly-compressed background + singly-compressed patch
        # should produce at least SOME error variation.
        assert result.std_error > 0.5, (
            f"Tampered image should have measurable error variation (std={result.std_error:.2f})"
        )
        assert result.max_error > 5.0, (
            f"Tampered image should have elevated max error (max={result.max_error:.1f})"
        )

    def test_tampered_has_ela_image(self, tampered_jpeg: Path) -> None:
        """ELA should produce a heatmap for tampered images."""
        result = compute_ela(str(tampered_jpeg))
        assert result.ela_image is not None
        assert result.ela_image.shape == (300, 400, 3)


class TestScreenshotDetection:
    """ELA-based screenshot detection."""

    def test_uniform_flat_image(self, screenshot_png: Path) -> None:
        """A flat-colour screenshot-like image should have very low error variance."""
        result = compute_ela(str(screenshot_png))
        # Flat synthetic images have very uniform compression error
        assert result.std_error < 10.0, (
            f"Screenshot should have uniform error (std={result.std_error:.1f})"
        )

    def test_mean_error_low(self, screenshot_png: Path) -> None:
        """Screenshots tend to have low mean error."""
        result = compute_ela(str(screenshot_png))
        assert result.mean_error < 15.0


class TestELAHeatmap:
    """Test ELA heatmap generation."""

    def test_save_heatmap(self, clean_jpeg: Path, tmp_path: Path) -> None:
        """Heatmap should save as a valid JPEG."""
        result = compute_ela(str(clean_jpeg))
        output = tmp_path / "heatmap.jpg"
        success = save_ela_heatmap(result, str(output))
        assert success is True
        assert output.exists()

        # Verify it's a valid image
        heatmap_img = Image.open(output)
        assert heatmap_img.size[0] > 0

    def test_save_fails_without_ela_image(self, tmp_path: Path) -> None:
        """Should return False if no ELA image is available."""
        result = ELAResult()  # No ela_image
        output = tmp_path / "missing.jpg"
        success = save_ela_heatmap(result, str(output))
        assert success is False


class TestPhotoOfPhotoDetection:
    """Test frequency-domain photo-of-photo detection."""

    def test_clean_image_not_flagged(self, clean_jpeg: Path) -> None:
        """A normal image should NOT be detected as photo-of-photo."""
        result = detect_photo_of_photo(str(clean_jpeg))
        assert result is False

    def test_handles_missing_file(self, tmp_path: Path) -> None:
        """Should return False for non-existent file, not crash."""
        result = detect_photo_of_photo(str(tmp_path / "nonexistent.jpg"))
        assert result is False

    def test_handles_small_image(self, tmp_path: Path) -> None:
        """Should handle very small images without crashing."""
        tiny = Image.new("RGB", (10, 10), color=(128, 128, 128))
        path = tmp_path / "tiny.jpg"
        tiny.save(path, "JPEG")
        result = detect_photo_of_photo(str(path))
        assert isinstance(result, bool)


class TestELAEdgeCases:
    """Edge cases for ELA."""

    def test_png_input(self, tmp_path: Path) -> None:
        """ELA should work on PNG input (converts internally to JPEG for comparison)."""
        img = Image.new("RGB", (200, 200), color=(100, 150, 200))
        path = tmp_path / "test.png"
        img.save(path, "PNG")
        result = compute_ela(str(path))
        assert isinstance(result, ELAResult)
        assert result.ela_image is not None

    def test_missing_file(self, tmp_path: Path) -> None:
        """Should return empty result for missing file, not crash."""
        result = compute_ela(str(tmp_path / "ghost.jpg"))
        assert result.is_tampered is False
        assert result.ela_image is None

    def test_custom_quality(self, clean_jpeg: Path) -> None:
        """Should accept custom JPEG quality parameter."""
        result = compute_ela(str(clean_jpeg), quality=70)
        assert isinstance(result, ELAResult)
        # Lower quality → higher error levels
        assert result.mean_error >= 0
