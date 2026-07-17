import { useEffect, useRef, useState } from 'react'

const sections = [
  { label: 'How it works?', target: 'how-it-works' },
  { label: 'Pricing', target: 'pricing' },
]

const navSections = {
  'how-it-works': {
    label: 'How it works',
    title: 'How it works',
    description: 'Choose your role, sign in, and continue to the matching experience.',
    items: ['Pick a role', 'Sign in or sign up', 'Continue to your dashboard'],
  },
  pricing: {
    label: 'Pricing',
    title: 'Pricing',
    description: 'Start free and scale when you are ready.',
    items: ['Free to start', 'Scale when needed', 'No hidden setup fees'],
  },
  resources: {
    label: 'Resources',
    title: 'Resources',
    description: 'Guides, setup help, and support material live here.',
    items: [
      'Compare Flowmingo',
      'Blog',
      'FAQ - Help Centre',
      'Careers',
    ],
  },
  'use-cases': {
    label: 'Use Cases',
    title: 'Use Cases',
    description: 'Recruiters, hiring teams, and candidates can all use the same flow.',
    items: [
      'For Candidates',
      'View Sample Result',
      'Take Demo Interview',
    ],
  },
  'contact-us': {
    label: 'Contact Us',
    title: 'Contact Us',
    description: 'Need help? Reach out and we can extend the flow for your team.',
    items: ['Email support', 'Book a demo', 'Request onboarding help'],
  },
}

const options = [
  {
    id: 'company',
    title: 'Company / Recruiter',
    buttonLabel: 'Company Sign In',
    icon: '🏢',
  },
  {
    id: 'candidate',
    title: 'Candidate / Job Seeker',
    buttonLabel: 'Candidate Sign In',
    icon: '👤',
  },
]

export default function Landing({ onGoToLogin, onGoToSignup, onChooseCompany, onChooseCandidate }) {
  const [isModalOpen, setIsModalOpen] = useState(true)
  const [selectedRole, setSelectedRole] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [activeSection, setActiveSection] = useState('')
  const [lockedSection, setLockedSection] = useState('')
  const landingHeaderRef = useRef(null)

  const handleSelect = (role) => {
    setSelectedRole(role)
    setStatusMessage(role === 'company' ? 'Company / Recruiter selected.' : 'Candidate / Job Seeker selected.')
  }

  const handleContinue = () => {
    if (selectedRole === 'company') {
      onChooseCompany()
      return
    }

    if (selectedRole === 'candidate') {
      onChooseCandidate()
      return
    }

    setIsModalOpen(false)
    setStatusMessage('Modal closed.')
  }

  const handleShowSection = (sectionKey) => {
    if (!lockedSection) {
      setActiveSection(sectionKey)
    }
  }

  const handleLockSection = (sectionKey) => {
    setActiveSection(sectionKey)
    setLockedSection(sectionKey)
  }

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!landingHeaderRef.current) {
        return
      }

      if (!landingHeaderRef.current.contains(event.target)) {
        setActiveSection('')
        setLockedSection('')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  return (
    <main className="landing-page">
      <div
        className="landing-header-area"
        ref={landingHeaderRef}
        onMouseLeave={() => {
          if (!lockedSection) {
            setActiveSection('')
          }
        }}
      >
        <header className="landing-nav">
          <button
            type="button"
            className="landing-brand-button"
            onClick={() => {
              setActiveSection('')
              setLockedSection('')
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            <span className="landing-brand">
              <img src="/logo.svg" alt="AAAI Main logo" className="landing-logo" />
              <span>TalentPulse</span>
            </span>
          </button>
          <nav className="landing-actions" aria-label="Primary navigation">
            <div className="landing-center-links">
              {sections.map((section) => (
                <button
                  key={section.target}
                  type="button"
                  className={activeSection === section.target ? 'nav-text-button nav-dropdown-button active' : 'nav-text-button nav-dropdown-button'}
                  aria-pressed={activeSection === section.target}
                  onMouseEnter={() => handleShowSection(section.target)}
                  onClick={() => handleLockSection(section.target)}
                >
                  {section.label}
                </button>
              ))}
              <button
                type="button"
                className={activeSection === 'resources' ? 'nav-text-button nav-dropdown-button active' : 'nav-text-button nav-dropdown-button'}
                aria-pressed={activeSection === 'resources'}
                onMouseEnter={() => handleShowSection('resources')}
                onClick={() => handleLockSection('resources')}
              >
                Resources
              </button>
              <button
                type="button"
                className={activeSection === 'use-cases' ? 'nav-text-button nav-dropdown-button active' : 'nav-text-button nav-dropdown-button'}
                aria-pressed={activeSection === 'use-cases'}
                onMouseEnter={() => handleShowSection('use-cases')}
                onClick={() => handleLockSection('use-cases')}
              >
                Use Cases
              </button>
              <button
                type="button"
                className={activeSection === 'contact-us' ? 'nav-text-button nav-dropdown-button active' : 'nav-text-button nav-dropdown-button'}
                aria-pressed={activeSection === 'contact-us'}
                onMouseEnter={() => handleShowSection('contact-us')}
                onClick={() => handleLockSection('contact-us')}
              >
                Contact Us
              </button>
            </div>
            <div className="landing-auth-actions">
              <button type="button" className="nav-text-button" onClick={onGoToLogin}>
                Login
              </button>
              <button type="button" className="nav-text-button" onClick={onGoToSignup}>
                Sign Up
              </button>
              <button type="button" className="nav-start-button" onClick={() => setIsModalOpen(true)}>
                Get Started →
              </button>
            </div>
          </nav>
        </header>

        {activeSection ? (
          <section className="landing-section landing-dynamic-section" aria-live="polite">
            <p className="landing-section-kicker">{navSections[activeSection].label}</p>
            <h3>{navSections[activeSection].title}</h3>
            <p>{navSections[activeSection].description}</p>
            <div className="landing-section-grid">
              {navSections[activeSection].items.map((item) => (
                <article key={item} className="landing-section-card">
                  {item}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <section className="landing-hero">
        <p className="landing-pill">Now powered by AI</p>
        <h1>AI Interview &amp; CV Screener</h1>
        <p className="landing-copy">
          Fast, clean screening that helps recruiters discover hidden talent sooner and keeps job seekers moving.
        </p>
        <h2>FREE. FOREVER.</h2>
        <button type="button" className="primary-cta" onClick={() => setIsModalOpen(true)}>
          Get Started Free →
        </button>
      </section>

      {isModalOpen ? <div className="landing-overlay" aria-hidden="true" /> : null}

      {isModalOpen ? (
        <section className="landing-modal" aria-label="Choose account type">
          <button type="button" className="modal-close" onClick={handleContinue} aria-label="Close dialog">
            ×
          </button>
          <h3>What best describes you?</h3>
          <div className="option-grid">
            {options.map((option) => (
              <article className="option-card" key={option.id} aria-selected={selectedRole === option.id}>
                <div className="option-icon" aria-hidden="true">
                  {option.icon}
                </div>
                <h4>{option.title}</h4>
                <button
                  type="button"
                  className="option-button"
                  onClick={() => {
                    handleSelect(option.id)
                    if (option.id === 'company') {
                      onChooseCompany()
                    } else {
                      onChooseCandidate()
                    }
                  }}
                >
                  {option.buttonLabel} →
                </button>
              </article>
            ))}
          </div>
          <div className="modal-footer">
            <p className="modal-message">{statusMessage || 'Choose one path to continue.'}</p>
            <button type="button" className="secondary-cta" onClick={handleContinue}>
              Continue
            </button>
          </div>
        </section>
      ) : null}
    </main>
  )
}
