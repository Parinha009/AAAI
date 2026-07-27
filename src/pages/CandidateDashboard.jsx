export default function CandidateDashboard({ onOpenLogin, onOpenSignup, onBackToLanding }) {
  return (
    <main className="candidate-page">
      <header className="candidate-topbar">
        <div className="candidate-brand">
          <img className="candidate-logo" src="/logo.svg" alt="AAAI Main logo" />
          <span>TalentPulse</span>
        </div>

        <div className="candidate-top-actions">
          <button type="button" className="candidate-link" onClick={onBackToLanding}>
            Home
          </button>
          <button type="button" className="candidate-link" onClick={onOpenLogin}>
            Login
          </button>
          <button type="button" className="candidate-link primary" onClick={onOpenSignup}>
            Sign Up
          </button>
        </div>
      </header>

      <section className="candidate-hero">
        <p className="candidate-pill">Now powered by Claude Opus 4.8</p>
        <h1>AI Interview &amp; CV Screener</h1>
        <p className="candidate-copy">
          Flowmingo saves recruiters time and helps them discover hidden talents faster and more fairly.
        </p>
        <h2>FREE. FOREVER.</h2>
        <button type="button" className="candidate-cta" onClick={onOpenSignup}>
          Get Started Free →
        </button>
      </section>
    </main>
  )
}
