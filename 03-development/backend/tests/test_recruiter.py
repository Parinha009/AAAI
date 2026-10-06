"""Recruiter dashboard: jobs, leaderboard, candidate detail, audio playback (FR-14/15)."""

import uuid

from tests.conftest import consent

API = "/api/v1"


def test_jobs_rbac(client, candidate_headers, recruiter_headers):
    assert client.get(f"{API}/jobs").status_code == 401                       # unauth
    assert client.get(f"{API}/jobs", headers=candidate_headers).status_code == 403  # candidate blocked
    r = client.get(f"{API}/jobs", headers=recruiter_headers)
    assert r.status_code == 200
    assert len(r.json()["jobs"]) >= 1


def test_leaderboard_is_ranked(client, recruiter_headers, scored_candidate):
    r = client.get(f"{API}/jobs/{scored_candidate['job_id']}/leaderboard", headers=recruiter_headers)
    assert r.status_code == 200
    cands = r.json()["candidates"]
    aggs = [c["aggregate_score"] for c in cands]
    assert aggs == sorted(aggs, reverse=True)  # high → low
    assert any(
        c["candidate_id"] == scored_candidate["candidate_id"] and c["aggregate_score"] == 20
        for c in cands
    )


def test_candidate_detail(client, recruiter_headers, scored_candidate):
    r = client.get(f"{API}/candidates/{scored_candidate['candidate_id']}", headers=recruiter_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["candidate"]["candidate_id"] == scored_candidate["candidate_id"]
    assert body["score"]["aggregate_score"] == 20
    assert body["review_reasons"] == []  # perfect score, no flags


def test_leaderboard_missing_job(client, recruiter_headers):
    assert client.get(f"{API}/jobs/999999/leaderboard", headers=recruiter_headers).status_code == 404


def test_audio_playback(client, login, new_candidate, recruiter_headers):
    h = {"Authorization": f"Bearer {login(new_candidate['email'])}"}
    consent(client, h)
    up = client.post(
        f"{API}/interview/responses", headers=h,
        files={"audio": ("a.webm", b"\0" * 4096, "audio/webm")},
        data={"question_id": "1", "type": "base"},
    )
    rid = up.json()["response_id"]

    # recruiter can stream the audio bytes
    r = client.get(f"{API}/responses/{rid}/audio", headers=recruiter_headers)
    assert r.status_code == 200
    assert len(r.content) > 0

    # candidate lacks PLAY_AUDIO permission
    assert client.get(f"{API}/responses/{rid}/audio", headers=h).status_code == 403


# --- Recruiter invites a candidate (FR-04: invited, never self-registered) ---

def _new_email():
    return f"invitee-{uuid.uuid4().hex[:10]}@test.local"


def test_invite_new_candidate_can_sign_in(client, recruiter_headers, job_id):
    email = _new_email()
    r = client.post(f"{API}/jobs/{job_id}/invite", headers=recruiter_headers,
                    json={"email": email, "name": "New Person"})
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == email
    assert body["candidate_status"] == "invited"

    # the invitee signs in with the link from their email
    v = client.post(f"{API}/auth/verify", json={"token": body["dev_token"]})
    assert v.status_code == 200
    assert v.json()["role"] == "candidate"
    assert v.json()["context"]["candidate_id"] == body["candidate_id"]


def test_reinvite_resends_without_duplicating(client, recruiter_headers, job_id):
    email = _new_email()
    a = client.post(f"{API}/jobs/{job_id}/invite", headers=recruiter_headers, json={"email": email}).json()
    b = client.post(f"{API}/jobs/{job_id}/invite", headers=recruiter_headers, json={"email": email}).json()
    assert a["candidate_id"] == b["candidate_id"]   # same candidate
    assert a["dev_token"] != b["dev_token"]         # fresh link each time


def test_invite_rbac_and_validation(client, candidate_headers, recruiter_headers, job_id):
    url = f"{API}/jobs/{job_id}/invite"
    assert client.post(url, json={"email": _new_email()}).status_code == 401                            # not signed in
    assert client.post(url, headers=candidate_headers, json={"email": _new_email()}).status_code == 403  # candidates can't invite
    assert client.post(f"{API}/jobs/999999/invite", headers=recruiter_headers,
                       json={"email": _new_email()}).status_code == 404                                  # no such job
    assert client.post(url, headers=recruiter_headers, json={"email": "not-an-email"}).status_code == 422
    assert client.post(url, headers=recruiter_headers,
                       json={"email": "recruiter@demo.local"}).status_code == 409                        # recruiter email


def test_job_candidates_lists_scored_and_unscored(client, recruiter_headers, candidate_headers,
                                                   new_candidate, scored_candidate, job_id):
    r = client.get(f"{API}/jobs/{job_id}/candidates", headers=recruiter_headers)
    assert r.status_code == 200
    by_id = {c["candidate_id"]: c for c in r.json()["candidates"]}
    assert by_id[scored_candidate["candidate_id"]]["aggregate_score"] == 20   # scored
    assert by_id[new_candidate["candidate_id"]]["aggregate_score"] is None    # not scored yet — never faked
    # candidates can't list other candidates
    assert client.get(f"{API}/jobs/{job_id}/candidates", headers=candidate_headers).status_code == 403


def test_candidate_audit_trail(client, candidate_headers, new_candidate, recruiter_headers):
    from tests.conftest import consent

    consent(client, candidate_headers)
    client.post(f"{API}/interview/events/tab-out", headers=candidate_headers, json={"question_id": 1})
    cid = new_candidate["candidate_id"]

    r = client.get(f"{API}/candidates/{cid}/audit", headers=recruiter_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["candidate_id"] == cid
    types = [e["event_type"] for e in body["events"]]
    assert types == ["CONSENT", "TAB_OUT"]  # chronological
    ids = [e["log_id"] for e in body["events"]]
    assert ids == sorted(ids)

    assert client.get(f"{API}/candidates/999999/audit", headers=recruiter_headers).status_code == 404
    assert client.get(f"{API}/candidates/{cid}/audit", headers=candidate_headers).status_code == 403


def test_reinvite_after_completed_interview_starts_a_new_one(client, job_id, recruiter_headers, login):
    """Same email can interview again: a finished interview is kept, a new one is created,
    and the sign-in link opens the new one. Mid-interview re-invites just re-send."""
    import uuid

    from app.database import SessionLocal
    from app.models import Candidate

    email = f"again-{uuid.uuid4().hex[:8]}@test.local"
    first = client.post(f"{API}/jobs/{job_id}/invite", headers=recruiter_headers, json={"email": email, "name": "Again"})
    assert first.status_code == 201 and first.json()["new_interview"] is False
    first_id = first.json()["candidate_id"]

    # still open -> re-send, same interview
    again = client.post(f"{API}/jobs/{job_id}/invite", headers=recruiter_headers, json={"email": email})
    assert again.json()["candidate_id"] == first_id and again.json()["new_interview"] is False

    db = SessionLocal()
    try:
        db.get(Candidate, first_id).status = "completed"
        db.commit()
    finally:
        db.close()

    second = client.post(f"{API}/jobs/{job_id}/invite", headers=recruiter_headers, json={"email": email.upper()})
    assert second.status_code == 201
    body = second.json()
    assert body["new_interview"] is True and body["candidate_id"] != first_id
    assert body["candidate_status"] == "invited" and body["name"] == "Again"  # name carried over

    # signing in with the same email opens the NEW interview
    token = login(email)
    me = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert me["candidate_id"] == body["candidate_id"] and me["candidate_status"] == "invited"

    # both interviews stay visible to the recruiter
    ids = {c["candidate_id"] for c in client.get(f"{API}/jobs/{job_id}/candidates", headers=recruiter_headers).json()["candidates"]}
    assert {first_id, body["candidate_id"]} <= ids


def test_wrong_account_type_gets_403(client, recruiter_headers, candidate_headers):
    """The dashboards rely on this: a recruiter session on candidate routes (and vice
    versa) is refused with 403, which the UI turns into a 'signed in as...' screen."""
    assert client.get(f"{API}/interview/status", headers=recruiter_headers).status_code == 403
    assert client.get(f"{API}/jobs", headers=candidate_headers).status_code == 403
