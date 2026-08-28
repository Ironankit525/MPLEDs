"""Tests for the Project model and the Submitter (contractor) dashboard rollup.

Covers the three things most likely to be silently wrong in a financial
aggregate:
  - which submission statuses count as money spent (a rejected or
    still-pending claim must NOT reduce the remaining budget),
  - tenancy (one contractor's figures must never include another's),
  - and role-gating (a contractor cannot register a project, assign one
    to themselves, or mark their own milestones complete).

Plus the derived figures — progress %, overdue detection, approval rate,
and the plain-language flag categories that replace raw detector
evidence on the submitter's view.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pymongo.database import Database

from app.auth import get_password_hash
from app.config import settings
from app.database import get_db
from app.main import app
from app.models import (
    PROJECT_COMPLETED,
    PROJECT_IN_PROGRESS,
    STATUS_APPROVED,
    STATUS_REJECTED,
    STATUS_SIGNED_OFF,
)

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
        json={"username": username, "password": "pw", "agency_name": "PWD", "district": "Pune"},
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


def _headers(login: dict) -> dict:
    return {"Authorization": f"Bearer {login['access_token']}"}


def _make_test_image(path: Path) -> Path:
    img = Image.new("RGB", (200, 200), color=(90, 140, 90))
    img.save(path, "JPEG", quality=95)
    return path


def _submit(headers: dict, tmp_path: Path, work_id: str, amount: float, filename: str) -> None:
    """Upload one submission claiming `amount` against `work_id`."""
    image_path = _make_test_image(tmp_path / filename)
    with patch("cloudinary.uploader.upload", return_value={"secure_url": f"https://fake/{filename}"}), \
         patch.object(settings, "ENABLE_CLIP", False), \
         patch.object(settings, "ENABLE_ELA", False):
        with open(image_path, "rb") as f:
            res = client.post(
                "/api/images/submit",
                headers=headers,
                files={"file": (filename, f, "image/jpeg")},
                data={
                    "work_id": work_id,
                    "district": "Pune",
                    "work_type": "road construction",
                    "claimed_amount": str(amount),
                },
            )
    assert res.status_code == 200, res.text


def _set_status(db_session: Database, work_id: str, status: str) -> None:
    db_session.image_records.update_one({"work_id": work_id}, {"$set": {"status": status}})


def _create_project(admin_headers: dict, work_id: str, amount: float, assignee: str | None, **kw) -> dict:
    body = {
        "work_id": work_id,
        "title": kw.pop("title", f"Work {work_id}"),
        "district": "Pune",
        "sanctioned_amount": amount,
        "assigned_to_username": assignee,
        **kw,
    }
    res = client.post("/api/admin/projects", headers=admin_headers, json=body)
    assert res.status_code == 200, res.text
    return res.json()


# ── claimed_amount persistence ───────────────────────────────────────

class TestClaimedAmountPersisted:
    def test_claimed_amount_is_stored_on_the_record(self, db_session: Database, tmp_path: Path) -> None:
        """Regression: claimed_amount used to be passed to the OCR layer
        and then discarded, so no financial rollup was possible."""
        sub = _register_and_login("amt_sub")
        _submit(_headers(sub), tmp_path, "W-AMT-1", 12500.50, "a.jpg")

        record = db_session.image_records.find_one({"work_id": "W-AMT-1"})
        assert record["claimed_amount"] == 12500.50


# ── Role gating ──────────────────────────────────────────────────────

class TestProjectRoleGating:
    def test_submitter_cannot_create_a_project(self, db_session: Database) -> None:
        sub = _register_and_login("gate_sub")
        res = client.post(
            "/api/admin/projects",
            headers=_headers(sub),
            json={"work_id": "W-1", "title": "T", "district": "Pune", "sanctioned_amount": 1000},
        )
        assert res.status_code == 403

    def test_submitter_cannot_assign_a_project_to_themselves(self, db_session: Database) -> None:
        admin = _create_user_and_login(db_session, "gate_admin", "admin")
        _create_project(_headers(admin), "W-2", 1000, None)

        sub = _register_and_login("grabby_sub")
        res = client.patch(
            "/api/admin/projects/W-2/assign",
            headers=_headers(sub),
            json={"assigned_to_username": "grabby_sub"},
        )
        assert res.status_code == 403

    def test_submitter_cannot_mark_their_own_milestone_complete(self, db_session: Database) -> None:
        """The contractor certifying their own progress is the conflict
        of interest this module exists to remove."""
        admin = _create_user_and_login(db_session, "phase_admin", "admin")
        sub = _register_and_login("phase_sub")
        _create_project(_headers(admin), "W-3", 1000, "phase_sub", phase_names=["Foundation", "Completion"])

        res = client.patch(
            "/api/projects/W-3/phases/0",
            headers=_headers(sub),
            json={"is_complete": True},
        )
        assert res.status_code == 403

    def test_reviewer_can_mark_a_milestone_complete(self, db_session: Database) -> None:
        admin = _create_user_and_login(db_session, "phase_admin2", "admin")
        reviewer = _create_user_and_login(db_session, "phase_rev", "reviewer")
        _create_project(_headers(admin), "W-4", 1000, None, phase_names=["Foundation", "Completion"])

        res = client.patch(
            "/api/projects/W-4/phases/0",
            headers=_headers(reviewer),
            json={"is_complete": True},
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["progress_percent"] == 50.0
        assert body["progress_basis"] == "phases"
        assert body["phases"][0]["completed_by_username"] == "phase_rev"

    def test_duplicate_work_id_is_rejected(self, db_session: Database) -> None:
        admin = _create_user_and_login(db_session, "dup_admin", "admin")
        _create_project(_headers(admin), "W-DUP", 1000, None)
        res = client.post(
            "/api/admin/projects",
            headers=_headers(admin),
            json={"work_id": "W-DUP", "title": "again", "district": "Pune", "sanctioned_amount": 5},
        )
        assert res.status_code == 409

    def test_assigning_to_unknown_user_404s(self, db_session: Database) -> None:
        admin = _create_user_and_login(db_session, "unk_admin", "admin")
        res = client.post(
            "/api/admin/projects",
            headers=_headers(admin),
            json={
                "work_id": "W-UNK",
                "title": "T",
                "district": "Pune",
                "sanctioned_amount": 100,
                "assigned_to_username": "nobody_here",
            },
        )
        assert res.status_code == 404


# ── The financial rollup ─────────────────────────────────────────────

class TestDashboardFinancials:
    def test_only_approved_and_signed_off_count_as_utilised(
        self, db_session: Database, tmp_path: Path
    ) -> None:
        """The core money rule: pending and rejected claims must not
        reduce the remaining budget."""
        admin = _create_user_and_login(db_session, "fin_admin", "admin")
        sub = _register_and_login("fin_sub")
        _create_project(_headers(admin), "W-FIN-A", 100000, "fin_sub")
        _create_project(_headers(admin), "W-FIN-B", 50000, "fin_sub")

        # Four claims across the two projects, one per status.
        _submit(_headers(sub), tmp_path, "W-FIN-A", 10000, "a1.jpg")
        _set_status(db_session, "W-FIN-A", STATUS_SIGNED_OFF)          # disbursed

        _submit(_headers(sub), tmp_path, "W-FIN-B", 5000, "b1.jpg")
        _set_status(db_session, "W-FIN-B", STATUS_APPROVED)             # pending disbursement

        _submit(_headers(sub), tmp_path, "W-FIN-A", 7000, "a2.jpg")
        db_session.image_records.update_one(
            {"work_id": "W-FIN-A", "claimed_amount": 7000}, {"$set": {"status": STATUS_REJECTED}}
        )                                                                # rejected

        _submit(_headers(sub), tmp_path, "W-FIN-A", 3000, "a3.jpg")      # left PENDING_REVIEW

        res = client.get("/api/dashboard/summary", headers=_headers(sub))
        assert res.status_code == 200, res.text
        fin = res.json()["financials"]

        assert fin["sanctioned_amount"] == 150000.0
        assert fin["amount_disbursed"] == 10000.0
        assert fin["amount_pending_disbursement"] == 5000.0
        assert fin["amount_utilised"] == 15000.0          # disbursed + pending disbursement
        assert fin["amount_rejected"] == 7000.0
        assert fin["amount_awaiting_decision"] == 3000.0
        # Rejected and awaiting-decision claims do NOT come out of the budget.
        assert fin["amount_remaining"] == 135000.0
        assert fin["utilisation_percent"] == 10.0

    def test_zero_budget_does_not_divide_by_zero(self, db_session: Database) -> None:
        admin = _create_user_and_login(db_session, "zero_admin", "admin")
        sub = _register_and_login("zero_sub")
        _create_project(_headers(admin), "W-ZERO", 0, "zero_sub")

        res = client.get("/api/dashboard/summary", headers=_headers(sub))
        assert res.status_code == 200
        assert res.json()["financials"]["utilisation_percent"] == 0.0

    def test_submission_without_a_project_is_counted_as_unbudgeted(
        self, db_session: Database, tmp_path: Path
    ) -> None:
        """A claim against an unregistered work_id belongs to no budget.
        It must be surfaced, not silently dropped — dropping it would
        make the money figures quietly understate reality."""
        sub = _register_and_login("orphan_sub")
        _submit(_headers(sub), tmp_path, "W-NO-PROJECT", 9999, "o.jpg")

        res = client.get("/api/dashboard/summary", headers=_headers(sub))
        body = res.json()
        assert body["unbudgeted_submission_count"] == 1
        assert body["financials"]["amount_utilised"] == 0.0
        assert body["total_submissions"] == 1  # still counted in compliance figures


# ── Tenancy ──────────────────────────────────────────────────────────

class TestDashboardTenancy:
    def test_dashboard_excludes_another_contractors_projects_and_money(
        self, db_session: Database, tmp_path: Path
    ) -> None:
        admin = _create_user_and_login(db_session, "ten_admin", "admin")
        alice = _register_and_login("alice_contractor")
        bob = _register_and_login("bob_contractor")

        _create_project(_headers(admin), "W-ALICE", 100000, "alice_contractor")
        _create_project(_headers(admin), "W-BOB", 999999, "bob_contractor")

        _submit(_headers(alice), tmp_path, "W-ALICE", 1000, "al.jpg")
        _set_status(db_session, "W-ALICE", STATUS_SIGNED_OFF)
        _submit(_headers(bob), tmp_path, "W-BOB", 400000, "bo.jpg")
        _set_status(db_session, "W-BOB", STATUS_SIGNED_OFF)

        body = client.get("/api/dashboard/summary", headers=_headers(alice)).json()
        assert body["projects_assigned"] == 1
        assert body["financials"]["sanctioned_amount"] == 100000.0
        assert body["financials"]["amount_utilised"] == 1000.0  # not Bob's 400000
        assert body["total_submissions"] == 1

    def test_my_projects_lists_only_assigned_work(self, db_session: Database) -> None:
        admin = _create_user_and_login(db_session, "mp_admin", "admin")
        alice = _register_and_login("mp_alice")
        _register_and_login("mp_bob")

        _create_project(_headers(admin), "W-MINE", 100, "mp_alice")
        _create_project(_headers(admin), "W-THEIRS", 100, "mp_bob")
        _create_project(_headers(admin), "W-UNASSIGNED", 100, None)

        body = client.get("/api/projects/mine", headers=_headers(alice)).json()
        assert body["count"] == 1
        assert body["projects"][0]["work_id"] == "W-MINE"


# ── Portfolio & progress ─────────────────────────────────────────────

class TestPortfolioFigures:
    def test_project_status_counts_and_progress_average(self, db_session: Database) -> None:
        admin = _create_user_and_login(db_session, "port_admin", "admin")
        sub = _register_and_login("port_sub")
        admin_h = _headers(admin)

        # One fully complete (2/2 phases), one half done (1/2 phases).
        _create_project(admin_h, "W-P1", 1000, "port_sub", phase_names=["A", "B"])
        _create_project(admin_h, "W-P2", 1000, "port_sub", phase_names=["A", "B"])
        for order in (0, 1):
            client.patch(f"/api/projects/W-P1/phases/{order}", headers=admin_h, json={"is_complete": True})
        client.patch("/api/projects/W-P2/phases/0", headers=admin_h, json={"is_complete": True})

        client.patch("/api/admin/projects/W-P1/status", headers=admin_h, json={"status": PROJECT_COMPLETED})
        client.patch("/api/admin/projects/W-P2/status", headers=admin_h, json={"status": PROJECT_IN_PROGRESS})

        body = client.get("/api/dashboard/summary", headers=_headers(sub)).json()
        assert body["projects_assigned"] == 2
        assert body["projects_completed"] == 1
        assert body["projects_in_progress"] == 1
        assert body["projects_not_started"] == 0
        assert body["overall_progress_percent"] == 75.0  # mean of 100 and 50

    def test_progress_falls_back_to_status_when_no_phases_defined(self, db_session: Database) -> None:
        """With no milestones there is nothing real to measure, so the
        response must say which calculation produced the number."""
        admin = _create_user_and_login(db_session, "nophase_admin", "admin")
        sub = _register_and_login("nophase_sub")
        _create_project(_headers(admin), "W-NOPHASE", 1000, "nophase_sub")

        project = client.get("/api/projects/mine", headers=_headers(sub)).json()["projects"][0]
        assert project["progress_basis"] == "status"
        assert project["progress_percent"] == 0.0

    def test_overdue_detection_ignores_completed_work(self, db_session: Database) -> None:
        admin = _create_user_and_login(db_session, "od_admin", "admin")
        sub = _register_and_login("od_sub")
        admin_h = _headers(admin)
        past = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        future = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()

        _create_project(admin_h, "W-LATE", 100, "od_sub", expected_completion_date=past)
        _create_project(admin_h, "W-ONTIME", 100, "od_sub", expected_completion_date=future)
        _create_project(admin_h, "W-DONE-LATE", 100, "od_sub", expected_completion_date=past)
        client.patch("/api/admin/projects/W-DONE-LATE/status", headers=admin_h, json={"status": PROJECT_COMPLETED})

        body = client.get("/api/dashboard/summary", headers=_headers(sub)).json()
        # A finished work can't still be "late" — only W-LATE counts.
        assert body["projects_overdue"] == 1

        deadline_ids = [d["work_id"] for d in body["upcoming_deadlines"]]
        assert "W-DONE-LATE" not in deadline_ids
        assert deadline_ids[0] == "W-LATE"  # sorted most-overdue first
        assert body["upcoming_deadlines"][0]["days_remaining"] < 0


# ── Compliance standing ──────────────────────────────────────────────

class TestComplianceFigures:
    def test_approval_rate_counts_only_decided_submissions(
        self, db_session: Database, tmp_path: Path
    ) -> None:
        admin = _create_user_and_login(db_session, "ar_admin", "admin")
        sub = _register_and_login("ar_sub")
        _create_project(_headers(admin), "W-AR", 100000, "ar_sub")

        _submit(_headers(sub), tmp_path, "W-AR", 100, "r1.jpg")
        db_session.image_records.update_one(
            {"claimed_amount": 100}, {"$set": {"status": STATUS_APPROVED}}
        )
        _submit(_headers(sub), tmp_path, "W-AR", 200, "r2.jpg")
        db_session.image_records.update_one(
            {"claimed_amount": 200}, {"$set": {"status": STATUS_REJECTED, "reviewer_notes": "Photo is not of the site"}}
        )
        _submit(_headers(sub), tmp_path, "W-AR", 300, "r3.jpg")  # undecided

        body = client.get("/api/dashboard/summary", headers=_headers(sub)).json()
        assert body["total_submissions"] == 3
        assert body["approval_rate"] == 50.0  # 1 of 2 decided; the pending one is excluded
        assert body["action_required_count"] == 1
        assert body["action_required"][0]["reason"] == "Photo is not of the site"

    def test_flag_reasons_are_plain_language_not_detector_internals(
        self, db_session: Database, tmp_path: Path
    ) -> None:
        """Handing the contractor the raw code and its numeric evidence
        would tell them exactly how far to push before the next upload
        clears. The dashboard must expose categories only."""
        sub = _register_and_login("flag_sub")
        _submit(_headers(sub), tmp_path, "W-FLAG", 100, "f1.jpg")
        db_session.image_records.update_one(
            {"work_id": "W-FLAG"},
            {
                "$set": {
                    "risk_level": "HIGH",
                    "flags": [
                        {
                            "code": "GPS_DISTRICT_MISMATCH",
                            "severity": "HIGH",
                            "message": "internal",
                            "evidence": {"distance_km": 663.2, "threshold_km": 50.0},
                            "points_added": 30,
                        }
                    ],
                }
            },
        )

        body = client.get("/api/dashboard/summary", headers=_headers(sub)).json()
        assert body["flagged_submissions"] == 1
        assert body["flag_reasons"] == {"Photo location does not match the work site": 1}

        serialized = str(body)
        assert "GPS_DISTRICT_MISMATCH" not in serialized
        assert "663.2" not in serialized
        assert "threshold_km" not in serialized

    def test_unknown_flag_code_falls_back_to_a_generic_label(
        self, db_session: Database, tmp_path: Path
    ) -> None:
        """A future detector's code must not leak through the mapping."""
        sub = _register_and_login("newflag_sub")
        _submit(_headers(sub), tmp_path, "W-NEWFLAG", 100, "nf.jpg")
        db_session.image_records.update_one(
            {"work_id": "W-NEWFLAG"},
            {"$set": {"flags": [{"code": "SOME_FUTURE_DETECTOR", "severity": "HIGH", "message": "x", "evidence": {}}]}},
        )

        body = client.get("/api/dashboard/summary", headers=_headers(sub)).json()
        assert body["flag_reasons"] == {"Flagged for manual verification": 1}
        assert "SOME_FUTURE_DETECTOR" not in str(body)


# ── Empty state ──────────────────────────────────────────────────────

class TestEmptyDashboard:
    def test_new_contractor_gets_zeroes_not_an_error(self, db_session: Database) -> None:
        sub = _register_and_login("brand_new")
        res = client.get("/api/dashboard/summary", headers=_headers(sub))
        assert res.status_code == 200
        body = res.json()
        assert body["projects_assigned"] == 0
        assert body["total_submissions"] == 0
        assert body["approval_rate"] == 0.0
        assert body["average_risk_score"] is None
        assert body["overall_progress_percent"] == 0.0
        assert body["financials"]["amount_remaining"] == 0.0
