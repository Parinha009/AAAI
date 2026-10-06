import AuthShell from '../components/AuthShell'

const roleLabels = {
  candidate: 'Candidate workspace',
  company: 'Company workspace',
}

function LoadingLabel({ isLoading, label, loadingLabel }) {
  return (
    <>
      {isLoading ? <span className="button-spinner" aria-hidden="true" /> : null}
      <span>{isLoading ? loadingLabel : label}</span>
    </>
  )
}

export default function Login({
  authRole,
  formData,
  isLoading,
  loadingAction,
  magicLinkRequest,
  notice,
  onChange,
  onChangeEmail,
  onGoToLanding,
  onResendMagicLink,
  onSwitchToSignup,
  onSubmit,
}) {
  const isLinkSent = Boolean(magicLinkRequest)
  const selectedRole = magicLinkRequest?.role || authRole

  return (
    <AuthShell
      activeMode="login"
      onLogoClick={onGoToLanding}
      onSwitchToLogin={() => {}}
      onSwitchToSignup={onSwitchToSignup}
    >
      <header className="auth-header">
        <p className="eyebrow">{isLinkSent ? 'Check your inbox' : 'Passwordless sign in'}</p>
        <h1>{isLinkSent ? 'Your magic link is on its way.' : 'Sign in with one emailed link.'}</h1>
        <p>
          {isLinkSent
            ? 'Open the link from your email to verify this browser and continue into AAAI.'
            : 'Enter your email and AAAI will send a secure link. No password is created or stored.'}
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
                If that email has access, a {roleLabels[selectedRole].toLowerCase()} sign-in link is on its way.
                Open the email and click <strong>Sign in</strong>. The link works once and expires after 15 minutes.
              </p>
            </div>
          </section>

          <div className="auth-link-actions">
            <button
              type="button"
              className="text-link"
              onClick={onResendMagicLink}
              disabled={isLoading}
              aria-busy={loadingAction === 'resendMagicLink'}
            >
              {loadingAction === 'resendMagicLink' ? 'Resending link...' : 'Resend link'}
            </button>
            <button type="button" className="text-link" onClick={onChangeEmail}>
              Use another email
            </button>
          </div>
        </div>
      ) : (
        <form className="auth-form" onSubmit={onSubmit}>
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
            disabled={loadingAction === 'magicLink'}
            aria-busy={loadingAction === 'magicLink'}
          >
            <LoadingLabel
              isLoading={loadingAction === 'magicLink'}
              label="Send magic link"
              loadingLabel="Sending link"
            />
          </button>
        </form>
      )}
    </AuthShell>
  )
}
