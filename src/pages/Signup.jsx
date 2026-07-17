import AuthShell from '../components/AuthShell'

export default function Signup({
  formData,
  message,
  onChange,
  onSubmit,
  onSwitchToLogin,
  onTogglePassword,
  showPassword,
}) {
  return (
    <AuthShell
      activeMode="signup"
      heroSubtitle="Set your preference, We match you with jobs."
      heroTitle="Track everything in your dashboard"
      logoAlt="AAAI Main logo"
      logoSrc="/logo.svg"
      onSwitchToLogin={onSwitchToLogin}
      onSwitchToSignup={() => {}}
    >
      <header className="auth-header">
        <h1>Sign Up To</h1>
        <h2>Your Candidate Account</h2>
      </header>

      <form className="auth-form" onSubmit={onSubmit}>
        <label>
          <span>Email</span>
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={onChange}
            autoComplete="email"
          />
        </label>

        <label>
          <span>Password</span>
          <div className="password-row">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={formData.password}
              onChange={onChange}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="icon-button"
              onClick={onTogglePassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        <label>
          <span>Confirm Password</span>
          <div className="password-row">
            <input
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={onChange}
              autoComplete="new-password"
            />
          </div>
        </label>

        <div className="forgot-password-spacer" aria-hidden="true">
          <button type="button" className="text-link spacer-link" tabIndex={-1}>
            Forget Password
          </button>
        </div>

        <button type="submit" className="submit-button">
          Sign Up
        </button>

        {message ? <p className="status-message">{message}</p> : null}
      </form>
    </AuthShell>
  )
}