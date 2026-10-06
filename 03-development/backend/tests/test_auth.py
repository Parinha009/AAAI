"""Auth: magic-link, verify, single-use, anti-enumeration (FR-04)."""

API = "/api/v1"


def test_health(client):
    r = client.get(f"{API}/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_magic_link_and_verify(client, new_candidate):
    r = client.post(f"{API}/auth/magic-link", json={"email": new_candidate["email"]})
    assert r.status_code == 202
    token = r.json()["dev_token"]
    assert token

    r = client.post(f"{API}/auth/verify", json={"token": token})
    assert r.status_code == 200
    body = r.json()
    assert body["role"] == "candidate"
    assert body["context"]["candidate_id"] == new_candidate["candidate_id"]
    assert body["session_token"]


def test_unknown_email_returns_no_token(client):
    r = client.post(f"{API}/auth/magic-link", json={"email": "nobody@nowhere.test"})
    assert r.status_code == 202
    assert r.json().get("dev_token") is None  # anti-enumeration


def test_verify_is_single_use(client, new_candidate):
    token = client.post(f"{API}/auth/magic-link", json={"email": new_candidate["email"]}).json()["dev_token"]
    assert client.post(f"{API}/auth/verify", json={"token": token}).status_code == 200
    assert client.post(f"{API}/auth/verify", json={"token": token}).status_code == 401  # reused


def test_verify_bad_token(client):
    assert client.post(f"{API}/auth/verify", json={"token": "garbage"}).status_code == 401


def test_sign_in_token_never_returned_by_default(client, recruiter_email, monkeypatch):
    """Security (FR-04 / NFR-04): the API must not hand out the sign-in token -
    otherwise anyone could log in as any registered email without the inbox."""
    from app.config import settings

    monkeypatch.setattr(settings, "expose_dev_tokens", False)
    r = client.post(f"{API}/auth/magic-link", json={"email": recruiter_email})
    assert r.status_code == 202
    assert "dev_token" not in r.json() and "dev_magic_link" not in r.json()


def test_me_returns_the_name_the_recruiter_entered(client, job_id, recruiter_headers, login):
    """The candidate page greets candidates by the name typed in the invite form."""
    import uuid

    email = f"named-{uuid.uuid4().hex[:8]}@test.local"
    r = client.post(f"{API}/jobs/{job_id}/invite", headers=recruiter_headers, json={"email": email, "name": "Dara Chen"})
    assert r.status_code == 201
    me = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {login(email)}"}).json()
    assert me["role"] == "candidate" and me["name"] == "Dara Chen" and me["email"] == email

    rec = client.get(f"{API}/auth/me", headers=recruiter_headers).json()
    assert rec["role"] == "recruiter" and rec["email"] == "recruiter@demo.local"
