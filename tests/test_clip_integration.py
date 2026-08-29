"""
Task 3.2: Real CLIP integration tests.

Marked @pytest.mark.requires_clip — excluded from the default/fast test
run (see pytest.ini). Skips with a clear, explicit reason (never a
vacuous pass) whenever the required model or real photographs aren't
available, rather than silently doing nothing useful.

Run with:
    pytest tests/test_clip_integration.py -v
    pytest -m requires_clip -v
"""

import shutil
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest

import app.embeddings as embeddings_module
from app.config import PROJECT_ROOT, settings
from scripts.seed_database import WORK_TYPES, _work_type_from_filename

pytestmark = pytest.mark.requires_clip

_IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp")


# ── Fixtures ─────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def clip_engine():
    """Force-load the real CLIP engine, or skip the whole module cleanly.

    Deliberately NOT a collection-time skipif — importing this file
    should never itself trigger a model load. The load only happens
    when a test that needs this fixture actually runs.
    """
    from app.embeddings import get_clip_engine

    patcher = patch.object(settings, "ENABLE_CLIP", True)
    patcher.start()
    embeddings_module._clip_engine_instance = None
    engine = get_clip_engine()
    engine._ensure_loaded()

    if not engine.is_available:
        patcher.stop()
        pytest.skip(
            "CLIP is not available (torch/transformers not installed, or the model "
            "failed to load). Run `python -m scripts.download_models` to diagnose."
        )

    yield engine

    embeddings_module._clip_engine_instance = None
    patcher.stop()


@pytest.fixture(scope="module")
def real_images() -> list[Path]:
    real_dir = PROJECT_ROOT / "data" / "real_images"
    if not real_dir.exists():
        pytest.skip(f"{real_dir} does not exist — add real photos to run this test (see its README.md).")
    found = sorted(p for p in real_dir.iterdir() if p.is_file() and p.suffix.lower() in _IMAGE_EXTS)
    if len(found) < 6:
        pytest.skip(f"Need at least 6 real photos in {real_dir}, found {len(found)}. See its README.md.")
    return found


@pytest.fixture(scope="module")
def real_pairs() -> list[Path]:
    pairs_dir = PROJECT_ROOT / "data" / "real_images" / "pairs"
    found = (
        sorted(p for p in pairs_dir.iterdir() if p.is_file() and p.suffix.lower() in _IMAGE_EXTS)
        if pairs_dir.exists() else []
    )
    if len(found) < 2:
        pytest.skip(
            "data/real_images/pairs/ needs 2+ photos of the SAME physical scene from "
            f"different angles — see data/real_images/README.md. Found {len(found)}."
        )
    return found


@pytest.fixture(scope="module")
def same_scene_pairs(real_pairs: list[Path]) -> list[tuple[Path, Path]]:
    """Photos of one physical scene, grouped by the `<scene>_<variant>`
    filename convention data/real_images/README.md specifies.

    This used to be `real_pairs[0]` vs `real_pairs[1]` — whichever two
    files happened to sort first. That passed only by luck: nothing
    guaranteed the first two entries were the same scene, so dropping in
    a photo whose name sorted earlier would have silently turned this
    into a comparison of two unrelated images that then "failed" for a
    reason having nothing to do with CLIP.

    `_wide` variants are excluded here on purpose — they are a large
    viewpoint change, which is a measurably harder case that no safe
    threshold catches (see test_large_viewpoint_change_is_a_known_gap).
    """
    scenes: dict[str, list[Path]] = {}
    for p in real_pairs:
        if "_wide" in p.stem:
            continue
        scenes.setdefault(p.stem.split("_")[0], []).append(p)

    pairs = [(v[0], v[1]) for v in scenes.values() if len(v) >= 2]
    if not pairs:
        pytest.skip(
            "No same-scene group found in data/real_images/pairs/. Name files "
            "<scene>_<variant>.jpg (e.g. scene1_a.jpg, scene1_b.jpg) — see "
            "data/real_images/README.md."
        )
    return pairs


@pytest.fixture
def sample_image() -> Path:
    """Any valid image works here — this fixture is used only for structural
    checks (embedding shape/norm, identical-file similarity, serialization),
    not semantic content, so the bundled synthetic image is fine."""
    return PROJECT_ROOT / "data" / "images" / "clean_0000.jpg"


# ── Tests ────────────────────────────────────────────────────────────

class TestClipIntegration:
    def test_embedding_shape_and_norm(self, clip_engine, sample_image: Path) -> None:
        embedding = clip_engine.embed_image(str(sample_image))
        assert embedding is not None
        assert embedding.shape == (512,)
        assert embedding.dtype == np.float32
        norm = float(np.linalg.norm(embedding))
        assert abs(norm - 1.0) < 1e-3, f"L2 norm {norm} is not ~1.0"

    def test_identical_image_similarity(self, clip_engine, sample_image: Path, tmp_path: Path) -> None:
        copy_path = tmp_path / "identical_copy.jpg"
        shutil.copy2(sample_image, copy_path)

        emb_a = clip_engine.embed_image(str(sample_image))
        emb_b = clip_engine.embed_image(str(copy_path))
        cosine = float(np.dot(emb_a, emb_b))
        assert cosine > 0.999, f"Identical-image cosine similarity {cosine} is not ~1.0"

    def test_same_scene_different_angle(
        self, clip_engine, same_scene_pairs: list[tuple[Path, Path]]
    ) -> None:
        """Every same-scene pair must clear EMBEDDING_DUPLICATE_THRESHOLD.

        Checks all scene groups rather than one arbitrary pair — this is
        the single behaviour Layer 3 exists for (catching a re-submitted
        site that the hash layers cannot see), so one lucky pair passing
        is not evidence the threshold is right.
        """
        failures = []
        for a, b in same_scene_pairs:
            cosine = float(np.dot(clip_engine.embed_image(str(a)), clip_engine.embed_image(str(b))))
            if cosine <= settings.EMBEDDING_DUPLICATE_THRESHOLD:
                failures.append(f"{a.name} <-> {b.name}: {cosine:.4f}")

        assert not failures, (
            f"{len(failures)}/{len(same_scene_pairs)} same-scene pairs did not exceed "
            f"EMBEDDING_DUPLICATE_THRESHOLD={settings.EMBEDDING_DUPLICATE_THRESHOLD}: "
            + "; ".join(failures)
        )

    def test_large_viewpoint_change_is_a_known_gap(
        self, clip_engine, real_pairs: list[Path]
    ) -> None:
        """A `_wide` variant is the same place shot with the camera
        panned substantially. Measured 2026-08-29: scene1_a vs
        scene1_c_wide scores 0.8355 — BELOW the highest genuinely
        different-image pair in the corpus (0.8624, a bridge vs a road).

        The distributions overlap there, so no threshold separates them:
        catching this pair means accepting false positives on unrelated
        sites. Asserted as a documented gap rather than quietly omitted,
        so a future embedding model or threshold change that DOES close
        it has a concrete signal to beat — if this starts failing, the
        gap has closed; update the expectation and app/config.py's
        EMBEDDING_DUPLICATE_THRESHOLD note rather than deleting the test.
        """
        wide = [p for p in real_pairs if "_wide" in p.stem]
        if not wide:
            pytest.skip("No `_wide` variant in data/real_images/pairs/ to measure the gap against.")

        gap_confirmed = []
        for w in wide:
            scene = w.stem.split("_")[0]
            base = next((p for p in real_pairs if p.stem == f"{scene}_a"), None)
            if base is None:
                continue
            cosine = float(np.dot(clip_engine.embed_image(str(base)), clip_engine.embed_image(str(w))))
            gap_confirmed.append((f"{base.name} <-> {w.name}", cosine))

        if not gap_confirmed:
            pytest.skip("No `<scene>_a` counterpart found for any `_wide` variant.")

        still_missed = [f"{name}: {c:.4f}" for name, c in gap_confirmed if c <= settings.EMBEDDING_DUPLICATE_THRESHOLD]
        assert still_missed, (
            "Large-viewpoint pairs now clear EMBEDDING_DUPLICATE_THRESHOLD "
            f"({settings.EMBEDDING_DUPLICATE_THRESHOLD}): "
            f"{[(n, round(c, 4)) for n, c in gap_confirmed]}. The documented gap has closed — "
            "update this test and the README's Known limitations section."
        )

    def test_unrelated_images_below_suspicious_threshold(self, clip_engine, real_images: list[Path]) -> None:
        # Two arbitrary "infrastructure" photos can legitimately score
        # moderately high on CLIP similarity even when unrelated — pick
        # images with maximally different assigned work_type (per
        # scripts/seed_database.py's index-cycling scheme) to reduce
        # test flakiness, rather than picking real_images[0]/[-1] blindly.
        idx_b = min(5, len(real_images) - 1)
        emb_a = clip_engine.embed_image(str(real_images[0]))
        emb_b = clip_engine.embed_image(str(real_images[idx_b]))
        cosine = float(np.dot(emb_a, emb_b))
        assert cosine < settings.EMBEDDING_SUSPICIOUS_THRESHOLD, (
            f"Unrelated-image cosine similarity {cosine:.3f} was not below "
            f"EMBEDDING_SUSPICIOUS_THRESHOLD={settings.EMBEDDING_SUSPICIOUS_THRESHOLD}"
        )

    def _labeled_photos(self, real_images: list[Path]) -> list[tuple[Path, str]]:
        """Every real_images file whose name encodes its true work type
        (see scripts.seed_database._work_type_from_filename).

        These two tests used to assume real_images[0] depicted
        WORK_TYPES[0] ("road construction") — true of nothing in
        particular, just whichever file happened to sort first. That
        broke the moment the corpus was properly labeled by content
        (data/real_images/*_<NN>.ext) instead of index-cycled: the
        alphabetically-first file turned out to be a bridge, and CLIP
        correctly said so (0.51 confidence for "road construction").
        Checking a single picked file — even the correct one — is still
        fragile: some genuinely are harder cases (an interior classroom
        shot with no exterior building cues; a decorative potted-flower
        garden display rather than a park scene), and one hard photo
        shouldn't fail the whole suite. Checking the aggregate across
        every labeled photo is what the mechanism should actually be
        judged on.
        """
        labeled = [(p, wt) for p in real_images if (wt := _work_type_from_filename(p))]
        if not labeled:
            pytest.skip(
                "No file in data/real_images/ follows the <work_type>_<NN>.ext "
                "naming convention — see its README.md."
            )
        return labeled

    def test_correct_zero_shot_label(self, clip_engine, real_images: list[Path]) -> None:
        labeled = self._labeled_photos(real_images)
        failures = []
        for path, work_type in labeled:
            score = clip_engine.zero_shot_match(str(path), work_type)
            assert score is not None
            if score <= 0.60:
                failures.append(f"{path.name} as '{work_type}': {score:.3f}")

        pass_rate = 1 - len(failures) / len(labeled)
        # Measured 2026-08-27 on this corpus: 15/20 (75%) clear 0.60 — the
        # 70% bar leaves headroom for a genuinely hard photo or two
        # without being loose enough to hide a real regression.
        assert pass_rate >= 0.70, (
            f"Only {pass_rate:.0%} of {len(labeled)} labeled photos scored >0.60 "
            f"confidence for their own true work type. Failures: {failures}"
        )

    def test_incorrect_zero_shot_label(self, clip_engine, real_images: list[Path]) -> None:
        labeled = self._labeled_photos(real_images)
        path, correct_type = labeled[0]
        wrong_type = next(wt for wt in WORK_TYPES if wt != correct_type)
        score = clip_engine.zero_shot_match(str(path), wrong_type)
        assert score is not None
        assert score < 0.60, (
            f"Incorrect-label confidence {score:.3f} was not below 0.60 for "
            f"{path.name} as '{wrong_type}' (actually '{correct_type}')"
        )

    def test_embedding_serialization_roundtrip(self, clip_engine, sample_image: Path) -> None:
        embedding = clip_engine.embed_image(str(sample_image))
        blob = embedding.tobytes()
        restored = np.frombuffer(blob, dtype=np.float32)
        assert np.array_equal(embedding, restored)
