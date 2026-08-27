"""
EXIF metadata extraction and anomaly analysis.

Extracts capture date, GPS coordinates, and software tags from image
EXIF data, then checks for red flags:
  - Missing EXIF (possible evidence of deliberate stripping)
  - Photo taken before the work was sanctioned (recycled evidence)
  - Photo taken in the future (clock manipulation)
  - GPS coordinates far from the claimed district (wrong location)
  - Editing software fingerprints (possible manipulation)
"""

import logging
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS

from app.config import settings

logger = logging.getLogger(__name__)


# ── Flag dataclass ───────────────────────────────────────────────────

@dataclass
class Flag:
    """A single anomaly flag raised during metadata analysis.

    Attributes:
        code:           Machine-readable flag identifier (e.g. GPS_DISTRICT_MISMATCH).
        severity:       LOW, MEDIUM, or HIGH — indicates how concerning this finding is.
        human_message:  Plain-English explanation suitable for a dashboard.
        evidence:       Dict of raw values that triggered the flag — essential for
                        the dashboard to show *why* something was flagged and for
                        auditors to verify the finding.
    """
    code: str
    severity: str  # "LOW", "MEDIUM", "HIGH"
    human_message: str
    evidence: dict[str, Any] = field(default_factory=dict)


# ── Known photo editing software patterns ────────────────────────────
# These strings appear in the EXIF 'Software' tag when an image has been
# processed by common editing tools.  Presence doesn't prove fraud, but
# it's a useful signal when combined with other flags.
EDITING_SOFTWARE_PATTERNS = [
    "photoshop",
    "gimp",
    "lightroom",
    "paint.net",
    "pixlr",
    "snapseed",
    "afterlight",
    "vsco",
    "canva",
    "photoscape",
    "acdsee",
    "affinity",
    "capture one",
    "darktable",
    "rawtherapee",
]


def extract_exif(image_path: str) -> dict[str, Any]:
    """Extract all EXIF tags from an image as a human-readable dict.

    Converts numeric EXIF tag IDs to their string names (e.g. 274 → 'Orientation').
    Returns an empty dict if the image has no EXIF data.

    Args:
        image_path: Path to the image file.

    Returns:
        Dict mapping EXIF tag names to their values.
    """
    try:
        img = Image.open(image_path)
        raw_exif = img._getexif()
        if raw_exif is None:
            return {}

        result = {}
        for tag_id, value in raw_exif.items():
            tag_name = TAGS.get(tag_id, str(tag_id))
            # GPSInfo is a nested dict with its own tag set
            if tag_name == "GPSInfo" and isinstance(value, dict):
                gps_data = {}
                for gps_tag_id, gps_value in value.items():
                    gps_tag_name = GPSTAGS.get(gps_tag_id, str(gps_tag_id))
                    gps_data[gps_tag_name] = gps_value
                result[tag_name] = gps_data
            else:
                result[tag_name] = value
        return result
    except (AttributeError, OSError, SyntaxError) as e:
        logger.warning("Could not extract EXIF from %s: %s", image_path, e)
        return {}


def _dms_to_decimal(dms_tuple: tuple, ref: str) -> float:
    """Convert GPS coordinates from degrees/minutes/seconds to decimal degrees.

    EXIF GPS stores coordinates as three rationals: (degrees, minutes, seconds).
    The reference character (N/S/E/W) determines the sign.

    Args:
        dms_tuple: Tuple of (degrees, minutes, seconds), each may be a
                   float or an IFDRational.
        ref:       Reference hemisphere: 'N', 'S', 'E', or 'W'.

    Returns:
        Decimal degrees (positive for N/E, negative for S/W).
    """
    degrees = float(dms_tuple[0])
    minutes = float(dms_tuple[1])
    seconds = float(dms_tuple[2])
    decimal = degrees + minutes / 60.0 + seconds / 3600.0

    # Southern and Western hemispheres are negative by convention
    if ref in ("S", "W"):
        decimal = -decimal

    return decimal


def extract_gps(image_path: str) -> tuple[float, float] | None:
    """Decode GPS coordinates from EXIF data into decimal degrees.

    Correctly handles all four reference hemispheres (N/S/E/W).
    Returns None if the image has no GPS data or if the GPS data
    is malformed.

    Args:
        image_path: Path to the image file.

    Returns:
        (latitude, longitude) in decimal degrees, or None.
    """
    exif = extract_exif(image_path)
    gps_info = exif.get("GPSInfo")
    if not gps_info:
        return None

    try:
        lat_dms = gps_info.get("GPSLatitude")
        lat_ref = gps_info.get("GPSLatitudeRef", "N")
        lon_dms = gps_info.get("GPSLongitude")
        lon_ref = gps_info.get("GPSLongitudeRef", "E")

        if lat_dms is None or lon_dms is None:
            return None

        latitude = _dms_to_decimal(lat_dms, lat_ref)
        longitude = _dms_to_decimal(lon_dms, lon_ref)

        # Basic sanity check — valid GPS coordinates
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            logger.warning(
                "GPS coordinates out of range for %s: (%f, %f)",
                image_path, latitude, longitude,
            )
            return None

        return (latitude, longitude)
    except (TypeError, ValueError, KeyError, IndexError) as e:
        logger.warning("Malformed GPS data in %s: %s", image_path, e)
        return None


def extract_capture_datetime(image_path: str) -> datetime | None:
    """Parse the original capture date from EXIF DateTimeOriginal.

    The EXIF date format is 'YYYY:MM:DD HH:MM:SS' (note the colons
    in the date part, not hyphens).

    Args:
        image_path: Path to the image file.

    Returns:
        datetime object, or None if no capture date is present.
    """
    exif = extract_exif(image_path)

    # Try DateTimeOriginal first, fall back to DateTimeDigitized, then DateTime
    for tag in ("DateTimeOriginal", "DateTimeDigitized", "DateTime"):
        value = exif.get(tag)
        if value:
            try:
                return datetime.strptime(str(value), "%Y:%m:%d %H:%M:%S")
            except ValueError:
                logger.warning(
                    "Cannot parse EXIF date '%s' from tag '%s' in %s",
                    value, tag, image_path,
                )
                continue
    return None


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute the great-circle distance between two points on Earth.

    Uses the Haversine formula, which is accurate for all distances
    (unlike the simpler Euclidean approximation which breaks down at
    large distances or near the poles).

    Args:
        lat1, lon1: First point in decimal degrees.
        lat2, lon2: Second point in decimal degrees.

    Returns:
        Distance in kilometres.
    """
    R = 6371.0  # Earth's mean radius in km

    # Convert to radians
    lat1_r, lon1_r = math.radians(lat1), math.radians(lon1)
    lat2_r, lon2_r = math.radians(lat2), math.radians(lon2)

    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r

    a = (math.sin(dlat / 2) ** 2 +
         math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def analyse_metadata(
    image_path: str,
    sanction_date: datetime | None,
    district: str | None,
    district_coords: tuple[float, float] | None = None,
) -> list[Flag]:
    """Run all metadata anomaly checks on a single image.

    Produces a list of Flag objects for any issues found.  Each flag
    includes machine-readable code, severity, human-friendly message,
    and raw evidence values so the dashboard can show *why* the flag
    was raised.

    Args:
        image_path:      Path to the image file.
        sanction_date:   When the work was sanctioned (None if unknown).
        district:        Claimed district name (for GPS comparison).
        district_coords: (lat, lon) of the district centre.  If not
                         provided, GPS distance check is skipped.

    Returns:
        List of Flag objects (may be empty if no issues found).
    """
    flags: list[Flag] = []
    exif = extract_exif(image_path)

    # ── Check 1: EXIF presence ───────────────────────────────────────
    if not exif:
        flags.append(Flag(
            code="EXIF_STRIPPED",
            severity="MEDIUM",
            human_message=(
                "This photograph contains no EXIF metadata. "
                "EXIF data is normally present in camera photos — its "
                "absence may indicate deliberate stripping to hide "
                "location, date, or editing history."
            ),
            evidence={"exif_tag_count": 0},
        ))
        return flags  # No further checks possible without EXIF

    # ── Check 2: Capture date vs sanction date ───────────────────────
    capture_dt = extract_capture_datetime(image_path)
    if capture_dt and sanction_date:
        if capture_dt < sanction_date:
            flags.append(Flag(
                code="PHOTO_PREDATES_SANCTION",
                severity="HIGH",
                human_message=(
                    f"This photograph was taken on {capture_dt.strftime('%Y-%m-%d')}, "
                    f"which is BEFORE the work was sanctioned on "
                    f"{sanction_date.strftime('%Y-%m-%d')}. This suggests the photo "
                    f"may be recycled from an earlier project or sourced from stock."
                ),
                evidence={
                    "capture_date": capture_dt.isoformat(),
                    "sanction_date": sanction_date.isoformat(),
                    "days_before": (sanction_date - capture_dt).days,
                },
            ))

    # ── Check 3: Future-dated photo ──────────────────────────────────
    if capture_dt and capture_dt > datetime.now(timezone.utc).replace(tzinfo=None):
        flags.append(Flag(
            code="PHOTO_FUTURE_DATED",
            severity="HIGH",
            human_message=(
                f"This photograph has a capture date of "
                f"{capture_dt.strftime('%Y-%m-%d %H:%M')}, which is in the future. "
                f"This indicates clock manipulation or EXIF tampering."
            ),
            evidence={
                "capture_date": capture_dt.isoformat(),
                "current_date": datetime.now(timezone.utc).isoformat(),
            },
        ))

    # ── Check 4: GPS presence ────────────────────────────────────────
    gps = extract_gps(image_path)
    if gps is None:
        flags.append(Flag(
            code="GPS_MISSING",
            severity="LOW",
            human_message=(
                "This photograph does not contain GPS coordinates. "
                "While not conclusive on its own, GPS helps verify "
                "that the photo was taken at the claimed work site."
            ),
            evidence={"gps_tags_present": False},
        ))
    elif district_coords:
        # ── Check 5: GPS vs district centre ──────────────────────────
        dist_km = haversine_km(gps[0], gps[1], district_coords[0], district_coords[1])
        if dist_km > settings.GPS_MAX_DISTANCE_KM:
            flags.append(Flag(
                code="GPS_DISTRICT_MISMATCH",
                severity="HIGH",
                human_message=(
                    f"Photograph GPS coordinates are {dist_km:.1f} km from the "
                    f"claimed district ({district}). The maximum allowed distance "
                    f"is {settings.GPS_MAX_DISTANCE_KM} km."
                ),
                evidence={
                    "photo_coords": [gps[0], gps[1]],
                    "district_centre": [district_coords[0], district_coords[1]],
                    "distance_km": round(dist_km, 1),
                    "threshold_km": settings.GPS_MAX_DISTANCE_KM,
                },
            ))

    # ── Check 6: Editing software ────────────────────────────────────
    software = exif.get("Software", "")
    if software:
        software_lower = str(software).lower()
        for pattern in EDITING_SOFTWARE_PATTERNS:
            if pattern in software_lower:
                flags.append(Flag(
                    code="SOFTWARE_EDITED",
                    severity="MEDIUM",
                    human_message=(
                        f"The EXIF 'Software' tag indicates this image was processed "
                        f"with '{software}'. While not conclusive, image editing "
                        f"software is unusual for genuine completion-proof photographs."
                    ),
                    evidence={
                        "software_tag": str(software),
                        "matched_pattern": pattern,
                    },
                ))
                break  # One flag is enough, don't duplicate

    return flags
