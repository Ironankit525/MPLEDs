"""Tests for Layer 6: ORB keypoint geometric verification.

Two groups:

  - Mechanism tests against the REAL photo corpus (skip cleanly when
    data/real_images/ is absent, same convention as
    tests/test_clip_integration.py): a 20% crop and a 90° rotation must
    verify against their source, and genuinely different photos must
    not. These pin the calibration facts the layer's whole design rests
    on (config.py cites them), so a regression in OpenCV, the ratio
    test, or the serializer shows up here rather than in production.

  - Wiring tests through search_all_layers with mongomock: retrieval is
    CLIP-nearest-neighbour, so the layer must fire when embedding +
    stored features exist, supersede a semantic match for the same
    record, and stay silent when the flag is off or CLIP is absent.

Also covers the screenshot-detection gate: SCREENSHOT_DETECTED measured
a 100% false-positive rate on real camera photos (29/29) and must not
score unless ENABLE_SCREENSHOT_DETECTION is explicitly enabled.
"""

from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest
from PIL import Image

from app.config import PROJECT_ROOT, settings
from app.keypoint_match import (
    compute_color_signature,
    count_geometric_inliers,
    deserialize_features,
    extract_orb_features,
    serialize_features,
)

REAL = PROJECT_ROOT / "data" / "real_images"
_EXTS = (".jpg", ".jpeg", ".png", ".webp")


def _real_photos(minimum: int = 2) -> list[Path]:
    found = (
        sorted(p for p in REAL.iterdir() if p.is_file() and p.suffix.lower() in _EXTS)
        if REAL.exists() else []
    )
    if len(found) < minimum:
        pytest.skip(f"Need {minimum}+ real photos in {REAL} — see its README.md.")
    return found


# ── Serialization ────────────────────────────────────────────────────

class TestSerialization:
    def test_roundtrip_preserves_values_exactly(self, tmp_path: Path) -> None:
        img = Image.open(_real_photos()[0])
        p = tmp_path / "img.jpg"
        img.save(p, "JPEG", quality=90)
        features = extract_orb_features(str(p))
        assert features is not None

        restored = deserialize_features(serialize_features(features))
        assert restored is not None
        assert np.array_equal(features.points, restored.points)
        assert np.array_equal(features.descriptors, restored.descriptors)

    def test_malformed_blob_returns_none_not_raises(self) -> None:
        assert deserialize_features(b"") is None
        assert deserialize_features(b"NOPE" + b"\x00" * 100) is None
        # Right magic, wrong length — the truncation case a partial
        # Mongo read or a schema mix-up would produce.
        assert deserialize_features(b"ORB1" + b"\x10\x00\x00\x00" + b"\x00" * 8) is None

    def test_wrong_binary_field_is_rejected(self) -> None:
        """A CLIP embedding blob (the other bytes field on ImageRecord)
        must never deserialize as ORB features."""
        embedding_blob = np.ones(512, dtype=np.float32).tobytes()
        assert deserialize_features(embedding_blob) is None


# ── Mechanism (real corpus) ──────────────────────────────────────────

class TestGeometricVerification:
    def test_20_percent_crop_verifies_against_source(self, tmp_path: Path) -> None:
        """The exact case both hash layers measurably miss (0/20 caught
        at a 12%+ crop on real photos)."""
        source = _real_photos()[0]
        img = Image.open(source).convert("RGB")
        w, h = img.size
        mx, my = int(w * 0.20), int(h * 0.20)
        cropped = tmp_path / "cropped.jpg"
        img.crop((mx, my, w - mx, h - my)).save(cropped, "JPEG", quality=90)

        inliers = count_geometric_inliers(
            extract_orb_features(str(cropped)), extract_orb_features(str(source))
        )
        assert inliers >= settings.ORB_INLIER_THRESHOLD, (
            f"20% crop produced only {inliers} inliers (threshold "
            f"{settings.ORB_INLIER_THRESHOLD}) — calibration claimed 19/20 at this severity."
        )

    def test_90_degree_rotation_verifies_against_source(self, tmp_path: Path) -> None:
        """Rotation-robust pHash covers ±5°; ORB is orientation-
        normalised and measured 20/20 at every angle up to 90°."""
        source = _real_photos()[0]
        rotated = tmp_path / "rotated.jpg"
        Image.open(source).convert("RGB").rotate(90, expand=True).save(rotated, "JPEG", quality=90)

        inliers = count_geometric_inliers(
            extract_orb_features(str(rotated)), extract_orb_features(str(source))
        )
        assert inliers >= settings.ORB_INLIER_THRESHOLD

    def test_different_photos_stay_below_threshold(self) -> None:
        """The zero-false-positive claim, spot-checked: measured maximum
        across 190 different-image pairs was 8 inliers vs threshold 15."""
        photos = _real_photos(4)
        feats = [extract_orb_features(str(p)) for p in photos[:4]]
        for i in range(len(feats)):
            for j in range(i + 1, len(feats)):
                inliers = count_geometric_inliers(feats[i], feats[j])
                assert inliers < settings.ORB_INLIER_THRESHOLD, (
                    f"{photos[i].name} vs {photos[j].name}: {inliers} inliers — "
                    f"a genuinely different pair crossed the match threshold."
                )

    def test_textureless_image_degrades_to_none(self, tmp_path: Path) -> None:
        flat = tmp_path / "flat.jpg"
        Image.new("RGB", (400, 300), (128, 128, 128)).save(flat, "JPEG", quality=90)
        assert extract_orb_features(str(flat)) is None


# ── Wiring through search_all_layers (mongomock) ─────────────────────

class TestSearchWiring:
    @pytest.fixture
    def db(self):
        import mongomock

        return mongomock.MongoClient().test_db

    def _store(
        self, db, work_id: str, image_path: Path, embedding: np.ndarray | None
    ) -> None:
        signature = compute_color_signature(str(image_path))
        db.image_records.insert_one({
            "work_id": work_id,
            "district": "Nagpur",
            "mp_name": "Other MP",
            "file_path": f"https://res.cloudinary.com/fake/{work_id}.jpg",
            "sha256": "a" * 64,
            "phash": "0" * 16,
            "dhash": None,
            "embedding": embedding.tobytes() if embedding is not None else None,
            "orb_features": serialize_features(extract_orb_features(str(image_path))),
            "color_signature": signature.tobytes() if signature is not None else None,
        })

    def _search(self, candidate: Path, db, embedding: np.ndarray | None):
        from app.duplicate_search import search_all_layers

        return search_all_layers(
            sha256="b" * 64,          # no exact match
            phash="f" * 16,           # far from stored phash — no hash match
            dhash=None,
            embedding=embedding,
            work_id="WORK-CANDIDATE",
            district="Pune",
            mp_name="Candidate MP",
            session=db,
            orb_features=extract_orb_features(str(candidate)),
            color_signature=compute_color_signature(str(candidate)),
        )

    def test_cropped_resubmission_is_caught_and_supersedes_semantic(self, db, tmp_path: Path) -> None:
        source = _real_photos()[0]
        img = Image.open(source).convert("RGB")
        w, h = img.size
        mx, my = int(w * 0.20), int(h * 0.20)
        cropped = tmp_path / "cropped.jpg"
        img.crop((mx, my, w - mx, h - my)).save(cropped, "JPEG", quality=90)

        # Same unit embedding on both sides: cosine 1.0 puts the stored
        # record top of retrieval AND in semantic_matches, exercising the
        # supersede path (one record must not be reported by two layers).
        emb = np.ones(512, dtype=np.float32)
        emb /= np.linalg.norm(emb)
        self._store(db, "WORK-ORIGINAL", source, emb)

        report = self._search(cropped, db, emb)

        assert len(report.geometric_matches) == 1
        match = report.geometric_matches[0]
        assert match.matched_record.work_id == "WORK-ORIGINAL"
        assert match.similarity_metric == "orb"
        assert match.raw_score >= settings.ORB_INLIER_THRESHOLD
        assert match.cross_work
        assert report.semantic_matches == [], (
            "Record verified geometrically must be removed from semantic_matches — "
            "keeping both would double-score one re-used photo."
        )
        assert report.has_cross_work_match

    def test_different_photo_is_not_flagged(self, db, tmp_path: Path) -> None:
        photos = _real_photos(2)
        emb = np.ones(512, dtype=np.float32)
        emb /= np.linalg.norm(emb)
        self._store(db, "WORK-OTHER", photos[0], emb)

        # Retrieval WILL nominate it (cosine 1.0) — verification must
        # reject it. Suppress the semantic side so this test isolates
        # the geometric verdict.
        with patch.object(settings, "EMBEDDING_SUSPICIOUS_THRESHOLD", 1.1):
            report = self._search(photos[1], db, emb)
        assert report.geometric_matches == []

    def test_layer_silent_when_flag_off(self, db, tmp_path: Path) -> None:
        source = _real_photos()[0]
        emb = np.ones(512, dtype=np.float32)
        emb /= np.linalg.norm(emb)
        self._store(db, "WORK-ORIGINAL", source, emb)

        with patch.object(settings, "ENABLE_KEYPOINT_MATCH", False):
            report = self._search(source, db, emb)
        assert report.geometric_matches == []

    def test_crop_is_caught_with_clip_disabled(self, db, tmp_path: Path) -> None:
        """The point of the colour-signature retrieval index.

        Layer 6 originally retrieved by CLIP cosine only, so with
        ENABLE_CLIP=False the crop and rotation coverage silently
        vanished. Nothing here supplies an embedding — retrieval must
        run off the colour signature alone and still verify the crop.
        """
        source = _real_photos()[0]
        img = Image.open(source).convert("RGB")
        w, h = img.size
        mx, my = int(w * 0.20), int(h * 0.20)
        cropped = tmp_path / "cropped.jpg"
        img.crop((mx, my, w - mx, h - my)).save(cropped, "JPEG", quality=90)

        self._store(db, "WORK-ORIGINAL", source, embedding=None)
        report = self._search(cropped, db, embedding=None)

        assert len(report.geometric_matches) == 1
        assert report.geometric_matches[0].matched_record.work_id == "WORK-ORIGINAL"
        assert report.geometric_matches[0].raw_score >= settings.ORB_INLIER_THRESHOLD

    def test_rotation_is_caught_with_clip_disabled(self, db, tmp_path: Path) -> None:
        """Rotation-robust pHash covers ±5° and measures 0/20 at 15°+;
        this is the CLIP-free path covering it."""
        source = _real_photos()[0]
        rotated = tmp_path / "rotated.jpg"
        Image.open(source).convert("RGB").rotate(90, expand=True).save(rotated, "JPEG", quality=90)

        self._store(db, "WORK-ORIGINAL", source, embedding=None)
        report = self._search(rotated, db, embedding=None)

        assert len(report.geometric_matches) == 1
        assert report.geometric_matches[0].matched_record.work_id == "WORK-ORIGINAL"

    def test_different_photo_not_flagged_with_clip_disabled(self, db) -> None:
        """Colour-histogram retrieval is deliberately imprecise — it WILL
        nominate unrelated photos. RANSAC verification is what must
        reject them."""
        photos = _real_photos(2)
        self._store(db, "WORK-OTHER", photos[0], embedding=None)
        report = self._search(photos[1], db, embedding=None)
        assert report.geometric_matches == []

    def test_layer_silent_without_any_retrieval_signature(self, db) -> None:
        """With neither signature there is no cheap way to nominate
        candidates; the layer must return nothing rather than fall back
        to an O(n) descriptor scan over the whole corpus."""
        from app.duplicate_search import search_all_layers

        source = _real_photos()[0]
        self._store(db, "WORK-ORIGINAL", source, embedding=None)

        report = search_all_layers(
            sha256="b" * 64, phash="f" * 16, dhash=None,
            embedding=None,
            work_id="WORK-CANDIDATE", district="Pune", mp_name=None,
            session=db,
            orb_features=extract_orb_features(str(source)),
            color_signature=None,
        )
        assert report.geometric_matches == []

    def test_record_without_stored_signature_is_skipped_not_crashed(self, db) -> None:
        """Records written before this field existed have no colour
        signature. They must be skipped by retrieval, not raise."""
        source = _real_photos()[0]
        self._store(db, "WORK-ORIGINAL", source, embedding=None)
        db.image_records.update_one({"work_id": "WORK-ORIGINAL"}, {"$set": {"color_signature": None}})

        report = self._search(source, db, embedding=None)
        assert report.geometric_matches == []  # invisible to retrieval, but no crash

    def test_mismatched_signature_length_is_skipped(self, db) -> None:
        """A stored signature written under different COLOR_SIGNATURE_*
        bin settings has the wrong length — degrade retrieval, don't
        break the assessment."""
        source = _real_photos()[0]
        self._store(db, "WORK-ORIGINAL", source, embedding=None)
        db.image_records.update_one(
            {"work_id": "WORK-ORIGINAL"},
            {"$set": {"color_signature": np.ones(64, dtype=np.float32).tobytes()}},
        )
        report = self._search(source, db, embedding=None)
        assert report.geometric_matches == []


# ── Screenshot-detection gate ────────────────────────────────────────

class TestScreenshotGate:
    def test_disabled_by_default(self) -> None:
        assert settings.ENABLE_SCREENSHOT_DETECTION is False, (
            "ENABLE_SCREENSHOT_DETECTION must stay False: measured 29/29 false "
            "positives on real camera photographs (see config.py) — enabling it "
            "adds 25 points to every genuine upload."
        )

    def test_real_photo_is_not_flagged_as_screenshot(self, tmp_path: Path) -> None:
        """End-to-end through assess_image: a real camera photo — which
        compute_ela DOES mark is_screenshot=True, that's the measured
        bug — must not receive the SCREENSHOT_DETECTED flag."""
        import mongomock

        from app.ela_analysis import compute_ela
        from app.risk_engine import assess_image

        photo = _real_photos()[0]
        assert compute_ela(str(photo)).is_screenshot, (
            "Precondition changed: compute_ela no longer marks this real photo "
            "as a screenshot — if the heuristic was fixed, re-measure and "
            "reconsider the gate."
        )

        db = mongomock.MongoClient().test_db
        with patch.object(settings, "ENABLE_CLIP", False), \
             patch.object(settings, "ENABLE_KEYPOINT_MATCH", False):
            assessment = assess_image(
                image_path=str(photo), work_id="W-SS", work_type=None,
                district="Pune", state=None, mp_name=None,
                sanction_date=None, session=db,
            )
        assert "SCREENSHOT_DETECTED" not in [f.code for f in assessment.flags]


# ── Adaptive top-K scaling ───────────────────────────────────────────

class TestAdaptiveTopK:
    """Pin the _effective_top_k scaling heuristic."""

    def test_small_corpus_uses_configured_floor(self) -> None:
        from app.duplicate_search import _effective_top_k
        assert _effective_top_k(29, configured_k=20) == 20
        assert _effective_top_k(100, configured_k=20) == 20
        assert _effective_top_k(400, configured_k=20) == 20

    def test_large_corpus_scales_with_sqrt(self) -> None:
        from app.duplicate_search import _effective_top_k
        # sqrt(1000) = 31.6 -> 32
        assert _effective_top_k(1000, configured_k=20) == 32
        # sqrt(10000) = 100
        assert _effective_top_k(10000, configured_k=20) == 100

    def test_cap_is_respected(self) -> None:
        from app.duplicate_search import _effective_top_k
        # sqrt(1_000_000) = 1000, but cap is 500
        assert _effective_top_k(1_000_000, configured_k=20) == settings.ORB_RETRIEVAL_MAX_K

    def test_explicit_top_k_overrides_when_larger(self) -> None:
        from app.duplicate_search import _effective_top_k
        # If caller passed top_k=50, that's the floor
        assert _effective_top_k(100, configured_k=50) == 50
        # But sqrt still wins when larger
        assert _effective_top_k(10000, configured_k=50) == 100
