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

Health checks: `GET /api/v1/health` and `GET /api/v1/health/db`.

> **Port note:** the container publishes Postgres on host port **5433** (not 5432)
> to avoid clashing with a native Postgres install. The URL in `.env` already
> reflects this.

## Migrations

```bash
alembic upgrade head      # apply
alembic downgrade base    # roll back to empty
alembic revision -m "..." # new migration (autogenerate off by default)
```

## API routes — aligned to **API Contract v1**

All routes are under **`/api/v1`**. Every non-2xx response uses the standard
envelope `{ "error": { "code", "message", "details" } }`. Seed demo data first:

```bash
python -m app.seed   # prints JOB_ID (int), CANDIDATE_EMAIL, RECRUITER_EMAIL
```

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | `/api/v1/health` | Liveness (`{status,time}`) | — |
| POST | `/api/v1/auth/magic-link` | Request a passwordless sign-in link (FR-04) → 202 | — |
| POST | `/api/v1/auth/verify` | Trade a link token for a role-scoped session (FR-04) | — |
| GET | `/api/v1/auth/me` | Who am I? (both roles) | Bearer |
| POST | `/api/v1/interview/consent` | Record consent (FR-01) → 201; appends CONSENT audit row | Bearer (candidate) |
| GET | `/api/v1/interview/questions` | Base questions + 5:00 timer (FR-05); **403 until consent** | Bearer + consent |
| POST | `/api/v1/interview/responses` | Upload one answer — 20 MB cap, type allow-list (FR-02/06) → 201 | Bearer + consent |
| GET | `/api/v1/interview/responses/{id}` | Poll transcription status (FR-07/17) | Bearer + consent |
| POST | `/api/v1/interview/events/tab-out` | Log a tab-switch (FR-12) → 202 | Bearer (candidate) |
| GET | `/api/v1/interview/status` | Screen-flow driver (FR-17) | Bearer (candidate) |

**IDs are integers** (`job_id`, `candidate_id`, `response_id` …) per the contract.

**Audio upload:** `multipart/form-data` with `audio` (webm/mp4/wav/m4a, ≤20 MB),
`question_id` (0 = follow-up), and `type` (`base`/`follow_up`). Oversized → **413**
(never persisted); bad type → **415**. Only the file *path* is stored (audio lives
under `media/<candidate_id>/`). Upload returns `status: "transcribing"`; the frontend
polls `GET /responses/{id}` until final. Transcription itself (FR-07) is still a stub.

**Magic-link flow (FR-04):** `POST /auth/magic-link` `{email}` → in dev the 202 response
includes `dev_magic_link` / `dev_token` (real email is logged, not sent) → `POST /auth/verify`
`{token}` → use `session_token` as `Authorization: Bearer`. Tokens are **single-use**,
expire after 15 min, and sessions are **role-scoped** (candidate token → 403 on recruiter
work and vice versa).

### Not yet built (in the contract, later slices)
`/auth`-recruiter dashboard endpoints (`/jobs`, `/jobs/{id}/leaderboard`, `/candidates/{id}`,
`/responses/{id}/audio`, `/system/budget-status`), the AI follow-up (`/interview/follow-up`),
and real Whisper transcription/GPT scoring. These need scores data and the AI pipeline.
