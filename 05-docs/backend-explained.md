# AAAI Backend — Explained (study & reference)

A plain-language guide to what the backend does and **how each feature works**, so you
can explain it confidently. Written for the backend engineer (Lim Hokan).

---

## 1. What the backend is (the one-paragraph answer)

The backend is a **FastAPI** web service backed by a **PostgreSQL** database. Its job is
to run the interview and store everything — it is the **"Messenger"**: it manages the
flow, enforces the rules (timers, consent, file limits), and moves data between the
candidate, the database, and (later) the AI provider. It does **not** do the AI thinking
itself — transcription and scoring are delegated to OpenAI (that's the "Brain").

> If asked "what is your part?": *"I built the backend — the API, the database, the
> authentication, and the audio-upload pipeline."*

## 2. Tech stack

| Tool | Why we use it |
|---|---|
| **FastAPI** | Web framework — defines the API endpoints, auto-generates `/docs` |
| **Uvicorn** | The server that runs the app |
| **SQLAlchemy 2.0** | ORM — database tables written as Python classes |
| **Alembic** | Database migrations (versioned schema changes) |
| **PostgreSQL 16** (in Docker) | The relational database |
| **Pydantic** | Validates request/response shapes = the API contract |
| **itsdangerous** | Signs the login / session tokens |
| **python-multipart** | Lets FastAPI receive uploaded audio files |

## 3. How the code is organised

```
backend/
  app/
    main.py         # creates the app, wires routers, CORS, error handling
    config.py       # settings read from .env (DB URL, secrets, timers)
    database.py     # connection to PostgreSQL
    security.py     # session tokens + "who is this user" checks
    errors.py       # the standard { error: {...} } response format
    email.py        # sends the magic link (logs it in dev)
    seed.py         # creates demo data (a job, a candidate, a recruiter)
    models/         # the database tables (one file per table)
    schemas/        # the request/response shapes (the contract)
    routers/        # the endpoints: auth.py, interview.py
  alembic/          # database migrations
  docker-compose.yml# runs PostgreSQL in a container
```

**How a request flows:** browser → `routers/*` (endpoint) → checks auth in `security.py`
→ reads/writes `models/*` in the database → returns a `schemas/*` shape as JSON.

## 4. The database (5 tables + 2 helpers)

Five "shared" tables from the team's contract, all with **integer IDs** and **foreign
keys enforced by the database itself**:

| Table | Holds |
|---|---|
| `jobs` | A job opening + its base questions + rubric |
| `candidates` | A person invited to a job + their consent record |
| `responses` | One recorded answer + its transcript + status |
| `scores` | One scorecard per candidate (4 traits, 1–5) |
| `auditlogs` | An **append-only** history of AI calls & anti-cheat events |

Plus two backend-only helpers the frontend never sees: `recruiters` and
`magic_link_tokens` (powers login).

### How the "tamper-proof audit log" works (FR-13 / NFR-01)
`auditlogs` can only be **added to** — never edited or deleted. This is enforced in the
**database**, not just in code: a **trigger** (a rule inside PostgreSQL) rejects any
`UPDATE`, `DELETE`, or `TRUNCATE` on that table with an error. So even someone running
raw SQL cannot rewrite history. *(This is why a recruiter can always defend a score.)*

### Why integer IDs / foreign keys?
Foreign keys mean the database refuses to store an answer for a candidate that doesn't
exist — it guarantees the data stays consistent. Integer IDs (1, 2, 3…) are what the
team's API contract specified.

## 5. Authentication — passwordless "magic link" (FR-04)

**Why no password?** The SRS chose passwordless login so there's *no password database
to steal*. Instead, users sign in with a one-time emailed link.

**How it works, step by step:**
1. **`POST /auth/magic-link`** with an email. The server finds the matching invited
   candidate (or recruiter), creates a **random token**, stores only a **SHA-256 hash**
   of it (so a database leak can't reveal usable links), and "emails" the link.
   *(In development the link is returned in the response so we can test without email.)*
2. **`POST /auth/verify`** with the token. The server checks it is **not expired**
   (15-minute window), **not already used**, then marks it **used** (single-use) and
   issues a **session token**.
3. That session token is sent on every later request as `Authorization: Bearer <token>`.

**Security properties (all tested):**
- **Single-use** — a used token can't log in again (`consumed_at` is set).
- **Expiry** — links die after 15 minutes.
- **Role-scoped** — a *candidate* token is rejected (403) from *recruiter* routes and
  vice versa. The role is baked into the signed token.
- **Anti-enumeration** — asking for a link with an unknown email returns a generic
  "sent" message with no token, so attackers can't discover which emails exist.

> The session token is signed with **itsdangerous** using a secret key. Signing means the
> server can detect if anyone tampers with the token.

## 6. The candidate interview flow

The endpoints, in the order a candidate hits them:

| Step | Endpoint | What it does |
|---|---|---|
| Consent | `POST /interview/consent` | Records that the candidate agreed (FR-01) |
| Questions | `GET /interview/questions` | Returns 3–5 questions + the 5:00 timer (FR-05) |
| Upload | `POST /interview/responses` | Uploads one recorded answer (FR-06) |
| Poll | `GET /interview/responses/{id}` | "Is my answer transcribed yet?" (FR-07/17) |
| Anti-cheat | `POST /interview/events/tab-out` | Logs a tab-switch (FR-12) |
| Screen state | `GET /interview/status` | Tells the UI which screen to show (FR-17) |

### How the consent gate works (FR-01)
Before any questions are shown, the candidate must consent. This is enforced on the
**server**: `GET /interview/questions` runs a check called `require_consent`. If the
candidate has no consent record, it returns **403 `CONSENT_REQUIRED`** and no questions
are sent. After `POST /interview/consent`, the same call returns **200** with the
questions. *(So it can't be bypassed by editing the webpage — the rule lives in the API.)*

### How the audio upload is made safe (FR-06)
When an answer is uploaded:
1. **Size check** — anything over **20 MB** is rejected with **413** and is **never
   written to disk** (we check the size while streaming and delete a partial file if it
   goes over).
2. **Type check** — only real audio types (`webm`, `mp4`, `wav`, `m4a`) are accepted;
   anything else gets **415**.
3. **Storage** — the file is saved to a folder, and only its **path** is stored in the
   database (not the raw bytes — keeps the database small).
4. **One answer per question** — re-uploading replaces the old file instead of creating
   duplicates.
5. The response comes back instantly with `status: "transcribing"`; the frontend then
   **polls** `GET /interview/responses/{id}` until it's done. *(This is the "async" rule
   — the candidate never waits on a frozen screen, FR-17.)*

## 7. The API contract & the error format (NFR-07)

Every route lives under **`/api/v1`**, and **every error** uses one shape:
```json
{ "error": { "code": "CONSENT_REQUIRED", "message": "...", "details": null } }
```
This matters because the frontend can write error-handling **once**. The whole backend
was verified to match the team's frozen "API Contract v1" — **23/23** automated checks
(see `04-testing/contract-verification.md`).

## 8. How to run it

```powershell
cd c:\Ai-interviews\backend
docker compose up -d db        # start PostgreSQL (Docker must be running)
alembic upgrade head           # build the tables (first time / after schema changes)
python -m app.seed             # create demo data
uvicorn app.main:app --reload  # start the API  ->  http://127.0.0.1:8000/docs
```

## 9. What's done vs. still to do

**Done ✅** — database + migrations, magic-link auth, the whole candidate intake flow
(consent, questions, upload, poll, tab-out, status), the append-only audit log, contract
alignment + verification, and CORS so the React frontend can log in.

**Not built yet ❌ (later slices)**
- **Real email** — the magic link is logged in dev, not actually emailed.
- **AI pipeline** — Whisper transcription (FR-07), the GPT follow-up question (FR-08),
  and the JSON scorecard (FR-03/10). Upload status stays `transcribing` for now.
- **Budget kill-switch** ($10/month AI cost guard, FR-16).
- **Recruiter dashboard** endpoints (leaderboard, candidate detail, audio playback).

Roughly **~55–60%** of the backend is complete — the foundation and the entire
candidate-intake half. The remaining part is the AI "brain", the cost guard, and the
recruiter dashboard.

---

## 10. Likely teacher questions — quick answers

**Q: What does your backend actually do?**
> It runs the interview and stores everything: authentication, the question flow, the
> audio upload, and a tamper-proof audit trail. The AI thinking is delegated to OpenAI.

**Q: Why passwordless login?**
> So there's no password database to leak. Users sign in with a one-time link that
> expires in 15 minutes and can only be used once.

**Q: How do you stop someone skipping the consent screen?**
> The rule is in the API, not the webpage. Requesting questions without a saved consent
> record returns 403. You can't bypass it by editing the frontend.

**Q: How do you keep the audit log tamper-proof?**
> A database trigger blocks any update or delete on the `auditlogs` table — even raw SQL
> can't change it. It's append-only by design.

**Q: What stops a huge file from crashing the server?**
> Uploads are capped at 20 MB and streamed in chunks; anything bigger is rejected before
> it's written to disk, and the file type is checked against an allow-list.

**Q: Why doesn't the candidate wait while the AI works?**
> The upload returns immediately as "transcribing" and the frontend polls for the result,
> so the screen never freezes — that's the asynchronous design (FR-17).

**Q: How do the frontend and backend talk?**
> Over HTTP with JSON. The backend enables CORS so the browser can call it, and the
> frontend sends the session token on each request. We verified the login works end-to-end.

**Q: What's a foreign key / why use one?**
> It's a rule that a row must point to a real parent row — e.g. an answer must belong to a
> real candidate. It keeps the data consistent and is enforced by the database.

**Q: What would you build next?**
> The AI pipeline (transcription + scoring), the $10 budget kill-switch, and the recruiter
> dashboard — plus wiring real email delivery.
