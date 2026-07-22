# AAAI — API & Data Contract **v1**

**Project:** Automated Asynchronous AI Interviewer (AAAI)
**Owner:** Thaing Parinha (Project Lead)
**Status:** `v1 — FROZEN after Wed 08 Jul 2026 review`
**Issued:** Mon 06 Jul 2026 · **Team review:** Wed 08 Jul 2026 · **Satisfies:** SRS-NFR-07 (API Contract Discipline)

> **What this is.** The single, authoritative description of every HTTP endpoint, request/response shape, and database table for the AAAI MVP. Frontend, Backend, and AI/Infra build **in parallel against this document** — the frontend mocks the JSON in `/fixtures` without waiting on the live backend or AI pipeline.
>
> **The one rule (NFR-07).** After the Wednesday review this contract is **frozen**. A change to any *shape* here is a **logged decision** (note it in `AAAI_Tracker.md` standup log), not a quiet edit. Tunable *values* (question text, rubric wording, flag thresholds, prompts) are **not** part of the frozen shape and can change freely.

---

## 0. How each person uses this document

| Role | Reads | Builds against |
| --- | --- | --- |
| **Soeng — Frontend** | §3 Conventions, §5 Endpoints, `/fixtures/*.json` | The **fixtures**. Wire screens to mock JSON now; swap the base URL to the real backend in Week 4. |
| **Hokan — Backend** | §4 Data Model, §5 Endpoints, §6 Status codes | The **schemas + tables**. Endpoints must return exactly these shapes; DB must match §4. |
| **Sovannareach — AI/Infra** | §4 (Scores, AuditLogs, Responses), §5 interview + scoring notes | The **Scores JSON shape** and the `response.status` lifecycle the pipeline drives. |
| **You — Lead** | All. Own the freeze. | Coverage: every SRS-FR that needs an API is mapped in §2. |

---

## 1. Contract at a glance

- **Base URL:** `/api/v1` (all paths below are relative to this).
- **Transport:** HTTPS only. JSON in / JSON out, except audio upload (multipart) and audio playback (binary stream).
- **Auth:** Bearer session token from a magic link (§3.2). Candidate tokens and recruiter tokens are **role-scoped and not interchangeable**.
- **Identity:** Candidate-facing endpoints are **session-scoped** — the candidate never passes their own `candidate_id`; the server reads it from the token. Recruiter endpoints take explicit `job_id` / `candidate_id`.
- **Time:** every timestamp is ISO-8601 UTC with a trailing `Z`, e.g. `2026-07-06T09:45:00Z`.
- **IDs:** integers, matching the ER diagram primary keys.

**Interview Physics (fixed product constants — the API echoes these so the frontend never hard-codes them):**

| Constant | Value | Source |
|---|---|---|
| `base_round_seconds` | `300` (5:00) | FR-05 |
| `follow_up_seconds` | `150` (2:30) | FR-09 |
| `processing_soft_seconds` | `15` | FR-17 |
| `processing_hard_seconds` | `90` | NFR-02 ("taking longer than usual") |
| `poll_interval_seconds` | `2` (recommended) | FR-17 |
| `max_audio_bytes` | `20971520` (20 MB) | FR-06 |
| `accepted_audio_mime` | `audio/webm`, `audio/mp4`, `audio/wav`, `audio/m4a` | FR-06 |

---

## 2. SRS-FR → endpoint coverage

Proof the contract covers the spec. "Client-only" = no endpoint needed. "Internal" = server/AI logic, surfaced through another endpoint's fields.

| FR | Feature | How the contract covers it |
|---|---|---|
| FR-01 | Consent | `POST /interview/consent` |
| FR-02 | Browser audio capture | Client-only capture → `POST /interview/responses` (upload) |
| FR-03 | JSON scorecard | Internal (AI); surfaced by `GET /candidates/{id}` + leaderboard |
| FR-04 | Magic-link auth | `POST /auth/magic-link`, `POST /auth/verify`, `GET /auth/me` |
| FR-05 | Base questions + global timer | `GET /interview/questions` (returns `base_round_seconds`) |
| FR-06 | Upload + validation | `POST /interview/responses` (413 / 415 rules) |
| FR-07 | Whisper transcription | Internal; polled via `GET /interview/responses/{id}` |
| FR-08 | One dynamic follow-up | `GET /interview/follow-up` |
| FR-09 | 2:30 follow-up window | Client timer + `POST /interview/responses` (`type=follow_up`) |
| FR-10 | Robotic-language heuristic | Internal (in scoring); surfaced in score `rationale` |
| FR-11 | Clipboard / right-click lock | **Client-only** (no endpoint) |
| FR-12 | Tab-out tracking | `POST /interview/events/tab-out` |
| FR-13 | Immutable audit log | Internal write; optional read `GET /candidates/{id}/audit` |
| FR-14 | Recruiter dashboard | `GET /jobs`, `GET /jobs/{id}/leaderboard`, `GET /candidates/{id}` |
| FR-15 | Manual review + audio playback | Flag fields in leaderboard/detail + `GET /responses/{id}/audio` |
| FR-16 | Budget kill-switch | Internal middleware; banner via `GET /system/budget-status` |
| FR-17 | Async "Processing…" wrapper | `GET /interview/responses/{id}`, `GET /interview/status`, `202` pattern |

---

## 3. Conventions

### 3.1 Success and error shapes

**Success:** the resource is returned directly (no wrapper), with the appropriate `2xx` status.

**Error:** every non-2xx response uses this one envelope, so the frontend writes error handling **once**:

```json
{
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "Audio file exceeds the 20 MB limit.",
    "details": { "max_bytes": 20971520, "received_bytes": 23140000 }
  }
}
```

- `code` — stable machine string (SCREAMING_SNAKE). Never changes meaning across versions.
- `message` — human-readable, safe to show a candidate/recruiter.
- `details` — optional object; may be omitted.

### 3.2 Authentication

1. A magic link carries a **single-use, time-boxed, role-scoped token** (FR-04, NFR-04).
2. `POST /auth/verify` exchanges that token for a **session token** (JWT), returned to the client.
3. The client sends it on every protected call:  `Authorization: Bearer <session_token>`.
4. The token embeds `role` (`candidate` | `recruiter`) and the bound `candidate_id` / `job_id`. The server derives identity from it — **candidate endpoints take no id in the path.**

**Role rules (enforced server-side):** a candidate token on a recruiter route → `403`; an expired/consumed token → `401`. A used magic-link token can never authenticate a second session.

### 3.3 The async pattern (FR-17 / NFR-02) — read this before §5

The candidate never holds an open connection waiting on AI. Two idioms:

- **Upload returns immediately** with `status: "transcribing"`; the client **polls** `GET /interview/responses/{id}` every ~2 s until `status` is terminal (`transcribed` / `no_speech` / `failed`).
- **Not-ready-yet returns `202 Accepted`** with a `status` body (e.g. follow-up still generating). `200` means the resource is ready.

---

## 4. Data model (PostgreSQL — authoritative)

Five tables, matching `AAAI_ER_Diagram.mermaid`, with the refinements below folded in. All foreign keys are **enforced at the schema level** (NFR-01). `TIMESTAMPTZ` everywhere. Indexes on the hot lookup paths `candidate_id` and `job_id` (NFR-09).

> **Refinements vs. the draft ER diagram** (call these out to Hokan on Wednesday — they are deliberate, not drift):
>
> 1. `responses.status` **added** — the async lifecycle (FR-17) needs a state field to poll on.
> 2. `rubric_config`, `base_questions`, `auditlogs.payload`, `scores.rationale` are **`JSONB`**, not free `text` — they are structured data we query and validate.
> 3. `scores.candidate_id` is **`UNIQUE`** — the ER diagram shows one score per candidate (`CANDIDATES ||--|| SCORES`).

### JOBS

| Column | Type | Notes |
| --- | --- | --- |
| `job_id` | `SERIAL` PK | |
| `title` | `VARCHAR(200)` | e.g. "Junior Backend Engineer" |
| `rubric_config` | `JSONB` | 4-trait rubric + anchors (Lead-authored, FR-03) |
| `base_questions` | `JSONB` | ordered list of 3–5 questions (FR-05) |
| `created_at` | `TIMESTAMPTZ` default `now()` | |

### CANDIDATES

| Column | Type | Notes |
| --- |---|---|
| `candidate_id` | `SERIAL` PK | |
| `job_id` | `INT` FK → JOBS | **indexed** |
| `name` | `VARCHAR(150)` | |
| `email` | `VARCHAR(254)` | magic-link target |
| `consent_version` | `VARCHAR(20)` | null until consent (FR-01) |
| `consent_at` | `TIMESTAMPTZ` | null until consent |
| `status` | `VARCHAR(20)` | enum → §4.1 |
| `created_at` | `TIMESTAMPTZ` default `now()` | |

### RESPONSES

| Column | Type | Notes |
| --- | --- | --- |
| `response_id` | `SERIAL` PK | |
| `candidate_id` | `INT` FK → CANDIDATES | **indexed** |
| `job_id` | `INT` FK → JOBS | denormalized for scoping |
| `question_id` | `INT` | index into the job's questions; `0` reserved for follow-up |
| `type` | `VARCHAR(12)` | `base` \| `follow_up` |
| `status` | `VARCHAR(12)` | `uploaded`\|`transcribing`\|`transcribed`\|`no_speech`\|`failed` |
| `audio_path` | `VARCHAR(500)` | storage reference, **not** the bytes (FR-06) |
| `transcript` | `TEXT` | null until transcribed (FR-07) |
| `no_speech_flag` | `BOOLEAN` default `false` | true = empty/silent audio (FR-07) |
| `created_at` | `TIMESTAMPTZ` default `now()` | |

### SCORES

| Column | Type | Notes |
| --- | --- | --- |
| `score_id` | `SERIAL` PK | |
| `candidate_id` | `INT` FK → CANDIDATES, **UNIQUE** | one scorecard per candidate |
| `job_id` | `INT` FK → JOBS | **indexed** |
| `technical_skill` | `INT` `CHECK (1..5)` | FR-03 |
| `communication` | `INT` `CHECK (1..5)` | FR-03 / FR-10 |
| `problem_solving` | `INT` `CHECK (1..5)` | FR-03 |
| `job_fit` | `INT` `CHECK (1..5)` | FR-03 |
| `rationale` | `JSONB` | `{ "<trait>": "<why>" }`, includes robotic-language trigger (FR-10) |
| `manual_review_flag` | `BOOLEAN` default `false` | set when JSON grading fails (FR-03 / FR-15) |
| `created_at` | `TIMESTAMPTZ` default `now()` | |

### AUDITLOGS (append-only — FR-13 / NFR-01)

| Column | Type | Notes |
| --- | --- | --- |
| `log_id` | `SERIAL` PK | |
| `candidate_id` | `INT` FK → CANDIDATES | **indexed** |
| `job_id` | `INT` FK → JOBS | |
| `event_type` | `VARCHAR(24)` | enum → §4.1 |
| `payload` | `JSONB` | verbatim AI request/response or event data (stored raw, not summarized) |
| `created_at` | `TIMESTAMPTZ` default `now()` | |

> **Immutability:** no application code path exposes `UPDATE`/`DELETE` on `AUDITLOGS`. Enforce at the DB role level too if time allows.
>
> **Backend-internal (not in the shared model):** a `magic_link_tokens` table (token hash, email, role, job_id, expires_at, consumed_at) supports FR-04. The frontend never touches it, so it stays out of this contract.

### 4.1 Enumerations (fixed strings)

| Field | Allowed values |
| --- | --- |
| `candidate.status` | `invited` → `consented` → `in_progress` → `completed`; plus `expired` |
| `response.type` | `base`, `follow_up` |
| `response.status` | `uploaded`, `transcribing`, `transcribed`, `no_speech`, `failed` |
| `auditlog.event_type` | `CONSENT`, `AI_REQUEST`, `AI_RESPONSE`, `TAB_OUT`, `BUDGET_FREEZE` |
| `auth.role` | `candidate`, `recruiter` |
| score traits | `technical_skill`, `communication`, `problem_solving`, `job_fit` — each integer `1`–`5` |

---

## 5. Endpoint catalog

Legend — **Auth:** 🌐 public · 🎤 candidate token · 🧑‍💼 recruiter token.

### 5.1 System

#### `GET /health` 🌐

Liveness check for Render/Railway. → `200`

```json
{ "status": "ok", "time": "2026-07-06T09:45:00Z" }
```

#### `GET /system/budget-status` 🧑‍💼  · FR-16

Drives the dashboard "AI paused" banner. → `200`

```json
{ "status": "ok", "month": "2026-07", "estimated_spend_usd": 2.14, "ceiling_usd": 10.00 }
```

`status` is `ok` | `paused`. When `paused`, the dashboard shows the persistent budget banner.

---

### 5.2 Auth  · FR-04

#### `POST /auth/magic-link` 🌐

Request a sign-in link. Always returns `202` regardless of whether the email exists (no account enumeration).

```json
// request
{ "email": "dara@example.com" }
// response 202
{ "status": "sent", "message": "If that email is registered, a sign-in link is on its way." }
```

#### `POST /auth/verify` 🌐

Exchange a magic-link token for a session. → `200`, or `401` if invalid/expired/consumed.

```json
// request
{ "token": "mlt_8f3c...opaque" }
// response 200
{
  "session_token": "eyJhbGciOi...",
  "role": "candidate",
  "expires_at": "2026-07-06T10:45:00Z",
  "context": { "candidate_id": 101, "job_id": 1 }
}
```

For a recruiter, `role` is `recruiter` and `context` omits `candidate_id`.

#### `GET /auth/me` 🎤/🧑‍💼

Who am I — frontend bootstrap after page reload. → `200`

```json
{ "role": "candidate", "candidate_id": 101, "job_id": 1, "candidate_status": "consented" }
```

---

### 5.3 Candidate interview  (all 🎤, session-scoped)

#### `POST /interview/consent` · FR-01

Persist consent, unlock the workspace. → `201`, or `422` if `agreed` isn't `true`.

```json
// request
{ "consent_version": "2026-07-01", "agreed": true }
// response 201
{ "candidate_status": "consented", "consent_at": "2026-07-06T09:46:10Z" }
```

#### `GET /interview/questions` · FR-05

Ordered base questions + the global timer. → `200`, or `403 CONSENT_REQUIRED` if consent isn't recorded.

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

#### `POST /interview/responses` · FR-02 / FR-06 / FR-09

Upload one recorded answer. **`multipart/form-data`**, not JSON.

| Field | Type | Notes |
| --- | --- | --- |
| `question_id` | form field, int | `0` for the follow-up |
| `type` | form field | `base` \| `follow_up` |
| `audio` | file | ≤ 20 MB; MIME in the allow-list |

Success → `201` (upload accepted, transcription queued):

```json
{ "response_id": 5001, "question_id": 1, "type": "base", "status": "transcribing" }
```

Errors: `413 PAYLOAD_TOO_LARGE` (> 20 MB, rejected **before** disk), `415 UNSUPPORTED_MEDIA_TYPE` (MIME not allowed).

#### `GET /interview/responses/{response_id}` · FR-07 / FR-17

Poll transcription state. → `200`

```json
{ "response_id": 5001, "status": "transcribed", "transcript": "So the bug only showed up under load...", "no_speech_flag": false }
```

While running, `status` is `transcribing` and `transcript` is `null`. Silent audio → `status: "no_speech"`, `no_speech_flag: true`.

#### `GET /interview/follow-up` · FR-08

The one AI-generated follow-up. `202` while generating, `200` when ready.

```json
// 202 (not ready)
{ "status": "generating" }
// 200 (ready)
{ "question_id": 0, "text": "You mentioned adding print statements — how would you debug the same failure if it only happened in production, not locally?", "follow_up_seconds": 150 }
```

#### `GET /interview/status` · FR-17

One call the frontend can poll to drive the whole flow (Processing screen, completion screen). → `200`

```json
{ "candidate_status": "in_progress", "stage": "processing", "next_action": "await_follow_up" }
```

`stage` ∈ `consent`, `base`, `processing`, `follow_up`, `scoring`, `completed`.
`next_action` ∈ `show_consent`, `answer_base`, `await_follow_up`, `answer_follow_up`, `await_score`, `show_complete`.

#### `POST /interview/events/tab-out` · FR-12

Fire-and-forget anti-cheat signal. Must **not** block recording. → `202`

```json
// request
{ "question_id": 2, "occurred_at": "2026-07-06T09:48:33Z" }
// response 202
{ "status": "logged" }
```

---

### 5.4 Recruiter dashboard  (all 🧑‍💼)

#### `GET /jobs` · FR-14

Jobs for the filter dropdown. → `200`

```json
{ "jobs": [ { "job_id": 1, "title": "Junior Backend Engineer", "candidate_count": 12 } ] }
```

#### `GET /jobs/{job_id}/leaderboard` · FR-14 / FR-15

Ranked candidates for one job. `aggregate_score` = sum of the four traits (range 4–20), ranked descending. → `200`

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

#### `GET /candidates/{candidate_id}` · FR-14 / FR-15

Full drill-down: transcripts, per-trait scores + rationale, audio URLs, anti-cheat count. → `200`

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
      "technical_skill": "Explained load-dependent race condition clearly.",
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

#### `GET /responses/{response_id}/audio` · FR-15

Streams the raw recording for in-dashboard playback (no download). → `200`, `Content-Type: audio/webm` (or the stored type). Body = audio bytes.

#### `GET /candidates/{candidate_id}/audit` · FR-13 · *(optional / descope-able)*

Chronological, read-only audit trail for one session. → `200`

```json
{ "candidate_id": 101, "events": [ { "log_id": 9001, "event_type": "AI_REQUEST", "created_at": "2026-07-06T09:47:20Z", "payload": { "model": "whisper-1" } } ] }
```

---

## 6. Status codes used

| Code | Meaning in this API |
|---|---|
| `200` | OK, resource ready |
| `201` | Created (consent saved, upload accepted) |
| `202` | Accepted but not ready / fire-and-forget (generating, tab-out logged, link sent) |
| `401` | Missing/expired/consumed token |
| `403` | Wrong role, or consent not yet recorded (`CONSENT_REQUIRED`) |
| `404` | No such job/candidate/response |
| `413` | Audio over 20 MB (`PAYLOAD_TOO_LARGE`) |
| `415` | Audio MIME not in allow-list (`UNSUPPORTED_MEDIA_TYPE`) |
| `422` | Body failed validation (e.g. `agreed` ≠ true) |
| `429` | Budget-frozen AI call blocked (`BUDGET_EXCEEDED`) — surfaced, not crashed |
| `500` | Unhandled server error (should route session to manual review per NFR-06) |

---

## 7. Candidate state machine

```text
invited ──consent(FR-01)──▶ consented ──GET questions──▶ in_progress
   │                                                          │
   │                                          (answer base → transcribe →
   │                                           follow-up → answer → score)
   ▼                                                          ▼
expired  (magic link timed out)                          completed
```

`response.status` lifecycle (per answer):

```text
uploaded ─▶ transcribing ─▶ transcribed
                         └─▶ no_speech     (silent/empty audio, FR-07)
                         └─▶ failed        (routes session to manual review, NFR-06)
```

---

## 8. Happy-path sequence (ties to `AAAI_Flowchart.mermaid`)

1. `POST /auth/verify` → candidate session token.
2. `POST /interview/consent` → `consented`.
3. `GET /interview/questions` → 3 questions + `base_round_seconds: 300`; client starts the global 5:00 timer.
4. Per question: record → `POST /interview/responses` (`type=base`) → poll `GET /interview/responses/{id}` until `transcribed`.
5. `GET /interview/follow-up` → `202` `generating`, then `200` with the follow-up + `follow_up_seconds: 150`.
6. Record follow-up → `POST /interview/responses` (`type=follow_up`, `question_id=0`) → poll until `transcribed`.
7. `GET /interview/status` → `stage: completed`; show the thank-you screen.
8. Recruiter later: `POST /auth/verify` → `GET /jobs/{id}/leaderboard` → `GET /candidates/{id}` → play audio via `GET /responses/{id}/audio`.

Throughout: `POST /interview/events/tab-out` on blur (FR-12); the backend writes AuditLogs on every AI call (FR-13); the budget middleware guards each AI call (FR-16).

---

## 9. Open decisions (confirm at the Wednesday review — values only, shapes are frozen)

These do **not** block parallel work; the fields exist, only their tuned values are pending. Log the answers in the tracker.

1. **Review-flag thresholds (FR-15):** placeholder = `communication ≤ 2` OR `tab_out_count ≥ 3` OR JSON-grading failure. Final tuning is a Week-9 Lead task; the `needs_review` + `review_reasons` fields are locked now.
2. **`aggregate_score` formula:** v1 = simple **sum** of four traits (4–20). Weighting is a later decision; the field name/shape won't change.
3. **`review_reasons` vocabulary:** starting set `LOW_COMMUNICATION`, `HIGH_TAB_OUT`, `GRADING_FAILED`. Add codes as needed — additive only.
4. **Magic-link expiry window:** proposed 60 min (candidate) / 30 min (recruiter). Confirm with Nareach (email provider lead time, Week 5).
5. **Audio storage location:** local media dir vs. object storage. `audio_path` hides this from the contract either way.

---

## 10. Change control (NFR-07)

- This document + `/fixtures` are the source of truth. Frozen after the **Wed 08 Jul** review.
- A change to any **shape** (new/renamed field, changed type, new/removed endpoint, changed status code) = a **logged decision** in `AAAI_Tracker.md` → Standup log, with date and reason. Bump to `v1.1`.
- Changing a **value** in §9 is *not* a contract change — no version bump.
- Verification target (NFR-07 fit criterion): FE and BE integrate in Month 2 with **zero** contract-mismatch defects traced to an unlogged schema change.

*End of contract v1.*
