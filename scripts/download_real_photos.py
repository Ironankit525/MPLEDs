"""
Documents how the current data/real_images/ corpus was actually built.

This is NOT a re-run-and-get-the-same-result script — it never was one,
honestly. An earlier version of this file pretended to be: it downloaded
30 random images from Lorem Picsum (a placeholder-image API — landscapes,
objects, abstract art, not infrastructure of any kind), labeled them by
arbitrary index-cycling with no relationship to content, and used
`piexif` to WRITE FABRICATED GPS COORDINATES into 10 of them purely to
satisfy scripts/calibrate_thresholds.py's corpus-validation gate. It
passed every automated check and still produced meaningless calibration
numbers (see README.md's "Calibration" section and this directory's
README.md for what those numbers looked like) — the gate measures count,
not truth, and this script defeated it rather than meeting it.

The current corpus (see this directory's README.md for exact counts and
gaps) was built by:

  1. Querying the Wikimedia Commons API (action=query, generator=search,
     prop=imageinfo) per work type, using search terms specific to that
     category (e.g. "storm water drain construction India" for
     `drainage`) rather than one generic query.
  2. Filtering results to free licenses only (CC0, CC-BY-*, CC-BY-SA-*,
     Public domain, GODL-India) and a minimum resolution.
  3. VISUALLY reviewing every candidate before it was added — several
     plausible-looking, correctly-licensed, correctly-tagged search hits
     turned out to be miscategorized: a ceremonial GODL-India photo of a
     government minister posing with workers (search term: road
     construction), a 19th-century illustration (search term: drainage),
     photos of an unrelated European/Australian park (search term:
     park). All were rejected on sight, not caught by any automated
     filter.
  4. Checking real EXIF (Make, Model, GPSInfo) on the actual downloaded
     file — not assumed from search metadata — since a `GPSInfo` tag can
     be present but empty; only photos where
     `app.exif_analysis.extract_gps()` returns real coordinates count
     toward the GPS requirement.
  5. Naming each file `<work_type>_<NN>.ext` so its label is the actual
     verified content, not a guess — see
     `scripts.seed_database._work_type_from_filename()`.
  6. Recording title, license, and source URL for every file in this
     directory's `corpus_manifest.json`, both for attribution (CC-BY/
     CC-BY-SA/GODL-India require it) and so step 3's judgment calls are
     auditable rather than opaque.

Steps 3 and 4 are exactly why this isn't a single command you can re-run
unattended: a script can query an API and check a license field, but it
can't (shouldn't) decide on its own that a photo genuinely depicts
"drainage" rather than something a search engine merely associated with
that term. Treat extending this corpus as the same manual process, not
as "run this file again" — and see this directory's README.md for the
Wikimedia etiquette that matters if you do (their own servers will
start rejecting requests if you fetch full-resolution originals in a
tight loop instead of using the `iiurlwidth` thumbnail parameter).
"""

if __name__ == "__main__":
    raise SystemExit(
        "This file documents methodology, it does not run one — see its "
        "module docstring and data/real_images/README.md for what's still "
        "needed and how to add to the corpus."
    )
