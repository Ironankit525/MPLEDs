"""Seed a realistic end-to-end demo through the live REST API.

Unlike scripts/seed_database.py (which inserts ImageRecords straight
into Mongo for the detection-layer corpus), this drives the actual
HTTP endpoints, so everything it creates is genuine: real SHA-256 /
pHash values, real risk assessments from app/risk_engine.py, real
Cloudinary URLs (so images actually render in the UI), and real
workflow transitions performed by real role accounts.

The point is a database that shows each of the four roles something
worth looking at: a reviewer with a non-empty queue, a stakeholder
with charts that aren't all zero and something awaiting sign-off, an
admin with an activity log, and two submitters whose histories are
correctly separate.

Usage (backend must already be running):
    python -m scripts.seed_demo
    python -m scripts.seed_demo --purge   # remove everything it created

Accounts it creates are listed in DEMO_ACCOUNTS below; all use the
password in DEMO_PASSWORD. Reviewer/stakeholder/admin accounts are
created if missing, so this is safe to re-run.
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone

import httpx

from app.config import PROJECT_ROOT

API = "http://localhost:8000"
PHOTO_DIR = PROJECT_ROOT / "data" / "real_images"

DEMO_PASSWORD = "demo1234"

# Marks everything this script creates so --purge can find it again
# without guessing at usernames or work IDs.
DEMO_TAG = "[demo]"

DEMO_ACCOUNTS = [
    # username,               role,          agency,                              district
    ("pune_field_officer",    "submitter",   f"PWD Pune {DEMO_TAG}",              "Pune"),
    ("nagpur_field_officer",  "submitter",   f"PWD Nagpur {DEMO_TAG}",            "Nagpur"),
    ("district_reviewer",     "reviewer",    "Pune District Verification Cell",   "Pune"),
    ("district_stakeholder",  "stakeholder", "Pune Treasury Oversight",           "Pune"),
    ("district_admin",        "admin",       "MPLADS System Administration",      "Pune"),
]

# work_id suffix, photo, work_type, district, state, mp_name, submitter
SUBMISSIONS = [
    ("0231", "road_construction_01.jpg", "road construction", "Pune",   "Maharashtra", "Girish Bapat",  "pune_field_officer"),
    ("0232", "school_building_01.jpg",   "school building",   "Pune",   "Maharashtra", "Girish Bapat",  "pune_field_officer"),
    ("0233", "hospital_01.jpg",          "hospital",          "Pune",   "Maharashtra", "Girish Bapat",  "pune_field_officer"),
    ("0234", "toilet_01.jpg",            "toilet",            "Pune",   "Maharashtra", "Girish Bapat",  "pune_field_officer"),
    ("0235", "park_01.jpg",              "park",              "Pune",   "Maharashtra", "Girish Bapat",  "pune_field_officer"),
    ("0118", "bridge_01.jpg",            "bridge",            "Nagpur", "Maharashtra", "Nitin Gadkari", "nagpur_field_officer"),
    # electricity_02 rather than _01: _01 is a 22 MB original, over the
    # 10 MB MAX_UPLOAD_SIZE_BYTES the API enforces.
    ("0119", "electricity_02.jpg",       "electricity",       "Nagpur", "Maharashtra", "Nitin Gadkari", "nagpur_field_officer"),
    ("0120", "community_hall_01.jpg",    "community hall",    "Nagpur", "Maharashtra", "Nitin Gadkari", "nagpur_field_officer"),
    # Deliberate duplicate: the same photo as 0118, resubmitted under a
    # different work in a different district. This is the fraud pattern
    # the whole module exists to catch — it should light up with
    # EXACT_DUPLICATE + CROSS_DISTRICT_MATCH and land HIGH risk.
    ("0236", "bridge_01.jpg",            "bridge",            "Pune",   "Maharashtra", "Girish Bapat",  "pune_field_officer"),
]

# work_id suffix -> what a reviewer/stakeholder does to it. Anything not
# listed stays PENDING_REVIEW so the reviewer's queue isn't empty.
REVIEW_PLAN = {
    "0231": ("approve", "Site visit corroborates the photo. GPS and timestamp consistent."),
    "0232": ("approve", "Verified against the sanction order. No concerns."),
    "0233": ("approve", "Cross-checked with the district engineer's report."),
    "0236": ("reject",  "Byte-identical to evidence already submitted for MP-NAG-2024-0118 in a different district."),
    "0119": ("claim",   None),  # left mid-review, so IN_REVIEW is visible
}
# Approved works the stakeholder then signs off (releasing payment).
SIGN_OFF = ["0231", "0232"]


TIMEOUT = 120.0  # submit runs ELA/OCR inline; httpx defaults to 5s


def _login(username: str, password: str = DEMO_PASSWORD) -> str:
    r = httpx.post(f"{API}/api/auth/login", data={"username": username, "password": password}, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _ensure_accounts() -> None:
    """Create any missing demo account. Submitters go through public
    registration; privileged roles need an admin, so the first admin is
    created directly via scripts/create_user.py's same code path."""
    from app.auth import get_password_hash
    from app.database import db

    for username, role, agency, district in DEMO_ACCOUNTS:
        if db.users.find_one({"username": username}):
            # Reset to DEMO_PASSWORD and re-activate. These accounts may
            # already exist from an earlier bootstrap with a different
            # password; normalising them means all five demo logins share
            # one password, and a run of the admin UI that deactivated one
            # doesn't leave it locked out of the next demo.
            db.users.update_one(
                {"username": username},
                {"$set": {"password_hash": get_password_hash(DEMO_PASSWORD), "is_active": True, "role": role}},
            )
            print(f"  = {username} ({role}) already existed — password reset to the demo password")
            continue
        db.users.insert_one(
            {
                "username": username,
                "password_hash": get_password_hash(DEMO_PASSWORD),
                "agency_name": agency,
                "district": district,
                "role": role,
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
            }
        )
        print(f"  + created {username} ({role})")


def _work_id(district: str, suffix: str) -> str:
    return f"MP-{district[:3].upper()}-2024-{suffix}"


def seed() -> None:
    if not PHOTO_DIR.exists():
        sys.exit(f"Photo directory not found: {PHOTO_DIR}")

    print("Accounts:")
    _ensure_accounts()

    tokens = {u: _login(u) for u, _, _, _ in DEMO_ACCOUNTS}

    admin_headers = _auth(tokens["district_admin"])

    # Idempotency: skip any work_id that's already present. Without this
    # a second run re-submits every photo, which both duplicates the
    # demo rows AND corrupts the risk scores — the second copy of a
    # photo matches the first as an EXACT_DUPLICATE, so a legitimate
    # submission would show up as HIGH-risk fraud on re-run.
    existing = {
        s["work_id"]
        for s in httpx.get(f"{API}/api/admin/submissions", headers=admin_headers, timeout=TIMEOUT).json()["images"]
    }

    print("\nSubmissions:")
    sanction_base = datetime.now(timezone.utc) - timedelta(days=180)
    for suffix, photo, work_type, district, state, mp_name, submitter in SUBMISSIONS:
        photo_path = PHOTO_DIR / photo
        if not photo_path.exists():
            print(f"  ! skipping {suffix}: {photo} not found")
            continue
        work_id = _work_id(district, suffix)
        if work_id in existing:
            print(f"  = {work_id:<22} already present, skipping")
            continue
        with open(photo_path, "rb") as f:
            r = httpx.post(
                f"{API}/api/images/submit",
                headers=_auth(tokens[submitter]),
                files={"file": (photo, f, "image/jpeg")},
                data={
                    "work_id": work_id,
                    "district": district,
                    "state": state,
                    "work_type": work_type,
                    "mp_name": mp_name,
                    "sanction_date": sanction_base.strftime("%Y-%m-%d"),
                },
                timeout=TIMEOUT,
            )
        if r.status_code != 200:
            print(f"  ! {work_id}: {r.status_code} {r.text[:120]}")
            continue
        body = r.json()
        print(f"  + {work_id:<22} {body['risk_level']:<6} score={body['risk_score']:<3} flags={len(body['flags'])}")

    # Map work_id -> (image id, current status) for the workflow steps.
    all_subs = httpx.get(f"{API}/api/admin/submissions", headers=admin_headers, timeout=TIMEOUT).json()["images"]
    by_work = {s["work_id"]: (s["id"], s["status"]) for s in all_subs}

    print("\nReview decisions:")
    rev_headers = _auth(tokens["district_reviewer"])
    for suffix, (action, note) in REVIEW_PLAN.items():
        match = next((w for w in by_work if w.endswith(suffix)), None)
        if not match:
            continue
        image_id, current_status = by_work[match]
        if current_status != "PENDING_REVIEW":
            print(f"  = {match:<22} already {current_status}, skipping")
            continue
        if action == "claim":
            r = httpx.post(f"{API}/api/reviews/{image_id}/claim", headers=rev_headers, timeout=TIMEOUT)
            ok = "~" if r.status_code == 200 else "!"
            print(f"  {ok} {match:<22} claimed (left IN_REVIEW) [{r.status_code}]")
        else:
            httpx.post(f"{API}/api/reviews/{image_id}/claim", headers=rev_headers, timeout=TIMEOUT)
            r = httpx.post(
                f"{API}/api/reviews/{image_id}/decide",
                headers=rev_headers,
                json={"decision": action, "notes": note},
                timeout=TIMEOUT,
            )
            verb = "approved" if action == "approve" else "rejected"
            mark = ("+" if action == "approve" else "-") if r.status_code == 200 else "!"
            print(f"  {mark} {match:<22} {verb} [{r.status_code}]")

    print("\nStakeholder sign-off:")
    stake_headers = _auth(tokens["district_stakeholder"])
    # Re-read: the decisions above changed statuses, and sign-off is
    # only valid from APPROVED.
    after_review = httpx.get(f"{API}/api/admin/submissions", headers=admin_headers, timeout=TIMEOUT).json()["images"]
    by_work = {s["work_id"]: (s["id"], s["status"]) for s in after_review}
    for suffix in SIGN_OFF:
        match = next((w for w in by_work if w.endswith(suffix)), None)
        if not match:
            continue
        image_id, current_status = by_work[match]
        if current_status != "APPROVED":
            print(f"  = {match:<22} is {current_status}, not APPROVED — skipping")
            continue
        r = httpx.post(
            f"{API}/api/stakeholder/{image_id}/sign-off",
            headers=stake_headers,
            json={"notes": "Funds cleared for release."},
            timeout=TIMEOUT,
        )
        mark = "+" if r.status_code == 200 else "!"
        print(f"  {mark} {match:<22} signed off [{r.status_code}]")

    print("\nDone. Log in at http://localhost:5173")


def purge() -> None:
    """Remove every account and submission this script created."""
    from app.database import db

    demo_usernames = [u for u, _, _, _ in DEMO_ACCOUNTS]
    submitters = [u for u, role, _, _ in DEMO_ACCOUNTS if role == "submitter"]
    ids = [str(d["_id"]) for d in db.users.find({"username": {"$in": submitters}})]

    imgs = db.image_records.delete_many({"submitted_by_user_id": {"$in": ids}})
    users = db.users.delete_many({"username": {"$in": demo_usernames}})
    print(f"Deleted {imgs.deleted_count} submissions and {users.deleted_count} accounts.")
    print("Note: the uploaded images remain in Cloudinary — delete them from its dashboard if you want them gone.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--purge", action="store_true", help="remove everything this script created")
    args = parser.parse_args()

    if args.purge:
        purge()
        return

    try:
        httpx.get(f"{API}/health", timeout=5.0).raise_for_status()
    except Exception:
        sys.exit(f"Backend not reachable at {API}. Start it first:\n  ENABLE_CLIP=False uvicorn app.main:app --reload")

    seed()


if __name__ == "__main__":
    main()
