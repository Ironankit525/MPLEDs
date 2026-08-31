from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pymongo.database import Database
from datetime import datetime, timedelta

from app.config import settings
from app.main import app
from app.models import User, CameraSession, District
from app.auth import get_password_hash
from app.database import get_db

client = TestClient(app)

@pytest.fixture
def db_session():
    import mongomock
    mongo_client = mongomock.MongoClient()
    db = mongo_client.test_db
    
    # Override get_db dependency
    app.dependency_overrides[get_db] = lambda: db
    
    yield db
    
    app.dependency_overrides.clear()


def test_register_user(db_session: Database):
    response = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "password": "testpassword",
            "agency_name": "Test Agency",
            "district": "Pune"
        }
    )
    assert response.status_code == 201
    assert response.json()["message"] == "User created successfully"
    
    # Check if user is in DB
    user = db_session.users.find_one({"username": "testuser"})
    assert user is not None
    assert user["agency_name"] == "Test Agency"


def test_public_registration_cannot_choose_a_privileged_role(db_session: Database):
    response = client.post(
        "/api/auth/register",
        json={
            "username": "role-escalation-attempt",
            "password": "testpassword",
            "agency_name": "Untrusted Agency",
            "district": "Pune",
            "role": "admin",
        },
    )

    assert response.status_code == 201
    user = db_session.users.find_one({"username": "role-escalation-attempt"})
    assert user["role"] == "submitter"


def test_hard_coded_demo_token_is_not_accepted(db_session: Database):
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer demo-token"},
    )

    assert response.status_code == 401


def test_login_success(db_session: Database):
    # Register first
    client.post(
        "/api/auth/register",
        json={
            "username": "loginuser",
            "password": "loginpassword",
            "agency_name": "Test",
            "district": "Pune"
        }
    )
    
    response = client.post(
        "/api/auth/login",
        data={"username": "loginuser", "password": "loginpassword"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_failure(db_session: Database):
    response = client.post(
        "/api/auth/login",
        data={"username": "wronguser", "password": "wrongpassword"}
    )
    assert response.status_code == 401


def test_camera_session_flow(db_session: Database):
    # Setup user
    client.post("/api/auth/register", json={"username": "sessuser", "password": "pw", "agency_name": "A", "district": "D"})
    login_res = client.post("/api/auth/login", data={"username": "sessuser", "password": "pw"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Create session
    res_create = client.post("/api/sessions/create", headers=headers)
    assert res_create.status_code == 200
    session_data = res_create.json()
    assert "token" in session_data
    cam_token = session_data["token"]
    
    # 2. Validate session
    res_val = client.post("/api/sessions/validate", headers=headers, json={"token": cam_token})
    assert res_val.status_code == 200
    assert res_val.json()["valid"] is True
    
    # 3. Mark session used (simulate upload)
    db_session.sessions.update_one({"token": cam_token}, {"$set": {"is_used": True}})
    
    # 4. Validate again (should be invalid)
    res_val2 = client.post("/api/sessions/validate", headers=headers, json={"token": cam_token})
    assert res_val2.status_code == 200
    assert res_val2.json()["valid"] is False
    assert res_val2.json()["reason"] == "Token already used"


def _make_test_image(path: Path) -> Path:
    img = Image.new("RGB", (200, 200), color=(90, 140, 90))
    img.save(path, "JPEG", quality=95)
    return path


def test_submit_consumes_camera_session_and_blocks_reuse(db_session: Database, tmp_path: Path) -> None:
    """End-to-end: the anti-gallery-upload gate the auth/session system
    exists for. A camera session token is single-use — the first
    /api/images/submit that presents it succeeds and consumes it; a
    second submit reusing the same token (as if someone tried to
    replay an old capture) is rejected outright, before assessment.

    This is the one path that stayed unverified while app/main.py had
    its syntax error, since nothing could import far enough to reach
    it. cloudinary.uploader.upload is mocked — this test exercises the
    session-consumption logic, not a real network upload to whatever
    account CLOUDINARY_CLOUD_NAME in .env points at.
    """
    client.post(
        "/api/auth/register",
        json={"username": "fieldofficer", "password": "pw", "agency_name": "PWD", "district": "Pune"},
    )
    login_res = client.post("/api/auth/login", data={"username": "fieldofficer", "password": "pw"})
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    cam_token = client.post("/api/sessions/create", headers=headers).json()["token"]

    image_path = _make_test_image(tmp_path / "site_photo.jpg")

    with patch("cloudinary.uploader.upload", return_value={"secure_url": "https://res.cloudinary.com/fake/test.jpg"}), \
         patch.object(settings, "ENABLE_CLIP", False), \
         patch.object(settings, "ENABLE_ELA", False):
        with open(image_path, "rb") as f:
            first = client.post(
                "/api/images/submit",
                headers=headers,
                files={"file": ("site_photo.jpg", f, "image/jpeg")},
                data={
                    "work_id": "MP-PUN-2024-0500",
                    "district": "Pune",
                    "work_type": "road construction",
                    "session_token": cam_token,
                },
            )
        assert first.status_code == 200, first.text
        assert first.json()["risk_score"] is not None

        # The token should now be marked used in the database.
        stored = db_session.sessions.find_one({"token": cam_token})
        assert stored["is_used"] is True

        # Replaying the same session token on a second submit — e.g. an
        # old photo being resubmitted under a different work — must be
        # rejected, not silently accepted a second time.
        with open(image_path, "rb") as f:
            second = client.post(
                "/api/images/submit",
                headers=headers,
                files={"file": ("site_photo.jpg", f, "image/jpeg")},
                data={
                    "work_id": "MP-PUN-2024-0501",
                    "district": "Pune",
                    "work_type": "road construction",
                    "session_token": cam_token,
                },
            )
        assert second.status_code == 400
        assert "already used" in second.json()["detail"].lower()


def test_login_token_lives_the_documented_24_hours(db_session: Database):
    """Regression: /api/auth/login used to call create_access_token()
    without expires_delta, silently falling into its 15-minute fallback —
    every session died mid-use despite ACCESS_TOKEN_EXPIRE_MINUTES (and
    the README) saying 24h."""
    from jose import jwt as jose_jwt

    from app.auth import ALGORITHM, SECRET_KEY

    client.post(
        "/api/auth/register",
        json={"username": "longlived", "password": "pw", "agency_name": "A", "district": "Pune"},
    )
    token = client.post(
        "/api/auth/login", data={"username": "longlived", "password": "pw"}
    ).json()["access_token"]

    claims = jose_jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    lifetime_hours = (datetime.utcfromtimestamp(claims["exp"]) - datetime.utcnow()).total_seconds() / 3600
    assert lifetime_hours > 23, f"token lives only {lifetime_hours:.2f}h — the 15-minute fallback is back"
