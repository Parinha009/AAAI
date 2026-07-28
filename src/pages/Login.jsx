import AuthShell from '../components/AuthShell'

function LoadingLabel({ isLoading, label, loadingLabel }) {
  return (
    <>
      {isLoading ? <span className="button-spinner" aria-hidden="true" /> : null}
      <span>{isLoading ? loadingLabel : label}</span>
    </>
  )
}

export default function Login({
  confirmedEmail,
  formData,
  isLoading,
  loadingAction,
  loginStep,
  notice,
  onChange,
  onChangeEmail,
  onForgetPassword,
  onGoToLanding,
  onLogin,
  onSwitchToSignup,
  onTogglePassword,
  onVerifyEmail,
  showPassword,
}) {
  const isEmailStep = loginStep === 'email'

  return (
    <AuthShell
      activeMode="login"
      onLogoClick={onGoToLanding}
      onSwitchToLogin={() => {}}
      onSwitchToSignup={onSwitchToSignup}
    >
      <header className="auth-header">
        <p className="eyebrow">{isEmailStep ? 'Secure sign in' : 'Welcome back'}</p>
        <h1>{isEmailStep ? 'Start with your email.' : 'Continue with your password.'}</h1>
        <p>
          {isEmailStep
            ? 'We will check whether your account exists before asking for anything else.'
            : 'Your email is verified. Enter your password to open your workspace.'}
        </p>
      </header>

      {notice ? <p className="auth-notice">{notice}</p> : null}

      {isEmailStep ? (
        <form className="auth-form" onSubmit={onVerifyEmail}>
          <label className="field-group" htmlFor="login-email">
            <span>Email</span>
            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="you@company.com"
              value={formData.email}
              onChange={onChange}
              autoComplete="email"
              autoFocus
            />
          </label>

          <button
            type="submit"
            className="submit-button"
            disabled={loadingAction === 'verifyEmail'}
            aria-busy={loadingAction === 'verifyEmail'}
          >
            <LoadingLabel
              isLoading={loadingAction === 'verifyEmail'}
              label="Continue"
              loadingLabel="Checking email"
            />
          </button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={onLogin}>
          <div className="confirmed-email">
            <div>
              <span className="confirmed-label">Signed in as</span>
              <strong>{confirmedEmail}</strong>
            </div>
            <button type="button" className="inline-button" onClick={onChangeEmail}>
              Change email
            </button>
          </div>

          <label className="field-group" htmlFor="login-password">
            <span>Password</span>
            <div className="password-row">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={formData.password}
                onChange={onChange}
                autoComplete="current-password"
                autoFocus
              />
              <button
                type="button"
                className="reveal-button"
                onClick={onTogglePassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          <button
            type="button"
            className="text-link"
            onClick={onForgetPassword}
            disabled={isLoading}
            aria-busy={loadingAction === 'resetPassword'}
          >
            {loadingAction === 'resetPassword' ? 'Sending reset link...' : 'Forgot password?'}
          </button>

          <button
            type="submit"
            className="submit-button"
            disabled={loadingAction === 'login'}
            aria-busy={loadingAction === 'login'}
          >
            <LoadingLabel isLoading={loadingAction === 'login'} label="Log in" loadingLabel="Opening workspace" />
          </button>
        </form>
      )}
    </AuthShell>
  )
}
