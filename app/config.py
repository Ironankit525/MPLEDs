"""
Centralised configuration for the MPLADS Image Fraud Detection Module.

Every tunable threshold and weight lives here as a named constant inside
a pydantic BaseSettings class.  Values can be overridden via environment
variables (e.g. PHASH_DUPLICATE_THRESHOLD=3) or a .env file.

Design principle: NO magic numbers in application code — if a number
affects detection behaviour, it belongs in this file with a comment
explaining *why* that default was chosen.
"""

from typing import Any

from pydantic_settings import BaseSettings
from pathlib import Path


# ── Project paths ────────────────────────────────────────────────────
# All paths are relative to the project root (one level above app/).
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
IMAGES_DIR = DATA_DIR / "images"
DB_PATH = DATA_DIR / "mplads.db"


class Settings(BaseSettings):
    """All detection thresholds, risk weights, and feature toggles.

    Override any setting via an environment variable of the same name,
    e.g. ``ENABLE_CLIP=False uvicorn app.main:app``.
    """

    # ── Layer 1 & 2: Perceptual hashing ──────────────────────────────

    # pHash Hamming distance ≤ 5 is almost certainly the same image with
    # minor recompression/resize.  Empirically, unrelated images differ
    # by 15-30+ bits out of 64.
    PHASH_DUPLICATE_THRESHOLD: int = 5

    # Hamming distance 6–10 is "suspicious but not certain" — could be
    # a heavily cropped or rotated version.  Worth flagging for review.
    PHASH_SUSPICIOUS_THRESHOLD: int = 10

    # dHash measures local brightness gradients, making it a useful
    # independent fallback when a crop defeats pHash's global DCT signature.
    # Keep these defaults stricter than pHash until they are calibrated on the
    # real-photo corpus: a dHash-only match is still useful evidence, but it
    # must not broaden the duplicate net without field data.
    DHASH_DUPLICATE_THRESHOLD: int = 3
    DHASH_SUSPICIOUS_THRESHOLD: int = 6

    # Empirical finding (Round 2 calibration): rotation and heavy cropping
    # defeat pHash at the thresholds above even at modest angles. Raising
    # PHASH_*_THRESHOLD globally to compensate would inflate false
    # positives across every case, so instead: when enabled, the incoming
    # image is hashed at each of ROTATION_ROBUST_ANGLES and the MINIMUM
    # Hamming distance against each stored (single, canonical) hash is
    # used. This only ever lowers the effective distance, never raises
    # it. Residual weakness (rotation beyond this range, heavy crops) is
    # documented in the README's "Known limitations" section, not hidden.
    ENABLE_ROTATION_ROBUST_HASH: bool = True
    ROTATION_ROBUST_ANGLES: list[float] = [-5.0, 0.0, 5.0]

    # Round 3 finding: heavy cropping (~12% off every edge) genuinely
    # defeats pHash even with rotation-robust hashing — confirmed by
    # measurement (scripts/evaluate_detection.py's diagnosis output),
    # classified as an ALGORITHM LIMITATION, not a threshold problem.
    # Narrowest additional check attempted: split the image into a 3x3
    # grid of overlapping tiles, hash each tile, and consider it a match
    # if >=4 of 9 tile hashes are close within PHASH_DUPLICATE_THRESHOLD.
    #
    # MEASURED RESULT: this does NOT currently catch the actual
    # cropped_duplicate test case (see tests/test_tiled_hash.py's
    # TestTiledHashHonestFindings) — per-tile pHash turned out to be far
    # MORE sensitive to the crop's registration shift than the
    # whole-image hash is, even after trying larger overlap, square
    # tiles, and all-pairs (not just position-aligned) matching. The
    # independent dHash fallback now catches this fixture (distance 3),
    # while CLIP remains corroborating evidence when enabled.
    #
    # Defaults OFF and stays off: not proven to help, only proven not to
    # hurt (it's a pure addition, never removes a match another layer
    # would have found). Kept in the codebase because the matching
    # MECHANISM itself is correct (tested directly) and the tiling
    # geometry may be worth revisiting against real photographs, which
    # have much richer local texture than this project's synthetic test
    # images — that's future work, not a claim made here. Storage cost
    # if ever enabled: ~9 extra pHashes per stored image (see README).
    ENABLE_TILED_HASH: bool = False
    TILED_HASH_GRID_SIZE: int = 3          # 3x3 = 9 tiles
    TILED_HASH_TILE_OVERLAP: float = 0.15  # 15% overlap between adjacent tiles
    TILED_HASH_MIN_MATCHING_TILES: int = 4  # >=4/9 tiles required to call it a match

    # ── Layer 3: CLIP embedding similarity ───────────────────────────

    # cosine similarity ≥ 0.95 flags as SEMANTIC_DUPLICATE.
    # E.g. same scene taken from a slightly different angle/distance.
    EMBEDDING_DUPLICATE_THRESHOLD: float = 0.95

    # 0.85–<0.95 is "same general subject, possibly same location" —
    # warrants human review but isn't conclusive on its own.
    EMBEDDING_SUSPICIOUS_THRESHOLD: float = 0.85

    # ── Semantic content match ───────────────────────────────────────

    # CLIP zero-shot confidence below 0.60 for the claimed work type
    # means the photo likely doesn't depict what it claims to.
    # Set conservatively to avoid false positives on ambiguous scenes.
    SEMANTIC_MATCH_THRESHOLD: float = 0.60

    # Below THIS bar, "likely doesn't match" becomes "essentially
    # certainly doesn't match" — scored and worded differently
    # (CONTENT_MISMATCH_SEVERE, HIGH) from a borderline case just under
    # SEMANTIC_MATCH_THRESHOLD (CONTENT_MISMATCH, MEDIUM). Not a guess:
    # tests/test_clip_integration.py's TestZeroShotAccuracy measures
    # zero_shot_match() against every labeled real photo's OWN true
    # work type — the score a genuine, correctly-claimed photo gets.
    # The lowest ever measured there (a hard case: an interior
    # classroom shot with no exterior building cues) was 0.372. 0.10
    # sits well clear of every real photo this project has measured,
    # so a score below it isn't "an ambiguous scene" in the same sense
    # the MEDIUM tier's conservative threshold exists to tolerate — see
    # that test file before moving this without also re-measuring it.
    SEMANTIC_MATCH_SEVERE_THRESHOLD: float = 0.10

    # ── GPS / geolocation ────────────────────────────────────────────

    # 50 km is generous enough to cover large districts while catching
    # blatant cross-district fraud (photos 200-400+ km away).
    #
    # KNOWN LIMITATION, not yet fixed: this is a single global radius
    # measured from a district CENTRE point, and several real districts
    # are larger than it — Pune (~15,600 km2) has an equivalent radius
    # of ~70 km, Nagpur ~56 km, Jaipur ~60 km. A genuine photo taken at
    # the edge of one of those would sit beyond 50 km from the centroid
    # and be flagged HIGH. Conversely it is far too loose for small
    # districts (Chennai's equivalent radius is ~12 km, so 50 km spans
    # several neighbouring districts). Properly fixing this needs
    # district boundary polygons, or at minimum a per-district radius,
    # rather than one number for all of them. This value has also never
    # been empirically calibrated — scripts/calibrate_thresholds.py
    # covers pHash and CLIP only, and merely COUNTS GPS-bearing photos
    # as a corpus gate.
    GPS_MAX_DISTANCE_KM: float = 50.0

    # A browser's navigator.geolocation fix can come from a GPS chip
    # (~5-20 m), WiFi positioning (~20-100 m), cell towers (~0.5-5 km),
    # or — on a desktop, or when precise location is denied — from IP
    # geolocation, which is routinely 10-100+ km out and can resolve to
    # an ISP hub in an entirely different city. All of these arrive
    # through the same API; only the reported `accuracy` radius tells
    # them apart.
    #
    # Above this bound the fix cannot distinguish "inside the district"
    # from "outside" at all, so it is not used for the district check
    # (the submission is treated as having no device location rather
    # than being judged on a guess). Set equal to GPS_MAX_DISTANCE_KM:
    # once the uncertainty is as large as the entire tolerance, the
    # measurement carries no information about the question being asked.
    GPS_DEVICE_MAX_ACCURACY_M: float = 50_000.0

    # ── ELA (Error Level Analysis) ───────────────────────────────────

    # JPEG quality for re-saving during ELA.  95 is high enough that
    # the re-saved version is very close to the original for untampered
    # images, but tampered regions (saved at a different quality) show
    # up as areas with higher error.
    ELA_QUALITY: int = 95

    # Per-pixel error above this value is considered suspicious.
    # Typical untampered JPEG: max error ~15-25.  Tampered: 40+.
    ELA_TAMPER_THRESHOLD: float = 40.0

    # Error std-dev below this value suggests a screenshot (uniform
    # compression → uniform error → not a camera photo).
    ELA_UNIFORMITY_THRESHOLD: float = 5.0

    # Multiplier for the ELA heatmap visualisation (higher = brighter).
    ELA_SCALE_FACTOR: int = 15

    # Master switch for ELA tamper detection.
    ENABLE_ELA: bool = True

    # Photo-of-photo (moiré) detection thresholds.  A photo of a printed
    # image or screen produces regular repeating patterns that show up as
    # elevated mid-frequency energy in the FFT spectrum.
    MOIRE_RATIO_THRESHOLD: float = 1.15       # mid-freq / total energy ratio
    MOIRE_PEAK_RATIO_THRESHOLD: float = 8.0   # max / mean in mid-freq band

    # ── CLIP model ───────────────────────────────────────────────────

    # Base CLIP model — good accuracy/speed trade-off for CPU inference.
    # ~600 MB download on first use.
    CLIP_MODEL_NAME: str = "openai/clip-vit-base-patch32"

    # Master switch to disable CLIP entirely.  When False, the module
    # runs hash + EXIF checks only — useful on machines without torch
    # or during development.
    ENABLE_CLIP: bool = True

    # ── MPLADS work-type prompt templates ────────────────────────────
    # Multiple prompts per work type improve zero-shot accuracy by
    # capturing different visual representations of the same category.
    # CLIP uses the BEST matching prompt (highest confidence) instead
    # of a single generic one.  Work types not listed here fall back
    # to the generic "a photograph of {work_type}" template.
    WORK_TYPE_PROMPTS: dict[str, list[str]] = {
        "road construction": [
            "a photograph of a newly constructed road in a rural area",
            "a photograph of road building work in progress with machinery",
            "a photograph of a paved road with fresh asphalt or concrete",
            "a photograph of a village road under construction",
        ],
        "school building": [
            "a photograph of a school building under construction",
            "a photograph of a newly built school with classrooms",
            "a photograph of a government school building in India",
        ],
        "community hall": [
            "a photograph of a community hall or public gathering space",
            "a photograph of a newly built community centre in a village",
            "a photograph of a panchayat bhawan or meeting hall",
        ],
        "water facility": [
            "a photograph of a water tank or overhead water storage",
            "a photograph of a hand pump or bore well installation",
            "a photograph of a water supply pipeline being laid",
            "a photograph of a drinking water facility in a village",
        ],
        "drainage": [
            "a photograph of a drainage channel or nullah construction",
            "a photograph of a concrete drain being built",
            "a photograph of storm water drainage infrastructure",
        ],
        "bridge": [
            "a photograph of a bridge under construction",
            "a photograph of a newly built concrete bridge over a river",
            "a photograph of a small culvert or foot bridge",
        ],
        "toilet": [
            "a photograph of a public toilet block under construction",
            "a photograph of a newly built community sanitation facility",
            "a photograph of individual household latrines being built",
        ],
        "hospital": [
            "a photograph of a hospital or health centre building",
            "a photograph of a primary health centre under construction",
            "a photograph of a medical facility in a rural area",
        ],
        "electricity": [
            "a photograph of electrical poles and wiring installation",
            "a photograph of a solar panel or solar street light installation",
            "a photograph of electrical infrastructure work",
        ],
        "park": [
            "a photograph of a public park or garden being developed",
            "a photograph of a playground with equipment",
            "a photograph of a green space with fencing and pathways",
        ],
    }

    # ── Risk scoring weights ─────────────────────────────────────────
    # Each weight represents the points added to the risk score when
    # that signal fires.  The total is capped at 100.

    # Exact byte-for-byte duplicate submitted under a different work ID
    # is the strongest fraud signal — no innocent explanation.
    WEIGHT_EXACT_MATCH_CROSS_WORK: int = 60

    # Perceptual duplicate (resize/crop/recompress) under a different
    # work ID — very strong signal, nearly as damning as exact match.
    WEIGHT_PERCEPTUAL_DUPLICATE_CROSS_WORK: int = 50

    # CLIP-based semantic duplicate under a different work ID — strong
    # but less certain since CLIP can conflate genuinely similar scenes.
    WEIGHT_SEMANTIC_DUPLICATE_CROSS_WORK: int = 35

    # A CLIP neighbour in the wider suspicious band is a review signal, not
    # proof of a duplicate. It is scored once for the strongest neighbour;
    # see risk_engine.py's semantic-match scoring.
    WEIGHT_SEMANTIC_SUSPICIOUS_CROSS_WORK: int = 15

    # Cross-district and cross-MP matches are additional aggravating
    # factors on top of the base duplicate score.
    WEIGHT_CROSS_DISTRICT: int = 20
    WEIGHT_CROSS_MP: int = 20
    # OCR / Receipt flags
    WEIGHT_RECEIPT_DATE_MISMATCH: int = 25
    WEIGHT_RECEIPT_AMOUNT_MISMATCH: int = 20

    # Photo taken before the work was even sanctioned — strong evidence
    # the photo is recycled from an earlier project or stock.
    WEIGHT_PHOTO_PREDATES_SANCTION: int = 30

    # GPS coordinates far from the claimed district — strong evidence
    # the photo was taken elsewhere.
    WEIGHT_GPS_MISMATCH: int = 30

    # CLIP says the photo doesn't depict the claimed work type —
    # moderate signal, can have false positives with ambiguous scenes.
    WEIGHT_CONTENT_MISMATCH: int = 25

    # CLIP says so at a confidence no genuine photo in this project's
    # own calibration corpus has ever come close to (see
    # SEMANTIC_MATCH_SEVERE_THRESHOLD's comment) — e.g. a portrait
    # submitted as road-construction evidence, not a hard-to-classify
    # real site photo. Weighted alone into HIGH (60-100): this is
    # direct evidence the claimed work isn't what the photo shows, a
    # comparable strength of signal to an exact duplicate match.
    WEIGHT_CONTENT_MISMATCH_SEVERE: int = 65

    # EXIF metadata stripped — suspicious but not conclusive; many
    # legitimate apps strip EXIF for privacy. NOTE: this constant is kept
    # for backward compatibility (existing tests read it directly), but
    # the LIVE scoring path for EXIF_STRIPPED is superseded by
    # CONDITIONAL_FLAG_WEIGHTS below — see that comment for why.
    WEIGHT_EXIF_STRIPPED: int = 15

    # Editing software detected in EXIF — mild signal; the photo may
    # have been colour-corrected innocently, but combined with other
    # signals it's worth noting.
    WEIGHT_EDITING_SOFTWARE: int = 10

    # Perceptual hash in the "suspicious" band (between duplicate and
    # suspicious thresholds) — weak signal on its own.
    WEIGHT_SUSPICIOUS_PHASH: int = 15

    # ELA detects regions with inconsistent JPEG compression — strong
    # evidence of splicing, copy-move, or Photoshop editing.
    WEIGHT_IMAGE_TAMPERED: int = 35

    # Image appears to be a screenshot (uniform error levels, not a
    # camera photo) — strong evidence the "photo" is fabricated.
    WEIGHT_SCREENSHOT_DETECTED: int = 25

    # Image appears to be a photo taken of another photo or screen
    # (moiré patterns detected in frequency domain).
    WEIGHT_PHOTO_OF_PHOTO: int = 25

    # ── Conditional (context-dependent) flag weights ─────────────────
    # Task 4: EXIF_STRIPPED firing on EVERY submission lacking metadata
    # is a real production problem — WhatsApp, most web upload forms,
    # and many CMS pipelines strip EXIF automatically, so a static
    # WEIGHT_EXIF_STRIPPED causes alert fatigue on a large share of
    # otherwise-legitimate submissions.
    #
    # General mechanism (not a EXIF_STRIPPED special case): any flag
    # code listed here has its points/severity/message resolved at
    # scoring time based on whether ANY OTHER flag is also present on
    # the same assessment — "alone" vs "with_others". Flag codes NOT
    # listed here keep their unconditional WEIGHT_* value. See
    # risk_engine._resolve_conditional_flags().
    CONDITIONAL_FLAG_WEIGHTS: dict[str, dict[str, dict[str, Any]]] = {
        "EXIF_STRIPPED": {
            "alone": {
                "points": 5,
                "severity": "LOW",
                "message": (
                    "This photograph contains no EXIF metadata. This is noted as an "
                    "observation, not an accusation — many devices, messaging apps, "
                    "and web upload forms strip metadata automatically."
                ),
            },
            "with_others": {
                "points": 15,
                "severity": "MEDIUM",
                "message": (
                    "This photograph contains no EXIF metadata, which compounds the "
                    "other finding(s) on this submission by removing evidence that "
                    "could otherwise corroborate or refute them."
                ),
            },
        },
    }

    # ── Risk level buckets ───────────────────────────────────────────

    RISK_LOW_MAX: int = 29      # 0–29 → LOW
    RISK_MEDIUM_MAX: int = 59   # 30–59 → MEDIUM
    # 60–100 → HIGH

    # ── Upload limits ────────────────────────────────────────────────

    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    ALLOWED_EXTENSIONS: list[str] = [".jpg", ".jpeg", ".png", ".webp"]

    # ── Database ─────────────────────────────────────────────────────

    # MongoDB Atlas connection string. No default on purpose — this used
    # to be a hardcoded fallback in app/database.py (including a live
    # username/password), which meant the credential shipped in source
    # control. Required from the environment / .env now; startup fails
    # fast with a clear pydantic error instead of silently reusing a
    # baked-in credential. Set via DATABASE_URL in .env — see .env's
    # comment for the rotation note.
    DATABASE_URL: str

    # Signs and verifies JWT access tokens (app/auth.py). No default for
    # the same reason as DATABASE_URL above — this was previously a
    # hardcoded string literal in app/auth.py. Set via JWT_SECRET_KEY in
    # .env. Generate a new one with: python -c "import secrets; print(secrets.token_hex(32))"
    JWT_SECRET_KEY: str

    # ── Cloudinary ───────────────────────────────────────────────────
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # ── AI report summary (Gemini) ───────────────────────────────────
    # Optional, unlike DATABASE_URL/JWT_SECRET_KEY above: an empty key
    # simply disables the /api/stakeholder/ai-summary narrative and the
    # dashboard renders numbers-only — same graceful-degradation posture
    # as CLIP and EasyOCR. Key comes from Google AI Studio.
    GEMINI_API_KEY: str = ""
    # Summarising one screen of pre-computed figures is a trivial task,
    # so default to the cheapest/fastest tier rather than a pro model.
    GEMINI_MODEL: str = "gemini-2.5-flash"
    # Bounds how long an already-generated summary is reused. Freshness
    # does not depend on this: the cache key is a hash of the figures,
    # so any data change regenerates immediately regardless of TTL.
    AI_SUMMARY_CACHE_TTL_SECONDS: int = 600
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


# Module-level singleton — import this everywhere.
settings = Settings()
