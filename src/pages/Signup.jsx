import AuthShell from '../components/AuthShell'

// AAAI accounts are invite-only (SRS-2.3 / FR-04): candidates are invited by a
// recruiter for a specific job, and recruiters are provisioned by the team.
// So there is no self sign-up — this page explains how to get in instead.
export default function Signup({ onGoToLanding, onSwitchToLogin }) {
  return (
    <AuthShell
      activeMode="signup"
      onLogoClick={onGoToLanding}
      onSwitchToLogin={onSwitchToLogin}
      onSwitchToSignup={() => {}}
    >
      <header className="auth-header">
        <p className="eyebrow">Invite only</p>
        <h1>Accounts are created by invitation.</h1>
        <p>
          AAAI doesn&apos;t use open sign-up or passwords. You get access through a secure, one-time
          sign-in link sent to your email.
        </p>
      </header>

      <div className="auth-form">
        <section className="magic-link-card" aria-label="How to get access">
          <div className="magic-link-icon" aria-hidden="true">@</div>
          <div>
            <strong>Candidates</strong>
            <p>
              A recruiter invites you to a job by email. Open the invitation email and click
              <strong> Sign in</strong> to start your interview.
            </p>
          </div>
        </section>

        <section className="magic-link-card" aria-label="Recruiter access">
          <div className="magic-link-icon" aria-hidden="true">@</div>
          <div>
            <strong>Recruiters</strong>
            <p>Your account is set up by your team. Ask your admin to add your work email.</p>
          </div>
        </section>

        <button type="button" className="submit-button" onClick={onSwitchToLogin}>
          Already invited? Log in
        </button>
      </div>
    </AuthShell>
  )
}
