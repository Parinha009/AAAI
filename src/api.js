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
