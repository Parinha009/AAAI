import { useEffect, useState } from 'react'
import Icon from '../components/Icon'

const menuPanels = {
  projects: [
    { label: 'All Hiring Projects', count: 1, status: 'active' },
    { label: 'Archived Projects', status: 'archived' },
    { label: 'Draft Projects', status: 'draft' },
  ],
  interview: [
    { label: 'Dashboard' },
    { label: 'AI Interview Sets', count: 1 },
    { label: 'AI Interview Candidates', count: 1 },
  ],
}

const project = {
  jobId: 'JOB-AAAI-FE-2026-07',
  name: 'Demo - Marketing & Operation',
  jobPost: 'Demo - Marketing & Operation',
  date: '28 Jul 2026',
  candidates: 4,
  scoredCandidates: 3,
  assessments: [
    'Demo - AI Interview (Marketing and Operation)',
    'Demo - CV Eval (Marketing and Operation)',
  ],
}

const authSession = {
  method: 'Email magic link',
  role: 'Recruiter',
  scope: 'Recruiter dashboard only',
  status: 'Authenticated',
}

const budgetStatus = {
  used: 2.34,
  cap: 10,
  state: 'Active',
}

const audioPreviewSrc = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='

const rankedCandidates = [
  {
    id: 'maya-chen',
    name: 'Maya Chen',
    role: 'Frontend Engineer',
    aggregate: 4.6,
    confidence: 'High',
    tabOuts: 0,
    status: 'Shortlist',
    review: false,
    reason: 'Consistent responses and no risk signals.',
    completedAt: '28 Jul 2026, 10:42 AM',
    audioResponses: 2,
    auditEvents: [
      { type: 'WHISPER_RESPONSE', time: '10:35 AM', detail: 'Base audio transcribed successfully.' },
      { type: 'GPT_SCORECARD', time: '10:42 AM', detail: 'Schema-validated scorecard persisted.' },
    ],
    traits: [
      { label: 'Technical Skill', score: 5, rationale: 'Explained React state tradeoffs with concrete examples.' },
      { label: 'Communication', score: 4, rationale: 'Clear, structured answers without sounding scripted.' },
      { label: 'Problem Solving', score: 5, rationale: 'Debugging sequence moved from reproduction to root-cause isolation.' },
      { label: 'Job Fit', score: 4, rationale: 'Strong alignment with async product work and frontend ownership.' },
    ],
    transcripts: [
      {
        type: 'Base question',
        duration: '1:18',
        question: 'Walk us through a difficult technical problem.',
        text: 'I started by reproducing the issue in a narrow environment, then checked state updates against the network response before changing the component boundary.',
      },
      {
        type: 'Follow-up',
        duration: '0:52',
        question: 'What signal would you inspect first?',
        text: 'I would inspect the request lifecycle and compare expected state transitions with what the UI renders after each response.',
      },
    ],
  },
  {
    id: 'rin-sok',
    name: 'Rin Sok',
    role: 'Product Designer',
    aggregate: 3.8,
    confidence: 'Medium',
    tabOuts: 2,
    status: 'Needs Review',
    review: true,
    reason: 'High tab-out count during the follow-up answer.',
    completedAt: '28 Jul 2026, 11:16 AM',
    audioResponses: 2,
    auditEvents: [
      { type: 'TAB_OUT', time: '11:09 AM', detail: 'Candidate left the question tab during recording.' },
      { type: 'TAB_OUT', time: '11:12 AM', detail: 'Candidate left the follow-up tab during recording.' },
      { type: 'GPT_SCORECARD', time: '11:16 AM', detail: 'Manual review flag added from tab-out threshold.' },
    ],
    traits: [
      { label: 'Technical Skill', score: 3, rationale: 'Understood implementation constraints but stayed high-level.' },
      { label: 'Communication', score: 4, rationale: 'Concise and easy to follow, with clear examples.' },
      { label: 'Problem Solving', score: 4, rationale: 'Described a useful discovery process with stakeholder tradeoffs.' },
      { label: 'Job Fit', score: 4, rationale: 'Strong fit for collaborative product discovery.' },
    ],
    transcripts: [
      {
        type: 'Base question',
        duration: '1:04',
        question: 'How do you explain tradeoffs?',
        text: 'I first clarify the customer impact and then show which pieces can safely move later without hiding risk from the team.',
      },
      {
        type: 'Follow-up',
        duration: '0:47',
        question: 'What would you inspect first?',
        text: 'I would check where users lose confidence and compare that with the handoff points between design and engineering.',
      },
    ],
  },
  {
    id: 'dara-lim',
    name: 'Dara Lim',
    role: 'React Engineer',
    aggregate: 3.1,
    confidence: 'Low',
    tabOuts: 1,
    status: 'Needs Review',
    review: true,
    reason: 'Communication score is low and transcript contains templated phrasing.',
    completedAt: '28 Jul 2026, 1:05 PM',
    audioResponses: 2,
    auditEvents: [
      { type: 'TAB_OUT', time: '12:58 PM', detail: 'Candidate left the browser tab once.' },
      { type: 'GPT_SCORECARD', time: '1:05 PM', detail: 'Robotic-language heuristic triggered in Communication rationale.' },
    ],
    traits: [
      { label: 'Technical Skill', score: 4, rationale: 'Answered core React lifecycle questions correctly.' },
      { label: 'Communication', score: 2, rationale: 'Repeated rigid transition phrases and sounded memorized.' },
      { label: 'Problem Solving', score: 3, rationale: 'Provided the correct order of operations but limited detail.' },
      { label: 'Job Fit', score: 3, rationale: 'Potential fit, pending manual review of audio.' },
    ],
    transcripts: [
      {
        type: 'Base question',
        duration: '0:59',
        question: 'Tell us about debugging with limited information.',
        text: 'Furthermore, I would analyze the problem. In conclusion, the solution requires careful problem solving and teamwork.',
      },
      {
        type: 'Follow-up',
        duration: '0:43',
        question: 'What signal would you inspect first?',
        text: 'I would inspect logs, metrics, and user feedback, then apply the best practice solution.',
      },
    ],
  },
]

function CountBadge({ children }) {
  return <span className="company-count-badge">{children}</span>
}

function DropdownRow({ item }) {
  return (
    <button type="button" className="company-menu-row">
      <span>{item.label}</span>
      {item.count ? <CountBadge>{item.count}</CountBadge> : null}
      {item.beta ? <span className="beta-chip">Beta</span> : null}
      {item.external ? <Icon name="arrowRight" size={16} /> : null}
    </button>
  )
}

function EmptyProjects({ type }) {
  const isDraft = type === 'draft'

  return (
    <section className="company-empty-state">
      <div className="company-empty-icon">
        <Icon name={isDraft ? 'pencil' : 'archive'} size={44} />
      </div>
      <h2>{isDraft ? 'No Draft Projects' : 'No Archived Projects'}</h2>
      <p>{isDraft ? "You don't have any draft hiring projects yet." : "You don't have any archived hiring projects yet."}</p>
    </section>
  )
}

function ProfileRequiredModal({ organizationName, error, onChange, onContinue }) {
  return (
    <div className="company-modal-backdrop" role="presentation">
      <section className="company-profile-modal" role="dialog" aria-modal="true" aria-labelledby="company-profile-title">
        <header>
          <h2 id="company-profile-title">Profile information required</h2>
          <p>Please fill in the required information to continue.</p>
        </header>

        <label className={error ? 'company-field has-error' : 'company-field'} htmlFor="organizationName">
          <span>Organization Name</span>
          <input
            id="organizationName"
            type="text"
            placeholder="Enter your organization name"
            value={organizationName}
            onChange={(event) => onChange(event.target.value)}
            autoFocus
          />
          {error ? <small>{error}</small> : null}
        </label>

        <button type="button" className="company-primary-button full-width" onClick={onContinue}>
          Continue
        </button>
      </section>
    </div>
  )
}

function NewProjectModal({ jobTitle, projectName, onJobTitleChange, onProjectNameChange, onClose }) {
  const canContinue = jobTitle.trim() && projectName.trim()

  return (
    <div className="company-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="new-project-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="company-close-button" onClick={onClose} aria-label="Close dialog">
          <Icon name="close" />
        </button>
        <h2 id="new-project-title">New Hiring Project</h2>

        <label className="company-field" htmlFor="jobTitle">
          <span>
            Job Title <small>(visible to candidates)</small>
          </span>
          <input
            id="jobTitle"
            type="text"
            placeholder="e.g. Sales Specialist"
            value={jobTitle}
            onChange={(event) => onJobTitleChange(event.target.value)}
            autoFocus
          />
        </label>

        <label className="company-field" htmlFor="projectName">
          <span>
            Project Name <small>(internal use only)</small>
          </span>
          <input
            id="projectName"
            type="text"
            placeholder="e.g. Sales Specialist - Project"
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
          />
          <small>Auto-filled from Job Title - edit if you want.</small>
        </label>

        <div className="new-project-actions">
          <button type="button" className="company-secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="company-primary-button" disabled={!canContinue}>
            Continue
          </button>
        </div>
      </section>
    </div>
  )
}

function RecruiterMetric({ label, value, detail, icon, tone = '' }) {
  return (
    <article className={`recruiter-metric ${tone}`.trim()}>
      <span className="recruiter-metric-icon">
        <Icon name={icon} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </article>
  )
}

function CandidateDetailDrawer({ candidate, onClose }) {
  if (!candidate) {
    return null
  }

  const reviewReasons = candidate.review ? [candidate.reason] : ['No manual review thresholds crossed.']

  return (
    <div className="recruiter-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="recruiter-detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="company-close-button" onClick={onClose} aria-label="Close candidate detail">
          <Icon name="close" />
        </button>

        <header className="drawer-candidate-head">
          <span className="drawer-avatar">{candidate.name.charAt(0)}</span>
          <div>
            <p className="eyebrow">SRS-FR-14 scorecard detail</p>
            <h2 id="candidate-detail-title">{candidate.name}</h2>
            <p>{candidate.role} - aggregate {candidate.aggregate.toFixed(1)} / 5</p>
          </div>
        </header>

        <div className="drawer-summary-grid" aria-label="Candidate review summary">
          <span><strong>{candidate.aggregate.toFixed(1)}</strong> Aggregate</span>
          <span><strong>{candidate.tabOuts}</strong> TAB_OUT</span>
          <span><strong>{candidate.confidence}</strong> AI confidence</span>
          <span><strong>{candidate.audioResponses}</strong> Audio files</span>
        </div>

        {candidate.review ? (
          <section className="review-reason">
            <Icon name="flag" />
            <div>
              <strong>Needs manual review</strong>
              {reviewReasons.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
            </div>
          </section>
        ) : null}

        <section className="trait-grid" aria-label="Trait scores">
          {candidate.traits.map((trait) => (
            <article className="trait-card" key={trait.label}>
              <span>{trait.label}</span>
              <strong>{trait.score}/5</strong>
              <p><b>AI rationale:</b> {trait.rationale}</p>
            </article>
          ))}
        </section>

        <section className="transcript-list">
          <h3>Full transcript and raw audio</h3>
          {candidate.transcripts.map((item, index) => (
            <article className="transcript-card" key={`${candidate.id}-${item.question}`}>
              <div className="transcript-card-meta">
                <span>{item.type}</span>
                <small>Response {index + 1} - {item.duration}</small>
              </div>
              <h4>{item.question}</h4>
              <p>{item.text}</p>
              <audio controls src={audioPreviewSrc}>
                Audio preview unavailable.
              </audio>
            </article>
          ))}
        </section>

        <section className="audit-trail-list">
          <h3>Immutable audit trail</h3>
          {candidate.auditEvents.map((event) => (
            <article className="audit-trail-row" key={`${candidate.id}-${event.type}-${event.time}`}>
              <span>{event.type}</span>
              <div>
                <strong>{event.time}</strong>
                <p>{event.detail}</p>
              </div>
            </article>
          ))}
        </section>
      </aside>
    </div>
  )
}

export default function CompanyDashboard({ user, onBackToLanding }) {
  const [activeMenu, setActiveMenu] = useState('')
  const [projectStatus, setProjectStatus] = useState('active')
  const [organizationName, setOrganizationName] = useState('')
  const [organizationError, setOrganizationError] = useState('')
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(true)
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [jobTitle, setJobTitle] = useState('')
  const [projectName, setProjectName] = useState('')
  const profile = user || { name: 'Ben', email: 'ben@gmail.com' }
  const initial = (profile.name || 'B').charAt(0).toUpperCase()
  const organizationLabel = organizationName.trim() || 'KIT'
  const needsReviewCount = rankedCandidates.filter((candidate) => candidate.review).length
  const totalTabOuts = rankedCandidates.reduce((sum, candidate) => sum + candidate.tabOuts, 0)

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveMenu('')
        setIsNewProjectOpen(false)
        setSelectedCandidate(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleOrganizationContinue = () => {
    if (!organizationName.trim()) {
      setOrganizationError('Organization name is required')
      return
    }

    setOrganizationError('')
    setIsProfileModalOpen(false)
  }

  const handleJobTitleChange = (value) => {
    setJobTitle(value)
    setProjectName((current) => current || (value.trim() ? `${value} - Project` : ''))
  }

  return (
    <main className="company-page">
      <header className="company-topbar">
        <button type="button" className="company-brand" onClick={onBackToLanding}>
          <img src="/logo.svg" alt="AAAI logo" />
          <span>AAAI</span>
        </button>

        <nav className="company-nav" aria-label="Recruiter navigation">
          <button
            type="button"
            className={activeMenu === 'projects' ? 'company-nav-button active' : 'company-nav-button current'}
            onClick={() => setActiveMenu((current) => (current === 'projects' ? '' : 'projects'))}
          >
            Hiring Projects <Icon name="chevronDown" size={16} />
          </button>
          <button
            type="button"
            className={activeMenu === 'interview' ? 'company-nav-button active' : 'company-nav-button'}
            onClick={() => setActiveMenu((current) => (current === 'interview' ? '' : 'interview'))}
          >
            AI Interview <Icon name="chevronDown" size={16} />
          </button>
        </nav>

        <div className="company-actions">
          <button
            type="button"
            className="organization-button"
            onClick={() => setActiveMenu((current) => (current === 'organization' ? '' : 'organization'))}
          >
            <Icon name="company" size={18} />
            {organizationLabel}
            <Icon name="chevronDown" size={15} />
          </button>
          <button type="button" className="language-button">
            <Icon name="language" size={18} />
            English
            <Icon name="chevronDown" size={15} />
          </button>
          <button type="button" className="company-icon-button" aria-label="Notifications">
            <Icon name="bell" />
          </button>
          <button type="button" className="company-avatar" aria-label="Recruiter profile">
            {initial}
          </button>
        </div>
      </header>

      {activeMenu === 'projects' ? (
        <section className="company-dropdown projects-dropdown">
          {menuPanels.projects.map((item) => (
            <button
              type="button"
              className="company-menu-row"
              onClick={() => {
                setProjectStatus(item.status)
                setActiveMenu('')
              }}
              key={item.label}
            >
              <span>{item.label}</span>
              {item.count ? <CountBadge>{item.count}</CountBadge> : null}
            </button>
          ))}
          <button
            type="button"
            className="company-menu-row strong"
            onClick={() => {
              setIsNewProjectOpen(true)
              setActiveMenu('')
            }}
          >
            <span>New Hiring Project</span>
            <Icon name="plus" size={16} />
          </button>
        </section>
      ) : null}

      {activeMenu === 'interview' ? (
        <section className="company-dropdown interview-dropdown">
          {menuPanels.interview.map((item) => (
            <DropdownRow item={item} key={item.label} />
          ))}
        </section>
      ) : null}

      {activeMenu === 'organization' ? (
        <section className="company-dropdown organization-dropdown">
          <div className="organization-card">
            <span className="organization-icon">
              <Icon name="company" />
            </span>
            <div>
              <strong>{organizationLabel}</strong>
              <span className="plan-chip">Free</span>
              <p>Owner - 2 collaborators</p>
              <small>Created Jul 28, 2026</small>
            </div>
            <span className="selected-dot" />
          </div>
          <button type="button" className="organization-link">
            Create new organization
          </button>
          <p className="organization-note">
            Manage your organization and collaborators from <strong>Settings</strong>.
          </p>
        </section>
      ) : null}

      <section className="company-workspace">
        <div className="company-workspace-header">
          <div className="recruiter-title-block">
            <p className="eyebrow">Company page</p>
            <h1>
              Recruiter Dashboard <CountBadge>{project.jobId}</CountBadge>
            </h1>
            <p>
              <strong>Magic-link access.</strong> Ranked scores, TAB_OUT flags, transcripts, and audio.
            </p>
          </div>

          <div className="project-tabs" role="tablist" aria-label="Project status">
            {[
              ['active', 'Active (1)'],
              ['archived', 'Archived'],
              ['draft', 'Draft'],
            ].map(([id, label]) => (
              <button
                type="button"
                role="tab"
                aria-selected={projectStatus === id}
                className={projectStatus === id ? 'active' : ''}
                onClick={() => setProjectStatus(id)}
                key={id}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="company-workspace-actions">
            <button type="button" className="company-icon-button" aria-label="Search projects">
              <Icon name="search" />
            </button>
            <button type="button" className="company-icon-button dark" onClick={() => setIsNewProjectOpen(true)} aria-label="New hiring project">
              <Icon name="plus" />
            </button>
          </div>
        </div>

        {projectStatus === 'active' ? (
          <>
            <section className="recruiter-command-center" aria-label="Recruiter dashboard summary">
              <div className="budget-guard-card auth-session-card">
                <div className="auth-session-copy">
                  <p className="eyebrow">SRS-FR-04</p>
                  <h2>{authSession.status} recruiter session</h2>
                  <p>Verified recruiter access.</p>
                </div>
                <div>
                  <dl className="auth-session-list">
                    <div>
                      <dt>Method</dt>
                      <dd>{authSession.method}</dd>
                    </div>
                    <div>
                      <dt>Role</dt>
                      <dd>{authSession.role}</dd>
                    </div>
                    <div>
                      <dt>Scope</dt>
                      <dd>{authSession.scope}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="recruiter-metrics-grid">
                <RecruiterMetric label="Scorecards" value={rankedCandidates.length} detail="Saved" icon="chart" />
                <RecruiterMetric label="Review" value={needsReviewCount} detail="Flagged" icon="flag" tone="warning" />
                <RecruiterMetric label="TAB_OUT" value={totalTabOuts} detail="Events" icon="shield" />
                <RecruiterMetric label="Audio" value={rankedCandidates.reduce((sum, candidate) => sum + candidate.audioResponses, 0)} detail="Files" icon="mic" />
              </div>
            </section>

            <section className="recruiter-scoreboard">
              <header className="scoreboard-header">
                <div>
                  <p className="eyebrow">SRS-FR-14 / SRS-FR-15</p>
                  <h2>Candidate leaderboard</h2>
                  <p>Score, TAB_OUT, review flag, transcript, and audio.</p>
                  <div className="scoreboard-summary-list" aria-label="Recruiter review capabilities">
                    <span><strong>Name</strong></span>
                    <span><strong>Score</strong></span>
                    <span><strong>TAB_OUT</strong></span>
                    <span><strong>Review</strong></span>
                  </div>
                </div>
                <div className="budget-meter" aria-label="Budget monitor">
                  <span>Budget</span>
                  <strong>${budgetStatus.used.toFixed(2)} / ${budgetStatus.cap.toFixed(2)}</strong>
                  <small>{budgetStatus.state}</small>
                </div>
              </header>

              <div className="leaderboard-toolbar">
                <label htmlFor="jobFilter">
                  Job_ID
                  <select id="jobFilter" value={project.jobId} onChange={() => {}}>
                    <option>{project.jobId}</option>
                  </select>
                </label>
                <span><strong>{rankedCandidates.length}</strong> ranked</span>
              </div>

              <div className="leaderboard-table" role="table" aria-label="Ranked candidate leaderboard">
                <div className="leaderboard-head" role="row">
                  <span role="columnheader">Rank</span>
                  <span role="columnheader">Candidate</span>
                  <span role="columnheader">Score</span>
                  <span role="columnheader">Tab outs</span>
                  <span role="columnheader">Review</span>
                  <span role="columnheader">Completed</span>
                  <span role="columnheader">Action</span>
                </div>
                {rankedCandidates.map((candidate, index) => (
                  <article className={candidate.review ? 'leaderboard-row flagged' : 'leaderboard-row'} role="row" key={candidate.id}>
                    <span className="rank-number" role="cell">{index + 1}</span>
                    <div role="cell">
                      <strong>{candidate.name}</strong>
                      <p>{candidate.role}</p>
                    </div>
                    <span className="score-pill" role="cell">{candidate.aggregate.toFixed(1)} / 5</span>
                    <span className="tabout-pill" role="cell">{candidate.tabOuts}</span>
                    <span className={candidate.review ? 'review-chip danger' : 'review-chip'} role="cell">
                      <Icon name={candidate.review ? 'flag' : 'check'} size={15} />
                      {candidate.status}
                    </span>
                    <span className="completed-cell" role="cell">{candidate.completedAt}</span>
                    <button type="button" className="company-secondary-button compact" onClick={() => setSelectedCandidate(candidate)}>
                      Review
                    </button>
                  </article>
                ))}
              </div>
            </section>

            <section className="project-table-card">
              <header className="project-overview-header">
                <div>
                  <p className="eyebrow">Project overview</p>
                  <h2>Hiring project setup</h2>
                </div>
                <span>{project.assessments.length + 1} steps</span>
              </header>
              <div className="project-table-head">
                <span>Hiring project</span>
                <span>Status</span>
                <span>Candidates</span>
                <span>Assessments</span>
                <span>Assessed candidates</span>
                <span>Action</span>
              </div>

              <article className="project-row">
                <div>
                  <h2>{project.name}</h2>
                  <p>Job_ID: {project.jobId}</p>
                  <p>Job Post: <span className="online-dot" /> {project.jobPost}</p>
                  <small>{project.date}</small>
                </div>
                <div>
                  <span className="status-chip success"><span className="online-dot" /> Active</span>
                </div>
                <div className="candidate-count">
                  <strong>{project.candidates}</strong>
                  <span className="new-chip">+1 New</span>
                </div>
                <div className="assessment-list-compact">
                  {project.assessments.map((item) => (
                    <p key={item}><Icon name="play" size={15} /> {item}</p>
                  ))}
                  <small>+1 more</small>
                </div>
                <div className="candidate-count">
                  <strong>{project.scoredCandidates}</strong>
                  <span className="new-chip">+1 New</span>
                </div>
                <button
                  type="button"
                  className="row-action-button"
                  aria-label="Open candidate leaderboard"
                  onClick={() => setSelectedCandidate(rankedCandidates[0])}
                >
                  <Icon name="moreVertical" />
                </button>
              </article>
            </section>
          </>
        ) : (
          <EmptyProjects type={projectStatus} />
        )}
      </section>

      <button type="button" className="company-help-button" aria-label="Help">
        ?
      </button>

      {isProfileModalOpen ? (
        <ProfileRequiredModal
          organizationName={organizationName}
          error={organizationError}
          onChange={(value) => {
            setOrganizationName(value)
            if (value.trim()) {
              setOrganizationError('')
            }
          }}
          onContinue={handleOrganizationContinue}
        />
      ) : null}

      {isNewProjectOpen ? (
        <NewProjectModal
          jobTitle={jobTitle}
          projectName={projectName}
          onJobTitleChange={handleJobTitleChange}
          onProjectNameChange={setProjectName}
          onClose={() => setIsNewProjectOpen(false)}
        />
      ) : null}

      <CandidateDetailDrawer candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} />
    </main>
  )
}
