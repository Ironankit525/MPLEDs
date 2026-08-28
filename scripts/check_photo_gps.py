"""Verify photos carry real GPS EXIF before they're added to the corpus.

Run this on a phone's output BEFORE walking a site — a single test shot
tells you whether location tagging is actually on, instead of finding
out after collecting a whole batch (which is exactly what happened with
data/real_images/pairs/: 9 photos, camera EXIF intact, GPS absent on
every one because the camera app's location setting was off).

Distinguishes the two failure modes, which need different fixes:
  - GPSInfo absent entirely  -> location tagging was off when shot
  - GPSInfo present but empty -> tagging was on but there was no fix
                                 (indoors / cold GPS), or a share/export
                                 path stripped the coordinates

Usage:
    python -m scripts.check_photo_gps <file-or-directory> [...]
"""

import sys
from pathlib import Path

from PIL import Image
from PIL.ExifTags import TAGS

from app.exif_analysis import extract_gps


def inspect(path: Path) -> bool:
    try:
        exif = Image.open(path)._getexif() or {}
    except Exception as exc:
        print(f"  {path.name:<38} UNREADABLE ({exc})")
        return False

    names = {TAGS.get(k, k): v for k, v in exif.items()}
    coords = extract_gps(str(path))
    camera = f"{names.get('Make','?')} {names.get('Model','?')}".strip()

    if coords:
        print(f"  {path.name:<38} OK    {coords[0]:.5f}, {coords[1]:.5f}   [{camera}]")
        return True
    if "GPSInfo" in names:
        print(f"  {path.name:<38} EMPTY GPS block present but unusable "
              f"— no satellite fix, or stripped on export   [{camera}]")
    elif names:
        print(f"  {path.name:<38} NONE  location tagging was OFF "
              f"({len(names)} other EXIF tags present)   [{camera}]")
    else:
        print(f"  {path.name:<38} NONE  no EXIF at all — fully stripped")
    return False


def main() -> None:
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)

    files: list[Path] = []
    for a in args:
        p = Path(a)
        if p.is_dir():
            files += sorted(q for q in p.rglob("*") if q.suffix.lower() in
                            {".jpg", ".jpeg", ".png", ".webp", ".heic"})
        elif p.exists():
            files.append(p)
        else:
            print(f"  (skipping missing path: {a})")

    if not files:
        sys.exit("No image files found.")

    print(f"\nChecking {len(files)} file(s):\n")
    ok = sum(inspect(f) for f in files)
    print(f"\n{ok}/{len(files)} carry usable GPS coordinates.")
    # The corpus gate wants >=10 GPS-bearing photos overall; see
    # data/real_images/README.md.
    if ok < len(files):
        print("Fix the camera's location setting, get an outdoor fix, and "
              "transfer by USB/direct copy (share sheets strip GPS).")


if __name__ == "__main__":
    main()
