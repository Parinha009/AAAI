# Backend ↔ Contract Verification

**Verifies:** backend implementation against API Contract v1 — the schema table (§1),
the ER diagram, and the `02-design/api-contract-v1/fixtures/` shapes.
**Scope:** the backend endpoints built so far (candidate flow + auth).
**Owner:** Lim Hokan (Backend) · **Date:** 2026-07-27
**Result:** ✅ 23/23 automated checks pass (schema + FKs + endpoint shapes); flowchart
walk confirms the built candidate path runs end-to-end.

> Method: automated cross-check against the live server + database — DB columns/FKs
> introspected from Postgres; endpoint responses compared key-by-key to the fixtures.

---

## A. Database schema vs ER diagram + schema table (§1)

All five shared tables have every contract column, with PK/FK enforced at the DB level.

| Table | Contract columns | Foreign keys |
|---|---|---|
| `jobs` | ✅ all present | — |
| `candidates` | ✅ all present | → `jobs` |
| `responses` | ✅ all present (+1 internal) | → `candidates`, `jobs` |
| `scores` | ✅ all present | → `candidates`, `jobs` |
| `auditlogs` | ✅ all present | → `candidates`, `jobs` |

- Integer `SERIAL` primary keys throughout, matching the contract/ER diagram.
- `auditlogs` is append-only, enforced by DB triggers (FR-13 / NFR-01).
- **Intentional extra:** `responses.audio_mime` — internal column used only to set the
  playback `Content-Type`; not part of any shared response shape. *(Confirm with Lead;
  can be dropped and derived from the file extension if preferred.)*

## B. Endpoint responses vs fixtures (exact key match)

| Endpoint | Fixture | Status |
|---|---|---|
| `GET /health` | `health_response` | ✅ |
| `POST /auth/magic-link` | `auth_magic_link_response` | ✅ (`dev_*` keys hidden in prod) |
| `POST /auth/verify` (candidate) | `auth_verify_response` | ✅ (+ `context`) |
| `POST /auth/verify` (recruiter) | `auth_verify_response_recruiter` | ✅ (omits `candidate_id`) |
| `GET /auth/me` | `auth_me_response` | ✅ |
| `POST /interview/consent` | `consent_response` | ✅ (201) |
| `GET /interview/questions` | `questions_response` | ✅ (+ item keys) |
| `POST /interview/responses` | `response_upload_response` | ✅ (201) |
| `GET /interview/responses/{id}` | `response_status_*` | ✅ |
| `POST /interview/events/tab-out` | `tab_out_response` | ✅ (202) |
| `GET /interview/status` | `interview_status_response` | ✅ |
| Any error (4xx/5xx) | `errors.json` envelope | ✅ `{error:{code,message,details}}` |

Also verified: `/api/v1` prefix on all routes; magic-link tokens single-use + 15-min
expiry; sessions role-scoped (candidate token → 403 on recruiter-only routes).

## C. Flowchart walk (AAAI_Flowchart.mermaid) — candidate assembly line

Each box was exercised live against the API, in flow order:

| Box | Step | Result |
|---|---|---|
| B | Magic-link invite (FR-04) | ✅ signs in |
| C | Consent gate (FR-01) | ✅ **403 `CONSENT_REQUIRED`** before consent, **200** after |
| D | Persist consent / unlock | ✅ status → `in_progress` |
| E | Base questions + 5:00 timer (FR-05) | ✅ 4 questions, `base_round_seconds: 300` |
| F | Upload + validate audio ≤20 MB (FR-06) | ✅ `201`, `status: transcribing` |
| G | Processing / Whisper (FR-07/17) | ⚠️ **stub** — stays `transcribing` (not built) |
| P | AuditLogs append-only + tab-out (FR-12/13) | ✅ rows written |
| H | GPT follow-up (FR-08) | ❌ not built |
| K | JSON scorecard (FR-03/10) | ❌ not built |
| O | Recruiter dashboard (FR-14/15) | ❌ not built |

**Left half of the flowchart** (intake → consent → questions → upload → audit) runs
end-to-end. **Right half** (Whisper, AI follow-up, scoring, dashboard) is later slices.

> Note: consent state persists in the DB between runs. For a clean slate:
> `docker compose down -v && docker compose up -d db && alembic upgrade head && python -m app.seed`.

## D. Fixtures with no endpoint yet (later slices)

These fixtures exist but map to endpoints not yet in scope — they need the recruiter
dashboard (FR-14/15/16) and the AI pipeline (FR-07/08):

`budget_status_ok/paused`, `jobs_list`, `leaderboard`, `candidate_detail`,
`audit_trail`, `followup_generating/ready`.

---

**Conclusion:** the backend DB matches the ER diagram / schema table, and every built
endpoint returns the exact fixture shapes — the frontend (built against the fixtures)
integrates directly against the live API.
