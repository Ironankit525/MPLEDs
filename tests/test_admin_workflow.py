"""Tests for the Admin role slice: role-gating on /api/admin/*, user
creation with an arbitrary role, the deactivation login-block (checked
at both login and on every subsequent request), single/bulk status
override with its own audit trail, the derived activity log, and that
Reviewer/Stakeholder accounts can no longer call /api/images/submit
now that it's gated to Submitter+Admin.
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


def _register_and_login(username: str, district: str = "Pune") -> dict:
    client.post(
        "/api/auth/register",
        json={"username": username, "password": "pw", "agency_name": "PWD", "district": district},
    )
    return client.post("/api/auth/login", data={"username": username, "password": "pw"}).json()


def _create_user_and_login(db_session: Database, username: str, role: str) -> dict:
    db_session.users.insert_one(
        {
            "username": username,
            "password_hash": get_password_hash("pw"),
            "agency_name": "Test Agency",
            "district": "Pune",
            "role": role,
        }
    )
    return client.post("/api/auth/login", data={"username": username, "password": "pw"}).json()


def _make_test_image(path: Path) -> Path:
    img = Image.new("RGB", (200, 200), color=(90, 140, 90))
    img.save(path, "JPEG", quality=95)
    return path


def _submit_as(headers: dict, tmp_path: Path, work_id: str) -> dict:
    image_path = _make_test_image(tmp_path / f"{work_id}.jpg")
    with patch("cloudinary.uploader.upload", return_value={"secure_url": f"https://res.cloudinary.com/fake/{work_id}.jpg"}), \
         patch.object(settings, "ENABLE_CLIP", False), \
         patch.object(settings, "ENABLE_ELA", False):
        with open(image_path, "rb") as f:
            res = client.post(
                "/api/images/submit",
                headers=headers,
                files={"file": (f"{work_id}.jpg", f, "image/jpeg")},
                data={"work_id": work_id, "district": "Pune", "work_type": "road construction"},
            )
    return res


# ── Role gating ──────────────────────────────────────────────────────

def test_non_admin_cannot_access_admin_endpoints(db_session: Database):
    submitter = _register_and_login("plainsubmitter")
    headers = {"Authorization": f"Bearer {submitter['access_token']}"}

    assert client.get("/api/admin/users", headers=headers).status_code == 403
    assert client.get("/api/admin/submissions", headers=headers).status_code == 403
    assert client.get("/api/admin/activity", headers=headers).status_code == 403


def test_reviewer_and_stakeholder_cannot_submit_images(db_session: Database, tmp_path: Path):
    reviewer = _create_user_and_login(db_session, "onlyreviewer", "reviewer")
    stakeholder = _create_user_and_login(db_session, "onlystake", "stakeholder")

    res_r = _submit_as({"Authorization": f"Bearer {reviewer['access_token']}"}, tmp_path, "MP-PUN-2024-BLOCKED1")
    assert res_r.status_code == 403

    res_s = _submit_as({"Authorization": f"Bearer {stakeholder['access_token']}"}, tmp_path, "MP-PUN-2024-BLOCKED2")
    assert res_s.status_code == 403


def test_admin_can_submit_images(db_session: Database, tmp_path: Path):
    admin = _create_user_and_login(db_session, "sysadmin", "admin")
    res = _submit_as({"Authorization": f"Bearer {admin['access_token']}"}, tmp_path, "MP-PUN-2024-ADMINUP")
    assert res.status_code == 200, res.text


# ── User management ──────────────────────────────────────────────────

def test_admin_creates_user_with_arbitrary_role(db_session: Database):
    admin = _create_user_and_login(db_session, "adminuser1", "admin")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}

    res = client.post(
        "/api/admin/users",
        headers=headers,
        json={"username": "new_reviewer", "password": "pw", "role": "reviewer", "agency_name": "X", "district": "Y"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["role"] == "reviewer"
    assert "password_hash" not in body

    # The new account can actually log in as that role.
    login = client.post("/api/auth/login", data={"username": "new_reviewer", "password": "pw"})
    assert login.status_code == 200
    assert login.json()["role"] == "reviewer"


def test_admin_create_user_rejects_invalid_role(db_session: Database):
    admin = _create_user_and_login(db_session, "adminuser2", "admin")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}

    res = client.post(
        "/api/admin/users", headers=headers, json={"username": "bad", "password": "pw", "role": "superuser"}
    )
    assert res.status_code == 422


def test_admin_list_users_excludes_password_hash(db_session: Database):
    admin = _create_user_and_login(db_session, "adminuser3", "admin")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    _register_and_login("listedsubmitter")

    res = client.get("/api/admin/users", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["count"] >= 2
    assert all("password_hash" not in u for u in body["users"])


def test_admin_changes_user_role(db_session: Database):
    admin = _create_user_and_login(db_session, "adminuser4", "admin")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    target = _register_and_login("promoteme")
    user_id = client.get("/api/admin/users", headers=headers).json()
    target_id = next(u["id"] for u in user_id["users"] if u["username"] == "promoteme")

    res = client.patch(f"/api/admin/users/{target_id}/role", headers=headers, json={"role": "reviewer"})
    assert res.status_code == 200
    assert res.json()["role"] == "reviewer"


def test_deactivated_account_cannot_log_in(db_session: Database):
    admin = _create_user_and_login(db_session, "adminuser5", "admin")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    _register_and_login("tobedeactivated")
    users = client.get("/api/admin/users", headers=headers).json()["users"]
    target_id = next(u["id"] for u in users if u["username"] == "tobedeactivated")

    deactivate = client.patch(f"/api/admin/users/{target_id}/active", headers=headers, json={"is_active": False})
    assert deactivate.status_code == 200
    assert deactivate.json()["is_active"] is False

    login_attempt = client.post("/api/auth/login", data={"username": "tobedeactivated", "password": "pw"})
    assert login_attempt.status_code == 401


def test_deactivated_accounts_existing_token_stops_working(db_session: Database):
    """Deactivation takes effect on the NEXT request, not just at login
    — an already-issued token must stop working immediately, not after
    up to 24h (app/auth.py's get_current_user re-checks is_active)."""
    admin = _create_user_and_login(db_session, "adminuser6", "admin")
    admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}

    victim = _register_and_login("activetoken")
    victim_headers = {"Authorization": f"Bearer {victim['access_token']}"}

    # Token works before deactivation.
    assert client.get("/api/auth/me", headers=victim_headers).status_code == 200

    users = client.get("/api/admin/users", headers=admin_headers).json()["users"]
    target_id = next(u["id"] for u in users if u["username"] == "activetoken")
    client.patch(f"/api/admin/users/{target_id}/active", headers=admin_headers, json={"is_active": False})

    # Same token, now rejected.
    res = client.get("/api/auth/me", headers=victim_headers)
    assert res.status_code == 401


def test_admin_cannot_deactivate_own_account(db_session: Database):
    admin = _create_user_and_login(db_session, "selfadmin", "admin")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    users = client.get("/api/admin/users", headers=headers).json()["users"]
    self_id = next(u["id"] for u in users if u["username"] == "selfadmin")

    res = client.patch(f"/api/admin/users/{self_id}/active", headers=headers, json={"is_active": False})
    assert res.status_code == 400


# ── Submissions & override ──────────────────────────────────────────

def test_admin_submissions_lists_every_status(db_session: Database, tmp_path: Path):
    admin = _create_user_and_login(db_session, "adminuser7", "admin")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    submitter = _register_and_login("adminviewsubmitter")
    _submit_as({"Authorization": f"Bearer {submitter['access_token']}"}, tmp_path, "MP-PUN-2024-ADMLIST")

    res = client.get("/api/admin/submissions", headers=headers)
    assert res.status_code == 200
    work_ids = {i["work_id"] for i in res.json()["images"]}
    assert "MP-PUN-2024-ADMLIST" in work_ids


def test_admin_can_override_status_directly(db_session: Database, tmp_path: Path):
    admin = _create_user_and_login(db_session, "adminuser8", "admin")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    submitter = _register_and_login("overridesubmitter")
    _submit_as({"Authorization": f"Bearer {submitter['access_token']}"}, tmp_path, "MP-PUN-2024-OVERRIDE1")
    image_id = str(db_session.image_records.find_one({"work_id": "MP-PUN-2024-OVERRIDE1"})["_id"])

    res = client.post(
        f"/api/admin/submissions/{image_id}/override-status",
        headers=headers,
        json={"status": "APPROVED", "notes": "Reviewer was on leave; verified manually."},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "APPROVED"
    assert body["admin_override_by_username"] == "adminuser8"
    assert body["admin_override_previous_status"] == "PENDING_REVIEW"
    # The override must NOT fabricate a reviewer decision.
    assert body["reviewed_by_username"] is None


def test_admin_override_rejects_invalid_status(db_session: Database, tmp_path: Path):
    admin = _create_user_and_login(db_session, "adminuser9", "admin")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    submitter = _register_and_login("invalidoverridesubmitter")
    _submit_as({"Authorization": f"Bearer {submitter['access_token']}"}, tmp_path, "MP-PUN-2024-OVERRIDE2")
    image_id = str(db_session.image_records.find_one({"work_id": "MP-PUN-2024-OVERRIDE2"})["_id"])

    res = client.post(
        f"/api/admin/submissions/{image_id}/override-status", headers=headers, json={"status": "NOT_A_STATUS"}
    )
    assert res.status_code == 422


def test_admin_bulk_override(db_session: Database, tmp_path: Path):
    admin = _create_user_and_login(db_session, "adminuser10", "admin")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    submitter = _register_and_login("bulksubmitter")
    sub_headers = {"Authorization": f"Bearer {submitter['access_token']}"}
    _submit_as(sub_headers, tmp_path, "MP-PUN-2024-BULK1")
    _submit_as(sub_headers, tmp_path, "MP-PUN-2024-BULK2")
    id1 = str(db_session.image_records.find_one({"work_id": "MP-PUN-2024-BULK1"})["_id"])
    id2 = str(db_session.image_records.find_one({"work_id": "MP-PUN-2024-BULK2"})["_id"])

    res = client.post(
        "/api/admin/submissions/bulk-override-status",
        headers=headers,
        json={"image_ids": [id1, id2, "000000000000000000000000"], "status": "REJECTED", "notes": "Bulk cleanup."},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["updated_count"] == 2
    assert body["not_found_ids"] == ["000000000000000000000000"]

    assert db_session.image_records.find_one({"_id": db_session.image_records.find_one({"work_id": "MP-PUN-2024-BULK1"})["_id"]})["status"] == "REJECTED"


# ── Activity log ──────────────────────────────────────────────────────

def test_activity_log_reflects_full_lifecycle(db_session: Database, tmp_path: Path):
    admin = _create_user_and_login(db_session, "adminuser11", "admin")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    submitter = _register_and_login("activitysubmitter")
    _submit_as({"Authorization": f"Bearer {submitter['access_token']}"}, tmp_path, "MP-PUN-2024-ACTLOG")
    image_id = str(db_session.image_records.find_one({"work_id": "MP-PUN-2024-ACTLOG"})["_id"])

    reviewer = _create_user_and_login(db_session, "activityreviewer", "reviewer")
    client.post(
        f"/api/reviews/{image_id}/decide",
        headers={"Authorization": f"Bearer {reviewer['access_token']}"},
        json={"decision": "approve"},
    )

    res = client.get("/api/admin/activity", headers=headers)
    assert res.status_code == 200
    events = res.json()["events"]
    types_for_work = [e["type"] for e in events if e["work_id"] == "MP-PUN-2024-ACTLOG"]
    assert "submitted" in types_for_work
    assert "approved" in types_for_work
