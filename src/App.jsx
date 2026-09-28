import { useEffect, useState } from 'react'
import Icon from './components/Icon'
import CandidateDashboard from './pages/CandidateDashboard'
import CompanyDashboard from './pages/CompanyDashboard'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'

const existingAccounts = new Set([
  'alex@aaai.ai',
  'demo@aaai.ai',
  'candidate@example.com',
  'recruiter@example.com',
  'ben@gmail.com',
])

const accountProfiles = new Map([
  ['alex@aaai.ai', { name: 'Alex', email: 'alex@aaai.ai' }],
  ['demo@aaai.ai', { name: 'Demo', email: 'demo@aaai.ai' }],
  ['candidate@example.com', { name: 'Candidate', email: 'candidate@example.com' }],
  ['recruiter@example.com', { name: 'Recruiter', email: 'recruiter@example.com' }],
  ['ben@gmail.com', { name: 'Ben', email: 'ben@gmail.com' }],
])

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

  const handleRequestMagicLink = (event) => {
    event.preventDefault()
    const email = normalizeEmail(formData.email)

    if (!isValidEmail(email)) {
      setAuthNotice('Enter a valid email to continue.')
      showToast('error', 'Email needs a second look', 'Use a valid work or personal email address.')
      return
    }

    setLoadingAction('magicLink')
    setAuthNotice('')

    window.setTimeout(() => {
      setFormData((current) => ({ ...current, email }))
      setMagicLinkRequest({
        email,
        role: authRole,
        source: 'login',
      })
      setAuthNotice('If that email is registered, a sign-in link is on its way.')
      showToast('success', 'Magic link sent', `Check ${email} for your secure sign-in link.`)

      setLoadingAction('')
    }, 650)
  }

  const handleSignup = (event) => {
    event.preventDefault()
    const fullName = formData.fullName.trim()
    const email = normalizeEmail(formData.email)

    if (!fullName) {
      setAuthNotice('Add your full name so your profile feels complete.')
      showToast('error', 'Full name required', 'Add the name you want hiring teams to see.')
      return
    }

    if (!isValidEmail(email)) {
      setAuthNotice('Enter a valid email to create your account.')
      showToast('error', 'Email needs a second look', 'Use a valid email address for your account.')
      return
    }

    if (!formData.acceptTerms) {
      setAuthNotice('Accept the screening terms before we email your sign-in link.')
      showToast('error', 'Terms required', 'Confirm the screening terms to finish account setup.')
      return
    }

    setLoadingAction('signup')
    setAuthNotice('')

    window.setTimeout(() => {
      setFormData((current) => ({ ...current, email, fullName }))
      setMagicLinkRequest({
        email,
        name: fullName,
        role: authRole,
        source: 'signup',
      })
      setAuthNotice('Check your inbox to finish signing in. No password is required.')
      showToast('success', 'Magic link sent', `Check ${email} to verify your account.`)
      setLoadingAction('')
    }, 760)
  }

  const handleResendMagicLink = () => {
    const email = magicLinkRequest?.email || normalizeEmail(formData.email)

    if (!email) {
      setAuthNotice('Enter your email first so we can send a sign-in link.')
      showToast('info', 'Email first', 'Tell us where to send the sign-in link.')
      return
    }

    setLoadingAction('resendMagicLink')

    window.setTimeout(() => {
      showToast('success', 'Magic link resent', `Check ${email} for the newest sign-in link.`)
      setLoadingAction('')
    }, 520)
  }

  const handleChangeAuthEmail = () => {
    setMagicLinkRequest(null)
    setAuthNotice('')
  }

  const handleOpenMagicLink = () => {
    if (!magicLinkRequest) {
      return
    }

    const email = magicLinkRequest.email
    const knownProfile = accountProfiles.get(email)
    const fallbackName = magicLinkRequest.name || (existingAccounts.has(email) ? 'Candidate' : email.split('@')[0])
    const profile = knownProfile || {
      name: fallbackName,
      email,
    }

    if (!existingAccounts.has(email)) {
      existingAccounts.add(email)
    }
    accountProfiles.set(email, profile)

    setCurrentUser(profile)
    setCurrentRole(magicLinkRequest.role === 'company' ? 'company' : 'candidate')
    showToast('success', 'Signed in', 'Your magic link was verified.')
    resetForm()
    setMagicLinkRequest(null)
    setMode('landing')
  }

  const handleGoLanding = () => {
    setMode('landing')
    setAuthNotice('')
    setToast(null)
  }

  const handleLogout = () => {
    const name = currentUser?.name?.split(' ')[0] || 'Account'

    setCurrentUser(null)
    setCurrentRole('candidate')
    setAuthRole('candidate')
    setMagicLinkRequest(null)
    setAuthNotice('')
    resetForm()
    setMode('landing')
    showToast('success', 'Logged out', `${name} has been signed out.`)
  }

  const handleChooseCompany = () => {
    if (currentUser) {
      setCurrentRole('company')
      setMode('company')
      return
    }

    openLogin({ role: 'company' })
  }

  const handleChooseCandidate = () => {
    if (currentUser) {
      setCurrentRole('candidate')
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
          onOpenMagicLink={handleOpenMagicLink}
          onResendMagicLink={handleResendMagicLink}
          onSwitchToSignup={() => openSignup({ email: formData.email, role: authRole })}
          onSubmit={handleRequestMagicLink}
        />
      ) : mode === 'signup' ? (
        <Signup
          authRole={authRole}
          formData={formData}
          isLoading={loadingAction === 'signup'}
          loadingAction={loadingAction}
          magicLinkRequest={magicLinkRequest}
          notice={authNotice}
          onChange={handleChange}
          onChangeEmail={handleChangeAuthEmail}
          onGoToLanding={handleGoLanding}
          onOpenMagicLink={handleOpenMagicLink}
          onResendMagicLink={handleResendMagicLink}
          onSubmit={handleSignup}
          onSwitchToLogin={() => openLogin({ email: formData.email, role: authRole })}
        />
      ) : mode === 'company' ? (
        <CompanyDashboard
          user={currentUser}
          onBackToLanding={handleGoLanding}
          onLogout={handleLogout}
          onOpenLogin={() => openLogin({ role: 'company' })}
        />
      ) : mode === 'candidate' ? (
        <CandidateDashboard
          user={currentUser}
          onBackToLanding={handleGoLanding}
          onLogout={handleLogout}
          onOpenLogin={() => openLogin({ role: 'candidate' })}
          onOpenSignup={() => openSignup({ role: 'candidate' })}
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
