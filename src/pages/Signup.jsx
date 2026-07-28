import AuthShell from '../components/AuthShell'

export default function Signup({
  formData,
  isLoading,
  notice,
  onChange,
  onGoToLanding,
  onSubmit,
  onSwitchToLogin,
  onTogglePassword,
  showPassword,
}) {
  return (
    <AuthShell
      activeMode="signup"
      onLogoClick={onGoToLanding}
      onSwitchToLogin={onSwitchToLogin}
      onSwitchToSignup={() => {}}
    >
      <header className="auth-header">
        <p className="eyebrow">Create account</p>
        <h1>Build your AAAI profile.</h1>
        <p>Use one clean profile for interviews, CV screening, and follow-up decisions.</p>
      </header>

      {notice ? <p className="auth-notice">{notice}</p> : null}

      <form className="auth-form" onSubmit={onSubmit}>
        <label className="field-group" htmlFor="signup-name">
          <span>Full name</span>
          <input
            id="signup-name"
            name="fullName"
            type="text"
            placeholder="Avery Chen"
            value={formData.fullName}
            onChange={onChange}
            autoComplete="name"
            autoFocus
          />
        </label>

        <label className="field-group" htmlFor="signup-email">
          <span>Email</span>
          <input
            id="signup-email"
            name="email"
            type="email"
            placeholder="you@company.com"
            value={formData.email}
            onChange={onChange}
            autoComplete="email"
          />
        </label>

        <label className="field-group" htmlFor="signup-password">
          <span>Password</span>
          <div className="password-row">
            <input
              id="signup-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a password"
              value={formData.password}
              onChange={onChange}
              autoComplete="new-password"
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

        <label className="field-group" htmlFor="signup-confirm-password">
          <span>Confirm password</span>
          <input
            id="signup-confirm-password"
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={onChange}
            autoComplete="new-password"
          />
        </label>

        <label className="terms-row" htmlFor="acceptTerms">
          <input
            id="acceptTerms"
            name="acceptTerms"
            type="checkbox"
            checked={formData.acceptTerms}
            onChange={onChange}
          />
          <span>I agree to thoughtful, bias-aware screening and product updates.</span>
        </label>

        <button type="submit" className="submit-button" disabled={isLoading} aria-busy={isLoading}>
          {isLoading ? <span className="button-spinner" aria-hidden="true" /> : null}
          <span>{isLoading ? 'Creating account' : 'Create account'}</span>
        </button>
      </form>
    </AuthShell>
  )
}
