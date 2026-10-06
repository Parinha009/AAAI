import { useEffect, useState } from 'react'
import {
  fetchAudioUrl,
  getBudgetStatus,
  getCandidateAudit,
  getCandidateDetail,
  hasSession,
  inviteCandidate,
  listJobCandidates,
  listJobs,
} from '../api'
import Icon from '../components/Icon'

// Recruiter pages. Everything shown comes from the backend - there is no mock data.
const interviewPages = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'candidates', label: 'AI Interview Candidates' },
]

function CountBadge({ children }) {
  return <span className="company-count-badge">{children}</span>
}

function DropdownRow({ item, isActive = false, onClick }) {
  return (
    <button
      type="button"
      className={isActive ? 'company-menu-row active' : 'company-menu-row'}
      onClick={onClick}
    >
      <span>{item.label}</span>
      {item.count ? <CountBadge>{item.count}</CountBadge> : null}
      {item.beta ? <span className="beta-chip">Beta</span> : null}
      {item.external ? <Icon name="arrowRight" size={16} /> : null}
    </button>
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

function formatAggregate(candidate) {
  if (candidate.scored === false) {
    return 'Not scored'
  }
  return `${candidate.aggregateScore} / ${candidate.maxScore}`
}

function getScorePercent(candidate) {
  return Math.round((candidate.aggregateScore / candidate.maxScore) * 100)
}

// --- Live data from the backend (FR-14 / FR-15) ---
const TRAIT_LABELS = [
  ['technical_skill', 'Technical Skill'],
  ['communication', 'Communication'],
  ['problem_solving', 'Problem Solving'],
  ['job_fit', 'Job Fit'],
]

const STATUS_LABELS = {
  invited: 'Invited',
  consented: 'Consented',
  in_progress: 'Interviewing',
  completed: 'Completed',
  expired: 'Expired',
}

// FR-15: every flag shows a human-readable reason, not a raw code.
const REVIEW_REASON_TEXT = {
  LOW_COMMUNICATION: 'Low communication score (2 or below)',
  HIGH_TAB_OUT: 'Left the interview tab 3 or more times',
  GRADING_FAILED: 'AI grading failed - listen and score by hand',
  TEMPLATED_LANGUAGE: 'Templated or robotic phrasing detected',
}

function formatReviewReason(reason) {
  if (REVIEW_REASON_TEXT[reason]) return REVIEW_REASON_TEXT[reason]
  if (!/^[A-Z_]+$/.test(reason)) return reason
  const words = reason.toLowerCase().replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const AI_KIND_LABELS = { transcription: 'Transcription', follow_up: 'Follow-up', scoring: 'Scoring' }

// One row of GET /candidates/{id}/audit -> a readable audit-trail entry (FR-13).
function describeAuditEvent(event) {
  const p = event.payload || {}
  const kind = AI_KIND_LABELS[p.kind] || 'AI'
  let detail
  if (event.event_type === 'CONSENT') {
    detail = `Consent recorded (version ${p.consent_version || 'v1'}).`
  } else if (event.event_type === 'TAB_OUT') {
    detail = `Left the interview tab${p.question_id ? ` during question ${p.question_id}` : ''}.`
  } else if (event.event_type === 'AI_REQUEST') {
    detail = `${kind} request sent to ${p.model || 'the AI model'}${p.attempt > 1 ? ` (retry ${p.attempt})` : ''}.`
  } else if (event.event_type === 'AI_RESPONSE' && p.kind === 'transcription') {
    if (p.error) detail = `Transcription failed: ${p.error}`
    else if (p.no_speech) detail = 'Transcription: no speech detected.'
    else detail = `Transcript received${p.duration_seconds ? ` (${Math.round(p.duration_seconds)}s of audio)` : ''}.`
  } else if (event.event_type === 'AI_RESPONSE' && p.kind === 'follow_up') {
    const fallback = p.source === 'fallback' ? ` (fallback question: ${p.reason || 'AI unavailable'})` : ''
    detail = `Follow-up question issued${fallback}: "${p.question}"`
  } else if (event.event_type === 'AI_RESPONSE' && p.kind === 'scoring') {
    detail = p.valid
      ? `Scorecard accepted (attempt ${p.attempt}).`
      : `Scorecard rejected (attempt ${p.attempt}): ${p.error || 'invalid reply'}`
  } else if (event.event_type === 'BUDGET_FREEZE') {
    detail = `AI paused: the $${p.ceiling_usd} monthly budget was reached.`
  } else {
    detail = JSON.stringify(p).slice(0, 200)
  }
  return {
    logId: event.log_id,
    type: event.event_type,
    time: new Date(event.created_at).toLocaleString(),
    detail,
  }
}

// GET /jobs/{id}/candidates row -> the shape the leaderboard renders.
function mapLiveCandidate(c, jobTitle) {
  const scored = c.aggregate_score !== null && c.aggregate_score !== undefined
  return {
    id: `live-${c.candidate_id}`,
    apiCandidateId: c.candidate_id,
    live: true,
    scored,
    name: c.name || c.email,
    role: jobTitle,
    aggregateScore: scored ? c.aggregate_score : 0,
    maxScore: 20,
    confidence: scored ? 'AI scored' : 'Awaiting AI',
    tabOuts: c.tab_out_count,
    status: c.needs_review ? 'Needs review' : scored ? 'Scored' : STATUS_LABELS[c.status] || c.status,
    review: c.needs_review,
    reviewReasons: c.review_reasons,
    completedAt: c.response_count
      ? `${c.response_count} answer${c.response_count === 1 ? '' : 's'} recorded`
      : 'No answers yet',
    responseCount: c.response_count,
    auditEvents: [],
    traits: scored && c.scores
      ? TRAIT_LABELS.map(([key, label]) => ({ label, score: c.scores[key], rationale: '' }))
      : [],
    transcripts: [],
  }
}

// GET /candidates/{id} -> the shape the detail drawer renders.
function mapLiveDetail(base, detail, audit) {
  const rationale = detail.score?.rationale || {}
  return {
    ...base,
    loading: false,
    traits: detail.score
      ? TRAIT_LABELS.map(([key, label]) => ({ label, score: detail.score[key], rationale: rationale[key] || '-' }))
      : [],
    transcripts: detail.responses.map((r) => ({
      responseId: `R-${r.response_id}`,
      type: r.type === 'follow_up' ? 'Follow-up' : 'Base question',
      duration: new Date(r.created_at).toLocaleString(),
      question: r.question_text || (r.type === 'follow_up' ? 'Follow-up question' : `Question ${r.question_id}`),
      text: r.transcript || (r.no_speech_flag
        ? 'No speech detected.'
        : 'Transcript not available yet - still processing, or transcription failed.'),
      audioPath: r.audio_url,
    })),
    auditEvents: audit?.events
      ? audit.events.map(describeAuditEvent)
      : [{
        type: 'TAB_OUT',
        time: `${detail.tab_out_count} logged`,
        detail: `${detail.tab_out_count} tab switch(es) recorded in the immutable audit trail.`,
      }],
  }
}

// Plays a backend recording. The audio route needs the recruiter's token, so the
// file is fetched with it and played from an in-memory object URL.
function AuthAudio({ path }) {
  const [src, setSrc] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let objectUrl = ''
    let cancelled = false
    fetchAudioUrl(path)
      .then((url) => {
        objectUrl = url
        if (cancelled) {
          URL.revokeObjectURL(url)
        } else {
          setSrc(url)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path])

  if (error) return <p className="invite-note error">{error}</p>
  if (!src) return <p className="invite-note">Loading recording...</p>
  return <audio controls src={src}>Audio preview unavailable.</audio>
}

function InterviewPageTabs({ activePage, onChange }) {
  return (
    <div className="interview-page-tabs" role="tablist" aria-label="AI Interview pages">
      {interviewPages.map((item) => (
        <button
          type="button"
          role="tab"
          aria-selected={activePage === item.id}
          className={activePage === item.id ? 'active' : ''}
          onClick={() => onChange(item.id)}
          key={item.id}
        >
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

// Recruiter invites a candidate by email (SRS-FR-04: candidates are invited,
// never self-registered). Uses the real jobs + invite endpoint on the backend.
function InviteCandidatePanel({ onInvited }) {
  const [jobs, setJobs] = useState([])
  const [jobId, setJobId] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const connected = hasSession()

  useEffect(() => {
    if (!connected) {
      return
    }
    listJobs()
      .then((data) => {
        const list = data.jobs || []
        setJobs(list)
        if (list.length) setJobId(String(list[0].job_id))
      })
      .catch((error) => setResult({ type: 'error', text: `Could not load jobs: ${error.message}` }))
  }, [connected])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!email.trim() || !jobId) {
      return
    }
    setSending(true)
    setResult(null)
    try {
      const res = await inviteCandidate(jobId, { email: email.trim(), name: name.trim() })
      setResult({
        type: 'success',
        text: `Invite sent to ${res.email}. They'll receive a one-time sign-in link by email.`,
      })
      setEmail('')
      setName('')
      onInvited?.()
    } catch (error) {
      setResult({ type: 'error', text: error.message })
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="invite-panel" aria-label="Invite a candidate">
      <div>
        <p className="eyebrow">SRS-FR-04</p>
        <h3>Invite a candidate</h3>
        <p>Candidates join by invitation: they get an email with a one-time sign-in link to start the interview.</p>
      </div>
      {connected ? (
        <form className="invite-form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="candidate@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-label="Candidate email"
            required
          />
          <input
            type="text"
            placeholder="Name (optional)"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Candidate name"
          />
          <select value={jobId} onChange={(event) => setJobId(event.target.value)} aria-label="Job">
            {jobs.map((job) => (
              <option key={job.job_id} value={job.job_id}>{job.job_id} - {job.title}</option>
            ))}
          </select>
          <button type="submit" className="company-secondary-button compact" disabled={sending || !jobId}>
            {sending ? 'Sending...' : 'Send invite'}
          </button>
        </form>
      ) : (
        <p className="invite-note">Sign in as a recruiter (magic link) to send invites.</p>
      )}
      {result ? (
        <p className={`invite-note ${result.type}`} role="status">
          {result.text}
        </p>
      ) : null}
    </section>
  )
}

function CandidateLeaderboardSection({ project, projects, rankedCandidates, selectedJobId, onJobChange, onReviewCandidate, onInvited }) {
  return (
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
      </header>

      <InviteCandidatePanel onInvited={onInvited} />

      <div className="leaderboard-toolbar">
        <label htmlFor="jobFilter">
          Job
          <select
            id="jobFilter"
            value={selectedJobId}
            onChange={(event) => onJobChange(event.target.value)}
          >
            {projects.map((item) => (
              <option value={item.jobId} key={item.jobId}>
                {item.jobId} - {item.title}
              </option>
            ))}
          </select>
        </label>
        <span><strong>{rankedCandidates.length}</strong> candidates for {project.title}</span>
      </div>

      <div className="leaderboard-table" role="table" aria-label="Ranked candidate leaderboard">
        <div className="leaderboard-head" role="row">
          <span role="columnheader">Rank</span>
          <span role="columnheader">Candidate</span>
          <span role="columnheader">Aggregate</span>
          <span role="columnheader">TAB_OUT</span>
          <span role="columnheader">Manual review</span>
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
            <span className="score-pill" role="cell">{formatAggregate(candidate)}</span>
            <span className="tabout-pill" role="cell">{candidate.tabOuts}</span>
            <span className={candidate.review ? 'review-chip danger' : 'review-chip'} role="cell">
              <Icon name={candidate.review ? 'flag' : 'check'} size={15} />
              {candidate.status}
            </span>
            <span className="completed-cell" role="cell">{candidate.completedAt}</span>
            <button type="button" className="company-secondary-button compact" onClick={() => onReviewCandidate(candidate)}>
              Review
            </button>
          </article>
        ))}
        {!rankedCandidates.length ? (
          <div className="leaderboard-empty" role="row">
            No candidates yet - invite one above, or clear the search.
          </div>
        ) : null}
      </div>
    </section>
  )
}

function ProjectOverviewSection({ project, rankedCandidates, needsReviewCount, onOpenCandidate }) {
  return (
    <section className="project-table-card">
      <header className="project-overview-header">
        <div>
          <p className="eyebrow">Project overview</p>
          <h2>Hiring project setup</h2>
        </div>
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
        </div>
        <div>
          <span className="status-chip success"><span className="online-dot" /> Active</span>
        </div>
        <div className="candidate-count">
          <strong>{project.candidates}</strong>
          <span className="new-chip">{Math.max(project.candidates - rankedCandidates.length, 0)} Pending</span>
        </div>
        <div className="assessment-list-compact">
          {project.assessments.map((item) => (
            <p key={item}><Icon name="play" size={15} /> {item}</p>
          ))}
        </div>
        <div className="candidate-count">
          <strong>{rankedCandidates.length}</strong>
          <span className="new-chip">{needsReviewCount} Review</span>
        </div>
        <button
          type="button"
          className="company-secondary-button compact row-open-button"
          onClick={() => onOpenCandidate(rankedCandidates[0])}
          disabled={!rankedCandidates.length}
        >
          Open
        </button>
      </article>
    </section>
  )
}

function CandidateDetailDrawer({ candidate, onClose }) {
  if (!candidate) {
    return null
  }

  const reviewReasons = candidate.review ? candidate.reviewReasons : ['No manual review thresholds crossed.']

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
            <p>{candidate.role} - aggregate {formatAggregate(candidate)}</p>
          </div>
        </header>

        <div className="drawer-summary-grid" aria-label="Candidate review summary">
          <article className="drawer-summary-card">
            <strong>{formatAggregate(candidate)}</strong>
            <span>Aggregate</span>
          </article>
          <article className="drawer-summary-card">
            <strong>{candidate.scored === false ? '-' : `${getScorePercent(candidate)}%`}</strong>
            <span>Score</span>
          </article>
          <article className="drawer-summary-card">
            <strong>{candidate.tabOuts}</strong>
            <span>TAB_OUT</span>
          </article>
          <article className="drawer-summary-card">
            <strong>{candidate.confidence}</strong>
            <span>Confidence</span>
          </article>
          <article className="drawer-summary-card">
            <strong>{candidate.responseCount ?? candidate.transcripts.length}</strong>
            <span>Audio</span>
          </article>
        </div>

        {candidate.review ? (
          <section className="review-reason">
            <Icon name="flag" />
            <div>
              <strong>Needs manual review</strong>
              {reviewReasons.map((reason) => (
                <span className="review-reason-chip" key={reason}>{formatReviewReason(reason)}</span>
              ))}
            </div>
          </section>
        ) : null}

        {!candidate.traits.length ? (
          <p className="invite-note">
            {candidate.reviewReasons?.includes('GRADING_FAILED')
              ? 'AI grading failed twice - listen to the recordings and score by hand.'
              : 'Not scored yet - scoring runs once the follow-up answer is transcribed.'}
          </p>
        ) : null}

        <section className="trait-grid" aria-label="Trait scores">
          {candidate.traits.map((trait) => (
            <article className="trait-card" key={trait.label}>
              <div className="trait-card-top">
                <span>{trait.label}</span>
                <strong>{trait.score}/5</strong>
              </div>
              <p><b>AI rationale</b> {trait.rationale}</p>
            </article>
          ))}
        </section>

        <section className="transcript-list">
          <h3>Full transcript and response audio</h3>
          {candidate.loading ? <p className="invite-note">Loading interview...</p> : null}
          {candidate.detailError ? <p className="invite-note error">{candidate.detailError}</p> : null}
          {!candidate.loading && !candidate.detailError && !candidate.transcripts.length ? (
            <p className="invite-note">No recorded answers yet.</p>
          ) : null}
          {candidate.transcripts.map((item, index) => (
            <article className="transcript-card" key={`${candidate.id}-${item.responseId}`}>
              <div className="transcript-card-meta">
                <span>{item.type}</span>
                <small>{item.responseId} - Response {index + 1} - {item.duration}</small>
              </div>
              <h4>{item.question}</h4>
              <p>{item.text}</p>
              <div className="response-audio">
                <Icon name="mic" size={16} />
                <span>Embedded audio player</span>
              </div>
              {item.audioPath ? (
                <AuthAudio path={item.audioPath} />
              ) : (
                <p className="invite-note">No recording for this answer.</p>
              )}
            </article>
          ))}
        </section>

        <section className="audit-trail-list">
          <h3>Immutable audit trail</h3>
          {!candidate.loading && !candidate.auditEvents.length ? (
            <p className="invite-note">No audit events recorded yet.</p>
          ) : null}
          {candidate.auditEvents.map((event, index) => (
            <article className="audit-trail-row" key={`${candidate.id}-${event.logId ?? index}`}>
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

function sortCandidates(list) {
  // Scored candidates high -> low, then everyone still waiting for the AI.
  return [...list].sort((first, second) => (second.scored === false ? -1 : second.aggregateScore)
    - (first.scored === false ? -1 : first.aggregateScore))
}

export default function CompanyDashboard({ user, onBackToLanding, onOpenLogin, onLogout }) {
  const [activeMenu, setActiveMenu] = useState('')
  const [activeInterviewPage, setActiveInterviewPage] = useState('dashboard')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [liveProjects, setLiveProjects] = useState([])
  const [liveLeaderboards, setLiveLeaderboards] = useState({})
  const [loadState, setLoadState] = useState({ loading: true, error: '' })
  const [reloadKey, setReloadKey] = useState(0)
  const [budget, setBudget] = useState(null)
  const signedIn = hasSession()
  const profile = user || { name: 'Recruiter', email: '' }
  const initial = (profile.name || 'R').charAt(0).toUpperCase()
  const project = liveProjects.find((item) => item.jobId === selectedJobId) || liveProjects[0] || null
  const rankedCandidates = project ? sortCandidates(liveLeaderboards[project.jobId] || []) : []
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const searchedCandidates = normalizedSearch
    ? rankedCandidates.filter((candidate) => [
      candidate.name,
      candidate.role,
      candidate.status,
      candidate.confidence,
      ...candidate.reviewReasons.map(formatReviewReason),
    ].some((value) => value.toLowerCase().includes(normalizedSearch)))
    : rankedCandidates
  const scoredCount = rankedCandidates.filter((candidate) => candidate.scored).length
  const needsReviewCount = rankedCandidates.filter((candidate) => candidate.review).length
  const totalTabOuts = rankedCandidates.reduce((sum, candidate) => sum + candidate.tabOuts, 0)
  const totalAudioResponses = rankedCandidates.reduce((sum, candidate) => sum + (candidate.responseCount || 0), 0)

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveMenu('')
        setSelectedCandidate(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // FR-14: jobs + every candidate, straight from the backend.
  useEffect(() => {
    if (!signedIn) {
      setLoadState({ loading: false, error: '' })
      return undefined
    }
    let cancelled = false
    setLoadState((current) => ({ ...current, loading: true, error: '' }))
    ;(async () => {
      try {
        const { jobs = [] } = await listJobs()
        const boards = {}
        const liveList = []
        for (const job of jobs) {
          const data = await listJobCandidates(job.job_id)
          const key = `JOB-${job.job_id}`
          boards[key] = data.candidates.map((c) => mapLiveCandidate(c, job.title))
          liveList.push({
            jobId: key,
            apiJobId: job.job_id,
            live: true,
            title: job.title,
            name: job.title,
            jobPost: job.title,
            candidates: job.candidate_count,
            assessments: [`AI Interview (${job.title})`],
          })
        }
        if (cancelled) return
        setLiveLeaderboards(boards)
        setLiveProjects(liveList)
        setSelectedJobId((current) => (liveList.some((item) => item.jobId === current) ? current : liveList[0]?.jobId || ''))
        setLoadState({ loading: false, error: '' })
      } catch (error) {
        if (!cancelled) setLoadState({ loading: false, error: error.message })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [signedIn, reloadKey])

  // FR-16: poll the budget so the "AI paused" banner appears without a reload.
  useEffect(() => {
    if (!signedIn) {
      return undefined
    }
    let cancelled = false
    const load = () => getBudgetStatus()
      .then((data) => { if (!cancelled) setBudget(data) })
      .catch(() => {})
    load()
    const intervalId = window.setInterval(load, 60000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [signedIn])

  const refresh = () => setReloadKey((key) => key + 1)

  const handleReviewCandidate = async (candidate) => {
    if (!candidate) {
      return
    }
    setSelectedCandidate({ ...candidate, loading: true })
    try {
      const [detail, audit] = await Promise.all([
        getCandidateDetail(candidate.apiCandidateId),
        getCandidateAudit(candidate.apiCandidateId).catch(() => null),
      ])
      setSelectedCandidate(mapLiveDetail(candidate, detail, audit))
    } catch (error) {
      setSelectedCandidate({ ...candidate, loading: false, detailError: error.message })
    }
  }

  const handleJobChange = (jobId) => {
    setSelectedJobId(jobId)
    setSelectedCandidate(null)
  }

  const openInterviewPage = (pageId) => {
    setActiveInterviewPage(pageId)
    setActiveMenu('')
  }

  const renderBody = () => {
    if (!signedIn) {
      return (
        <section className="dashboard-card">
          <p className="eyebrow">Sign in required</p>
          <h2>Recruiter access is by email sign-in link</h2>
          <p>Request a sign-in link with your recruiter email, then open it from your inbox.</p>
          <button type="button" className="company-primary-button" onClick={onOpenLogin}>Request sign-in link</button>
        </section>
      )
    }
    if (loadState.loading && !liveProjects.length) {
      return <section className="dashboard-card"><p>Loading jobs and candidates...</p></section>
    }
    if (loadState.error) {
      return (
        <section className="dashboard-card">
          <p className="eyebrow">Could not load the dashboard</p>
          <p className="invite-note error">{loadState.error}</p>
          <button type="button" className="company-secondary-button" onClick={refresh}>Try again</button>
        </section>
      )
    }
    if (!project) {
      return (
        <section className="dashboard-card">
          <h2>No jobs yet</h2>
          <p>Create the job and its questions with <code>python -m app.seed</code> in the backend, then refresh.</p>
        </section>
      )
    }

    return (
      <>
        {budget?.status === 'paused' ? (
          <div className="budget-banner" role="alert">
            <Icon name="flag" />
            <div>
              <strong>AI paused due to budget cap</strong>
              <span>
                Estimated spend ${Number(budget.estimated_spend_usd).toFixed(2)} has reached the
                ${Number(budget.ceiling_usd).toFixed(2)} monthly ceiling ({budget.month}). Interviews are still
                recorded, but transcription, follow-ups and scoring are paused until next month.
              </span>
            </div>
          </div>
        ) : null}

        <InterviewPageTabs activePage={activeInterviewPage} onChange={openInterviewPage} />

        {activeInterviewPage === 'dashboard' ? (
          <>
            <section className="recruiter-command-center" aria-label="Recruiter dashboard summary">
              <div className="budget-guard-card auth-session-card">
                <div className="auth-session-copy">
                  <p className="eyebrow">SRS-FR-04</p>
                  <h2>Signed-in recruiter session</h2>
                  <p>Verified by the server from your emailed sign-in link.</p>
                </div>
                <div>
                  <dl className="auth-session-list">
                    <div>
                      <dt>Method</dt>
                      <dd>Email magic link</dd>
                    </div>
                    <div>
                      <dt>Role</dt>
                      <dd>Recruiter</dd>
                    </div>
                    <div>
                      <dt>Signed in as</dt>
                      <dd>{profile.email || '-'}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="recruiter-metrics-grid">
                <RecruiterMetric label="Scorecards" value={scoredCount} detail="AI scored" icon="chart" />
                <RecruiterMetric label="Review" value={needsReviewCount} detail="Flagged" icon="flag" tone="warning" />
                <RecruiterMetric label="TAB_OUT" value={totalTabOuts} detail="Events" icon="shield" />
                <RecruiterMetric label="Audio" value={totalAudioResponses} detail="Answers" icon="mic" />
              </div>
            </section>

            <ProjectOverviewSection
              project={project}
              rankedCandidates={rankedCandidates}
              needsReviewCount={needsReviewCount}
              onOpenCandidate={handleReviewCandidate}
            />
          </>
        ) : null}

        {activeInterviewPage === 'candidates' ? (
          <CandidateLeaderboardSection
            project={project}
            projects={liveProjects}
            rankedCandidates={searchedCandidates}
            selectedJobId={project.jobId}
            onJobChange={handleJobChange}
            onReviewCandidate={handleReviewCandidate}
            onInvited={refresh}
          />
        ) : null}
      </>
    )
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
            className={activeMenu === 'interview' ? 'company-nav-button active' : 'company-nav-button current'}
            onClick={() => setActiveMenu((current) => (current === 'interview' ? '' : 'interview'))}
            aria-expanded={activeMenu === 'interview'}
          >
            AI Interview <Icon name="chevronDown" size={16} />
          </button>
        </nav>

        <div className="company-actions">
          <button
            type="button"
            className={activeMenu === 'profile' ? 'company-avatar active' : 'company-avatar'}
            aria-label="Recruiter profile"
            onClick={() => setActiveMenu((current) => (current === 'profile' ? '' : 'profile'))}
            aria-expanded={activeMenu === 'profile'}
          >
            {initial}
          </button>
        </div>
      </header>

      {activeMenu === 'interview' ? (
        <section className="company-dropdown interview-dropdown">
          {interviewPages.map((item) => (
            <DropdownRow
              item={item}
              isActive={activeInterviewPage === item.id}
              onClick={() => openInterviewPage(item.id)}
              key={item.id}
            />
          ))}
        </section>
      ) : null}

      {activeMenu === 'profile' ? (
        <section className="company-dropdown profile-dropdown">
          <div className="profile-popover-card">
            <span className="company-avatar inline">{initial}</span>
            <div>
              <strong>{profile.name}</strong>
              <p>{profile.email}</p>
            </div>
          </div>
          <button type="button" className="company-menu-row" onClick={onBackToLanding}>
            <span>Back to landing</span>
            <Icon name="arrowRight" size={16} />
          </button>
          {user ? (
            <button type="button" className="company-menu-row logout-action" onClick={onLogout}>
              <span>Log out</span>
              <Icon name="logout" size={16} />
            </button>
          ) : (
            <button type="button" className="company-menu-row" onClick={onOpenLogin}>
              <span>Log in</span>
              <Icon name="login" size={16} />
            </button>
          )}
        </section>
      ) : null}

      <section className="company-workspace">
        <div className="company-workspace-header">
          <div className="recruiter-title-block">
            <p className="eyebrow">Company page</p>
            <h1>
              Recruiter Dashboard {project ? <CountBadge>{project.jobId}</CountBadge> : null}
            </h1>
            <p>
              <strong>Magic-link access.</strong> Ranked scores, TAB_OUT flags, transcripts, and audio.
            </p>
          </div>

          {signedIn ? (
            <div className="company-workspace-actions">
              <label className="company-search" htmlFor="companySearch">
                <Icon name="search" />
                <input
                  id="companySearch"
                  type="search"
                  placeholder="Search candidates"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>
              <button type="button" className="company-secondary-button compact" onClick={refresh} disabled={loadState.loading}>
                {loadState.loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          ) : null}
        </div>

        {renderBody()}
      </section>

      <CandidateDetailDrawer candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} />
    </main>
  )
}
