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

## Tests

Automated suite in [tests/](tests/). It runs against a throwaway `aaai_test` database on the
same Postgres (recreated + migrated each run), so the dev/demo data is never touched. Docker must be up:

```bash
pip install -r requirements-dev.txt
docker compose up -d db
pytest
```

44 tests cover: auth (magic-link, verify, single-use, anti-enumeration), the consent
gate (403 → 201 → 200), audio upload validation (201 / 413 / 415), tab-out logging +
audit-log immutability, RBAC on `budget-status`, the budget kill-switch guard, the
recruiter dashboard (jobs, ranked leaderboard, candidate detail, audio playback), and
email delivery (dev-log fallback + the SMTP send path), and the AI pipeline (transcription,
no-speech handling, exactly-one follow-up, JSON scoring + corrective retry + manual-review
fallback, robotic-language down-weighting, budget freeze, audit trail).

## API routes — aligned to **API Contract v1**

All routes are under **`/api/v1`**. Every non-2xx response uses the standard
envelope `{ "error": { "code", "message", "details" } }`. Seed demo data first:

```bash
python -m app.seed   # the Lead's job + rubric, plus logins (see below)
```

**Hiring projects + random questions (FR-05):** the seed creates 12 jobs — the Lead's
*Junior Backend Engineer*, plus *Senior Frontend*, *Full-Stack*, *QA*, *DevOps*, *Data Analyst*,
*Mobile App Developer*, *UI/UX Designer*, *Product Manager*, *Machine Learning Engineer*,
*Cybersecurity Analyst* and *IT Support Specialist* ([app/seed_jobs.py](app/seed_jobs.py)). Each has a **bank of 12 questions** (3 per
trait). Every interview draws **5 at random — every trait covered, then one extra — in random order**
([app/questions.py](app/questions.py)), avoids questions that email already answered, and
saves the draw in `candidates.assigned_questions` (migration `0003`) so a refresh shows the
same set. `GET /interview/questions` keeps its contract shape; uploads for a question the
interview wasn't asked are rejected (422). Non-backend rubrics reuse the Lead's anchors for
communication / problem solving and the FR-10 cap; technical skill and job fit are per role.

The seed creates **real data only**: the Lead-authored job/rubric/questions, plus
`SEED_REAL_EMAIL` (from `.env`) as recruiter and its `+candidate` alias as candidate. If
`SEED_REAL_EMAIL` is empty it falls back to `recruiter@demo.local` / `candidate@demo.local`
(never emailed — the sign-in link is printed in the backend console). No fake scored
candidates are seeded; every score comes from the AI pipeline.

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | `/api/v1/health` | Liveness (`{status,time}`) | — |
| POST | `/api/v1/auth/magic-link` | Request a passwordless sign-in link (FR-04) → 202 | — |
| POST | `/api/v1/auth/verify` | Trade a link token for a role-scoped session (FR-04) | — |
| GET | `/api/v1/auth/me` | Who am I? (both roles) | Bearer |
| POST | `/api/v1/interview/consent` | Record consent (FR-01) → 201; appends CONSENT audit row | Bearer (candidate) |
| GET | `/api/v1/interview/questions` | This interview's 5 questions + `question_seconds` (2:00 each); **403 until consent** | Bearer + consent |
| POST | `/api/v1/interview/responses` | Upload one answer — 20 MB cap, type allow-list (FR-02/06) → 201 | Bearer + consent |
| GET | `/api/v1/interview/responses/{id}` | Poll transcription status (FR-07/17) | Bearer + consent |
| POST | `/api/v1/interview/finish` | **v1.1:** submit the interview → `completed`; scoring runs once every answer is transcribed (replaces the follow-up) | Bearer + consent |
| POST | `/api/v1/interview/events/tab-out` | Log a tab-switch (FR-12) → 202 | Bearer (candidate) |
| GET | `/api/v1/interview/status` | Screen-flow driver (FR-17) | Bearer (candidate) |
| GET | `/api/v1/system/budget-status` | AI spend vs the $10 cap (FR-16) | Bearer + `view_budget` |
| GET | `/api/v1/jobs` | List jobs + candidate counts (FR-14) | recruiter |
| GET | `/api/v1/jobs/{id}/leaderboard` | Ranked candidates + review flags (FR-14/15) | recruiter |
| GET | `/api/v1/candidates/{id}` | Full drill-down: transcripts, scores, audio links (FR-14/15) | recruiter |
| GET | `/api/v1/responses/{id}/audio` | Stream one recording for playback (FR-15) | recruiter + `play_audio` |
| GET | `/api/v1/candidates/{id}/audit` | Read-only, chronological audit trail (contract #17, FR-13) | recruiter |
| POST | `/api/v1/jobs/{id}/invite` | **v1.1:** invite a candidate by email — creates them + emails a magic link (FR-04) | recruiter + `invite_candidate` |
| GET | `/api/v1/jobs/{id}/candidates` | **v1.1:** every candidate for a job (scored or not) + answer counts — feeds the dashboard (FR-14) | recruiter + `view_candidate` |

**Re-inviting:** while a candidate's interview is open, re-inviting the same email just
re-sends the link. Once it is `completed`/`expired`, a re-invite creates a **new interview**
(a new `candidate_id`; the response says `new_interview: true`). The old interview, its
recordings and its append-only audit trail are kept, and signing in opens the newest one.

> **Contract v1.1 note:** `GET /auth/me` now also returns optional `name` and `email` (a candidate's
> `name` is what the recruiter typed in the invite form). `POST /jobs/{id}/invite` and `GET /jobs/{id}/candidates` are *additions* to API Contract v1
> (candidates are invited, never self-registered — SRS-2.3/FR-04; the leaderboard only lists
> scored candidates, so the dashboard needs the full list). Log them with the Lead.

**IDs are integers** (`job_id`, `candidate_id`, `response_id` …) per the contract.

**Audio upload:** `multipart/form-data` with `audio` (webm/mp4/wav/m4a, ≤20 MB),
`question_id` (0 = follow-up), and `type` (`base`/`follow_up`). Oversized → **413**
(never persisted); bad type → **415**. Only the file *path* is stored (audio lives
under `media/<candidate_id>/`). Upload returns `status: "transcribing"`; the frontend
polls `GET /responses/{id}` until final.

**Magic-link flow (FR-04):** `POST /auth/magic-link` `{email}` → 202 (generic, never says
whether the email exists) → the link is **emailed** → the user clicks it, the frontend calls
`POST /auth/verify` `{token}` → use `session_token` as `Authorization: Bearer`. Tokens are
**single-use**, expire after 15 min, and sessions are **role-scoped**. The token is **never**
returned in the API response: `EXPOSE_DEV_TOKENS` (default `false`) exists only for the test
suite. Demo addresses on reserved domains (`@demo.local`, `.test`…) are not emailed — their
link is printed in the backend log instead, so only whoever runs the server can use it.

**Real email (FR-04):** set `EMAIL_ENABLED=true` + the `SMTP_*` vars in `.env` (see
`.env.example`) and the magic link is sent over SMTP via [app/email.py](app/email.py)
instead of logged. Works with any SMTP provider (e.g. Gmail with an App Password).

## Access control (RBAC)

Roles and permissions live in [app/roles.py](app/roles.py); the guards in
[app/rbac.py](app/rbac.py). The three roles are the **SRS-2.3 user classes**, and each
role's permissions map to what the SRS says that class may do:

| Role (SRS-2.3) | Granted permissions |
|------|---------------------|
| `candidate` | give_consent, answer_interview, upload_response — *no scoring visibility* |
| `recruiter` | view_leaderboard, view_candidate, play_audio, override_score, view_budget |
| `admin` — Project Lead *(scaffolded)* | recruiter perms **+** manage_questions, manage_rubric, manage_prompts, run_qa |

Protect any route by **role** or **permission**:

```python
from fastapi import Depends
from app.rbac import require_role, require_permission
from app.roles import Role, Permission

# role-based
@router.get("/jobs", dependencies=[Depends(require_role(Role.RECRUITER, Role.ADMIN))])
def list_jobs(): ...

# permission-based
@router.post("/jobs", dependencies=[Depends(require_permission(Permission.MANAGE_JOBS))])
def create_job(): ...
```

A wrong role/permission returns **403** in the standard error envelope. `admin` is
defined and enforced but not issuable yet (the contract only mints `candidate`/`recruiter`
tokens) — enabling admin sign-in is a small contract-v1.1 step.

## Budget kill-switch (FR-16 / NFR-03)

A DB-backed monthly spend counter (`budget_usage`) enforces the **$10/month** OpenAI
ceiling. The AI pipeline uses two hooks in [app/budget.py](app/budget.py):

- `budget.guard(db, ...)` **before** every OpenAI call → raises **429 `BUDGET_EXCEEDED`** once the ceiling is reached.
- `budget.charge(db, usd, ...)` **after** every call → adds the estimated cost; writes a `BUDGET_FREEZE` audit row the moment the cap is crossed.

Recruiters see the state via `GET /system/budget-status` (`ok` / `paused`).

> **Second safeguard (NFR-03, manual):** also set a **$10 hard spending limit in the
> OpenAI dashboard** — an independent, provider-side backstop that no code can bypass.
> This is a console setting, not something the backend can configure.

## AI pipeline (FR-07 / FR-08 / FR-03 / FR-10)

Lives in [app/pipeline.py](app/pipeline.py) (steps) and [app/ai_client.py](app/ai_client.py)
(provider). Everything runs as background tasks, so no request waits on OpenAI (FR-17).

1. **Transcription (FR-07)** — each upload is sent to `whisper-1`. Silent audio (empty text
   or high `no_speech_prob`) is stored as `no_speech`, never as an invented transcript;
   errors become `failed`.
2. **No AI follow-up (FR-08/09 removed).** Interviews are 5 drawn questions; the candidate
   never sees how many. **Each question has its own 2:00 timer** (`QUESTION_SECONDS`, replacing
   FR-05's shared 5:00) and auto-advances at 0:00. After the last answer the frontend calls
   `POST /interview/finish`, which marks the interview `completed` (no more uploads).
3. **Scoring (FR-03 / FR-10)** — once the interview is finished and every answer is transcribed: JSON mode, temperature
   0, strict schema check, one corrective retry, then **manual review** (`GRADING_FAILED`)
   instead of guessing. A deterministic marker-phrase check ("Furthermore", "In
   conclusion", three-part structure…) feeds the prompt; if it fires and the model names no
   trigger, communication is down-weighted by 1 and the trigger is written to the rationale.

Every call is budget-guarded and charged (FR-16) and logged verbatim to `auditlogs` as an
`AI_REQUEST` / `AI_RESPONSE` pair (FR-13).

**Provider:** `AI_PROVIDER=auto` picks OpenAI if `OPENAI_API_KEY` is set, else **Groq** if
`GROQ_API_KEY` is set, else a clearly-labelled `[Simulated]` provider. Tests always simulate.

| Provider | Transcription | Follow-up + scoring | Cost |
|---|---|---|---|
| OpenAI (SRS §2.5) | `whisper-1` | `gpt-4o-mini` | ~$0.03 / interview, charged to the FR-16 budget |
| Groq (free tier) | `whisper-large-v3-turbo` | `llama-3.3-70b-versatile` | $0 - nothing charged; free-tier rate limits apply |

> **SRS deviation:** SRS §2.5 requires OpenAI Whisper-1 + GPT-4o-mini. Groq is used for
> development/demo; switching back is config-only (`OPENAI_API_KEY` in `.env`). Raise the
> change with the Lead (NFR-07) before the final release.

**Answers recorded before the pipeline existed:** once a key (OpenAI or Groq) is set, run
`python -m app.pipeline [candidate_id]` to transcribe and score them. It refuses to run
without a real key, so demo data never gets simulated transcripts.
