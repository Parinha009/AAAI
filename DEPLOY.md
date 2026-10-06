# Deploying AAAI (Render)

`render.yaml` describes everything: a Postgres database, the FastAPI backend and the
React website. Render builds them from GitHub `main`.

## 1. Create the services (about 5 minutes)
1. Sign in at https://dashboard.render.com with GitHub.
2. **New -> Blueprint**, choose the `AAAI` repository, branch `main`.
3. Render shows the database, `aaai-backend` and `aaai-frontend`. It asks for the
   values marked "sync: false" - fill what you know now:
   | Key | Value |
   |---|---|
   | `OPENAI_API_KEY` | your OpenAI key |
   | `SEED_REAL_EMAIL` | your recruiter email |
   | `SMTP_USER` / `SMTP_FROM` | the Gmail address that sends sign-in links / `AAAI <that address>` |
   | `SMTP_PASSWORD` | that Gmail account's App Password |
   | `FRONTEND_BASE_URL`, `CORS_ORIGINS`, `VITE_API_URL` | leave for step 2 |
4. **Apply**. Wait for the first build.

## 2. Connect the two addresses
Render gives each service an address, e.g. `https://aaai-frontend.onrender.com` and
`https://aaai-backend.onrender.com`.
- **aaai-backend -> Environment:** `FRONTEND_BASE_URL` and `CORS_ORIGINS` = the frontend address.
- **aaai-frontend -> Environment:** `VITE_API_URL` = the backend address.
- Redeploy both (the frontend needs a rebuild to pick up `VITE_API_URL`).

## 3. Check
- `https://<backend>/api/v1/health` returns `{"status":"ok"}`.
- Open the frontend, Login -> Company / Recruiter -> your `SEED_REAL_EMAIL`, click the emailed link.
- Invite yourself as a candidate and do one interview.

## Know before the demo
- **Free plan sleeps** after ~15 minutes idle; the first request then takes ~30-60 s.
  Open the site a minute before presenting.
- **Recordings are stored on the backend's disk, which the free plan wipes on every
  restart/redeploy.** Transcripts and scores (in Postgres) are kept; the audio is not.
  For lasting audio, add a Render Disk (paid) mounted at `/var/data` and set
  `MEDIA_DIR=/var/data/media`.
- The **free database expires after 30 days** on Render.
- Never put secrets in `render.yaml` or the repo - only in Render's Environment tab.
