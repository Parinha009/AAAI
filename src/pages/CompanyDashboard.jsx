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

const menuPanels = {
  projects: [
    { label: 'All Hiring Projects', count: 1, status: 'active' },
    { label: 'Archived Projects', status: 'archived' },
    { label: 'Draft Projects', status: 'draft' },
  ],
  interview: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'sets', label: 'AI Interview Sets', count: 1 },
    { id: 'candidates', label: 'AI Interview Candidates', count: 1 },
  ],
}

const projects = [
  {
    jobId: 'JOB-AAAI-FE-2026-07',
    title: 'Frontend Engineer',
    name: 'Demo - Frontend Engineer',
    jobPost: 'Frontend Engineer',
    date: '28 Jul 2026',
    candidates: 4,
    assessments: [
      'Demo - AI Interview (Frontend Engineer)',
      'Demo - CV Eval (Frontend Engineer)',
    ],
  },
  {
    jobId: 'JOB-AAAI-MO-2026-08',
    title: 'Marketing & Operation',
    name: 'Demo - Marketing & Operation',
    jobPost: 'Marketing & Operation',
    date: '2 Aug 2026',
    candidates: 3,
    assessments: [
      'Demo - AI Interview (Marketing and Operation)',
      'Demo - CV Eval (Marketing and Operation)',
    ],
  },
]

const authSession = {
  method: 'Email magic link',
  role: 'Recruiter',
  scope: 'Recruiter dashboard only',
  status: 'Authenticated',
}

const audioPreviewSrc = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='

const candidateLeaderboards = {
  'JOB-AAAI-FE-2026-07': [
    {
      id: 'maya-chen',
      name: 'Maya Chen',
      role: 'Frontend Engineer',
      aggregateScore: 18,
      maxScore: 20,
      confidence: 'High',
      tabOuts: 0,
      status: 'Shortlist',
      review: false,
      reviewReasons: [],
      completedAt: '28 Jul 2026, 10:42 AM',
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
          responseId: 'R-5001',
          type: 'Base question',
          duration: '1:18',
          question: 'Walk us through a difficult technical problem.',
          text: 'I started by reproducing the issue in a narrow environment, then checked state updates against the network response before changing the component boundary.',
          audioSrc: audioPreviewSrc,
        },
        {
          responseId: 'R-5004',
          type: 'Follow-up',
          duration: '0:52',
          question: 'What signal would you inspect first?',
          text: 'I would inspect the request lifecycle and compare expected state transitions with what the UI renders after each response.',
          audioSrc: audioPreviewSrc,
        },
      ],
    },
    {
      id: 'rin-sok',
      name: 'Rin Sok',
      role: 'Frontend Engineer',
      aggregateScore: 15,
      maxScore: 20,
      confidence: 'Medium',
      tabOuts: 2,
      status: 'Needs Review',
      review: true,
      reviewReasons: ['HIGH_TAB_OUT'],
      completedAt: '28 Jul 2026, 11:16 AM',
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
          responseId: 'R-5010',
          type: 'Base question',
          duration: '1:04',
          question: 'How do you explain tradeoffs?',
          text: 'I first clarify the customer impact and then show which pieces can safely move later without hiding risk from the team.',
          audioSrc: audioPreviewSrc,
        },
        {
          responseId: 'R-5014',
          type: 'Follow-up',
          duration: '0:47',
          question: 'What would you inspect first?',
          text: 'I would check where users lose confidence and compare that with the handoff points between design and engineering.',
          audioSrc: audioPreviewSrc,
        },
      ],
    },
    {
      id: 'dara-lim',
      name: 'Dara Lim',
      role: 'React Engineer',
      aggregateScore: 12,
      maxScore: 20,
      confidence: 'Low',
      tabOuts: 1,
      status: 'Needs Review',
      review: true,
      reviewReasons: ['LOW_COMMUNICATION', 'TEMPLATED_LANGUAGE'],
      completedAt: '28 Jul 2026, 1:05 PM',
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
          responseId: 'R-5022',
          type: 'Base question',
          duration: '0:59',
          question: 'Tell us about debugging with limited information.',
          text: 'Furthermore, I would analyze the problem. In conclusion, the solution requires careful problem solving and teamwork.',
          audioSrc: audioPreviewSrc,
        },
        {
          responseId: 'R-5027',
          type: 'Follow-up',
          duration: '0:43',
          question: 'What signal would you inspect first?',
          text: 'I would inspect logs, metrics, and user feedback, then apply the best practice solution.',
          audioSrc: audioPreviewSrc,
        },
      ],
    },
  ],
  'JOB-AAAI-MO-2026-08': [
    {
      id: 'nita-vong',
      name: 'Nita Vong',
      role: 'Marketing & Operation',
      aggregateScore: 17,
      maxScore: 20,
      confidence: 'High',
      tabOuts: 0,
      status: 'Shortlist',
      review: false,
      reviewReasons: [],
      completedAt: '2 Aug 2026, 9:48 AM',
      auditEvents: [
        { type: 'WHISPER_RESPONSE', time: '9:38 AM', detail: 'Two responses transcribed successfully.' },
        { type: 'GPT_SCORECARD', time: '9:48 AM', detail: 'Marketing and operation scorecard persisted.' },
      ],
      traits: [
        { label: 'Technical Skill', score: 4, rationale: 'Connected campaign tooling, CRM handoffs, and weekly reporting clearly.' },
        { label: 'Communication', score: 5, rationale: 'Answers were concise, audience-aware, and supported with specific examples.' },
        { label: 'Problem Solving', score: 4, rationale: 'Prioritized root cause, owner, and timeline before suggesting process changes.' },
        { label: 'Job Fit', score: 4, rationale: 'Strong match for coordinating marketing operations across small teams.' },
      ],
      transcripts: [
        {
          responseId: 'R-6101',
          type: 'Base question',
          duration: '1:11',
          question: 'Describe a time you improved an operations workflow.',
          text: 'I mapped the repeated handoff delays, moved campaign assets into one tracker, and set weekly owner checks so nobody waited for missing approvals.',
          audioSrc: audioPreviewSrc,
        },
        {
          responseId: 'R-6106',
          type: 'Follow-up',
          duration: '0:49',
          question: 'How did you measure whether the change worked?',
          text: 'I compared launch readiness, late approval count, and campaign turnaround time for the next three cycles.',
          audioSrc: audioPreviewSrc,
        },
      ],
    },
    {
      id: 'sok-pisey',
      name: 'Sok Pisey',
      role: 'Marketing & Operation',
      aggregateScore: 11,
      maxScore: 20,
      confidence: 'Medium',
      tabOuts: 4,
      status: 'Needs Review',
      review: true,
      reviewReasons: ['HIGH_TAB_OUT', 'LOW_COMMUNICATION'],
      completedAt: '2 Aug 2026, 10:32 AM',
      auditEvents: [
        { type: 'TAB_OUT', time: '10:21 AM', detail: 'Candidate left the recording tab four times across two responses.' },
        { type: 'GPT_SCORECARD', time: '10:32 AM', detail: 'Manual review flag added from high TAB_OUT and low communication score.' },
      ],
      traits: [
        { label: 'Technical Skill', score: 3, rationale: 'Mentioned tools and reporting cadence but gave limited evidence of ownership.' },
        { label: 'Communication', score: 2, rationale: 'Responses were fragmented and required manual review against the audio.' },
        { label: 'Problem Solving', score: 3, rationale: 'Identified bottlenecks but did not fully explain the corrective process.' },
        { label: 'Job Fit', score: 3, rationale: 'Possible fit after recruiter checks the flagged session details.' },
      ],
      transcripts: [
        {
          responseId: 'R-6120',
          type: 'Base question',
          duration: '0:58',
          question: 'Describe a campaign coordination challenge.',
          text: 'The campaign had many parts. I checked the files and talked to people, then we completed the launch.',
          audioSrc: audioPreviewSrc,
        },
        {
          responseId: 'R-6125',
          type: 'Follow-up',
          duration: '0:41',
          question: 'What would you change next time?',
          text: 'I would plan earlier and make sure everyone knows what to do before the deadline.',
          audioSrc: audioPreviewSrc,
        },
      ],
    },
  ],
}

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

function ProfileRequiredModal({ organizationName, error, onBack, onChange, onContinue }) {
  return (
    <div className="company-modal-backdrop" role="presentation">
      <section className="company-profile-modal" role="dialog" aria-modal="true" aria-labelledby="company-profile-title">
        <button type="button" className="company-modal-back-button" onClick={onBack}>
          <Icon name="arrowRight" size={16} />
          Back to recruiter login
        </button>

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

function NewProjectModal({ jobTitle, projectName, onJobTitleChange, onProjectNameChange, onClose, onContinue }) {
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
          <button type="button" className="company-primary-button" onClick={onContinue} disabled={!canContinue}>
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

function makeProjectName(title) {
  return title.trim() ? `${title.trim()} - Project` : ''
}

function makeJobId(title) {
  const slug = title
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 18) || 'NEW-ROLE'

  return `JOB-AAAI-${slug}-DRAFT`
}

function InterviewPageTabs({ activePage, onChange }) {
  return (
    <div className="interview-page-tabs" role="tablist" aria-label="AI Interview pages">
      {menuPanels.interview.map((item) => (
        <button
          type="button"
          role="tab"
          aria-selected={activePage === item.id}
          className={activePage === item.id ? 'active' : ''}
          onClick={() => onChange(item.id)}
          key={item.id}
        >
          <span>{item.label}</span>
          {item.count ? <CountBadge>{item.count}</CountBadge> : null}
        </button>
      ))}
    </div>
  )
}

// Recruiter invites a candidate by email (SRS-FR-04: candidates are invited,
// never self-registered). Uses the real jobs + invite endpoint on the backend.
function InviteCandidatePanel() {
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

function CandidateLeaderboardSection({ project, projects, rankedCandidates, selectedJobId, onJobChange, onReviewCandidate }) {
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

      <InviteCandidatePanel />

      <div className="leaderboard-toolbar">
        <label htmlFor="jobFilter">
          Job_ID
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
        <span><strong>{rankedCandidates.length}</strong> ranked candidates for {project.jobId}</span>
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
            No candidates match this search.
          </div>
        ) : null}
      </div>
    </section>
  )
}

function InterviewSetsView({ project, rankedCandidates, needsReviewCount, onOpenCandidates }) {
  const setCards = [
    {
      title: 'AI Interview Set',
      type: 'Async interview',
      status: 'Live',
      prompts: 2,
      detail: 'Base question plus AI follow-up responses.',
    },
    {
      title: 'CV Evaluation Set',
      type: 'Document screen',
      status: 'Live',
      prompts: 1,
      detail: 'CV scoring is paired with interview scorecards.',
    },
  ]

  return (
    <section className="interview-sets-page" aria-label="AI Interview Sets">
      <header className="company-section-header">
        <div>
          <p className="eyebrow">AI Interview Sets</p>
          <h2>{project.title}</h2>
          <p>Job_ID: {project.jobId}</p>
        </div>
        <button type="button" className="company-primary-button compact-action" onClick={onOpenCandidates}>
          View candidates
        </button>
      </header>

      <div className="interview-set-grid">
        {setCards.map((set, index) => (
          <article className="interview-set-card" key={set.title}>
            <div className="interview-set-icon">
              <Icon name={index === 0 ? 'mic' : 'chart'} />
            </div>
            <div>
              <span className="status-chip success"><span className="online-dot" /> {set.status}</span>
              <h3>{set.title}</h3>
              <p>{set.detail}</p>
            </div>
            <dl>
              <div>
                <dt>Type</dt>
                <dd>{set.type}</dd>
              </div>
              <div>
                <dt>Prompts</dt>
                <dd>{set.prompts}</dd>
              </div>
              <div>
                <dt>Scorecards</dt>
                <dd>{rankedCandidates.length}</dd>
              </div>
              <div>
                <dt>Review</dt>
                <dd>{needsReviewCount}</dd>
              </div>
            </dl>
          </article>
        ))}
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
          <span className="new-chip">{Math.max(project.candidates - rankedCandidates.length, 0)} Pending</span>
        </div>
        <div className="assessment-list-compact">
          {project.assessments.map((item) => (
            <p key={item}><Icon name="play" size={15} /> {item}</p>
          ))}
          <small>+1 more</small>
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
              ) : item.audioSrc ? (
                <audio controls src={item.audioSrc}>
                  Audio preview unavailable.
                </audio>
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

export default function CompanyDashboard({ user, onBackToLanding, onOpenLogin, onLogout }) {
  const [activeMenu, setActiveMenu] = useState('')
  const [activeInterviewPage, setActiveInterviewPage] = useState('dashboard')
  const [projectStatus, setProjectStatus] = useState('active')
  const [selectedJobId, setSelectedJobId] = useState(projects[0].jobId)
  const [customProjects, setCustomProjects] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [organizationError, setOrganizationError] = useState('')
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(true)
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [liveProjects, setLiveProjects] = useState([])
  const [liveLeaderboards, setLiveLeaderboards] = useState({})
  const [budget, setBudget] = useState(null)
  const [jobTitle, setJobTitle] = useState('')
  const [projectName, setProjectName] = useState('')
  const profile = user || { name: 'Ben', email: 'ben@gmail.com' }
  const initial = (profile.name || 'B').charAt(0).toUpperCase()
  const organizationLabel = organizationName.trim() || 'KIT'
  // Connected to the server: show only real jobs. Offline: the demo projects.
  const visibleProjects = liveProjects.length
    ? [...liveProjects, ...customProjects]
    : [...projects, ...customProjects]
  const project = visibleProjects.find((item) => item.jobId === selectedJobId) || visibleProjects[0]
  const rankedCandidates = [...(liveLeaderboards[project.jobId] || candidateLeaderboards[project.jobId] || [])]
    .sort((first, second) => (second.scored === false ? -1 : second.aggregateScore)
      - (first.scored === false ? -1 : first.aggregateScore))
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
  const needsReviewCount = rankedCandidates.filter((candidate) => candidate.review).length
  const totalTabOuts = rankedCandidates.reduce((sum, candidate) => sum + candidate.tabOuts, 0)
  const totalAudioResponses = rankedCandidates.reduce(
    (sum, candidate) => sum + (candidate.responseCount ?? candidate.transcripts.length),
    0,
  )
  const activeProjectCount = visibleProjects.length

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

  // Signed in as a recruiter: load real jobs + candidates. Mock data stays as the fallback.
  useEffect(() => {
    if (!hasSession()) {
      return undefined
    }
    let cancelled = false
    ;(async () => {
      try {
        const { jobs = [] } = await listJobs()
        const boards = {}
        const liveList = []
        for (const job of jobs) {
          const data = await listJobCandidates(job.job_id)
          const key = `LIVE-${job.job_id}`
          boards[key] = data.candidates.map((c) => mapLiveCandidate(c, job.title))
          liveList.push({
            jobId: key,
            apiJobId: job.job_id,
            live: true,
            title: job.title,
            name: `${job.title} (live)`,
            jobPost: job.title,
            date: 'Live',
            candidates: job.candidate_count,
            assessments: [`AI Interview (${job.title})`],
          })
        }
        if (cancelled) return
        setLiveLeaderboards(boards)
        setLiveProjects(liveList)
        if (liveList.length) setSelectedJobId(liveList[0].jobId)
      } catch {
        // Not a recruiter session or server down: keep the demo data.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // FR-16: poll the budget so the "AI paused" banner appears without a reload.
  useEffect(() => {
    if (!hasSession()) {
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
  }, [])

  const handleReviewCandidate = async (candidate) => {
    if (!candidate.live) {
      setSelectedCandidate(candidate)
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

  const handleOrganizationContinue = () => {
    if (!organizationName.trim()) {
      setOrganizationError('Organization name is required')
      return
    }

    setOrganizationError('')
    setIsProfileModalOpen(false)
  }

  const handleJobTitleChange = (value) => {
    const previousAutoName = makeProjectName(jobTitle)
    setJobTitle(value)
    setProjectName((current) => (!current.trim() || current === previousAutoName ? makeProjectName(value) : current))
  }

  const handleJobChange = (jobId) => {
    setSelectedJobId(jobId)
    setSelectedCandidate(null)
  }

  const openInterviewPage = (pageId) => {
    setActiveInterviewPage(pageId)
    setProjectStatus('active')
    setActiveMenu('')
  }

  const handleCreateProject = () => {
    if (!jobTitle.trim() || !projectName.trim()) {
      return
    }

    const newProject = {
      jobId: makeJobId(jobTitle),
      title: jobTitle.trim(),
      name: projectName.trim(),
      jobPost: jobTitle.trim(),
      date: 'Draft',
      candidates: 0,
      assessments: [
        `AI Interview (${jobTitle.trim()})`,
        `CV Eval (${jobTitle.trim()})`,
      ],
    }

    setCustomProjects((current) => {
      const nextProject = current.some((item) => item.jobId === newProject.jobId)
        ? { ...newProject, jobId: `${newProject.jobId}-${current.length + 1}` }
        : newProject

      setSelectedJobId(nextProject.jobId)
      return [...current, nextProject]
    })
    setProjectStatus('active')
    setActiveInterviewPage('sets')
    setJobTitle('')
    setProjectName('')
    setIsNewProjectOpen(false)
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
            aria-expanded={activeMenu === 'projects'}
          >
            Hiring Projects <Icon name="chevronDown" size={16} />
          </button>
          <button
            type="button"
            className={activeMenu === 'interview' ? 'company-nav-button active' : 'company-nav-button'}
            onClick={() => setActiveMenu((current) => (current === 'interview' ? '' : 'interview'))}
            aria-expanded={activeMenu === 'interview'}
          >
            AI Interview <Icon name="chevronDown" size={16} />
          </button>
        </nav>

        <div className="company-actions">
          <button
            type="button"
            className={activeMenu === 'organization' ? 'organization-button active' : 'organization-button'}
            onClick={() => setActiveMenu((current) => (current === 'organization' ? '' : 'organization'))}
            aria-expanded={activeMenu === 'organization'}
          >
            <Icon name="company" size={18} />
            {organizationLabel}
            <Icon name="chevronDown" size={15} />
          </button>
          <span className="language-button static" aria-label="Language: English">
            <Icon name="language" size={18} />
            English
          </span>
          <button
            type="button"
            className={activeMenu === 'notifications' ? 'company-icon-button active' : 'company-icon-button'}
            aria-label="Notifications"
            onClick={() => setActiveMenu((current) => (current === 'notifications' ? '' : 'notifications'))}
            aria-expanded={activeMenu === 'notifications'}
          >
            <Icon name="bell" />
          </button>
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
              {item.status === 'active' ? <CountBadge>{activeProjectCount}</CountBadge> : null}
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
            <DropdownRow
              item={item}
              isActive={activeInterviewPage === item.id}
              onClick={() => openInterviewPage(item.id)}
              key={item.id}
            />
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

      {activeMenu === 'notifications' ? (
        <section className="company-dropdown notification-dropdown">
          <div className="topbar-popover-head">
            <strong>Notifications</strong>
          </div>
          <button type="button" className="company-menu-row">
            <span>Manual review email sent to {profile.email}</span>
            <Icon name="flag" size={16} />
          </button>
          <button type="button" className="company-menu-row">
            <span>New scorecard notification emailed to {profile.email}</span>
            <Icon name="chart" size={16} />
          </button>
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
          <button type="button" className="company-menu-row">
            <span>Account settings</span>
          </button>
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
              Recruiter Dashboard <CountBadge>{project.jobId}</CountBadge>
            </h1>
            <p>
              <strong>Magic-link access.</strong> Ranked scores, TAB_OUT flags, transcripts, and audio.
            </p>
          </div>

          <div className="project-tabs" role="tablist" aria-label="Project status">
            {[
              ['active', `Active (${activeProjectCount})`],
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
            <button type="button" className="company-icon-button dark" onClick={() => setIsNewProjectOpen(true)} aria-label="New hiring project">
              <Icon name="plus" />
            </button>
          </div>
        </div>

        {projectStatus === 'active' ? (
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
                    <RecruiterMetric label="Audio" value={totalAudioResponses} detail="Files" icon="mic" />
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

            {activeInterviewPage === 'sets' ? (
              <InterviewSetsView
                project={project}
                rankedCandidates={rankedCandidates}
                needsReviewCount={needsReviewCount}
                onOpenCandidates={() => openInterviewPage('candidates')}
              />
            ) : null}

            {activeInterviewPage === 'candidates' ? (
              <CandidateLeaderboardSection
                project={project}
                projects={visibleProjects}
                rankedCandidates={searchedCandidates}
                selectedJobId={selectedJobId}
                onJobChange={handleJobChange}
                onReviewCandidate={handleReviewCandidate}
              />
            ) : null}
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
          onBack={onOpenLogin || onBackToLanding}
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
          onContinue={handleCreateProject}
        />
      ) : null}

      <CandidateDetailDrawer candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} />
    </main>
  )
}
