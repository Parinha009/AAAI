import { useState } from 'react'

const sections = [
  { label: 'How it works?', target: 'how-it-works' },
  { label: 'Pricing', target: 'pricing' },
  { label: 'Resources', target: 'resources' },
  { label: 'Use Cases', target: 'use-cases' },
  { label: 'Contact Us', target: 'contact-us' },
]

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

  const handleScroll = (target) => {
    const element = document.getElementById(target)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <div className="landing-brand">
          <img src="/logo.svg" alt="AAAI Main logo" className="landing-logo" />
          <span>TalentPulse</span>
        </div>
        <div className="landing-actions">
          {sections.map((section) => (
            <button key={section.target} type="button" className="nav-text-button" onClick={() => handleScroll(section.target)}>
              {section.label}
            </button>
          ))}
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
      </header>

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

      <section id="how-it-works" className="landing-section">
        <h3>How it works</h3>
        <p>Choose your role, sign in, and continue to the matching experience.</p>
      </section>

      <section id="pricing" className="landing-section">
        <h3>Pricing</h3>
        <p>Start free and scale when you are ready.</p>
      </section>

      <section id="resources" className="landing-section">
        <h3>Resources</h3>
        <p>Guides, setup help, and support material live here.</p>
      </section>

      <section id="use-cases" className="landing-section">
        <h3>Use Cases</h3>
        <p>Recruiters, hiring teams, and candidates can all use the same flow.</p>
      </section>

      <section id="contact-us" className="landing-section">
        <h3>Contact Us</h3>
        <p>Need help? Reach out and we can extend the flow for your team.</p>
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
