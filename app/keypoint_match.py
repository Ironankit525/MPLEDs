"""
Layer 6: SIFT keypoint extraction and RANSAC geometric verification.

Closes the crop/rotation gap the hash layers measurably cannot cover
(see README "Known limitations", measured 2026-08-29 on real photos):
crops beyond ~10% per edge push both pHash and dHash far past their
thresholds, and rotation beyond ~7° defeats rotation-robust pHash.

Originally used ORB (binary descriptors), but heavy crops (~35%+ per
dimension, removing >58% of the frame) left too few usable ORB matches.
Switched to SIFT: its 128-float descriptors are far more discriminative,
so matches survive even when most of the frame is gone.

Measured 2026-08-29 on real photos (n=20, 190 different-image pairs):
  ORB:   40% per-dim crop → 19/20,  45% → 17/20,  60% → 16/20
  SIFT:  40% per-dim crop → 20/20,  45% → 20/20,  60% → 20/20
  SIFT false positives: 0/190 at inliers ≥ 15 + ratio ≥ 0.60
    (two FP pairs at ratio 0.574 and 0.559 cleanly rejected)

Trade-off: SIFT features are ~13x larger per record (~762 KB vs ~59 KB)
because descriptors are float32×128 instead of uint8×32. Still well
under Mongo's 16 MB document limit. Extraction is actually slightly
faster (~23 ms vs ~50 ms).

This layer is a VERIFIER, not a scanner. Extraction costs ~23 ms/image
and matching ~2.3 ms/pair, which is fine for a handful of candidates but
not for an O(n) sweep of the corpus. app/duplicate_search.py therefore
runs it retrieve-then-verify: the colour signature and/or CLIP cosine
nominates the top-K nearest stored images and only those are verified.

Uses OpenCV, already a transitive dependency via easyocr (pinned in
requirements.lock) — no new requirement.
"""

import logging
import struct
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)

# ── Serialization constants ──────────────────────────────────────────
# Magic bytes guard against mistaking another binary field (e.g. CLIP
# embedding) for a feature pack; version allows layout changes.
_MAGIC_SIFT = b"SFT1"
_MAGIC_ORB = b"ORB1"  # kept for backward-compatible deserialization
_SIFT_DESCRIPTOR_FLOATS = 128  # SIFT descriptors are 128-float vectors
_SIFT_DESCRIPTOR_BYTES = _SIFT_DESCRIPTOR_FLOATS * 4  # float32
_ORB_DESCRIPTOR_BYTES = 32  # ORB descriptors were 256-bit binary


@dataclass
class ORBFeatures:
    """Keypoint coordinates + descriptors for one image.

    Despite the name (kept for API compatibility), this now holds SIFT
    descriptors by default.  The `descriptor_type` field distinguishes:
      - "sift": float32, shape (n, 128)
      - "orb":  uint8,   shape (n, 32)

    Coordinates are kept in the DOWNSCALED frame (longest side =
    ORB_MAX_DIMENSION) — both sides of every comparison are extracted
    the same way, so no rescaling back to original resolution is needed,
    and the homography fit is scale-consistent by construction.
    """

    points: np.ndarray       # float32, shape (n, 2)
    descriptors: np.ndarray  # sift: float32 (n, 128) | orb: uint8 (n, 32)
    descriptor_type: str = "sift"  # "sift" or "orb"

    def __len__(self) -> int:
        return len(self.points)


def extract_orb_features(image_path: str) -> Optional[ORBFeatures]:
    """Extract SIFT keypoints/descriptors from an image file.

    Name kept as extract_orb_features for API compatibility — all
    callers import this name.  Internally uses SIFT since 2026-08-29.

    Downscales so the longest side is ORB_MAX_DIMENSION before
    extraction — keypoint detection cost scales with pixel count, and
    1000px preserves plenty of structure for verification (calibration
    numbers in config.py were measured at exactly this setting).

    Returns None (never raises) when the file can't be read or yields
    no descriptors (e.g. a flat, textureless image) — callers treat
    that as "layer unavailable for this image", mirroring how the CLIP
    engine degrades.
    """
    img = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        logger.warning("SIFT: cannot read image %s", image_path)
        return None

    h, w = img.shape
    scale = settings.ORB_MAX_DIMENSION / max(h, w)
    if scale < 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    sift = cv2.SIFT_create(nfeatures=settings.ORB_MAX_FEATURES)
    keypoints, descriptors = sift.detectAndCompute(img, None)
    if descriptors is None or len(keypoints) < 4:
        logger.info("SIFT: too few features in %s (%d)", image_path, len(keypoints or []))
        return None

    points = np.array([kp.pt for kp in keypoints], dtype=np.float32)
    return ORBFeatures(
        points=points,
        descriptors=descriptors.astype(np.float32),
        descriptor_type="sift",
    )


def serialize_features(features: ORBFeatures) -> bytes:
    """Pack features into a compact binary blob for Mongo storage.

    SIFT layout: magic(4) | count(uint32 LE) | points(float32 n*2) |
    descriptors(float32 n*128). ~520 bytes/feature -> ~762 KB at 1500
    features, well under Mongo's 16 MB document limit but ~13x the old
    ORB encoding (~59 KB).
    """
    n = len(features)
    if features.descriptor_type == "sift":
        return (
            _MAGIC_SIFT
            + struct.pack("<I", n)
            + features.points.astype(np.float32).tobytes()
            + features.descriptors.astype(np.float32).tobytes()
        )
    else:
        # Legacy ORB path — kept for tests that may serialize ORB data
        return (
            _MAGIC_ORB
            + struct.pack("<I", n)
            + features.points.astype(np.float32).tobytes()
            + features.descriptors.astype(np.uint8).tobytes()
        )


def deserialize_features(blob: bytes) -> Optional[ORBFeatures]:
    """Inverse of serialize_features. Handles both SIFT (SFT1) and
    legacy ORB (ORB1) blobs — records written before the SIFT switch
    are still matchable (ORB descriptors are promoted to a shim that
    uses BFMatcher+Hamming instead of FLANN).

    Returns None on any malformed input rather than raising — a corrupt
    stored blob should skip that one candidate, not fail the whole
    assessment.
    """
    try:
        if not blob or len(blob) < 8:
            return None
        magic = blob[:4]
        if magic == _MAGIC_SIFT:
            (n,) = struct.unpack_from("<I", blob, 4)
            offset = 8
            points_bytes = n * 2 * 4
            descriptor_bytes = n * _SIFT_DESCRIPTOR_BYTES
            if len(blob) != offset + points_bytes + descriptor_bytes:
                return None
            points = np.frombuffer(blob, dtype=np.float32, count=n * 2, offset=offset).reshape(n, 2)
            descriptors = np.frombuffer(
                blob, dtype=np.float32, count=n * _SIFT_DESCRIPTOR_FLOATS,
                offset=offset + points_bytes,
            ).reshape(n, _SIFT_DESCRIPTOR_FLOATS)

            return ORBFeatures(points=points.copy(), descriptors=descriptors.copy(), descriptor_type="sift")
        elif magic == _MAGIC_ORB:
            (n,) = struct.unpack_from("<I", blob, 4)
            offset = 8
            points_bytes = n * 2 * 4
            descriptor_bytes = n * _ORB_DESCRIPTOR_BYTES
            if len(blob) != offset + points_bytes + descriptor_bytes:
                return None
            points = np.frombuffer(blob, dtype=np.float32, count=n * 2, offset=offset).reshape(n, 2)
            descriptors = np.frombuffer(
                blob, dtype=np.uint8, count=n * _ORB_DESCRIPTOR_BYTES,
                offset=offset + points_bytes,
            ).reshape(n, _ORB_DESCRIPTOR_BYTES)
            return ORBFeatures(points=points.copy(), descriptors=descriptors.copy(), descriptor_type="orb")
        else:
            return None
    except (struct.error, ValueError) as e:
        logger.warning("Feature blob: malformed (%s)", e)
        return None


def compute_color_signature(image_path: str) -> Optional[np.ndarray]:
    """Coarse HSV colour histogram — the CLIP-free retrieval index.

    Layer 6 originally nominated candidates by CLIP cosine only, which
    made the crop/rotation fixes silently unavailable whenever
    ENABLE_CLIP was False. This signature removes that dependency: it is
    cheap, needs no model, and survives exactly the transformations the
    layer exists to catch, because cropping or rotating a photo barely
    changes its colour distribution.

    Retrieval does NOT need to be precise — RANSAC verification supplies
    the precision (0/190 false positives). It only needs the true source
    inside the top-K. Measured 2026-08-29 on the real corpus (n=29),
    recall of the true source:

        transform      @1      @5      @10
        crop 15%    24/29   29/29   29/29
        crop 25%    21/29   28/29   29/29
        crop 40%    16/29   25/29   29/29
        rotate 15°   5/29   29/29   29/29
        rotate 90°  29/29   29/29   29/29

    A training-free bag-of-visual-words over the ORB descriptors was
    measured against this and rejected: it ranks slightly better on mild
    crops but collapses on heavy ones (3/29 @1 and 9/29 @5 at a 40%
    crop), because losing 40% of the frame loses 40% of the descriptors.
    The colour histogram degrades far more gracefully.

    Recall@K at scale: n=29 makes top-10 a fairly easy target (~34% of
    the corpus). On a corpus of thousands, the same K would cover <1%.
    Addressed via adaptive top-K scaling in _effective_top_k(): K grows
    as ceil(sqrt(n)), capped at ORB_RETRIEVAL_MAX_K (default 500). At
    n=10,000 K=100 (~230ms verification), at n=100,000 K=317 (~730ms).
    This heuristic is conservative but not proven — true recall@K on a
    corpus of thousands remains unmeasured (would need >1,000 real MPLADS
    photos to test). ORB_RETRIEVAL_MAX_K can be raised if detection
    rates drop, at ~2.3ms per extra candidate.

    Returns an L2-normalised float32 vector (128 bins = 512 bytes), or
    None if the image cannot be read.
    """
    img = cv2.imread(str(image_path))
    if img is None:
        logger.warning("Colour signature: cannot read image %s", image_path)
        return None

    h, w = img.shape[:2]
    scale = settings.COLOR_SIGNATURE_MAX_DIMENSION / max(h, w)
    if scale < 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    bins = [settings.COLOR_SIGNATURE_H_BINS, settings.COLOR_SIGNATURE_S_BINS, settings.COLOR_SIGNATURE_V_BINS]
    hist = cv2.calcHist([hsv], [0, 1, 2], None, bins, [0, 180, 0, 256, 0, 256]).flatten()

    norm = np.linalg.norm(hist)
    if norm == 0:
        return None
    return (hist / norm).astype(np.float32)


@dataclass
class GeometricMatchResult:
    """Outcome of verifying one image pair, with the evidence behind it.

    Carries the rejection reason so a near-miss is diagnosable from the
    logs (and from the flag's evidence dict) rather than collapsing to
    an unexplained "no match".
    """

    inliers: int = 0
    good_matches: int = 0
    inlier_ratio: float = 0.0
    min_features: int = 0
    is_match: bool = False
    reject_reason: Optional[str] = None


def verify_geometric_match(a: ORBFeatures, b: ORBFeatures) -> GeometricMatchResult:
    """Decide whether two images show the same physical scene.

    Lowe's ratio test discards ambiguous descriptor matches, then RANSAC
    fits a homography and counts inliers. The homography requirement is
    the load-bearing part: two different construction sites can share
    dozens of *individually* similar descriptors (brick edges, poles,
    railings), but those rarely agree on one geometric transform —
    measured maximum of 35 inliers (at ratio 0.574) across 190 different
    real-photo SIFT pairs, cleanly rejected by the ratio gate at 0.60.

    Supports both SIFT (float, FLANN) and legacy ORB (binary, BFMatcher)
    descriptors transparently. When one side is SIFT and the other is
    ORB (mixed pair from migration), the match is skipped rather than
    crashing — the caller can re-extract.

    Three gates must all pass, each measured (see the config comments on
    ORB_MIN_FEATURES_FOR_MATCH):

      1. Both images carry enough keypoints to verify anything at all.
         Too few and RANSAC will happily fit a homography to a handful
         of coincidental correspondences.
      2. Enough inliers in absolute terms.
      3. Enough inliers *as a fraction of the matches considered*. A
         genuine crop agrees on nearly every match it offers (SIFT
         median 0.94); a coincidental fit agrees on a minority (max
         0.574 on SIFT).
    """
    result = GeometricMatchResult()
    if a is None or b is None or len(a) < 4 or len(b) < 4:
        result.reject_reason = "insufficient_keypoints"
        return result

    result.min_features = min(len(a), len(b))
    if result.min_features < settings.ORB_MIN_FEATURES_FOR_MATCH:
        # Deliberately abstain rather than guess: this layer cannot
        # verify a low-texture image, and the other layers still run.
        result.reject_reason = "too_few_features"
        return result

    # Mixed descriptor types (one SIFT, one ORB from pre-migration
    # records) cannot be matched — skip cleanly.
    if a.descriptor_type != b.descriptor_type:
        result.reject_reason = "descriptor_type_mismatch"
        return result

    if a.descriptor_type == "sift":
        # FLANN for SIFT float descriptors — much faster than brute force
        FLANN_INDEX_KDTREE = 1
        index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
        search_params = dict(checks=50)
        matcher = cv2.FlannBasedMatcher(index_params, search_params)
    else:
        # Legacy ORB binary descriptors
        matcher = cv2.BFMatcher(cv2.NORM_HAMMING)

    raw = matcher.knnMatch(a.descriptors, b.descriptors, k=2)
    good = [
        m for pair in raw if len(pair) == 2
        for m, n in [pair] if m.distance < settings.ORB_RATIO_TEST * n.distance
    ]
    result.good_matches = len(good)
    if len(good) < 4:  # findHomography needs >= 4 correspondences
        result.reject_reason = "too_few_descriptor_matches"
        return result

    src = np.float32([a.points[m.queryIdx] for m in good]).reshape(-1, 1, 2)
    dst = np.float32([b.points[m.trainIdx] for m in good]).reshape(-1, 1, 2)
    _, mask = cv2.findHomography(src, dst, cv2.RANSAC, settings.ORB_RANSAC_REPROJ_THRESHOLD)
    if mask is None:
        result.reject_reason = "no_homography"
        return result

    result.inliers = int(mask.sum())
    result.inlier_ratio = result.inliers / len(good)

    if result.inliers < settings.ORB_INLIER_THRESHOLD:
        result.reject_reason = "too_few_inliers"
    elif result.inlier_ratio < settings.ORB_MIN_INLIER_RATIO:
        result.reject_reason = "inlier_ratio_too_low"
    else:
        result.is_match = True
    return result


def count_geometric_inliers(a: ORBFeatures, b: ORBFeatures) -> int:
    """Verified inlier count: the inliers when every gate in
    verify_geometric_match passes, else 0.

    Convenience wrapper for callers that only need the score. Returning
    0 for a rejected pair (rather than its raw inlier count) keeps
    "inliers >= threshold" a correct match test at every call site.
    """
    result = verify_geometric_match(a, b)
    return result.inliers if result.is_match else 0
