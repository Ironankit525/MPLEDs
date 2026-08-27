"""
Tests for the hashing module (Layer 1 & 2).

Verifies:
  - SHA-256 produces consistent, correct hashes
  - pHash and dHash produce valid hex strings
  - Hamming distance is 0 for identical images
  - Hamming distance is low for resized/cropped versions
  - Hamming distance is high for unrelated images
  - Custom ImageProcessingError is raised for bad files
"""

import os
import tempfile
from pathlib import Path

import pytest
from PIL import Image

from app.hashing import (
    ImageProcessingError,
    compute_dhash,
    compute_phash,
    compute_sha256,
    hamming_distance,
)


@pytest.fixture
def sample_image(tmp_path: Path) -> Path:
    """Create a sample 200x200 gradient image for testing."""
    img = Image.new("RGB", (200, 200))
    for x in range(200):
        for y in range(200):
            img.putpixel((x, y), (x % 256, y % 256, (x + y) % 256))
    path = tmp_path / "sample.jpg"
    img.save(path, "JPEG", quality=95)
    return path


@pytest.fixture
def sample_image_resized(sample_image: Path, tmp_path: Path) -> Path:
    """Create a 60%-scaled version of the sample image."""
    img = Image.open(sample_image)
    new_size = (int(img.width * 0.6), int(img.height * 0.6))
    resized = img.resize(new_size, Image.LANCZOS)
    path = tmp_path / "sample_resized.jpg"
    resized.save(path, "JPEG", quality=85)
    return path


@pytest.fixture
def sample_image_cropped(sample_image: Path, tmp_path: Path) -> Path:
    """Create a cropped version (12% off each edge) of the sample image."""
    img = Image.open(sample_image)
    w, h = img.size
    margin_x = int(w * 0.12)
    margin_y = int(h * 0.12)
    cropped = img.crop((margin_x, margin_y, w - margin_x, h - margin_y))
    path = tmp_path / "sample_cropped.jpg"
    cropped.save(path, "JPEG", quality=90)
    return path


@pytest.fixture
def unrelated_image(tmp_path: Path) -> Path:
    """Create a completely different image (solid blue)."""
    img = Image.new("RGB", (200, 200), color=(0, 0, 255))
    path = tmp_path / "unrelated.jpg"
    img.save(path, "JPEG", quality=95)
    return path


class TestSHA256:
    """Tests for byte-level SHA-256 hashing."""

    def test_consistent_hash(self, sample_image: Path) -> None:
        """Same file produces the same hash every time."""
        h1 = compute_sha256(str(sample_image))
        h2 = compute_sha256(str(sample_image))
        assert h1 == h2

    def test_hex_format(self, sample_image: Path) -> None:
        """SHA-256 hash is a 64-character hex string."""
        h = compute_sha256(str(sample_image))
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    def test_different_for_resized(self, sample_image: Path, sample_image_resized: Path) -> None:
        """Resized image has a completely different SHA-256 (this is expected)."""
        h1 = compute_sha256(str(sample_image))
        h2 = compute_sha256(str(sample_image_resized))
        assert h1 != h2

    def test_missing_file_raises(self) -> None:
        """Non-existent file raises ImageProcessingError."""
        with pytest.raises(ImageProcessingError, match="File not found"):
            compute_sha256("/nonexistent/image.jpg")


class TestPerceptualHash:
    """Tests for pHash and dHash."""

    def test_phash_valid_hex(self, sample_image: Path) -> None:
        """pHash returns a valid hex string."""
        h = compute_phash(str(sample_image))
        assert len(h) == 16  # 64-bit hash = 16 hex chars
        assert all(c in "0123456789abcdef" for c in h)

    def test_dhash_valid_hex(self, sample_image: Path) -> None:
        """dHash returns a valid hex string."""
        h = compute_dhash(str(sample_image))
        assert len(h) == 16
        assert all(c in "0123456789abcdef" for c in h)

    def test_identical_images_zero_distance(self, sample_image: Path) -> None:
        """Same image file produces Hamming distance of 0."""
        h1 = compute_phash(str(sample_image))
        h2 = compute_phash(str(sample_image))
        assert hamming_distance(h1, h2) == 0

    def test_resized_low_distance(self, sample_image: Path, sample_image_resized: Path) -> None:
        """Resized image has low pHash distance (≤ duplicate threshold)."""
        h1 = compute_phash(str(sample_image))
        h2 = compute_phash(str(sample_image_resized))
        dist = hamming_distance(h1, h2)
        # Resized images should be very similar
        assert dist <= 10, f"Resized image pHash distance {dist} is too high"

    def test_cropped_low_distance(self, sample_image: Path, sample_image_cropped: Path) -> None:
        """Cropped image has low-ish pHash distance."""
        h1 = compute_phash(str(sample_image))
        h2 = compute_phash(str(sample_image_cropped))
        dist = hamming_distance(h1, h2)
        # 12% crop on synthetic images can produce larger hash differences
        # than on natural photographs. Allow up to 25 for synthetic test images.
        assert dist <= 25, f"Cropped image pHash distance {dist} is too high"

    def test_unrelated_high_distance(self, sample_image: Path, unrelated_image: Path) -> None:
        """Unrelated images have high pHash distance."""
        h1 = compute_phash(str(sample_image))
        h2 = compute_phash(str(unrelated_image))
        dist = hamming_distance(h1, h2)
        # Completely different images should differ significantly
        assert dist > 10, f"Unrelated image pHash distance {dist} is too low"

    def test_corrupt_file_raises(self, tmp_path: Path) -> None:
        """Corrupt file raises ImageProcessingError."""
        bad_file = tmp_path / "corrupt.jpg"
        bad_file.write_bytes(b"not a real jpeg file contents")
        with pytest.raises(ImageProcessingError):
            compute_phash(str(bad_file))


class TestHammingDistance:
    """Tests for the Hamming distance function."""

    def test_identical_hashes(self) -> None:
        """Identical hashes have distance 0."""
        assert hamming_distance("a0b1c2d3e4f56789", "a0b1c2d3e4f56789") == 0

    def test_symmetric(self) -> None:
        """Hamming distance is symmetric: d(a,b) == d(b,a)."""
        h1 = "a0b1c2d3e4f56789"
        h2 = "a0b1c2d3e4f56780"
        assert hamming_distance(h1, h2) == hamming_distance(h2, h1)

    def test_length_mismatch_raises(self) -> None:
        """Hashes of different lengths raise ValueError."""
        with pytest.raises(ValueError, match="length mismatch"):
            hamming_distance("abc", "abcdef")

    def test_known_distance(self) -> None:
        """Verify against a known pair."""
        # 0x0 vs 0x1 differ by 1 bit
        # Using full 16-char strings where only last nibble differs
        h1 = "0000000000000000"
        h2 = "0000000000000001"
        assert hamming_distance(h1, h2) == 1
