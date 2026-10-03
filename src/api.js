// Client for the AAAI backend auth API (passwordless magic-link, FR-04).
// Backend runs at 127.0.0.1:8000; CORS allows the Vite dev origin.
const API_BASE = 'http://127.0.0.1:8000/api/v1'

async function parse(res) {
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error?.message || `Request failed (${res.status})`)
  }
  return data
}

// Step 1 — ask the server to send a sign-in link. In dev the response includes
// `dev_token` so we can complete the flow without a real inbox.
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
