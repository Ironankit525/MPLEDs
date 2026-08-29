"""Export every submission in the database to a report-style CSV.

One row per ImageRecord, with the columns an oversight reader actually
uses: work identity, workflow status, the automated risk snapshot
(score, level, flag codes), and the full who-did-what-when audit trail.
Detection internals (hashes, embeddings) are deliberately left out —
this is the report table, not a database dump.

Usage:
    python -m scripts.export_submissions_csv [output.csv]

Default output: data/exports/mpled_submissions.csv
"""

import csv
import sys
from pathlib import Path

from app.config import DATA_DIR
from app.database import db

COLUMNS = [
    "work_id",
    "work_type",
    "district",
    "state",
    "mp_name",
    "status",
    "risk_score",
    "risk_level",
    "flags",
    "recommendation",
    "claimed_amount",
    "sanction_date",
    "submitted_by_username",
    "uploaded_at",
    "reviewed_by_username",
    "reviewed_at",
    "reviewer_notes",
    "signed_off_by_username",
    "signed_off_at",
    "signoff_notes",
    "admin_override_by_username",
    "admin_override_previous_status",
    "admin_override_at",
    "image_url",
]


def main() -> int:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else DATA_DIR / "exports" / "mpled_submissions.csv"
    out.parent.mkdir(parents=True, exist_ok=True)

    count = 0
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(COLUMNS)
        for r in db.image_records.find({}).sort("uploaded_at", -1):
            flags = ";".join(
                f.get("code", "") for f in (r.get("flags") or []) if isinstance(f, dict)
            )
            row = []
            for col in COLUMNS:
                if col == "flags":
                    row.append(flags)
                elif col == "image_url":
                    row.append(r.get("file_path", ""))
                else:
                    value = r.get(col, "")
                    row.append("" if value is None else value)
            w.writerow(row)
            count += 1

    print(f"{count} submissions -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
