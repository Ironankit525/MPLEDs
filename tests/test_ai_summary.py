"""Tests for the per-role AI-drafted summaries (/api/stakeholder/ai-summary,
/api/reviews/ai-summary, /api/admin/ai-summary): role-gating on each,
graceful degradation when unconfigured or when the Gemini call fails, the
prompt-hash cache, the audience-specific figure formatters, and the
markdown sanitiser that backs the "no AI slop" formatting contract.

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


# ── Reviewer and admin variants ──────────────────────────────────────


def test_reviewer_summary_gating(db_session):
    stakeholder_headers = _stakeholder_headers(db_session)
    assert client.get("/api/reviews/ai-summary", headers=stakeholder_headers).status_code == 403

    submitter = _register_and_login("queue_submitter")
    assert (
        client.get(
            "/api/reviews/ai-summary",
            headers={"Authorization": f"Bearer {submitter['access_token']}"},
        ).status_code
        == 403
    )


def test_reviewer_summary_success(db_session):
    reviewer = _create_user_and_login(db_session, "queue_reviewer", "reviewer")
    headers = {"Authorization": f"Bearer {reviewer['access_token']}"}
    with patch.object(settings, "GEMINI_API_KEY", "test-key"), \
         patch.object(report_summary, "_call_gemini", return_value="The queue is empty.") as mock_call:
        res = client.get("/api/reviews/ai-summary", headers=headers)

    assert res.status_code == 200
    body = res.json()
    assert body["available"] is True
    assert body["summary"] == "The queue is empty."
    # The reviewer prompt is queue-shaped, not the stakeholder overview.
    prompt = mock_call.call_args[0][0]
    assert "review queue" in prompt
    assert "waiting unclaimed" in prompt


def test_admin_summary_gating(db_session):
    reviewer = _create_user_and_login(db_session, "ops_reviewer", "reviewer")
    assert (
        client.get(
            "/api/admin/ai-summary",
            headers={"Authorization": f"Bearer {reviewer['access_token']}"},
        ).status_code
        == 403
    )
    stakeholder_headers = _stakeholder_headers(db_session)
    assert client.get("/api/admin/ai-summary", headers=stakeholder_headers).status_code == 403


def test_admin_summary_success(db_session):
    admin = _create_user_and_login(db_session, "ops_admin", "admin")
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    with patch.object(settings, "GEMINI_API_KEY", "test-key"), \
         patch.object(report_summary, "_call_gemini", return_value="The system is quiet.") as mock_call:
        res = client.get("/api/admin/ai-summary", headers=headers)

    assert res.status_code == 200
    body = res.json()
    assert body["available"] is True
    assert body["summary"] == "The system is quiet."
    # The admin prompt is accounts+activity-shaped. This test's fresh db
    # holds exactly one account: the admin created above.
    prompt = mock_call.call_args[0][0]
    assert "user accounts" in prompt.lower()
    assert "Total user accounts: 1" in prompt
    assert "admin 1" in prompt


def test_each_audience_caches_separately(db_session):
    """Same database, three roles — three distinct prompts, three cache
    entries, no cross-audience reuse."""
    stakeholder_headers = _stakeholder_headers(db_session)
    reviewer = _create_user_and_login(db_session, "cache_reviewer", "reviewer")
    admin = _create_user_and_login(db_session, "cache_admin", "admin")

    with patch.object(settings, "GEMINI_API_KEY", "test-key"), \
         patch.object(report_summary, "_call_gemini", return_value="Prose.") as mock_call:
        assert client.get("/api/stakeholder/ai-summary", headers=stakeholder_headers).json()["cached"] is False
        assert (
            client.get(
                "/api/reviews/ai-summary",
                headers={"Authorization": f"Bearer {reviewer['access_token']}"},
            ).json()["cached"]
            is False
        )
        assert (
            client.get(
                "/api/admin/ai-summary",
                headers={"Authorization": f"Bearer {admin['access_token']}"},
            ).json()["cached"]
            is False
        )

    assert mock_call.call_count == 3
    assert len(report_summary._cache) == 3


# ── Audience figure formatters ───────────────────────────────────────


def test_format_reviewer_figures():
    figures = report_summary._format_reviewer_figures(
        {
            "pending_count": 5,
            "in_review_count": 2,
            "queue_by_risk_level": {"HIGH": 3, "LOW": 4},
            "oldest_pending_hours": 49.5,
            "high_risk_districts": [{"district": "Pune", "count": 2}, {"district": "Nagpur", "count": 1}],
            "decided_last_7_days": 11,
        }
    )
    assert "waiting unclaimed: 5" in figures
    assert "under review: 2" in figures
    assert "HIGH 3" in figures
    assert "49.5 hours" in figures
    assert "Pune 2, Nagpur 1" in figures
    assert "last 7 days (all reviewers): 11" in figures


def test_format_admin_figures():
    figures = report_summary._format_admin_figures(
        {
            "users_total": 7,
            "users_by_role": {"submitter": 4, "reviewer": 1, "stakeholder": 1, "admin": 1},
            "inactive_users": 1,
            "submissions_total": 12,
            "by_status": {"PENDING_REVIEW": 2, "APPROVED": 10, "IN_REVIEW": 0},
            "events_last_7_days": {"submitted": 6, "approved": 4, "admin_override": 1},
            "admin_overrides_total": 3,
        }
    )
    assert "Total user accounts: 7" in figures
    assert "submitter 4" in figures
    assert "Deactivated accounts: 1" in figures
    # Enum codes are humanized so the model's echo reads as prose.
    assert "admin override 1" in figures
    assert "approved 10" in figures
    assert "overrides ever recorded: 3" in figures
    # Zero-count statuses are noise the model would be tempted to narrate.
    assert "in review" not in figures


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


def test_tidy_preserves_underscored_identifiers():
    """Regression: _tidy used to strip underscores as markdown emphasis,
    mangling echoed identifiers (SIGNED_OFF became SIGNEDOFF in live
    output before this was caught)."""
    assert "SIGNED_OFF" in report_summary._tidy("Currently 11 SIGNED_OFF items.")


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
