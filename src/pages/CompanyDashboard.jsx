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
  assessments: [
    {
      title: 'CV Evaluation',
      icon: 'document',
      items: [
        { label: 'Dashboard' },
        { label: 'CV Evaluation Criteria', count: 1 },
      ],
    },
    {
      title: 'Test',
      icon: 'clipboard',
      beta: true,
      items: [
        { label: 'Dashboard' },
        { label: 'Test Sets', count: 1 },
        { label: 'Test Submissions', count: 1 },
      ],
    },
    {
      title: 'Chat Screening',
      icon: 'users',
      beta: true,
      items: [
        { label: 'Dashboard' },
        { label: 'Chat Screening Sets', count: 1 },
        { label: 'Chat Screening Responses', count: 1 },
      ],
    },
  ],
  more: [
    { label: 'My Candidates', count: 1 },
    { label: 'My Jobs', count: 1 },
    { label: 'Careers Page', external: true },
    { label: 'Referral Community', beta: true },
  ],
}

const project = {
  name: 'Demo - Marketing & Operation',
  jobPost: 'Demo - Marketing & Operation',
  date: '28 Jul 2026',
  candidates: 4,
  assessments: [
    'Demo - AI Interview (Marketing and Operation)',
    'Demo - CV Eval (Marketing and Operation)',
  ],
}

const audioPreviewSrc = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='

const rankedCandidates = [
  {
    id: 'maya-chen',
    name: 'Maya Chen',
    role: 'Frontend Engineer',
    aggregate: 4.6,
    tabOuts: 0,
    status: 'Shortlist',
    review: false,
    reason: 'Consistent responses and no risk signals.',
    traits: [
      { label: 'Technical Skill', score: 5, rationale: 'Explained React state tradeoffs with concrete examples.' },
      { label: 'Communication', score: 4, rationale: 'Clear, structured answers without sounding scripted.' },
      { label: 'Problem Solving', score: 5, rationale: 'Debugging sequence moved from reproduction to root-cause isolation.' },
      { label: 'Job Fit', score: 4, rationale: 'Strong alignment with async product work and frontend ownership.' },
    ],
    transcripts: [
      {
        question: 'Walk us through a difficult technical problem.',
        text: 'I started by reproducing the issue in a narrow environment, then checked state updates against the network response before changing the component boundary.',
      },
      {
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
    tabOuts: 2,
    status: 'Needs Review',
    review: true,
    reason: 'High tab-out count during the follow-up answer.',
    traits: [
      { label: 'Technical Skill', score: 3, rationale: 'Understood implementation constraints but stayed high-level.' },
      { label: 'Communication', score: 4, rationale: 'Concise and easy to follow, with clear examples.' },
      { label: 'Problem Solving', score: 4, rationale: 'Described a useful discovery process with stakeholder tradeoffs.' },
      { label: 'Job Fit', score: 4, rationale: 'Strong fit for collaborative product discovery.' },
    ],
    transcripts: [
      {
        question: 'How do you explain tradeoffs?',
        text: 'I first clarify the customer impact and then show which pieces can safely move later without hiding risk from the team.',
      },
      {
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
    tabOuts: 1,
    status: 'Needs Review',
    review: true,
    reason: 'Communication score is low and transcript contains templated phrasing.',
    traits: [
      { label: 'Technical Skill', score: 4, rationale: 'Answered core React lifecycle questions correctly.' },
      { label: 'Communication', score: 2, rationale: 'Repeated rigid transition phrases and sounded memorized.' },
      { label: 'Problem Solving', score: 3, rationale: 'Provided the correct order of operations but limited detail.' },
      { label: 'Job Fit', score: 3, rationale: 'Potential fit, pending manual review of audio.' },
    ],
    transcripts: [
      {
        question: 'Tell us about debugging with limited information.',
        text: 'Furthermore, I would analyze the problem. In conclusion, the solution requires careful problem solving and teamwork.',
      },
      {
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

function CandidateDetailDrawer({ candidate, onClose }) {
  if (!candidate) {
    return null
  }

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
            <p className="eyebrow">Candidate scorecard</p>
            <h2 id="candidate-detail-title">{candidate.name}</h2>
            <p>{candidate.role} - aggregate {candidate.aggregate.toFixed(1)} / 5</p>
          </div>
        </header>

        {candidate.review ? (
          <section className="review-reason">
            <Icon name="flag" />
            <div>
              <strong>Needs manual review</strong>
              <p>{candidate.reason}</p>
            </div>
          </section>
        ) : null}

        <section className="trait-grid" aria-label="Trait scores">
          {candidate.traits.map((trait) => (
            <article className="trait-card" key={trait.label}>
              <span>{trait.label}</span>
              <strong>{trait.score}/5</strong>
              <p>{trait.rationale}</p>
            </article>
          ))}
        </section>

        <section className="transcript-list">
          <h3>Transcript and audio</h3>
          {candidate.transcripts.map((item, index) => (
            <article className="transcript-card" key={`${candidate.id}-${item.question}`}>
              <span>Response {index + 1}</span>
              <h4>{item.question}</h4>
              <p>{item.text}</p>
              <audio controls src={audioPreviewSrc}>
                Audio preview unavailable.
              </audio>
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
          <button
            type="button"
            className={activeMenu === 'assessments' ? 'company-nav-button active' : 'company-nav-button'}
            onClick={() => setActiveMenu((current) => (current === 'assessments' ? '' : 'assessments'))}
          >
            Other Assessments <Icon name="chevronDown" size={16} />
          </button>
          <button
            type="button"
            className={activeMenu === 'more' ? 'company-nav-button active' : 'company-nav-button'}
            onClick={() => setActiveMenu((current) => (current === 'more' ? '' : 'more'))}
          >
            More <Icon name="chevronDown" size={16} />
          </button>
        </nav>

        <div className="company-actions">
          <button type="button" className="quick-tour-button">
            <Icon name="play" size={17} />
            Quick Tour
          </button>
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

      {activeMenu === 'assessments' ? (
        <section className="company-dropdown assessments-dropdown">
          {menuPanels.assessments.map((group) => (
            <article className="assessment-menu-group" key={group.title}>
              <div className="assessment-menu-heading">
                <Icon name={group.icon} />
                <span>{group.title}</span>
                {group.beta ? <span className="beta-chip">Beta</span> : null}
              </div>
              {group.items.map((item) => (
                <DropdownRow item={item} key={item.label} />
              ))}
            </article>
          ))}
        </section>
      ) : null}

      {activeMenu === 'more' ? (
        <section className="company-dropdown more-dropdown">
          {menuPanels.more.map((item) => (
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
          <div>
            <h1>
              All Hiring Projects <CountBadge>1</CountBadge>
            </h1>
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

        <div className="company-benefits" aria-label="Platform benefits">
          <span><Icon name="briefcase" /> One place for AI interviews, CV evaluation, ATS, and job posts</span>
          <span><Icon name="users" /> Track every candidate through your hiring stages</span>
          <span><Icon name="chart" /> AI scores surface the best fits, fast</span>
        </div>

        {projectStatus === 'active' ? (
          <>
            <section className="project-table-card">
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
                  <strong>{rankedCandidates.length}</strong>
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

              <button type="button" className="new-project-row" onClick={() => setIsNewProjectOpen(true)}>
                <Icon name="plus" />
                <span>
                  <strong>New Hiring Project</strong>
                  <small>Create a hiring project to start screening candidates and get instant CV and interview evaluations.</small>
                </span>
              </button>
            </section>

            <section className="recruiter-scoreboard">
              <header className="scoreboard-header">
                <div>
                  <p className="eyebrow">SRS-FR-14 leaderboard</p>
                  <h2>Ranked candidate results</h2>
                  <p>Scores, tab-out signals, review flags, transcripts, and audio playback stay visible in one review surface.</p>
                </div>
                <div className="budget-meter" aria-label="Budget monitor">
                  <span>AI budget</span>
                  <strong>$2.34 / $10.00</strong>
                  <small>Active - local demo data</small>
                </div>
              </header>

              <div className="leaderboard-table" role="table" aria-label="Ranked candidate leaderboard">
                <div className="leaderboard-head" role="row">
                  <span role="columnheader">Rank</span>
                  <span role="columnheader">Candidate</span>
                  <span role="columnheader">Score</span>
                  <span role="columnheader">Tab outs</span>
                  <span role="columnheader">Review</span>
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
                    <button type="button" className="company-secondary-button compact" onClick={() => setSelectedCandidate(candidate)}>
                      Review
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : (
          <EmptyProjects type={projectStatus} />
        )}
      </section>

      <section className="product-update-card">
        <Icon name="spark" />
        <div>
          <strong>Product Updates <span>3</span></strong>
          <p>3 releases this week</p>
        </div>
        <button type="button" aria-label="Dismiss product updates">
          <Icon name="close" size={14} />
        </button>
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
