"""Tests for the AI-drafted overview summary (/api/stakeholder/ai-summary):
role-gating, graceful degradation when unconfigured or when the Gemini
call fails, the figures-hash cache, and the markdown sanitiser that
backs the "no AI slop" formatting contract.

The Gemini HTTP call itself is always mocked — these tests verify the
wiring and degradation behaviour, not the model's prose.
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app import report_summary
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


@pytest.fixture(autouse=True)
def clear_summary_cache():
    """The module cache is keyed by figures-hash, which is identical across
    tests that use the same (empty) database — clear it so tests can't
    leak generated summaries into each other."""
    report_summary._cache.clear()
    yield
    report_summary._cache.clear()


def _register_and_login(username: str) -> dict:
    client.post(
        "/api/auth/register",
        json={"username": username, "password": "pw", "agency_name": "PWD", "district": "Pune"},
    )
    return client.post("/api/auth/login", data={"username": username, "password": "pw"}).json()


def _create_user_and_login(db_session, username: str, role: str) -> dict:
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


def _stakeholder_headers(db_session) -> dict:
    token = _create_user_and_login(db_session, "summary_stakeholder", "stakeholder")
    return {"Authorization": f"Bearer {token['access_token']}"}


# ── Role gating ──────────────────────────────────────────────────────


def test_submitter_and_reviewer_cannot_access_ai_summary(db_session):
    submitter = _register_and_login("summary_submitter")
    assert (
        client.get(
            "/api/stakeholder/ai-summary",
            headers={"Authorization": f"Bearer {submitter['access_token']}"},
        ).status_code
        == 403
    )

    reviewer = _create_user_and_login(db_session, "summary_reviewer", "reviewer")
    assert (
        client.get(
            "/api/stakeholder/ai-summary",
            headers={"Authorization": f"Bearer {reviewer['access_token']}"},
        ).status_code
        == 403
    )


def test_ai_summary_requires_auth(db_session):
    assert client.get("/api/stakeholder/ai-summary").status_code == 401


# ── Graceful degradation ─────────────────────────────────────────────


def test_unconfigured_key_returns_available_false_not_error(db_session):
    headers = _stakeholder_headers(db_session)
    with patch.object(settings, "GEMINI_API_KEY", ""):
        res = client.get("/api/stakeholder/ai-summary", headers=headers)

    assert res.status_code == 200
    body = res.json()
    assert body["available"] is False
    assert body["reason"] == "not_configured"
    assert body["summary"] is None


def test_generation_failure_returns_available_false_not_error(db_session):
    headers = _stakeholder_headers(db_session)
    with patch.object(settings, "GEMINI_API_KEY", "test-key"), \
         patch.object(report_summary, "_call_gemini", side_effect=RuntimeError("API down")):
        res = client.get("/api/stakeholder/ai-summary", headers=headers)

    assert res.status_code == 200
    body = res.json()
    assert body["available"] is False
    assert body["reason"] == "generation_failed"


# ── Successful generation ────────────────────────────────────────────


def test_successful_generation_returns_summary(db_session):
    headers = _stakeholder_headers(db_session)
    prose = "No submissions have been received yet.\n\nThe pipeline is idle."
    with patch.object(settings, "GEMINI_API_KEY", "test-key"), \
         patch.object(report_summary, "_call_gemini", return_value=prose):
        res = client.get("/api/stakeholder/ai-summary", headers=headers)

    assert res.status_code == 200
    body = res.json()
    assert body["available"] is True
    assert body["summary"] == prose
    assert body["model"] == settings.GEMINI_MODEL
    assert body["cached"] is False
    assert body["generated_at"] is not None


def test_second_call_with_same_figures_is_cached(db_session):
    headers = _stakeholder_headers(db_session)
    with patch.object(settings, "GEMINI_API_KEY", "test-key"), \
         patch.object(report_summary, "_call_gemini", return_value="Steady state.") as mock_call:
        first = client.get("/api/stakeholder/ai-summary", headers=headers).json()
        second = client.get("/api/stakeholder/ai-summary", headers=headers).json()

    assert mock_call.call_count == 1
    assert first["cached"] is False
    assert second["cached"] is True
    assert second["summary"] == first["summary"]


# ── The anti-slop sanitiser ──────────────────────────────────────────


def test_tidy_strips_markdown_artifacts():
    slop = (
        "## Summary\n\n"
        "**Overall**, the pipeline shows:\n"
        "- 42 submissions\n"
        "1. Pune leads with *3* high-risk cases\n\n\n\n"
        "`completion` sits at 83.3%.  "
    )
    cleaned = report_summary._tidy(slop)

    for symbol in ("#", "*", "`", "- 42", "1. "):
        assert symbol not in cleaned
    assert "42 submissions" in cleaned
    assert "83.3%" in cleaned
    assert "\n\n\n" not in cleaned


def test_format_figures_uses_only_computed_numbers():
    overview = {
        "total_submissions": 4,
        "by_status": {"PENDING_REVIEW": 1, "APPROVED": 3, "IN_REVIEW": 0},
        "by_risk_level": {"LOW": 3, "HIGH": 1},
        "completion_rate": 75.0,
        "avg_hours_to_decision": 12.4,
        "daily_volume": [{"date": "2026-08-27", "count": 3}, {"date": "2026-08-28", "count": 1}],
        "top_flagged_districts": [{"district": "Pune", "high_risk_count": 1}],
    }
    figures = report_summary._format_figures(overview)

    assert "Total submissions: 4" in figures
    assert "Pune 1" in figures
    assert "busiest day 2026-08-27 with 3" in figures
    assert "12.4" in figures
    # Zero-count statuses are noise the model would be tempted to narrate.
    assert "IN_REVIEW" not in figures
