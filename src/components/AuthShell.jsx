export default function AuthShell({
  activeMode,
  children,
  heroSubtitle,
  heroTitle,
  logoAlt,
  logoSrc,
  onSwitchToLogin,
  onSwitchToSignup,
}) {
  return (
    <main className="auth-page">
      <section className="auth-hero" aria-hidden="true">
        <div className="hero-copy">
          <img className="brand-logo" src={logoSrc} alt={logoAlt} />
          <p>{heroSubtitle}</p>
          <h2>{heroTitle}</h2>
        </div>
      </section>

      <section className="auth-panel" aria-label="Authentication form">
        <div className="mode-switch" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === 'login'}
            className={activeMode === 'login' ? 'switch-button active' : 'switch-button'}
            onClick={onSwitchToLogin}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === 'signup'}
            className={activeMode === 'signup' ? 'switch-button active' : 'switch-button'}
            onClick={onSwitchToSignup}
          >
            Sign Up
          </button>
        </div>

        {children}
      </section>
    </main>
  )
}