# Real photographs for threshold calibration

Every threshold in `app/config.py` (pHash Hamming distance, CLIP cosine
similarity, semantic-match confidence) was originally picked by guessing
against synthetic gradient/shape test images. Synthetic images have very
different perceptual-hash characteristics from real photographs — this
directory exists so `scripts/calibrate_thresholds.py` can measure the
*actual* separation between "same photo, modified" and "different photo"
on content that looks like what officials will really upload.

## Current status (2026-08-27): partial, not yet sufficient

**20 of the 30+ required photos**, sourced from Wikimedia Commons,
correctly labeled by work type, with real camera/phone EXIF (Make,
Model, and — on 4 of them — genuine GPS coordinates, not fabricated).
See `corpus_manifest.json` in this directory for the exact source,
license, and license-required attribution for every file.

This replaces a previous corpus that looked adequate but wasn't: 35
generic random images from Lorem Picsum (not photographs of
infrastructure at all), labeled by arbitrary index-cycling rather than
actual content, with **GPS EXIF fabricated via `piexif`** purely to
satisfy the corpus gate below. That corpus passed every count check and
still produced meaningless calibration numbers — see the README's
"Calibration" section for what those numbers looked like and why. The
new corpus is smaller but every number it produces means what it claims
to.

### What's still missing

| Requirement | Have | Need | Gap |
|---|---|---|---|
| Photos directly in this folder | 20 | 30–40 | **10+ more** |
| Same-scene pairs in `pairs/` | 0 | 3 pairs (6 photos) | **6 photos** (see below) |
| Photos with genuine GPS in EXIF | 4 | 10 | **6+ more** |
| `drainage` category | 0 | ≥1 | **entirely missing** |
| `water_facility` category | 0 | ≥1 | **entirely missing** |

Current category breakdown: `bridge` (3), `electricity` (4), `hospital`
(3), `road_construction` (3), `park` (2), `school_building` (2),
`toilet` (2), `community_hall` (1). `drainage` and `water_facility` have
zero — every Commons candidate found for those two categories failed to
download before hitting Wikimedia's rate limit / robot-policy block
(see `corpus_manifest.json`'s absence of those categories; nothing was
faked in to hide the gap).

**Why collection stopped here**: fetching this corpus via the Wikimedia
Commons API eventually got a `429` response reading *"Your request does
not comply with our robot policy"* — a harder signal than an ordinary
rate limit, and the right response to that is to stop, not retry around
it. Finishing this corpus needs either resuming from a fresh IP/session
with much slower pacing, a different source entirely, or (best) real
field photographs from an actual MPLADS-style site, which no automated
collection can substitute for regardless of pacing.

## What to add — exact requirements

`scripts/calibrate_thresholds.py` validates this directory before doing
anything else and stops with a precise "what's missing" report if any
of these aren't met — it will not fall back to synthetic images or
proceed with a partial corpus:

| Requirement | Minimum |
|---|---|
| Photos directly in this folder (not `pairs/`) | **30** (30–40 recommended) |
| Same-scene pairs in `pairs/` (see below) | **3 pairs** (6 photos) |
| Photos carrying **genuine, non-empty** GPS in their EXIF | **10** |

Guidance for the photos themselves:

- Construction sites, roads, buildings, public infrastructure — the kind
  of work-completion photos MPLADS submissions actually contain.
- **The photo must actually depict the work type it's added under.**
  Name the file `<work_type>_<NN>.ext` using the exact strings from
  `scripts/seed_database.py`'s `WORK_TYPES` (which are themselves the
  exact keys of `app/config.py`'s `WORK_TYPE_PROMPTS`) —
  `road_construction`, `school_building`, `community_hall`,
  `water_facility`, `drainage`, `bridge`, `toilet`, `hospital`,
  `electricity`, `park` — e.g. `drainage_01.jpg`. `_work_type_from_filename()`
  in `scripts/seed_database.py` reads this back out; files that don't
  follow the convention fall back to arbitrary cycling, which is the
  exact mechanism that made the previous corpus's calibration numbers
  meaningless.
- **Avoid photos of identifiable people** (privacy). This is a hard
  requirement, checked visually, not just by keyword: a "GODL-India"
  (Government of India open license) ceremonial photo of a minister
  posing with dozens of workers was found among the search results for
  this round and rejected on exactly this basis, despite being licensed
  fine and nominally on-topic. A person incidentally working in the
  background of a genuine site photo, at a distance where they aren't
  individually recognisable, is a normal and expected part of a
  work-completion photo and isn't what this rule is trying to exclude.
- Use a mix of devices/angles/lighting if you can — a calibration set
  that's all one camera from one shoot will understate real-world
  variance. `scripts/seed_database.py` and the corpus validator both
  warn (non-fatally) if too many images share identical dimensions or
  are near-duplicates of each other.
- **Keep the original camera EXIF intact**, and make sure at least 10
  photos have location services / geotagging on when taken. Copy files
  directly from your camera/phone's storage — don't screenshot them or
  re-save them through an app/editor that strips metadata. Verify with
  `python -c "from app.exif_analysis import extract_gps; print(extract_gps('path/to/file.jpg'))"`
  before counting a photo toward the GPS requirement — a `GPSInfo` EXIF
  tag can be present but empty, which counts for nothing.
- If sourcing from Wikimedia Commons: use a free license (CC0, CC-BY,
  CC-BY-SA, or GODL-India), record the source URL and exact license in
  `corpus_manifest.json` for attribution, verify the file actually
  depicts what its title claims (several plausible-looking search hits
  were miscategorized landmarks or ceremonial events, not the
  infrastructure itself), and fetch through the API's `iiurlwidth`
  thumbnail parameter rather than hammering full-resolution originals —
  Commons' own servers will start rejecting requests otherwise.
- Any common format works: `.jpg`, `.jpeg`, `.png`, `.webp`.

## `pairs/` subfolder

**Populated** as of 2026-08-29: 4 scenes (9 photos), real second camera
angles, used to calibrate `EMBEDDING_DUPLICATE_THRESHOLD` — see the main
README's Known limitations for the measured result.

Add **at least 3 pairs (6 photos)** of the exact same physical scene,
each taken from a different angle or distance, into
`data/real_images/pairs/`. These are used by
`tests/test_clip_integration.py`'s "same scene, different angle" test —
CLIP should recognise these as semantically similar even though their
pixel-level hashes are completely different.

**Naming is load-bearing, not cosmetic.** Files must be
`<scene>_<variant>.jpg` — e.g. `scene1_a.jpg`, `scene1_b.jpg`. The test
groups photos into scenes by the part of the filename before the first
underscore, so a file that doesn't follow this lands in its own group
and is silently skipped. (It previously just compared the first two
files in alphabetical order, which passed only by luck — it would have
compared two unrelated photos the moment someone added a file sorting
earlier. Fixed 2026-08-29.)

Optionally add a `_wide` variant — the same place with the camera panned
substantially, e.g. `scene1_c_wide.jpg`. These are excluded from the
main same-scene assertion and drive
`test_large_viewpoint_change_is_a_known_gap` instead, which pins the
measured ceiling of CLIP's viewpoint tolerance.

**This must be two genuinely different photographs of the same real
scene** — not one photo cropped or resized to produce a second file. The
previous version of this corpus did exactly that (crop-simulated
"pairs" from a single source image), which validates the CLIP mechanism
against a crop, not against a real second camera angle; a crop of a
real photo is at least honestly a crop, but it isn't what this test
exists to check, and no attempt was made to replace it with a
crop-fake-but-from-a-real-photo halfway measure — better to have the
test skip cleanly with a clear reason (which it does — see below) than
to keep passing it on a technicality.

If this folder doesn't have enough photos, the corpus validation above
stops with a clear count of how many more are needed, and the CLIP
same-scene test skips with a clear message rather than silently passing.
