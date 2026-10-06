import Icon from './Icon'

const ROLE_NAMES = { company: 'recruiter', candidate: 'candidate' }

// Shown when a signed-in user opens the other role's dashboard (e.g. a recruiter
// on the candidate page). Sessions are role-scoped (FR-04), so instead of a failed
// request we offer the two things they might want.
export default function RoleMismatch({ sessionRole, pageRole, onOpenOwnDashboard, onSwitchAccount }) {
  const signedInAs = ROLE_NAMES[sessionRole] || 'another account'
  const pageFor = ROLE_NAMES[pageRole]

  return (
    <section className="role-mismatch" role="status">
      <span className="role-mismatch-icon" aria-hidden="true">
        <Icon name="users" size={24} />
      </span>
      <h2>You&apos;re signed in as a {signedInAs}</h2>
      <p>
        This page is for {pageFor}s. Your {signedInAs} account can&apos;t open it - each sign-in link is tied to
        one account type.
      </p>
      <div className="role-mismatch-actions">
        <button type="button" className="solid-button" onClick={() => onOpenOwnDashboard?.(sessionRole)}>
          Go to the {signedInAs} dashboard
        </button>
        <button type="button" className="soft-button" onClick={onSwitchAccount}>
          Sign in as a {pageFor} instead
        </button>
      </div>
    </section>
  )
}
