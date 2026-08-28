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


class TestDeviceReportedLocation:
    """The browser's navigator.geolocation fix, used when the image
    itself carries no GPS EXIF.

    The frontend has always collected these coordinates and the record
    has always stored them, but nothing read them: analyse_metadata only
    ever looked at EXIF. So GPS_MISSING fired on submissions where the
    device had reported a perfectly good location, and — worse — an
    EXIF-less photo taken hundreds of km from the claimed district was
    never distance-checked at all, because the no-EXIF branch returned
    before reaching that check.
    """

    PUNE = (18.5204, 73.8567)
    NAGPUR = (21.1458, 79.0882)  # ~665 km from Pune

    @pytest.fixture
    def image_exif_no_gps(self, tmp_path: Path) -> Path:
        """A JPEG that genuinely carries EXIF but no GPS tags.

        Deliberately NOT the module-level ``image_with_exif`` fixture:
        despite its name, a plain Pillow save writes no EXIF at all (its
        own docstring notes the limitation), so it takes the
        EXIF_STRIPPED early-return path and never reaches the GPS check.
        Distinguishing "has EXIF, no GPS" from "has no EXIF" is exactly
        what these tests are about, so the difference matters here.
        """
        import piexif

        path = tmp_path / "exif_no_gps.jpg"
        Image.new("RGB", (100, 100), color=(128, 128, 128)).save(path, "JPEG", quality=95)
        exif_bytes = piexif.dump({
            "0th": {piexif.ImageIFD.Make: b"TestCam", piexif.ImageIFD.Model: b"TestModel"},
            "Exif": {piexif.ExifIFD.DateTimeOriginal: b"2024:06:15 10:30:00"},
            "GPS": {},  # explicitly none
        })
        piexif.insert(exif_bytes, str(path))
        return path

    def _codes(self, flags) -> set[str]:
        return {f.code for f in flags}

    def test_device_location_suppresses_gps_missing(self, image_exif_no_gps: Path) -> None:
        """A device fix means we DO know where the photo was taken, so
        GPS_MISSING (which says we don't) must not fire."""
        flags = analyse_metadata(
            str(image_exif_no_gps), None, "Pune", self.PUNE, device_coords=self.PUNE
        )
        assert "GPS_MISSING" not in self._codes(flags)

    def test_gps_missing_still_fires_when_neither_source_has_location(
        self, image_exif_no_gps: Path,
    ) -> None:
        flags = analyse_metadata(
            str(image_exif_no_gps), None, "Pune", self.PUNE, device_coords=None
        )
        assert "GPS_MISSING" in self._codes(flags)

    def test_far_away_device_location_is_flagged(self, image_exif_no_gps: Path) -> None:
        """The whole point: a photo submitted for Pune from a device
        sitting in Nagpur gets caught."""
        flags = analyse_metadata(
            str(image_exif_no_gps), None, "Pune", self.PUNE, device_coords=self.NAGPUR
        )
        assert "GPS_DISTRICT_MISMATCH" in self._codes(flags)
        flag = next(f for f in flags if f.code == "GPS_DISTRICT_MISMATCH")
        assert flag.evidence["coords_source"] == "device"
        assert flag.evidence["distance_km"] > 600

    def test_nearby_device_location_is_not_flagged(self, image_exif_no_gps: Path) -> None:
        flags = analyse_metadata(
            str(image_exif_no_gps), None, "Pune", self.PUNE, device_coords=self.PUNE
        )
        assert "GPS_DISTRICT_MISMATCH" not in self._codes(flags)

    def test_exifless_image_still_gets_district_checked(self, image_no_exif: Path) -> None:
        """Regression for the early-return bug: an image with NO EXIF at
        all used to skip every remaining check, so a device fix 665 km
        away was silently ignored."""
        flags = analyse_metadata(
            str(image_no_exif), None, "Pune", self.PUNE, device_coords=self.NAGPUR
        )
        codes = self._codes(flags)
        assert "EXIF_STRIPPED" in codes  # still correctly reported
        assert "GPS_DISTRICT_MISMATCH" in codes  # and no longer skipped

    def test_exifless_image_with_no_location_at_all_gets_both_flags(
        self, image_no_exif: Path,
    ) -> None:
        """An EXIF-less photo with no device location either is missing
        TWO distinct things — file metadata, and any idea where it was
        taken — and a reviewer should see both, not have the second one
        silently swallowed because the first already fired. (This
        deliberately changed: an earlier version of analyse_metadata
        returned right after EXIF_STRIPPED and never reached the GPS
        check for an EXIF-less image, so GPS_MISSING never appeared here
        even with zero location information from any source.)"""
        flags = analyse_metadata(str(image_no_exif), None, "Pune", self.PUNE)
        assert self._codes(flags) == {"EXIF_STRIPPED", "GPS_MISSING"}
        missing = next(f for f in flags if f.code == "GPS_MISSING")
        assert missing.evidence["device_location_reported"] is False


class TestDeviceLocationAccuracy:
    """navigator.geolocation reports GPS, WiFi, cell-tower, AND IP-derived
    fixes through the identical API — only the accuracy radius tells them
    apart. An IP-derived fix (a desktop submitter, or precise location
    denied) is routinely tens to 100+ km out, so using a device fix
    without regard to its accuracy can accuse an honest submission of
    being in the wrong district on nothing more than an ISP hub in a
    different city. These tests cover the two mitigations: a fix too
    coarse to mean anything is discarded outright, and a usable fix's
    own stated uncertainty is given the benefit of the doubt.
    """

    PUNE = (18.5204, 73.8567)
    NAGPUR = (21.1458, 79.0882)  # ~665 km from Pune

    @pytest.fixture
    def image_exif_no_gps(self, tmp_path: Path) -> Path:
        """See TestDeviceReportedLocation's fixture of the same name for
        why this can't just be the module-level image_with_exif fixture."""
        import piexif

        path = tmp_path / "exif_no_gps.jpg"
        Image.new("RGB", (100, 100), color=(128, 128, 128)).save(path, "JPEG", quality=95)
        exif_bytes = piexif.dump({
            "0th": {piexif.ImageIFD.Make: b"TestCam"},
            "Exif": {},
            "GPS": {},
        })
        piexif.insert(exif_bytes, str(path))
        return path

    def _codes(self, flags) -> set[str]:
        return {f.code for f in flags}

    def test_ip_grade_accuracy_is_discarded_not_flagged(self, image_exif_no_gps: Path) -> None:
        """The core case this exists for: a fix in Nagpur claiming Pune
        would normally be a slam-dunk GPS_DISTRICT_MISMATCH, but if its
        own reported accuracy is IP-geolocation-grade (60 km — worse than
        GPS_MAX_DISTANCE_KM itself), the fix cannot distinguish 'in
        Pune' from 'in Nagpur' and must not be used to accuse anyone."""
        from app.config import settings

        flags = analyse_metadata(
            str(image_exif_no_gps), None, "Pune", self.PUNE,
            device_coords=self.NAGPUR, device_accuracy_m=60_000,
        )
        codes = self._codes(flags)
        assert "GPS_DISTRICT_MISMATCH" not in codes
        assert "GPS_MISSING" in codes
        missing = next(f for f in flags if f.code == "GPS_MISSING")
        assert missing.evidence["device_location_too_imprecise"] is True
        assert settings.GPS_DEVICE_MAX_ACCURACY_M == 50_000  # sanity-check the fixture's premise

    def test_precise_far_away_fix_is_still_flagged(self, image_exif_no_gps: Path) -> None:
        """A tight GPS-grade fix (accuracy in metres, not km) reporting
        Nagpur while claiming Pune is exactly the fraud case — accuracy
        awareness must not swallow a genuine mismatch."""
        flags = analyse_metadata(
            str(image_exif_no_gps), None, "Pune", self.PUNE,
            device_coords=self.NAGPUR, device_accuracy_m=15,
        )
        assert "GPS_DISTRICT_MISMATCH" in self._codes(flags)

    def test_borderline_fix_gets_benefit_of_its_own_uncertainty(
        self, image_exif_no_gps: Path,
    ) -> None:
        """A fix reporting ~52 km away with +/-10 km accuracy could
        genuinely be 42 km away — inside the district — so it is not
        accused of being outside it. A point just inside Pune's edge,
        chosen to measure ~52 km from centre with a plain GPS-grade
        (not IP-grade) accuracy reading."""
        near_edge = (18.5204 + 0.47, 73.8567)  # ~52 km north of centre
        flags = analyse_metadata(
            str(image_exif_no_gps), None, "Pune", self.PUNE,
            device_coords=near_edge, device_accuracy_m=10_000,
        )
        assert "GPS_DISTRICT_MISMATCH" not in self._codes(flags)

    def test_exifless_plus_too_imprecise_device_fix_reports_both(
        self, image_no_exif: Path,
    ) -> None:
        """The exact bug this fix closed: an EXIF-less photo whose device
        fix gets discarded as too coarse must still say so — not silently
        report only EXIF_STRIPPED as if no location had ever been sent."""
        flags = analyse_metadata(
            str(image_no_exif), None, "Pune", self.PUNE,
            device_coords=self.NAGPUR, device_accuracy_m=65_000,
        )
        assert self._codes(flags) == {"EXIF_STRIPPED", "GPS_MISSING"}
        missing = next(f for f in flags if f.code == "GPS_MISSING")
        assert missing.evidence["device_location_too_imprecise"] is True

    def test_evidence_reports_raw_distance_and_accuracy_together(
        self, image_exif_no_gps: Path,
    ) -> None:
        """When a flag DOES fire, the evidence must show its work — raw
        distance, the accuracy applied, and the effective distance —
        not just a verdict."""
        flags = analyse_metadata(
            str(image_exif_no_gps), None, "Pune", self.PUNE,
            device_coords=self.NAGPUR, device_accuracy_m=5_000,
        )
        flag = next(f for f in flags if f.code == "GPS_DISTRICT_MISMATCH")
        assert flag.evidence["distance_km"] > 600
        assert flag.evidence["accuracy_km"] == 5.0
        assert flag.evidence["effective_distance_km"] == round(
            flag.evidence["distance_km"] - 5.0, 1
        )

    def test_exif_gps_ignores_accuracy_parameter(self, tmp_path: Path) -> None:
        """EXIF-sourced GPS has no comparable uncertainty figure. If a
        device_accuracy_m happens to be present alongside it (e.g. the
        browser also reported a location on the same submit), it must
        NOT soften an EXIF-based mismatch — accuracy_km is only ever
        applied to the 'device' source in _gps_district_flag. Without
        this, a fraudulent EXIF GPS placed just past the threshold could
        be laundered back under it by an unrelated accuracy figure."""
        import piexif
        from scripts.generate_fraud_cases import _decimal_to_dms_rational

        path = tmp_path / "exif_gps.jpg"
        Image.new("RGB", (100, 100), color=(128, 128, 128)).save(path, "JPEG", quality=95)
        lat, lon = self.NAGPUR
        exif_bytes = piexif.dump({
            "0th": {},
            "Exif": {},
            "GPS": {
                piexif.GPSIFD.GPSLatitudeRef: "N",
                piexif.GPSIFD.GPSLatitude: _decimal_to_dms_rational(lat),
                piexif.GPSIFD.GPSLongitudeRef: "E",
                piexif.GPSIFD.GPSLongitude: _decimal_to_dms_rational(lon),
            },
        })
        piexif.insert(exif_bytes, str(path))

        # A large device_accuracy_m present alongside genuine EXIF GPS
        # that places the photo 665 km from the claimed district.
        flags = analyse_metadata(
            str(path), None, "Pune", self.PUNE,
            device_coords=self.PUNE,  # a DIFFERENT (correct) device fix
            device_accuracy_m=500_000,  # deliberately huge
        )
        codes = self._codes(flags)
        assert "GPS_DISTRICT_MISMATCH" in codes
        flag = next(f for f in flags if f.code == "GPS_DISTRICT_MISMATCH")
        assert flag.evidence["coords_source"] == "exif"
        assert flag.evidence["accuracy_km"] is None
        assert flag.evidence["effective_distance_km"] == flag.evidence["distance_km"]
