import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon'

// Every statement on this page describes what AAAI actually does today.
const navItems = [
  { id: 'capabilities', label: 'How it works' },
  { id: 'benefits', label: 'Why AAAI' },
  { id: 'fairness', label: 'Fairness & privacy' },
  { id: 'faqs', label: 'FAQs' },
]

// "Core capabilities": the four real steps, each with a small mock-up of that screen.
const capabilities = [
  { count: '01', title: 'Invite', copy: 'A recruiter emails a one-time sign-in link for a hiring project.' },
  { count: '02', title: 'Interview', copy: 'Candidates answer out loud - 2 minutes per question, drawn at random.' },
  { count: '03', title: 'Score', copy: 'Whisper transcribes; GPT-4o-mini scores four traits with a rationale.' },
  { count: '04', title: 'Review', copy: 'Recruiters rank, read, listen and decide - AI assists, people choose.' },
]

// "How AAAI helps": six benefits, each backed by a real feature.
const benefits = [
  { icon: 'clock', title: 'Save scheduling time', copy: 'No calendars or live interviewers - candidates answer whenever suits them.' },
  { icon: 'clipboard', title: 'Consistent for everyone', copy: 'Every candidate is scored on the same four traits against a written rubric.' },
  { icon: 'mic', title: 'Voice only, no video', copy: 'Judged on what candidates say, not how they look on camera.' },
  { icon: 'play', title: 'Evidence you can check', copy: 'Each score comes with the transcript, the reasoning and the recording.' },
  { icon: 'flag', title: 'Flags what needs a look', copy: 'Low communication, frequent tab switches or a grading failure are flagged with the reason.' },
  { icon: 'shield', title: 'Accountable AI', copy: 'Every AI request is kept in an append-only audit log, with a hard monthly spending cap.' },
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

// Answers describe the real product. On purpose they never say how many questions an
// interview has - candidates are not told that in advance.
const faqs = [
  {
    q: 'What is AAAI?',
    a: 'AAAI (Automated Asynchronous AI Interviewer) runs first-round interviews by voice. Candidates answer spoken questions on their own time; AAAI transcribes and scores each interview, and recruiters review a ranked, explained shortlist.',
  },
  {
    q: 'How does an interview work for candidates?',
    a: 'The recruiter sends an invitation email. The candidate opens the link, agrees to recording, checks their microphone, and answers a short set of questions out loud. Each question has its own 2-minute timer and they press Next when they are done.',
  },
  {
    q: 'Do candidates need a camera, an app or a password?',
    a: 'No. Interviews are voice only and run in the browser - just a microphone. Sign-in uses a one-time link from the invitation email, so there is no password to create or forget.',
  },
  {
    q: 'How are answers scored?',
    a: 'Whisper transcribes each answer. GPT-4o-mini then scores four traits - technical skill, communication, problem solving and job fit - from 1 to 5 against the job\'s written rubric, with a reason for each score. Answers that sound templated or scripted have their communication score capped.',
  },
  {
    q: 'Does the AI make the hiring decision?',
    a: 'No. AI suggests scores; people decide. Recruiters can read every transcript, play every recording and see why a candidate was flagged - for example a low communication score, frequent tab switches or a grading failure.',
  },
  {
    q: 'What happens to recordings and data?',
    a: 'Recordings are shared only with the hiring team. Every AI request and response is stored in an append-only audit log that cannot be edited or deleted, and AI spending has a hard monthly cap.',
  },
  {
    q: 'Which roles can we interview for?',
    a: 'There are 12 ready-made hiring projects - from Junior Backend Engineer to Data Analyst and IT Support Specialist - each with its own question bank and rubric. Every interview draws its own random questions, so candidates do not all get the same ones.',
  },
]

const footerLinks = [
  { id: 'capabilities', label: 'How it works' },
  { id: 'benefits', label: 'Why AAAI' },
  { id: 'fairness', label: 'Fairness & privacy' },
  { id: 'faqs', label: 'FAQs' },
]

const team = [
  { name: 'Thaing Parinha', role: 'Project Lead' },
  { name: 'Soeng Senghorng', role: 'Frontend' },
  { name: 'Lim Hokan', role: 'Backend' },
  { name: 'Uy Sovannareach', role: 'AI / Infrastructure' },
]

// Decorative letter texture behind the footer wordmark.
const FOOTER_TEXTURE = Array.from({ length: 34 }, (_, row) => {
  const words = ['AAAI', 'INTERVIEW', 'VOICE', 'SCORE', 'REVIEW', 'FAIR', 'ASYNC']
  return Array.from({ length: 60 }, (_, col) => words[(row * 3 + col) % words.length]).join(' ') // wide enough for 4K
}).join('\n')

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
            <button type="button" className="soft-button" onClick={() => scrollToSection('capabilities')}>
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

      <section className="lx-capabilities" id="capabilities" aria-labelledby="capabilities-title">
        <header className="lx-cap-head">
          <h2 id="capabilities-title">Core Capabilities</h2>
          <p>
            AAAI runs the first-round interview for you - from the invitation email to a ranked, explained
            shortlist - so recruiters spend their time on the candidates worth meeting.
          </p>
        </header>

        <div className="lx-cap-grid">
          {capabilities.map((item, index) => (
            <article className="lx-cap" key={item.count}>
              <div className={`lx-visual v${index + 1}`} aria-hidden="true">
                {index === 0 ? (
                  <div className="lx-mock lx-mail">
                    <span className="lx-mono">[INVITATION]</span>
                    <strong>Junior Backend Engineer</strong>
                    <p>You&apos;re invited to an AI interview.</p>
                    <span className="lx-mail-button">Sign in <Icon name="arrowRight" size={12} /></span>
                    <small>One-time link - expires in 15 min</small>
                  </div>
                ) : null}
                {index === 1 ? (
                  <div className="lx-mock lx-task">
                    <small>Interview in progress</small>
                    <ol>
                      <li className="done"><Icon name="check" size={11} /> Consent recorded</li>
                      <li className="done"><Icon name="check" size={11} /> Microphone check</li>
                      <li className="active"><span className="lx-spin" /> Question 3 <em>1:24</em></li>
                      <li><span className="lx-dot" /> Submit interview</li>
                    </ol>
                    <div className="lx-live">
                      <Icon name="mic" size={14} />
                      <span>Recording<small>Answer saved on Next</small></span>
                      <b>LIVE</b>
                    </div>
                  </div>
                ) : null}
                {index === 2 ? (
                  <div className="lx-mock lx-analyze">
                    <div className="lx-chip"><Icon name="document" size={13} /> Transcribing...</div>
                    <div className="lx-card">
                      <small>Scoring answers...</small>
                      <span className="lx-line w90" />
                      <span className="lx-line w70" />
                      <span className="lx-line w80" />
                      <div className="lx-bar"><span className="lx-spin light" /></div>
                    </div>
                  </div>
                ) : null}
                {index === 3 ? (
                  <div className="lx-mock lx-terminal">
                    <span className="lx-mono">&#9632; [TRANSCRIPT]</span>
                    <p>&quot;I built a REST API with FastAPI and Postgres, then added caching...&quot;</p>
                    <span className="lx-mono">&#9632; [SCORECARD]</span>
                    <p>17 / 20 - communication 5/5 - no review flags</p>
                  </div>
                ) : null}
              </div>
              <span className="lx-count">{item.count}</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lx-benefits" id="benefits" aria-labelledby="benefits-title">
        <header className="lx-benefits-head">
          <h2 id="benefits-title">How AAAI Helps</h2>
          <p>
            Faster first-round screening that stays fair, explainable and human-led - across{' '}
            {hiringProjects.length} ready-made hiring projects.
          </p>
        </header>

        <div className="lx-benefit-grid">
          {benefits.map((item) => (
            <article className="lx-benefit" key={item.title}>
              <span className="lx-benefit-icon" aria-hidden="true">
                <Icon name={item.icon} size={20} />
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="lx-projects" aria-label="Ready-made hiring projects">
          {hiringProjects.map((item) => (
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

      <section className="lx-faq" id="faqs" aria-labelledby="faq-title">
        <header className="lx-faq-head">
          <h2 id="faq-title">FAQs</h2>
          <p>Answers to common questions about AAAI - how interviews work, how answers are scored, and how candidates are treated fairly.</p>
        </header>
        <div className="lx-faq-list">
          {faqs.map((item, index) => (
            <details className="lx-faq-item" key={item.q}>
              <summary>
                <span>{index + 1}. {item.q}</span>
                <span className="lx-faq-icon" aria-hidden="true" />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="lx-footer">
        <pre className="lx-footer-texture" aria-hidden="true">{FOOTER_TEXTURE}</pre>
        <div className="lx-footer-top">
          <div className="lx-footer-brand">
            <strong className="lx-wordmark">AAAI</strong>
            <p>The Automated Asynchronous AI Interviewer - spoken interviews, scored fairly and reviewed by people.</p>
          </div>
          <nav className="lx-footer-col" aria-label="Footer">
            <h3>Explore</h3>
            {footerLinks.map((link) => (
              <button type="button" key={link.id} onClick={() => scrollToSection(link.id)}>
                {link.label}
              </button>
            ))}
          </nav>
          <div className="lx-footer-col">
            <h3>Team</h3>
            {team.map((member) => (
              <span key={member.name}>
                {member.name}
                <small>{member.role}</small>
              </span>
            ))}
          </div>
        </div>
        <div className="lx-footer-bottom">
          <span>&copy; 2026 AAAI &middot; University capstone project</span>
          <span>Built with React, FastAPI, Whisper &amp; GPT-4o-mini</span>
        </div>
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
