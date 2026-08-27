"""
Tests for the duplicate search engine.

Verifies:
  - Exact duplicate search (SHA-256 matching)
  - Perceptual duplicate search (pHash matching)
  - Cross-boundary flag computation (cross-work, cross-district, cross-MP)
  - Search deduplication across layers
"""

from datetime import datetime
from pathlib import Path

import pytest
from PIL import Image
from pymongo.database import Database

from app.duplicate_search import (
    DuplicateReport,
    Match,
    find_exact_duplicates,
    find_dhash_duplicates,
    find_perceptual_duplicates,
    search_all_layers,
)
from app.hashing import compute_dhash, compute_phash, compute_sha256
from app.models import ImageRecord


@pytest.fixture
def db_session(tmp_path):
    import mongomock
    from app.main import app
    from app.database import get_db
    
    client = mongomock.MongoClient()
    db = client.test_db
    app.dependency_overrides[get_db] = lambda: db
    yield db
    app.dependency_overrides.clear()


@pytest.fixture
def sample_image_a(tmp_path: Path) -> Path:
    """Create a gradient test image."""
    img = Image.new("RGB", (200, 200))
    for x in range(200):
        for y in range(200):
            img.putpixel((x, y), (x % 256, y % 256, (x + y) % 256))
    path = tmp_path / "image_a.jpg"
    img.save(path, "JPEG", quality=95)
    return path


@pytest.fixture
def sample_image_b(tmp_path: Path) -> Path:
    """Create a different test image (solid color)."""
    img = Image.new("RGB", (200, 200), color=(50, 100, 150))
    path = tmp_path / "image_b.jpg"
    img.save(path, "JPEG", quality=95)
    return path


def _insert_record(
    session: Database,
    image_path: Path,
    work_id: str = "WORK-001",
    district: str = "Pune",
    mp_name: str = "MP Singh",
) -> ImageRecord:
    """Helper: insert an image record into the database."""
    sha = compute_sha256(str(image_path))
    ph = compute_phash(str(image_path))
    dh = compute_dhash(str(image_path))

    record = ImageRecord(
        work_id=work_id,
        district=district,
        mp_name=mp_name,
        file_path=str(image_path),
        sha256=sha,
        phash=ph,
        dhash=dh,
        uploaded_at=datetime.utcnow(),
    )
    record_dict = record.model_dump(by_alias=True, exclude={"id"})
    res = session.image_records.insert_one(record_dict)
    record_dict["_id"] = str(res.inserted_id)
    return ImageRecord(**record_dict)


class TestExactDuplicates:
    """Tests for SHA-256 exact match search."""

    def test_finds_exact_match(self, db_session: Database, sample_image_a: Path) -> None:
        """Should find the same image by SHA-256."""
        _insert_record(db_session, sample_image_a)
        sha = compute_sha256(str(sample_image_a))
        matches = find_exact_duplicates(sha, db_session)
        assert len(matches) == 1

    def test_no_match_for_different_image(self, db_session: Database, sample_image_a: Path, sample_image_b: Path) -> None:
        """Should not match a different image."""
        _insert_record(db_session, sample_image_a)
        sha = compute_sha256(str(sample_image_b))
        matches = find_exact_duplicates(sha, db_session)
        assert len(matches) == 0

    def test_empty_database(self, db_session: Database) -> None:
        """Should return empty list for empty database."""
        matches = find_exact_duplicates("abc123", db_session)
        assert matches == []


class TestPerceptualDuplicates:
    """Tests for perceptual hash matching."""

    def test_finds_similar_image(self, db_session: Database, sample_image_a: Path, tmp_path: Path) -> None:
        """Should find a resized version of the same image."""
        _insert_record(db_session, sample_image_a)

        # Create a resized version
        img = Image.open(sample_image_a)
        resized = img.resize((120, 120), Image.LANCZOS)
        resized_path = tmp_path / "resized.jpg"
        resized.save(resized_path, "JPEG", quality=85)

        ph = compute_phash(str(resized_path))
        matches = find_perceptual_duplicates(ph, db_session, threshold=10)
        assert len(matches) >= 1

    def test_does_not_match_unrelated(self, db_session: Database, sample_image_a: Path, sample_image_b: Path) -> None:
        """Should not match a completely different image within tight threshold."""
        _insert_record(db_session, sample_image_a)
        ph = compute_phash(str(sample_image_b))
        matches = find_perceptual_duplicates(ph, db_session, threshold=3)
        assert len(matches) == 0

    def test_finds_dhash_match_when_phash_misses(self, db_session: Database, sample_image_a: Path) -> None:
        """dHash must be an active fallback, not just a stored field."""
        record = ImageRecord(
            work_id="WORK-001",
            district="Pune",
            mp_name="MP Singh",
            file_path=str(sample_image_a),
            sha256="a" * 64,
            phash="0" * 16,
            dhash="0" * 16,
            uploaded_at=datetime.utcnow(),
        )
        db_session.image_records.insert_one(record.model_dump(by_alias=True, exclude={"id"}))

        matches = find_dhash_duplicates("0" * 16, db_session, threshold=0)
        assert len(matches) == 1

        report = search_all_layers(
            sha256="b" * 64,
            phash="f" * 16,  # 64 bits away from the stored pHash
            dhash="0" * 16,  # exact dHash match
            embedding=None,
            work_id="WORK-002",
            district="Nagpur",
            mp_name="MP Sharma",
            session=db_session,
        )
        assert len(report.perceptual_matches) == 1
        assert report.perceptual_matches[0].similarity_metric == "dhash"
        assert report.perceptual_matches[0].raw_score == 0


class TestSearchAllLayers:
    """Tests for the unified multi-layer search."""

    def test_cross_work_flag(self, db_session: Database, sample_image_a: Path) -> None:
        """Matching image from different work_id should be flagged cross_work."""
        _insert_record(db_session, sample_image_a, work_id="WORK-001")

        sha = compute_sha256(str(sample_image_a))
        ph = compute_phash(str(sample_image_a))
        dh = compute_dhash(str(sample_image_a))

        report = search_all_layers(
            sha256=sha,
            phash=ph,
            dhash=dh,
            embedding=None,
            work_id="WORK-002",  # Different work
            district="Pune",
            mp_name="MP Singh",
            session=db_session,
        )

        assert report.has_cross_work_match
        assert len(report.exact_matches) == 1
        assert report.exact_matches[0].cross_work is True

    def test_same_work_flag(self, db_session: Database, sample_image_a: Path) -> None:
        """Matching image from same work_id should be flagged same_work (benign)."""
        _insert_record(db_session, sample_image_a, work_id="WORK-001")

        sha = compute_sha256(str(sample_image_a))
        ph = compute_phash(str(sample_image_a))
        dh = compute_dhash(str(sample_image_a))

        report = search_all_layers(
            sha256=sha,
            phash=ph,
            dhash=dh,
            embedding=None,
            work_id="WORK-001",  # Same work
            district="Pune",
            mp_name="MP Singh",
            session=db_session,
        )

        assert not report.has_cross_work_match
        assert len(report.exact_matches) == 1
        assert report.exact_matches[0].same_work is True

    def test_cross_district_flag(self, db_session: Database, sample_image_a: Path) -> None:
        """Matching image from different district should be flagged cross_district."""
        _insert_record(db_session, sample_image_a, work_id="WORK-001", district="Pune")

        sha = compute_sha256(str(sample_image_a))
        ph = compute_phash(str(sample_image_a))
        dh = compute_dhash(str(sample_image_a))

        report = search_all_layers(
            sha256=sha,
            phash=ph,
            dhash=dh,
            embedding=None,
            work_id="WORK-002",
            district="Nagpur",  # Different district
            mp_name="MP Singh",
            session=db_session,
        )

        assert report.has_cross_district_match

    def test_cross_mp_flag(self, db_session: Database, sample_image_a: Path) -> None:
        """Matching image from different MP should be flagged cross_mp."""
        _insert_record(db_session, sample_image_a, work_id="WORK-001", mp_name="MP Singh")

        sha = compute_sha256(str(sample_image_a))
        ph = compute_phash(str(sample_image_a))
        dh = compute_dhash(str(sample_image_a))

        report = search_all_layers(
            sha256=sha,
            phash=ph,
            dhash=dh,
            embedding=None,
            work_id="WORK-002",
            district="Pune",
            mp_name="MP Sharma",  # Different MP
            session=db_session,
        )

        assert report.has_cross_mp_match

    def test_no_matches_empty_db(self, db_session: Database, sample_image_a: Path) -> None:
        """Empty database should return no matches."""
        sha = compute_sha256(str(sample_image_a))
        ph = compute_phash(str(sample_image_a))
        dh = compute_dhash(str(sample_image_a))

        report = search_all_layers(
            sha256=sha,
            phash=ph,
            dhash=dh,
            embedding=None,
            work_id="WORK-001",
            district="Pune",
            mp_name="MP Singh",
            session=db_session,
        )

        assert not report.has_any_match
