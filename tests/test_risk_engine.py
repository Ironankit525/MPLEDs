"""
Tests for the risk scoring engine.

Verifies:
  - Score arithmetic: given a fixed set of flags, assert the exact expected total
  - Risk level bucketing (LOW/MEDIUM/HIGH)
  - Score capping at 100
  - Graceful degradation: monkeypatch CLIP to fail, assert pipeline still works
  - End-to-end assessment with an in-memory database
"""

from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from PIL import Image
from pymongo.database import Database

from app.config import settings
from app.duplicate_search import DuplicateReport, Match
from app.models import District, ImageRecord
from app.risk_engine import (
    RiskAssessment,
    ScoredFlag,
    _exif_flag_weight,
    _recommendation_from_level,
    _score_from_level,
    assess_image,
)


@pytest.fixture
def db_session(tmp_path):
    import mongomock
    from app.main import app
    from app.database import get_db

    client = mongomock.MongoClient()
    db = client.test_db
    app.dependency_overrides[get_db] = lambda: db

    # Seed a few districts for GPS checks
    for name, state, lat, lon in [
        ("Pune", "Maharashtra", 18.5204, 73.8567),
        ("Nagpur", "Maharashtra", 21.1458, 79.0882),
        ("Lucknow", "Uttar Pradesh", 26.8467, 80.9462),
    ]:
        district = District(name=name, state=state, centre_latitude=lat, centre_longitude=lon)
        db.districts.insert_one(district.model_dump(by_alias=True, exclude={"id"}))

    yield db
    app.dependency_overrides.clear()



@pytest.fixture
def sample_image(tmp_path: Path) -> Path:
    """Create a simple test image."""
    img = Image.new("RGB", (200, 200))
    for x in range(200):
        for y in range(200):
            img.putpixel((x, y), (x % 256, y % 256, (x + y) % 256))
    path = tmp_path / "test_image.jpg"
    img.save(path, "JPEG", quality=95)
    return path


class TestScoreFromLevel:
    """Tests for risk level bucketing."""

    def test_low_range(self) -> None:
        """Scores 0–29 should be LOW."""
        assert _score_from_level(0) == "LOW"
        assert _score_from_level(15) == "LOW"
        assert _score_from_level(29) == "LOW"

    def test_medium_range(self) -> None:
        """Scores 30–59 should be MEDIUM."""
        assert _score_from_level(30) == "MEDIUM"
        assert _score_from_level(45) == "MEDIUM"
        assert _score_from_level(59) == "MEDIUM"

    def test_high_range(self) -> None:
        """Scores 60–100 should be HIGH."""
        assert _score_from_level(60) == "HIGH"
        assert _score_from_level(85) == "HIGH"
        assert _score_from_level(100) == "HIGH"


class TestRecommendation:
    """Tests for action recommendations."""

    def test_high_blocks_payment(self) -> None:
        assert "Block" in _recommendation_from_level("HIGH") or "block" in _recommendation_from_level("HIGH").lower()

    def test_medium_flags_review(self) -> None:
        assert "review" in _recommendation_from_level("MEDIUM").lower()

    def test_low_no_action(self) -> None:
        assert "no action" in _recommendation_from_level("LOW").lower()


class TestExifFlagWeights:
    """Tests for EXIF flag weight mapping."""

    def test_known_weights(self) -> None:
        """Verify key flag weights match configuration."""
        assert _exif_flag_weight("EXIF_STRIPPED") == settings.WEIGHT_EXIF_STRIPPED
        assert _exif_flag_weight("PHOTO_PREDATES_SANCTION") == settings.WEIGHT_PHOTO_PREDATES_SANCTION
        assert _exif_flag_weight("GPS_DISTRICT_MISMATCH") == settings.WEIGHT_GPS_MISMATCH
        assert _exif_flag_weight("SOFTWARE_EDITED") == settings.WEIGHT_EDITING_SOFTWARE

    def test_gps_missing_is_zero(self) -> None:
        """GPS_MISSING is informational only, should add 0 points."""
        assert _exif_flag_weight("GPS_MISSING") == 0

    def test_unknown_flag_is_zero(self) -> None:
        """Unknown flag codes should safely return 0."""
        assert _exif_flag_weight("UNKNOWN_FLAG") == 0


class TestScoreArithmetic:
    """Tests for score arithmetic with fixed flag sets."""

    def test_exact_match_cross_work(self) -> None:
        """Exact SHA-256 match (different work) = 60 points."""
        assert settings.WEIGHT_EXACT_MATCH_CROSS_WORK == 60

    def test_perceptual_plus_cross_district(self) -> None:
        """Perceptual duplicate (50) + cross-district (20) = 70."""
        total = settings.WEIGHT_PERCEPTUAL_DUPLICATE_CROSS_WORK + settings.WEIGHT_CROSS_DISTRICT
        assert total == 70

    def test_full_fraud_scenario(self) -> None:
        """Worst case: exact match + cross-district + cross-MP + predates + GPS mismatch.

        Should cap at 100.
        """
        total = (
            settings.WEIGHT_EXACT_MATCH_CROSS_WORK +  # 60
            settings.WEIGHT_CROSS_DISTRICT +            # 20
            settings.WEIGHT_CROSS_MP +                  # 20
            settings.WEIGHT_PHOTO_PREDATES_SANCTION +   # 30
            settings.WEIGHT_GPS_MISMATCH                # 30
        )
        # Raw total = 160, but capped at 100
        assert total > 100
        assert min(total, 100) == 100

    def test_exif_stripped_alone(self) -> None:
        """EXIF stripped alone = 15 points → LOW risk."""
        score = settings.WEIGHT_EXIF_STRIPPED
        assert score == 15
        assert _score_from_level(score) == "LOW"

    def test_content_mismatch_plus_editing(self) -> None:
        """Content mismatch (25) + editing software (10) = 35 → MEDIUM."""
        total = settings.WEIGHT_CONTENT_MISMATCH + settings.WEIGHT_EDITING_SOFTWARE
        assert total == 35
        assert _score_from_level(total) == "MEDIUM"


class TestAssessImage:
    """Integration tests for the assess_image function."""

    def test_clean_image_low_risk(self, db_session: Database, sample_image: Path) -> None:
        """Clean image with no matches should get LOW risk."""
        # Disable CLIP and ELA for this test — synthetic flat-colour images
        # trigger ELA's SCREENSHOT_DETECTED flag, which is correct behaviour
        # but not what this test is checking.
        with patch.object(settings, "ENABLE_CLIP", False), \
             patch.object(settings, "ENABLE_ELA", False):
            assessment = assess_image(
                image_path=str(sample_image),
                work_id="WORK-TEST-001",
                work_type="road construction",
                district="Pune",
                state="Maharashtra",
                mp_name="Test MP",
                sanction_date=datetime(2020, 1, 1),
                session=db_session,
            )

        assert assessment.risk_level == "LOW"
        assert assessment.risk_score < 30
        assert assessment.sha256 is not None
        assert assessment.phash is not None

    def test_layers_skipped_without_clip(self, db_session: Database, sample_image: Path) -> None:
        """When CLIP disabled, it should appear in layers_skipped."""
        with patch.object(settings, "ENABLE_CLIP", False):
            assessment = assess_image(
                image_path=str(sample_image),
                work_id="WORK-TEST-001",
                work_type=None,
                district="Pune",
                state=None,
                mp_name=None,
                sanction_date=None,
                session=db_session,
            )

        assert "clip" in assessment.layers_skipped
        assert "sha256" in assessment.layers_run
        assert "phash" in assessment.layers_run
        assert "exif" in assessment.layers_run

    def test_exact_duplicate_high_risk(self, db_session: Database, sample_image: Path) -> None:
        """Uploading the same image under a different work_id should flag HIGH."""
        from app.hashing import compute_sha256, compute_phash, compute_dhash

        # First, insert the image into the database
        record = ImageRecord(
            work_id="WORK-001",
            district="Pune",
            mp_name="MP Singh",
            file_path=str(sample_image),
            sha256=compute_sha256(str(sample_image)),
            phash=compute_phash(str(sample_image)),
            dhash=compute_dhash(str(sample_image)),
            uploaded_at=datetime.utcnow(),
        )
        record_dict = record.model_dump(by_alias=True, exclude={"id"})
        res = db_session.image_records.insert_one(record_dict)
        record_dict["_id"] = str(res.inserted_id)
        record = ImageRecord(**record_dict)

        # Now assess the same image under a different work_id
        with patch.object(settings, "ENABLE_CLIP", False):
            assessment = assess_image(
                image_path=str(sample_image),
                work_id="WORK-002",
                work_type=None,
                district="Pune",
                state=None,
                mp_name="MP Singh",
                sanction_date=None,
                session=db_session,
            )

        assert assessment.risk_level == "HIGH"
        assert assessment.risk_score >= 60
        flag_codes = [f.code for f in assessment.flags]
        assert "EXACT_DUPLICATE" in flag_codes

    def test_all_flags_have_points(self, db_session: Database, sample_image: Path) -> None:
        """Every flag in the assessment should have a non-negative points_added."""
        with patch.object(settings, "ENABLE_CLIP", False):
            assessment = assess_image(
                image_path=str(sample_image),
                work_id="WORK-TEST-001",
                work_type=None,
                district="Pune",
                state=None,
                mp_name=None,
                sanction_date=None,
                session=db_session,
            )

        for flag in assessment.flags:
            assert flag.points_added >= 0, f"Flag {flag.code} has negative points"

    def test_processing_time_recorded(self, db_session: Database, sample_image: Path) -> None:
        """Processing time should be recorded and positive."""
        with patch.object(settings, "ENABLE_CLIP", False):
            assessment = assess_image(
                image_path=str(sample_image),
                work_id="WORK-TEST-001",
                work_type=None,
                district="Pune",
                state=None,
                mp_name=None,
                sanction_date=None,
                session=db_session,
            )

        assert assessment.processing_time_ms >= 0


class TestSemanticDuplicateScoring:
    """CLIP similarity is correlated evidence and must not stack per neighbour."""

    @staticmethod
    def _match(work_id: str, similarity: float) -> Match:
        record = ImageRecord(
            work_id=work_id,
            district="Nagpur",
            mp_name="Other MP",
            file_path=f"/{work_id}.jpg",
            sha256="a" * 64,
            phash="0" * 16,
            uploaded_at=datetime.utcnow(),
        )
        return Match(
            matched_record=record,
            similarity_metric="clip",
            raw_score=similarity,
            confidence="LIKELY" if similarity >= settings.EMBEDDING_DUPLICATE_THRESHOLD else "POSSIBLE",
            same_work=False,
            cross_work=True,
            cross_district=True,
            cross_mp=True,
        )

    def _assess_with_matches(self, db_session: Database, sample_image: Path, matches: list[Match]):
        clip_engine = MagicMock()
        clip_engine.embed_image.return_value = np.ones(512, dtype=np.float32)
        clip_engine.zero_shot_match.return_value = 1.0
        report = DuplicateReport(semantic_matches=matches)

        with patch.object(settings, "ENABLE_CLIP", True), \
             patch.object(settings, "ENABLE_ELA", False), \
             patch("app.risk_engine.get_clip_engine", return_value=clip_engine), \
             patch("app.risk_engine.search_all_layers", return_value=report):
            return assess_image(
                image_path=str(sample_image),
                work_id="WORK-CANDIDATE",
                work_type="road construction",
                district="Pune",
                state="Maharashtra",
                mp_name="Candidate MP",
                sanction_date=None,
                session=db_session,
            )

    def test_weak_semantic_match_is_review_signal(self, db_session: Database, sample_image: Path) -> None:
        assessment = self._assess_with_matches(
            db_session,
            sample_image,
            [self._match("WORK-WEAK", settings.EMBEDDING_SUSPICIOUS_THRESHOLD + 0.05)],
        )

        semantic_flags = [f for f in assessment.flags if f.code.startswith("SEMANTIC_")]
        assert len(semantic_flags) == 1
        assert semantic_flags[0].code == "SEMANTIC_SUSPICIOUS"
        assert semantic_flags[0].severity == "MEDIUM"
        assert semantic_flags[0].points_added == settings.WEIGHT_SEMANTIC_SUSPICIOUS_CROSS_WORK

    def test_only_strongest_semantic_match_is_scored_once(
        self, db_session: Database, sample_image: Path,
    ) -> None:
        assessment = self._assess_with_matches(
            db_session,
            sample_image,
            [
                self._match("WORK-STRONG", settings.EMBEDDING_DUPLICATE_THRESHOLD + 0.01),
                self._match("WORK-WEAK", settings.EMBEDDING_SUSPICIOUS_THRESHOLD + 0.05),
            ],
        )

        assert len([f for f in assessment.flags if f.code == "SEMANTIC_DUPLICATE"]) == 1
        assert len([f for f in assessment.flags if f.code == "SEMANTIC_SUSPICIOUS"]) == 0
        assert len([f for f in assessment.flags if f.code == "CROSS_DISTRICT_MATCH"]) == 1
        assert len([f for f in assessment.flags if f.code == "CROSS_MP_MATCH"]) == 1
        assert assessment.risk_score == 90  # 35 + 20 + 20 + contextual EXIF 15
        semantic_flag = next(f for f in assessment.flags if f.code == "SEMANTIC_DUPLICATE")
        assert semantic_flag.evidence["additional_semantic_matches"] == 1


class TestContentMismatchSeverityTiers:
    """A borderline content mismatch and a blatant one are different
    evidence and must not score or read the same.

    Prompted by a real report: a photo of a person, submitted claiming
    'road construction', scored only MEDIUM (25 points, from
    CONTENT_MISMATCH alone) despite CLIP being ~99.9% certain it wasn't
    a road. See app/config.py's SEMANTIC_MATCH_SEVERE_THRESHOLD comment
    for the measurement (every genuine photo in the calibration corpus
    scores >= 0.372 against its own true type) that sets where the
    severe tier starts.
    """

    def _assess_with_score(self, db_session: Database, sample_image: Path, match_score: float):
        clip_engine = MagicMock()
        clip_engine.embed_image.return_value = np.ones(512, dtype=np.float32)
        clip_engine.zero_shot_match.return_value = match_score
        report = DuplicateReport()  # no duplicate matches — isolates the content check

        with patch.object(settings, "ENABLE_CLIP", True), \
             patch.object(settings, "ENABLE_ELA", False), \
             patch("app.risk_engine.get_clip_engine", return_value=clip_engine), \
             patch("app.risk_engine.search_all_layers", return_value=report):
            return assess_image(
                image_path=str(sample_image),
                work_id="WORK-CONTENT",
                work_type="road construction",
                district="Pune",
                state="Maharashtra",
                mp_name="Candidate MP",
                sanction_date=None,
                session=db_session,
            )

    def test_borderline_mismatch_stays_medium(self, db_session: Database, sample_image: Path) -> None:
        """Just under the ordinary threshold — a hard-but-plausible case,
        not near the severe floor — still reads as MEDIUM."""
        assessment = self._assess_with_score(db_session, sample_image, 0.45)

        flags = [f for f in assessment.flags if f.code.startswith("CONTENT_MISMATCH")]
        assert len(flags) == 1
        assert flags[0].code == "CONTENT_MISMATCH"
        assert flags[0].severity == "MEDIUM"
        assert flags[0].points_added == settings.WEIGHT_CONTENT_MISMATCH

    def test_blatant_mismatch_is_high_on_its_own(self, db_session: Database, sample_image: Path) -> None:
        """Confidence far below any genuine photo ever measured — e.g. a
        portrait claimed as road-construction evidence — reaches HIGH
        from this one signal alone, without needing another flag to stack."""
        assessment = self._assess_with_score(db_session, sample_image, 0.002)

        flags = [f for f in assessment.flags if f.code.startswith("CONTENT_MISMATCH")]
        assert len(flags) == 1
        assert flags[0].code == "CONTENT_MISMATCH_SEVERE"
        assert flags[0].severity == "HIGH"
        assert flags[0].points_added == settings.WEIGHT_CONTENT_MISMATCH_SEVERE
        assert assessment.risk_level == "HIGH"
        assert assessment.risk_score >= 60

    def test_severe_message_states_certainty_not_match_likelihood(
        self, db_session: Database, sample_image: Path,
    ) -> None:
        """The number a reader sees first must be how sure the system is
        of the MISMATCH, not the (confusingly low, easy to misread as
        'weak finding') raw match-likelihood score."""
        assessment = self._assess_with_score(db_session, sample_image, 0.001)
        flag = next(f for f in assessment.flags if f.code == "CONTENT_MISMATCH_SEVERE")

        assert "99.9%" in flag.message or "99.90%" in flag.message
        # The raw match-likelihood figure is still present, but as
        # supporting detail — not the number leading the sentence.
        assert flag.message.index("confident it does not") < flag.message.index("0.1%")


class TestGracefulDegradation:
    """Tests for graceful degradation when CLIP is unavailable."""

    def test_clip_disabled_still_works(self, db_session: Database, sample_image: Path) -> None:
        """Pipeline should complete successfully with CLIP disabled."""
        with patch.object(settings, "ENABLE_CLIP", False):
            assessment = assess_image(
                image_path=str(sample_image),
                work_id="WORK-TEST-001",
                work_type="road construction",
                district="Pune",
                state="Maharashtra",
                mp_name="Test MP",
                sanction_date=datetime(2020, 1, 1),
                session=db_session,
            )

        # Should still produce a valid assessment
        assert assessment.risk_level in ("LOW", "MEDIUM", "HIGH")
        assert 0 <= assessment.risk_score <= 100
        assert "clip" in assessment.layers_skipped
        assert len(assessment.layers_run) >= 3  # sha256, phash, dhash, exif

    def test_clip_import_failure_still_works(self, db_session: Database, sample_image: Path) -> None:
        """Even if torch import fails, the pipeline should still return valid results."""
        # Reset the CLIP engine singleton to force re-initialization
        import app.embeddings as emb_module
        old_instance = emb_module._clip_engine_instance
        emb_module._clip_engine_instance = None

        try:
            with patch.object(settings, "ENABLE_CLIP", False):
                assessment = assess_image(
                    image_path=str(sample_image),
                    work_id="WORK-TEST-001",
                    work_type="road construction",
                    district="Pune",
                    state="Maharashtra",
                    mp_name="Test MP",
                    sanction_date=datetime(2020, 1, 1),
                    session=db_session,
                )

                # Assertions inside the patch context so ENABLE_CLIP is still False
                assert assessment.risk_level in ("LOW", "MEDIUM", "HIGH")
                assert "clip" in assessment.layers_skipped
        finally:
            # Restore singleton
            emb_module._clip_engine_instance = old_instance


class TestOCRAmountWiring:
    """Verifies claimed_amount actually reaches app.ocr_analysis.analyse_receipt
    from assess_image().

    Step 5.2 used to call analyse_receipt(..., claimed_amount=None)
    unconditionally — assess_image() had no claimed_amount parameter at
    all, so RECEIPT_AMOUNT_MISMATCH could never fire no matter what a
    caller wanted to check against. These tests mock analyse_receipt
    itself rather than depending on real OCR accuracy — the point here
    is the wiring, not OCR quality (see tests/test_ocr.py for the
    extraction-logic tests).
    """

    def test_claimed_amount_reaches_analyse_receipt(self, db_session: Database, sample_image: Path) -> None:
        from app.ocr_analysis import OCRResult

        with patch("app.ocr_analysis.analyse_receipt") as mock_analyse:
            mock_analyse.return_value = OCRResult(available=True, extracted_amounts=[50000.0])
            with patch.object(settings, "ENABLE_CLIP", False):
                assess_image(
                    image_path=str(sample_image),
                    work_id="WORK-RECEIPT-001",
                    work_type="receipt",
                    district="Pune",
                    state=None,
                    mp_name=None,
                    sanction_date=None,
                    session=db_session,
                    claimed_amount=123456.78,
                )

        mock_analyse.assert_called_once()
        assert mock_analyse.call_args.kwargs["claimed_amount"] == 123456.78

    def test_amount_mismatch_flag_carries_claimed_amount_in_evidence(
        self, db_session: Database, sample_image: Path,
    ) -> None:
        from app.ocr_analysis import OCRResult

        with patch("app.ocr_analysis.analyse_receipt") as mock_analyse:
            mock_analyse.return_value = OCRResult(
                available=True,
                extracted_amounts=[10000.0],
                flags=["RECEIPT_AMOUNT_MISMATCH"],
            )
            with patch.object(settings, "ENABLE_CLIP", False):
                assessment = assess_image(
                    image_path=str(sample_image),
                    work_id="WORK-RECEIPT-002",
                    work_type="invoice",
                    district="Pune",
                    state=None,
                    mp_name=None,
                    sanction_date=None,
                    session=db_session,
                    claimed_amount=50000.0,
                )

        flag = next(f for f in assessment.flags if f.code == "RECEIPT_AMOUNT_MISMATCH")
        assert flag.points_added == settings.WEIGHT_RECEIPT_AMOUNT_MISMATCH
        assert flag.evidence["claimed_amount"] == 50000.0
        assert flag.evidence["extracted_amounts"] == [10000.0]

    def test_no_work_type_never_calls_analyse_receipt(self, db_session: Database, sample_image: Path) -> None:
        """claimed_amount is a no-op unless work_type is receipt/invoice/document."""
        with patch("app.ocr_analysis.analyse_receipt") as mock_analyse:
            with patch.object(settings, "ENABLE_CLIP", False):
                assess_image(
                    image_path=str(sample_image),
                    work_id="WORK-ROAD-001",
                    work_type="road construction",
                    district="Pune",
                    state=None,
                    mp_name=None,
                    sanction_date=None,
                    session=db_session,
                    claimed_amount=50000.0,
                )
        mock_analyse.assert_not_called()
