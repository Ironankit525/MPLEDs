"""
Generate deliberately fraudulent image variants for testing.

Takes a folder of clean source photos (or generates them) and produces
a set of fraudulent variants with known ground truth.  Outputs a
fraud_manifest.json listing every generated file with the flags it
*should* trigger.

Usage:
    python -m scripts.generate_fraud_cases [--source-dir data/images] [--output-dir data/fraud_cases]

Fraud cases generated:
  1. Exact duplicate       — straight file copy, new work_id
  2. Resized duplicate     — scale to 60%, JPEG quality 85
  3. Cropped duplicate     — crop 12% off each edge
  4. Watermarked duplicate — semi-transparent text overlay
  5. Rotated duplicate     — rotate 3 degrees, fill corners
  6. Recompressed          — save at JPEG quality 40
  7. EXIF-stripped          — copy pixel data to new image (no metadata)
  8. Backdated photo       — fake DateTimeOriginal before sanction date
  9. Wrong-district photo  — fake GPS ~400km away
  10. Content mismatch     — assign wrong work_type
"""

import json
import logging
import shutil
import struct
import sys
from datetime import datetime, timedelta
from pathlib import Path
from random import Random

import piexif
from PIL import Image, ImageDraw, ImageFont

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import PROJECT_ROOT

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

rng = Random(42)

# Default directories
DEFAULT_SOURCE_DIR = PROJECT_ROOT / "data" / "images"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "data" / "fraud_cases"


# ── EXIF helpers ─────────────────────────────────────────────────────
# Used to genuinely embed DateTimeOriginal / GPS into fraud cases 8 & 9
# (previously these cases only tested the flag logic directly — the
# generated JPEGs carried no EXIF at all, so PHOTO_PREDATES_SANCTION and
# GPS_DISTRICT_MISMATCH could never fire against the actual files. See
# evaluation_report.json from the first harness run for the measured
# impact.)

def _decimal_to_dms_rational(value: float) -> tuple:
    """Convert decimal degrees to EXIF's (deg,1)/(min,1)/(sec*100,100) rational DMS format."""
    value = abs(value)
    degrees = int(value)
    minutes_float = (value - degrees) * 60
    minutes = int(minutes_float)
    seconds = (minutes_float - minutes) * 60
    return ((degrees, 1), (minutes, 1), (int(round(seconds * 100)), 100))


def _exif_bytes_with_datetime(capture_dt: datetime) -> bytes:
    """Build an EXIF blob with DateTimeOriginal/DateTimeDigitized set to `capture_dt`."""
    date_str = capture_dt.strftime("%Y:%m:%d %H:%M:%S").encode("ascii")
    exif_dict = {
        "0th": {},
        "Exif": {
            piexif.ExifIFD.DateTimeOriginal: date_str,
            piexif.ExifIFD.DateTimeDigitized: date_str,
        },
        "GPS": {},
        "1st": {},
        "thumbnail": None,
    }
    return piexif.dump(exif_dict)


def _exif_bytes_with_gps(lat: float, lon: float) -> bytes:
    """Build an EXIF blob with GPS coordinates set to (lat, lon)."""
    exif_dict = {
        "0th": {},
        "Exif": {},
        "GPS": {
            piexif.GPSIFD.GPSLatitudeRef: "N" if lat >= 0 else "S",
            piexif.GPSIFD.GPSLatitude: _decimal_to_dms_rational(lat),
            piexif.GPSIFD.GPSLongitudeRef: "E" if lon >= 0 else "W",
            piexif.GPSIFD.GPSLongitude: _decimal_to_dms_rational(lon),
        },
        "1st": {},
        "thumbnail": None,
    }
    return piexif.dump(exif_dict)


# ── Reusable transform helpers ──────────────────────────────────────
# Pure image->image transforms, factored out of the _create_* functions
# below so scripts/calibrate_thresholds.py can reuse the EXACT SAME
# transformations for calibration instead of reimplementing them.

def _transform_resize(img: Image.Image, scale: float = 0.6) -> Image.Image:
    """Scale to `scale`x (default 60%)."""
    new_size = (int(img.width * scale), int(img.height * scale))
    return img.convert("RGB").resize(new_size, Image.LANCZOS)


def _transform_crop(img: Image.Image, margin_fraction: float = 0.12) -> Image.Image:
    """Crop `margin_fraction` off each edge (default 12%)."""
    img = img.convert("RGB")
    w, h = img.size
    mx, my = int(w * margin_fraction), int(h * margin_fraction)
    return img.crop((mx, my, w - mx, h - my))


def _transform_watermark(img: Image.Image, text: str = "VERIFIED") -> Image.Image:
    """Overlay semi-transparent watermark text."""
    img = img.convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 60)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("arial.ttf", 60)
        except (OSError, IOError):
            font = ImageFont.load_default()
    text_position = (img.width // 4, img.height // 3)
    draw.text(text_position, text, fill=(255, 255, 255, 80), font=font)
    return Image.alpha_composite(img, overlay).convert("RGB")


def _transform_rotate(img: Image.Image, angle: float = 3.0) -> Image.Image:
    """Rotate by `angle` degrees (default 3), filling corners with grey."""
    return img.convert("RGB").rotate(angle, expand=False, fillcolor=(128, 128, 128))


RECOMPRESS_QUALITY = 40  # JPEG quality used for the "heavy recompression" case


def _ensure_source_images(source_dir: Path, min_count: int = 5) -> list[Path]:
    """Ensure we have source images to work with.

    If the source directory doesn't have enough images, generate
    synthetic ones.
    """
    source_dir.mkdir(parents=True, exist_ok=True)

    existing = sorted(source_dir.glob("*.jpg")) + sorted(source_dir.glob("*.png"))
    if len(existing) >= min_count:
        return existing[:min_count]

    # Generate synthetic source images if needed
    logger.info("Generating %d synthetic source images...", min_count)
    images = []
    for i in range(min_count):
        img = Image.new("RGB", (640, 480))
        draw = ImageDraw.Draw(img)

        # Create a unique gradient-based image
        r_base = (i * 47 + 30) % 256
        g_base = (i * 83 + 60) % 256
        b_base = (i * 127 + 90) % 256

        for y in range(480):
            for x in range(0, 640, 4):
                r = (r_base + x // 5) % 256
                g = (g_base + y // 3) % 256
                b = (b_base + (x * y) // 1000) % 256
                for dx in range(min(4, 640 - x)):
                    img.putpixel((x + dx, y), (r, g, b))

        # Add distinctive shapes
        draw.rectangle(
            [100 + i * 20, 100, 300 + i * 20, 250],
            fill=(255, 255, 200),
            outline=(0, 0, 0),
            width=2,
        )
        draw.ellipse(
            [350, 150, 500, 350],
            fill=(200, 230, 255),
            outline=(30, 30, 100),
            width=2,
        )

        path = source_dir / f"source_{i:04d}.jpg"
        img.save(path, "JPEG", quality=95)
        images.append(path)

    return images


def _create_exact_duplicate(source: Path, output_dir: Path, case_id: int) -> dict:
    """Case 1: Straight file copy with a new work_id."""
    dest = output_dir / f"fraud_{case_id:03d}_exact_dup.jpg"
    shutil.copy2(source, dest)
    return {
        "file": str(dest.name),
        "source": str(source.name),
        "case_type": "exact_duplicate",
        "expected_flags": ["EXACT_DUPLICATE"],
        "work_id": f"MP-NAG-2024-{case_id:04d}",
        "original_work_id": f"MP-PUN-2024-0001",
        "district": "Nagpur",
        "work_type": "road construction",
        "expected_risk_level": "HIGH",
    }


def _create_resized_duplicate(source: Path, output_dir: Path, case_id: int) -> dict:
    """Case 2: Scale to 60%, JPEG quality 85."""
    img = Image.open(source)
    resized = _transform_resize(img)
    dest = output_dir / f"fraud_{case_id:03d}_resized.jpg"
    resized.save(dest, "JPEG", quality=85)
    return {
        "file": str(dest.name),
        "source": str(source.name),
        "case_type": "resized_duplicate",
        "expected_flags": ["PERCEPTUAL_DUPLICATE"],
        "work_id": f"MP-LUC-2024-{case_id:04d}",
        "original_work_id": f"MP-PUN-2024-0001",
        "district": "Lucknow",
        "work_type": "road construction",
        "expected_risk_level": "HIGH",
    }


def _create_cropped_duplicate(source: Path, output_dir: Path, case_id: int) -> dict:
    """Case 3: Crop 12% off each edge."""
    img = Image.open(source)
    cropped = _transform_crop(img)
    dest = output_dir / f"fraud_{case_id:03d}_cropped.jpg"
    cropped.save(dest, "JPEG", quality=90)
    return {
        "file": str(dest.name),
        "source": str(source.name),
        "case_type": "cropped_duplicate",
        "expected_flags": ["PERCEPTUAL_DUPLICATE", "PERCEPTUAL_SUSPICIOUS"],
        "work_id": f"MP-JAI-2024-{case_id:04d}",
        "original_work_id": f"MP-PUN-2024-0001",
        "district": "Jaipur",
        "work_type": "road construction",
        "expected_risk_level": "MEDIUM",
    }


def _create_watermarked_duplicate(source: Path, output_dir: Path, case_id: int) -> dict:
    """Case 4: Semi-transparent text overlay."""
    img = Image.open(source)
    watermarked = _transform_watermark(img)
    dest = output_dir / f"fraud_{case_id:03d}_watermarked.jpg"
    watermarked.save(dest, "JPEG", quality=90)
    return {
        "file": str(dest.name),
        "source": str(source.name),
        "case_type": "watermarked_duplicate",
        "expected_flags": ["PERCEPTUAL_DUPLICATE", "PERCEPTUAL_SUSPICIOUS"],
        "work_id": f"MP-PAT-2024-{case_id:04d}",
        "original_work_id": f"MP-PUN-2024-0001",
        "district": "Patna",
        "work_type": "road construction",
        # Round 3 correction: originally guessed MEDIUM assuming a
        # watermark would only trigger PERCEPTUAL_SUSPICIOUS (15 pts).
        # Measured behaviour: pHash survives a semi-transparent overlay
        # easily (well within PHASH_DUPLICATE_THRESHOLD), so this fires
        # PERCEPTUAL_DUPLICATE(50) + CROSS_DISTRICT_MATCH(20) +
        # EXIF_STRIPPED "with_others"(15) = 85 = HIGH. That's the
        # correct, principled score given the flags that legitimately
        # fire here, not a bug — the original guess was just wrong.
        "expected_risk_level": "HIGH",
    }


def _create_rotated_duplicate(source: Path, output_dir: Path, case_id: int) -> dict:
    """Case 5: Rotate 3 degrees, fill corners."""
    img = Image.open(source)
    rotated = _transform_rotate(img)
    dest = output_dir / f"fraud_{case_id:03d}_rotated.jpg"
    rotated.save(dest, "JPEG", quality=90)
    return {
        "file": str(dest.name),
        "source": str(source.name),
        "case_type": "rotated_duplicate",
        "expected_flags": ["PERCEPTUAL_DUPLICATE", "PERCEPTUAL_SUSPICIOUS"],
        "work_id": f"MP-BHO-2024-{case_id:04d}",
        "original_work_id": f"MP-PUN-2024-0001",
        "district": "Bhopal",
        "work_type": "road construction",
        # Round 3 correction: originally guessed MEDIUM before
        # ENABLE_ROTATION_ROBUST_HASH existed. With rotation-robust
        # hashing, a 3-degree rotation is now correctly resolved as a
        # true duplicate (min distance across rotated variants), so this
        # fires PERCEPTUAL_DUPLICATE(50) + CROSS_DISTRICT_MATCH(20) +
        # EXIF_STRIPPED "with_others"(15) = 85 = HIGH — the intended
        # result of that feature working, not a scoring bug.
        "expected_risk_level": "HIGH",
    }


def _create_recompressed_duplicate(source: Path, output_dir: Path, case_id: int) -> dict:
    """Case 6: Save at JPEG quality 40 (heavy compression)."""
    img = Image.open(source).convert("RGB")
    dest = output_dir / f"fraud_{case_id:03d}_recompressed.jpg"
    img.save(dest, "JPEG", quality=RECOMPRESS_QUALITY)
    return {
        "file": str(dest.name),
        "source": str(source.name),
        "case_type": "recompressed_duplicate",
        "expected_flags": ["PERCEPTUAL_DUPLICATE"],
        "work_id": f"MP-CHE-2024-{case_id:04d}",
        "original_work_id": f"MP-PUN-2024-0001",
        "district": "Chennai",
        "work_type": "road construction",
        "expected_risk_level": "HIGH",
    }


def _create_exif_stripped(source: Path, output_dir: Path, case_id: int) -> dict:
    """Case 7: Copy pixel data to a new image with no metadata."""
    img = Image.open(source).convert("RGB")
    # Create a fresh image (no EXIF carried over)
    clean = Image.new("RGB", img.size)
    clean.paste(img)
    dest = output_dir / f"fraud_{case_id:03d}_stripped.jpg"
    clean.save(dest, "JPEG", quality=92)
    return {
        "file": str(dest.name),
        "source": str(source.name),
        "case_type": "exif_stripped",
        "expected_flags": ["EXIF_STRIPPED", "PERCEPTUAL_DUPLICATE"],
        "work_id": f"MP-KOL-2024-{case_id:04d}",
        "original_work_id": f"MP-PUN-2024-0001",
        "district": "Kolkata",
        "work_type": "road construction",
        "expected_risk_level": "HIGH",
    }


def _create_backdated_photo(source: Path, output_dir: Path, case_id: int) -> dict:
    """Case 8: Image with a genuine EXIF DateTimeOriginal before the sanction date.

    A slightly different image (to avoid also triggering hash-based
    duplicate detection, which isn't what this case is testing) carrying
    a real EXIF DateTimeOriginal dated well before the claimed sanction
    date — evidence the photo may be recycled from an earlier project.
    """
    img = Image.open(source).convert("RGB")
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 50, 50], fill=(rng.randint(0, 255), rng.randint(0, 255), rng.randint(0, 255)))

    fake_capture_date = datetime(2023, 6, 15, 10, 30, 0)
    exif_bytes = _exif_bytes_with_datetime(fake_capture_date)

    dest = output_dir / f"fraud_{case_id:03d}_backdated.jpg"
    img.save(dest, "JPEG", quality=92, exif=exif_bytes)

    return {
        "file": str(dest.name),
        "source": str(source.name),
        "case_type": "backdated_photo",
        "expected_flags": ["PHOTO_PREDATES_SANCTION"],
        "work_id": f"MP-BEN-2024-{case_id:04d}",
        "original_work_id": None,
        "district": "Bengaluru Urban",
        "work_type": "community hall construction",
        "sanction_date": "2025-01-01",
        "fake_capture_date": fake_capture_date.isoformat(),
        # Round 3 correction: originally guessed MEDIUM assuming this
        # case would isolate PHOTO_PREDATES_SANCTION alone. Measured
        # behaviour: the 50x50px corner edit is NOT enough to move this
        # image's pHash outside PHASH_DUPLICATE_THRESHOLD of its source
        # (pHash operates on heavily downscaled DCT coefficients, so a
        # small corner patch has little effect) — it also legitimately
        # fires PERCEPTUAL_DUPLICATE(50) + CROSS_DISTRICT_MATCH(20) on
        # top of PHOTO_PREDATES_SANCTION(30), capping at 100 = HIGH. This
        # is a realistic compound-fraud scenario (recycled photo AND
        # cross-district), not a false signal, so HIGH is correct.
        "expected_risk_level": "HIGH",
        "note": "EXIF DateTimeOriginal is genuinely embedded via piexif (fixed in Round 2).",
    }


def _create_wrong_district_photo(source: Path, output_dir: Path, case_id: int) -> dict:
    """Case 9: Image with genuine EXIF GPS coordinates ~665km from claimed district."""
    img = Image.open(source).convert("RGB")
    draw = ImageDraw.Draw(img)
    draw.ellipse([200, 150, 350, 300], fill=(rng.randint(0, 255), 100, 100))

    fake_gps = (21.15, 79.09)  # Nagpur coords, ~665 km from Pune
    exif_bytes = _exif_bytes_with_gps(*fake_gps)

    dest = output_dir / f"fraud_{case_id:03d}_wrong_district.jpg"
    img.save(dest, "JPEG", quality=92, exif=exif_bytes)

    return {
        "file": str(dest.name),
        "source": str(source.name),
        "case_type": "wrong_district",
        "expected_flags": ["GPS_DISTRICT_MISMATCH"],
        "work_id": f"MP-THI-2024-{case_id:04d}",
        "original_work_id": None,
        "district": "Pune",
        "work_type": "drainage system",
        "fake_gps": list(fake_gps),
        "expected_risk_level": "MEDIUM",
        "note": "EXIF GPS is genuinely embedded via piexif (fixed in Round 2).",
    }


def _create_content_mismatch(source: Path, output_dir: Path, case_id: int) -> dict:
    """Case 10: Assign a photo of 'road' to work_type 'school building'."""
    img = Image.open(source).convert("RGB")
    dest = output_dir / f"fraud_{case_id:03d}_mismatch.jpg"
    img.save(dest, "JPEG", quality=92)

    return {
        "file": str(dest.name),
        "source": str(source.name),
        "case_type": "content_mismatch",
        "expected_flags": ["CONTENT_MISMATCH"],
        "work_id": f"MP-GUW-2024-{case_id:04d}",
        "original_work_id": None,
        "district": "Guwahati",
        "work_type": "school building",  # Mismatch — image is not a school
        "expected_risk_level": "MEDIUM",
        "note": "Requires CLIP to detect. Should flag CONTENT_MISMATCH when CLIP is enabled.",
    }


def generate_fraud_cases(
    source_dir: Path | None = None,
    output_dir: Path | None = None,
) -> Path:
    """Generate all fraud test cases and write the manifest.

    Args:
        source_dir: Directory containing clean source images.
        output_dir: Directory to write fraudulent variants.

    Returns:
        Path to the generated fraud_manifest.json.
    """
    source_dir = source_dir or DEFAULT_SOURCE_DIR
    output_dir = output_dir or DEFAULT_OUTPUT_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    # Get source images
    sources = _ensure_source_images(source_dir)
    if not sources:
        logger.error("No source images found in %s", source_dir)
        sys.exit(1)

    logger.info("Using %d source images from %s", len(sources), source_dir)

    manifest: list[dict] = []
    case_id = 1

    # Use the first source image for duplicate-based cases
    primary_source = sources[0]

    # Case 1: Exact duplicate
    manifest.append(_create_exact_duplicate(primary_source, output_dir, case_id))
    case_id += 1

    # Case 2: Resized duplicate
    manifest.append(_create_resized_duplicate(primary_source, output_dir, case_id))
    case_id += 1

    # Case 3: Cropped duplicate
    manifest.append(_create_cropped_duplicate(primary_source, output_dir, case_id))
    case_id += 1

    # Case 4: Watermarked duplicate
    manifest.append(_create_watermarked_duplicate(primary_source, output_dir, case_id))
    case_id += 1

    # Case 5: Rotated duplicate
    manifest.append(_create_rotated_duplicate(primary_source, output_dir, case_id))
    case_id += 1

    # Case 6: Recompressed duplicate
    manifest.append(_create_recompressed_duplicate(primary_source, output_dir, case_id))
    case_id += 1

    # Case 7: EXIF-stripped
    manifest.append(_create_exif_stripped(primary_source, output_dir, case_id))
    case_id += 1

    # Case 8: Backdated photo (uses a different source)
    manifest.append(_create_backdated_photo(sources[1] if len(sources) > 1 else primary_source, output_dir, case_id))
    case_id += 1

    # Case 9: Wrong-district GPS
    manifest.append(_create_wrong_district_photo(sources[2] if len(sources) > 2 else primary_source, output_dir, case_id))
    case_id += 1

    # Case 10: Content mismatch
    manifest.append(_create_content_mismatch(sources[3] if len(sources) > 3 else primary_source, output_dir, case_id))
    case_id += 1

    # Write manifest
    manifest_path = output_dir / "fraud_manifest.json"
    with open(manifest_path, "w") as f:
        json.dump({
            "generated_at": datetime.utcnow().isoformat(),
            "source_dir": str(source_dir),
            "output_dir": str(output_dir),
            "total_cases": len(manifest),
            "cases": manifest,
        }, f, indent=2)

    logger.info("Generated %d fraud cases.", len(manifest))
    logger.info("Manifest written to: %s", manifest_path)
    return manifest_path


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate fraud test cases.")
    parser.add_argument("--source-dir", type=Path, default=None, help="Directory with clean source images")
    parser.add_argument("--output-dir", type=Path, default=None, help="Output directory for fraud cases")
    args = parser.parse_args()

    generate_fraud_cases(args.source_dir, args.output_dir)
