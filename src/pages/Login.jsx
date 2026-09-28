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
  onOpenMagicLink,
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
        <p className="eyebrow">{isLinkSent ? 'Check your inbox' : 'Secure sign in'}</p>
        <h1>{isLinkSent ? 'Your sign-in link is on its way.' : 'Welcome back.'}</h1>
        <p>
          {isLinkSent
            ? 'Open the link from your email to verify this browser and continue into AAAI.'
            : "Enter your email and we'll send you a secure sign-in link. No password is required."}
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
                {roleLabels[selectedRole]} access is attached to this link. It expires soon and can only be used once.
                This demo includes a local verification button in place of an email inbox.
              </p>
            </div>
          </section>

          <button
            type="button"
            className="submit-button"
            onClick={onOpenMagicLink}
          >
            Open demo sign-in link
          </button>

          <div className="auth-link-actions">
            <button
              type="button"
              className="text-link"
              onClick={onResendMagicLink}
              disabled={isLoading}
              aria-busy={loadingAction === 'resendMagicLink'}
            >
              {loadingAction === 'resendMagicLink' ? 'Resending link...' : 'Resend sign-in link'}
            </button>
            <button type="button" className="text-link" onClick={onChangeEmail}>
              Use another email
            </button>
          </div>
        </div>
      ) : (
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field-group" htmlFor="login-email">
            <span>Work email</span>
            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="name@company.com"
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
              label="Send sign-in link"
              loadingLabel="Sending link"
            />
          </button>
        </form>
      )}
    </AuthShell>
  )
}
