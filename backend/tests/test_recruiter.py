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
