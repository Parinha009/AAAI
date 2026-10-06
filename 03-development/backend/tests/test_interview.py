"""Interview flow: consent gate (FR-01), upload validation (FR-06),
tab-out + audit immutability (FR-12/13)."""

from sqlalchemy import text

from app.database import SessionLocal
from app.models import AuditLog
from tests.conftest import consent

API = "/api/v1"


def test_consent_gate(client, candidate_headers):
    h = candidate_headers
    # questions blocked before consent
    r = client.get(f"{API}/interview/questions", headers=h)
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "CONSENT_REQUIRED"

    # agreed must be true
    bad = client.post(f"{API}/interview/consent", headers=h, json={"consent_version": "v1", "agreed": False})
    assert bad.status_code == 422

    # consent, then questions unlock
    ok = consent(client, h)
    assert ok.status_code == 201
    assert ok.json()["candidate_status"] == "consented"

    r = client.get(f"{API}/interview/questions", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["question_seconds"] == 120  # 2:00 per question
    assert body["base_round_seconds"] == 120 * len(body["questions"])
    qs = r.json()["questions"]
    assert [q["order"] for q in qs] == list(range(1, len(qs) + 1))
    assert all(q["question_id"] >= 1 and q["text"] for q in qs)


def test_upload_validation(client, candidate_headers):
    h = candidate_headers
    consent(client, h)

    # valid
    r = client.post(f"{API}/interview/responses", headers=h,
                    files={"audio": ("a.webm", b"\0" * 4096, "audio/webm")},
                    data={"question_id": "1", "type": "base"})
    assert r.status_code == 201
    assert r.json()["status"] == "transcribing"

    # wrong type -> 415
    r = client.post(f"{API}/interview/responses", headers=h,
                    files={"audio": ("a.txt", b"hello", "text/plain")},
                    data={"question_id": "2", "type": "base"})
    assert r.status_code == 415

    # oversized -> 413
    big = b"\0" * (21 * 1024 * 1024)
    r = client.post(f"{API}/interview/responses", headers=h,
                    files={"audio": ("a.webm", big, "audio/webm")},
                    data={"question_id": "3", "type": "base"})
    assert r.status_code == 413


def test_tab_out_logged_and_audit_is_immutable(client, candidate_headers, new_candidate):
    h = candidate_headers
    r = client.post(f"{API}/interview/events/tab-out", headers=h, json={"question_id": 1})
    assert r.status_code == 202
    assert r.json()["status"] == "logged"

    db = SessionLocal()
    try:
        n = (
            db.query(AuditLog)
            .filter(AuditLog.candidate_id == new_candidate["candidate_id"], AuditLog.event_type == "TAB_OUT")
            .count()
        )
        assert n >= 1

        # auditlogs is append-only — a raw UPDATE must be rejected by the DB trigger
        blocked = False
        try:
            db.execute(
                text("UPDATE auditlogs SET event_type='CONSENT' WHERE candidate_id=:c"),
                {"c": new_candidate["candidate_id"]},
            )
            db.commit()
        except Exception:
            blocked = True
            db.rollback()
        assert blocked, "auditlogs UPDATE should be blocked by the DB trigger"
    finally:
        db.close()
