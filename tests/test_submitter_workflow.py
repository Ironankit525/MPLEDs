"""Tests for the Submitter role slice: role on register/login, /api/auth/me,
persisted risk snapshot + workflow status on ImageRecord, and the
own-files-only /api/images/mine history endpoint.
"""

from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pymongo.database import Database

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


def _make_test_image(path: Path) -> Path:
    img = Image.new("RGB", (200, 200), color=(90, 140, 90))
    img.save(path, "JPEG", quality=95)
    return path


def test_register_defaults_to_submitter_role(db_session: Database):
    client.post(
        "/api/auth/register",
        json={"username": "roleuser", "password": "pw", "agency_name": "PWD", "district": "Pune"},
    )
    user = db_session.users.find_one({"username": "roleuser"})
    assert user["role"] == "submitter"


def test_login_returns_role(db_session: Database):
    token_data = _register_and_login("loginroleuser")
    assert token_data["role"] == "submitter"
    assert "access_token" in token_data


def test_me_endpoint_returns_profile_and_role(db_session: Database):
    token_data = _register_and_login("meuser")
    headers = {"Authorization": f"Bearer {token_data['access_token']}"}

    res = client.get("/api/auth/me", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["username"] == "meuser"
    assert body["role"] == "submitter"
    assert body["district"] == "Pune"


def test_submitted_image_is_persisted_with_snapshot_and_pending_status(db_session: Database, tmp_path: Path):
    token_data = _register_and_login("snapuser")
    headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    image_path = _make_test_image(tmp_path / "work.jpg")

    with patch("cloudinary.uploader.upload", return_value={"secure_url": "https://res.cloudinary.com/fake/test.jpg"}), \
         patch.object(settings, "ENABLE_CLIP", False), \
         patch.object(settings, "ENABLE_ELA", False):
        with open(image_path, "rb") as f:
            res = client.post(
                "/api/images/submit",
                headers=headers,
                files={"file": ("work.jpg", f, "image/jpeg")},
                data={"work_id": "MP-PUN-2024-9001", "district": "Pune", "work_type": "road construction"},
            )
    assert res.status_code == 200, res.text

    stored = db_session.image_records.find_one({"work_id": "MP-PUN-2024-9001"})
    assert stored["status"] == "PENDING_REVIEW"
    assert stored["submitted_by_username"] == "snapuser"
    assert stored["risk_score"] is not None
    assert stored["risk_level"] is not None
    assert isinstance(stored["flags"], list)


def test_mine_endpoint_is_own_files_only(db_session: Database, tmp_path: Path):
    """Own-files-only: user A's submission must not appear in user B's
    /api/images/mine, even though both are visible via /api/images/{work_id}."""
    a = _register_and_login("ownerA")
    b = _register_and_login("ownerB")
    headers_a = {"Authorization": f"Bearer {a['access_token']}"}
    headers_b = {"Authorization": f"Bearer {b['access_token']}"}

    image_path = _make_test_image(tmp_path / "a_work.jpg")
    with patch("cloudinary.uploader.upload", return_value={"secure_url": "https://res.cloudinary.com/fake/a.jpg"}), \
         patch.object(settings, "ENABLE_CLIP", False), \
         patch.object(settings, "ENABLE_ELA", False):
        with open(image_path, "rb") as f:
            client.post(
                "/api/images/submit",
                headers=headers_a,
                files={"file": ("a_work.jpg", f, "image/jpeg")},
                data={"work_id": "MP-PUN-2024-9101", "district": "Pune", "work_type": "road construction"},
            )

    mine_a = client.get("/api/images/mine", headers=headers_a).json()
    mine_b = client.get("/api/images/mine", headers=headers_b).json()

    assert mine_a["count"] == 1
    assert mine_a["images"][0]["work_id"] == "MP-PUN-2024-9101"
    assert mine_a["images"][0]["status"] == "PENDING_REVIEW"
    assert mine_b["count"] == 0


def test_work_id_lookup_still_works_after_record_to_response_change(db_session: Database, tmp_path: Path):
    """GET /api/images/{work_id} exercises the same _record_to_response
    conversion as /mine — regression check for the _id -> id normalisation."""
    token_data = _register_and_login("lookupuser")
    headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    image_path = _make_test_image(tmp_path / "lookup.jpg")

    with patch("cloudinary.uploader.upload", return_value={"secure_url": "https://res.cloudinary.com/fake/lookup.jpg"}), \
         patch.object(settings, "ENABLE_CLIP", False), \
         patch.object(settings, "ENABLE_ELA", False):
        with open(image_path, "rb") as f:
            client.post(
                "/api/images/submit",
                headers=headers,
                files={"file": ("lookup.jpg", f, "image/jpeg")},
                data={"work_id": "MP-PUN-2024-9201", "district": "Pune", "work_type": "road construction"},
            )

    res = client.get("/api/images/MP-PUN-2024-9201", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["count"] == 1
    assert body["images"][0]["id"]
