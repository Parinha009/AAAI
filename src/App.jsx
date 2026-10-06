import { useEffect, useState } from 'react'
import { getMe, requestMagicLink, verifyToken } from './api'
import Icon from './components/Icon'
import CandidateDashboard from './pages/CandidateDashboard'
import CompanyDashboard from './pages/CompanyDashboard'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'

// Real sessions only. The session token comes from POST /auth/verify; the profile is
// just the email the user typed when requesting the link (the API has no names).
const SESSION_KEY = 'aaai_session'
const PROFILE_KEY = 'aaai_profile'
const PENDING_EMAIL_KEY = 'aaai_pending_email'

const storage = {
  get(key) {
    try { return window.localStorage.getItem(key) } catch { return null }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, value) } catch { /* private mode: session-only */ }
  },
  remove(key) {
    try { window.localStorage.removeItem(key) } catch { /* ignore */ }
  },
}

// Name the recruiter typed in the invite form (from /auth/me), else the email's first part.
const profileFromMe = (me, fallbackEmail) => {
  const email = me?.email || fallbackEmail || ''
  const name = (me?.name || '').trim()
  return name ? { name, email } : profileFromEmail(email, me?.role)
}

const profileFromEmail = (email, role) => ({
  name: email ? email.split('@')[0] : (role === 'recruiter' ? 'Recruiter' : 'Candidate'),
  email: email || '',
})

const emptyForm = {
  fullName: '',
  email: '',
  acceptTerms: false,
}

const normalizeEmail = (email) => email.trim().toLowerCase()

const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email)

function Toast({ toast, onDismiss }) {
  if (!toast) {
    return null
  }

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      <section className={`toast toast-${toast.type}`} role="status">
        <div className="toast-status" aria-hidden="true" />
        <div>
          <p className="toast-title">{toast.title}</p>
          {toast.description ? <p className="toast-copy">{toast.description}</p> : null}
        </div>
        <button type="button" className="toast-close" onClick={onDismiss} aria-label="Dismiss notification">
          <Icon name="close" size={16} />
        </button>
      </section>
    </div>
  )
}

export default function App() {
  const [mode, setMode] = useState('landing')
  const [authRole, setAuthRole] = useState('candidate')
  const [formData, setFormData] = useState(emptyForm)
  const [magicLinkRequest, setMagicLinkRequest] = useState(null)
  const [loadingAction, setLoadingAction] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [toast, setToast] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [currentRole, setCurrentRole] = useState('candidate')

  useEffect(() => {
    if (!toast) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const showToast = (type, title, description = '') => {
    setToast({
      id: Date.now(),
      type,
      title,
      description,
    })
  }

  // Handle the emailed magic link: /auth/callback?token=... (or any ?token=...).
  // On load, verify the token with the backend and sign the user in.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      // No link in the URL: restore a still-valid session after a page reload.
      const saved = storage.get(SESSION_KEY)
      if (!saved) {
        return
      }
      getMe(saved)
        .then((me) => {
          const dashboard = me.role === 'recruiter' ? 'company' : 'candidate'
          const profile = profileFromMe(me, '')
          storage.set(PROFILE_KEY, JSON.stringify(profile))
          setCurrentUser(profile)
          setCurrentRole(dashboard)
          setMode(dashboard)
        })
        .catch(() => {
          storage.remove(SESSION_KEY)
          storage.remove(PROFILE_KEY)
        })
      return
    }
    // Strip the token from the URL so a refresh/bookmark can't reuse it.
    window.history.replaceState({}, '', '/')
    ;(async () => {
      try {
        const session = await verifyToken(token)
        const me = await getMe(session.session_token)
        storage.set(SESSION_KEY, session.session_token)
        const dashboard = session.role === 'recruiter' ? 'company' : 'candidate'
        const profile = profileFromMe(me, storage.get(PENDING_EMAIL_KEY) || '')
        storage.set(PROFILE_KEY, JSON.stringify(profile))
        storage.remove(PENDING_EMAIL_KEY)
        setCurrentUser(profile)
        setCurrentRole(dashboard)
        setMode(dashboard)
        showToast('success', 'Signed in', `Verified by the server as ${session.role}.`)
      } catch (error) {
        // Each link works once (FR-04). Re-opening one that was already used is common
        // (clicking the email again, an older invite email): if this browser is still
        // signed in, just continue instead of showing an error.
        const saved = storage.get(SESSION_KEY)
        const me = saved ? await getMe(saved).catch(() => null) : null
        if (me) {
          const dashboard = me.role === 'recruiter' ? 'company' : 'candidate'
          const profile = profileFromMe(me, '')
          storage.set(PROFILE_KEY, JSON.stringify(profile))
          setCurrentUser(profile)
          setCurrentRole(dashboard)
          setMode(dashboard)
          showToast('info', 'You are already signed in', 'That sign-in link was already used, so we kept your current session.')
          return
        }
        storage.remove(SESSION_KEY)
        storage.remove(PROFILE_KEY)
        setMode('login')
        showToast(
          'error',
          'This sign-in link has already been used or has expired',
          'Each link works once and expires after 15 minutes. Enter your email to get a new one.',
        )
      }
    })()
  }, [])

  const resetForm = (overrides = {}) => {
    setFormData({ ...emptyForm, ...overrides })
  }

  const openLogin = ({ email = '', role = authRole } = {}) => {
    setMode('login')
    setAuthRole(role)
    setMagicLinkRequest(null)
    setAuthNotice('')
    resetForm({ email })
  }

  const openSignup = ({ email = '', notice = '', role = authRole } = {}) => {
    setMode('signup')
    setAuthRole(role)
    setAuthNotice(notice)
    setMagicLinkRequest(null)
    resetForm({ email })
  }

  const handleChange = (event) => {
    const { checked, name, type, value } = event.target
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleRequestMagicLink = async (event) => {
    event.preventDefault()
    const email = normalizeEmail(formData.email)

    if (!isValidEmail(email)) {
      setAuthNotice('Enter a valid email to continue.')
      showToast('error', 'Email needs a second look', 'Use a valid work or personal email address.')
      return
    }

    setLoadingAction('magicLink')
    setAuthNotice('')

    try {
      // SRS-FR-04: the server emails a one-time link; signing in happens only when
      // that link is opened (/auth/callback?token=...). The token never reaches this page.
      const res = await requestMagicLink(email)
      storage.set(PENDING_EMAIL_KEY, email)
      setFormData((current) => ({ ...current, email }))
      setMagicLinkRequest({
        email,
        role: authRole,
        source: 'login',
      })
      setAuthNotice(res.message || 'If that email is registered, a sign-in link is on its way.')
      showToast('success', 'Magic link sent', `Check ${email} for your secure sign-in link.`)
    } catch (error) {
      setAuthNotice(error.message)
      showToast('error', 'Could not send link', error.message)
    } finally {
      setLoadingAction('')
    }
  }

  const handleResendMagicLink = async () => {
    const email = magicLinkRequest?.email || normalizeEmail(formData.email)

    if (!email) {
      setAuthNotice('Enter your email first so we can send a sign-in link.')
      showToast('info', 'Email first', 'Tell us where to send the sign-in link.')
      return
    }

    setLoadingAction('resendMagicLink')
    try {
      await requestMagicLink(email)
      showToast('success', 'Magic link resent', `Check ${email} for the newest sign-in link.`)
    } catch (error) {
      showToast('error', 'Could not resend link', error.message)
    } finally {
      setLoadingAction('')
    }
  }

  const handleChangeAuthEmail = () => {
    setMagicLinkRequest(null)
    setAuthNotice('')
  }

  const handleGoLanding = () => {
    setMode('landing')
    setAuthNotice('')
    setToast(null)
  }

  const handleLogout = () => {
    const name = currentUser?.name?.split(' ')[0] || 'Account'

    storage.remove(SESSION_KEY)
    storage.remove(PROFILE_KEY)
    setCurrentUser(null)
    setCurrentRole('candidate')
    setAuthRole('candidate')
    setMagicLinkRequest(null)
    setAuthNotice('')
    resetForm()
    setMode('landing')
    showToast('success', 'Logged out', `${name} has been signed out.`)
  }

  // Signed out, then straight to the sign-in page for the other account type.
  const handleSwitchAccount = (role) => {
    storage.remove(SESSION_KEY)
    storage.remove(PROFILE_KEY)
    setCurrentUser(null)
    setCurrentRole('candidate')
    openLogin({ role })
    showToast('info', 'Signed out', `Enter your ${role === 'company' ? 'recruiter' : 'candidate'} email to get a sign-in link.`)
  }

  // The dashboard follows the page the user picked; the role always comes from the
  // session (never from the button), so each dashboard can spot a mismatch.
  const handleChooseCompany = () => {
    if (currentUser) {
      setMode('company')
      return
    }

    openLogin({ role: 'company' })
  }

  const handleChooseCandidate = () => {
    if (currentUser) {
      setMode('candidate')
      return
    }

    openLogin({ role: 'candidate' })
  }

  const handleGetStarted = () => {
    if (!currentUser) {
      openLogin({ role: 'candidate' })
      return
    }

    setMode(currentRole === 'company' ? 'company' : 'candidate')
  }

  return (
    <>
      {mode === 'login' ? (
        <Login
          authRole={authRole}
          formData={formData}
          isLoading={Boolean(loadingAction)}
          loadingAction={loadingAction}
          magicLinkRequest={magicLinkRequest}
          notice={authNotice}
          onChange={handleChange}
          onChangeEmail={handleChangeAuthEmail}
          onGoToLanding={handleGoLanding}
          onResendMagicLink={handleResendMagicLink}
          onSwitchToSignup={() => openSignup({ email: formData.email, role: authRole })}
          onSubmit={handleRequestMagicLink}
        />
      ) : mode === 'signup' ? (
        <Signup
          onGoToLanding={handleGoLanding}
          onSwitchToLogin={() => openLogin({ email: formData.email, role: authRole })}
        />
      ) : mode === 'company' ? (
        <CompanyDashboard
          user={currentUser}
          onBackToLanding={handleGoLanding}
          onLogout={handleLogout}
          onOpenLogin={() => openLogin({ role: 'company' })}
          sessionRole={currentUser ? currentRole : null}
          onOpenOwnDashboard={(role) => {
            // role = what the server says this session is; keep App in sync with it
            if (role) setCurrentRole(role)
            setMode(role || currentRole)
          }}
          onSwitchAccount={() => handleSwitchAccount('company')}
        />
      ) : mode === 'candidate' ? (
        <CandidateDashboard
          user={currentUser}
          onBackToLanding={handleGoLanding}
          onLogout={handleLogout}
          onOpenLogin={() => openLogin({ role: 'candidate' })}
          sessionRole={currentUser ? currentRole : null}
          onOpenOwnDashboard={(role) => {
            // role = what the server says this session is; keep App in sync with it
            if (role) setCurrentRole(role)
            setMode(role || currentRole)
          }}
          onSwitchAccount={() => handleSwitchAccount('candidate')}
        />
      ) : (
        <Landing
          currentUser={currentUser}
          currentRole={currentRole}
          onChooseCandidate={handleChooseCandidate}
          onChooseCompany={handleChooseCompany}
          onGoToLogin={() => openLogin()}
          onGoToSignup={() => openSignup()}
          onGetStarted={handleGetStarted}
          onLogout={handleLogout}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  )
}
