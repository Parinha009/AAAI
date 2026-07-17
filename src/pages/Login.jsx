import AuthShell from '../components/AuthShell'

export default function Login({
  formData,
  message,
  onChange,
  onForgetPassword,
  onSubmit,
  onSwitchToSignup,
  onTogglePassword,
  showPassword,
}) {
  return (
    <AuthShell
      activeMode="login"
      heroSubtitle="Set your preference, We match you with jobs."
      heroTitle="Track everything in your dashboard"
      logoAlt="AAAI Main logo"
      logoSrc="/logo.svg"
      onSwitchToLogin={() => {}}
      onSwitchToSignup={onSwitchToSignup}
    >
      <header className="auth-header">
        <h1>Login To</h1>
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
              autoComplete="current-password"
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
          <button type="button" className="text-link" onClick={onForgetPassword}>
            Forget Password
          </button>
        </label>

        <label className="auth-form-spacer" aria-hidden="true">
          <span>Confirm Password</span>
          <div className="password-row">
            <input tabIndex={-1} type="password" placeholder="Confirm Password" readOnly />
          </div>
        </label>

        <button type="submit" className="submit-button">
          Login
        </button>

        {message ? <p className="status-message">{message}</p> : null}
      </form>
    </AuthShell>
  )
}