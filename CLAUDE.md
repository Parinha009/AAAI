# CLAUDE.md

Working rules for this repo. Project overview, flow, and team lanes are in `README.md` — read that first, don't duplicate it here.

## Where code actually lives

- **Frontend (React + Vite):** repo root — `src/`, `index.html`, `vite.config.js`, `package.json`. Run with `npm run dev`.
- **Backend (FastAPI):** `03-development/backend/`. Setup, routes, and migrations are documented in its own README — read `03-development/backend/README.md` before touching backend code.
- The empty `backend/` at the repo root is a leftover. Don't put code in it.
- `03-development/README.md` proposes `frontend/` and `ai/` subfolders. Neither exists — the frontend shipped at the repo root instead, on `origin/frontend` as well as here, so root is the real convention. The stale suggestion in that README is the thing that's wrong, not the layout. Ask before relocating anything.

## The API contract is law

`02-design/api-contract-v1/API_Contract_v1.md` is the single source of truth; `02-design/api-contract-v1/fixtures/` holds sample responses per endpoint.

- Field names are `snake_case` and identical across database → API → UI. Never rename on the way through a layer.
- IDs are **integers** (`job_id`, `candidate_id`, `response_id`), not UUIDs or strings.
- All routes live under `/api/v1`. Every non-2xx response uses `{ "error": { "code", "message", "details" } }`.
- Changing a *shape* (renaming a field, adding an endpoint, changing a status code) is a logged decision and a version bump — flag it, don't just do it. Changing a *value* is free.

## Don't break these

- `audit_logs` is append-only, enforced by a database trigger (NFR-01). Never write an UPDATE or DELETE against it, and don't remove the trigger to make a test pass.
- Secrets never get committed. `.env` is ignored; `.env.example` is the tracked template.
- `_lead-private/` is the Lead's personal folder and is gitignored. Don't read from it, write to it, or reference it in tracked files.
- Audio files are never committed. Only the path is stored (`responses.audio_path`); files live under `media/<candidate_id>/`.
- Postgres runs on host port **5433**, not 5432 (the container avoids clashing with a native install).

## Conventions

- Commits are Conventional Commits with a scope: `feat(seed):`, `fix(css):`, `docs(contract):`.
- Work happens on `feature/*` branches off `main`.
- Backend deps are pinned to ranges in `requirements.txt` and validated against Python 3.12.

## Known gaps — don't mistake these for bugs

- The README names Tailwind CSS, but it is **not installed**. Styling today is plain CSS in `src/index.css`. Don't add Tailwind unprompted, and don't write Tailwind class names expecting them to work.
- Whisper transcription (FR-07) and GPT scoring are stubs. Upload returns `status: "transcribing"` and the frontend polls `GET /responses/{id}`.
- Recruiter dashboard endpoints, `/interview/follow-up`, and `/system/budget-status` are in the contract but not built yet. See the "Not yet built" section of the backend README.
