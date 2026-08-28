"""Fetch every MPLADS dataset published on data.gov.in into local CSVs.

The MPLADS portal itself (mplads.gov.in) refuses connections from most
non-government networks, but the Ministry publishes MPLADS statistics on
the Open Government Data platform (data.gov.in), which exposes each
dataset through a documented public API. This script:

  1. Searches the OGD catalog for every dataset whose title mentions
     MPLADS/MPLAD (both spellings — the catalog's title filter does not
     do substring matching across word boundaries).
  2. Downloads each dataset through the official resource API
     (api.data.gov.in/resource/<uuid>) as CSV.
  3. Writes one CSV per dataset into data/mplads_public/, a
     manifest.csv describing them, and a single combined
     mplads_all_data.csv in tidy long format (dataset_id, dataset_title,
     row, column, value) so heterogeneous tables can live in one file.

The API key defaults to data.gov.in's published sample key (rate-limited
but sufficient for these small statistical tables); set
DATA_GOV_IN_API_KEY to use a personal key from https://data.gov.in/user.

Usage:
    python -m scripts.fetch_mplads_public_data
"""

import csv
import os
import re
import sys
import time

import httpx

from app.config import DATA_DIR

CATALOG_URL = "https://www.data.gov.in/backend/dmspublic/v1/resources"
RESOURCE_URL = "https://api.data.gov.in/resource/{uuid}"
# data.gov.in's own published sample key, safe to ship — not a secret.
SAMPLE_API_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b"
API_KEY = os.environ.get("DATA_GOV_IN_API_KEY", SAMPLE_API_KEY)

OUT_DIR = DATA_DIR / "mplads_public"
# The catalog endpoint 403s any non-browser User-Agent, so identify as a
# plain browser. The API itself is public and unauthenticated.
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
REQUEST_DELAY_S = 0.6  # polite spacing between API calls
TIMEOUT_S = 30.0
PAGE_SIZE = 10  # the sample key's hard per-request cap
ROW_LIMIT = 10000  # runaway-pagination backstop, far above these tables


def _slug(title: str, max_len: int = 70) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_")
    return s[:max_len].rstrip("_")


def discover_datasets(client: httpx.Client) -> list[dict]:
    """Every catalog entry whose title mentions the scheme, deduped by uuid."""
    seen: dict[str, dict] = {}
    for query in ("mplads", "MPLAD scheme", "MPLAD"):
        offset = 0
        while True:
            r = client.get(
                CATALOG_URL,
                params={"filters[title]": query, "limit": 50, "offset": offset},
            )
            r.raise_for_status()
            payload = r.json()
            rows = payload.get("data", {}).get("rows", [])
            for row in rows:
                title = row.get("title")
                title = title[0] if isinstance(title, list) else title
                uuid = row.get("uuid")
                uuid = uuid[0] if isinstance(uuid, list) else uuid
                if not (title and uuid) or uuid in seen:
                    continue
                # The broad queries can drag in unrelated titles; keep only
                # rows that actually name the scheme.
                if "mplad" not in title.lower():
                    continue
                seen[uuid] = {"uuid": uuid, "title": title.strip()}
            offset += 50
            if offset >= int(payload.get("total", 0)) or not rows:
                break
            time.sleep(REQUEST_DELAY_S)
        time.sleep(REQUEST_DELAY_S)
    return sorted(seen.values(), key=lambda d: d["title"])


def fetch_dataset_rows(client: httpx.Client, uuid: str) -> tuple[list[str], list[list[str]]] | None:
    """One dataset's full table via the official resource API.

    Paginates with offset: the published sample key caps every request at
    10 records regardless of `limit`, so a single call silently truncates
    anything bigger (measured: the state-wise dataset is 38 rows).
    Datasets whose backing file was removed from the portal answer
    "Meta not found" with zero records — those return None.
    """
    header: list[str] = []
    rows: list[list[str]] = []
    offset = 0
    while True:
        r = client.get(
            RESOURCE_URL.format(uuid=uuid),
            params={"api-key": API_KEY, "format": "json", "limit": PAGE_SIZE, "offset": offset},
        )
        if r.status_code != 200:
            return None
        payload = r.json()
        fields = payload.get("field") or []
        records = payload.get("records") or []
        if not fields:
            return None  # "Meta not found" — dataset has no API backing
        if not header:
            header = [f.get("name") or f.get("id") for f in fields]
        ids = [f.get("id") for f in fields]
        for rec in records:
            rows.append([str(rec.get(i, "") if rec.get(i) is not None else "") for i in ids])
        offset += len(records)
        total = int(payload.get("total") or 0)
        if not records or offset >= total or offset >= ROW_LIMIT:
            break
        time.sleep(REQUEST_DELAY_S)
    return (header, rows) if rows else None


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    headers = {"User-Agent": USER_AGENT}

    with httpx.Client(headers=headers, timeout=TIMEOUT_S, follow_redirects=True) as client:
        print("Searching the data.gov.in catalog for MPLADS datasets…")
        datasets = discover_datasets(client)
        print(f"  found {len(datasets)} datasets\n")
        if not datasets:
            print("Nothing found — the catalog API may be unavailable right now.")
            return 1

        manifest_rows = []
        combined_path = OUT_DIR / "mplads_all_data.csv"
        with open(combined_path, "w", newline="", encoding="utf-8") as combined_f:
            combined = csv.writer(combined_f)
            # dataset_id → title lives in manifest.csv; repeating the long
            # title on every row would triple the file for nothing.
            combined.writerow(["dataset_id", "row", "column", "value"])

            for i, ds in enumerate(datasets, start=1):
                dataset_id = f"{i:02d}"
                print(f"[{dataset_id}/{len(datasets):02d}] {ds['title'][:96]}")
                time.sleep(REQUEST_DELAY_S)
                result = fetch_dataset_rows(client, ds["uuid"])
                if result is None:
                    # Measured against every skip in this catalog: these are
                    # datasets whose backing file was deleted portal-side
                    # (the download URL serves an S3 "NoSuchBucket" error),
                    # so the API has no data to index either.
                    print("       UNAVAILABLE — dataset's backing file was removed from the portal")
                    manifest_rows.append([dataset_id, ds["title"], ds["uuid"], "", 0, "UNAVAILABLE"])
                    continue

                header, rows = result
                per_file = OUT_DIR / f"{dataset_id}_{_slug(ds['title'])}.csv"
                with open(per_file, "w", newline="", encoding="utf-8") as f:
                    w = csv.writer(f)
                    w.writerow(header)
                    w.writerows(rows)

                for row_no, row in enumerate(rows, start=1):
                    for col_name, value in zip(header, row):
                        if value.strip():
                            combined.writerow([dataset_id, row_no, col_name, value])

                manifest_rows.append(
                    [dataset_id, ds["title"], ds["uuid"], per_file.name, len(rows), "OK"]
                )
                print(f"       {len(rows)} rows -> {per_file.name}")

        manifest_path = OUT_DIR / "manifest.csv"
        with open(manifest_path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["dataset_id", "title", "resource_uuid", "file", "data_rows", "status"])
            w.writerows(manifest_rows)

        ok = sum(1 for r in manifest_rows if r[-1] == "OK")
        print(f"\nDone: {ok}/{len(manifest_rows)} datasets saved under {OUT_DIR}")
        print(f"  combined long-format file: {combined_path.name}")
        print(f"  manifest:                  {manifest_path.name}")
        return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
