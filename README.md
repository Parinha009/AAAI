# AAAI — Automated Asynchronous AI Interviewer

A **website** where a job candidate completes an interview by speaking to their computer — no live interviewer, no video call. The system records the answers, transcribes them, asks one AI-generated follow-up question, and produces a scorecard. A recruiter then signs in and reviews a ranked leaderboard.

University capstone project · 11 weeks (22 Jun → 07 Sep 2026) · 4-person team.

---

## Team

| Role | Person | Lane |
|---|---|---|
| Project Lead | Thaing Parinha | Contract, rubric, prompts, QA, delivery |
| Frontend | Soeng Senghorng | React + Tailwind — candidate screens & recruiter dashboard |
| Backend | Lim Hokan | FastAPI + PostgreSQL — API routes, schema, audit logs |
| AI / Infrastructure | Uy Sovannareach | OpenAI (Whisper + GPT-4o-mini), hosting, cost guards |

---

## How it works (the flow)

Magic-link invite → consent → 3–5 base questions under one 5:00 timer (voice) → upload & Whisper transcription → one AI follow-up under a 2:30 timer → GPT-4o-mini scorecard (4 traits, 1–5) → recruiter leaderboard.

**Messenger vs. Brain:** our code (React + FastAPI + PostgreSQL) is the *Messenger* — it runs screens, timers, and storage. OpenAI is the *Brain* — all transcription and judgement. We orchestrate; we don't build models.

**Tech:** React · Tailwind CSS · FastAPI (Python) · PostgreSQL · OpenAI Whisper-1 + GPT-4o-mini

---

## Repository structure

```
01-requirements/   SRS, OPPM, requirements docs
02-design/         API contract v1 + mock fixtures, ER diagram, flowchart
03-development/    Application code (frontend/ and backend/)
04-testing/        Test plans, test data, QA results
05-docs/           Reports, presentation, demo material
```

---

## The API contract is the source of truth

**`02-design/api-contract-v1/API_Contract_v1.md`** defines every endpoint, the request/response shapes, and the 5 database tables. A plain-language version lives at `AAAI_API_Contract_v1.md`.

**`02-design/api-contract-v1/fixtures/`** holds ready-to-use sample responses for every endpoint.

- **Frontend:** point your mock layer at these fixtures and build screens now — no backend required.
- **Backend:** your endpoints must return these exact shapes.

Field names are `snake_case` and identical across database → API → UI. Changing a *shape* (renaming a field, adding an endpoint, changing a status code) is a logged decision and a version bump. Changing a *value* is free.

---

## Getting started

**Prerequisites:** Python 3.11+, Node 18+, PostgreSQL 14+, Git.

```bash
git clone <repo-url>
cd AI-Interviewer-Project
cp .env.example .env      # then fill in your real values
```

**Backend** (`03-development/backend/`)

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload    # http://localhost:8000
```

**Frontend** (`03-development/frontend/`)

```bash
npm install
npm run dev                      # http://localhost:5173
```

> **Status:** the contract and fixtures are complete. The backend and frontend scaffolds are in progress — these commands become valid once they land.

---

## Working together

**Branches.** `main` must always work. Nobody commits to `main` directly.

```bash
git checkout -b feature/hokan-db-schema     # feature/<yourname>-<task>
git add .
git commit -m "feat: add 5 contract tables with foreign keys"
git push -u origin feature/hokan-db-schema
```

Then open a Pull Request on GitHub and tag the Lead. The Lead reviews and merges.

**Commit messages.** `feat:` new feature · `fix:` bug fix · `docs:` documentation · `chore:` setup/config.

**Definition of done.** Not "I finished it" — **"I can show it running."** A demo can't be faked; a status update can.

---

## Rules that are not negotiable

1. **Never commit `.env` or any real API key.** `.gitignore` blocks it — don't override it. A leaked key gets used by strangers and billed to us (SRS-NFR-04).
2. **Never commit audio recordings or `node_modules/`.** Git handles code well and large binaries badly.
3. **If it's not in the repo, it doesn't exist.** Push your work — that's how the team sees progress.
4. **Stuck for more than 30 minutes → message the Lead.** Being stuck is fine; being *silently* stuck is not.

---

## Budget

Hard ceiling of **$10.00/month** on OpenAI spend, enforced both in application middleware and as a cap in the OpenAI dashboard (SRS-FR-16 / NFR-03). Normal development should stay around $2–3/month.
