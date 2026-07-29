import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon'

const navItems = [
  { id: 'intro', label: 'Private Introduction', icon: 'card' },
  { id: 'cv', label: 'CV Evaluation', icon: 'document' },
  { id: 'applied', label: 'Applied Jobs', icon: 'clipboard' },
]

const appliedJobs = [
  { role: 'Product Designer', company: 'InnovateCo', applied: 'Jul 15, 2026', status: 'Under Review', tone: 'warning' },
  { role: 'UX Researcher', company: 'DataViz Inc', applied: 'Jul 10, 2026', status: 'Interview Scheduled', tone: 'info' },
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

const INTRO_RECORD_LIMIT_SECONDS = 300
const INTRO_EVIDENCE_DB = 'aaai-introduction-evidence'
const INTRO_EVIDENCE_STORE = 'evidence'

const formatRecordedAt = (dateValue) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(dateValue))

const getRecorderMimeType = () => {
  if (typeof window === 'undefined' || !window.MediaRecorder?.isTypeSupported) {
    return ''
  }

  return [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
  ].find((type) => window.MediaRecorder.isTypeSupported(type)) || ''
}

const getRecordingExtension = (mimeType) => (mimeType.includes('mp4') ? 'mp4' : 'webm')

const openIntroEvidenceDatabase = () => new Promise((resolve, reject) => {
  if (typeof window === 'undefined' || !window.indexedDB) {
    resolve(null)
    return
  }

  const request = window.indexedDB.open(INTRO_EVIDENCE_DB, 1)

  request.onupgradeneeded = () => {
    const database = request.result

    if (!database.objectStoreNames.contains(INTRO_EVIDENCE_STORE)) {
      database.createObjectStore(INTRO_EVIDENCE_STORE, { keyPath: 'id' })
    }
  }

  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const loadIntroEvidence = async (id) => {
  const database = await openIntroEvidenceDatabase()

  if (!database) {
    return null
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(INTRO_EVIDENCE_STORE, 'readonly')
    const request = transaction.objectStore(INTRO_EVIDENCE_STORE).get(id)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => {
      database.close()
      reject(transaction.error)
    }
  })
}

const saveIntroEvidence = async (id, evidence) => {
  const database = await openIntroEvidenceDatabase()

  if (!database) {
    return false
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(INTRO_EVIDENCE_STORE, 'readwrite')
    const request = transaction.objectStore(INTRO_EVIDENCE_STORE).put({ id, ...evidence })

    request.onsuccess = () => resolve(true)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => {
      database.close()
      reject(transaction.error)
    }
  })
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

function PrivateIntroductionRecorder({ candidateName, candidateKey }) {
  const [isRecording, setIsRecording] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [recordedVideoUrl, setRecordedVideoUrl] = useState('')
  const [recordedDuration, setRecordedDuration] = useState(0)
  const [recordedAt, setRecordedAt] = useState('')
  const [recordedMimeType, setRecordedMimeType] = useState('video/webm')
  const [isPreviewReady, setIsPreviewReady] = useState(false)
  const [recorderStatus, setRecorderStatus] = useState('No introduction evidence recorded yet.')
  const [recorderError, setRecorderError] = useState('')
  const previewRef = useRef(null)
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const elapsedSecondsRef = useRef(0)
  const recordedVideoUrlRef = useRef('')
  const stopReasonRef = useRef('manual')
  const mountedRef = useRef(true)
  const hasRecording = Boolean(recordedVideoUrl)
  const remainingSeconds = Math.max(INTRO_RECORD_LIMIT_SECONDS - elapsedSeconds, 0)
  const downloadName = `private-introduction-${candidateName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'candidate'}.${getRecordingExtension(recordedMimeType)}`

  const setRecordedEvidenceUrl = (url) => {
    if (recordedVideoUrlRef.current) {
      window.URL.revokeObjectURL(recordedVideoUrlRef.current)
    }

    recordedVideoUrlRef.current = url
    setRecordedVideoUrl(url)
  }

  const stopActiveStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (previewRef.current) {
      previewRef.current.srcObject = null
    }

    setIsPreviewReady(false)
  }

  const stopIntroductionRecording = (reason = 'manual') => {
    stopReasonRef.current = reason

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
      return
    }

    stopActiveStream()
    setIsRecording(false)
  }

  useEffect(() => () => {
    mountedRef.current = false

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }

    stopActiveStream()

    if (recordedVideoUrlRef.current) {
      window.URL.revokeObjectURL(recordedVideoUrlRef.current)
    }
  }, [])

  useEffect(() => {
    let isCurrent = true

    const loadSavedEvidence = async () => {
      setRecordedEvidenceUrl('')
      setRecordedDuration(0)
      setRecordedAt('')
      setRecordedMimeType('video/webm')
      setRecorderStatus('No introduction evidence recorded yet.')

      try {
        const evidence = await loadIntroEvidence(candidateKey)

        if (!isCurrent || !evidence?.blob) {
          return
        }

        const videoUrl = window.URL.createObjectURL(evidence.blob)
        setRecordedEvidenceUrl(videoUrl)
        setRecordedDuration(evidence.duration || 0)
        setRecordedAt(evidence.recordedAt || '')
        setRecordedMimeType(evidence.mimeType || evidence.blob.type || 'video/webm')
        setRecorderStatus('Saved introduction evidence loaded from this browser.')
      } catch {
        if (isCurrent) {
          setRecorderStatus('No introduction evidence recorded yet.')
        }
      }
    }

    loadSavedEvidence()

    return () => {
      isCurrent = false
    }
  }, [candidateKey])

  useEffect(() => {
    if (isRecording && previewRef.current && streamRef.current) {
      previewRef.current.srcObject = streamRef.current
      previewRef.current.play().catch(() => undefined)
    }
  }, [isRecording])

  useEffect(() => {
    if (!isRecording) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setElapsedSeconds((current) => {
        const next = Math.min(current + 1, INTRO_RECORD_LIMIT_SECONDS)
        elapsedSecondsRef.current = next

        if (next >= INTRO_RECORD_LIMIT_SECONDS) {
          window.clearInterval(intervalId)
          stopIntroductionRecording('limit')
        }

        return next
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [isRecording])

  const startIntroductionRecording = async () => {
    setRecorderError('')
    setIsPreviewReady(false)

    if (isRecording) {
      return
    }

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setRecorderError('Video recording is not supported in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      const hasLiveVideo = stream.getVideoTracks().some((track) => track.readyState === 'live')

      if (!hasLiveVideo) {
        stream.getTracks().forEach((track) => track.stop())
        setRecorderError('No live camera video was detected. Please allow camera access and try again.')
        return
      }

      const mimeType = getRecorderMimeType()
      const mediaRecorder = new window.MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      chunksRef.current = []
      elapsedSecondsRef.current = 0
      stopReasonRef.current = 'manual'
      streamRef.current = stream
      recorderRef.current = mediaRecorder

      if (previewRef.current) {
        previewRef.current.srcObject = stream
        previewRef.current.play().catch(() => undefined)
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const duration = Math.min(elapsedSecondsRef.current, INTRO_RECORD_LIMIT_SECONDS)
        const blobType = mediaRecorder.mimeType || chunksRef.current[0]?.type || mimeType || 'video/webm'
        const evidenceBlob = new Blob(chunksRef.current, { type: blobType })
        const reachedLimit = stopReasonRef.current === 'limit'

        chunksRef.current = []
        recorderRef.current = null
        stopActiveStream()

        if (!mountedRef.current) {
          return
        }

        setIsRecording(false)

        if (!evidenceBlob.size) {
          setRecorderError('No video data was captured. Please try recording again.')
          return
        }

        if (!evidenceBlob.type.startsWith('video/')) {
          setRecorderError('Only audio was captured. Please enable your camera and record again.')
          return
        }

        const videoUrl = window.URL.createObjectURL(evidenceBlob)
        const recordedAtValue = new Date().toISOString()

        setRecordedEvidenceUrl(videoUrl)
        setRecordedDuration(duration)
        setRecordedAt(recordedAtValue)
        setRecordedMimeType(evidenceBlob.type)
        setRecorderStatus(
          reachedLimit
            ? 'You have reached the 5-minute recording limit. Your introduction evidence has been saved.'
            : 'Introduction evidence saved. You can review or download it anytime from this browser.'
        )

        try {
          await saveIntroEvidence(candidateKey, {
            blob: evidenceBlob,
            candidateName,
            duration,
            mimeType: evidenceBlob.type,
            recordedAt: recordedAtValue,
          })

          if (mountedRef.current && !reachedLimit) {
            setRecorderStatus('Introduction evidence saved locally. You can review or download it anytime from this browser.')
          }
        } catch {
          if (mountedRef.current) {
            setRecorderStatus(
              reachedLimit
                ? 'You have reached the 5-minute recording limit. Your evidence is saved for this session.'
                : 'Introduction evidence saved for this session. Download it to keep a copy.'
            )
          }
        }
      }

      mediaRecorder.start(1000)
      setElapsedSeconds(0)
      setRecorderStatus('Recording your private introduction...')
      setIsRecording(true)
    } catch (error) {
      stopActiveStream()

      if (error?.name === 'NotAllowedError') {
        setRecorderError('Camera and microphone permission is needed to record your introduction.')
        return
      }

      setRecorderError('Could not start video recording. Check your camera and microphone and try again.')
    }
  }

  return (
    <section className="intro-recorder" aria-label="Private introduction video evidence">
      <header className="intro-recorder-head">
        <div>
          <span>Introduction evidence</span>
          <h3>Recorded video statement</h3>
        </div>
        <strong className={isRecording ? 'record-limit-pill active' : 'record-limit-pill'}>
          <Icon name="clock" size={16} />
          {isRecording ? `${formatTime(remainingSeconds)} left` : '5:00 limit'}
        </strong>
      </header>

      <div className={isRecording ? 'intro-video-frame recording' : 'intro-video-frame'}>
        <video
          ref={previewRef}
          className={isRecording ? 'intro-live-video active' : 'intro-live-video'}
          autoPlay
          muted
          playsInline
          onCanPlay={() => setIsPreviewReady(true)}
          onLoadedMetadata={() => previewRef.current?.play().catch(() => undefined)}
        />
        {!isRecording && hasRecording ? (
          <video className="intro-playback-video" src={recordedVideoUrl} controls playsInline />
        ) : null}
        {!isRecording && !hasRecording ? (
          <div className="intro-video-empty">
            <Icon name="mic" size={30} />
            <span>No video evidence recorded</span>
          </div>
        ) : null}
        {isRecording && !isPreviewReady ? (
          <div className="intro-video-empty intro-video-loading">
            <Icon name="mic" size={30} />
            <span>Starting camera preview...</span>
          </div>
        ) : null}
      </div>

      <div className="intro-recorder-actions">
        <button
          type="button"
          className={isRecording ? 'soft-button record-stop-button' : 'solid-button'}
          onClick={isRecording ? () => stopIntroductionRecording() : startIntroductionRecording}
        >
          <Icon name={isRecording ? 'stop' : 'mic'} />
          {isRecording ? 'Stop and save' : 'Record introduction'}
        </button>
        {hasRecording && !isRecording ? (
          <a className="soft-button intro-download-button" href={recordedVideoUrl} download={downloadName}>
            <Icon name="document" />
            Download evidence
          </a>
        ) : null}
      </div>

      <p className={recorderError ? 'intro-recorder-status error' : 'intro-recorder-status'} aria-live="polite">
        {recorderError || recorderStatus}
      </p>

      {hasRecording && !isRecording ? (
        <dl className="intro-evidence-meta">
          <div>
            <dt>Duration</dt>
            <dd>{formatTime(recordedDuration)}</dd>
          </div>
          <div>
            <dt>Recorded</dt>
            <dd>{recordedAt ? formatRecordedAt(recordedAt) : 'Just now'}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  )
}

export default function CandidateDashboard({ user, onOpenLogin, onOpenSignup, onBackToLanding }) {
  const [activeView, setActiveView] = useState('intro')
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
            <PrivateIntroductionRecorder candidateName={firstName} candidateKey={profile.email} />
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
