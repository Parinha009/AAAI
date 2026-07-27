# AAAI — API & Data Contract **v1** (readable edition)

**Project:** Automated Asynchronous AI Interviewer (AAAI)
**Owner:** Thaing Parinha (Project Lead) · **Satisfies:** SRS-NFR-07 (API Contract Discipline)
**Status:** aligned 1:1 with the frozen `02-design/api-contract-v1/API_Contract_v1.md` — same shapes, plainer words.

> **Read this first (one breath).** A contract freezes the **shape** of the data (field names, types, endpoints, status codes) — not the **values** (question text, rubric wording, thresholds). Freeze the shape now so Frontend, Backend, and AI build **in parallel** without waiting on each other. Change a *shape* later = a logged decision. Change a *value* later = free.

---

## 0. Conventions (how to read every example below)

- **Base URL:** every path starts with `/api/v1`. So `GET /health` really means `GET /api/v1/health`.
- **Transport:** HTTPS only. JSON in / JSON out — **except** audio upload (multipart form) and audio playback (raw bytes).
- **Login:** you get a **session token** from a magic link, then send it on every protected call as a header:
  `Authorization: Bearer <session_token>`.
- **Who am I:** the token remembers *who you are*. So **candidate calls never put a `candidate_id` in the URL** — the server reads it from the token (stops candidate #101 from peeking at #102). Recruiters *do* pass explicit ids, because they are trusted.
- **Times:** always UTC ISO-8601 with a `Z`, e.g. `2026-07-06T09:45:00Z`.
- **Names:** everything is `snake_case` and matches the database column names.

**Interview Physics — fixed numbers the API sends so the frontend never hard-codes them:**

| Setting | Value | Plain meaning | SRS |
|---|---|---|---|
| `base_round_seconds` | `300` | one 5:00 timer for all base questions | FR-05 |
| `follow_up_seconds` | `150` | 2:30 timer for the follow-up | FR-09 |
| `processing_soft_seconds` | `15` | show "Processing…" up to 15s | FR-17 |
| `processing_hard_seconds` | `90` | after this, say "taking longer than usual" | NFR-02 |
| `poll_interval_seconds` | `2` | how often the frontend re-checks status | FR-17 |
| `max_audio_bytes` | `20971520` | 20 MB hard upload limit | FR-06 |
| `accepted_audio_mime` | `audio/webm`, `audio/mp4`, `audio/wav`, `audio/m4a` | allowed audio types | FR-06 |

**The async rule (very important, FR-17 / NFR-02):** the candidate never waits on an open connection while the AI thinks.
1. Upload returns instantly with `status: "transcribing"`.
2. The frontend **polls** `GET /interview/responses/{id}` every ~2s until status is final (`transcribed` / `no_speech` / `failed`).
3. "Not ready yet" returns **`202`**; "ready" returns **`200`**.

---

## 1. Data model (PostgreSQL — 5 tables)

Five tables. Every foreign key (FK) is enforced by the database itself, not just in code (NFR-01). `TIMESTAMPTZ` = timestamp with timezone. `JSONB` = structured JSON we can query. Add indexes on the hot lookups `candidate_id` and `job_id` (NFR-09).

### `jobs` — one job opening + its questions & rubric
| Column | Type | PK/FK | Plain meaning |
|---|---|---|---|
| `job_id` | `SERIAL` | **PK** | unique id for the job |
| `title` | `VARCHAR(200)` | | e.g. "Junior Backend Engineer" |
| `rubric_config` | `JSONB` | | the 4-trait rubric + scoring anchors (Lead-authored) |
| `base_questions` | `JSONB` | | ordered list of 3–5 questions |
| `created_at` | `TIMESTAMPTZ` | | defaults to `now()` |

### `candidates` — one person invited to one job
| Column | Type | PK/FK | Plain meaning |
|---|---|---|---|
| `candidate_id` | `SERIAL` | **PK** | unique id for the candidate |
| `job_id` | `INT` | **FK → jobs** | which job they applied to *(indexed)* |
| `name` | `VARCHAR(150)` | | display name |
| `email` | `VARCHAR(254)` | | where the magic link is sent |
| `consent_version` | `VARCHAR(20)` | | which consent text they agreed to (null until they consent) |
| `consent_at` | `TIMESTAMPTZ` | | when they consented (null until then) |
| `status` | `VARCHAR(20)` | | where they are in the flow (see §1.1) |
| `created_at` | `TIMESTAMPTZ` | | defaults to `now()` |

### `responses` — one recorded answer (base OR follow-up)
| Column | Type | PK/FK | Plain meaning |
|---|---|---|---|
| `response_id` | `SERIAL` | **PK** | unique id for this answer |
| `candidate_id` | `INT` | **FK → candidates** | who gave it *(indexed)* |
| `job_id` | `INT` | **FK → jobs** | copied here to make scoping queries easy |
| `question_id` | `INT` | | which question; **`0` = the follow-up** |
| `type` | `VARCHAR(12)` | | `base` or `follow_up` |
| `status` | `VARCHAR(12)` | | transcription state — **the field the frontend polls** |
| `audio_path` | `VARCHAR(500)` | | where the file is stored (a path, **not** the bytes) |
| `transcript` | `TEXT` | | the text Whisper produced (null until done) |
| `no_speech_flag` | `BOOLEAN` | | `true` if the audio was silent/empty |
| `created_at` | `TIMESTAMPTZ` | | defaults to `now()` |

### `scores` — one scorecard per candidate
| Column | Type | PK/FK | Plain meaning |
|---|---|---|---|
| `score_id` | `SERIAL` | **PK** | unique id for the scorecard |
| `candidate_id` | `INT` | **FK → candidates, UNIQUE** | one scorecard per candidate |
| `job_id` | `INT` | **FK → jobs** | the job *(indexed)* |
| `technical_skill` | `INT` | | 1–5 (`CHECK 1..5`) |
| `communication` | `INT` | | 1–5 (may be down-weighted by the robotic-language check, FR-10) |
| `problem_solving` | `INT` | | 1–5 |
| `job_fit` | `INT` | | 1–5 |
| `rationale` | `JSONB` | | `{ "<trait>": "<why>" }` — includes any robotic-language trigger |
| `manual_review_flag` | `BOOLEAN` | | `true` when AI grading failed and a human must look |
| `created_at` | `TIMESTAMPTZ` | | defaults to `now()` |

### `auditlogs` — append-only history (never edited or deleted, FR-13 / NFR-01)
| Column | Type | PK/FK | Plain meaning |
|---|---|---|---|
| `log_id` | `SERIAL` | **PK** | unique id for the log row |
| `candidate_id` | `INT` | **FK → candidates** | whose session *(indexed)* |
| `job_id` | `INT` | **FK → jobs** | the job |
| `event_type` | `VARCHAR(24)` | | what happened (see §1.1) |
| `payload` | `JSONB` | | the raw AI request/response or event data, stored verbatim |
| `created_at` | `TIMESTAMPTZ` | | defaults to `now()` |

> **Immutability:** no code path is allowed to `UPDATE` or `DELETE` an `auditlogs` row. Lock it at the DB-role level too if time allows.
> **Backend-only helper table (not shared):** `magic_link_tokens` (token hash, email, role, job_id, expires_at, consumed_at) powers login (FR-04). The frontend never touches it, so it stays out of this contract.

### Relationships (in words)
- One `job` has **many** `candidates`, `responses`, `scores`, `auditlogs`.
- One `candidate` has **many** `responses` and `auditlogs`, but **exactly one** `score`.

### 1.1 Fixed value lists (enums)
| Field | Allowed values |
|---|---|
| `candidate.status` | `invited` → `consented` → `in_progress` → `completed`; plus `expired` |
| `response.type` | `base`, `follow_up` |
| `response.status` | `uploaded`, `transcribing`, `transcribed`, `no_speech`, `failed` |
| `auditlog.event_type` | `CONSENT`, `AI_REQUEST`, `AI_RESPONSE`, `TAB_OUT`, `BUDGET_FREEZE` |
| `auth.role` | `candidate`, `recruiter` |
| score traits | `technical_skill`, `communication`, `problem_solving`, `job_fit` (each `1`–`5`) |

---

## 2. API endpoints (the whole map)

**Who can call:** 🌐 public · 🎤 candidate token · 🧑‍💼 recruiter token.

| # | Method | Path | Who | Purpose |
|---|---|---|---|---|
| 1 | `GET` | `/health` | 🌐 | is the server alive? |
| 2 | `POST` | `/auth/magic-link` | 🌐 | request a sign-in link by email |
| 3 | `POST` | `/auth/verify` | 🌐 | trade a magic-link token for a session token |
| 4 | `GET` | `/auth/me` | 🎤/🧑‍💼 | who am I? (after page reload) |
| 5 | `POST` | `/interview/consent` | 🎤 | record consent, unlock the interview |
| 6 | `GET` | `/interview/questions` | 🎤 | get the 3–5 base questions + the 5:00 timer |
| 7 | `POST` | `/interview/responses` | 🎤 | upload one recorded answer (multipart) |
| 8 | `GET` | `/interview/responses/{response_id}` | 🎤 | poll: is my answer transcribed yet? |
| 9 | `GET` | `/interview/follow-up` | 🎤 | get the one AI follow-up question |
| 10 | `GET` | `/interview/status` | 🎤 | one call that drives the whole screen flow |
| 11 | `POST` | `/interview/events/tab-out` | 🎤 | log a tab-switch (anti-cheat) |
| 12 | `GET` | `/system/budget-status` | 🧑‍💼 | is the AI paused by the $10 cap? |
| 13 | `GET` | `/jobs` | 🧑‍💼 | list jobs for the dropdown |
| 14 | `GET` | `/jobs/{job_id}/leaderboard` | 🧑‍💼 | ranked candidates for one job |
| 15 | `GET` | `/candidates/{candidate_id}` | 🧑‍💼 | full detail: transcript, scores, audio |
| 16 | `GET` | `/responses/{response_id}/audio` | 🧑‍💼 | stream one recording for playback |
| 17 | `GET` | `/candidates/{candidate_id}/audit` | 🧑‍💼 | read-only audit trail *(optional / descope-able)* |

**Which SRS feature each covers:** FR-04 → #2,3,4 · FR-01 → #5 · FR-05 → #6 · FR-02/06/09 → #7 · FR-07/17 → #8,10 · FR-08 → #9 · FR-12 → #11 · FR-16 → #12 · FR-14 → #13,14,15 · FR-15 → #14,15,16 · FR-13 → #17. (FR-11 clipboard lock is client-only — no endpoint.)

---

## 3. Request / response examples

### 3.1 System

**1) `GET /health` 🌐** → `200`
```json
{ "status": "ok", "time": "2026-07-06T09:45:00Z" }
```

**12) `GET /system/budget-status` 🧑‍💼** → `200` — `status` is `ok` or `paused`
```json
{ "status": "ok", "month": "2026-07", "estimated_spend_usd": 2.14, "ceiling_usd": 10.00 }
```

### 3.2 Auth (FR-04)

**2) `POST /auth/magic-link` 🌐** → always `202` (never reveals if the email exists)
```json
// request
{ "email": "dara@example.com" }
// response 202
{ "status": "sent", "message": "If that email is registered, a sign-in link is on its way." }
```

**3) `POST /auth/verify` 🌐** → `200`, or `401` if the token is invalid/expired/used
```json
// request
{ "token": "mlt_8f3c...opaque" }
// response 200
{
  "session_token": "eyJhbGciOi...",   // send this as Bearer on every protected call
  "role": "candidate",
  "expires_at": "2026-07-06T10:45:00Z",
  "context": { "candidate_id": 101, "job_id": 1 }
}
```
For a recruiter, `role` is `"recruiter"` and `context` omits `candidate_id`.

**4) `GET /auth/me` 🎤/🧑‍💼** → `200`
```json
{ "role": "candidate", "candidate_id": 101, "job_id": 1, "candidate_status": "consented" }
```

### 3.3 Candidate interview (all 🎤 — no id in the URL, the token knows who you are)

**5) `POST /interview/consent` (FR-01)** → `201`, or `422` if `agreed` isn't `true`
```json
// request
{ "consent_version": "2026-07-01", "agreed": true }
// response 201
{ "candidate_status": "consented", "consent_at": "2026-07-06T09:46:10Z" }
```

**6) `GET /interview/questions` (FR-05)** → `200`, or `403 CONSENT_REQUIRED` if consent isn't recorded yet
```json
{
  "base_round_seconds": 300,
  "questions": [
    { "question_id": 1, "order": 1, "text": "Tell us about a project where you had to debug a difficult problem. What was your approach?" },
    { "question_id": 2, "order": 2, "text": "How would you explain what an API is to a non-technical teammate?" },
    { "question_id": 3, "order": 3, "text": "Describe a time you had to learn a new technology quickly." }
  ]
}
```

**7) `POST /interview/responses` (FR-02 / FR-06 / FR-09)** — **`multipart/form-data`, not JSON**

| Form field | Type | Notes |
|---|---|---|
| `question_id` | int | `0` for the follow-up |
| `type` | string | `base` or `follow_up` |
| `audio` | file | ≤ 20 MB; MIME in the allow-list |

Success → `201` (accepted, transcription queued):
```json
{ "response_id": 5001, "question_id": 1, "type": "base", "status": "transcribing" }
```
Errors: `413 PAYLOAD_TOO_LARGE` (over 20 MB — rejected **before** it hits disk), `415 UNSUPPORTED_MEDIA_TYPE` (wrong file type).

**8) `GET /interview/responses/{response_id}` (FR-07 / FR-17)** — poll this every ~2s → `200`
```json
// still working:
{ "response_id": 5001, "status": "transcribing", "transcript": null, "no_speech_flag": false }
// done:
{ "response_id": 5001, "status": "transcribed", "transcript": "So the bug only showed up under load...", "no_speech_flag": false }
// silent audio:
{ "response_id": 5002, "status": "no_speech", "transcript": null, "no_speech_flag": true }
```

**9) `GET /interview/follow-up` (FR-08)** — `202` while generating, `200` when ready
```json
// 202 (not ready yet)
{ "status": "generating" }
// 200 (ready)
{ "question_id": 0, "text": "You mentioned adding print statements — how would you debug the same failure if it only happened in production, not locally?", "follow_up_seconds": 150 }
```

**10) `GET /interview/status` (FR-17)** — the single call that tells the UI what screen to show → `200`
```json
{ "candidate_status": "in_progress", "stage": "processing", "next_action": "await_follow_up" }
```
`stage` ∈ `consent`, `base`, `processing`, `follow_up`, `scoring`, `completed`.
`next_action` ∈ `show_consent`, `answer_base`, `await_follow_up`, `answer_follow_up`, `await_score`, `show_complete`.

**11) `POST /interview/events/tab-out` (FR-12)** — fire-and-forget; must **not** block recording → `202`
```json
// request
{ "question_id": 2, "occurred_at": "2026-07-06T09:48:33Z" }
// response 202
{ "status": "logged" }
```

### 3.4 Recruiter dashboard (all 🧑‍💼)

**13) `GET /jobs` (FR-14)** → `200`
```json
{ "jobs": [ { "job_id": 1, "title": "Junior Backend Engineer", "candidate_count": 12 } ] }
```

**14) `GET /jobs/{job_id}/leaderboard` (FR-14 / FR-15)** — `aggregate_score` = sum of the 4 traits (4–20), ranked high→low → `200`
```json
{
  "job_id": 1,
  "title": "Junior Backend Engineer",
  "candidates": [
    {
      "candidate_id": 101, "name": "Dara Chen",
      "aggregate_score": 17,
      "scores": { "technical_skill": 4, "communication": 5, "problem_solving": 4, "job_fit": 4 },
      "tab_out_count": 0, "needs_review": false, "review_reasons": []
    },
    {
      "candidate_id": 102, "name": "Sok Pisey",
      "aggregate_score": 11,
      "scores": { "technical_skill": 3, "communication": 2, "problem_solving": 3, "job_fit": 3 },
      "tab_out_count": 4, "needs_review": true,
      "review_reasons": ["LOW_COMMUNICATION", "HIGH_TAB_OUT"]
    }
  ]
}
```

**15) `GET /candidates/{candidate_id}` (FR-14 / FR-15)** — full drill-down → `200`
```json
{
  "candidate": { "candidate_id": 101, "name": "Dara Chen", "email": "dara@example.com", "status": "completed", "consent_at": "2026-07-06T09:46:10Z" },
  "job": { "job_id": 1, "title": "Junior Backend Engineer" },
  "responses": [
    { "response_id": 5001, "type": "base", "question_id": 1, "question_text": "Tell us about a project where you had to debug a difficult problem...", "transcript": "So the bug only showed up under load...", "no_speech_flag": false, "audio_url": "/api/v1/responses/5001/audio", "created_at": "2026-07-06T09:47:02Z" }
  ],
  "score": {
    "technical_skill": 4, "communication": 5, "problem_solving": 4, "job_fit": 4,
    "aggregate_score": 17,
    "rationale": {
      "technical_skill": "Explained a load-dependent race condition clearly.",
      "communication": "Natural, specific phrasing; no templated structure detected.",
      "problem_solving": "Described isolating the fault methodically.",
      "job_fit": "Relevant backend experience."
    },
    "manual_review_flag": false
  },
  "tab_out_count": 0,
  "review_reasons": []
}
```

**16) `GET /responses/{response_id}/audio` (FR-15)** → `200`, `Content-Type: audio/webm` (or the stored type). Body = the audio bytes, streamed for in-page playback (no download).

**17) `GET /candidates/{candidate_id}/audit` (FR-13, optional)** → `200`
```json
{ "candidate_id": 101, "events": [ { "log_id": 9001, "event_type": "AI_REQUEST", "created_at": "2026-07-06T09:47:20Z", "payload": { "model": "whisper-1" } } ] }
```

---

## 4. Errors & status codes

**Every non-2xx response uses ONE shape**, so the frontend writes error handling once:
```json
{
  "error": {
    "code": "PAYLOAD_TOO_LARGE",              // stable machine string, SCREAMING_SNAKE
    "message": "Audio file exceeds the 20 MB limit.",  // safe to show a person
    "details": { "max_bytes": 20971520, "received_bytes": 23140000 }  // optional
  }
}
```

| Code | When it happens here |
|---|---|
| `200` | OK, resource is ready |
| `201` | Created (consent saved, upload accepted) |
| `202` | Accepted but not ready / fire-and-forget (generating, tab-out logged, link sent) |
| `401` | Missing / expired / already-used token |
| `403` | Wrong role, or consent not recorded yet (`CONSENT_REQUIRED`) |
| `404` | No such job / candidate / response |
| `413` | Audio over 20 MB (`PAYLOAD_TOO_LARGE`) |
| `415` | Audio type not allowed (`UNSUPPORTED_MEDIA_TYPE`) |
| `422` | Body failed validation (e.g. `agreed` ≠ true) |
| `429` | AI call blocked because the $10 budget froze (`BUDGET_EXCEEDED`) — surfaced, not crashed |
| `500` | Unhandled server error → route the session to manual review (NFR-06) |

---

## 5. Decisions to confirm with the team

These are **values**, not shapes — agreeing loosely is fine and none of them block parallel work. Log the answers in `AAAI_Tracker.md`.

1. **Review-flag thresholds (FR-15):** placeholder = `communication ≤ 2` OR `tab_out_count ≥ 3` OR a JSON-grading failure. Final tuning is a Week-9 Lead task; the `needs_review` + `review_reasons` fields are locked now.
2. **`aggregate_score` formula:** v1 = simple **sum** of the four traits (4–20). Any weighting is a later decision; the field name won't change.
3. **`review_reasons` vocabulary:** starting set `LOW_COMMUNICATION`, `HIGH_TAB_OUT`, `GRADING_FAILED` — add codes as needed (additive only).
4. **Magic-link expiry:** proposed 60 min (candidate) / 30 min (recruiter). Confirm with Nareach (email provider has lead time, Week 5).
5. **Audio storage:** local media directory vs. object storage. `audio_path` hides the choice from the contract either way.
6. **Consent text + version string** (`consent_version`): who writes the wording, and what the first version label is (placeholder `2026-07-01`).
7. **Base questions + rubric anchors** (`base_questions`, `rubric_config` values): Lead-authored in Week 4 — the JSONB *shape* is locked, the *contents* are pending.

---

### Change control (NFR-07)
This document + the `/fixtures` are the source of truth. After the Wednesday review, the **shapes are frozen**. Changing any shape (new/renamed field, changed type, new/removed endpoint, changed status code) = a logged decision in the tracker standup, bump to `v1.1`. Changing a **value** in §5 is not a contract change.

*End of contract v1 (readable edition).*
