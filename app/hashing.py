"""
Layer 1 & 2: Cryptographic and perceptual image hashing.

Layer 1 (SHA-256):
    Byte-level hash catches exact re-uploads only.  Any modification —
    even a single pixel change or re-save — produces a completely
    different hash.  Fast and definitive, but trivially defeated by
    any image manipulation.

Layer 2 (pHash + dHash):
    Perceptual hashes reduce the image to a compact fingerprint that
    survives resizing, re-compression, minor cropping, and colour
    shifts.  Two different algorithms (pHash and dHash) are used as
    independent opinions — if they both flag a match, confidence is
    higher.

    pHash works by DCT (discrete cosine transform) — it captures the
    low-frequency structure of the image.
    dHash works by gradient direction — it captures the relative
    brightness of adjacent pixels.
"""

import hashlib
import logging
from pathlib import Path

import imagehash
from PIL import Image

logger = logging.getLogger(__name__)


class ImageProcessingError(Exception):
    """Raised when an image cannot be read, decoded, or processed.

    Wraps lower-level errors (corrupt file, unsupported format, etc.)
    with a clear message indicating the file path and root cause.
    """
    pass


def compute_sha256(image_path: str) -> str:
    """Compute the SHA-256 hex digest of the raw file bytes.

    This is a byte-level hash — it catches exact re-uploads only.
    Any modification (resize, recompress, crop) produces a completely
    different hash.

    Args:
        image_path: Path to the image file.

    Returns:
        64-character lowercase hex string.

    Raises:
        ImageProcessingError: If the file cannot be read.
    """
    try:
        path = Path(image_path)
        sha = hashlib.sha256()
        with open(path, "rb") as f:
            # Read in chunks to handle large files without loading
            # the entire file into memory.
            for chunk in iter(lambda: f.read(8192), b""):
                sha.update(chunk)
        return sha.hexdigest()
    except FileNotFoundError:
        raise ImageProcessingError(f"File not found: {image_path}")
    except PermissionError:
        raise ImageProcessingError(f"Permission denied reading: {image_path}")
    except OSError as e:
        raise ImageProcessingError(f"Cannot read file {image_path}: {e}")


def _load_image_rgb(image_path: str) -> Image.Image:
    """Load an image and convert to RGB mode.

    Handles PNG transparency (RGBA), CMYK, palette images, etc.
    by converting everything to RGB before hashing.

    Args:
        image_path: Path to the image file.

    Returns:
        PIL Image in RGB mode.

    Raises:
        ImageProcessingError: If the image cannot be loaded or decoded.
    """
    try:
        img = Image.open(image_path)
        img.load()  # Force decode — catches truncated/corrupt images
        return img.convert("RGB")
    except FileNotFoundError:
        raise ImageProcessingError(f"File not found: {image_path}")
    except (OSError, SyntaxError) as e:
        # Pillow raises SyntaxError for some corrupt image formats
        raise ImageProcessingError(
            f"Cannot decode image {image_path}: {e}"
        )


def compute_phash(image_path: str) -> str:
    """Compute the perceptual hash (pHash) of an image.

    Uses DCT-based hashing — survives resize, recompress, and minor
    cropping.  Returns a 16-character hex string representing a 64-bit
    hash.

    Args:
        image_path: Path to the image file.

    Returns:
        16-character hex string (64-bit pHash).

    Raises:
        ImageProcessingError: If the image cannot be loaded.
    """
    img = _load_image_rgb(image_path)
    return str(imagehash.phash(img))


def compute_phash_rotation_robust(image_path: str, angles: list[float] | None = None) -> list[str]:
    """Compute pHash of the image at each of `angles` (default 0°, ±5°).

    Rotation defeats plain pHash even at small angles (confirmed by
    Round 2 calibration — see scripts/calibrate_thresholds.py). Rather
    than raising the global PHASH_*_THRESHOLD (which would inflate false
    positives on every case), the candidate image is hashed at a few
    small rotations and the caller takes the MINIMUM Hamming distance
    across all of them against each stored (single, canonical) hash.
    This can only lower the effective distance, never raise it.

    Args:
        image_path: Path to the image file.
        angles:     Rotation angles in degrees. Defaults to
                    settings.ROTATION_ROBUST_ANGLES. 0.0 always produces
                    the same hash as compute_phash().

    Returns:
        List of 16-character hex pHash strings, one per angle.

    Raises:
        ImageProcessingError: If the image cannot be loaded.
    """
    if angles is None:
        from app.config import settings
        angles = settings.ROTATION_ROBUST_ANGLES

    img = _load_image_rgb(image_path)
    hashes = []
    for angle in angles:
        rotated = img if angle == 0.0 else img.rotate(angle, expand=False, fillcolor=(128, 128, 128))
        hashes.append(str(imagehash.phash(rotated)))
    return hashes


def compute_tiled_phashes(
    image_path: str,
    grid: int | None = None,
    overlap: float | None = None,
) -> list[str]:
    """Split the image into a `grid`x`grid` grid of overlapping tiles and
    pHash each tile independently (Task 2.3, gated by ENABLE_TILED_HASH).

    Heavy cropping defeats whole-image pHash by design — the hash is
    computed over the whole frame, and removing a chunk of every edge
    changes the DCT coefficients substantially (confirmed empirically:
    see scripts/evaluate_detection.py's diagnosis for cropped_duplicate).
    Tiling anchors each tile's hash to a LOCAL region, so a crop that
    only affects the outer edges still leaves inner tiles close to their
    originals. Tiles overlap so a crop boundary landing on a tile edge
    doesn't blind that whole tile.

    Args:
        image_path: Path to the image file.
        grid:       Grid size (grid x grid tiles). Defaults to
                    settings.TILED_HASH_GRID_SIZE (3, i.e. 9 tiles).
        overlap:    Fractional overlap between adjacent tiles. Defaults
                    to settings.TILED_HASH_TILE_OVERLAP (0.15).

    Returns:
        List of grid*grid 16-character hex pHash strings, in row-major
        order (top-left to bottom-right) — comparisons must be
        position-aligned (tile i vs tile i), not all-pairs.

    Raises:
        ImageProcessingError: If the image cannot be loaded.
    """
    if grid is None or overlap is None:
        from app.config import settings
        grid = grid if grid is not None else settings.TILED_HASH_GRID_SIZE
        overlap = overlap if overlap is not None else settings.TILED_HASH_TILE_OVERLAP

    img = _load_image_rgb(image_path)
    w, h = img.size
    tile_w, tile_h = w / grid, h / grid
    pad_w, pad_h = tile_w * overlap, tile_h * overlap

    hashes = []
    for row in range(grid):
        for col in range(grid):
            left = max(0, col * tile_w - pad_w)
            top = max(0, row * tile_h - pad_h)
            right = min(w, (col + 1) * tile_w + pad_w)
            bottom = min(h, (row + 1) * tile_h + pad_h)
            tile = img.crop((int(left), int(top), int(right), int(bottom)))
            hashes.append(str(imagehash.phash(tile)))
    return hashes


def compute_dhash(image_path: str) -> str:
    """Compute the difference hash (dHash) of an image.

    Uses gradient direction hashing — captures relative brightness
    between adjacent pixels.  Used as a second opinion alongside pHash;
    if both hashes flag a match, confidence increases.

    Args:
        image_path: Path to the image file.

    Returns:
        16-character hex string (64-bit dHash).

    Raises:
        ImageProcessingError: If the image cannot be loaded.
    """
    img = _load_image_rgb(image_path)
    return str(imagehash.dhash(img))


def hamming_distance(hash_a: str, hash_b: str) -> int:
    """Compute the Hamming distance between two hex hash strings.

    The Hamming distance is the number of bit positions where the two
    hashes differ.  Lower distance = more similar images.

    For 64-bit hashes:
      - 0:     identical images
      - 1-5:   near-duplicate (resize, recompress)
      - 6-10:  suspicious (heavy crop, rotation)
      - 11+:   likely unrelated

    Args:
        hash_a: First hash as a hex string (e.g. "a0b1c2d3e4f56789").
        hash_b: Second hash as a hex string, same length as hash_a.

    Returns:
        Integer count of differing bits.

    Raises:
        ValueError: If hashes have different lengths.
    """
    if len(hash_a) != len(hash_b):
        raise ValueError(
            f"Hash length mismatch: {len(hash_a)} vs {len(hash_b)}. "
            f"Both hashes must be the same length for comparison."
        )

    # Convert hex strings to imagehash objects for proper bit comparison
    ih_a = imagehash.hex_to_hash(hash_a)
    ih_b = imagehash.hex_to_hash(hash_b)
    return ih_a - ih_b  # imagehash overloads __sub__ as Hamming distance
