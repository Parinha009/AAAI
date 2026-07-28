// Minimal client for the AAAI backend auth API (passwordless magic-link, FR-04).
// Base URL points at the FastAPI dev server.
const API_BASE = 'http://127.0.0.1:8000/api/v1'

async function parse(res) {
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = data?.error?.message || `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data
}

// Step 1: request a sign-in link. In dev the response includes dev_token so we
// can complete the flow without real email.
export function requestMagicLink(email) {
  return fetch(`${API_BASE}/auth/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).then(parse)
}

// Step 2: trade the token for a role-scoped session token.
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

// Convenience: full login by email (magic-link -> verify -> me), dev flow.
export async function loginByEmail(email) {
  const link = await requestMagicLink(email)
  if (!link.dev_token) {
    // Generic 202 with no token = no such account (anti-enumeration).
    throw new Error('No invitation found for that email')
  }
  const session = await verifyToken(link.dev_token)
  const me = await getMe(session.session_token)
  localStorage.setItem('aaai_session', session.session_token)
  return { session, me }
}
