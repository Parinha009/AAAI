"""Recruiter dashboard: jobs, leaderboard, candidate detail, audio playback (FR-14/15)."""

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
