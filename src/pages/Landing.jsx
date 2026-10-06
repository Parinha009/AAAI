import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon'

// Every statement on this page describes what AAAI actually does today.
const navItems = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'for-candidates', label: 'For candidates' },
  { id: 'for-recruiters', label: 'For recruiters' },
  { id: 'fairness', label: 'Fairness & privacy' },
]

const workflowSteps = [
  {
    count: '01',
    title: 'Invite',
    copy: 'A recruiter invites a candidate by email to a hiring project. They sign in with a one-time link - no password.',
  },
  {
    count: '02',
    title: 'Interview',
    copy: 'After consent and a microphone check, the candidate answers questions out loud - 2 minutes each, drawn at random for every interview.',
  },
  {
    count: '03',
    title: 'AI scoring',
    copy: 'Whisper transcribes each answer; GPT-4o-mini scores technical skill, communication, problem solving and job fit (1-5) with a written rationale.',
  },
  {
    count: '04',
    title: 'Human review',
    copy: 'Recruiters see a ranked leaderboard, read transcripts, play recordings and check review flags. A person makes the decision.',
  },
]

const candidatePoints = [
  'Voice only - no camera, no video',
  'Answer at a time that suits you',
  '2 minutes per question, press Next when done',
  'Microphone check before you start',
  'Re-record an answer while you are on it',
  'One-time email sign-in link',
]

const recruiterPoints = [
  'Invite candidates by email',
  'Ranked leaderboard per hiring project',
  'Transcripts and playable recordings',
  'Review flags with clear reasons',
  'Tab-switch tracking and paste lock',
  'Append-only audit trail of every AI call',
]

const hiringProjects = [
  'Junior Backend Engineer',
  'Senior Frontend Engineer',
  'Full-Stack Engineer',
  'QA Engineer',
  'DevOps Engineer',
  'Data Analyst',
  'Mobile App Developer',
  'UI/UX Designer',
  'Product Manager',
  'Machine Learning Engineer',
  'Cybersecurity Analyst',
  'IT Support Specialist',
]

const roleOptions = [
  {
    id: 'company',
    title: 'Company / Recruiter',
    description: 'Invite candidates and review their scores, transcripts and recordings.',
    action: 'Continue as recruiter',
    icon: 'company',
  },
  {
    id: 'candidate',
    title: 'Candidate',
    description: 'Open the interview you were invited to.',
    action: 'Continue as candidate',
    icon: 'candidate',
  },
]

const scrollToSection = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function Landing({
  currentUser,
  currentRole = 'candidate',
  onGoToLogin,
  onGoToSignup,
  onChooseCompany,
  onChooseCandidate,
  onGetStarted,
  onLogout,
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const headerRef = useRef(null)
  const firstName = currentUser?.name?.split(' ')[0] || 'Account'
  const initial = firstName.charAt(0).toUpperCase()
  const profileRoleLabel = currentRole === 'company' ? 'Recruiter' : 'Candidate'

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsDialogOpen(false)
        setIsProfileMenuOpen(false)
      }
    }

    const handlePointerDown = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  const handleContinue = (role) => {
    setIsDialogOpen(false)

    if (role === 'company') {
      onChooseCompany()
      return
    }

    onChooseCandidate()
  }

  return (
    <main className="landing-page">
      <div className="landing-header-shell" ref={headerRef}>
        <header className="landing-nav">
          <button
            type="button"
            className="brand-button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <img src="/logo.svg" alt="AAAI logo" className="brand-logo-small" />
            <span>AAAI</span>
          </button>

          <nav className="nav-links" aria-label="Primary navigation">
            {navItems.map((item) => (
              <button type="button" key={item.id} className="nav-button" onClick={() => scrollToSection(item.id)}>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="nav-actions">
            {currentUser ? (
              <>
                <div className="landing-profile-anchor">
                  <button
                    type="button"
                    className={isProfileMenuOpen ? 'landing-profile-chip active' : 'landing-profile-chip'}
                    aria-label={`Open profile menu for ${currentUser.name}`}
                    aria-expanded={isProfileMenuOpen}
                    onClick={() => setIsProfileMenuOpen((current) => !current)}
                  >
                    <span className="avatar">{initial}</span>
                    <span className="landing-profile-copy">
                      <strong>{firstName}</strong>
                      <small>{profileRoleLabel}{currentUser.email ? ` - ${currentUser.email}` : ''}</small>
                    </span>
                    <Icon name="chevronDown" className="chevron-icon" size={18} />
                  </button>

                  {isProfileMenuOpen ? (
                    <section className="landing-profile-menu" aria-label="Account menu">
                      <div className="profile-popover-card landing-account-head">
                        <span className="avatar large-avatar">{initial}</span>
                        <div>
                          <strong>{firstName}</strong>
                          <p>{currentUser.email}</p>
                        </div>
                      </div>
                      <button type="button" className="company-menu-row" onClick={onGetStarted}>
                        <span>Go to workspace</span>
                        <Icon name="arrowRight" size={16} />
                      </button>
                      <button type="button" className="company-menu-row logout-action" onClick={onLogout}>
                        <span>Log out</span>
                        <Icon name="logout" size={16} />
                      </button>
                    </section>
                  ) : null}
                </div>
                <button type="button" className="solid-button small" onClick={onGetStarted}>
                  <span>Go to workspace</span>
                  <Icon name="arrowRight" />
                </button>
              </>
            ) : (
              <>
                <button type="button" className="ghost-button" onClick={onGoToLogin}>
                  Login
                </button>
                <button type="button" className="ghost-button" onClick={onGoToSignup}>
                  Sign Up
                </button>
                <button type="button" className="solid-button small" onClick={() => setIsDialogOpen(true)}>
                  <span>Get Started</span>
                  <Icon name="arrowRight" />
                </button>
              </>
            )}
          </div>
        </header>
      </div>

      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="landing-live-background" aria-hidden="true">
          <span className="live-orb live-orb-one" />
          <span className="live-orb live-orb-two" />
          <span className="live-beam live-beam-one" />
          <span className="live-beam live-beam-two" />
          <span className="live-node live-node-one" />
          <span className="live-node live-node-two" />
          <span className="live-node live-node-three" />
        </div>
        <div className="hero-copy">
          <p className="eyebrow">Automated Asynchronous AI Interviewer</p>
          <h1 id="hero-title">Spoken interviews, scored fairly and reviewed by people.</h1>
          <p>
            Candidates answer by voice, whenever suits them. AAAI transcribes every answer, scores it on four
            clear traits with a written rationale, and gives recruiters a ranked shortlist - with the recordings
            one click away.
          </p>

          <div className="hero-actions">
            {currentUser ? (
              <button type="button" className="solid-button" onClick={onGetStarted}>
                Go to workspace
              </button>
            ) : (
              <button type="button" className="solid-button" onClick={() => setIsDialogOpen(true)}>
                Get started
              </button>
            )}
            <button type="button" className="soft-button" onClick={() => scrollToSection('how-it-works')}>
              See how it works
            </button>
          </div>

          <dl className="hero-metrics" aria-label="How an interview works">
            <div>
              <dt>Voice</dt>
              <dd>no video</dd>
            </div>
            <div>
              <dt>2:00</dt>
              <dd>per question</dd>
            </div>
            <div>
              <dt>4 traits</dt>
              <dd>scored 1-5</dd>
            </div>
          </dl>
        </div>

        <div className="product-preview" aria-label="Example recruiter view">
          <div className="preview-topbar">
            <span className="preview-dot active" />
            <span className="preview-dot" />
            <span className="preview-dot" />
            <span className="preview-status">Example scorecard</span>
          </div>
          <div className="preview-grid">
            <section className="preview-panel preview-main">
              <div className="preview-panel-header">
                <span>Aggregate score</span>
                <strong>17 / 20</strong>
              </div>
              <div className="signal-bars" aria-hidden="true">
                <span style={{ height: '80%' }} title="Technical skill 4/5" />
                <span style={{ height: '100%' }} title="Communication 5/5" />
                <span style={{ height: '80%' }} title="Problem solving 4/5" />
                <span style={{ height: '80%' }} title="Job fit 4/5" />
              </div>
              <p className="preview-legend">Technical · Communication · Problem solving · Job fit</p>
            </section>
            <section className="preview-panel">
              <div className="preview-panel-header">
                <span>Transcript</span>
                <strong>Ready</strong>
              </div>
              <p>Every answer transcribed, with the recording available to play back.</p>
            </section>
            <section className="preview-panel">
              <div className="preview-panel-header">
                <span>Review flag</span>
                <strong>Clear</strong>
              </div>
              <p>Low communication, frequent tab switches or a grading failure are flagged with the reason.</p>
            </section>
          </div>
        </div>
      </section>

      <section className="section-band" id="how-it-works" aria-labelledby="workflow-title">
        <div className="section-heading">
          <p className="eyebrow">How it works</p>
          <h2 id="workflow-title">From invitation to shortlist in four steps.</h2>
          <p>No scheduling, no live interviewer, and every candidate gets the same structured process.</p>
        </div>

        <div className="workflow-grid four">
          {workflowSteps.map((step) => (
            <article className="workflow-card" key={step.count}>
              <span>{step.count}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="split-section" id="for-candidates" aria-labelledby="candidates-title">
        <div>
          <p className="eyebrow">For candidates</p>
          <h2 id="candidates-title">A calm interview you can take on your own time.</h2>
          <p>
            Open the invitation email, sign in with one click, and answer each question out loud. Every interview
            draws its own questions, so there is nothing to memorise - just speak naturally.
          </p>
        </div>

        <div className="use-case-list">
          {candidatePoints.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="split-section" id="for-recruiters" aria-labelledby="recruiters-title">
        <div>
          <p className="eyebrow">For recruiters</p>
          <h2 id="recruiters-title">Structured evidence for every candidate.</h2>
          <p>
            Pick a hiring project, invite candidates, and review a ranked leaderboard. Each project has its own
            question bank and rubric - {hiringProjects.length} are ready to use:
          </p>
          <div className="use-case-list compact">
            {hiringProjects.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div className="use-case-list">
          {recruiterPoints.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="pricing-section" id="fairness" aria-labelledby="fairness-title">
        <div className="pricing-copy">
          <p className="eyebrow">Fairness &amp; privacy</p>
          <h2 id="fairness-title">AI assists. People decide.</h2>
          <p>
            Every candidate is scored on the same four traits against a written rubric. Answers that sound
            templated or scripted are flagged and their communication score is capped. Recordings are shared only with the hiring team, every AI request and
            response is kept in an append-only audit log, and AI spending has a hard monthly cap.
          </p>
        </div>

        <div className="pricing-card">
          <span>Ready when you are</span>
          <strong>Invite-only access</strong>
          <p>Recruiters sign in with their work email. Candidates join through the link in their invitation.</p>
          {currentUser ? (
            <button type="button" className="solid-button" onClick={onGetStarted}>
              Go to workspace
            </button>
          ) : (
            <button type="button" className="solid-button" onClick={() => setIsDialogOpen(true)}>
              Choose your path
            </button>
          )}
        </div>
      </section>

      <footer className="site-footer">
        <div>
          <img src="/logo.svg" alt="" className="footer-logo" />
          <span>AAAI</span>
        </div>
        <p>Automated Asynchronous AI Interviewer - a university capstone project.</p>
      </footer>

      {isDialogOpen ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setIsDialogOpen(false)}>
          <section
            className="role-dialog role-dialog-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="dialog-header dialog-header-center">
              <p className="eyebrow">Choose workspace</p>
              <h2 id="role-dialog-title">Where should AAAI take you?</h2>
              <button type="button" className="icon-only-button" onClick={() => setIsDialogOpen(false)} aria-label="Close dialog">
                <Icon name="close" />
              </button>
            </div>

            <div className="role-choice-list">
              {roleOptions.map((option) => (
                <article className="role-choice-row" key={option.id}>
                  <span className="role-choice-icon" aria-hidden="true">
                    <Icon name={option.icon} size={22} />
                  </span>
                  <div className="role-choice-copy">
                    <h3>{option.title}</h3>
                    <p>{option.description}</p>
                  </div>
                  <button
                    type="button"
                    className="role-signin-button"
                    onClick={() => handleContinue(option.id)}
                  >
                    <span>{option.action}</span>
                    <Icon name="arrowRight" />
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
