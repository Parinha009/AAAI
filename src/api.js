// Client for the AAAI backend auth API (passwordless magic-link, FR-04).
// Backend runs at 127.0.0.1:8000; CORS allows the Vite dev origin.
const API_ORIGIN = 'http://127.0.0.1:8000'
const API_BASE = `${API_ORIGIN}/api/v1`

async function parse(res) {
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const error = new Error(data?.error?.message || `Request failed (${res.status})`)
    error.status = res.status // e.g. 403 = this session's role can't use this route
    error.code = data?.error?.code
    throw error
  }
  return data
}

// Step 1 — ask the server to email a one-time sign-in link (FR-04). The token is
// never returned to the browser; signing in happens from the emailed link.
export function requestMagicLink(email) {
  return fetch(`${API_BASE}/auth/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).then(parse)
}

// Step 2 — trade the link token for a role-scoped session token.
export function verifyToken(token) {
  return fetch(`${API_BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }).then(parse)
}

// Who am I? (uses the session token)
export function getMe(sessionToken) {
  return fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then(parse)
}

// --- Candidate interview (uses the stored session token) --------------------
const SESSION_KEY = 'aaai_session'

function authHeaders() {
  const token = localStorage.getItem(SESSION_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const hasSession = () => Boolean(localStorage.getItem(SESSION_KEY))

// FR-01 — record consent (unlocks the questions).
export function postConsent() {
  return fetch(`${API_BASE}/interview/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ consent_version: 'v1', agreed: true }),
  }).then(parse)
}

// FR-17 — which screen to show: { candidate_status, stage, next_action }.
export function getInterviewStatus() {
  return fetch(`${API_BASE}/interview/status`, { headers: authHeaders() }).then(parse)
}

// FR-05 — ordered base questions + the 5:00 timer.
export function getQuestions() {
  return fetch(`${API_BASE}/interview/questions`, { headers: authHeaders() }).then(parse)
}

// FR-06 — upload one recorded answer (multipart). The backend allow-lists
// plain MIME types, so strip codec params like ";codecs=opus".
export function uploadResponse({ questionId, type, blob }) {
  const mime = (blob.type || 'audio/webm').split(';')[0]
  const ext = mime.includes('mp4') ? 'mp4' : 'webm'
  const form = new FormData()
  form.append('audio', new File([blob], `answer-${questionId}.${ext}`, { type: mime }))
  form.append('question_id', String(questionId))
  form.append('type', type)
  return fetch(`${API_BASE}/interview/responses`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  }).then(parse)
}

// FR-12 — fire-and-forget tab-out log; never interrupts the interview.
export function postTabOut(questionId) {
  return fetch(`${API_BASE}/interview/events/tab-out`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ question_id: questionId ?? 0 }),
  }).then(parse).catch(() => null)
}

// Submit the interview after the last answer (or when the timer ends). AI scoring
// runs on the server once every answer is transcribed. -> 202 { status, candidate_status }
export function finishInterview() {
  return fetch(`${API_BASE}/interview/finish`, { method: 'POST', headers: authHeaders() }).then(parse)
}

// --- Recruiter: invite a candidate (FR-04 — candidates are invited, not self-registered)
export function listJobs() {
  return fetch(`${API_BASE}/jobs`, { headers: authHeaders() }).then(parse)
}

export function inviteCandidate(jobId, { email, name }) {
  return fetch(`${API_BASE}/jobs/${jobId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ email, name: name || null }),
  }).then(parse)
}

// --- Recruiter: review real interviews (FR-14 / FR-15) ----------------------
export function listJobCandidates(jobId) {
  return fetch(`${API_BASE}/jobs/${jobId}/candidates`, { headers: authHeaders() }).then(parse)
}

export function getCandidateDetail(candidateId) {
  return fetch(`${API_BASE}/candidates/${candidateId}`, { headers: authHeaders() }).then(parse)
}

// The audio endpoint needs the Bearer token, which a plain <audio src> can't
// send — so fetch the recording as a Blob and hand back a playable object URL.
// FR-13: read-only audit trail for one candidate (contract #17).
export function getCandidateAudit(candidateId) {
  return fetch(`${API_BASE}/candidates/${candidateId}/audit`, { headers: authHeaders() }).then(parse)
}

// The human decision (v1.1): 'shortlisted' | 'rejected' | null to clear.
export function setCandidateDecision(candidateId, decision) {
  return fetch(`${API_BASE}/candidates/${candidateId}/decision`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ decision }),
  }).then(parse)
}

// FR-16: { status: 'ok' | 'paused', month, estimated_spend_usd, ceiling_usd } — drives the banner.
export function getBudgetStatus() {
  return fetch(`${API_BASE}/system/budget-status`, { headers: authHeaders() }).then(parse)
}

export async function fetchAudioUrl(audioPath) {
  const res = await fetch(`${API_ORIGIN}${audioPath}`, { headers: authHeaders() })
  if (!res.ok) {
    throw new Error(`Recording unavailable (${res.status})`)
  }
  return URL.createObjectURL(await res.blob())
}
