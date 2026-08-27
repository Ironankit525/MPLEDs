"""
Error Level Analysis (ELA) for image tamper detection.

ELA works by re-saving a JPEG image at a known quality level and computing
the difference between the original and the re-saved version.  In a
non-tampered image, the error levels are roughly uniform — the entire image
has been through the same compression pipeline.  In a tampered image,
spliced or edited regions were compressed at a different quality level,
producing visibly different error patterns.

This module also detects screenshots (images with unnaturally uniform error
levels that indicate the image was generated, not photographed) and
photo-of-photo captures (moiré patterns in the frequency domain).

No model training required — pure image processing with PIL and numpy.
Runs on CPU in ~50ms for a typical 640×480 image.

References:
    - Krawetz, N. (2007). "A Picture's Worth" — Black Hat USA.
    - FotoForensics.com ELA documentation.
"""

import io
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image, ImageChops

from app.config import settings

logger = logging.getLogger(__name__)


# ── Configuration defaults (added to Settings in config.py) ──────────
# These are fallback values used if config.py hasn't been updated yet.
ELA_QUALITY = getattr(settings, "ELA_QUALITY", 95)
ELA_TAMPER_THRESHOLD = getattr(settings, "ELA_TAMPER_THRESHOLD", 40.0)
ELA_UNIFORMITY_THRESHOLD = getattr(settings, "ELA_UNIFORMITY_THRESHOLD", 5.0)
ELA_SCALE_FACTOR = getattr(settings, "ELA_SCALE_FACTOR", 15)


@dataclass
class ELAResult:
    """Result of Error Level Analysis on a single image.

    Attributes:
        is_tampered:       True if ELA detects inconsistent compression.
        is_screenshot:     True if the image appears to be a screenshot
                           (unnaturally uniform error levels).
        max_error:         Maximum error level across the image (0–255).
        mean_error:        Mean error level across the image.
        std_error:         Standard deviation of error levels.
        suspicious_ratio:  Fraction of pixels above the tamper threshold.
        ela_image:         The ELA difference image (numpy array, uint8,
                           scaled for visibility).  Can be saved as a
                           heatmap for human review.
    """
    is_tampered: bool = False
    is_screenshot: bool = False
    max_error: float = 0.0
    mean_error: float = 0.0
    std_error: float = 0.0
    suspicious_ratio: float = 0.0
    ela_image: Optional[np.ndarray] = field(default=None, repr=False)


def compute_ela(image_path: str, quality: int = None) -> ELAResult:
    """Perform Error Level Analysis on a JPEG image.

    Re-saves the image at a known JPEG quality and computes the
    per-pixel difference.  Tampered regions show up as areas with
    significantly different error levels from the rest of the image.

    Args:
        image_path: Path to the image file.
        quality:    JPEG quality level for re-saving (default from config).

    Returns:
        ELAResult with tamper detection verdict and statistics.
    """
    if quality is None:
        quality = ELA_QUALITY

    try:
        original = Image.open(image_path).convert("RGB")
    except Exception as e:
        logger.warning("ELA: Cannot open image %s: %s", image_path, e)
        return ELAResult()

    # Re-save to an in-memory JPEG buffer at the specified quality
    buffer = io.BytesIO()
    original.save(buffer, "JPEG", quality=quality)
    buffer.seek(0)
    resaved = Image.open(buffer).convert("RGB")

    # Compute the absolute difference between original and resaved
    diff = ImageChops.difference(original, resaved)

    # Convert to numpy for analysis
    diff_array = np.array(diff, dtype=np.float32)

    # Compute per-pixel error magnitude (across RGB channels)
    # Use the max across channels for each pixel — tampered regions
    # tend to show high error in at least one channel.
    pixel_errors = np.max(diff_array, axis=2)

    # Statistics
    max_error = float(np.max(pixel_errors))
    mean_error = float(np.mean(pixel_errors))
    std_error = float(np.std(pixel_errors))

    # Suspicious pixel ratio: fraction of pixels above the threshold
    threshold = ELA_TAMPER_THRESHOLD
    suspicious_pixels = np.sum(pixel_errors > threshold)
    total_pixels = pixel_errors.size
    suspicious_ratio = float(suspicious_pixels / total_pixels)

    # ── Tamper detection logic ───────────────────────────────────────
    # An image is flagged as tampered if:
    #   1. There are regions with significantly higher error than average
    #      (std_error is high AND some pixels are well above threshold)
    #   2. But NOT so uniform that it's a screenshot
    #
    # The key insight: in a tampered image, the edited regions were saved
    # at a different JPEG quality than the background.  When we re-save
    # at our fixed quality, the edited regions produce MORE error because
    # they've now been through two different compressions.
    is_tampered = (
        suspicious_ratio > 0.01  # >1% of pixels are suspicious
        and max_error > threshold * 1.5  # At least some very high error pixels
        and std_error > 8.0  # Error levels are non-uniform
    )

    # ── Screenshot detection ─────────────────────────────────────────
    # Screenshots have VERY uniform error levels because every pixel was
    # generated at the same time (rendered, not photographed).
    # std_error < 5 means nearly zero variation in compression artifacts.
    #
    # IMPORTANT: Only apply this heuristic to images that were already
    # JPEG-compressed.  Lossless formats (PNG, TIFF, BMP) naturally
    # produce very low, uniform error when re-saved as JPEG — that's
    # expected behavior, not evidence of a screenshot.
    is_jpeg = Path(image_path).suffix.lower() in (".jpg", ".jpeg")
    is_screenshot = (
        is_jpeg
        and std_error < ELA_UNIFORMITY_THRESHOLD
        and mean_error < 3.0  # Very low error overall
    )

    # ── Generate ELA heatmap (scaled for visibility) ─────────────────
    # Multiply the error by a scale factor so small differences become
    # visible.  Clip to 255 to stay in uint8 range.
    scale = ELA_SCALE_FACTOR
    ela_image = np.clip(diff_array * scale, 0, 255).astype(np.uint8)

    result = ELAResult(
        is_tampered=is_tampered,
        is_screenshot=is_screenshot,
        max_error=max_error,
        mean_error=mean_error,
        std_error=std_error,
        suspicious_ratio=suspicious_ratio,
        ela_image=ela_image,
    )

    logger.info(
        "ELA for %s: tampered=%s screenshot=%s max=%.1f mean=%.1f std=%.1f suspicious=%.3f%%",
        Path(image_path).name, is_tampered, is_screenshot,
        max_error, mean_error, std_error, suspicious_ratio * 100,
    )

    return result


def save_ela_heatmap(ela_result: ELAResult, output_path: str) -> bool:
    """Save the ELA heatmap as a JPEG image for human review.

    Args:
        ela_result:  Result from compute_ela().
        output_path: Where to save the heatmap image.

    Returns:
        True if saved successfully, False otherwise.
    """
    if ela_result.ela_image is None:
        return False

    try:
        heatmap = Image.fromarray(ela_result.ela_image)
        heatmap.save(output_path, "JPEG", quality=95)
        return True
    except Exception as e:
        logger.warning("Failed to save ELA heatmap: %s", e)
        return False


def detect_photo_of_photo(image_path: str) -> bool:
    """Detect if an image is a photo taken of another photo or screen.

    Uses frequency domain analysis (FFT) to detect moiré patterns —
    regular repeating patterns that appear when a camera photographs
    a printed image or digital screen.  These patterns show up as
    distinct peaks in the frequency spectrum.

    Args:
        image_path: Path to the image file.

    Returns:
        True if moiré patterns are detected (likely photo-of-photo).
    """
    try:
        img = Image.open(image_path).convert("L")  # Grayscale
    except Exception as e:
        logger.warning("Photo-of-photo detection: Cannot open %s: %s", image_path, e)
        return False

    img_array = np.array(img, dtype=np.float32)

    # Apply 2D FFT
    fft = np.fft.fft2(img_array)
    fft_shifted = np.fft.fftshift(fft)
    magnitude = np.abs(fft_shifted)

    # Log-scale for analysis
    log_magnitude = np.log1p(magnitude)

    # The centre of the FFT contains low frequencies (overall brightness).
    # Moiré patterns create distinct peaks at regular intervals in the
    # mid-to-high frequency range.
    #
    # Strategy: compare the energy in the mid-frequency band to the
    # overall energy.  Moiré patterns inflate the mid-frequency band.
    h, w = log_magnitude.shape
    cy, cx = h // 2, w // 2

    # Define frequency bands (as fraction of image dimension)
    low_radius = min(h, w) * 0.05    # Centre 5% = very low freq
    mid_inner = min(h, w) * 0.15     # 15% = mid-low
    mid_outer = min(h, w) * 0.40     # 40% = mid-high

    # Create distance map from centre
    y_coords, x_coords = np.ogrid[:h, :w]
    distances = np.sqrt((y_coords - cy) ** 2 + (x_coords - cx) ** 2)

    # Compute energy in each band
    mid_mask = (distances > mid_inner) & (distances < mid_outer)
    all_mask = distances > low_radius  # Exclude DC component

    mid_energy = float(np.mean(log_magnitude[mid_mask]))
    total_energy = float(np.mean(log_magnitude[all_mask]))

    # If mid-frequency energy is disproportionately high relative to
    # total, it suggests regular repeating patterns (moiré).
    ratio = mid_energy / total_energy if total_energy > 0 else 0

    # Additionally, look for sharp peaks in the mid-frequency band.
    # Natural images have smooth falloff; moiré creates spikes.
    mid_values = log_magnitude[mid_mask]
    if len(mid_values) > 0:
        peak_ratio = float(np.max(mid_values) / (np.mean(mid_values) + 1e-6))
    else:
        peak_ratio = 0

    # Thresholds determined empirically (now configurable via settings):
    # - ratio > MOIRE_RATIO_THRESHOLD indicates elevated mid-frequency content
    # - peak_ratio > MOIRE_PEAK_RATIO_THRESHOLD indicates sharp spectral peaks (moiré)
    is_photo_of_photo = (
        ratio > settings.MOIRE_RATIO_THRESHOLD
        and peak_ratio > settings.MOIRE_PEAK_RATIO_THRESHOLD
    )

    logger.info(
        "Photo-of-photo detection for %s: detected=%s mid_ratio=%.3f peak_ratio=%.1f",
        Path(image_path).name, is_photo_of_photo, ratio, peak_ratio,
    )

    return is_photo_of_photo
