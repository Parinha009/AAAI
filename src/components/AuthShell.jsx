export default function AuthShell({
  activeMode,
  children,
  onLogoClick,
  onSwitchToLogin,
  onSwitchToSignup,
}) {
  return (
    <main className="auth-page">
      <section className="auth-side" aria-label="AAAI product promise">
        <button type="button" className="auth-brand-button" onClick={onLogoClick}>
          <img className="auth-brand-logo" src="/logo.svg" alt="AAAI logo" />
          <span>AAAI</span>
        </button>

        <div className="auth-side-copy">
          <p className="eyebrow">AI-powered hiring platform</p>
          <h2>Screen candidates with structure and confidence.</h2>
          <p>
            AAAI brings CV review, asynchronous interviews, and shortlist signals into one focused
            recruiter workspace.
          </p>
        </div>

        <div className="auth-proof-grid" aria-label="Platform highlights">
          <div>
            <span className="proof-value">4.8x</span>
            <span className="proof-label">faster shortlist review</span>
          </div>
          <div>
            <span className="proof-value">24h</span>
            <span className="proof-label">candidate-friendly access</span>
          </div>
        </div>
      </section>

      <section className="auth-panel" aria-label="Authentication form">
        <div className="auth-panel-inner">
          <div className="mode-switch" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === 'login'}
              className={activeMode === 'login' ? 'switch-button active' : 'switch-button'}
              onClick={onSwitchToLogin}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === 'signup'}
              className={activeMode === 'signup' ? 'switch-button active' : 'switch-button'}
              onClick={onSwitchToSignup}
            >
              Sign up
            </button>
          </div>

          {children}
        </div>
      </section>
    </main>
  )
}
