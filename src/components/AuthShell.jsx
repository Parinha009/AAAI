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
          <p className="eyebrow">Asynchronous hiring studio</p>
          <h2>Clean signal for every interview, from first screen to final shortlist.</h2>
          <p>
            A calmer way to qualify talent: structured prompts, thoughtful scoring, and candidate-friendly pacing.
          </p>
        </div>

        <div className="auth-proof-grid" aria-label="Platform highlights">
          <div>
            <span className="proof-value">4.8x</span>
            <span className="proof-label">faster shortlist</span>
          </div>
          <div>
            <span className="proof-value">24h</span>
            <span className="proof-label">screening window</span>
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
