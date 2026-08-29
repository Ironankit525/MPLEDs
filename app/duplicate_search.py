"""
Multi-layer duplicate search engine for MPLADS images.

Searches the database for matches against a candidate image across three
independent detection layers:

  Layer 1 (SHA-256):    Exact byte-level matches — catches naïve re-uploads.
  Layer 2 (pHash/dHash): Perceptual matches — catches resized, cropped,
                         re-compressed, or watermarked copies.
  Layer 3 (CLIP):       Semantic matches — catches same scene from a
                         different angle, or significantly altered copies
                         that defeat perceptual hashing.

Each layer compensates for the weaknesses of the previous one, giving
progressively broader (but less certain) detection.

SCALING NOTE: The current approach is brute-force O(n) — every search
scans the entire database.  This is fine for ~10k images.  Beyond ~100k
images, replace with:
  - FAISS (Facebook AI Similarity Search) for embedding vectors
  - pgvector in PostgreSQL for SQL-native vector search
  - A dedicated hash index for perceptual hashes
"""

import json
import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from pymongo.database import Database

from app.config import settings
from app.hashing import hamming_distance
from app.models import ImageRecord

logger = logging.getLogger(__name__)


# ── Match dataclasses ────────────────────────────────────────────────

@dataclass
class Match:
    """A single duplicate match found during search.

    Attributes:
        matched_record:    The ImageRecord that matched.
        similarity_metric: Which layer found this match (sha256/phash/dhash/clip).
        raw_score:         The raw similarity value — Hamming distance for hashes
                           (lower = more similar), cosine similarity for embeddings
                           (higher = more similar).
        confidence:        Qualitative confidence level:
                           CERTAIN  — virtually no chance this is a coincidence
                           LIKELY   — strong evidence, but edge cases exist
                           POSSIBLE — worth investigating but not conclusive
        same_work:         True if matched image belongs to the same work_id
                           (probably benign — legitimate re-upload).
        cross_work:        True if matched image belongs to a different work_id
                           (suspicious — possible double-claiming).
        cross_district:    True if matched image belongs to a different district
                           (highly suspicious — cross-district fraud).
        cross_mp:          True if matched image belongs to a different MP
                           (highly suspicious — cross-MP fraud).
    """
    matched_record: ImageRecord
    similarity_metric: str
    raw_score: float
    confidence: str  # "CERTAIN", "LIKELY", "POSSIBLE"
    same_work: bool = False
    cross_work: bool = False
    cross_district: bool = False
    cross_mp: bool = False


@dataclass
class DuplicateReport:
    """Unified report from all duplicate detection layers.

    Aggregates results and exposes boolean flags for the most serious
    cross-boundary matches (cross-work, cross-district, cross-MP).
    """
    exact_matches: list[Match] = field(default_factory=list)
    perceptual_matches: list[Match] = field(default_factory=list)
    semantic_matches: list[Match] = field(default_factory=list)
    # Layer 6: ORB+RANSAC homography-verified matches. raw_score is the
    # inlier count. A record that is both semantically similar AND
    # geometrically verified appears HERE only (geometric evidence
    # supersedes the weaker cosine similarity for the same record).
    geometric_matches: list[Match] = field(default_factory=list)
    has_cross_work_match: bool = False
    has_cross_district_match: bool = False
    has_cross_mp_match: bool = False

    @property
    def all_matches(self) -> list[Match]:
        """All matches across all layers, for iteration."""
        return (
            self.exact_matches + self.perceptual_matches
            + self.semantic_matches + self.geometric_matches
        )

    @property
    def has_any_match(self) -> bool:
        """True if any layer found any match."""
        return bool(self.exact_matches or self.perceptual_matches or self.semantic_matches)


def _classify_match(
    matched_record: ImageRecord,
    candidate_work_id: str,
    candidate_district: str,
    candidate_mp_name: str | None,
    similarity_metric: str,
    raw_score: float,
    confidence: str,
) -> Match:
    """Create a Match with cross-boundary flags computed.

    Centralises the logic for determining whether a match crosses
    work, district, or MP boundaries — the key indicator of fraud
    severity.
    """
    same_work = (matched_record.work_id == candidate_work_id)
    cross_work = not same_work
    cross_district = (
        matched_record.district.lower().strip() != candidate_district.lower().strip()
        if matched_record.district and candidate_district else False
    )
    cross_mp = (
        candidate_mp_name is not None
        and matched_record.mp_name is not None
        and matched_record.mp_name.lower().strip() != candidate_mp_name.lower().strip()
    )

    return Match(
        matched_record=matched_record,
        similarity_metric=similarity_metric,
        raw_score=raw_score,
        confidence=confidence,
        same_work=same_work,
        cross_work=cross_work,
        cross_district=cross_district,
        cross_mp=cross_mp,
    )


# ── Layer 1: Exact hash matching ────────────────────────────────────

def find_exact_duplicates(
    sha256: str,
    session: Database,
) -> list[ImageRecord]:
    """Find images with an identical SHA-256 hash (exact byte-level copies).

    This is the fastest and most definitive check — if the SHA-256
    matches, the files are byte-for-byte identical.  But it's also
    the easiest to defeat: any modification (even re-saving) changes
    the hash.

    Args:
        sha256:  SHA-256 hex digest of the candidate image.
        session: Database session.

    Returns:
        List of matching ImageRecord objects (may be empty).
    """
    records = list(session.image_records.find({"sha256": sha256}))
    return [ImageRecord(**r) for r in records]


# ── Layer 2: Perceptual hash matching ───────────────────────────────

def find_perceptual_duplicates(
    phash: str,
    session: Database,
    threshold: int | None = None,
    rotation_variants: list[str] | None = None,
) -> list[tuple[ImageRecord, int]]:
    """Find images with similar perceptual hashes (resized, cropped, etc.).

    Brute-force Hamming comparison against all stored hashes.  Returns
    all images within the given threshold distance.

    NOTE: This is O(n) where n is the total number of stored images.
    Fine for up to ~100k images.  Beyond that, consider building a
    BK-tree or using a purpose-built similarity index.

    Args:
        phash:              Perceptual hash of the candidate image (hex string).
        session:             Database session.
        threshold:           Maximum Hamming distance to consider a match.
                             Defaults to PHASH_SUSPICIOUS_THRESHOLD from config
                             (the wider threshold, to catch both duplicates and
                             suspicious matches).
        rotation_variants:   Optional list of pHash hex strings for the
                             candidate image rotated at a few small angles
                             (see app.hashing.compute_phash_rotation_robust).
                             When given, the distance used for each stored
                             record is the MINIMUM Hamming distance across
                             `phash` and all variants — this only ever
                             lowers the effective distance versus the
                             single-hash comparison, never raises it.
                             Stored records still keep a single canonical
                             phash column; no schema change needed.

    Returns:
        List of (ImageRecord, hamming_distance) tuples, sorted by
        distance ascending (most similar first).
    """
    if threshold is None:
        threshold = settings.PHASH_SUSPICIOUS_THRESHOLD

    candidate_hashes = [phash] + list(rotation_variants) if rotation_variants else [phash]

    all_records = [ImageRecord(**r) for r in session.image_records.find({})]
    matches: list[tuple[ImageRecord, int]] = []

    for record in all_records:
        if not record.phash:
            continue
        try:
            dist = min(hamming_distance(h, record.phash) for h in candidate_hashes)
            if dist <= threshold:
                matches.append((record, dist))
        except ValueError:
            logger.warning(
                "Hash length mismatch comparing with record %s (phash='%s')",
                record.id, record.phash,
            )
            continue

    # Sort by distance (most similar first)
    matches.sort(key=lambda x: x[1])
    return matches


def find_dhash_duplicates(
    dhash: str,
    session: Database,
    threshold: int | None = None,
) -> list[tuple[ImageRecord, int]]:
    """Find images with a similar difference hash.

    dHash captures local brightness-gradient structure, so it complements
    pHash's global DCT signature. In particular, it can retain a useful
    signal after a crop changes pHash too much to match. This search is kept
    separate from pHash so the unified search can retain the stronger of the
    two hash findings for each stored record instead of double-counting it.

    Args:
        dhash:     Candidate difference hash as a 16-character hex string.
        session:   Database to search.
        threshold: Maximum Hamming distance to consider a match. Defaults to
                   DHASH_SUSPICIOUS_THRESHOLD.

    Returns:
        List of (ImageRecord, hamming_distance) tuples, sorted by distance
        ascending.
    """
    if threshold is None:
        threshold = settings.DHASH_SUSPICIOUS_THRESHOLD

    records_raw = list(session.image_records.find({"dhash": {"$ne": None}}))
    matches: list[tuple[ImageRecord, int]] = []
    for raw_record in records_raw:
        record = ImageRecord(**raw_record)
        if not record.dhash:
            continue
        try:
            dist = hamming_distance(dhash, record.dhash)
            if dist <= threshold:
                matches.append((record, dist))
        except ValueError:
            logger.warning(
                "Hash length mismatch comparing with record %s (dhash='%s')",
                record.id, record.dhash,
            )
            continue

    matches.sort(key=lambda x: x[1])
    return matches


# ── Tiled perceptual hash matching (Task 2.3, gated by ENABLE_TILED_HASH) ──

def find_tiled_duplicates(
    tile_hashes: list[str],
    session: Database,
    tile_threshold: int | None = None,
    min_matching_tiles: int | None = None,
) -> list[tuple[ImageRecord, int]]:
    """Find images via 3x3 overlapping-tile pHash voting.

    Two images are considered a match if at least `min_matching_tiles`
    of the position-aligned tile pairs (tile i vs tile i — a 3x3 grid is
    only spatially meaningful when compared aligned, not all-pairs) have
    a Hamming distance within `tile_threshold`. This is the narrow fix
    for heavy cropping: a crop removes visual content mostly at the
    edges, so a whole-image pHash sees a different frame, but the
    CENTER tiles are still close to their originals.

    Only searches stored records that have tile_phashes populated
    (i.e. were stored while ENABLE_TILED_HASH was True) — see
    app.main._store_image_record.

    Args:
        tile_hashes:        The candidate's tile pHashes (see
                            app.hashing.compute_tiled_phashes).
        session:             Database session.
        tile_threshold:      Per-tile Hamming distance threshold.
                            Defaults to PHASH_DUPLICATE_THRESHOLD.
        min_matching_tiles:  Minimum tiles that must match. Defaults to
                            settings.TILED_HASH_MIN_MATCHING_TILES (4).

    Returns:
        List of (ImageRecord, matching_tile_count) for records meeting
        the vote threshold, sorted by matching_tile_count descending.
    """
    if tile_threshold is None:
        tile_threshold = settings.PHASH_DUPLICATE_THRESHOLD
    if min_matching_tiles is None:
        min_matching_tiles = settings.TILED_HASH_MIN_MATCHING_TILES

    records_raw = list(session.image_records.find({"tile_phashes": {"$ne": None}}))
    records = [ImageRecord(**r) for r in records_raw]

    matches: list[tuple[ImageRecord, int]] = []
    for record in records:
        try:
            stored_tiles = json.loads(record.tile_phashes)
        except (TypeError, ValueError):
            logger.warning("Malformed tile_phashes for record %s — skipping.", record.id)
            continue
        if len(stored_tiles) != len(tile_hashes):
            continue  # grid size mismatch — can't compare position-aligned

        matching_count = sum(
            1 for cand, stored in zip(tile_hashes, stored_tiles)
            if hamming_distance(cand, stored) <= tile_threshold
        )
        if matching_count >= min_matching_tiles:
            matches.append((record, matching_count))

    matches.sort(key=lambda x: x[1], reverse=True)
    return matches


# ── Layer 3: Semantic embedding matching ────────────────────────────

def find_semantic_duplicates(
    embedding: np.ndarray,
    session: Database,
    threshold: float | None = None,
) -> list[tuple[ImageRecord, float]]:
    """Find images with semantically similar content using CLIP embeddings.

    Computes cosine similarity between the candidate embedding and ALL
    stored embeddings using vectorised numpy operations — stacks all
    stored embeddings into a single matrix and performs one dot product,
    not a Python loop.

    NOTE: This brute-force approach is O(n) and should be replaced with
    FAISS (faiss-cpu) or pgvector beyond ~100k images.  FAISS provides
    approximate nearest-neighbor search in sub-linear time with minimal
    accuracy loss.

    Args:
        embedding: L2-normalised 512-dim float32 vector for the candidate.
        session:   Database session.
        threshold: Minimum cosine similarity to consider a match.
                   Defaults to EMBEDDING_SUSPICIOUS_THRESHOLD from config.

    Returns:
        List of (ImageRecord, cosine_similarity) tuples, sorted by
        similarity descending (most similar first).
    """
    if threshold is None:
        threshold = settings.EMBEDDING_SUSPICIOUS_THRESHOLD

    # Fetch all records that have embeddings
    records_raw = list(session.image_records.find({"embedding": {"$ne": None}}))
    records_with_embeddings = [ImageRecord(**r) for r in records_raw]

    if not records_with_embeddings:
        return []

    # Deserialise each embedding individually so a single corrupted
    # record doesn't kill semantic search for every query.
    valid_records: list[ImageRecord] = []
    valid_embeddings: list[np.ndarray] = []
    for r in records_with_embeddings:
        try:
            vec = np.frombuffer(r.embedding, dtype=np.float32)
            if vec.shape[0] == 0:
                raise ValueError("empty embedding")
            valid_records.append(r)
            valid_embeddings.append(vec)
        except (ValueError, TypeError) as e:
            logger.warning(
                "Skipping record %s — corrupted embedding: %s", r.id, e
            )
            continue

    if not valid_records:
        return []

    # Stack all valid embeddings into a single matrix for vectorised dot product
    # Shape: (n, dim)
    try:
        embedding_matrix = np.stack(valid_embeddings)
    except ValueError as e:
        # Dimension mismatch across valid records (e.g. model changed mid-dataset)
        logger.warning("Embedding dimension mismatch across stored records: %s", e)
        return []

    # Cosine similarity = dot product of L2-normalised vectors
    # Shape: (n,)
    similarities = embedding_matrix @ embedding

    # Filter by threshold and pair with records
    matches: list[tuple[ImageRecord, float]] = []
    for record, sim in zip(valid_records, similarities):
        if sim >= threshold:
            matches.append((record, float(sim)))

    # Sort by similarity descending (most similar first)
    matches.sort(key=lambda x: x[1], reverse=True)
    return matches


# ── Layer 6: ORB geometric verification (retrieve-then-verify) ──────

def _top_k_by_signature(
    records: list[ImageRecord],
    query: np.ndarray,
    attribute: str,
    top_k: int,
) -> list[int]:
    """Indices of the top-K records by cosine similarity on a stored
    float32 signature blob (`embedding` or `color_signature`).

    Records missing that signature, or carrying one of the wrong length
    (e.g. written under different COLOR_SIGNATURE_* bin settings), are
    skipped rather than crashing the stack — a signature-shape change
    must degrade retrieval, not break assessment.
    """
    vectors: list[np.ndarray] = []
    indices: list[int] = []
    for i, record in enumerate(records):
        blob = getattr(record, attribute, None)
        if not blob:
            continue
        vector = np.frombuffer(blob, dtype=np.float32)
        if vector.shape != query.shape:
            continue
        vectors.append(vector)
        indices.append(i)

    if not vectors:
        return []

    similarities = np.stack(vectors) @ query
    order = np.argsort(similarities)[::-1][:top_k]
    return [indices[int(i)] for i in order]


def _effective_top_k(corpus_size: int, configured_k: int) -> int:
    """Scale top-K with corpus size so retrieval recall doesn't degrade.

    At n=29, configured_k=20 already covers two-thirds of the corpus.
    At n=10,000, the same K=20 covers only 0.2% — a coarse 128-bin
    colour histogram can't reliably rank the true source that high among
    thousands of images with similar palettes (think dozens of road
    construction photos that are all grey asphalt + brown dirt).

    Heuristic: K = max(configured_k, ceil(sqrt(n))), capped at
    ORB_RETRIEVAL_MAX_K.

    Examples:
        n=29     -> K=20   (configured floor)
        n=100    -> K=20   (configured floor)
        n=400    -> K=20   (sqrt(400)=20, same as floor)
        n=1,000  -> K=32   (sqrt, ~74ms verification)
        n=5,000  -> K=71   (~163ms)
        n=10,000 -> K=100  (~230ms)
        n=50,000 -> K=224  (~515ms)
        n=100,000-> K=317  (~730ms)
        n=500,000-> K=500  (cap, ~1.15s)

    Verification cost is ~2.3 ms/candidate — the cap at 500 keeps the
    worst case under ~1.2 seconds, acceptable for an assessment pipeline
    that already runs SIFT extraction, CLIP, OCR, and ELA.
    """
    import math

    cap = settings.ORB_RETRIEVAL_MAX_K
    scaled = max(configured_k, math.ceil(math.sqrt(corpus_size)))
    return min(scaled, cap)


def find_geometric_duplicates(
    candidate_features,  # app.keypoint_match.ORBFeatures
    session: Database,
    embedding: Optional[np.ndarray] = None,
    color_signature: Optional[np.ndarray] = None,
    top_k: int | None = None,
    inlier_threshold: int | None = None,
) -> list[tuple[ImageRecord, int]]:
    """Geometrically verify the most promising stored images against the
    candidate's SIFT keypoints.

    Retrieval is deliberately threshold-free: the whole point of this
    layer is catching heavy crops and large rotations whose similarity
    has already sunk BELOW every normal band (a 30% crop averages ~0.85
    CLIP cosine and keeps falling). Top-K still surfaces the true source,
    and RANSAC verification supplies the certainty retrieval cannot —
    measured 0/190 false positives, because unrelated images max out at
    35 inliers with ratio 0.574 against the ratio gate of 0.60.

    Top-K scales adaptively with corpus size: at n≤400 the configured
    floor (20) applies; beyond that K grows as √n, capped at
    ORB_RETRIEVAL_MAX_K (default 500). This addresses the documented
    concern that a 128-bin colour histogram's Recall@K degrades when
    thousands of images compete for the same colour-space bins. The
    verification cost scales as O(√n) — at 10K images ~230ms, at 100K
    ~730ms — acceptable for an assessment pipeline.

    Candidates are the UNION of two independent retrieval signatures:
    CLIP embedding cosine (when CLIP is enabled) and the colour
    signature (always available). The union is what makes this layer
    work with ENABLE_CLIP=False — with neither signature supplied there
    is no cheap way to nominate candidates and the layer returns nothing
    rather than falling back to an O(n) descriptor scan.

    Only records that stored SIFT/ORB features can be verified (file_path
    may be a remote Cloudinary URL, so recomputing them here is not an
    option).

    Returns (record, inlier_count) for candidates meeting the inlier
    threshold, strongest first.
    """
    from app.keypoint_match import deserialize_features, verify_geometric_match

    configured_k = top_k if top_k is not None else settings.ORB_RETRIEVAL_TOP_K
    if inlier_threshold is None:
        inlier_threshold = settings.ORB_INLIER_THRESHOLD
    if embedding is None and color_signature is None:
        return []

    records_raw = list(session.image_records.find({"orb_features": {"$ne": None}}))
    if not records_raw:
        return []
    records = [ImageRecord(**doc) for doc in records_raw]

    # Scale top-K with corpus size — the key fix for Recall@K at scale.
    effective_k = _effective_top_k(len(records), configured_k)
    if effective_k != configured_k:
        logger.debug(
            "Adaptive top-K: corpus=%d, configured=%d, effective=%d",
            len(records), configured_k, effective_k,
        )

    candidate_indices: list[int] = []
    for query, attribute in ((embedding, "embedding"), (color_signature, "color_signature")):
        if query is None:
            continue
        for idx in _top_k_by_signature(records, query, attribute, effective_k):
            if idx not in candidate_indices:
                candidate_indices.append(idx)

    matches: list[tuple[ImageRecord, int]] = []
    for idx in candidate_indices:
        record = records[idx]
        stored = deserialize_features(record.orb_features)
        if stored is None:
            continue
        verdict = verify_geometric_match(candidate_features, stored)
        if verdict.is_match and verdict.inliers >= inlier_threshold:
            matches.append((record, verdict.inliers))
        elif verdict.reject_reason not in (None, "too_few_inliers"):
            # Log near-misses that were rejected by a GATE rather than
            # by simply not matching — these are the cases worth seeing
            # if this layer ever seems to under-report.
            logger.info(
                "Geometric verification rejected %s: %s (inliers=%d ratio=%.2f minfeat=%d)",
                record.work_id, verdict.reject_reason, verdict.inliers,
                verdict.inlier_ratio, verdict.min_features,
            )

    matches.sort(key=lambda x: x[1], reverse=True)
    return matches



# ── Unified search across all layers ────────────────────────────────

def search_all_layers(
    sha256: str,
    phash: str,
    dhash: str | None,
    embedding: Optional[np.ndarray],
    work_id: str,
    district: str,
    mp_name: str | None,
    session: Database,
    phash_rotation_variants: list[str] | None = None,
    tile_hashes: list[str] | None = None,
    orb_features=None,  # app.keypoint_match.ORBFeatures | None
    color_signature: Optional[np.ndarray] = None,
) -> DuplicateReport:
    """Run all three detection layers and return a unified duplicate report.

    Deduplicates results across layers (the same image may be found by
    multiple layers) and computes the cross-boundary flags that determine
    fraud severity.

    Args:
        sha256:    SHA-256 hash of the candidate.
        phash:     Perceptual hash of the candidate.
        dhash:     Difference hash of the candidate (may be None).
        embedding: CLIP embedding of the candidate (may be None if CLIP disabled).
        work_id:   MPLADS work identifier for the candidate.
        district:  Claimed district for the candidate.
        mp_name:   Name of the recommending MP (may be None).
        session:   Database session.
        phash_rotation_variants: Optional rotated-variant pHashes for the
                   candidate (see app.hashing.compute_phash_rotation_robust).
                   Passed through to find_perceptual_duplicates() so
                   rotation-robust matching applies to Layer 2.

    Returns:
        DuplicateReport with matches from all layers and cross-boundary flags.
    """
    report = DuplicateReport()
    # A record can match through several layers. Keep one strongest
    # perceptual-hash finding per record, but retain separate evidence when
    # different records match.
    seen_record_ids: set[str] = set()

    def record_key(record: ImageRecord) -> str:
        """Stable in-process key for deduplicating a stored record."""
        return record.id or f"{record.work_id}:{record.file_path}"

    # ── Layer 1: Exact SHA-256 matches ───────────────────────────────
    exact_records = find_exact_duplicates(sha256, session)
    for record in exact_records:
        match = _classify_match(
            matched_record=record,
            candidate_work_id=work_id,
            candidate_district=district,
            candidate_mp_name=mp_name,
            similarity_metric="sha256",
            raw_score=0,  # distance 0 = identical
            confidence="CERTAIN",
        )
        report.exact_matches.append(match)
        seen_record_ids.add(record_key(record))

    # ── Layer 2: pHash + dHash matches ───────────────────────────────
    # Select the strongest hash result for each record. This means a pHash
    # "possible" finding cannot hide a stronger dHash duplicate finding, and
    # the same evidence is never scored twice just because both hashes match.
    perceptual_candidates: dict[str, tuple[ImageRecord, int, str, bool]] = {}

    def add_perceptual_candidate(
        record: ImageRecord,
        dist: int,
        metric: str,
        duplicate_threshold: int,
    ) -> None:
        key = record_key(record)
        if key in seen_record_ids:
            return
        is_duplicate = dist <= duplicate_threshold
        previous = perceptual_candidates.get(key)
        if previous is None:
            perceptual_candidates[key] = (record, dist, metric, is_duplicate)
            return

        _, previous_dist, _, previous_is_duplicate = previous
        # Prefer duplicate-tier evidence over suspicious-tier evidence; within
        # a tier, prefer the lower Hamming distance.
        if (is_duplicate, -dist) > (previous_is_duplicate, -previous_dist):
            perceptual_candidates[key] = (record, dist, metric, is_duplicate)

    phash_matches = find_perceptual_duplicates(phash, session, rotation_variants=phash_rotation_variants)
    for record, dist in phash_matches:
        add_perceptual_candidate(record, dist, "phash", settings.PHASH_DUPLICATE_THRESHOLD)

    if dhash is not None:
        dhash_matches = find_dhash_duplicates(dhash, session)
        for record, dist in dhash_matches:
            add_perceptual_candidate(record, dist, "dhash", settings.DHASH_DUPLICATE_THRESHOLD)

    for record, dist, metric, is_duplicate in perceptual_candidates.values():
        match = _classify_match(
            matched_record=record,
            candidate_work_id=work_id,
            candidate_district=district,
            candidate_mp_name=mp_name,
            similarity_metric=metric,
            raw_score=float(dist),
            confidence="CERTAIN" if is_duplicate else "POSSIBLE",
        )
        report.perceptual_matches.append(match)
        seen_record_ids.add(record_key(record))

    # ── Layer 2b: Tiled perceptual hash matches (Task 2.3) ────────────
    # Only runs when the caller supplied tile_hashes (i.e.
    # ENABLE_TILED_HASH is True and risk_engine.py computed them).
    # Appended to perceptual_matches with similarity_metric="tiled_phash"
    # so risk_engine.py's existing perceptual-match scoring loop picks
    # it up — it's evidence for the same PERCEPTUAL_DUPLICATE finding
    # via a different technique, not a new severity category.
    if settings.ENABLE_TILED_HASH and tile_hashes:
        tiled_matches = find_tiled_duplicates(tile_hashes, session)
        for record, matching_tile_count in tiled_matches:
            if record_key(record) in seen_record_ids:
                continue  # already found by whole-image sha256/phash

            match = _classify_match(
                matched_record=record,
                candidate_work_id=work_id,
                candidate_district=district,
                candidate_mp_name=mp_name,
                similarity_metric="tiled_phash",
                raw_score=float(matching_tile_count),
                confidence="CERTAIN",
            )
            report.perceptual_matches.append(match)
            seen_record_ids.add(record_key(record))

    # ── Layer 3: Semantic embedding matches ──────────────────────────
    if embedding is not None:
        semantic_matches = find_semantic_duplicates(embedding, session)
        for record, sim in semantic_matches:
            if record_key(record) in seen_record_ids:
                continue  # Already found by earlier layers

            if sim >= settings.EMBEDDING_DUPLICATE_THRESHOLD:
                confidence = "LIKELY"
            elif sim >= settings.EMBEDDING_SUSPICIOUS_THRESHOLD:
                confidence = "POSSIBLE"
            else:
                confidence = "POSSIBLE"

            match = _classify_match(
                matched_record=record,
                candidate_work_id=work_id,
                candidate_district=district,
                candidate_mp_name=mp_name,
                similarity_metric="clip",
                raw_score=float(sim),
                confidence=confidence,
            )
            report.semantic_matches.append(match)
            seen_record_ids.add(record_key(record))

    # ── Layer 6: ORB geometric verification (retrieve-then-verify) ───
    # Needs the candidate's ORB features plus at least one retrieval
    # signature. The colour signature is always available, so unlike the
    # first version of this layer it no longer goes dark when
    # ENABLE_CLIP is False; CLIP simply adds a second, complementary
    # set of candidates when present.
    if settings.ENABLE_KEYPOINT_MATCH and orb_features is not None:
        geometric = find_geometric_duplicates(
            orb_features, session, embedding=embedding, color_signature=color_signature
        )
        # A record can be nominated by CLIP and verified here while also
        # sitting in semantic_matches. Keep only the geometric finding
        # for that record — it supersedes the cosine similarity (same
        # evidence, higher certainty), and keeping both would let
        # risk_engine score one re-used photo twice.
        geometric_keys = set()
        for record, inliers in geometric:
            key = record_key(record)
            geometric_keys.add(key)
            if key in seen_record_ids and not any(
                record_key(m.matched_record) == key for m in report.semantic_matches
            ):
                continue  # already found by exact/perceptual layers — their evidence stands

            match = _classify_match(
                matched_record=record,
                candidate_work_id=work_id,
                candidate_district=district,
                candidate_mp_name=mp_name,
                similarity_metric="orb",
                raw_score=float(inliers),
                confidence="CERTAIN",
            )
            report.geometric_matches.append(match)
            seen_record_ids.add(key)

        if geometric_keys:
            report.semantic_matches = [
                m for m in report.semantic_matches
                if record_key(m.matched_record) not in geometric_keys
            ]

    # ── Compute aggregate cross-boundary flags ───────────────────────
    for m in report.all_matches:
        if m.cross_work:
            report.has_cross_work_match = True
        if m.cross_district:
            report.has_cross_district_match = True
        if m.cross_mp:
            report.has_cross_mp_match = True

    return report
