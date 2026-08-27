"""Cross-tenant access-control regression tests.

These lock in row 2 of the role matrix ("View Upload History": Submitter
= own files only) at the endpoint level, and keep the two system-wide
oversight views out of a Submitter's reach.

Written after an audit found /api/images/{work_id} returning EVERY
image for a work ID to ANY authenticated caller — an unrelated
Submitter who guessed a work ID (they look like MP-PUN-2024-0231, i.e.
enumerable) got back another agency's Cloudinary URL, the submitting
officer's username, GPS coordinates, and the full risk assessment.
"""

from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pymongo.database import Database

from app.auth import get_password_hash
from app.config import settings
from app.main import app
from app.database import get_db

client = TestClient(app)


@pytest.fixture
def db_session():
    import mongomock
    mongo_client = mongomock.MongoClient()
    db = mongo_client.test_db

    app.dependency_overrides[get_db] = lambda: db

    yield db

    app.dependency_overrides.clear()


def _register_and_login(username: str) -> dict:
    client.post(
        "/api/auth/register",
        json={"username": username, "password": "pw", "agency_name": f"Agency {username}", "district": "Pune"},
    )
    return client.post("/api/auth/login", data={"username": username, "password": "pw"}).json()


def _create_user_and_login(db_session: Database, username: str, role: str) -> dict:
    db_session.users.insert_one(
        {
            "username": username,
            "password_hash": get_password_hash("pw"),
            "agency_name": "Oversight",
            "district": "Pune",
            "role": role,
        }
    )
    return client.post("/api/auth/login", data={"username": username, "password": "pw"}).json()


def _submit_as(headers: dict, tmp_path: Path, work_id: str):
    image_path = tmp_path / f"{work_id}.jpg"
    Image.new("RGB", (200, 200), color=(90, 140, 90)).save(image_path, "JPEG", quality=95)
    with patch("cloudinary.uploader.upload", return_value={"secure_url": f"https://res.cloudinary.com/fake/{work_id}.jpg"}), \
         patch.object(settings, "ENABLE_CLIP", False), \
         patch.object(settings, "ENABLE_ELA", False):
        with open(image_path, "rb") as f:
            res = client.post(
                "/api/images/submit",
                headers=headers,
                files={"file": (f"{work_id}.jpg", f, "image/jpeg")},
                data={"work_id": work_id, "district": "Pune", "work_type": "bridge"},
            )
    assert res.status_code == 200, res.text
    return res


def test_submitter_cannot_read_another_agencys_work(db_session: Database, tmp_path: Path):
    owner = _register_and_login("agency_owner")
    _submit_as({"Authorization": f"Bearer {owner['access_token']}"}, tmp_path, "MP-PUN-2024-SECRET")

    intruder = _register_and_login("agency_intruder")
    res = client.get(
        "/api/images/MP-PUN-2024-SECRET", headers={"Authorization": f"Bearer {intruder['access_token']}"}
    )
    # Not a 403 — the submitter simply has no images for that work, so
    # the endpoint truthfully reports an empty set rather than
    # confirming/denying that someone else's submission exists.
    assert res.status_code == 200
    assert res.json()["count"] == 0
    assert res.json()["images"] == []


def test_submitter_can_still_read_their_own_work(db_session: Database, tmp_path: Path):
    owner = _register_and_login("agency_self")
    headers = {"Authorization": f"Bearer {owner['access_token']}"}
    _submit_as(headers, tmp_path, "MP-PUN-2024-MINE")

    res = client.get("/api/images/MP-PUN-2024-MINE", headers=headers)
    assert res.status_code == 200
    assert res.json()["count"] == 1
    assert res.json()["images"][0]["work_id"] == "MP-PUN-2024-MINE"


@pytest.mark.parametrize("role", ["reviewer", "stakeholder", "admin"])
def test_oversight_roles_see_every_submission_for_a_work(db_session: Database, tmp_path: Path, role: str):
    owner = _register_and_login(f"agency_for_{role}")
    _submit_as({"Authorization": f"Bearer {owner['access_token']}"}, tmp_path, f"MP-PUN-2024-{role.upper()}")

    overseer = _create_user_and_login(db_session, f"overseer_{role}", role)
    res = client.get(
        f"/api/images/MP-PUN-2024-{role.upper()}", headers={"Authorization": f"Bearer {overseer['access_token']}"}
    )
    assert res.status_code == 200
    assert res.json()["count"] == 1


def test_submitter_cannot_read_system_wide_oversight_views(db_session: Database):
    submitter = _register_and_login("agency_nosy")
    headers = {"Authorization": f"Bearer {submitter['access_token']}"}

    assert client.get("/api/duplicates", headers=headers).status_code == 403
    assert client.get("/api/stats", headers=headers).status_code == 403


@pytest.mark.parametrize("role", ["reviewer", "stakeholder", "admin"])
def test_oversight_roles_can_read_system_wide_views(db_session: Database, role: str):
    overseer = _create_user_and_login(db_session, f"stats_{role}", role)
    headers = {"Authorization": f"Bearer {overseer['access_token']}"}

    assert client.get("/api/duplicates", headers=headers).status_code == 200
    assert client.get("/api/stats", headers=headers).status_code == 200


def test_stats_reports_risk_level_counts(db_session: Database, tmp_path: Path):
    """by_risk_level used to be hardcoded to {} — a stub left from before
    risk_level was persisted on the record at submit time."""
    submitter = _register_and_login("agency_stats")
    _submit_as({"Authorization": f"Bearer {submitter['access_token']}"}, tmp_path, "MP-PUN-2024-STATS")

    admin = _create_user_and_login(db_session, "stats_admin", "admin")
    res = client.get("/api/stats", headers={"Authorization": f"Bearer {admin['access_token']}"})
    assert res.status_code == 200
    body = res.json()
    assert body["total_images"] == 1
    assert sum(body["by_risk_level"].values()) == 1
