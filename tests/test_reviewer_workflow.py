"""Tests for the Reviewer role slice: role-gating on /api/reviews/*,
the claim/decide state machine, the 409 on a contested claim, the
required-notes-on-reject validation, and that a submitter's own
/api/images/mine reflects a reviewer's decision (cross-slice check).
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
    login_res = client.post("/api/auth/login", data={"username": username, "password": "pw"})
    return login_res.json()


def _create_reviewer_and_login(db_session: Database, username: str = "reviewer1") -> dict:
    # Public /api/auth/register can't create a reviewer (by design — see
    # app/main.py's register()), so tests bootstrap one the same way
    # scripts/create_user.py does: insert directly.
    db_session.users.insert_one(
        {
            "username": username,
            "password_hash": get_password_hash("pw"),
            "agency_name": "Pune Verification Cell",
            "district": "Pune",
            "role": "reviewer",
        }
    )
    login_res = client.post("/api/auth/login", data={"username": username, "password": "pw"})
    return login_res.json()


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


def test_submitter_cannot_access_review_queue(db_session: Database):
    submitter = _register_and_login("plainsubmitter")
    headers = {"Authorization": f"Bearer {submitter['access_token']}"}

    res = client.get("/api/reviews/queue", headers=headers)
    assert res.status_code == 403


def test_review_queue_shows_pending_submission(db_session: Database, tmp_path: Path):
    submitter = _register_and_login("queuesubmitter")
    _submit_as({"Authorization": f"Bearer {submitter['access_token']}"}, tmp_path, "MP-PUN-2024-Q001")

    reviewer = _create_reviewer_and_login(db_session)
    headers = {"Authorization": f"Bearer {reviewer['access_token']}"}

    res = client.get("/api/reviews/queue", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 1
    assert body["images"][0]["work_id"] == "MP-PUN-2024-Q001"
    assert body["images"][0]["status"] == "PENDING_REVIEW"


def test_claim_moves_to_in_review_and_records_reviewer(db_session: Database, tmp_path: Path):
    submitter = _register_and_login("claimsubmitter")
    _submit_as({"Authorization": f"Bearer {submitter['access_token']}"}, tmp_path, "MP-PUN-2024-C001")
    image_id = db_session.image_records.find_one({"work_id": "MP-PUN-2024-C001"})["_id"]

    reviewer = _create_reviewer_and_login(db_session)
    headers = {"Authorization": f"Bearer {reviewer['access_token']}"}

    res = client.post(f"/api/reviews/{image_id}/claim", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "IN_REVIEW"
    assert body["reviewed_by_username"] == "reviewer1"


def test_second_reviewer_gets_409_on_contested_claim(db_session: Database, tmp_path: Path):
    submitter = _register_and_login("contestsubmitter")
    _submit_as({"Authorization": f"Bearer {submitter['access_token']}"}, tmp_path, "MP-PUN-2024-CT001")
    image_id = db_session.image_records.find_one({"work_id": "MP-PUN-2024-CT001"})["_id"]

    reviewer_a = _create_reviewer_and_login(db_session, "reviewerA")
    reviewer_b = _create_reviewer_and_login(db_session, "reviewerB")

    res_a = client.post(f"/api/reviews/{image_id}/claim", headers={"Authorization": f"Bearer {reviewer_a['access_token']}"})
    assert res_a.status_code == 200

    res_b = client.post(f"/api/reviews/{image_id}/claim", headers={"Authorization": f"Bearer {reviewer_b['access_token']}"})
    assert res_b.status_code == 409
    assert "reviewerA" in res_b.json()["detail"]


def test_decide_approve_moves_out_of_queue_into_history(db_session: Database, tmp_path: Path):
    submitter = _register_and_login("approvesubmitter")
    _submit_as({"Authorization": f"Bearer {submitter['access_token']}"}, tmp_path, "MP-PUN-2024-A001")
    image_id = db_session.image_records.find_one({"work_id": "MP-PUN-2024-A001"})["_id"]

    reviewer = _create_reviewer_and_login(db_session)
    headers = {"Authorization": f"Bearer {reviewer['access_token']}"}
    client.post(f"/api/reviews/{image_id}/claim", headers=headers)

    res = client.post(f"/api/reviews/{image_id}/decide", headers=headers, json={"decision": "approve", "notes": "Looks legitimate."})
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "APPROVED"
    assert res.json()["reviewer_notes"] == "Looks legitimate."

    queue = client.get("/api/reviews/queue", headers=headers).json()
    assert queue["count"] == 0

    history = client.get("/api/reviews/history", headers=headers).json()
    assert history["count"] == 1
    assert history["images"][0]["work_id"] == "MP-PUN-2024-A001"


def test_decide_reject_without_notes_is_rejected_by_validation(db_session: Database, tmp_path: Path):
    submitter = _register_and_login("rejectsubmitter")
    _submit_as({"Authorization": f"Bearer {submitter['access_token']}"}, tmp_path, "MP-PUN-2024-R001")
    image_id = db_session.image_records.find_one({"work_id": "MP-PUN-2024-R001"})["_id"]

    reviewer = _create_reviewer_and_login(db_session)
    headers = {"Authorization": f"Bearer {reviewer['access_token']}"}

    res = client.post(f"/api/reviews/{image_id}/decide", headers=headers, json={"decision": "reject"})
    assert res.status_code == 422


def test_decide_reject_with_notes_succeeds(db_session: Database, tmp_path: Path):
    submitter = _register_and_login("rejectnotessubmitter")
    _submit_as({"Authorization": f"Bearer {submitter['access_token']}"}, tmp_path, "MP-PUN-2024-R002")
    image_id = db_session.image_records.find_one({"work_id": "MP-PUN-2024-R002"})["_id"]

    reviewer = _create_reviewer_and_login(db_session)
    headers = {"Authorization": f"Bearer {reviewer['access_token']}"}

    res = client.post(
        f"/api/reviews/{image_id}/decide",
        headers=headers,
        json={"decision": "reject", "notes": "GPS is 300km from the claimed district."},
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "REJECTED"


def test_deciding_an_already_decided_submission_is_rejected(db_session: Database, tmp_path: Path):
    submitter = _register_and_login("doublesubmitter")
    _submit_as({"Authorization": f"Bearer {submitter['access_token']}"}, tmp_path, "MP-PUN-2024-D001")
    image_id = db_session.image_records.find_one({"work_id": "MP-PUN-2024-D001"})["_id"]

    reviewer = _create_reviewer_and_login(db_session)
    headers = {"Authorization": f"Bearer {reviewer['access_token']}"}

    first = client.post(f"/api/reviews/{image_id}/decide", headers=headers, json={"decision": "approve"})
    assert first.status_code == 200

    second = client.post(f"/api/reviews/{image_id}/decide", headers=headers, json={"decision": "approve"})
    assert second.status_code == 400


def test_claim_nonexistent_submission_is_404(db_session: Database):
    reviewer = _create_reviewer_and_login(db_session)
    headers = {"Authorization": f"Bearer {reviewer['access_token']}"}

    res = client.post("/api/reviews/000000000000000000000000/claim", headers=headers)
    assert res.status_code == 404


def test_submitters_own_history_reflects_review_decision(db_session: Database, tmp_path: Path):
    """Cross-slice regression: the Submitter's /api/images/mine (built in
    the previous slice) must show the up-to-date status once a reviewer
    (this slice) acts on it — the two slices share one source of truth."""
    submitter = _register_and_login("crosscheck_submitter")
    submitter_headers = {"Authorization": f"Bearer {submitter['access_token']}"}
    _submit_as(submitter_headers, tmp_path, "MP-PUN-2024-X001")

    before = client.get("/api/images/mine", headers=submitter_headers).json()
    assert before["images"][0]["status"] == "PENDING_REVIEW"

    image_id = db_session.image_records.find_one({"work_id": "MP-PUN-2024-X001"})["_id"]
    reviewer = _create_reviewer_and_login(db_session)
    reviewer_headers = {"Authorization": f"Bearer {reviewer['access_token']}"}
    client.post(f"/api/reviews/{image_id}/decide", headers=reviewer_headers, json={"decision": "approve"})

    after = client.get("/api/images/mine", headers=submitter_headers).json()
    assert after["images"][0]["status"] == "APPROVED"
