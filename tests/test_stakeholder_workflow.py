"""Tests for the Stakeholder role slice: role-gating on /api/stakeholder/*,
the final-stage submissions filter, sign-off's APPROVED-only state
machine, the overview aggregates, and that a sign-off doesn't make the
submission disappear from the Reviewer's own history (cross-slice check).
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


def _submit_as(headers: dict, tmp_path: Path, work_id: str, filename: str = "work.jpg") -> dict:
    image_path = _make_test_image(tmp_path / filename)
    with patch("cloudinary.uploader.upload", return_value={"secure_url": f"https://res.cloudinary.com/fake/{filename}"}), \
         patch.object(settings, "ENABLE_CLIP", False), \
         patch.object(settings, "ENABLE_ELA", False):
        with open(image_path, "rb") as f:
            res = client.post(
                "/api/images/submit",
                headers=headers,
                files={"file": (filename, f, "image/jpeg")},
                data={"work_id": work_id, "district": "Pune", "work_type": "road construction"},
            )
    assert res.status_code == 200, res.text
    return res.json()


def _submit_and_approve(db_session: Database, tmp_path: Path, work_id: str) -> str:
    """Full pipeline up to APPROVED: submit -> claim -> approve. Returns the image id."""
    submitter = _register_and_login(f"sub_{work_id}")
    _submit_as({"Authorization": f"Bearer {submitter['access_token']}"}, tmp_path, work_id)
    image_id = str(db_session.image_records.find_one({"work_id": work_id})["_id"])

    reviewer = _create_user_and_login(db_session, f"rev_{work_id}", "reviewer")
    reviewer_headers = {"Authorization": f"Bearer {reviewer['access_token']}"}
    client.post(f"/api/reviews/{image_id}/decide", headers=reviewer_headers, json={"decision": "approve"})
    return image_id


def test_submitter_cannot_access_stakeholder_endpoints(db_session: Database):
    submitter = _register_and_login("plainsubmitter")
    headers = {"Authorization": f"Bearer {submitter['access_token']}"}

    assert client.get("/api/stakeholder/overview", headers=headers).status_code == 403
    assert client.get("/api/stakeholder/submissions", headers=headers).status_code == 403


def test_reviewer_cannot_access_stakeholder_endpoints(db_session: Database):
    reviewer = _create_user_and_login(db_session, "onlyreviewer", "reviewer")
    headers = {"Authorization": f"Bearer {reviewer['access_token']}"}

    assert client.get("/api/stakeholder/overview", headers=headers).status_code == 403


def test_stakeholder_submissions_only_shows_final_stage(db_session: Database, tmp_path: Path):
    # One pending, one approved.
    pending_submitter = _register_and_login("pendingsubmitter")
    _submit_as({"Authorization": f"Bearer {pending_submitter['access_token']}"}, tmp_path, "MP-PUN-2024-PEND")
    _submit_and_approve(db_session, tmp_path, "MP-PUN-2024-APPR")

    stakeholder = _create_user_and_login(db_session, "stake1", "stakeholder")
    headers = {"Authorization": f"Bearer {stakeholder['access_token']}"}

    res = client.get("/api/stakeholder/submissions", headers=headers)
    assert res.status_code == 200
    body = res.json()
    work_ids = {img["work_id"] for img in body["images"]}
    assert "MP-PUN-2024-APPR" in work_ids
    assert "MP-PUN-2024-PEND" not in work_ids


def test_sign_off_requires_approved_status(db_session: Database, tmp_path: Path):
    submitter = _register_and_login("neverreviewed")
    _submit_as({"Authorization": f"Bearer {submitter['access_token']}"}, tmp_path, "MP-PUN-2024-NR")
    image_id = str(db_session.image_records.find_one({"work_id": "MP-PUN-2024-NR"})["_id"])

    stakeholder = _create_user_and_login(db_session, "stake2", "stakeholder")
    headers = {"Authorization": f"Bearer {stakeholder['access_token']}"}

    res = client.post(f"/api/stakeholder/{image_id}/sign-off", headers=headers, json={})
    assert res.status_code == 400


def test_sign_off_succeeds_on_approved_submission(db_session: Database, tmp_path: Path):
    image_id = _submit_and_approve(db_session, tmp_path, "MP-PUN-2024-SO1")

    stakeholder = _create_user_and_login(db_session, "stake3", "stakeholder")
    headers = {"Authorization": f"Bearer {stakeholder['access_token']}"}

    res = client.post(
        f"/api/stakeholder/{image_id}/sign-off", headers=headers, json={"notes": "Funds cleared for release."}
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "SIGNED_OFF"
    assert body["signed_off_by_username"] == "stake3"
    assert body["signoff_notes"] == "Funds cleared for release."


def test_sign_off_twice_is_rejected(db_session: Database, tmp_path: Path):
    image_id = _submit_and_approve(db_session, tmp_path, "MP-PUN-2024-SO2")
    stakeholder = _create_user_and_login(db_session, "stake4", "stakeholder")
    headers = {"Authorization": f"Bearer {stakeholder['access_token']}"}

    first = client.post(f"/api/stakeholder/{image_id}/sign-off", headers=headers, json={})
    assert first.status_code == 200

    second = client.post(f"/api/stakeholder/{image_id}/sign-off", headers=headers, json={})
    assert second.status_code == 400


def test_signed_off_item_still_appears_in_reviewer_history(db_session: Database, tmp_path: Path):
    """Cross-slice regression: a Stakeholder's sign-off moves status to
    SIGNED_OFF, which must NOT make the item vanish from the Reviewer's
    own /api/reviews/history (built in the previous slice)."""
    submitter = _register_and_login("crosscheck2")
    _submit_as({"Authorization": f"Bearer {submitter['access_token']}"}, tmp_path, "MP-PUN-2024-X002")
    image_id = str(db_session.image_records.find_one({"work_id": "MP-PUN-2024-X002"})["_id"])

    reviewer = _create_user_and_login(db_session, "crossreviewer", "reviewer")
    reviewer_headers = {"Authorization": f"Bearer {reviewer['access_token']}"}
    client.post(f"/api/reviews/{image_id}/decide", headers=reviewer_headers, json={"decision": "approve"})

    stakeholder = _create_user_and_login(db_session, "crossstake", "stakeholder")
    client.post(
        f"/api/stakeholder/{image_id}/sign-off",
        headers={"Authorization": f"Bearer {stakeholder['access_token']}"},
        json={},
    )

    history = client.get("/api/reviews/history", headers=reviewer_headers).json()
    work_ids = {img["work_id"] for img in history["images"]}
    assert "MP-PUN-2024-X002" in work_ids


def test_overview_aggregates_are_consistent(db_session: Database, tmp_path: Path):
    # One pending, one approved-and-signed-off, one rejected.
    pending_submitter = _register_and_login("ov_pending")
    _submit_as({"Authorization": f"Bearer {pending_submitter['access_token']}"}, tmp_path, "MP-PUN-2024-OV1")

    signed_off_id = _submit_and_approve(db_session, tmp_path, "MP-PUN-2024-OV2")
    stakeholder = _create_user_and_login(db_session, "ovstake", "stakeholder")
    stake_headers = {"Authorization": f"Bearer {stakeholder['access_token']}"}
    client.post(f"/api/stakeholder/{signed_off_id}/sign-off", headers=stake_headers, json={})

    rejected_submitter = _register_and_login("ov_rejected")
    _submit_as({"Authorization": f"Bearer {rejected_submitter['access_token']}"}, tmp_path, "MP-PUN-2024-OV3")
    reject_image_id = str(db_session.image_records.find_one({"work_id": "MP-PUN-2024-OV3"})["_id"])
    reviewer = _create_user_and_login(db_session, "ov_reviewer", "reviewer")
    client.post(
        f"/api/reviews/{reject_image_id}/decide",
        headers={"Authorization": f"Bearer {reviewer['access_token']}"},
        json={"decision": "reject", "notes": "GPS mismatch."},
    )

    res = client.get("/api/stakeholder/overview", headers=stake_headers)
    assert res.status_code == 200
    body = res.json()

    assert body["total_submissions"] == 3
    assert body["by_status"]["PENDING_REVIEW"] == 1
    assert body["by_status"]["SIGNED_OFF"] == 1
    assert body["by_status"]["REJECTED"] == 1
    # 2 of 3 reached a final stage (SIGNED_OFF + REJECTED); PENDING_REVIEW hasn't.
    assert body["completion_rate"] == round(2 / 3 * 100, 1)
    assert sum(body["by_risk_level"].values()) == 3
