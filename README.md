# MPLADS Image Fraud & Anomaly Detection System

This repository contains the complete suite for the MPLADS tracking system, including the core Python AI backend and three distinct React frontend dashboards for different user roles.

---

## 🖥️ UI Dashboards Guide

We have recently migrated to a **Unified Authentication System** running out of the `auth-portal` and `SIH frontend` architecture. This acts as the single point of entry for all three primary user roles: Admin, Member of Parliament (MP), and Contractor.

### Unified Login Portal
- **Folder:** `auth-portal/` (Handles authentication and routing)
- **Access URL:** `http://localhost:3000` (or `http://localhost:5173/login`)
- **Authentication Credentials:**
  All roles use a common password: **`demo1234`**. Your role and dashboard destination are determined by the username you provide:
  
  1. **Admin / Command Center**
     - Username: `admin`
     - Destination: Redirects to `SIH frontend` (`localhost:5173`)
     - Purpose: System-wide oversight, risk monitoring, and comprehensive project analytics across all constituencies.
     
  2. **MP Dashboard**
     - Username: `mp`
     - Destination: Redirects to `mp-dashboard-demo/mplads-command-center/frontend` (`localhost:5175`)
     - Purpose: Dedicated view for Members of Parliament to monitor progress, view contractor evidence, and see AI insights exclusively for their own constituency.
     
  3. **Contractor Upload Portal**
     - Username: `contractor`
     - Destination: Redirects to `contractor-dashboard-demo` (`localhost:5174`)
     - Purpose: Dedicated portal for on-ground contractors to upload live photographic evidence for their assigned projects.

*(Note: Although they share a unified login screen, all three frontend folders must be running concurrently on their respective ports for the role-based routing to work successfully.)*

---

# MPLADS Image Fraud & Anomaly Detection Module

A self-contained Python module and REST API that detects fraudulent photographic evidence submitted under India's **MPLADS (Members of Parliament Local Area Development Scheme)**. It ingests work-completion photographs, checks them against all previously uploaded images using three independent duplicate-detection layers (cryptographic hashing, perceptual hashing, and AI-based semantic analysis), runs EXIF metadata anomaly checks, GPS distance verification, Error Level Analysis for single-image tamper/screenshot detection, and OCR-based receipt cross-checking — and returns a fully explainable risk assessment with every point in the score traceable to a specific finding. Submissions go through a JWT-authenticated, single-use camera-session gate meant to make it harder to submit a photo that wasn't actually taken live for the work being claimed.

---

## Setup

### Prerequisites

- Python **3.10 or higher** (minimum determined by static analysis — see `pyproject.toml`'s `requires-python` note; the development machine only had 3.14 available to actually test on)
- ~2 GB disk space (PyTorch + the ~1.7 GB CLIP model, downloaded on first use)
- See [SETUP_VERIFICATION.md](SETUP_VERIFICATION.md) for a one-command setup (`./setup.sh` / `setup.bat`) and a step-by-step verification checklist with troubleshooting.

### Installation

**Unix / macOS:**

```bash
git clone <repo-url> && cd mplads_image_module
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Windows (PowerShell):**

```powershell
git clone <repo-url>; cd mplads_image_module
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Required environment variables

Create a `.env` file in the project root (never commit it — already
gitignored) with:

```bash
DATABASE_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/MPLADS
JWT_SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
CLOUDINARY_CLOUD_NAME=<your Cloudinary cloud name>
CLOUDINARY_API_KEY=<your Cloudinary API key>
CLOUDINARY_API_SECRET=<your Cloudinary API secret>
```

Optionally, add a `GEMINI_API_KEY` (from Google AI Studio) to enable
the AI-drafted narrative summaries (`app/report_summary.py`) — one per
oversight surface, each written for its own audience from its own
figures: `GET /api/stakeholder/ai-summary` (whole-pipeline oversight),
`GET /api/reviews/ai-summary` (the reviewer's queue), and
`GET /api/admin/ai-summary` (accounts + system activity). Unlike the
four values above it is **not** required: without it the endpoints
answer `available: false` and the pages render numbers-only — the same
graceful-degradation posture as CLIP and EasyOCR. The model only
phrases figures the backend has already computed; it is never asked to
calculate anything, and results are cached in-process keyed by a hash
of the full prompt so unchanged data never re-bills the API.

All four are required at startup (`app/config.py`'s `Settings` class
has no fallback default for `DATABASE_URL` or `JWT_SECRET_KEY`, on
purpose — an earlier version of this module shipped a hardcoded Mongo
credential and a hardcoded JWT secret directly in source as
"hackathon" fallbacks; both have since been rotated/removed and the
app now fails fast with a clear error instead of silently reusing a
baked-in value if either is missing).

### Pre-downloading the CLIP Model

The first call to any endpoint that uses CLIP (semantic analysis) will download the `openai/clip-vit-base-patch32` model (~600 MB). To pre-download:

```python
python -c "from transformers import CLIPModel, CLIPProcessor; CLIPProcessor.from_pretrained('openai/clip-vit-base-patch32'); CLIPModel.from_pretrained('openai/clip-vit-base-patch32')"
```

Or set `ENABLE_CLIP=False` to run without CLIP (hash + EXIF checks only):

```bash
ENABLE_CLIP=False uvicorn app.main:app --reload
```

EasyOCR (Layer 5) downloads its own detection/recognition models
(~65 MB) on first use the same way — no separate pre-download script
exists for it yet; the first receipt/invoice/document submission will
pause briefly for that download.

### Mandatory ML visual-evidence validation

The shared SigLIP detector is mandatory and performs two checks: it
first distinguishes plausible local contractor evidence from famous-landmark,
stock/travel, generic non-project, and unrelated images; it then identifies
rendered browser/editor screenshots. The API loads the configured model during
startup and fails closed if the model is disabled or cannot load.
`sentencepiece` and `protobuf` are required by its tokenizer and are included
in both requirements files.

```bash
uvicorn app.main:app --reload
```

The response includes `work_evidence_status`, `work_evidence_probability`,
`screen_probability`, and the shared model name. Confident invalid evidence
raises `FAMOUS_LANDMARK_SUSPECTED` or `NOT_PROJECT_WORK_EVIDENCE` before the
remaining anomaly checks run. High-confidence screen results raise
`SCREEN_CAPTURE_SUSPECTED`.
Borderline inference results remain `INSUFFICIENT_EVIDENCE`; the model cannot
prove an original capture date. `ALLOW_VISUAL_MODEL_TEST_BYPASS` exists only
for isolated automated tests and must remain false in a deployed environment.

### Running the API

```bash
# Seed the database with sample images
python -m scripts.seed_database

# Start the server
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Running Tests

```bash
pytest tests/ -v
```

### Generating Fraud Test Cases

```bash
python -m scripts.generate_fraud_cases
```

This creates 10 types of fraudulent image variants in `data/fraud_cases/` with a `fraud_manifest.json` ground-truth file.

---

## Flag Reference

Every flag includes a `code`, `severity`, `human_message`, and `evidence` dict showing the raw values that triggered it.

| Flag Code | Severity | Meaning |
|---|---|---|
| `EXACT_DUPLICATE` | HIGH | Byte-for-byte identical image submitted for a different work |
| `PERCEPTUAL_DUPLICATE` | HIGH | Near-identical image (resized, recompressed) for a different work |
| `PERCEPTUAL_SUSPICIOUS` | MEDIUM | Suspicious similarity (heavy crop, rotation) for a different work |
| `SEMANTIC_DUPLICATE` | HIGH | AI-detected same scene (different angle/edit) for a different work |
| `SEMANTIC_SUSPICIOUS` | MEDIUM | CLIP found a possible cross-work visual neighbour; requires review |
| `CROSS_DISTRICT_MATCH` | HIGH | Duplicate match comes from a different district |
| `CROSS_MP_MATCH` | HIGH | Duplicate match comes from a different MP |
| `CONTENT_MISMATCH` | MEDIUM | Photo doesn't depict the claimed work type (AI analysis) — a borderline case, e.g. a photo of the wrong *infrastructure* type |
| `CONTENT_MISMATCH_SEVERE` | HIGH | Photo doesn't depict the claimed work type at a confidence no genuine photo in this project's own calibration corpus has ever come close to (e.g. a portrait submitted as road-construction evidence) — see Risk Scoring below |
| `EXIF_STRIPPED` | MEDIUM | No EXIF metadata (possible deliberate removal) |
| `PHOTO_PREDATES_SANCTION` | HIGH | Photo taken before the work was sanctioned |
| `PHOTO_FUTURE_DATED` | HIGH | Photo has a future capture date (clock manipulation) |
| `GPS_MISSING` | LOW | No location from **either** source — no GPS in EXIF *and* no location reported by the submitting device |
| `GPS_DISTRICT_MISMATCH` | HIGH | Location is far from the claimed district. `evidence.coords_source` records whether it came from the image's EXIF (`exif`) or the browser's `navigator.geolocation` (`device`) |
| `SOFTWARE_EDITED` | MEDIUM | EXIF indicates image editing software was used |
| `IMAGE_TAMPERED` | HIGH | Error Level Analysis found inconsistent JPEG compression regions (splicing/copy-move/editing) |
| `SCREENSHOT_DETECTED` | HIGH | Unnaturally uniform ELA error levels — likely a screenshot or generated image, not a camera photo |
| `PHOTO_OF_PHOTO` | HIGH | Moiré patterns detected — likely a photo of a printed photo or a screen |
| `RECEIPT_DATE_BEFORE_SANCTION` | HIGH | OCR-extracted date on a receipt/invoice predates the work's sanction date |
| `RECEIPT_AMOUNT_MISMATCH` | MEDIUM | OCR-extracted amount doesn't match the claimed amount |

---

## Five Detection Layers

### Why five layers?

Each layer catches fraud that the previous layer misses:

| Layer | Technique | What it catches | What it misses |
|---|---|---|---|
| **Layer 1** (SHA-256) | Cryptographic hash | Exact byte-for-byte re-uploads | Any modification at all (even re-saving) |
| **Layer 2** (pHash + dHash) | Perceptual hashing | Resize, recompress, crop, watermark, minor rotation | Same scene from a very different angle; heavy edits |
| **Layer 3** (CLIP) | AI semantic embedding | Same scene from different angles; heavily edited copies; content-type mismatches | Completely different images that happen to be visually similar (e.g., two roads) |
| **Layer 4** (ELA — `app/ela_analysis.py`) | Error Level Analysis | Spliced/copy-move edits within a *single* image; screenshots; photos of a screen or printed photo (moiré) | Anything about duplicates across submissions — this layer only looks at the one image in isolation |
| **Layer 5** (OCR — `app/ocr_analysis.py`) | EasyOCR text extraction | Receipt/invoice dates before the sanction date, or amounts that don't match the claim (via the `claimed_amount` form field) | Only runs when `work_type` is `receipt`/`invoice`/`document` |

Layer 1 is fastest and most certain but easiest to defeat. Layer 3 is most robust but has higher false-positive rates. Layers 4 and 5 don't compare against other submissions at all — they look for internal evidence of tampering or a document's own inconsistencies. Using all five gives the best coverage with graduated confidence.

---

## Risk Scoring

| Signal | Points |
|---|---|
| Exact SHA-256 match, different work | 60 |
| Perceptual duplicate, different work | 50 |
| Semantic duplicate (CLIP), different work | 35 |
| Semantic suspicious match (CLIP), different work | 15 |
| Match is cross-district | +20 |
| Match is cross-MP | +20 |
| Photo predates sanction date | 30 |
| GPS district mismatch | 30 |
| Content doesn't match work type (CLIP confidence 10–60%) | 25 |
| Content doesn't match work type, severely (CLIP confidence < 10%) | 65 |
| EXIF stripped, **alone** (no other flag) | 5 |
| EXIF stripped, **combined with any other flag** | 15 |
| Editing software detected | 10 |
| Suspicious-band perceptual match | 15 |
| ELA tamper detection (spliced/edited regions) | 35 |
| ELA screenshot detection | 25 |
| Photo-of-photo (moiré) detection | 25 |
| OCR: receipt date before sanction date | 25 |
| OCR: receipt amount mismatch | 20 |

**Total is capped at 100.** Risk levels: `LOW` (0–29), `MEDIUM` (30–59), `HIGH` (60–100).

This is a rule-based evidence index, **not a probability of fraud**. Exact,
perceptual, geometric and semantic detectors can observe the same reused source;
only the strongest base finding per matched work is scored. Cross-district and
cross-MP aggravation are each scored at most once per submission. A suspicious
semantic neighbour carries boundary context but does not receive an additional
boundary penalty.

CLIP similarity is correlated across nearby database records, so only the
strongest cross-work neighbour contributes to the score. A similarity in the
suspicious band is reported as `SEMANTIC_SUSPICIOUS` (MEDIUM, 15 points), not
as proof of a duplicate; duplicate-tier similarity is reported as
`SEMANTIC_DUPLICATE` (HIGH, 35 points).

For physical work, mandatory SigLIP work-evidence validation is authoritative.
The legacy CLIP content score remains in the response for diagnostics and as a
fallback when SigLIP inference is unavailable; it is not scored on top of a
SigLIP `VALID`, `REVIEW`, or `INVALID` decision. This prevents contradictory or
double-counted semantic findings.

**The fallback content mismatch has two severity tiers, split by a measured gap, not a
guess.** `SEMANTIC_MATCH_THRESHOLD` (0.60) alone treats a hard-but-genuine
photo the same as an obviously wrong one — e.g. a portrait submitted as
road-construction evidence scores the same MEDIUM as a real (if awkwardly
framed) road photo that happens to confuse CLIP. `tests/test_clip_integration.py`'s
`TestZeroShotAccuracy` measures every labeled real photo in the calibration
corpus against its own true work type; the **lowest score any genuine photo
has ever gotten is 0.372** (an interior classroom shot with no exterior
building cues). `SEMANTIC_MATCH_SEVERE_THRESHOLD` (0.10) sits well clear of
that — a score below it isn't an ambiguous scene, it's categorically not the
claimed subject. Below 0.10, `CONTENT_MISMATCH_SEVERE` (HIGH, 65 points, on
its own comparable to an exact duplicate match) replaces `CONTENT_MISMATCH`
(MEDIUM, 25 points). If you move either threshold, re-run
`TestZeroShotAccuracy` against the real corpus first — the gap this relies on
is a property of the measured data, not of the code.

EXIF-stripped uses **contextual weighting**, not a fixed weight: WhatsApp,
most web upload forms, and many CMS pipelines strip EXIF automatically, so
treating every EXIF-less submission as equally suspicious causes alert
fatigue on a large share of legitimate uploads. Implemented as a general
mechanism (`app/config.py`'s `CONDITIONAL_FLAG_WEIGHTS`, resolved in
`app/risk_engine.py`'s `_resolve_conditional_flags()`), not a special
case — any flag code listed there gets an "alone" vs "with_others" weight
instead of a single static one.

---

## Validation

The evaluator now selects the corpus and matching manifest together, retains
fraud-source photographs in the baseline only for duplicate cases, keeps
metadata-only case sources isolated, preserves filename-derived work labels,
and treats stronger equivalent findings such as `GEOMETRIC_DUPLICATE` and
`CONTENT_MISMATCH_SEVERE` as valid detections.

Current real-corpus command:

```bash
python -m scripts.evaluate_detection --clip --corpus real
```

Measured 2026-08-30 on 10 planted real-photo fraud transformations and six
disjoint real-photo controls:

| Metric | Result |
|---|---:|
| Detection rate | **10/10 (100.0%)** |
| Severity accuracy | **10/10 (100.0%)** |
| False-positive rate | **0/6 (0.0%)** |

These are regression results on a small planted corpus, not a production
accuracy claim. The corpus still needs substantially more field submissions,
negative landmark/stock examples, devices, districts and every work category.
Synthetic `clean_*` results remain useful only for deterministic hash/EXIF
regressions and must not be used to calibrate ML false-positive rates.

Current complete suite: **271 passed**, including the real SigLIP checkpoint,
the real CLIP checkpoint, and the full-model real-corpus acceptance test.

### Historical validation notes

`pytest tests/` (full suite, including `@slow` and `@requires_clip`):
**115 passed, 1 failed, 1 skipped.**

- `test_detection_rate_meets_acceptance_bar` — **still fails**, unrelated
  to the corpus work below: the measured detection rate (88.9%) is below
  its 90% bar, entirely due to the already-diagnosed `cropped_duplicate`
  algorithm limitation (see below). Not touched — lowering the bar or
  the pHash threshold to pass this artificially would hide the exact
  gap this test exists to catch.
- `test_same_scene_different_angle` — **now skips honestly** instead of
  passing on a technicality. `data/real_images/pairs/` used to contain
  crop-simulated "pairs" (one real photo, cropped, saved as a second
  file) left over from the corpus rebuild described in "Calibration"
  below; those were removed rather than kept as a fake pass, so this
  test now reports exactly what's missing (3 genuine same-scene photo
  pairs) instead of quietly validating against a crop.
- `test_correct_zero_shot_label` / `test_incorrect_zero_shot_label` —
  **fixed, now pass**. Both used to assume `real_images[0]` (whatever
  sorted first) depicted `WORK_TYPES[0]` ("road construction"). That
  broke as soon as the corpus was labeled by actual content instead of
  index-cycling: the alphabetically-first file turned out to be a real,
  correctly-labeled bridge photo, and CLIP correctly scored it low for
  "road construction" (0.51). The fix wasn't to pick a different single
  file to assume — that's the same fragility one level down — it's to
  check every labeled photo's confidence for its own true type and
  require most (measured: 15/20, 75%) to clear the bar, tolerating the
  couple of genuinely ambiguous photos in a small real corpus (an
  interior classroom shot with no exterior building cues; a
  decorative potted-flower garden display rather than a park scene)
  without letting one hard case fail the suite.

Getting the suite to actually run this far required fixing several bugs
left over from the MongoDB migration that a fresh run surfaced for the
first time (previously masked by `app/main.py`'s syntax error, which
kept pytest from even collecting some test files): a stale SQLAlchemy
call (`session.query(District)...`) in `risk_engine.py`'s district
lookup that had never been converted to PyMongo, Mongo documents'
`_id` (a `bson.ObjectId`) not being coerced to `str` before validating
against the Pydantic models, several test fixtures with copy-paste
errors from an automated migration pass, and `evaluate_detection.py`'s
own throwaway test database, which still built a SQLAlchemy SQLite
engine that no longer exists in this project's dependencies at all.

**⚠ Every number below is measured against the project's SYNTHETIC test
corpus (`data/images/clean_*.jpg` — programmatically generated gradients
and shapes), not real photographs.** `data/real_images/` does not yet
have the 30 photos / 3 same-scene pairs / 10 geotagged photos
`scripts/calibrate_thresholds.py` requires (see its own validation
output — it refuses to run and states exactly what's missing rather than
silently substituting synthetic images). **These synthetic numbers must
be replaced with real-corpus numbers before this module is trusted for
anything beyond development** — see "Known limitations" below for a
concrete example of where synthetic and real-world behaviour already
diverge measurably (CLIP false positives).

### Three separate metrics, not one

A severity change (e.g. a case moving from MEDIUM to HIGH) is not the
same thing as a detection change (a flag that previously never fired at
all) — collapsing them into one number hides which one actually
happened. `evaluate_detection.py` reports three:

| Metric | Definition |
|---|---|
| **Detection rate** | Expected flag code appears in the actual flags |
| **Severity accuracy** | Case's risk LEVEL matches its manifest `expected_risk_level` |
| **False positive rate** | Held-out clean images (never added to the baseline) that raise any flag above LOW |

Cases that can only be caught by a disabled layer (currently: CLIP →
`content_mismatch`) are reported as **SKIPPED**, not FAILED, and excluded
from both the detection and severity denominators — conflating "cannot
run" with "ran and failed" would understate what the hash/EXIF layers
catch on their own and overstate what enabling CLIP needs to fix.

### Historical synthetic-corpus results (not current production evidence)

Re-measured 2026-08-27, after ELA (Layer 4) and OCR (Layer 5) were wired
into `risk_engine.py` and the MongoDB migration replaced the SQLite
backend `evaluate_detection.py` used to build its throwaway test
database against (see "In progress, now completed" note below) —
detection rate and severity accuracy are unchanged from the original
numbers; the false-positive rate is not, for a newly-understood reason.

| Metric | Without CLIP | With CLIP |
|---|---|---|
| Detection rate | **9/9 applicable (100.0%)** — the dHash fallback now catches the cropped case; `content_mismatch` is skipped because it requires CLIP | **9/10 (90.0%)** |
| Severity accuracy | **8/9 applicable (88.9%)** | **7/10 (70.0%)** |
| False positive rate | **3/3 (100.0%)** — was 0/3 before ELA; see explanation below, this is NOT a real production number | **3/3 (100.0%)** — see explanation below, this is NOT a real production number |

The no-CLIP detection miss is resolved for the fixture corpus: the
12%-off-every-edge `cropped_duplicate` case now matches through dHash. The
CLIP column still reflects the last recorded model run and should be
regenerated after the scoring-policy change.

**Why false positives jump to 100% with CLIP on this corpus:** measured
directly (not assumed) — pairwise CLIP cosine similarity between the
synthetic `clean_*.jpg` images ranges **0.83–0.97**, comfortably above
`EMBEDDING_SUSPICIOUS_THRESHOLD` (0.85) and often `EMBEDDING_DUPLICATE_THRESHOLD`
(0.92) too. CLIP considers all of these programmatically-generated
gradient/shape images near-identical to each other — this is concrete
proof that synthetic images are unusable for CLIP threshold validation,
not a bug in the detection logic. It will only mean something once
measured against real photographs (Task 3.2 below).

**Why the false positive rate is now 100% even *without* CLIP:** ELA's
screenshot check (`SCREENSHOT_DETECTED`) fires on every held-out clean
image — `std_error` measures 2.0–2.5 against
`ELA_UNIFORMITY_THRESHOLD=5.0` (see `app/ela_analysis.py`'s docstring:
"unnaturally uniform error levels ... indicate the image was generated,
not photographed"). This is the same root cause as the CLIP case above,
not a new bug: `data/images/clean_*.jpg` are programmatically-generated
gradients, which recompress with almost perfectly uniform JPEG error —
exactly the signature this check is designed to catch, applied to a
corpus that technically *is* generated rather than photographed. It is
correctly doing its job on data it was never meant to be judged against.
**The threshold was deliberately left untouched** for the same reason
the pHash thresholds were in the crop case below — nudging
`ELA_UNIFORMITY_THRESHOLD` down to pass this corpus would weaken real
screenshot detection with no evidence it's even miscalibrated for actual
camera photos. This will only mean something once measured against real
photographs, same as CLIP.

### Diagnosis: how `cropped_duplicate` is recovered

Measured values (from `evaluate_detection.py`'s built-in diagnosis,
which classifies every failure as a **bug**, a **threshold problem**, or
an **algorithm limitation** before anything gets changed):

```
pHash distance=34 (PHASH_DUPLICATE_THRESHOLD=5, PHASH_SUSPICIOUS_THRESHOLD=10)
dHash distance=3
rotation-robust min distance=30
```
The crop still removes enough global structure that pHash cannot see the
signal (distance 34), even hashing rotated variants and taking the minimum
distance. The independent dHash sees the local structure (distance 3), so
the unified Layer 2 search now retains it as a duplicate-tier match using
`DHASH_DUPLICATE_THRESHOLD=3`. The global pHash threshold remains unchanged;
raising it would broaden false positives on every other case.

Two mitigations were investigated:

1. **Tiled hashing** (3×3 overlapping-tile pHash voting, `ENABLE_TILED_HASH`,
   default `False`) — implemented as the narrowest possible additional
   check, but **measured not to help**: per-tile Hamming distances stay
   at 20–40/64 bits regardless of overlap percentage (tried 15/30/50/70%),
   position-aligned vs. all-pairs matching, or square vs. rectangular
   tiles. Root cause: a small tile has far less redundant low-frequency
   structure than a whole image, making per-tile pHash MORE sensitive to
   a crop's registration shift, not less. The matching mechanism itself
   is correct (directly unit-tested); the tiling geometry just doesn't
   solve this problem yet. Kept in the codebase, off by default, as a
   documented negative result and a base for future iteration — not
   presented as a fix. See `tests/test_tiled_hash.py`.
2. **CLIP (Layer 3)** — also catches this case: cosine similarity between
   the original and the cropped fraud case is **0.923**. With the current
   `EMBEDDING_SUSPICIOUS_THRESHOLD=0.85` and
   `EMBEDDING_DUPLICATE_THRESHOLD=0.95`, this is correctly treated as a
   `SEMANTIC_SUSPICIOUS` review signal rather than a high-confidence
   `SEMANTIC_DUPLICATE`. The manifest still counts it as a Layer 2
   detection case, so it remains useful corroborating evidence rather than
   being allowed to inflate the risk score on its own.

### Calibration (blocked again — but for a real reason this time)

`scripts/calibrate_thresholds.py` measures the actual separation between
pHash/CLIP-cosine distributions on real photographs and recommends
threshold values with their implied false-positive rate — it never edits
`app/config.py` itself. It refuses to run against a partial or synthetic
corpus.

**The previous "35/30, corpus OK" result in this section (and every
threshold number that came from it) has been retracted, not just
superseded.** That corpus wasn't just narrow — investigating it for a
follow-up task found it was 35 random images from Lorem Picsum (a
placeholder-image API: landscapes, abstract art, anything — not
infrastructure), labeled by arbitrary index-cycling, with **GPS EXIF
fabricated via `piexif`** specifically to satisfy the corpus gate below.
It passed every automated check while measuring nothing real. See
`data/real_images/README.md` for the full account.

The corpus has since been rebuilt from real, individually-verified
Wikimedia Commons photographs — correctly labeled by what they actually
depict, with genuine (not fabricated) EXIF — but is honestly smaller as
a result, and the gate correctly refuses to proceed:

```
REAL-PHOTO CORPUS VALIDATION
  Count:          20 / 30 required
  Same-scene pairs: 0 / 3 required
  Images with EXIF GPS: 4 / 10 required
CORPUS INADEQUATE — stopping.
  - Count: need >= 30 images, found 20 (10 more needed).
  - Pairs: need >= 3 same-scene pairs, found 0 (6 more photos needed, as 3 pairs).
  - EXIF+GPS: need >= 10 images carrying GPS in EXIF, found 4 (6 more needed).
```

This is real progress, honestly reported as incomplete rather than
padded to pass: 20 photos across 8 of 10 work types (`drainage` and
`water_facility` are entirely missing — every Commons candidate for
those two failed to download before hitting Wikimedia's rate-limit/
robot-policy block; nothing was faked in to hide the gap), spanning 9
distinct real devices (Nikon, Sony, Canon, OPPO, Xiaomi, ASUS, HP,
Nokia phones/cameras — verified from actual EXIF, not the search
metadata), with 4 photos carrying genuine GPS coordinates confirmed via
`app.exif_analysis.extract_gps()` (not merely a non-empty `GPSInfo` tag
— 3 more candidates had that but no actual coordinates inside it, and
don't count). Full provenance — title, license, source URL — for every
file is in `data/real_images/corpus_manifest.json`.

**No threshold recommendation exists to act on right now** — the tool
correctly won't produce one until the corpus clears its own bar. See
`data/real_images/README.md` for the exact remaining gap and what
finishing this corpus requires (10+ more photos, especially for
`drainage`/`water_facility`; 3 genuine same-scene pairs; 6+ more
GPS-tagged photos) and why automated collection stopped where it did.

To re-run once the corpus is complete:
```bash
python -m scripts.calibrate_thresholds --mode all
python -m scripts.evaluate_detection --no-clip --corpus real --clean-images-dir data/real_images
```
and replace every number in this section with the result — per this
project's own rule, real numbers replace placeholder/invalid ones
everywhere they were used, they are not reported side-by-side as if
both were equally valid.

### Per-layer latency (n=10, real photos, re-measured 2026-08-27)

| Stage | Mean latency |
|---|---|
| Hashing only (SHA-256 + pHash + dHash) | 14.9 ms |
| EXIF only | 0.4 ms |
| CLIP embedding only | 97.1 ms |
| **Full pipeline** (`assess_image()`, CLIP enabled) | **552.4 ms** |

The full-pipeline figure now also includes ELA (Layer 4), which was not
in the pipeline when the previous numbers were recorded.

CLIP embedding alone (90.6ms) is well under the ~800ms guideline for
staying on the request path. The full pipeline is substantially higher
than the sum of its parts — it also runs CLIP's zero-shot content-match
(a second forward pass against 4 text labels) and the perceptual/semantic
duplicate database scan, neither of which the isolated benchmarks above
include. If this grows with corpus size (brute-force O(n) search, see
"Scaling to Production" below) or CLIP's contribution alone crosses
~800ms/image on a slower CPU, move CLIP inference to an async background
worker rather than the request path.

### Known limitations

Stated plainly, with the measured evidence behind each one — not a
generic disclaimer:

- **Crops beyond ~10% per edge defeat BOTH hash layers entirely**.
  Corrected 2026-08-29 — the previous wording here claimed dHash caught
  the 12% crop at distance 3. That was measured on the *synthetic*
  gradient fixture (`clean_0000.jpg`) and does not hold on real
  photographs. Measured on `data/real_images/` (n=20, crop % is per
  edge, "caught" = within the layer's SUSPICIOUS threshold):

  | crop | pHash | dHash | CLIP |
  |---|---|---|---|
  | 5%  | 15/20 | 7/20 | 20/20 |
  | 10% | 1/20  | 0/20 | 20/20 |
  | 12% | 0/20  | 0/20 | 19/20 |
  | 20% | 0/20  | 0/20 | 18/20 |
  | 30% | 0/20  | 0/20 | 11/20 |
  | 40% | 0/20  | 0/20 | 5/20  |

  dHash collapses at essentially the same crop severity as pHash on real
  photographs (median distance 22/64 at a 12% crop, vs. its threshold of
  6) — it is a genuinely independent opinion on *recompression* and
  *colour* changes, not on cropping. **From ~10% onward CLIP is the only
  hash-independent layer still detecting anything**, so a deployment
  running with `ENABLE_CLIP=False` has no crop robustness beyond ~5%.

  **→ FIXED 2026-08-29 (Layer 6, `ENABLE_KEYPOINT_MATCH`)**, and — after
  a second pass — **without any CLIP dependency**. Switched from ORB to
  SIFT descriptors, which are far more discriminative (128-float vs
  256-bit binary), so matches survive even extreme crops. SIFT keypoint
  verification catches **20/20 at EVERY crop severity tested — 20%,
  30%, 35%, 40%, 45%, 50%, and 60% per dimension** (that last one
  removes 84% of the frame area), at a measured **0/190** false-positive
  rate on real photos and **0/36** on synthetic ones. Works with
  `ENABLE_CLIP=False`: candidate retrieval runs off a colour-histogram
  signature, not the CLIP embedding — see "Closing the crop gap" below.
  Trade-off: SIFT features are ~13x larger per record (~762 KB vs
  ~59 KB) because of the richer descriptors; extraction is slightly
  faster (~23 ms vs ~50 ms).

- **Rotation beyond ±5°**: `ENABLE_ROTATION_ROBUST_HASH` only hashes at
  −5°/0°/+5°. Measured 2026-08-29 on real photos: rotation-robust pHash
  catches 19/20 at 7° but collapses to 11/20 at 10° and **0/20 at 15°
  and beyond**.

  **→ FIXED 2026-08-29 (Layer 6), with no residual.** SIFT descriptors
  are scale- and orientation-normalised, and geometric verification
  measured **20/20 at every angle tested — 3°, 7°, 10°, 15°, 30°, 90°**
  — with RANSAC inliers well above the match threshold of 15, and
  still 20/20 after the anti-coincidence gates were added. Verified to
  work with `ENABLE_CLIP=False` (`test_rotation_is_caught_with_clip_disabled`).
- **Large viewpoint change on the same site (CLIP, Layer 3)**: measured
  2026-08-29 against `data/real_images/pairs/`. Same scene with a
  *moderate* angle change is caught reliably — four visually-verified
  pairs score 0.9263–0.9508 cosine, all above the calibrated
  `EMBEDDING_DUPLICATE_THRESHOLD` of 0.90, against a different-image
  distribution (n=190) whose maximum is 0.8624. But the same garden shot
  10 seconds apart with the camera *panned substantially*
  (`scene1_a.jpg` vs `scene1_c_wide.jpg`) scores **0.8355 — below that
  0.8624 different-image maximum**, i.e. below two genuinely unrelated
  sites (a bridge and a road). The two distributions overlap there, so
  **no threshold separates them**: catching that pair would mean
  accepting false positives on unrelated works. Layer 3 catches a
  re-used photo shot from a nearby angle, not one shot from across the
  site. Asserted as a standing test
  (`test_large_viewpoint_change_is_a_known_gap`) so a future model or
  threshold that closes the gap produces a visible signal.
  *(This also corrected a real miscalibration: the previous 0.95
  threshold was a guess and caught only 1 of the 4 true pairs — the
  layer was largely inert on the exact case it was added for.)*

  **→ PARTIALLY closed by Layer 6 (2026-08-29)**: the wide pair CLIP
  cannot separate (`scene1_a` ↔ `scene1_c_wide`, cosine 0.8355) scores
  **18 RANSAC inliers** — above the 15-inlier match threshold, while
  cross-scene pairs max out at 4 (n=30). ORB catches this specific
  re-framing where no CLIP threshold can. But it is genuinely partial:
  the even-wider `scene1_b` ↔ `scene1_c_wide` scores only 4 inliers —
  ORB's homography model assumes a mostly-planar scene or modest
  parallax, and a large 3D viewpoint shift breaks it. A photo re-shot
  from across the site remains undetectable by every layer; the CLIP-gap
  standing test stays in place.
- **AI-generated imagery — NOT FIXED, and not fixable within this
  module's approach**: no detection layer here tests *authenticity*.
  Hash layers key on pixel structure (a generated image has its own,
  internally consistent structure, not a "tell"), CLIP's zero-shot check
  tests *content* match, and ELA/keypoint layers compare against
  *stored* images — a freshly generated fake matches nothing and
  triggers nothing. A dedicated AI-image detector was deliberately not
  bolted on: published detectors generalise poorly across generator
  families, degrade with every new model release (an adversarial
  arms race this module cannot win from inside), and would import a
  false-positive burden this project has no corpus to measure. The
  honest mitigation is capture-side provenance, which the platform
  already implements: the native-camera upload flow, single-use session
  tokens, live device GPS, and EXIF checks make *submitting a
  pre-generated file through the controlled path* the hard step —
  post-hoc pixel forensics is the wrong layer to fight this at.
- **Photos of a printed photograph / a screen — partially addressed,
  half-verified**: the `PHOTO_OF_PHOTO` moiré detector (FFT frequency
  analysis in `app/ela_analysis.py`) exists for exactly this case, and
  its false-positive side is now measured: **0/29** genuine camera
  photos misfire (2026-08-29, real corpus). Its TRUE-positive side —
  does it actually fire on a real photo of a screen or print? — remains
  unverified, because no such fixture exists in the corpus and
  simulating one (re-encoding a photo) would test the simulation, not
  the moiré physics. Cannot be verified further without someone
  photographing an actual screen/print and adding the file; until then
  this stays a limitation with one honest half measured. Note also that
  Layer 6 now *helps* here for the re-use case: a photo-of-a-photo of an
  already-stored image preserves scene geometry, so ORB verification
  can catch it as a `GEOMETRIC_DUPLICATE` even when hashes miss —
  but that too is untested without a real fixture.
- **Images with no EXIF and no duplicate match — NOT FIXED, and not
  fixable by design**: correctly scored LOW (5 points, `EXIF_STRIPPED`
  "alone" branch) rather than treated as suspicious on its own. A
  genuinely fraudulent but *first-time* photo — EXIF-less, never
  submitted before, plausibly depicting the claimed work type — leaves
  **no signal in any layer this module has or could add**: there is
  nothing to compare it against and nothing internally inconsistent
  about it. Flagging it anyway means flagging every legitimate EXIF-less
  upload, i.e. the alert-fatigue failure the conditional EXIF weighting
  exists to prevent. The mitigation is process-side, not detector-side,
  and is already the platform design: the controlled capture flow
  (native camera + single-use session token + live device GPS) makes
  it hard to *get* a fraudulent stock/off-site photo through the upload
  path in the first place, and human review remains the decision-maker
  for everything the detectors cannot see.
- ~~ELA screenshot detection~~ — **RESOLVED 2026-08-29 by disabling a
  measurably broken check.** The earlier note here assumed the 100%
  false-positive rate on the synthetic corpus was the check "correctly
  identifying rendered gradients" and that real-world impact was
  unmeasured. Now measured: it fired on **29/29 real camera
  photographs** too. The distributions fully overlap (real photos:
  mean_error 0.14–2.91, std 0.48–2.44; actual screenshots: mean
  0.19–0.70, std 0.83–1.14) because a modern phone JPEG re-saves as
  losslessly as a rendered image — ELA uniformity carries no
  screenshot signal at all, and no threshold can fix that.
  `SCREENSHOT_DETECTED` is now gated behind
  `ENABLE_SCREENSHOT_DETECTION` (default **False**) with the
  measurement recorded in `app/config.py`; a standing test asserts the
  gate. `IMAGE_TAMPERED` and `PHOTO_OF_PHOTO` are unaffected — **0/29**
  false positives each on the same real corpus. Screenshot-style
  re-submission of an already-stored photo is still caught, by the
  duplicate layers (a screenshot of a stored image preserves both its
  CLIP embedding and its scene geometry).
- ~~OCR amount cross-check (`RECEIPT_AMOUNT_MISMATCH`) cannot currently
  fire~~ — **fixed 2026-08-27**. `claimed_amount` is now a parameter on
  `assess_image()` and a form field on both `/api/images/check` and
  `/api/images/submit` (also documented on the otherwise-unused
  `ImageSubmitRequest` schema for consistency); `risk_engine.py`'s Step
  5.2 passes it straight through to `analyse_receipt()` instead of a
  hardcoded `None`, and the flag's evidence now includes the claimed
  amount alongside the OCR-extracted ones. Verified at both levels: unit
  tests confirm `assess_image()` actually forwards the value to
  `analyse_receipt()` (`tests/test_risk_engine.py::TestOCRAmountWiring`),
  and a live `TestClient` call through `/api/images/check` with a real
  multipart form field confirms the string-to-float form parsing and
  the full call chain end-to-end.

### Closing the crop gap — implemented as Layer 6 (`ENABLE_KEYPOINT_MATCH`, default True)

SIFT keypoint matching with RANSAC geometric verification, prototyped and
calibrated against the real corpus on 2026-08-29, now runs in the live
pipeline: `app/keypoint_match.py` (extraction, serialization,
verification), retrieval wiring in `app/duplicate_search.py`
(`find_geometric_duplicates`), scoring in `app/risk_engine.py`
(`GEOMETRIC_DUPLICATE`, HIGH, 50 points, strongest-cross-work-only —
same anti-stacking convention as the semantic layer), and feature
persistence on every stored record (`ImageRecord.orb_features` ~762 KB,
plus `ImageRecord.color_signature` 512 B). It runs retrieve-then-verify:
a cheap signature nominates the top-K nearest stored images
(threshold-free — the whole point is candidates whose similarity has
already sunk below every normal band) and SIFT verifies only those, so
the extraction cost is paid once per upload, not per comparison. A
record verified geometrically supersedes its own semantic match, so one
re-used photo is never scored by two layers. Tests:
`tests/test_keypoint_match.py` (22 tests, including the CLIP-disabled
crop and rotation paths and adaptive top-K scaling).

Originally used ORB (binary descriptors), but switched to SIFT on
2026-08-29 after measuring that ORB's 256-bit binary descriptors lose
too many matches on heavy crops (17/20 at 45% per-dim, 16/20 at 60%).
SIFT's 128-float descriptors are far more discriminative: matches survive
even when most of the frame is gone.

Measured on 20 real photos, crops per dimension, final gated
configuration:

| transform | SIFT (current) | ORB (previous) |
|---|---|---|
| crop 20% | **20/20** | 19/20 |
| crop 30% | **20/20** | 20/20 |
| crop 35% | **20/20** | 19/20 |
| crop 40% | **20/20** | 19/20 |
| crop 45% | **20/20** | 17/20 |
| crop 50% | **20/20** | 16/20 |
| crop 60% | **20/20** | 16/20 |
| rotate 15° | **20/20** | 20/20 |
| rotate 30° | **20/20** | 20/20 |
| rotate 90° | **20/20** | 20/20 |

(pHash and dHash catch **0/20** at every row in this table.)

**False positives: 0/190** real different-image pairs and **0/36**
synthetic ones, with SIFT. The two hardest false-positive pairs — same
park from different angles (35 inliers, ratio 0.574) and a park vs road
(19 inliers, ratio 0.559) — are cleanly rejected by the 0.60 ratio gate.

**Retrieval does not depend on CLIP.** Candidates come from the **union**
of two independent signatures:

- **Colour signature** (`compute_color_signature`) — a coarse 8×4×4 HSV
  histogram, 512 bytes, no model required. Cropping or rotating a photo
  barely changes its colour distribution, so it survives exactly the
  transformations this layer targets. Measured recall of the true source
  at top-10: **29/29 for every transform tested**, including a 40% crop.
- **CLIP embedding cosine**, when CLIP is enabled — better at semantic
  near-misses, so it contributes candidates the histogram would miss.

A training-free bag-of-visual-words over the ORB descriptors was
measured as an alternative retrieval index and **rejected**: it ranks
slightly better on mild crops but collapses on heavy ones (3/29 @1,
9/29 @5 at a 40% crop), because losing 40% of the frame loses 40% of the
descriptors. The colour histogram degrades far more gracefully.

Retrieval is deliberately imprecise — it *will* nominate unrelated
photos. RANSAC verification supplies the precision.

**Adaptive top-K scaling.** Recall@K was originally measured on a
29-image corpus where top-10 covers ~34% — an easy target. On a corpus
of thousands, a fixed K=20 covers <1%, and a coarse 128-bin histogram
can't reliably rank the true source that high among thousands of images
with similar colour palettes (dozens of road construction photos are
all grey asphalt + brown dirt). This is now handled by adaptive scaling:
`K = max(ORB_RETRIEVAL_TOP_K, ceil(sqrt(n)))`, capped at
`ORB_RETRIEVAL_MAX_K` (default 500). At n=10,000 K=100 (~230ms of
verification); at n=100,000 K=317 (~730ms). The heuristic is
conservative but unmeasured at scale — true recall@K on a corpus of
thousands would need >1,000 real MPLADS photos to test.
`ORB_RETRIEVAL_MAX_K` can be raised if detection rates drop.

**Three gates, all measured.** SIFT measured separation (n=20 true
40%-crops, 190 different-image pairs):

| | true crops | false pairs |
|---|---|---|
| min features (weaker side) | min **204** | all > 500 |
| inlier ratio | min **0.828**, median 0.94 | max **0.574** |

A match requires ≥100 keypoints on both sides (`ORB_MIN_FEATURES_FOR_MATCH`),
≥15 RANSAC inliers, and an inlier **ratio** ≥0.60 — a genuine crop
agrees on nearly every correspondence it offers; a coincidental fit
agrees on a minority. The 100-feature threshold (lowered from 750 for ORB)
reflects SIFT's higher per-descriptor discriminativeness. On a low-texture
image (a plain wall, heavy fog) the layer abstains rather than guessing.

**Cost and storage.** ~23 ms/image SIFT extraction, ~50 ms for the
colour signature, ~2.3 ms/pair verification — extraction is paid once
per upload, not per comparison. SIFT features serialize to ~762 KB/record
(~13× the old ORB encoding, ~380× a CLIP embedding). This is the cost of
SIFT's richer 128-float descriptors vs ORB's 32-byte binary ones.
Detection coverage at heavy crops is the product — the storage trade-off
is measured and deliberate.

No new dependency: OpenCV 5.0 is already installed transitively via
`easyocr` and pinned in `requirements.lock`.


---

## Roles

Every account has one of four roles. `POST /api/auth/register` (public
self-registration) **always** creates a `submitter` — there is no field
on its request body to ask for anything else. The other three are
provisioned by an admin via `POST /api/admin/users`, or by
`scripts/create_user.py` to bootstrap the very first admin before any
admin account exists to log in with:

```bash
python -m scripts.create_user --username district_admin --password <pw> \
    --role admin --agency-name "MPLADS System Administration" --district Pune
```

| Role | Who it models | What it does |
|---|---|---|
| `submitter` | Field agency officer | Uploads work-completion photos; sees **only their own** submissions and their review status |
| `reviewer` | District/Nodal Verification Officer | Claims submissions from a shared queue, approves/rejects with a note |
| `stakeholder` | Oversight body (district authority / MP office / bank) | Read-only dashboard + reports, plus the **final sign-off** that releases payment |
| `admin` | System administrator | User management, every submission, manual status override (single + bulk), activity log |

A JWT carries its account's role, and `app/auth.py`'s `require_role()`
gates each route. Deactivating an account (`is_active`) blocks login
**and** invalidates any already-issued token on its next request —
tokens live 24h, so checking only at login would leave a deactivated
account working for up to a day.

### Workflow statuses

`PENDING_REVIEW → IN_REVIEW → APPROVED → SIGNED_OFF`, with `REJECTED`
as a terminal branch off review. A reviewer's decision and a
stakeholder's sign-off are **separate** confirmations — sign-off is
only reachable from `APPROVED`, and a rejected submission has no
sign-off step because there is nothing left to release. Each role's
action on a record is stored in its own attributable fields
(`reviewed_by_*`, `signed_off_by_*`, `admin_override_*`) rather than
overwriting the previous one, and the automated `risk_score`/`flags`
snapshot is never edited by a human — reviewer notes sit beside the
evidence, not on top of it.

## API Endpoints

Every endpoint except `/health`, `/api/auth/register`, and
`/api/auth/login` requires a bearer token. The **Roles** column is the
enforced gate, not a suggestion.

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Self-register (always creates a `submitter`) |
| `POST` | `/api/auth/login` | — | Exchange username/password for a JWT (response includes `role`) |
| `GET` | `/api/auth/me` | any | The caller's own profile + role — what the frontend routes on |
| `GET` | `/health` | — | Liveness + CLIP status |
| `POST` | `/api/images/check` | submitter, admin | Upload + assess (dry run, not stored) |
| `POST` | `/api/images/submit` | submitter, admin | Upload, assess, and store; consumes a one-time camera-session token if provided |
| `GET` | `/api/images/mine` | any | The caller's own upload history |
| `GET` | `/api/images/{work_id}` | any | Images for a work ID — a submitter sees only their own; oversight roles see all |
| `GET` | `/api/duplicates` | reviewer, stakeholder, admin | All detected duplicate clusters |
| `GET` | `/api/stats` | reviewer, stakeholder, admin | Aggregate statistics |
| `POST` | `/api/sessions/create` | any | Mint a one-time camera-session token |
| `POST` | `/api/sessions/validate` | any | Check whether a camera-session token is still valid/unused |
| `GET` | `/api/reviews/queue` | reviewer | Submissions awaiting a decision, highest risk first |
| `GET` | `/api/reviews/history` | reviewer | Submissions that reached a decision |
| `GET` | `/api/reviews/ai-summary` | reviewer | LLM-drafted briefing of the current queue (see `/api/stakeholder/ai-summary` for the availability contract) |
| `POST` | `/api/reviews/{image_id}/claim` | reviewer | `PENDING_REVIEW` → `IN_REVIEW`; `409` if another reviewer holds it |
| `POST` | `/api/reviews/{image_id}/decide` | reviewer | Approve/reject with a note (notes **required** to reject) |
| `GET` | `/api/stakeholder/overview` | stakeholder | Volume, bottlenecks, completion rate, time-to-decision |
| `GET` | `/api/stakeholder/ai-summary` | stakeholder | LLM-drafted narrative of the overview figures (requires `GEMINI_API_KEY`; answers `available: false`, never an error, when unset or the call fails) |
| `GET` | `/api/stakeholder/submissions` | stakeholder | Fully processed submissions (the report table) |
| `POST` | `/api/stakeholder/{image_id}/sign-off` | stakeholder | Final sign-off; only valid from `APPROVED` |
| `POST` | `/api/admin/users` | admin | Create a user with any role |
| `GET` | `/api/admin/users` | admin | List all users (never returns `password_hash`) |
| `PATCH` | `/api/admin/users/{user_id}/role` | admin | Change a user's role |
| `PATCH` | `/api/admin/users/{user_id}/active` | admin | Activate/deactivate (can't deactivate yourself) |
| `GET` | `/api/admin/submissions` | admin | Every submission, unfiltered |
| `POST` | `/api/admin/submissions/{image_id}/override-status` | admin | Manual status correction, recorded as its own audit event |
| `POST` | `/api/admin/submissions/bulk-override-status` | admin | The same override applied to many submissions at once |
| `GET` | `/api/admin/activity` | admin | Recent submit/review/sign-off/override events |
| `GET` | `/api/admin/ai-summary` | admin | LLM-drafted operations note: accounts, statuses, last-7-days events (same availability contract) |

### Where location comes from, and what it proves

The district-distance check uses **EXIF GPS when the image carries it,
and the submitting device's browser location (`navigator.geolocation`,
sent as `captured_latitude`/`captured_longitude`) when it doesn't.**
Most legitimate upload paths — WhatsApp, web forms, in-browser canvas
capture — strip EXIF entirely, so an EXIF-only check simply never ran
for them. `GPS_MISSING` now means "no location from either source",
and every `GPS_DISTRICT_MISMATCH` records which source it used in
`evidence.coords_source`.

**Neither source is proof.** EXIF GPS can be written by anyone with
`piexif` (this project's own retracted calibration corpus did exactly
that — see the Calibration section), and browser coordinates are
supplied by the client and can be overridden in devtools or by a mock
location provider. They raise the cost of a false location claim; they
do not verify one. Genuine capture attestation needs a native app with
Play Integrity / App Attest, which this module does not have.

The upload UI offers **"Take a photo"** (a file input with
`capture="environment"`, which opens the phone's rear camera) alongside
**"Choose from device"**. The native camera path is deliberate: an
in-page `getUserMedia` + `<canvas>` capture produces a JPEG with **no
EXIF at all**, so every honest in-app photo would arrive stripped of
the camera model, timestamp and GPS the detection layers depend on —
and would trip `EXIF_STRIPPED`. The native camera returns a real camera
JPEG with its metadata intact. On desktop, `capture` is ignored and the
button falls back to an ordinary file picker.

### GPS accuracy is used, not just collected

`navigator.geolocation` reports GPS-chip (~5–20 m), WiFi (~20–100 m),
cell-tower (~0.5–5 km), and **IP geolocation** (routinely 10–100+ km,
and can resolve to an ISP hub in a different city) through the
identical API — a desktop submitter, or a phone that denied precise
location, can trigger any of them. The browser also reports an
`accuracy` radius (metres) alongside the coordinates, and the district
check uses it two ways:

- A fix coarser than `GPS_DEVICE_MAX_ACCURACY_M` (50 km, matching
  `GPS_MAX_DISTANCE_KM` — once uncertainty is as large as the whole
  tolerance, the fix carries no information about the question being
  asked) is **discarded outright**, treated as if no device location
  had been reported at all, rather than compared to the district.
- A usable fix's own accuracy is **subtracted from the measured
  distance** before comparing to the threshold — a fix reporting "52 km
  away, ±10 km" could genuinely be 42 km away, so it is not accused of
  being outside the district. This only ever reduces the effective
  distance, never manufactures a flag; `GPS_DISTRICT_MISMATCH`'s
  evidence always includes the raw `distance_km`, the `accuracy_km`
  applied, and the resulting `effective_distance_km` together, so a
  reviewer sees the reasoning, not just the verdict.

This only applies to the device-location fallback — EXIF GPS carries
no comparable accuracy figure and is never adjusted.

**Known limitation, not yet fixed:** `GPS_MAX_DISTANCE_KM` (50 km) is
one global radius from a district *centre point*, never empirically
calibrated (`scripts/calibrate_thresholds.py` covers pHash and CLIP
only). Several real districts exceed it — Pune's equivalent radius is
~70 km, Nagpur ~56 km, Jaipur ~60 km — so a genuine photo at the edge
of one of those can still be flagged. It is simultaneously far too
loose for small districts (Chennai's equivalent radius is ~12 km).
Fixing this properly needs district boundary polygons, or at minimum a
per-district radius, not one number for every district.

### Auth + camera-session anti-fraud gate

`/api/images/submit` requires a JWT bearer token (`app/auth.py`) — get
one via `/api/auth/register` then `/api/auth/login`. Separately, a
field agency can call `/api/sessions/create` to mint a **single-use**
camera-session token immediately before taking a photo; passing that
token's value as `session_token` on `/api/images/submit` consumes it,
and a second submit reusing the same token is rejected with
`400 Session token already used`. The intent: make it harder to submit
an old photo pulled from a gallery instead of one taken live for this
specific work — the token only exists because a session was freshly
created, and it can't be replayed. Session state (`users`, `sessions`)
lives in the same MongoDB Atlas database as image records (see
Database below); see `tests/test_auth_and_sessions.py` for the full
register → login → create → submit → reuse-rejected flow exercised
end-to-end.

### Database & storage

Image records, users, and camera sessions are stored in **MongoDB
Atlas** (`app/database.py`, via PyMongo) — this module used to run on
SQLite/SQLAlchemy; `data/mplads.db` is a leftover from before that
migration and is no longer written to. Uploaded photos are stored in
**Cloudinary**; the local `data/images/` copy each upload briefly
touches down in is deleted right after the Cloudinary upload succeeds,
so it's staging, not the resting place. Both need credentials in
`.env` — `DATABASE_URL` (Mongo connection string) and
`CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` —
plus a `JWT_SECRET_KEY` for signing auth tokens (generate one with
`python -c "import secrets; print(secrets.token_hex(32))"`). All four
are required — the app fails fast at startup with a clear error if any
are missing, rather than falling back to a hardcoded default.

---

## Worked Example

### Register, log in, and submit an image

`/api/images/submit` requires a bearer token (see "Auth + camera-session
anti-fraud gate" above):

```bash
# 1. Register once
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "pune_pwd_officer", "password": "changeme", "agency_name": "PWD Pune", "district": "Pune"}'

# 2. Log in to get a bearer token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -d "username=pune_pwd_officer&password=changeme" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 3. (Optional) Mint a one-time camera-session token right before capturing the photo
SESSION_TOKEN=$(curl -s -X POST http://localhost:8000/api/sessions/create \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 4. Submit — session_token is optional but consumed (single-use) if provided
curl -X POST http://localhost:8000/api/images/submit \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@photo.jpg" \
  -F "work_id=MP-PUN-2024-0231" \
  -F "district=Pune" \
  -F "work_type=road construction" \
  -F "state=Maharashtra" \
  -F "mp_name=Girish Bapat" \
  -F "sanction_date=2024-01-15" \
  -F "session_token=$SESSION_TOKEN"
```

### Sample response (HIGH risk — duplicate detected)

```json
{
  "work_id": "MP-PUN-2024-0231",
  "risk_score": 85,
  "risk_level": "HIGH",
  "verification_status": "REQUIRES_REVIEW",
  "recommendation": "Block payment pending manual verification",
  "flags": [
    {
      "code": "PERCEPTUAL_DUPLICATE",
      "severity": "HIGH",
      "message": "This photograph is a near-identical match to evidence submitted for a different work.",
      "evidence": {
        "matched_work_id": "MP-NAG-2024-0118",
        "matched_district": "Nagpur",
        "hamming_distance": 2,
        "matched_image_path": "data/images/abc123.jpg"
      },
      "points_added": 50
    },
    {
      "code": "CROSS_DISTRICT_MATCH",
      "severity": "HIGH",
      "message": "The matched image belongs to a different district (Nagpur).",
      "evidence": {
        "candidate_district": "Pune",
        "matched_district": "Nagpur"
      },
      "points_added": 20
    },
    {
      "code": "EXIF_STRIPPED",
      "severity": "MEDIUM",
      "message": "This photograph contains no EXIF metadata.",
      "evidence": { "exif_tag_count": 0 },
      "points_added": 15
    }
  ],
  "layers_run": ["sha256", "phash", "dhash", "exif"],
  "layers_skipped": ["clip"],
  "processing_time_ms": 45
}
```

`risk_score` is an automated signal, not proof that an image is genuine. The
`verification_status` field is `VERIFIED`, `INSUFFICIENT_EVIDENCE`, or
`REQUIRES_REVIEW`; a low/zero score with insufficient evidence must remain a
manual-review case.

### Check health

```bash
curl http://localhost:8000/health
```

```json
{
  "status": "ok",
  "database": "connected",
  "clip_loaded": false,
  "clip_model": null,
  "total_images": 10
}
```

---

## Scaling to Production

This prototype is designed for correctness and clarity. For production deployment beyond ~100k images:

- **Vector search**: Replace brute-force embedding search with [FAISS](https://github.com/facebookresearch/faiss) (Facebook AI Similarity Search) or PostgreSQL's [pgvector](https://github.com/pgvector/pgvector) extension for sub-linear nearest-neighbor search.
- **Async workers**: Use Celery or similar task queue for image processing, so the API returns immediately and the assessment runs in the background.
- **Object storage**: Done — Cloudinary now holds uploaded images; `data/images/` is only ephemeral local staging.
- **Database**: Done — MongoDB Atlas replaced SQLite/SQLAlchemy. Remaining production concerns: a dedicated `image_records` index beyond the current `work_id` one (e.g. on `sha256`/`phash` for the brute-force scans below), and connection pooling tuned for concurrent request load.
- **GPU acceleration**: Use a GPU-enabled torch installation for 10-50x faster CLIP inference.
- **Batch processing**: Add a bulk upload endpoint that processes multiple images in a single request with batched CLIP inference.
- **Dashboard**: Done — a React (Vite) frontend in `frontend/` covers all four roles; see its own README. Remaining production concerns there: no push/websocket layer (every view is "current as of last load", with an explicit Refresh action rather than a fake live-updating claim), and no pagination on the list/table views yet — they fetch the full collection, which is fine at prototype scale and is the same brute-force posture as the detection layers.

---

## Project Structure

```
mplads_image_module/
├── app/
│   ├── __init__.py           # Package docstring
│   ├── config.py             # All thresholds, weights, and feature flags (BaseSettings)
│   ├── database.py           # MongoDB Atlas connection (PyMongo), init_db() + district seeding
│   ├── models.py             # User/CameraSession/District/ImageRecord Mongo document models
│   ├── schemas.py            # Pydantic request/response models (incl. auth/session)
│   ├── auth.py                # JWT auth + bcrypt password hashing
│   ├── hashing.py            # Layer 1 + 2 (SHA-256, pHash, dHash, rotation-robust + tiled pHash)
│   ├── embeddings.py         # Layer 3 (CLIP embeddings + zero-shot)
│   ├── exif_analysis.py      # Metadata extraction and anomaly flags
│   ├── ela_analysis.py       # Layer 4 (Error Level Analysis: tamper/screenshot/photo-of-photo)
│   ├── ocr_analysis.py       # Layer 5 (EasyOCR receipt date/amount cross-check)
│   ├── duplicate_search.py   # Multi-layer matching engine
│   ├── risk_engine.py        # Unified scoring + explainability + conditional flag weights
│   └── main.py               # FastAPI application (all endpoints: images, reviews, stakeholder, admin, auth/sessions)
├── frontend/                 # React + Vite dashboard, all four roles (see frontend/README.md)
│   └── src/
│       ├── api/              # Thin fetch wrappers, one module per endpoint group
│       ├── components/       # Shared UI (badges, dropzone, timeline, audit trail, charts)
│       ├── context/          # AuthContext — token + profile + role
│       ├── hooks/            # Data-loading hooks per view
│       ├── lib/roles.js      # Role → landing path; the single source for role routing
│       └── pages/            # One page per route, grouped by role
├── scripts/
│   ├── seed_database.py         # Populate DB with real photographs (data/real_images/)
│   ├── create_user.py           # Provision a user with any role (bootstraps the first admin)
│   ├── generate_fraud_cases.py  # Create planted fraud test images + ground-truth manifest
│   ├── evaluate_detection.py    # Detection-rate/severity/false-positive harness (Validation section's source)
│   ├── calibrate_thresholds.py  # Empirical threshold calibration + corpus validation gate
│   ├── download_models.py       # Pre-download/verify the CLIP model
│   └── measure_latency.py       # Per-layer latency benchmark
├── tests/
│   ├── test_hashing.py           # Hash computation + distance tests
│   ├── test_exif.py              # GPS, haversine, metadata flag tests
│   ├── test_duplicate_search.py  # Cross-boundary matching tests
│   ├── test_risk_engine.py       # Score arithmetic + degradation tests
│   ├── test_conditional_flags.py # Contextual EXIF weighting (alone vs. with_others)
│   ├── test_tiled_hash.py        # Tiled-hash voting mechanism + honest crop-detection findings
│   ├── test_detection_rate.py    # @slow — asserts the harness's acceptance bar
│   ├── test_clip_integration.py  # @requires_clip — real CLIP embedding/zero-shot tests
│   ├── test_ela.py               # Layer 4 (ELA) unit tests
│   ├── test_ocr.py               # Layer 5 (OCR) unit tests
│   ├── test_auth_and_sessions.py # Auth + camera-session tests, incl. a full submit → reuse-rejected flow
│   ├── test_submitter_workflow.py   # Role on register/login, own-files-only history, persisted risk snapshot
│   ├── test_reviewer_workflow.py    # Claim/decide state machine, contested-claim 409, required reject notes
│   ├── test_stakeholder_workflow.py # Sign-off state machine + dashboard aggregates
│   ├── test_admin_workflow.py       # User management, deactivation, single/bulk override, activity log
│   └── test_cross_tenant_access.py  # Own-files-only enforcement + oversight-view gating (regression)
├── data/
│   ├── images/                # Stored uploads / synthetic test corpus
│   ├── real_images/           # Real photos for calibration (gitignored contents — see its README.md)
│   ├── fraud_cases/           # Planted fraud test images + fraud_manifest.json ground truth
│   └── mplads.db              # Orphaned — leftover SQLite file from before the MongoDB migration
├── evaluation_report.json     # Latest evaluate_detection.py run, full detail
├── evaluation_history.jsonl   # Append-only run log (evaluate_detection.py --compare)
├── pyproject.toml             # requires-python + project metadata
├── requirements.txt           # Loose constraints, for development
├── requirements.lock          # Exact pinned versions, for setup.sh/setup.bat
├── setup.sh / setup.bat       # One-command setup (venv, deps, DB, CLIP, tests)
├── SETUP_VERIFICATION.md      # Clean-machine checklist + troubleshooting
├── README.md
└── .gitignore
```

---

## License

This project is for educational and hackathon purposes. See the [MPLADS guidelines](https://www.mplads.gov.in/) for official scheme documentation.
