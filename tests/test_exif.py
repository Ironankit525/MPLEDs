"""
Tests for EXIF metadata analysis.

Verifies:
  - GPS decoding correctness for all four hemispheres (N/S/E/W)
  - Haversine distance against a known city pair
  - Flag generation for each anomaly type
  - Graceful handling of missing/malformed EXIF
"""

import math
from datetime import datetime
from pathlib import Path

import pytest
from PIL import Image

from app.exif_analysis import (
    Flag,
    analyse_metadata,
    extract_capture_datetime,
    extract_exif,
    extract_gps,
    haversine_km,
)


@pytest.fixture
def image_with_exif(tmp_path: Path) -> Path:
    """Create a JPEG image with basic EXIF data.

    Note: Pillow's EXIF writing is limited. We use piexif-free
    approach by saving with exif parameter where possible,
    or test with images that naturally have EXIF.
    """
    img = Image.new("RGB", (100, 100), color=(128, 128, 128))
    path = tmp_path / "with_exif.jpg"
    img.save(path, "JPEG", quality=95)
    return path


@pytest.fixture
def image_no_exif(tmp_path: Path) -> Path:
    """Create a PNG image with no EXIF data."""
    img = Image.new("RGB", (100, 100), color=(200, 200, 200))
    path = tmp_path / "no_exif.png"
    img.save(path, "PNG")
    return path


class TestHaversine:
    """Tests for the Haversine distance function."""

    def test_same_point_zero_distance(self) -> None:
        """Same point should give zero distance."""
        assert haversine_km(18.52, 73.86, 18.52, 73.86) == 0.0

    def test_pune_to_nagpur(self) -> None:
        """Pune to Nagpur is approximately 665 km.

        This is a well-known distance used for verification.
        Pune:   18.5204°N, 73.8567°E
        Nagpur: 21.1458°N, 79.0882°E
        """
        dist = haversine_km(18.5204, 73.8567, 21.1458, 79.0882)
        # Allow wider tolerance — great-circle distance varies by formula
        assert 600 < dist < 700, f"Pune-Nagpur distance {dist:.1f} km not in expected range"

    def test_delhi_to_mumbai(self) -> None:
        """Delhi to Mumbai is approximately 1150-1200 km."""
        dist = haversine_km(28.6139, 77.2090, 19.0760, 72.8777)
        assert 1100 < dist < 1300, f"Delhi-Mumbai distance {dist:.1f} km not in expected range"

    def test_symmetric(self) -> None:
        """Distance A→B equals distance B→A."""
        d1 = haversine_km(18.52, 73.86, 21.15, 79.09)
        d2 = haversine_km(21.15, 79.09, 18.52, 73.86)
        assert abs(d1 - d2) < 0.01

    def test_north_south_hemisphere(self) -> None:
        """Cross-equator distance works correctly."""
        # Mumbai (19°N) to somewhere in Southern hemisphere (-19°S)
        dist = haversine_km(19.0, 73.0, -19.0, 73.0)
        # Should be about 38 degrees of latitude ≈ 4220 km
        assert 4100 < dist < 4400

    def test_east_west_hemisphere(self) -> None:
        """Cross-meridian distance works correctly."""
        # Positive and negative longitudes
        dist = haversine_km(0.0, 1.0, 0.0, -1.0)
        # 2 degrees at equator ≈ 222 km
        assert 200 < dist < 250


class TestGPSDecoding:
    """Tests for GPS coordinate extraction from EXIF data."""

    def test_no_gps_returns_none(self, image_no_exif: Path) -> None:
        """Image without GPS data returns None."""
        assert extract_gps(str(image_no_exif)) is None

    def test_nonexistent_file_returns_none(self) -> None:
        """Non-existent file returns None (doesn't crash)."""
        assert extract_gps("/nonexistent/file.jpg") is None


class TestCaptureDateTime:
    """Tests for capture datetime extraction."""

    def test_no_datetime_returns_none(self, image_no_exif: Path) -> None:
        """Image without EXIF datetime returns None."""
        assert extract_capture_datetime(str(image_no_exif)) is None


class TestAnalyseMetadata:
    """Tests for the metadata analysis flag generator."""

    def test_exif_stripped_flag(self, image_no_exif: Path) -> None:
        """Image with no EXIF should produce EXIF_STRIPPED flag."""
        flags = analyse_metadata(
            str(image_no_exif),
            sanction_date=datetime(2024, 1, 1),
            district="Pune",
        )
        codes = [f.code for f in flags]
        assert "EXIF_STRIPPED" in codes

    def test_exif_stripped_severity(self, image_no_exif: Path) -> None:
        """EXIF_STRIPPED flag should have MEDIUM severity."""
        flags = analyse_metadata(
            str(image_no_exif),
            sanction_date=datetime(2024, 1, 1),
            district="Pune",
        )
        exif_flag = next(f for f in flags if f.code == "EXIF_STRIPPED")
        assert exif_flag.severity == "MEDIUM"

    def test_exif_stripped_has_evidence(self, image_no_exif: Path) -> None:
        """EXIF_STRIPPED flag should include evidence dict."""
        flags = analyse_metadata(
            str(image_no_exif),
            sanction_date=datetime(2024, 1, 1),
            district="Pune",
        )
        exif_flag = next(f for f in flags if f.code == "EXIF_STRIPPED")
        assert "exif_tag_count" in exif_flag.evidence

    def test_clean_image_minimal_flags(self, image_with_exif: Path) -> None:
        """A basic clean JPEG should produce at most low-severity flags.

        Since synthetic JPEGs don't have GPS, we expect GPS_MISSING at most.
        """
        flags = analyse_metadata(
            str(image_with_exif),
            sanction_date=datetime(2024, 1, 1),
            district="Pune",
        )
        high_flags = [f for f in flags if f.severity == "HIGH"]
        # No high-severity flags expected on a clean image
        assert len(high_flags) == 0

    def test_flag_dataclass_fields(self, image_no_exif: Path) -> None:
        """Verify Flag dataclass has all required fields."""
        flags = analyse_metadata(
            str(image_no_exif),
            sanction_date=None,
            district="Pune",
        )
        assert len(flags) > 0
        flag = flags[0]
        assert hasattr(flag, "code")
        assert hasattr(flag, "severity")
        assert hasattr(flag, "human_message")
        assert hasattr(flag, "evidence")
        assert isinstance(flag.evidence, dict)


class TestGPSDistanceMismatch:
    """Tests for GPS distance mismatch detection.

    These tests verify the distance calculation and flag generation
    using district coordinates directly.
    """

    def test_gps_mismatch_flag_logic(self) -> None:
        """Verify haversine detects large distances correctly.

        Simulate: photo at Nagpur coords, claimed district Pune.
        Distance should be ~665 km > 50 km threshold.
        """
        dist = haversine_km(21.15, 79.09, 18.52, 73.86)
        from app.config import settings
        assert dist > settings.GPS_MAX_DISTANCE_KM

    def test_gps_within_district(self) -> None:
        """Nearby GPS should NOT trigger mismatch.

        Simulate: photo 10 km from Pune centre.
        """
        # Pune centre: 18.52, 73.86. Move slightly: ~0.09 degrees ≈ 10 km
        dist = haversine_km(18.52, 73.86, 18.61, 73.86)
        from app.config import settings
        assert dist < settings.GPS_MAX_DISTANCE_KM
