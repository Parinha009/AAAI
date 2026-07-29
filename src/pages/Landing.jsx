import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon'

const navItems = [
  { id: 'workflow', label: 'How it works?' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'resources', label: 'Resources' },
  { id: 'use-cases', label: 'Use Cases' },
  { id: 'contact-us', label: 'Contact Us' },
]

const navPanels = {
  workflow: {
    eyebrow: 'How it works',
    title: 'How it works',
    copy: 'Choose your path, confirm your account, and continue into the right workspace.',
    items: ['Pick a role', 'Verify your email', 'Continue to your dashboard'],
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Pricing',
    copy: 'Start free and scale when your hiring workflow needs more capacity.',
    items: ['Free to start', 'Scale when needed', 'No hidden setup fees'],
  },
  resources: {
    eyebrow: 'Resources',
    title: 'Resources',
    copy: 'Guides, setup help, and support material live here.',
    items: ['Compare Flowmingo', 'Blog', 'FAQ - Help Centre', 'Careers'],
  },
  'use-cases': {
    eyebrow: 'Use cases',
    title: 'Use Cases',
    copy: 'Recruiters, hiring teams, and candidates can all use the same polished screening flow.',
    items: ['For Candidates', 'View Sample Result', 'Take Demo Interview'],
  },
  'contact-us': {
    eyebrow: 'Contact us',
    title: 'Contact Us',
    copy: 'Need help? Reach out and we can extend the flow for your team.',
    items: ['Email support', 'Book a demo', 'Request onboarding help'],
  },
}

const workflowSteps = [
  {
    count: '01',
    title: 'Invite',
    copy: 'Send a polished interview link with structured expectations and a calm candidate entry point.',
  },
  {
    count: '02',
    title: 'Screen',
    copy: 'Collect CV context, async answers, tab events, and completion status without clutter.',
  },
  {
    count: '03',
    title: 'Shortlist',
    copy: 'Review ranked signals, follow-up prompts, and recruiter-ready summaries in one place.',
  },
]

const useCases = [
  'Graduate hiring',
  'High-volume screening',
  'Remote candidate reviews',
  'Structured interview prep',
]

const roleOptions = [
  {
    id: 'company',
    title: 'Company / Recruiter',
    description: 'Review candidates, scoring, budgets, and interview signals.',
    action: 'Company sign in',
    icon: 'company',
  },
  {
    id: 'candidate',
    title: 'Candidate / Job Seeker',
    description: 'Complete your profile, practice answers, and track your interview status.',
    action: 'Candidate sign in',
    icon: 'candidate',
  },
]

export default function Landing({
  currentUser,
  onGoToLogin,
  onGoToSignup,
  onChooseCompany,
  onChooseCandidate,
  onGetStarted,
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState('candidate')
  const [activePanel, setActivePanel] = useState('')
  const headerRef = useRef(null)
  const firstName = currentUser?.name?.split(' ')[0] || 'Account'
  const initial = firstName.charAt(0).toUpperCase()

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsDialogOpen(false)
        setActivePanel('')
      }
    }

    const handlePointerDown = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setActivePanel('')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  const handleContinue = (role = selectedRole) => {
    setIsDialogOpen(false)

    if (role === 'company') {
      onChooseCompany()
      return
    }

    onChooseCandidate()
  }

  const panel = activePanel ? navPanels[activePanel] : null

  return (
    <main className="landing-page">
      <div className="landing-header-shell" ref={headerRef}>
        <header className="landing-nav">
          <button
            type="button"
            className="brand-button"
            onClick={() => {
              setActivePanel('')
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            <img src="/logo.svg" alt="AAAI logo" className="brand-logo-small" />
            <span>AAAI</span>
          </button>

          <nav className="nav-links" aria-label="Primary navigation">
            {navItems.map((item) => (
              <button
                type="button"
                key={item.id}
                className={activePanel === item.id ? 'nav-button active' : 'nav-button'}
                aria-pressed={activePanel === item.id}
                onMouseEnter={() => setActivePanel(item.id)}
                onClick={() => setActivePanel((current) => (current === item.id ? '' : item.id))}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="nav-actions">
            {currentUser ? (
              <>
                <div className="landing-profile-chip" aria-label={`Signed in as ${currentUser.name}`}>
                  <span className="avatar">{initial}</span>
                  <div>
                    <strong>{firstName}</strong>
                    <small>{currentUser.email}</small>
                  </div>
                </div>
                <button type="button" className="solid-button small" onClick={onGetStarted}>
                  <span>Get Started</span>
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

        {panel ? (
          <section className="landing-mega-panel" aria-live="polite">
            <p className="eyebrow">{panel.eyebrow}</p>
            <h2>{panel.title}</h2>
            <p>{panel.copy}</p>
            <div className="mega-card-grid">
              {panel.items.map((item) => (
                <article className="mega-card" key={item}>
                  {item}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">AI interview and CV screener</p>
          <h1 id="hero-title">AI Interview &amp; CV Screener</h1>
          <p>
            AAAI turns async interviews into clear hiring signal with structured prompts, fairer review,
            and a candidate experience that feels considered from the first click.
          </p>

          <div className="hero-actions">
            <button type="button" className="solid-button" onClick={currentUser ? onGetStarted : () => setIsDialogOpen(true)}>
              {currentUser ? 'Go to workspace' : 'Start free'}
            </button>
            {currentUser ? null : (
              <button type="button" className="soft-button" onClick={onGoToSignup}>
                Create account
              </button>
            )}
          </div>

          <dl className="hero-metrics" aria-label="Product highlights">
            <div>
              <dt>Free</dt>
              <dd>to launch</dd>
            </div>
            <div>
              <dt>24/7</dt>
              <dd>async review</dd>
            </div>
            <div>
              <dt>Zero</dt>
              <dd>setup fees</dd>
            </div>
          </dl>
        </div>

        <div className="product-preview" aria-label="AAAI screening dashboard preview">
          <div className="preview-topbar">
            <span className="preview-dot active" />
            <span className="preview-dot" />
            <span className="preview-dot" />
            <span className="preview-status">Live shortlist</span>
          </div>
          <div className="preview-grid">
            <section className="preview-panel preview-main">
              <div className="preview-panel-header">
                <span>Candidate signal</span>
                <strong>92</strong>
              </div>
              <div className="signal-bars" aria-hidden="true">
                <span style={{ height: '72%' }} />
                <span style={{ height: '48%' }} />
                <span style={{ height: '84%' }} />
                <span style={{ height: '58%' }} />
                <span style={{ height: '91%' }} />
              </div>
            </section>
            <section className="preview-panel">
              <div className="preview-panel-header">
                <span>Interview</span>
                <strong>Ready</strong>
              </div>
              <p>Follow-up prompt generated after a calm, structured review.</p>
            </section>
            <section className="preview-panel">
              <div className="preview-panel-header">
                <span>CV match</span>
                <strong>High</strong>
              </div>
              <p>Role fit, communication, and required skills summarized.</p>
            </section>
          </div>
        </div>
      </section>

      <section className="section-band" id="workflow" aria-labelledby="workflow-title">
        <div className="section-heading">
          <p className="eyebrow">Workflow</p>
          <h2 id="workflow-title">A quieter screening system with sharper outcomes.</h2>
          <p>Each step removes operational noise so teams can spend more time on actual hiring judgment.</p>
        </div>

        <div className="workflow-grid">
          {workflowSteps.map((step) => (
            <article className="workflow-card" key={step.count}>
              <span>{step.count}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="split-section" id="use-cases" aria-labelledby="use-cases-title">
        <div>
          <p className="eyebrow">Use cases</p>
          <h2 id="use-cases-title">Designed for modern hiring rhythms.</h2>
          <p>
            Use AAAI when you need consistent screening, respectful async interviews, and decision-ready
            summaries without an overloaded recruiting stack.
          </p>
        </div>

        <div className="use-case-list">
          {useCases.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="pricing-section" id="pricing" aria-labelledby="pricing-title">
        <div className="pricing-copy">
          <p className="eyebrow">Pricing</p>
          <h2 id="pricing-title">Start free. Scale only when the workflow earns it.</h2>
          <p>No hidden setup fees, no bloated tiers, and no pressure to commit before your team has signal.</p>
        </div>

        <div className="pricing-card">
          <span>Starter</span>
          <strong>Free forever</strong>
          <p>Launch async screening, invite candidates, and review core interview signals.</p>
          <button type="button" className="solid-button" onClick={() => setIsDialogOpen(true)}>
            Choose your path
          </button>
        </div>
      </section>

      <footer className="site-footer">
        <div>
          <img src="/logo.svg" alt="" className="footer-logo" />
          <span>AAAI</span>
        </div>
        <p>Premium async screening for teams that care about speed, structure, and candidate experience.</p>
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
              <h2 id="role-dialog-title">What best describes you?</h2>
              <button type="button" className="icon-only-button" onClick={() => setIsDialogOpen(false)} aria-label="Close dialog">
                <Icon name="close" />
              </button>
            </div>

            <div className="role-card-grid">
              {roleOptions.map((option) => (
                <article
                  className={selectedRole === option.id ? 'role-choice-card selected' : 'role-choice-card'}
                  key={option.id}
                >
                  <button
                    type="button"
                    className="role-choice-main"
                    onClick={() => setSelectedRole(option.id)}
                    aria-pressed={selectedRole === option.id}
                  >
                    <span className="role-mark large" aria-hidden="true">
                      <Icon name={option.icon} />
                    </span>
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </button>
                  <button
                    type="button"
                    className="solid-button full-width"
                    onClick={() => handleContinue(option.id)}
                  >
                    <span>{option.action}</span>
                    <Icon name="arrowRight" />
                  </button>
                </article>
              ))}
            </div>

            <div className="modal-footer-line">
              <p>Choose one path to continue.</p>
              <button type="button" className="soft-button" onClick={() => handleContinue()}>
                Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
