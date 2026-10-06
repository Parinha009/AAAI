import { useEffect, useState } from 'react'
import {
  fetchAudioUrl,
  getBudgetStatus,
  getCandidateAudit,
  getCandidateDetail,
  setCandidateDecision,
  hasSession,
  inviteCandidate,
  listJobCandidates,
  listJobs,
} from '../api'
import Icon from '../components/Icon'
import RoleMismatch from '../components/RoleMismatch'

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

const DECISION_LABELS = { shortlisted: 'Shortlisted', rejected: 'Rejected' }

const AUDIT_TYPE_LABELS = {
  DECISION: 'Decision',
  CONSENT: 'Consent',
  TAB_OUT: 'Tab switch',
  AI_REQUEST: 'AI request',
  AI_RESPONSE: 'AI response',
  BUDGET_FREEZE: 'Budget pause',
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
  } else if (event.event_type === 'DECISION') {
    detail = p.decision
      ? `${DECISION_LABELS[p.decision] || p.decision} by ${p.by || 'a recruiter'}.`
      : `Decision cleared by ${p.by || 'a recruiter'}.`
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
    email: c.email,
    invitedBy: c.invited_by,
    decision: c.decision,
    decidedBy: c.decided_by,
    decidedAt: c.decided_at,
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
// Everything a recruiter might type to find a candidate: name, email, #id, status,
// score, review reasons (codes and readable text) and progress.
function candidateSearchText(candidate) {
  return [
    candidate.name,
    candidate.email,
    `#${candidate.apiCandidateId}`,
    candidate.attempt ? `interview ${candidate.attempt}` : '',
    candidate.decision || 'undecided',
    candidate.role,
    candidate.status,
    candidate.confidence,
    candidate.completedAt,
    candidate.scored ? `${candidate.aggregateScore}/${candidate.maxScore} ${candidate.aggregateScore}` : 'not scored',
    ...candidate.reviewReasons,
    ...candidate.reviewReasons.map(formatReviewReason),
  ].filter(Boolean).join(' ').toLowerCase()
}

// Every word must match somewhere (so "dara review" finds Dara if she is flagged).
function matchesSearch(candidate, query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const text = candidateSearchText(candidate)
  return terms.every((term) => text.includes(term))
}

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
function InviteCandidatePanel({ onInvited, defaultJobId }) {
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
        if (list.length) setJobId(String(defaultJobId || list[0].job_id))
      })
      .catch((error) => setResult({ type: 'error', text: `Could not load jobs: ${error.message}` }))
  }, [connected])

  // Invite into the hiring project the recruiter is looking at.
  useEffect(() => {
    if (defaultJobId) setJobId(String(defaultJobId))
  }, [defaultJobId])

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
        text: res.new_interview
          ? `New interview created for ${res.email} - their previous interview stays on the leaderboard. A new sign-in link is on its way.`
          : `Invite sent to ${res.email}. They'll receive a one-time sign-in link by email.`,
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
              <option key={job.job_id} value={job.job_id}>{job.title}</option>
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

function CandidateLeaderboardSection({
  project, rankedCandidates, onReviewCandidate, onInvited,
  searchQuery = '', totalCount = rankedCandidates.length, onClearSearch,
}) {
  const query = searchQuery.trim()
  return (
    <section className="recruiter-scoreboard">
      <header className="scoreboard-header">
        <div>
          <h2>Candidate leaderboard</h2>
          <p>Ranked by AI score. Open a candidate to read their answers, play the recordings and see any flags.</p>
        </div>
      </header>

      <InviteCandidatePanel onInvited={onInvited} defaultJobId={project.apiJobId} />

      <div className="leaderboard-toolbar">
        {query ? (
          <span className="search-summary">
            <strong>{rankedCandidates.length}</strong> of {totalCount} match &ldquo;{query}&rdquo;
            <button type="button" className="text-link" onClick={onClearSearch}>Clear search</button>
          </span>
        ) : (
          <span><strong>{totalCount}</strong> candidates for {project.title}</span>
        )}
      </div>

      <div className="leaderboard-table" role="table" aria-label="Ranked candidate leaderboard">
        <div className="leaderboard-head" role="row">
          <span role="columnheader">Rank</span>
          <span role="columnheader">Candidate</span>
          <span role="columnheader">Aggregate</span>
          <span role="columnheader">Tab switches</span>
          <span role="columnheader">Manual review</span>
          <span role="columnheader">Completed</span>
          <span role="columnheader">Action</span>
        </div>
        {rankedCandidates.map((candidate, index) => (
          <article className={candidate.review ? 'leaderboard-row flagged' : 'leaderboard-row'} role="row" key={candidate.id}>
            <span className="rank-number" role="cell">{candidate.rank ?? index + 1}</span>
            <div role="cell">
              <strong>{candidate.name}</strong>
              <p>
                {candidate.email && candidate.email !== candidate.name ? candidate.email : `#${candidate.apiCandidateId}`}
                {candidate.attempt ? ` - interview ${candidate.attempt} of ${candidate.attempts}` : ''}
              </p>
              {candidate.decision ? (
                <span className={`decision-badge ${candidate.decision}`}>{DECISION_LABELS[candidate.decision]}</span>
              ) : null}
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
            {query ? (
              <>
                No candidates match &ldquo;{query}&rdquo;.{' '}
                <button type="button" className="text-link" onClick={onClearSearch}>Clear search</button>
              </>
            ) : 'No candidates yet - invite one above.'}
          </div>
        ) : null}
      </div>
    </section>
  )
}

// Every hiring project (job) with its real counts. "Open" switches to that job's candidates.
function ProjectOverviewSection({ projects, boards, selectedJobId, onOpenProject }) {
  return (
    <section className="project-table-card">
      <header className="project-overview-header">
        <div>
          <h2>Hiring projects</h2>
        </div>
        <span>{projects.length} active</span>
      </header>
      <div className="project-table-head">
        <span>Hiring project</span>
        <span>Status</span>
        <span>Candidates</span>
        <span>Assessments</span>
        <span>Assessed candidates</span>
        <span>Action</span>
      </div>

      {projects.map((item) => {
        const list = boards[item.jobId] || []
        const scored = list.filter((candidate) => candidate.scored).length
        const review = list.filter((candidate) => candidate.review).length
        return (
          <article className={item.jobId === selectedJobId ? 'project-row selected' : 'project-row'} key={item.jobId}>
            <div>
              <h2>{item.name}</h2>
            </div>
            <div>
              <span className="status-chip success"><span className="online-dot" /> Active</span>
            </div>
            <div className="candidate-count">
              <strong>{list.length}</strong>
              <span className="new-chip">{list.length - scored} Awaiting AI</span>
            </div>
            <div className="assessment-list-compact">
              {item.assessments.map((assessment) => (
                <p key={assessment}><Icon name="play" size={15} /> {assessment}</p>
              ))}
              <small>Random questions per interview</small>
            </div>
            <div className="candidate-count">
              <strong>{scored}</strong>
              <span className="new-chip">{review} Review</span>
            </div>
            <button
              type="button"
              className="company-secondary-button compact row-open-button"
              onClick={() => onOpenProject(item.jobId)}
            >
              Open
            </button>
          </article>
        )
      })}
    </section>
  )
}

function CandidateDetailDrawer({ candidate, onClose, onDecide, deciding }) {
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
            <h2 id="candidate-detail-title">{candidate.name}</h2>
            <p>{candidate.role} - aggregate {formatAggregate(candidate)}</p>
          </div>
        </header>

        <section className="decision-panel" aria-label="Your decision">
          <div>
            <strong>Your decision</strong>
            <p>
              {candidate.decision
                ? `${DECISION_LABELS[candidate.decision]}${candidate.decidedBy ? ` by ${candidate.decidedBy}` : ''}${candidate.decidedAt ? ` - ${new Date(candidate.decidedAt).toLocaleString()}` : ''}`
                : 'Not decided yet. The AI score is a suggestion - the decision is yours.'}
            </p>
            {candidate.invitedBy ? <small>Invited by {candidate.invitedBy}</small> : null}
            {candidate.decisionError ? <small className="decision-error">{candidate.decisionError}</small> : null}
          </div>
          <div className="decision-actions">
            <button
              type="button"
              className={candidate.decision === 'shortlisted' ? 'decision-button shortlist active' : 'decision-button shortlist'}
              onClick={() => onDecide(candidate, 'shortlisted')}
              disabled={deciding || candidate.decision === 'shortlisted'}
            >
              <Icon name="check" size={16} /> Shortlist
            </button>
            <button
              type="button"
              className={candidate.decision === 'rejected' ? 'decision-button reject active' : 'decision-button reject'}
              onClick={() => onDecide(candidate, 'rejected')}
              disabled={deciding || candidate.decision === 'rejected'}
            >
              <Icon name="close" size={16} /> Reject
            </button>
            {candidate.decision ? (
              <button type="button" className="text-link" onClick={() => onDecide(candidate, null)} disabled={deciding}>
                Clear decision
              </button>
            ) : null}
          </div>
        </section>

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
            <span>Tab switches</span>
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
              : 'Not scored yet - scoring runs once the candidate submits and every answer is transcribed.'}
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
              <span>{AUDIT_TYPE_LABELS[event.type] || event.type}</span>
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

// Someone re-invited after finishing has several interviews (one row each). Number
// them oldest-first so the recruiter can tell "Interview 1" from "Interview 2".
function labelRepeatInterviews(list) {
  const byEmail = {}
  list.forEach((candidate) => {
    (byEmail[candidate.email] ||= []).push(candidate)
  })
  return list.map((candidate) => {
    const attempts = byEmail[candidate.email].slice().sort((a, b) => a.apiCandidateId - b.apiCandidateId)
    if (attempts.length < 2) return candidate
    return { ...candidate, attempt: attempts.indexOf(candidate) + 1, attempts: attempts.length }
  })
}

function sortCandidates(list) {
  // Scored candidates high -> low, then everyone still waiting for the AI. The rank is
  // stored on each row so a filtered search still shows each candidate's true position.
  return [...list]
    .sort((first, second) => (second.scored === false ? -1 : second.aggregateScore)
      - (first.scored === false ? -1 : first.aggregateScore))
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }))
}

export default function CompanyDashboard({
  user, onBackToLanding, onOpenLogin, onLogout, sessionRole, onOpenOwnDashboard, onSwitchAccount,
}) {
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
  const [deciding, setDeciding] = useState(false)
  const signedIn = hasSession()
  const [forbidden, setForbidden] = useState(false) // server said 403: not a recruiter session
  const roleMismatch = signedIn && sessionRole && sessionRole !== 'company' // e.g. a candidate session
  const wrongRole = roleMismatch || forbidden
  const profile = user || { name: 'Recruiter', email: '' }
  const initial = (profile.name || 'R').charAt(0).toUpperCase()
  const project = liveProjects.find((item) => item.jobId === selectedJobId) || liveProjects[0] || null
  const rankedCandidates = project ? sortCandidates(liveLeaderboards[project.jobId] || []) : []
  const searchedCandidates = rankedCandidates.filter((candidate) => matchesSearch(candidate, searchQuery))
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
    if (!signedIn || roleMismatch) {
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
          boards[key] = labelRepeatInterviews(data.candidates.map((c) => mapLiveCandidate(c, job.title)))
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
        if (cancelled) return
        if (error.status === 403) {
          setForbidden(true)
          setLoadState({ loading: false, error: '' })
        } else {
          setLoadState({ loading: false, error: error.message })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [signedIn, roleMismatch, reloadKey])

  // FR-16: poll the budget so the "AI paused" banner appears without a reload.
  useEffect(() => {
    if (!signedIn || wrongRole) {
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
  }, [signedIn, wrongRole])

  const refresh = () => setReloadKey((key) => key + 1)

  const handleSearchChange = (value) => {
    setSearchQuery(value)
    if (value.trim() && activeInterviewPage !== 'candidates') {
      setActiveInterviewPage('candidates')
    }
  }

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

  // Record the recruiter's decision, then reload the drawer (incl. audit trail) and list.
  const handleDecide = async (candidate, decision) => {
    setDeciding(true)
    try {
      const res = await setCandidateDecision(candidate.apiCandidateId, decision)
      const updated = {
        ...candidate,
        decision: res.decision,
        decidedBy: res.decided_by,
        decidedAt: res.decided_at,
        decisionError: '',
      }
      setLiveLeaderboards((boards) => Object.fromEntries(Object.entries(boards).map(([key, list]) => [
        key,
        list.map((item) => (item.apiCandidateId === updated.apiCandidateId
          ? { ...item, decision: updated.decision, decidedBy: updated.decidedBy, decidedAt: updated.decidedAt }
          : item)),
      ])))
      await handleReviewCandidate(updated)
    } catch (error) {
      setSelectedCandidate((current) => (current ? { ...current, decisionError: `Could not save: ${error.message}` } : current))
    } finally {
      setDeciding(false)
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
    if (wrongRole) {
      return (
        <RoleMismatch
          sessionRole={sessionRole && sessionRole !== 'company' ? sessionRole : 'candidate'}
          pageRole="company"
          onOpenOwnDashboard={onOpenOwnDashboard}
          onSwitchAccount={onSwitchAccount}
        />
      )
    }
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
                recorded, but transcription and scoring are paused until next month.
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
                <RecruiterMetric label="Tab switches" value={totalTabOuts} detail="Logged" icon="shield" />
                <RecruiterMetric label="Audio" value={totalAudioResponses} detail="Answers" icon="mic" />
              </div>
            </section>

            <ProjectOverviewSection
              projects={liveProjects}
              boards={liveLeaderboards}
              selectedJobId={project.jobId}
              onOpenProject={(jobId) => {
                handleJobChange(jobId)
                openInterviewPage('candidates')
              }}
            />
          </>
        ) : null}

        {activeInterviewPage === 'candidates' ? (
          <CandidateLeaderboardSection
            project={project}
            rankedCandidates={searchedCandidates}
            onReviewCandidate={handleReviewCandidate}
            onInvited={refresh}
            searchQuery={searchQuery}
            totalCount={rankedCandidates.length}
            onClearSearch={() => setSearchQuery('')}
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
            <h1>Recruiter Dashboard</h1>
            <p>Review AI-scored interviews, recordings and flags for each hiring project.</p>
          </div>

          {signedIn && !wrongRole ? (
            <div className="company-workspace-actions">
              {liveProjects.length > 1 && project ? (
                <label className="company-job-select" htmlFor="headerJob">
                  <span>Hiring project</span>
                  <select id="headerJob" value={project.jobId} onChange={(event) => handleJobChange(event.target.value)}>
                    {liveProjects.map((item) => (
                      <option value={item.jobId} key={item.jobId}>{item.title}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="company-search" htmlFor="companySearch">
                <Icon name="search" />
                <input
                  id="companySearch"
                  type="search"
                  placeholder="Search name, email, #id, status, score"
                  aria-label="Search candidates"
                  value={searchQuery}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.stopPropagation()
                      setSearchQuery('')
                    }
                  }}
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

      <CandidateDetailDrawer
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        onDecide={handleDecide}
        deciding={deciding}
      />
    </main>
  )
}
