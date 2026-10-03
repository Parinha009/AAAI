import { useEffect, useRef, useState } from 'react'
import { getQuestions, hasSession, postConsent, postTabOut, uploadResponse } from '../api'
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

const initialNotifications = [
  {
    id: 'profile-viewed',
    dot: 'blue',
    title: 'Your profile was viewed by TechCorp Asia',
    message: 'TechCorp Asia opened your private introduction and CV summary. Your contact details remain private until you choose to respond.',
    time: '2 hours ago',
    unread: true,
  },
  {
    id: 'frontend-match',
    dot: 'green',
    title: 'New job match: Frontend Developer',
    message: 'A Frontend Developer role matches your profile preferences. Review the match from Applied Jobs or keep your profile updated for stronger recommendations.',
    time: '5 hours ago',
    unread: true,
  },
]

const BASE_ROUND_SECONDS = 300
const FOLLOW_UP_SECONDS = 150
const PROCESSING_DELAY_MS = 900

const mockBaseQuestions = [
  {
    id: 1,
    type: 'base',
    prompt: 'Tell us about a project where you had to debug a difficult problem. What was your approach?',
  },
  {
    id: 2,
    type: 'base',
    prompt: 'How would you explain what an API is to a non-technical teammate?',
  },
  {
    id: 3,
    type: 'base',
    prompt: 'Describe a time you had to learn a new technology quickly.',
  },
  {
    id: 4,
    type: 'base',
    prompt: 'Tell us about a tradeoff you made between speed, quality, and user experience.',
  },
  {
    id: 5,
    type: 'base',
    prompt: 'How do you handle feedback when a teammate disagrees with your approach?',
  },
]

const mockFollowUpQuestion = {
  id: 0,
  type: 'follow_up',
  prompt: 'You mentioned debugging under uncertainty. How would you approach the same issue if it only happened in production?',
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

// Audio-only formats the backend accepts (FR-02 / FR-06): webm (Chrome/Firefox), mp4 (Safari).
const getAudioMimeType = () => {
  if (typeof window === 'undefined' || !window.MediaRecorder?.isTypeSupported) {
    return ''
  }

  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => window.MediaRecorder.isTypeSupported(type)) || ''
}

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
  const [baseSeconds, setBaseSeconds] = useState(BASE_ROUND_SECONDS)
  const [followUpSeconds, setFollowUpSeconds] = useState(FOLLOW_UP_SECONDS)
  const [currentBaseIndex, setCurrentBaseIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [responses, setResponses] = useState([])
  const [tabOutCount, setTabOutCount] = useState(0)
  const [processingTarget, setProcessingTarget] = useState(null)
  // Backend wiring: real questions + whether we're talking to the server.
  const [baseQuestions, setBaseQuestions] = useState(mockBaseQuestions)
  const [apiMode, setApiMode] = useState(false)
  const [apiNotice, setApiNotice] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  // Real microphone recording (FR-02).
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const pendingBlobRef = useRef(null)
  const apiModeRef = useRef(false)
  const questionIdRef = useRef(null)
  const isTimedStage = stage === 'base' || stage === 'follow_up'
  const activeQuestion = stage === 'follow_up' ? mockFollowUpQuestion : baseQuestions[currentBaseIndex]
  const activeSeconds = stage === 'follow_up' ? followUpSeconds : baseSeconds
  const answeredCurrentQuestion = responses.some((response) => response.questionId === activeQuestion?.id)

  useEffect(() => {
    if (!isTimedStage) {
      return undefined
    }

    const preventShortcut = (event) => event.preventDefault()
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabOutCount((current) => current + 1)
        // FR-12: log to the backend's immutable audit trail (fire-and-forget).
        if (apiModeRef.current) {
          postTabOut(questionIdRef.current)
        }
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
    if (stage !== 'base') {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setBaseSeconds((current) => Math.max(current - 1, 0))
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [stage])

  useEffect(() => {
    if (stage !== 'follow_up') {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setFollowUpSeconds((current) => Math.max(current - 1, 0))
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [stage])

  useEffect(() => {
    if (stage === 'base' && baseSeconds === 0) {
      submitCurrentAnswer('timer')
    }
  }, [baseSeconds, stage])

  useEffect(() => {
    if (stage === 'follow_up' && followUpSeconds === 0) {
      submitCurrentAnswer('timer')
    }
  }, [followUpSeconds, stage])

  useEffect(() => {
    if (stage !== 'processing' || !processingTarget) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      if (processingTarget.nextStage === 'next_base') {
        setCurrentBaseIndex((current) => Math.min(current + 1, baseQuestions.length - 1))
        setStage('base')
      } else if (processingTarget.nextStage === 'follow_up') {
        setFollowUpSeconds(FOLLOW_UP_SECONDS)
        setStage('follow_up')
      } else {
        releaseMic()
        setStage('completed')
      }

      setProcessingTarget(null)
    }, PROCESSING_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [processingTarget, stage])

  const beginProcessing = (message, nextStage, options = {}) => {
    setIsRecording(Boolean(options.keepRecording))
    setProcessingTarget({ message, nextStage, keepRecording: Boolean(options.keepRecording) })
    setStage('processing')
  }

  // Keep refs in sync so the tab-out listener always sees current values.
  useEffect(() => {
    apiModeRef.current = apiMode
    questionIdRef.current = activeQuestion?.id ?? null
  }, [apiMode, activeQuestion])

  // Release the microphone if the workspace closes mid-interview.
  useEffect(() => () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  // --- Real microphone recording (FR-02) ------------------------------------
  const releaseMic = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const startRecording = async () => {
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      const mimeType = getAudioMimeType()
      const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      pendingBlobRef.current = null // a new take replaces the previous one
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }
      recorder.start()
      recorderRef.current = recorder
      setIsRecording(true)
    } catch (error) {
      setApiNotice(`Microphone unavailable: ${error.message}`)
      setIsRecording(false)
    }
  }

  // Stops the recorder and resolves with the recorded Blob (or null).
  const stopRecording = () => new Promise((resolve) => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      resolve(null)
      return
    }
    recorder.onstop = () => {
      const blob = chunksRef.current.length
        ? new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        : null
      chunksRef.current = []
      recorderRef.current = null
      resolve(blob)
    }
    recorder.stop()
  })

  // --- Consent + questions from the backend (FR-01 / FR-05) ----------------
  const beginBaseRound = async () => {
    setIsStarting(true)
    setApiNotice('')
    let questions = mockBaseQuestions
    let connected = false

    if (hasSession()) {
      try {
        await postConsent()
        const data = await getQuestions()
        if (data?.questions?.length) {
          questions = data.questions.map((q) => ({ id: q.question_id, type: 'base', prompt: q.text }))
          connected = true
        }
      } catch (error) {
        setApiNotice(`Server unavailable (${error.message}) — running the offline demo.`)
      }
    } else {
      setApiNotice('Not signed in to the server — running the offline demo.')
    }

    setBaseQuestions(questions)
    setApiMode(connected)
    setIsStarting(false)
    setStage('base')
    setBaseSeconds(BASE_ROUND_SECONDS)
    setFollowUpSeconds(FOLLOW_UP_SECONDS)
    setCurrentBaseIndex(0)
    setIsRecording(false)
    setResponses([])
    setProcessingTarget(null)
  }

  const updateResponse = (questionId, transcript, responseId) => {
    setResponses((current) => current.map((response) => (
      response.questionId === questionId ? { ...response, transcript, responseId } : response
    )))
  }

  // --- Save one answer: stop recording + upload the audio (FR-06) ----------
  const saveResponse = async (question, reason = 'manual', { keepRecording = false } = {}) => {
    let blob = pendingBlobRef.current
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      blob = await stopRecording()
    }
    pendingBlobRef.current = null
    setIsRecording(false)

    const alreadySaved = responses.some((response) => response.questionId === question.id)
    if (!blob && alreadySaved) {
      // Nothing new recorded — keep the earlier saved answer.
      if (keepRecording) startRecording()
      return
    }

    let note
    if (!blob) {
      note = reason === 'timer' ? 'Time ended before any audio was recorded.' : 'No audio recorded for this answer.'
    } else if (!apiMode) {
      note = 'Recorded locally (offline demo — not sent to the server).'
    } else {
      note = 'Uploading audio to the server...'
    }

    setResponses((current) => [
      ...current.filter((response) => response.questionId !== question.id),
      { questionId: question.id, type: question.type, transcript: note },
    ])

    if (blob && apiMode) {
      uploadResponse({ questionId: question.id, type: question.type, blob })
        .then((res) => updateResponse(question.id, `Uploaded — server status: ${res.status}.`, res.response_id))
        .catch((error) => updateResponse(question.id, `Upload failed: ${error.message}`))
    }

    if (keepRecording) {
      startRecording()
    }
  }

  const submitCurrentAnswer = async (reason = 'manual') => {
    if (!activeQuestion) {
      return
    }

    await saveResponse(activeQuestion, reason)

    if (stage === 'base') {
      if (currentBaseIndex < baseQuestions.length - 1 && baseSeconds > 0) {
        beginProcessing('Processing your answer before the next question...', 'next_base')
        return
      }

      beginProcessing('Processing your base responses and preparing a follow-up...', 'follow_up')
      return
    }

    beginProcessing('Processing your follow-up and finalizing your interview...', 'completed')
  }

  const toggleRecording = async () => {
    if (!isTimedStage || activeSeconds === 0 || stage === 'processing') {
      return
    }

    if (isRecording) {
      pendingBlobRef.current = await stopRecording()
      setIsRecording(false)
      return
    }

    await startRecording()
  }

  const goToPreviousQuestion = async () => {
    if (stage !== 'base' || currentBaseIndex === 0) {
      return
    }

    const keep = isRecording
    await saveResponse(activeQuestion, 'manual', { keepRecording: keep })
    setCurrentBaseIndex((current) => Math.max(current - 1, 0))
  }

  const goToNextQuestion = async () => {
    if (activeSeconds === 0) {
      return
    }

    const keep = isRecording

    if (stage === 'base') {
      await saveResponse(activeQuestion, 'manual', { keepRecording: keep })

      if (currentBaseIndex < baseQuestions.length - 1) {
        beginProcessing('Processing your answer before the next question...', 'next_base', { keepRecording: keep })
        return
      }

      beginProcessing('Processing your base responses and preparing a follow-up...', 'follow_up', { keepRecording: keep })
      return
    }

    if (stage === 'follow_up') {
      await saveResponse(activeQuestion, 'manual')
      beginProcessing('Processing your follow-up and finalizing your interview...', 'completed')
    }
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
          {stage !== 'consent' ? (
            <span>{apiMode ? 'Connected to server' : 'Offline demo'}</span>
          ) : null}
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
            <button type="button" className="solid-button" disabled={!consentAccepted || isStarting} onClick={beginBaseRound}>
              {isStarting ? 'Connecting...' : 'Continue to interview'}
            </button>
          </>
        ) : null}

        {apiNotice ? <p className="recording-status" role="status">{apiNotice}</p> : null}

        {stage === 'base' || stage === 'follow_up' ? (
          <>
            <div className="interview-panel-head">
              <span>
                {stage === 'follow_up'
                  ? 'Follow-up question - 2:30'
                  : `Base question ${currentBaseIndex + 1} of ${baseQuestions.length}`}
              </span>
              <strong><Icon name="clock" /> {formatTime(activeSeconds)}</strong>
            </div>
            <h1 id="interview-title" className="interview-question-title">{activeQuestion.prompt}</h1>
            <p className="interview-question-helper">
              {stage === 'follow_up'
                ? 'Answer the generated follow-up within the 2:30 window.'
                : 'Answer naturally. The base round uses one shared five-minute timer across all base questions.'}
            </p>
            <div className={isRecording ? 'recording-orb active' : 'recording-orb'} aria-hidden="true">
              <Icon name="mic" size={34} />
            </div>
            <p className="recording-status" aria-live="polite">
              {activeSeconds === 0
                ? 'Time is up. Your answer is being processed.'
                : isRecording
                  ? 'Recording in progress.'
                  : answeredCurrentQuestion
                    ? 'Answer saved. Continue when you are ready.'
                    : 'Ready when you are.'}
            </p>
            {isRecording ? (
              <div className="recording-action-note" role="status">
                <Icon name="stop" size={18} />
                <span>Recording now. You can move <strong>Back</strong> or <strong>Next</strong> while the session keeps recording.</span>
              </div>
            ) : null}
            <div className="interview-actions">
              {stage === 'base' ? (
                <button
                  type="button"
                  className="soft-button question-nav-button"
                  onClick={goToPreviousQuestion}
                  disabled={currentBaseIndex === 0}
                >
                  <Icon name="arrowRight" className="flip-icon" />
                  Back
                </button>
              ) : null}
              <button
                type="button"
                className="solid-button record-only-button"
                onClick={toggleRecording}
                disabled={activeSeconds === 0}
              >
                <Icon name={isRecording ? 'stop' : 'mic'} />
                {isRecording ? 'Stop recording' : answeredCurrentQuestion ? 'Record again' : 'Record answer'}
              </button>
              <button
                type="button"
                className="soft-button question-nav-button"
                onClick={goToNextQuestion}
                disabled={activeSeconds === 0}
              >
                {stage === 'follow_up'
                  ? 'Finish'
                  : currentBaseIndex === baseQuestions.length - 1
                    ? 'Follow-up'
                    : 'Next'}
                <Icon name="arrowRight" />
              </button>
            </div>
          </>
        ) : null}

        {stage === 'processing' ? (
          <div className="interview-processing" aria-live="polite">
            <span className="button-spinner" aria-hidden="true" />
            <p className="eyebrow">Processing...</p>
            <h1 id="interview-title">{processingTarget?.message || 'Processing your response...'}</h1>
            <p>Please keep this tab open. The next step will appear automatically.</p>
          </div>
        ) : null}

        {stage === 'completed' ? (
          <div className="interview-complete">
            <span className="complete-mark" aria-hidden="true">
              <Icon name="check" size={34} />
            </span>
            <p className="eyebrow">Interview complete</p>
            <h1 id="interview-title">
              Thank you,
              <span className="completion-name">{candidateName}.</span>
            </h1>
            <p>
              Your base answers and follow-up response have been submitted. The recruiter dashboard will show the
              transcript, scoring rationale, TAB_OUT count, and audio playback when processing finishes.
            </p>
            <dl className="interview-complete-summary">
              <div>
                <dt>Base answers</dt>
                <dd>{responses.filter((response) => response.type === 'base').length}</dd>
              </div>
              <div>
                <dt>Follow-up</dt>
                <dd>{responses.some((response) => response.type === 'follow_up') ? 'Submitted' : 'Skipped'}</dd>
              </div>
              <div>
                <dt>Tab outs</dt>
                <dd>{tabOutCount}</dd>
              </div>
            </dl>
            <button type="button" className="solid-button" onClick={onClose}>
              Return to dashboard
            </button>
          </div>
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

function PrivateIntroductionRecorder({ candidateName, candidateKey, onStartQuestions }) {
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
    <section className={isRecording || hasRecording ? 'intro-recorder has-media' : 'intro-recorder'} aria-label="Private introduction video evidence">
      <header className="intro-recorder-head">
        <span className="sidebar-card-icon intro-recorder-icon" aria-hidden="true">
          <Icon name="mic" />
        </span>
        <div>
          <span>Private intro</span>
          <h3>Record a short introduction</h3>
          <p>Use this as your reusable first impression when a company is a strong match.</p>
        </div>
        <strong className={isRecording ? 'record-limit-pill active' : 'record-limit-pill'}>
          <Icon name="clock" size={16} />
          {isRecording ? `${formatTime(remainingSeconds)} left` : '5:00 limit'}
        </strong>
      </header>

      {isRecording || hasRecording ? (
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
          {isRecording && !isPreviewReady ? (
            <div className="intro-video-empty intro-video-loading">
              <Icon name="mic" size={30} />
              <span>Starting camera preview...</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {!isRecording && !hasRecording ? (
        <div className="intro-recorder-note">
          <span>
            <Icon name="shield" size={18} />
          </span>
          <div>
            <strong>Private until matched</strong>
            <p>Recruiters only see this after your preferences and role goals line up.</p>
          </div>
        </div>
      ) : null}

      <div className="intro-recorder-actions">
        <button
          type="button"
          className={isRecording ? 'soft-button record-stop-button' : 'solid-button'}
          onClick={isRecording ? () => stopIntroductionRecording() : onStartQuestions}
        >
          <Icon name={isRecording ? 'stop' : 'mic'} />
          {isRecording ? 'Stop and save' : 'Start recording'}
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

export default function CandidateDashboard({ user, onOpenLogin, onOpenSignup, onBackToLanding, onLogout }) {
  const [activeView, setActiveView] = useState('intro')
  const [isPracticeOpen, setIsPracticeOpen] = useState(false)
  const [isInterviewOpen, setIsInterviewOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [notificationItems, setNotificationItems] = useState(initialNotifications)
  const [selectedNotificationId, setSelectedNotificationId] = useState('')
  const profile = user || { name: 'Ben', email: 'ben@gmail.com' }
  const firstName = profile.name.split(' ')[0] || 'Ben'
  const initial = firstName.charAt(0).toUpperCase()
  const unreadNotificationCount = notificationItems.filter((item) => item.unread).length
  const selectedNotification = notificationItems.find((item) => item.id === selectedNotificationId)

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
  const handleOpenNotification = (id) => {
    setSelectedNotificationId(id)
    setNotificationItems((current) => current.map((item) => (
      item.id === id ? { ...item, unread: false } : item
    )))
  }
  const handleMarkAllNotificationsRead = () => {
    setNotificationItems((current) => current.map((item) => ({ ...item, unread: false })))
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
              <span>Private intro</span>
            </div>
            <h2>Record a short introduction for matched companies.</h2>
            <p>
              Create one reusable first impression for recruiters to review after your preferences and role goals
              line up.
            </p>
            <ul>
              <li><strong>Record once</strong> and reuse it for matched hiring teams</li>
              <li><strong>Stay private</strong> until your preferences and role goals line up</li>
              <li><strong>Update anytime</strong> before a recruiter reviews your profile</li>
            </ul>
            <PrivateIntroductionRecorder
              candidateName={firstName}
              candidateKey={profile.email}
              onStartQuestions={startInterview}
            />
          </div>
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
              {unreadNotificationCount ? <span className="action-badge">{unreadNotificationCount}</span> : null}
            </button>
            {isNotificationsOpen ? (
              <section className="notifications-popover" aria-label="Notifications">
                <div className="notifications-head">
                  <h2>Notifications</h2>
                  <span>{unreadNotificationCount} unread</span>
                </div>
                {notificationItems.map((item) => (
                  <button
                    type="button"
                    className={item.unread ? 'notification-item unread' : 'notification-item'}
                    onClick={() => handleOpenNotification(item.id)}
                    key={item.id}
                  >
                    <span className={item.unread ? `notification-dot ${item.dot}` : 'notification-dot read'} />
                    <div>
                      <p>{item.title}</p>
                      <small>{item.time}</small>
                    </div>
                  </button>
                ))}
                {selectedNotification ? (
                  <article className="notification-detail" aria-live="polite">
                    <strong>{selectedNotification.title}</strong>
                    <p>{selectedNotification.message}</p>
                    <small>{selectedNotification.time}</small>
                  </article>
                ) : null}
                <button type="button" className="popover-link" onClick={handleMarkAllNotificationsRead}>
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
                {user ? (
                  <button type="button" className="logout-action" onClick={onLogout}>
                    <span className="menu-icon" aria-hidden="true">
                      <Icon name="logout" />
                    </span>
                    Log out
                  </button>
                ) : (
                  <>
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
                  </>
                )}
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
            <button type="button" className="solid-button full-width" onClick={() => startInterview()}>
              Start practicing
            </button>
          </section>
        </div>
      ) : null}

      {isInterviewOpen ? (
        <InterviewWorkspace
          candidateName={firstName}
          onClose={() => {
            setIsInterviewOpen(false)
          }}
        />
      ) : null}
    </main>
  )
}
