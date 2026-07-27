# AAAI Backend

FastAPI + PostgreSQL backend for the Automated Asynchronous AI Interviewer.

## Stack
- **FastAPI** — REST API
- **SQLAlchemy 2.0** — ORM / schema
- **Alembic** — migrations
- **PostgreSQL 16** — relational store with enforced foreign keys (SRS-2.5)

## Schema (this slice)
Five core tables, all foreign-keyed for relational integrity:

| Table | Purpose | Key refs |
|-------|---------|----------|
| `jobs` | Role config: base questions, rubric/follow-up prompts | — |
| `candidates` | Invited person + consent record (FR-01) | `job_id → jobs` |
| `responses` | One recorded answer + transcript (FR-06/07) | `candidate_id`, `job_id` |
| `scores` | Structured 4-trait scorecard 1–5 (FR-03) | `candidate_id` (unique), `job_id` |
| `audit_logs` | **Append-only** AI + anti-cheat trail (FR-13/NFR-01) | `candidate_id`, `job_id` |

`audit_logs` is immutable at the **database** level: a trigger blocks
`UPDATE`, `DELETE`, and `TRUNCATE`, satisfying NFR-01's fit criterion
("a database-level attempt to modify or delete an existing AuditLogs row fails").

## Setup

```bash
# 1. Create + activate a virtualenv, install deps
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt

# 2. Copy env and start Postgres
copy .env.example .env         # Windows  (cp on macOS/Linux)
docker compose up -d db

# 3. Run migrations
alembic upgrade head

# 4. Run the API
uvicorn app.main:app --reload
```

Health checks: `GET /health` and `GET /health/db`.

> **Port note:** the container publishes Postgres on host port **5433** (not 5432)
> to avoid clashing with a native Postgres install. The URL in `.env` already
> reflects this.

## Migrations

```bash
alembic upgrade head      # apply
alembic downgrade base    # roll back to empty
alembic revision -m "..." # new migration (autogenerate off by default)
```

## API routes (candidate flow slice)

Seed a demo job first so there are questions to fetch:

```bash
python -m app.seed          # prints JOB_ID
```

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| POST | `/api/auth/request-link` | Request a passwordless sign-in link (FR-04) | — |
| POST | `/api/auth/verify` | Exchange a single-use link token for a role-scoped session (FR-04) | — |
| POST | `/api/auth/dev-login` | **Dev-only** shortcut that skips email (invite/testing helper) | — |
| GET | `/api/auth/me` | Current candidate session info | Bearer (candidate) |
| GET | `/api/recruiter/me` | Current recruiter session info | Bearer (recruiter) |
| POST | `/api/interview/consent` | Log consent (FR-01); appends a CONSENT audit row | Bearer |
| GET | `/api/interview/questions` | Ordered base questions + 5:00 timer (FR-05); **403 until consent** | Bearer + consent |
| POST | `/api/interview/responses` | Upload a recorded answer — 20 MB cap, type allow-list (FR-06) | Bearer + consent |
| GET | `/api/interview/responses` | List the candidate's responses | Bearer + consent |
| POST | `/api/interview/processing` | Start stub async job (FR-17) | Bearer |
| GET | `/api/interview/processing/{task_id}` | Poll job: queued → processing → complete | Bearer |

**Audio upload (FR-06):** `multipart/form-data` with `file` (webm/mp4/wav/m4a, ≤20 MB),
`response_type` (`base`/`follow_up`), and `question_index` (required for base). Oversized
files are rejected with **413** and never persisted; bad types get **415**. Only the file
*path* is stored in Postgres; the audio lives under `media/<candidate_id>/`. A successful
upload enqueues transcription (FR-07, currently a stub).

**Magic-link flow (FR-04):** `POST /request-link` (email + role, `job_id` for candidates)
→ in development the response includes `dev_magic_link` / `dev_token` (real email is
logged, not sent) → `POST /verify` with the token → copy `access_token` → in `/docs`
click **Authorize** and paste it → `POST /consent` → `GET /questions`.

Tokens are **single-use** and expire after 15 min; sessions are **role-scoped** — a
candidate token is rejected (403) from `/api/recruiter/*` and vice versa. `dev-login`
remains as a convenience for local testing but is not the production path.
