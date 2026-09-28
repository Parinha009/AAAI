import AuthShell from '../components/AuthShell'

const roleLabels = {
  candidate: 'Candidate workspace',
  company: 'Company workspace',
}

export default function Signup({
  authRole,
  formData,
  isLoading,
  loadingAction,
  magicLinkRequest,
  notice,
  onChange,
  onChangeEmail,
  onGoToLanding,
  onOpenMagicLink,
  onResendMagicLink,
  onSubmit,
  onSwitchToLogin,
}) {
  const isLinkSent = Boolean(magicLinkRequest)
  const selectedRole = magicLinkRequest?.role || authRole

  return (
    <AuthShell
      activeMode="signup"
      onLogoClick={onGoToLanding}
      onSwitchToLogin={onSwitchToLogin}
      onSwitchToSignup={() => {}}
    >
      <header className="auth-header">
        <p className="eyebrow">{isLinkSent ? 'Verify your email' : 'Create account'}</p>
        <h1>{isLinkSent ? 'Finish creating your account.' : 'Create your AAAI account.'}</h1>
        <p>
          {isLinkSent
            ? 'Use the emailed link to verify this account and continue without a password.'
            : 'Set up your account to create interviews, screen candidates, and manage your shortlist.'}
        </p>
      </header>

      {notice ? <p className="auth-notice">{notice}</p> : null}

      {isLinkSent ? (
        <div className="auth-form">
          <section className="magic-link-card" aria-label="Magic link sent">
            <div className="magic-link-icon" aria-hidden="true">@</div>
            <div>
              <strong>Sent to {magicLinkRequest.email}</strong>
              <p>
                {roleLabels[selectedRole]} access is ready to verify. This demo includes a local verification button
                in place of an email inbox.
              </p>
            </div>
          </section>

          <button
            type="button"
            className="submit-button"
            onClick={onOpenMagicLink}
          >
            Open demo verification link
          </button>

          <div className="auth-link-actions">
            <button
              type="button"
              className="text-link"
              onClick={onResendMagicLink}
              disabled={loadingAction === 'resendMagicLink'}
              aria-busy={loadingAction === 'resendMagicLink'}
            >
              {loadingAction === 'resendMagicLink' ? 'Resending link...' : 'Resend verification link'}
            </button>
            <button type="button" className="text-link" onClick={onChangeEmail}>
              Edit email
            </button>
          </div>
        </div>
      ) : (
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
            <span>Work email</span>
            <input
              id="signup-email"
              name="email"
              type="email"
              placeholder="name@company.com"
              value={formData.email}
              onChange={onChange}
              autoComplete="email"
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
            <span>I agree to the Terms of Service and Privacy Policy.</span>
          </label>

          <label className="terms-row" htmlFor="productUpdates">
            <input
              id="productUpdates"
              name="productUpdates"
              type="checkbox"
              checked={formData.productUpdates}
              onChange={onChange}
            />
            <span>Send me occasional product updates.</span>
          </label>

          <button type="submit" className="submit-button" disabled={isLoading} aria-busy={isLoading}>
            {isLoading ? <span className="button-spinner" aria-hidden="true" /> : null}
            <span>{isLoading ? 'Sending link' : 'Create account'}</span>
          </button>
        </form>
      )}
    </AuthShell>
  )
}
