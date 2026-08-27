"""
Tests for Task 2.3's tiled perceptual hash (ENABLE_TILED_HASH, default False).

Diagnosis from scripts/evaluate_detection.py classified cropped_duplicate
as an ALGORITHM LIMITATION: a 12%-off-every-edge crop pushes the
whole-image pHash Hamming distance to 34 (vs. PHASH_DUPLICATE_THRESHOLD=5),
even with rotation-robust hashing.

IMPORTANT — measured finding, not a working fix: 3x3 overlapping-tile
voting was implemented as the narrowest additional check, but empirically
it does NOT catch this crop either. Tried: overlap 15/30/50/70%,
position-aligned AND all-pairs (any-candidate-tile-vs-any-stored-tile)
matching, and square (aspect-consistent) tiles centered in-frame — every
configuration still measures per-tile Hamming distances of 20-40 out of
64 bits, nowhere near PHASH_DUPLICATE_THRESHOLD=5. Root cause: pHash's
robustness on a WHOLE image comes from redundant low-frequency structure
across the full frame; a small tile has much less of that redundancy, so
it's far MORE sensitive to the exact registration shift a crop introduces
than the whole-image hash is. This is not a threshold-tuning problem —
loosening the tile threshold enough to catch this would almost certainly
match unrelated tiles too (exactly the false-positive risk the task
warned about), so no attempt was made to force it by raising thresholds.

CLIP (already implemented, Layer 3) DOES catch this specific case: cosine
similarity of clean_0000.jpg vs fraud_003_cropped.jpg measures 0.923,
just above EMBEDDING_DUPLICATE_THRESHOLD (0.92) — see
scripts/evaluate_detection.py --clip, where cropped_duplicate passes via
SEMANTIC_DUPLICATE. So for THIS corpus, semantic (CLIP) matching, not
tiled pHash, is the empirically-supported mitigation for heavy crops.

These tests therefore verify (a) the crop genuinely defeats whole-image
pHash (reproducing the diagnosed failure) and (b) the tiled-hash VOTING
MECHANISM itself is correct given inputs that should match — not that it
currently solves cropped_duplicate, which it measurably does not.
"""

import json
from pathlib import Path
from unittest.mock import patch

import pytest
from pymongo.database import Database

from app.config import settings
from app.hashing import compute_phash, compute_tiled_phashes, hamming_distance
from app.duplicate_search import find_tiled_duplicates
from app.models import ImageRecord

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CLEAN_SOURCE = PROJECT_ROOT / "data" / "images" / "clean_0000.jpg"
FRAUD_CROPPED = PROJECT_ROOT / "data" / "fraud_cases" / "fraud_003_cropped.jpg"


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


class TestTiledHashHonestFindings:
    @pytest.mark.skipif(not CLEAN_SOURCE.exists() or not FRAUD_CROPPED.exists(), reason="fraud test corpus not present")
    def test_whole_image_phash_misses_the_crop(self) -> None:
        """Reproduces the diagnosed failure: whole-image pHash distance
        for the actual cropped_duplicate fraud case exceeds the threshold."""
        dist = hamming_distance(compute_phash(str(CLEAN_SOURCE)), compute_phash(str(FRAUD_CROPPED)))
        assert dist > settings.PHASH_DUPLICATE_THRESHOLD

    @pytest.mark.skipif(not CLEAN_SOURCE.exists() or not FRAUD_CROPPED.exists(), reason="fraud test corpus not present")
    def test_tiled_hash_does_not_currently_catch_this_crop(self) -> None:
        """Documents the measured (negative) result honestly, so a future
        change to the tiling algorithm has a concrete regression signal
        to beat, instead of silently assuming a fix that isn't there.

        If this assertion ever starts FAILING (i.e. tiles start matching),
        that means a future edit improved tile-hash crop robustness —
        update this test's expectation and the module docstring above,
        don't just delete the check.
        """
        t1 = compute_tiled_phashes(str(CLEAN_SOURCE))
        t2 = compute_tiled_phashes(str(FRAUD_CROPPED))
        matching = sum(
            1 for cand in t2
            if min(hamming_distance(cand, stored) for stored in t1) <= settings.PHASH_DUPLICATE_THRESHOLD
        )
        assert matching < settings.TILED_HASH_MIN_MATCHING_TILES, (
            f"Tiled hashing now catches {matching}/9 tiles for the crop case — if this is "
            f"intentional progress, update this test and the honest-findings docstring above."
        )


class TestTiledHashVotingMechanism:
    """Unit-tests find_tiled_duplicates()'s voting logic directly with
    controlled hash inputs, independent of whether any particular image
    transformation currently produces close-enough tiles in practice."""

    def test_matches_when_enough_tiles_are_close(self, db_session: Database) -> None:
        stored_tiles = [format(i, "016x") for i in range(9)]  # 9 distinct fixed hashes
        record = ImageRecord(
            work_id="MP-PUN-2024-0001", district="Pune", file_path="fake.jpg",
            sha256="x" * 64, phash="0" * 16,
            tile_phashes=json.dumps(stored_tiles),
        )
        record_dict = record.model_dump(by_alias=True, exclude={"id"})
        res = db_session.image_records.insert_one(record_dict)
        record_dict["_id"] = str(res.inserted_id)
        record = ImageRecord(**record_dict)

        # Candidate: first 5 tiles identical to stored, last 4 wildly different.
        candidate_tiles = stored_tiles[:5] + ["f" * 16] * 4

        with patch.object(settings, "ENABLE_TILED_HASH", True):
            hits = find_tiled_duplicates(candidate_tiles, db_session)

        assert len(hits) == 1
        matched_record, matching_count = hits[0]
        assert matched_record.id == record.id
        assert matching_count == 5  # exactly the 5 identical tiles

    def test_no_match_when_too_few_tiles_are_close(self, db_session: Database) -> None:
        stored_tiles = [format(i, "016x") for i in range(9)]
        record = ImageRecord(
            work_id="MP-PUN-2024-0001", district="Pune", file_path="fake.jpg",
            sha256="x" * 64, phash="0" * 16,
            tile_phashes=json.dumps(stored_tiles),
        )
        record_dict = record.model_dump(by_alias=True, exclude={"id"})
        res = db_session.image_records.insert_one(record_dict)
        record_dict["_id"] = str(res.inserted_id)
        record = ImageRecord(**record_dict)

        # Only 2 tiles match (below TILED_HASH_MIN_MATCHING_TILES=4).
        candidate_tiles = stored_tiles[:2] + ["f" * 16] * 7

        with patch.object(settings, "ENABLE_TILED_HASH", True):
            hits = find_tiled_duplicates(candidate_tiles, db_session)

        assert hits == []

    def test_tiled_hash_disabled_by_default(self) -> None:
        assert settings.ENABLE_TILED_HASH is False, (
            "ENABLE_TILED_HASH must default to False — it's implemented but NOT proven to "
            "help (see TestTiledHashHonestFindings), so it must not be on by default."
        )
