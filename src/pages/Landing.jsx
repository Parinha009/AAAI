import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon'

const navItems = [
  { id: 'workflow', label: 'How it works' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'resources', label: 'Resources' },
  { id: 'use-cases', label: 'Use cases' },
  { id: 'contact-us', label: 'Contact' },
]

const navPanels = {
  workflow: {
    eyebrow: 'How it works',
    title: 'From application to shortlist',
    copy: 'Move from candidate invite to shortlist with a simple, repeatable screening flow.',
    items: [
      {
        title: 'Invite candidates',
        copy: 'Share a secure interview link with clear instructions.',
        icon: 'send',
      },
      {
        title: 'Screen consistently',
        copy: 'Collect CV details and structured responses in one format.',
        icon: 'scanSearch',
      },
      {
        title: 'Review and shortlist',
        copy: 'Compare signals and decide who should move forward.',
        icon: 'listChecks',
      },
    ],
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Pricing',
    copy: 'Start with the core screening workflow, then scale when your team needs more volume.',
    items: [
      { title: 'Free starter workspace' },
      { title: 'Transparent upgrade path' },
      { title: 'No hidden setup fees' },
    ],
  },
  resources: {
    eyebrow: 'Resources',
    title: 'Resources',
    copy: 'Practical guidance for setting up interviews, evaluating responses, and supporting candidates.',
    items: [
      { title: 'Screening guides' },
      { title: 'Interview templates' },
      { title: 'Help center' },
      { title: 'Product updates' },
    ],
  },
  'use-cases': {
    eyebrow: 'Use cases',
    title: 'Use cases',
    copy: 'Support consistent screening across high-volume, early-career, and remote hiring workflows.',
    items: [
      { title: 'Graduate hiring' },
      { title: 'Remote screening' },
      { title: 'Technical interviews' },
      { title: 'Candidate practice' },
    ],
  },
  'contact-us': {
    eyebrow: 'Contact us',
    title: 'Contact',
    copy: 'Talk with AAAI about your hiring workflow, candidate experience, or recruiter setup.',
    items: [
      { title: 'Email support' },
      { title: 'Book a demo' },
      { title: 'Request onboarding help' },
    ],
  },
}

const workflowSteps = [
  {
    count: '01',
    title: 'Invite candidates',
    copy: 'Send candidates a secure interview link with clear instructions and a simple starting experience.',
    icon: 'send',
  },
  {
    count: '02',
    title: 'Screen consistently',
    copy: 'Collect CV details and structured interview responses in one standardized workflow.',
    icon: 'scanSearch',
  },
  {
    count: '03',
    title: 'Review and shortlist',
    copy: 'Compare candidate signals, review responses, and decide who should move forward.',
    icon: 'listChecks',
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
    description: 'Manage projects, candidates, scorecards, and interview signals.',
    action: 'Open recruiter workspace',
    icon: 'company',
  },
  {
    id: 'candidate',
    title: 'Candidate',
    description: 'Open your profile, practice space, and interview workflow.',
    action: 'Open candidate workspace',
    icon: 'candidate',
  },
]

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
  const [activePanel, setActivePanel] = useState('')
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const headerRef = useRef(null)
  const firstName = currentUser?.name?.split(' ')[0] || 'Account'
  const initial = firstName.charAt(0).toUpperCase()
  const profileRoleLabel = currentRole === 'company' ? 'Company' : 'Candidate'

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsDialogOpen(false)
        setActivePanel('')
        setIsProfileMenuOpen(false)
      }
    }

    const handlePointerDown = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setActivePanel('')
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
                <div className="landing-profile-anchor">
                  <button
                    type="button"
                    className={isProfileMenuOpen ? 'landing-profile-chip active' : 'landing-profile-chip'}
                    aria-label={`Open profile menu for ${currentUser.name}`}
                    aria-expanded={isProfileMenuOpen}
                    onClick={() => {
                      setIsProfileMenuOpen((current) => !current)
                      setActivePanel('')
                    }}
                  >
                    <span className="avatar">{initial}</span>
                    <span className="landing-profile-copy">
                      <strong>{firstName}</strong>
                      <small>{profileRoleLabel} - {currentUser.email}</small>
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
                <button type="button" className="solid-button small" onClick={() => setIsDialogOpen(true)}>
                  <span>Start screening</span>
                  <Icon name="arrowRight" />
                </button>
              </>
            ) : (
              <>
                <button type="button" className="ghost-button" onClick={onGoToLogin}>
                  Log in
                </button>
                <button type="button" className="ghost-button" onClick={onGoToSignup}>
                  Sign up
                </button>
                <button type="button" className="solid-button small" onClick={() => setIsDialogOpen(true)}>
                  <span>Start screening</span>
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
                <article className={item.copy ? 'mega-card has-copy' : 'mega-card'} key={item.title}>
                  {item.icon ? (
                    <span className="mega-card-icon" aria-hidden="true">
                      <Icon name={item.icon} size={20} />
                    </span>
                  ) : null}
                  <strong>{item.title}</strong>
                  {item.copy ? <small>{item.copy}</small> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
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
          <p className="eyebrow">AI-powered hiring platform</p>
          <h1 id="hero-title">Screen smarter. Interview consistently. Hire with confidence.</h1>
          <p>
            AAAI brings CV screening and structured asynchronous interviews into one streamlined hiring workflow.
          </p>

          <div className="hero-actions">
            <button type="button" className="solid-button" onClick={() => setIsDialogOpen(true)}>
              {currentUser ? 'Go to workspace' : 'Start screening'}
            </button>
            {currentUser ? null : (
              <button type="button" className="soft-button" onClick={onGoToSignup}>
                See how it works
              </button>
            )}
          </div>
          <p className="hero-trust">No credit card required - set up in minutes.</p>

          <dl className="hero-metrics" aria-label="Product highlights">
            <div>
              <dt>Free</dt>
              <dd>starter workspace</dd>
            </div>
            <div>
              <dt>24/7</dt>
              <dd>candidate access</dd>
            </div>
            <div>
              <dt>Zero</dt>
              <dd>hidden fees</dd>
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
                <span>Candidate signals</span>
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
              <p>Follow-up prompts are prepared from the candidate's earlier answers.</p>
            </section>
            <section className="preview-panel">
              <div className="preview-panel-header">
                <span>CV match</span>
                <strong>High</strong>
              </div>
              <p>Role fit, communication, and required skills are summarized for review.</p>
            </section>
          </div>
        </div>
      </section>

      <section className="section-band" id="workflow" aria-labelledby="workflow-title">
        <div className="section-heading">
          <p className="eyebrow">How it works</p>
          <h2 id="workflow-title">From application to shortlist, without the busywork.</h2>
          <p>AAAI keeps candidate screening structured, consistent, and easy to review.</p>
        </div>

        <aside className="workflow-visual" aria-label="Screening workflow summary">
          <div className="workflow-visual-card">
            <span className="workflow-visual-icon" aria-hidden="true">
              <Icon name="spark" size={22} />
            </span>
            <div>
              <strong>Structured signal, less manual review</strong>
              <p>Every candidate follows the same flow, so recruiters can compare responses with more confidence.</p>
            </div>
          </div>
          <div className="workflow-visual-row">
            <span>CV</span>
            <span>Interview</span>
            <span>Scorecard</span>
          </div>
        </aside>

        <div className="workflow-grid">
          {workflowSteps.map((step) => (
            <article className="workflow-card" key={step.count}>
              <span className="workflow-icon"><Icon name={step.icon} size={22} /></span>
              <small>{step.count}</small>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="split-section" id="use-cases" aria-labelledby="use-cases-title">
        <div>
          <p className="eyebrow">Use cases</p>
          <h2 id="use-cases-title">Built for hiring teams that need clear signal quickly.</h2>
          <p>
            Use AAAI when you need consistent screening, respectful asynchronous interviews, and decision-ready
            summaries without adding another complicated hiring tool.
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
          <h2 id="pricing-title">Start screening before you commit to a larger plan.</h2>
          <p>No hidden setup fees, no bloated tiers, and no pressure before your team has useful signal.</p>
        </div>

        <div className="pricing-card">
          <span>Starter</span>
          <strong>Free forever</strong>
          <p>Launch asynchronous screening, invite candidates, and review core interview signals.</p>
          <button type="button" className="solid-button" onClick={() => setIsDialogOpen(true)}>
            Start screening
          </button>
        </div>
      </section>

      <footer className="site-footer">
        <div>
          <img src="/logo.svg" alt="" className="footer-logo" />
          <span>AAAI</span>
        </div>
        <p>AI-powered candidate screening for teams that care about speed, structure, and candidate experience.</p>
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
              <h2 id="role-dialog-title">What would you like to do?</h2>
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
