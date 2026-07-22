# Mock fixtures — build the frontend against these

Each file is a sample **request** or **response** body from `API_Contract_v1.md`.
Frontend (SengHorng): point your mock layer / MSW handlers at these now — no backend needed.
Backend (Hokan): your endpoints must return these exact shapes.

| Endpoint | Fixture |
|---|---|
| `GET /health` | `health_response.json` |
| `GET /system/budget-status` (ok) | `budget_status_ok_response.json` |
| `GET /system/budget-status` (paused) | `budget_status_paused_response.json` |
| `POST /auth/magic-link` (req/res) | `auth_magic_link_request.json` / `auth_magic_link_response.json` |
| `POST /auth/verify` (req) | `auth_verify_request.json` |
| `POST /auth/verify` (res, candidate) | `auth_verify_response.json` |
| `POST /auth/verify` (res, recruiter) | `auth_verify_response_recruiter.json` |
| `GET /auth/me` | `auth_me_response.json` |
| `POST /interview/consent` (req/res) | `consent_request.json` / `consent_response.json` |
| `GET /interview/questions` | `questions_response.json` |
| `POST /interview/responses` (res 201) | `response_upload_response.json` |
| `GET /interview/responses/{id}` (transcribing) | `response_status_transcribing.json` |
| `GET /interview/responses/{id}` (transcribed) | `response_status_transcribed.json` |
| `GET /interview/responses/{id}` (no speech) | `response_status_no_speech.json` |
| `GET /interview/follow-up` (202 / 200) | `followup_generating_response.json` / `followup_ready_response.json` |
| `GET /interview/status` | `interview_status_response.json` |
| `POST /interview/events/tab-out` (req/res) | `tab_out_request.json` / `tab_out_response.json` |
| `GET /jobs` | `jobs_list_response.json` |
| `GET /jobs/{id}/leaderboard` | `leaderboard_response.json` |
| `GET /candidates/{id}` | `candidate_detail_response.json` |
| `GET /candidates/{id}/audit` | `audit_trail_response.json` |
| Any error (`4xx`/`5xx`) | `errors.json` (keyed by status) |

**Shared sample dataset** (consistent across every fixture): Job `1` "Junior Backend Engineer";
candidates `101` Dara Chen (aggregate 17, clean) and `102` Sok Pisey (aggregate 11, needs review);
base responses `5001–5003`, follow-up `5004`.
