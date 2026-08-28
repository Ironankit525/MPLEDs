"""
Tests for Task 4's conditional (context-dependent) flag weight mechanism.

Verifies the two EXIF_STRIPPED branches defined in
settings.CONDITIONAL_FLAG_WEIGHTS:
  - "alone":       no other flag present -> 5 points, LOW severity
  - "with_others": at least one other flag present -> 15 points, MEDIUM

The mechanism itself (_resolve_conditional_flags in app/risk_engine.py)
is fully generic and driven by config — these tests exercise it through
the public assess_image() entry point rather than calling it directly,
so they also double as regression coverage for the wiring.
"""

from datetime import datetime
from pathlib import Path

import pytest
from PIL import Image
from pymongo.database import Database

from app.config import settings
from app.hashing import compute_sha256, compute_phash, compute_dhash
from app.models import District, ImageRecord
from app.risk_engine import assess_image
from unittest.mock import patch


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


def _make_image(path: Path, seed: int = 0) -> Path:
    """A plain image with NO EXIF data (PIL doesn't add any by default)."""
    img = Image.new("RGB", (200, 200))
    for x in range(200):
        for y in range(200):
            img.putpixel((x, y), ((x + seed) % 256, y % 256, (x + y) % 256))
    img.save(path, "JPEG", quality=95)
    return path


class TestConditionalExifWeight:
    def test_exif_stripped_alone_scores_five_points_low(self, db_session: Database, tmp_path: Path) -> None:
        """No EXIF, no other RISK-CARRYING flag -> the 'alone' branch: 5
        pts, LOW. GPS_MISSING also fires here (no EXIF GPS and no device
        location were provided either), but it's a zero-point
        informational flag — a second unknown fact, not an independent
        aggravating one — so it must not itself trip EXIF_STRIPPED into
        the harsher 'with_others' branch. See
        _resolve_conditional_flags's docstring for why "other flag
        present" is defined by points_added > 0, not just any co-occurring
        code."""
        image_path = _make_image(tmp_path / "solo.jpg", seed=1)

        # Disable CLIP and ELA so only EXIF flags fire
        with patch.object(settings, "ENABLE_CLIP", False), \
             patch.object(settings, "ENABLE_ELA", False):
            assessment = assess_image(
                image_path=str(image_path),
                work_id="MP-PUN-2024-0001",
                work_type=None,
                district="Pune",
                state="Maharashtra",
                mp_name="Girish Bapat",
                sanction_date=None,
                session=db_session,
            )

        exif_flags = [f for f in assessment.flags if f.code == "EXIF_STRIPPED"]
        assert len(exif_flags) == 1
        assert exif_flags[0].points_added == 5
        assert exif_flags[0].severity == "LOW"
        assert {f.code for f in assessment.flags} == {"EXIF_STRIPPED", "GPS_MISSING"}
        assert next(f for f in assessment.flags if f.code == "GPS_MISSING").points_added == 0
        assert assessment.risk_score == 5
        assert assessment.risk_level == "LOW"

    def test_exif_stripped_with_duplicate_scores_fifteen_points_medium(
        self, db_session: Database, tmp_path: Path,
    ) -> None:
        """No EXIF + a cross-work exact duplicate -> the 'with_others' branch: 15 pts, MEDIUM."""
        image_path = _make_image(tmp_path / "dup.jpg", seed=2)

        # Pre-insert the same image under a different work_id, same district
        # (so no CROSS_DISTRICT_MATCH/CROSS_MP_MATCH muddies the score).
        existing = ImageRecord(
            work_id="MP-PUN-2024-0099",
            work_type="road construction",
            district="Pune",
            state="Maharashtra",
            mp_name="Girish Bapat",
            sanction_date=None,
            file_path=str(image_path),
            sha256=compute_sha256(str(image_path)),
            phash=compute_phash(str(image_path)),
            dhash=compute_dhash(str(image_path)),
            exif_present=False,
            uploaded_at=datetime.utcnow(),
        )
        record_dict = existing.model_dump(by_alias=True, exclude={"id"})
        res = db_session.image_records.insert_one(record_dict)
        record_dict["_id"] = str(res.inserted_id)
        existing = ImageRecord(**record_dict)

        # Disable CLIP and ELA so only hash + EXIF flags fire
        with patch.object(settings, "ENABLE_CLIP", False), \
             patch.object(settings, "ENABLE_ELA", False):
            assessment = assess_image(
                image_path=str(image_path),
                work_id="MP-PUN-2024-0001",
                work_type=None,
                district="Pune",
                state="Maharashtra",
                mp_name="Girish Bapat",
                sanction_date=None,
                session=db_session,
            )

        codes = [f.code for f in assessment.flags]
        assert "EXACT_DUPLICATE" in codes
        assert "EXIF_STRIPPED" in codes

        exif_flag = next(f for f in assessment.flags if f.code == "EXIF_STRIPPED")
        assert exif_flag.points_added == 15
        assert exif_flag.severity == "MEDIUM"

        exact_flag = next(f for f in assessment.flags if f.code == "EXACT_DUPLICATE")
        assert exact_flag.points_added == settings.WEIGHT_EXACT_MATCH_CROSS_WORK  # 60

        assert assessment.risk_score == 75  # 60 (EXACT_DUPLICATE) + 15 (EXIF_STRIPPED, with_others)
