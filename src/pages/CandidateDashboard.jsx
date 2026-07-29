import { useEffect, useState } from 'react'
import Icon from '../components/Icon'

const navItems = [
  { id: 'intro', label: 'Private Introduction', icon: 'card' },
  { id: 'jobs', label: 'Recommended Jobs', icon: 'briefcase' },
  { id: 'cv', label: 'CV Evaluation', icon: 'document' },
  { id: 'preferences', label: 'Job Preferences', icon: 'sliders' },
  { id: 'applied', label: 'Applied Jobs', icon: 'clipboard' },
  { id: 'assessments', label: 'Past Assessments', icon: 'award' },
]

const jobs = [
  {
    role: 'Frontend Developer',
    company: 'TechCorp Asia',
    icon: 'briefcase',
    match: '95%',
    location: 'Remote',
    salary: '$80k - $100k',
    type: 'Full-time',
    tags: ['React', 'TypeScript', 'Tailwind'],
  },
  {
    role: 'React Engineer',
    company: 'StartupXYZ',
    icon: 'rocket',
    match: '88%',
    location: 'Bangkok, TH',
    salary: '$60k - $85k',
    type: 'Full-time',
    tags: ['React', 'Node.js', 'PostgreSQL'],
  },
  {
    role: 'UI / UX Developer',
    company: 'DesignStudio',
    icon: 'palette',
    match: '82%',
    location: 'Hybrid',
    salary: '$70k - $90k',
    type: 'Contract',
    tags: ['Figma', 'CSS', 'JavaScript'],
  },
  {
    role: 'Full Stack Developer',
    company: 'GlobalTech',
    icon: 'globe',
    match: '78%',
    location: 'Remote',
    salary: '$90k - $120k',
    type: 'Full-time',
    tags: ['React', 'Python', 'AWS'],
  },
]

const appliedJobs = [
  { role: 'Product Designer', company: 'InnovateCo', applied: 'Jul 15, 2026', status: 'Under Review', tone: 'warning' },
  { role: 'UX Researcher', company: 'DataViz Inc', applied: 'Jul 10, 2026', status: 'Interview Scheduled', tone: 'info' },
]

const assessments = [
  { title: 'JavaScript Fundamentals', date: 'Jul 18, 2026', duration: '45 min', score: 92 },
  { title: 'React & State Management', date: 'Jul 12, 2026', duration: '60 min', score: 85 },
  { title: 'System Design Basics', date: 'Jul 8, 2026', duration: '90 min', score: 67 },
]

const notifications = [
  {
    dot: 'blue',
    title: 'Your profile was viewed by TechCorp Asia',
    time: '2 hours ago',
  },
  {
    dot: 'green',
    title: 'New job match: Frontend Developer',
    time: '5 hours ago',
  },
]

const faqs = [
  {
    question: 'Where can I find my interview link?',
    answer: 'Open the email from the company that invited you. Paste that link here to practice in the same format.',
  },
  {
    question: "Don't have an interview link?",
    answer: 'You can still begin a general practice session and use it to warm up before a real interview.',
  },
]

const mockInterviewQuestion = {
  id: 'mock-base-question-1',
  type: 'base',
  baseRoundSeconds: 300,
  prompt: 'Walk us through a recent project where you solved a difficult technical problem.',
}

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function InterviewWorkspace({ candidateName, onClose }) {
  const [stage, setStage] = useState('consent')
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [baseSeconds, setBaseSeconds] = useState(mockInterviewQuestion.baseRoundSeconds)
  const [isRecording, setIsRecording] = useState(false)
  const [mockAnswer, setMockAnswer] = useState(null)
  const [tabOutCount, setTabOutCount] = useState(0)
  const isTimedStage = stage === 'question'

  useEffect(() => {
    if (!isTimedStage) {
      return undefined
    }

    const preventShortcut = (event) => event.preventDefault()
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabOutCount((current) => current + 1)
      }
    }

    document.addEventListener('paste', preventShortcut)
    document.addEventListener('contextmenu', preventShortcut)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('paste', preventShortcut)
      document.removeEventListener('contextmenu', preventShortcut)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isTimedStage])

  useEffect(() => {
    if (stage !== 'question') {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setBaseSeconds((current) => Math.max(current - 1, 0))
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [stage])

  useEffect(() => {
    if (stage === 'question' && baseSeconds === 0) {
      setIsRecording(false)
      setMockAnswer((current) => current || {
        questionId: mockInterviewQuestion.id,
        transcript: 'Mock transcript captured when the shared 5:00 timer ended.',
      })
    }
  }, [baseSeconds, stage])

  const beginBaseRound = () => {
    setStage('question')
    setBaseSeconds(mockInterviewQuestion.baseRoundSeconds)
    setIsRecording(false)
    setMockAnswer(null)
  }

  const toggleRecording = () => {
    if (stage !== 'question' || baseSeconds === 0) {
      return
    }

    setIsRecording((current) => {
      const nextRecordingState = !current

      if (!nextRecordingState) {
        setMockAnswer({
          questionId: mockInterviewQuestion.id,
          transcript: 'Mock transcript captured from the single-question interview preview.',
        })
      }

      return nextRecordingState
    })
  }

  return (
    <div className="interview-workspace" role="dialog" aria-modal="true" aria-labelledby="interview-title">
      <header className="interview-topbar">
        <button type="button" className="dashboard-brand" onClick={onClose}>
          <img src="/logo.svg" alt="AAAI logo" />
          <span>AAAI</span>
        </button>
        <div className="interview-session-meta">
          <span><Icon name="shield" /> Paste locked</span>
          <span><Icon name="flag" /> Tab outs {tabOutCount}</span>
        </div>
        <button type="button" className="company-close-button interview-close" onClick={onClose} aria-label="Close interview">
          <Icon name="close" />
        </button>
      </header>

      <section className={`interview-panel stage-${stage}`}>
        {stage === 'consent' ? (
          <>
            <p className="eyebrow">Candidate consent</p>
            <h1 id="interview-title">Before your interview starts</h1>
            <p>
              Hi {candidateName}. AAAI will record your audio, transcribe your answers, and create an AI-assisted
              scorecard for recruiter review.
            </p>
            <label className="consent-check">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(event) => setConsentAccepted(event.target.checked)}
              />
              <span>I understand this interview is recorded and evaluated with AI.</span>
            </label>
            <button type="button" className="solid-button" disabled={!consentAccepted} onClick={beginBaseRound}>
              Continue to interview
            </button>
          </>
        ) : null}

        {stage === 'question' ? (
          <>
            <div className="interview-panel-head">
              <span>Base question 1 of 1</span>
              <strong><Icon name="clock" /> {formatTime(baseSeconds)}</strong>
            </div>
            <h1 id="interview-title">{mockInterviewQuestion.prompt}</h1>
            <p>
              Answer naturally. This mocked FR-05 view uses one shared five-minute timer for the base round.
            </p>
            <div className={isRecording ? 'recording-orb active' : 'recording-orb'} aria-hidden="true">
              <Icon name="mic" size={34} />
            </div>
            <p className="recording-status" aria-live="polite">
              {baseSeconds === 0
                ? 'Time is up. Your mock answer is saved.'
                : isRecording
                  ? 'Recording in progress.'
                  : mockAnswer
                    ? 'Mock answer saved. Press record again to replace it.'
                    : 'Ready when you are.'}
            </p>
            <div className="interview-actions">
              <button
                type="button"
                className="solid-button record-only-button"
                onClick={toggleRecording}
                disabled={baseSeconds === 0}
              >
                <Icon name={isRecording ? 'stop' : 'mic'} />
                {isRecording ? 'Stop recording' : 'Record answer'}
              </button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  )
}

function DashboardHeader({ title, copy }) {
  return (
    <header className="dashboard-section-header">
      <h1>{title}</h1>
      <p>{copy}</p>
    </header>
  )
}

function ScoreRing({ score }) {
  return (
    <span className="assessment-score" style={{ '--score': `${score}%` }} aria-label={`${score}% score`}>
      <strong>{score}%</strong>
    </span>
  )
}

export default function CandidateDashboard({ user, onOpenLogin, onOpenSignup, onBackToLanding }) {
  const [activeView, setActiveView] = useState('intro')
  const [expandedFaq, setExpandedFaq] = useState('')
  const [isPracticeOpen, setIsPracticeOpen] = useState(false)
  const [isInterviewOpen, setIsInterviewOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profile = user || { name: 'Ben', email: 'ben@gmail.com' }
  const firstName = profile.name.split(' ')[0] || 'Ben'
  const initial = firstName.charAt(0).toUpperCase()

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsPracticeOpen(false)
        setIsInterviewOpen(false)
        setIsNotificationsOpen(false)
        setIsProfileOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const openPractice = () => setIsPracticeOpen(true)
  const startInterview = () => {
    setIsPracticeOpen(false)
    setIsInterviewOpen(true)
  }

  const renderContent = () => {
    if (activeView === 'jobs') {
      return (
        <>
          <DashboardHeader title="Recommended Jobs" copy="Jobs matched to your profile and preferences." />
          <div className="jobs-grid">
            {jobs.map((job) => (
              <article className="job-card" key={`${job.role}-${job.company}`}>
                <div className="job-card-top">
                  <span className="job-icon" aria-hidden="true">
                    <Icon name={job.icon} />
                  </span>
                  <div>
                    <h2>{job.role}</h2>
                    <p>{job.company}</p>
                  </div>
                  <span className="match-pill">{job.match} match</span>
                </div>
                <dl className="job-meta">
                  <div>
                    <dt>Location</dt>
                    <dd>{job.location}</dd>
                  </div>
                  <div>
                    <dt>Salary</dt>
                    <dd>{job.salary}</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{job.type}</dd>
                  </div>
                </dl>
                <div className="tag-row">
                  {job.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <button type="button" className="solid-button full-width">
                  Apply Now
                </button>
              </article>
            ))}
          </div>
        </>
      )
    }

    if (activeView === 'cv') {
      return (
        <>
          <DashboardHeader title="CV Evaluation" copy="Upload your CV and get instant AI-powered feedback." />
          <section className="dashboard-card upload-card">
            <label className="upload-zone" htmlFor="cv-upload">
              <span className="upload-icon" aria-hidden="true">
                <Icon name="upload" />
              </span>
              <strong>Drag & drop your CV here, or browse</strong>
              <small>Supports PDF, DOCX, DOC - Max 5 MB</small>
              <input id="cv-upload" type="file" accept=".pdf,.doc,.docx" />
            </label>
          </section>
        </>
      )
    }

    if (activeView === 'preferences') {
      return (
        <>
          <DashboardHeader title="Job Preferences" copy="Tell us what you are looking for in your next role." />
          <form className="dashboard-card preference-form">
            <label>
              <span>Desired Role</span>
              <input type="text" placeholder="e.g. Frontend Developer, Product Designer" />
            </label>
            <label>
              <span>Preferred Location</span>
              <input type="text" placeholder="e.g. Bangkok, Singapore, Remote" />
            </label>
            <label className="range-field">
              <span>Minimum Salary (USD / year) - $50,000</span>
              <input type="range" min="30000" max="160000" defaultValue="50000" />
            </label>
            <label>
              <span>Work Type</span>
              <select defaultValue="Any">
                <option>Any</option>
                <option>Remote</option>
                <option>Hybrid</option>
                <option>On-site</option>
              </select>
            </label>
            <label>
              <span>Industry</span>
              <input type="text" placeholder="e.g. Technology, Finance, Healthcare" />
            </label>
            <label className="checkbox-line">
              <input type="checkbox" defaultChecked />
              <span>Open to fully remote opportunities</span>
            </label>
            <button type="button" className="solid-button preference-submit">
              Save Preferences
            </button>
          </form>
        </>
      )
    }

    if (activeView === 'applied') {
      return (
        <>
          <DashboardHeader title="Applied Jobs" copy="Track the status of your job applications." />
          <section className="dashboard-card table-card">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Company</th>
                  <th>Applied</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appliedJobs.map((job) => (
                  <tr key={`${job.role}-${job.company}`}>
                    <td>{job.role}</td>
                    <td>{job.company}</td>
                    <td>{job.applied}</td>
                    <td>
                      <span className={`status-chip ${job.tone}`}>{job.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )
    }

    if (activeView === 'assessments') {
      return (
        <>
          <DashboardHeader title="Past Assessments" copy="Review your past AI interview and skills assessments." />
          <section className="dashboard-card practice-strip">
            <div className="strip-icon" aria-hidden="true">
              <Icon name="mic" />
            </div>
            <div>
              <h2>Have an upcoming AAAI interview?</h2>
              <p>Paste your interview link to practice with an AI session shaped like your real interview before it counts.</p>
            </div>
            <input type="url" defaultValue="https://aaai.ai/interview/candidate-practice" aria-label="Interview link" />
            <button type="button" className="solid-button" onClick={openPractice}>
              <span>Begin Practice</span>
              <Icon name="arrowRight" />
            </button>
          </section>

          <div className="faq-list">
            {faqs.map((faq) => (
              <section className="faq-item" key={faq.question}>
                <button
                  type="button"
                  onClick={() => setExpandedFaq((current) => (current === faq.question ? '' : faq.question))}
                  aria-expanded={expandedFaq === faq.question}
                >
                  <span>{faq.question}</span>
                  <Icon name="chevronDown" className="chevron-icon" />
                </button>
                {expandedFaq === faq.question ? <p>{faq.answer}</p> : null}
              </section>
            ))}
          </div>

          <h2 className="history-title">Past Assessment History</h2>
          <div className="assessment-list">
            {assessments.map((assessment) => (
              <article className="assessment-row" key={assessment.title}>
                <div>
                  <h3>{assessment.title}</h3>
                  <p>{assessment.date} - {assessment.duration}</p>
                </div>
                <ScoreRing score={assessment.score} />
                <span className="passed-chip">Passed</span>
              </article>
            ))}
          </div>
        </>
      )
    }

    return (
      <>
        <DashboardHeader
          title="Private Introduction"
          copy="Introduce yourself to hiring companies and let the right ones reach out to you."
        />
        <section className="intro-panel">
          <div className="intro-panel-main">
            <div className="intro-kicker-row">
              <span className="intro-icon">
                <Icon name="card" />
                <small aria-hidden="true" />
              </span>
              <span>Profile visibility</span>
            </div>
            <h2>Only share your profile when there is a strong match.</h2>
            <p>
              AAAI keeps your introduction private until a company fits your preferences, role goals,
              and interview readiness.
            </p>
            <ul>
              <li>Shared only with companies that match your target roles</li>
              <li>Interview requests and offers stay organized in your workspace</li>
              <li>You can update your preferences before any recommendation</li>
            </ul>
            <button type="button" className="solid-button">
              Complete profile
            </button>
          </div>

          <aside className="intro-panel-side" aria-label="Private introduction status">
            <p>Visibility</p>
            <strong>Private</strong>
            <span>Ready to share after profile review</span>
            <div className="intro-meter" aria-hidden="true">
              <span />
            </div>
          </aside>
        </section>
      </>
    )
  }

  return (
    <main className="candidate-app-page">
      <header className="dashboard-topbar">
        <button type="button" className="dashboard-brand" onClick={onBackToLanding}>
          <img src="/logo.svg" alt="AAAI logo" />
          <span>AAAI</span>
        </button>

        <div className="dashboard-actions">
          <div className="popover-anchor">
            <button
              type="button"
              className="round-action"
              aria-label="Open notifications"
              aria-expanded={isNotificationsOpen}
              onClick={() => {
                setIsNotificationsOpen((current) => !current)
                setIsProfileOpen(false)
              }}
            >
              <Icon name="bell" />
              <span className="action-badge">2</span>
            </button>
            {isNotificationsOpen ? (
              <section className="notifications-popover" aria-label="Notifications">
                <h2>Notifications</h2>
                {notifications.map((item) => (
                  <article className="notification-item" key={item.title}>
                    <span className={`notification-dot ${item.dot}`} />
                    <div>
                      <p>{item.title}</p>
                      <small>{item.time}</small>
                    </div>
                  </article>
                ))}
                <button type="button" className="popover-link">
                  Mark all as read
                </button>
              </section>
            ) : null}
          </div>

          <div className="popover-anchor">
            <button
              type="button"
              className="profile-chip"
              aria-label="Open profile menu"
              aria-expanded={isProfileOpen}
              onClick={() => {
                setIsProfileOpen((current) => !current)
                setIsNotificationsOpen(false)
              }}
            >
              <span className="avatar">{initial}</span>
              <strong>{firstName}</strong>
              <Icon name="chevronDown" className="chevron-icon" />
            </button>
            {isProfileOpen ? (
              <section className="profile-menu" aria-label="Profile menu">
                <div className="profile-menu-head">
                  <span className="avatar large-avatar">{initial}</span>
                  <div>
                    <strong>{firstName}</strong>
                    <p>{profile.email}</p>
                  </div>
                </div>
                <button type="button" onClick={onBackToLanding}>
                  <span className="menu-icon" aria-hidden="true">
                    <Icon name="home" />
                  </span>
                  Home
                </button>
                <button type="button" onClick={onOpenLogin}>
                  <span className="menu-icon" aria-hidden="true">
                    <Icon name="login" />
                  </span>
                  Log in
                </button>
                <button type="button" onClick={onOpenSignup}>
                  <span className="menu-icon" aria-hidden="true">
                    <Icon name="spark" />
                  </span>
                  Sign up
                </button>
              </section>
            ) : null}
          </div>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="dashboard-sidebar">
          <h2>Welcome, {firstName}!</h2>
          <nav className="dashboard-nav" aria-label="Candidate sections">
            {navItems.map((item) => (
              <button
                type="button"
                key={item.id}
                className={activeView === item.id ? 'dashboard-nav-item active' : 'dashboard-nav-item'}
                onClick={() => setActiveView(item.id)}
              >
                <span className="nav-glyph" aria-hidden="true">
                  <Icon name={item.icon} />
                </span>
                {item.label}
              </button>
            ))}
          </nav>

          <section className="sidebar-practice-card">
            <span className="sidebar-card-icon" aria-hidden="true">
              <Icon name="mic" />
            </span>
            <h3>Have an upcoming interview?</h3>
            <p>Practice with AI first and get comfortable before it counts.</p>
            <button type="button" className="solid-button full-width" onClick={openPractice}>
              Start practicing
            </button>
          </section>
        </aside>

        <section className="dashboard-content">{renderContent()}</section>
      </div>

      <footer className="candidate-footer">
        <a href="#privacy">Privacy Policy</a>
        <a href="#terms">Terms of Service</a>
        <a href="mailto:contact@aaai.ai">contact@aaai.ai</a>
      </footer>

      <button type="button" className="feedback-button">
        Feedback / Support
      </button>

      {isPracticeOpen ? (
        <div className="practice-backdrop" role="presentation" onMouseDown={() => setIsPracticeOpen(false)}>
          <section
            className="practice-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="practice-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="practice-close" onClick={() => setIsPracticeOpen(false)} aria-label="Close practice dialog">
              <Icon name="close" />
            </button>
            <header>
              <h2 id="practice-title">Got an interview link from a company?</h2>
              <p>Practice with an AI session shaped like your real interview before it counts.</p>
            </header>
            <ul>
              <li><strong>Paste your interview link</strong> - the one the company sent you</li>
              <li><strong>Start a practice session</strong> built on that interview's format</li>
              <li><strong>Do the real interview</strong> through the company's link, as usual</li>
            </ul>
            <button type="button" className="solid-button full-width" onClick={startInterview}>
              Start practicing
            </button>
          </section>
        </div>
      ) : null}

      {isInterviewOpen ? (
        <InterviewWorkspace candidateName={firstName} onClose={() => setIsInterviewOpen(false)} />
      ) : null}
    </main>
  )
}
