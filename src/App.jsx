import { useEffect, useState } from 'react'
import Icon from './components/Icon'
import CandidateDashboard from './pages/CandidateDashboard'
import CompanyDashboard from './pages/CompanyDashboard'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'

const existingAccounts = new Map([
  ['alex@aaai.ai', ''],
  ['demo@aaai.ai', ''],
  ['candidate@example.com', ''],
  ['recruiter@example.com', ''],
  ['ben@gmail.com', 'ben'],
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
  password: '',
  confirmPassword: '',
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
  const [loginStep, setLoginStep] = useState('email')
  const [confirmedEmail, setConfirmedEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loadingAction, setLoadingAction] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [toast, setToast] = useState(null)
  const [currentUser, setCurrentUser] = useState(accountProfiles.get('ben@gmail.com'))

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
    setShowPassword(false)
  }

  const openLogin = ({ email = '', role = authRole } = {}) => {
    setMode('login')
    setAuthRole(role)
    setLoginStep('email')
    setConfirmedEmail('')
    setAuthNotice('')
    resetForm({ email })
  }

  const openSignup = ({ email = '', notice = '' } = {}) => {
    setMode('signup')
    setAuthNotice(notice)
    setLoginStep('email')
    setConfirmedEmail('')
    resetForm({ email })
  }

  const handleChange = (event) => {
    const { checked, name, type, value } = event.target
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleVerifyEmail = (event) => {
    event.preventDefault()
    const email = normalizeEmail(formData.email)

    if (!isValidEmail(email)) {
      setAuthNotice('Enter a valid email to continue.')
      showToast('error', 'Email needs a second look', 'Use a valid work or personal email address.')
      return
    }

    setLoadingAction('verifyEmail')
    setAuthNotice('')

    window.setTimeout(() => {
      if (existingAccounts.has(email)) {
        setConfirmedEmail(email)
        setLoginStep('password')
        setFormData((current) => ({ ...current, email, password: '' }))
        setAuthNotice('Email verified. Welcome back.')
        showToast('success', 'Email verified', 'Welcome back. Continue with your password.')
      } else {
        openSignup({
          email,
          notice: "We couldn't find an account with this email. Let's create one.",
        })
        showToast('info', 'New account ready', "We couldn't find that email, so we started a clean signup for you.")
      }

      setLoadingAction('')
    }, 650)
  }

  const handleLogin = (event) => {
    event.preventDefault()

    if (!formData.password.trim()) {
      setAuthNotice('Enter your password to continue.')
      showToast('error', 'Password required', 'Your account is ready after you enter your password.')
      return
    }

    setLoadingAction('login')
    setAuthNotice('')

    window.setTimeout(() => {
      const savedPassword = existingAccounts.get(confirmedEmail)

      if (
        (savedPassword && formData.password.trim() !== savedPassword)
        || (!savedPassword && formData.password.trim().toLowerCase() === 'wrong')
      ) {
        setAuthNotice('Invalid password. Try again or reset it.')
        showToast('error', 'Invalid password', 'That password did not match this account.')
        setLoadingAction('')
        return
      }

      showToast('success', 'Welcome back', 'Your workspace is opening now.')
      setCurrentUser(accountProfiles.get(confirmedEmail) || { name: 'Candidate', email: confirmedEmail })
      resetForm()
      setConfirmedEmail('')
      setLoginStep('email')
      setMode(authRole === 'company' ? 'company' : 'candidate')
      setLoadingAction('')
    }, 700)
  }

  const handleSignup = (event) => {
    event.preventDefault()
    const email = normalizeEmail(formData.email)

    if (!formData.fullName.trim()) {
      setAuthNotice('Add your full name so your profile feels complete.')
      showToast('error', 'Full name required', 'Add the name you want hiring teams to see.')
      return
    }

    if (!isValidEmail(email)) {
      setAuthNotice('Enter a valid email to create your account.')
      showToast('error', 'Email needs a second look', 'Use a valid email address for your account.')
      return
    }

    if (existingAccounts.has(email)) {
      setMode('login')
      setConfirmedEmail(email)
      setLoginStep('password')
      setAuthNotice('Email already registered. Continue with your password.')
      setFormData({ ...emptyForm, email })
      showToast('warning', 'Email already registered', 'We found your account and moved you to sign in.')
      return
    }

    if (formData.password.length < 8) {
      setAuthNotice('Use at least 8 characters for your password.')
      showToast('error', 'Password too short', 'Choose a password with 8 or more characters.')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setAuthNotice("Those passwords don't match yet.")
      showToast('error', 'Passwords do not match', 'Check both password fields and try again.')
      return
    }

    setLoadingAction('signup')
    setAuthNotice('')

    window.setTimeout(() => {
      showToast('success', 'Account created successfully', 'Your candidate workspace is ready.')
      setCurrentUser({ name: formData.fullName.trim(), email })
      resetForm()
      setMode(authRole === 'company' ? 'company' : 'candidate')
      setLoadingAction('')
    }, 760)
  }

  const handleForgetPassword = () => {
    const email = confirmedEmail || normalizeEmail(formData.email)

    if (!email) {
      setAuthNotice('Enter your email first so we can send a reset link.')
      showToast('info', 'Email first', 'Tell us which account needs a reset link.')
      return
    }

    setLoadingAction('resetPassword')

    window.setTimeout(() => {
      showToast('success', 'Reset link sent', `Check ${email} for a secure reset link.`)
      setLoadingAction('')
    }, 520)
  }

  const handleChangeEmail = () => {
    setLoginStep('email')
    setConfirmedEmail('')
    setAuthNotice('')
    setFormData((current) => ({ ...current, password: '' }))
  }

  const handleGoLanding = () => {
    setMode('landing')
    setAuthNotice('')
    setToast(null)
  }

  const handleChooseCompany = () => openLogin({ role: 'company' })

  const handleChooseCandidate = () => openLogin({ role: 'candidate' })

  return (
    <>
      {mode === 'login' ? (
        <Login
          confirmedEmail={confirmedEmail}
          formData={formData}
          isLoading={Boolean(loadingAction)}
          loadingAction={loadingAction}
          loginStep={loginStep}
          notice={authNotice}
          onChange={handleChange}
          onChangeEmail={handleChangeEmail}
          onForgetPassword={handleForgetPassword}
          onGoToLanding={handleGoLanding}
          onLogin={handleLogin}
          onSwitchToSignup={() => openSignup({ email: formData.email })}
          onTogglePassword={() => setShowPassword((current) => !current)}
          onVerifyEmail={handleVerifyEmail}
          showPassword={showPassword}
        />
      ) : mode === 'signup' ? (
        <Signup
          formData={formData}
          isLoading={loadingAction === 'signup'}
          notice={authNotice}
          onChange={handleChange}
          onGoToLanding={handleGoLanding}
          onSubmit={handleSignup}
          onSwitchToLogin={() => openLogin({ email: formData.email, role: authRole })}
          onTogglePassword={() => setShowPassword((current) => !current)}
          showPassword={showPassword}
        />
      ) : mode === 'company' ? (
        <CompanyDashboard
          user={currentUser}
          onBackToLanding={handleGoLanding}
        />
      ) : mode === 'candidate' ? (
        <CandidateDashboard
          user={currentUser}
          onBackToLanding={handleGoLanding}
          onOpenLogin={() => openLogin({ role: 'candidate' })}
          onOpenSignup={() => openSignup()}
        />
      ) : (
        <Landing
          onChooseCandidate={handleChooseCandidate}
          onChooseCompany={handleChooseCompany}
          onGoToLogin={() => openLogin()}
          onGoToSignup={() => openSignup()}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  )
}
