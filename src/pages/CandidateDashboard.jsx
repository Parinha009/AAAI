import { useEffect, useRef, useState } from 'react'
import {
  finishInterview,
  getInterviewStatus,
  getQuestions,
  hasSession,
  postConsent,
  postTabOut,
  uploadResponse,
} from '../api'
import Icon from '../components/Icon'
import RoleMismatch from '../components/RoleMismatch'

const DEFAULT_QUESTION_SECONDS = 120 // 2:00 per question; the server sends the real value
const PROCESSING_DELAY_MS = 900

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

// Audio-only formats the backend accepts (FR-02 / FR-06): webm (Chrome/Firefox), mp4 (Safari).
const getAudioMimeType = () => {
  if (typeof window === 'undefined' || !window.MediaRecorder?.isTypeSupported) {
    return ''
  }

  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => window.MediaRecorder.isTypeSupported(type)) || ''
}

// Speech is roughly -20 to -30 dBFS; a mic that only hears room hiss sits near -50.
// Above this RMS (about -34 dBFS) we treat the candidate as audible.
const HEARD_RMS = 0.02

// Live microphone loudness (RMS, 0..1) for a stream, via the Web Audio API.
// Updates ~10x a second so the meter moves without re-rendering every frame.
function useMicLevel(stream) {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    if (!stream) {
      setLevel(0)
      return undefined
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) {
      return undefined
    }
    const ctx = new AudioCtx()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)
    const data = new Float32Array(analyser.fftSize)
    let frame = 0
    let last = 0
    const tick = (now) => {
      if (now - last > 100) {
        last = now
        analyser.getFloatTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i += 1) sum += data[i] * data[i]
        setLevel(Math.sqrt(sum / data.length))
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frame)
      source.disconnect()
      ctx.close()
    }
  }, [stream])

  return level
}

// RMS -> 0..100 for the meter (-60 dBFS empty, -15 dBFS full).
const levelPercent = (rms) => {
  if (!rms) return 0
  const db = 20 * Math.log10(rms)
  return Math.max(0, Math.min(100, ((db + 60) / 45) * 100))
}

function MicMeter({ level, small = false }) {
  return (
    <div className={small ? 'mic-meter small' : 'mic-meter'} aria-hidden="true">
      <span className={level >= HEARD_RMS ? 'heard' : ''} style={{ width: `${levelPercent(level)}%` }} />
    </div>
  )
}

// The interview itself (FR-01/02/05/06/08/09/11/12/17). Server-only: questions,
// uploads and submission all go through the backend - there is no offline mode.
function InterviewWorkspace({ candidateName, onClose }) {
  const [stage, setStage] = useState('consent')
  const [consentAccepted, setConsentAccepted] = useState(false)
  // Each question has its own countdown. Time left is kept per question, so going
  // Back resumes where that question's timer stopped instead of granting fresh time.
  const [questionSeconds, setQuestionSeconds] = useState(DEFAULT_QUESTION_SECONDS)
  const [timeLeft, setTimeLeft] = useState({})
  const [currentBaseIndex, setCurrentBaseIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [responses, setResponses] = useState([])
  const [tabOutCount, setTabOutCount] = useState(0)
  const [processingTarget, setProcessingTarget] = useState(null)
  const [processingNote, setProcessingNote] = useState('')
  // Backend wiring: real questions + whether we're talking to the server.
  const [baseQuestions, setBaseQuestions] = useState([])
  const [apiMode, setApiMode] = useState(false)
  const [apiNotice, setApiNotice] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  // Microphone check (NFR-05): pick the device, see the level, prove we can hear you.
  const [micStream, setMicStream] = useState(null)
  const [micDevices, setMicDevices] = useState([])
  const [micDeviceId, setMicDeviceId] = useState('')
  const [micError, setMicError] = useState('')
  const [micHeard, setMicHeard] = useState(false)
  const [skipMicCheck, setSkipMicCheck] = useState(false)
  const [quietTake, setQuietTake] = useState(false)
  const micLevel = useMicLevel(micStream)
  // Real microphone recording (FR-02).
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const pendingBlobRef = useRef(null)
  const apiModeRef = useRef(false)
  const questionIdRef = useRef(null)
  const heardFramesRef = useRef(0)
  const takePeakRef = useRef(0) // loudest moment of the current take
  const uploadsRef = useRef([]) // in-flight uploads, awaited before submitting the interview
  const isTimedStage = stage === 'base'
  const activeQuestion = baseQuestions[currentBaseIndex]
  const activeSeconds = activeQuestion ? (timeLeft[activeQuestion.id] ?? questionSeconds) : 0
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

  // Count down only the question on screen (paused during "Processing...").
  useEffect(() => {
    const questionId = activeQuestion?.id
    if (stage !== 'base' || questionId === undefined) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setTimeLeft((current) => ({
        ...current,
        [questionId]: Math.max((current[questionId] ?? questionSeconds) - 1, 0),
      }))
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [stage, activeQuestion?.id, questionSeconds])

  // Time's up on this question: save it and move on (or submit after the last one).
  useEffect(() => {
    if (stage === 'base' && activeQuestion && activeSeconds === 0) {
      submitCurrentAnswer('timer')
    }
  }, [activeSeconds, stage])

  useEffect(() => {
    if (stage !== 'processing' || !processingTarget) {
      return undefined
    }

    if (apiModeRef.current && processingTarget.nextStage !== 'next_base') {
      let cancelled = false
      const startedAt = Date.now()

      ;(async () => {
        // Make sure every answer reached the server first, then submit the interview.
        await Promise.allSettled(uploadsRef.current)

        // FR-17: retry in the background; never surface a raw network error.
        let failures = 0
        while (!cancelled) {
          try {
            await finishInterview()
            if (!cancelled) {
              releaseMic()
              setStage('completed')
              setProcessingTarget(null)
            }
            return
          } catch (error) {
            failures += 1
            if (!cancelled && failures >= 2) {
              setProcessingNote(`We can't reach the server right now (${error.message}). Retrying automatically...`)
            }
          }
          if (!cancelled && (Date.now() - startedAt) / 1000 > 90) {
            setProcessingNote('This is taking longer than usual. Please keep this tab open.')
          }
          await new Promise((resolve) => window.setTimeout(resolve, 2000))
        }
      })()

      return () => {
        cancelled = true
      }
    }

    const timeoutId = window.setTimeout(() => {
      if (processingTarget.nextStage === 'next_base') {
        setCurrentBaseIndex((current) => Math.min(current + 1, baseQuestions.length - 1))
        setStage('base')
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
    setProcessingNote('')
    setStage('processing')
  }

  // Track loudness: proves the mic works on the consent screen, and measures each take.
  useEffect(() => {
    if (isRecording) {
      takePeakRef.current = Math.max(takePeakRef.current, micLevel)
    }
    if (!micHeard && micLevel >= HEARD_RMS) {
      heardFramesRef.current += 1
      if (heardFramesRef.current >= 3) setMicHeard(true) // ~0.3s of real sound
    }
  }, [micLevel, isRecording, micHeard])

  useEffect(() => {
    if (stage === 'consent' && !streamRef.current && navigator.mediaDevices?.getUserMedia) {
      openMic('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    setMicStream(null)
  }

  // Open (or switch) the microphone. Records from exactly the device the candidate checked.
  const openMic = async (deviceId = micDeviceId) => {
    setMicError('')
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      })
      streamRef.current = stream
      setMicStream(stream)
      const activeId = stream.getAudioTracks()[0]?.getSettings().deviceId || deviceId
      setMicDeviceId(activeId || '')
      const devices = await navigator.mediaDevices.enumerateDevices()
      setMicDevices(devices.filter((device) => device.kind === 'audioinput'))
      heardFramesRef.current = 0
      setMicHeard(false)
      return stream
    } catch (error) {
      setMicError(error.name === 'NotAllowedError'
        ? 'Microphone access is blocked. Click the lock icon in the address bar, allow the microphone, then try again.'
        : `Microphone unavailable: ${error.message}`)
      return null
    }
  }

  const startRecording = async () => {
    try {
      if (!streamRef.current && !(await openMic())) {
        setIsRecording(false)
        return
      }
      takePeakRef.current = 0
      setQuietTake(false)
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
      setQuietTake(takePeakRef.current < HEARD_RMS) // we barely heard anything on this take
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
    if (!hasSession()) {
      setApiNotice('Please sign in from your invitation email first.')
      return
    }
    setIsStarting(true)
    setApiNotice('')

    let questions
    try {
      await postConsent()
      const data = await getQuestions()
      questions = (data?.questions || []).map((q) => ({ id: q.question_id, type: 'base', prompt: q.text }))
      setQuestionSeconds(data?.question_seconds || DEFAULT_QUESTION_SECONDS)
    } catch (error) {
      setApiNotice(`Could not start the interview: ${error.message}. Please try again.`)
      setIsStarting(false)
      return
    }
    if (!questions.length) {
      setApiNotice('This interview has no questions yet. Please contact the recruiter.')
      setIsStarting(false)
      return
    }

    apiModeRef.current = true // set now: the processing effect below reads it this render
    setBaseQuestions(questions)
    setApiMode(true)
    setIsStarting(false)
    setTimeLeft({})
    setCurrentBaseIndex(0)
    setIsRecording(false)
    setResponses([])
    setProcessingNote('')
    uploadsRef.current = []

    setProcessingTarget(null)
    setStage('base')
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
    } else {
      note = 'Uploading audio to the server...'
    }

    setResponses((current) => [
      ...current.filter((response) => response.questionId !== question.id),
      { questionId: question.id, type: question.type, transcript: note },
    ])

    if (blob && apiMode) {
      const upload = uploadResponse({ questionId: question.id, type: question.type, blob })
        .then((res) => updateResponse(question.id, `Uploaded — server status: ${res.status}.`, res.response_id))
        .catch((error) => updateResponse(question.id, `Upload failed: ${error.message}`))
      uploadsRef.current.push(upload)
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
      if (currentBaseIndex < baseQuestions.length - 1) {
        beginProcessing('Processing your answer before the next question...', 'next_base')
        return
      }

      beginProcessing('Submitting your interview...', 'completed')
    }
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

  // Back is only offered while the previous question still has time left.
  const previousQuestion = baseQuestions[currentBaseIndex - 1]
  const canGoBack = currentBaseIndex > 0 && (timeLeft[previousQuestion?.id] ?? questionSeconds) > 0

  const goToPreviousQuestion = async () => {
    if (stage !== 'base' || !canGoBack) {
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

    const isLast = currentBaseIndex >= baseQuestions.length - 1
    const keep = isRecording && !isLast // never keep the mic running after the last answer

    if (stage === 'base') {
      await saveResponse(activeQuestion, 'manual', { keepRecording: keep })

      if (!isLast) {
        beginProcessing('Processing your answer before the next question...', 'next_base', { keepRecording: keep })
        return
      }

      beginProcessing('Submitting your interview...', 'completed')
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
          {apiMode ? <span>Connected to server</span> : null}
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

            <section className="mic-check" aria-label="Microphone check">
              <div className="mic-check-head">
                <Icon name="mic" size={18} />
                <strong>Microphone check</strong>
              </div>
              {micError ? (
                <>
                  <p className="invite-note error">{micError}</p>
                  <button type="button" className="soft-button" onClick={() => openMic(micDeviceId)}>Try again</button>
                </>
              ) : (
                <>
                  {micDevices.length > 1 ? (
                    <label className="mic-device">
                      <span>Microphone</span>
                      <select value={micDeviceId} onChange={(event) => openMic(event.target.value)}>
                        {micDevices.map((device, index) => (
                          <option key={device.deviceId || index} value={device.deviceId}>
                            {device.label || `Microphone ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : micDevices[0]?.label ? (
                    <p className="mic-device-name">{micDevices[0].label}</p>
                  ) : null}
                  <MicMeter level={micLevel} />
                  <p className={micHeard ? 'invite-note success' : 'invite-note'} role="status">
                    {micHeard
                      ? 'We can hear you clearly.'
                      : micStream
                        ? 'Say a few words - the bar should move and turn green. If it stays flat, choose another microphone.'
                        : 'Allow microphone access when your browser asks.'}
                  </p>
                </>
              )}
            </section>

            <button
              type="button"
              className="solid-button"
              disabled={!consentAccepted || isStarting || (!micHeard && !skipMicCheck)}
              onClick={beginBaseRound}
            >
              {isStarting ? 'Connecting...' : 'Continue to interview'}
            </button>
            {!micHeard && !skipMicCheck ? (
              <button type="button" className="text-link" onClick={() => setSkipMicCheck(true)}>
                Microphone check not working? Continue anyway
              </button>
            ) : null}
          </>
        ) : null}

        {apiNotice ? <p className="recording-status" role="status">{apiNotice}</p> : null}

        {stage === 'base' ? (
          <>
            <div className="interview-panel-head">
              <span>
                {`Question ${currentBaseIndex + 1}`}
              </span>
              <strong><Icon name="clock" /> {formatTime(activeSeconds)}</strong>
            </div>
            <h1 id="interview-title" className="interview-question-title">{activeQuestion.prompt}</h1>
            <p className="interview-question-helper">
              Answer naturally - about 1-2 minutes is ideal. Press Next when you&apos;re done.
            </p>
            {quietTake && !isRecording ? (
              <p className="invite-note error" role="alert">
                We could barely hear you on that answer. Check your microphone (the bar below should move when you
                speak) and press <strong>Record again</strong>.
              </p>
            ) : null}
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
            <MicMeter level={micLevel} small />
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
                  disabled={!canGoBack}
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
                Next
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
            <p>{processingNote || 'Please keep this tab open. The next step will appear automatically.'}</p>
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
              Your answers have been submitted. The hiring team will review your interview and contact you
              about next steps.
            </p>
            <dl className="interview-complete-summary">
              <div>
                <dt>Answers</dt>
                <dd>{responses.filter((response) => response.type === 'base').length}</dd>
              </div>
              <div>
                <dt>Tab outs</dt>
                <dd>{tabOutCount}</dd>
              </div>
              <div>
                <dt>Time taken</dt>
                <dd>
                  {formatTime(baseQuestions.reduce(
                    (sum, question) => sum + (questionSeconds - (timeLeft[question.id] ?? questionSeconds)),
                    0,
                  ))}
                </dd>
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

// What the candidate home shows for each server-side stage (FR-17 /interview/status).
const STAGE_CARDS = {
  consent: {
    eyebrow: 'Invitation',
    title: 'Your AI interview is ready',
    copy: 'Answer each question out loud. Every question has its own 2-minute timer - press Next whenever you are done.',
    action: 'Start interview',
  },
  base: {
    eyebrow: 'In progress',
    title: 'Continue your interview',
    copy: 'You started this interview earlier. Starting again shows the questions from the beginning.',
    action: 'Continue interview',
  },
  scoring: {
    eyebrow: 'Submitted',
    title: 'Your interview is being reviewed',
    copy: 'All your answers were received. The hiring team will review them and contact you.',
  },
  completed: {
    eyebrow: 'Complete',
    title: 'Interview complete - thank you',
    copy: 'All your answers were received. The hiring team will review them and contact you.',
  },
}

export default function CandidateDashboard({
  user, onOpenLogin, onBackToLanding, onLogout, sessionRole, onOpenOwnDashboard, onSwitchAccount,
}) {
  const [interview, setInterview] = useState({ loading: true, error: '', status: null, forbidden: false })
  const [isInterviewOpen, setIsInterviewOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const profile = user || { name: 'Candidate', email: '' }
  const firstName = profile.name.split(' ')[0] || 'Candidate'
  const initial = firstName.charAt(0).toUpperCase()
  const signedIn = hasSession()
  const roleMismatch = signedIn && sessionRole && sessionRole !== 'candidate' // e.g. a recruiter session
  // Also trust the server: /interview/status answers 403 to a non-candidate session.
  const wrongRole = roleMismatch || interview.forbidden

  useEffect(() => {
    if (!signedIn || roleMismatch) {
      setInterview({ loading: false, error: '', status: null, forbidden: false })
      return undefined
    }
    let cancelled = false
    setInterview((current) => ({ ...current, loading: true, error: '' }))
    getInterviewStatus()
      .then((status) => { if (!cancelled) setInterview({ loading: false, error: '', status, forbidden: false }) })
      .catch((error) => {
        if (!cancelled) {
          setInterview({ loading: false, error: error.message, status: null, forbidden: error.status === 403 })
        }
      })
    return () => {
      cancelled = true
    }
  }, [signedIn, roleMismatch, reloadKey])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const stage = interview.status?.stage
  const card = STAGE_CARDS[stage === 'processing' ? 'base' : stage] || null

  const renderInterviewCard = () => {
    if (wrongRole) {
      return (
        <RoleMismatch
          sessionRole={sessionRole && sessionRole !== 'candidate' ? sessionRole : 'company'}
          pageRole="candidate"
          onOpenOwnDashboard={onOpenOwnDashboard}
          onSwitchAccount={onSwitchAccount}
        />
      )
    }
    if (!signedIn) {
      return (
        <section className="dashboard-card">
          <p className="eyebrow">Sign in required</p>
          <h2>Open your invitation email</h2>
          <p>Your interview link arrives by email from the hiring team. Click <strong>Sign in</strong> in that email to begin.</p>
          <button type="button" className="solid-button" onClick={onOpenLogin}>Request a new sign-in link</button>
        </section>
      )
    }
    if (interview.loading) {
      return <section className="dashboard-card"><p>Loading your interview...</p></section>
    }
    if (interview.error) {
      return (
        <section className="dashboard-card">
          <p className="eyebrow">Something went wrong</p>
          <h2>We couldn&apos;t load your interview</h2>
          <p>{interview.error}</p>
          <button type="button" className="solid-button" onClick={() => setReloadKey((key) => key + 1)}>Try again</button>
        </section>
      )
    }
    if (!card) {
      return <section className="dashboard-card"><p>No interview found for this account.</p></section>
    }
    return (
      <section className="intro-panel">
        <div className="intro-panel-main">
          <div className="intro-kicker-row">
            <span>{card.eyebrow}</span>
          </div>
          <h2>{card.title}</h2>
          <p className="invited-by-line">
            <Icon name="users" size={16} />
            <span>
              Invited by <strong>{profile.invitedBy || 'the hiring team'}</strong>
              {profile.jobTitle ? <> for <strong>{profile.jobTitle}</strong></> : null}
            </span>
          </p>
          <p>{card.copy}</p>
          {card.action ? (
            <>
              <ul>
                <li><strong>Find a quiet room</strong> and allow microphone access when your browser asks</li>
                <li><strong>Stay on this tab</strong> - switching tabs is recorded for the hiring team</li>
                <li><strong>Speak naturally</strong> - your answers are transcribed and reviewed with AI assistance</li>
              </ul>
              <button type="button" className="solid-button" onClick={() => setIsInterviewOpen(true)}>
                {card.action}
              </button>
            </>
          ) : null}
        </div>
      </section>
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
              className="profile-chip"
              aria-label="Open profile menu"
              aria-expanded={isProfileOpen}
              onClick={() => setIsProfileOpen((current) => !current)}
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
                  <button type="button" onClick={onOpenLogin}>
                    <span className="menu-icon" aria-hidden="true">
                      <Icon name="login" />
                    </span>
                    Log in
                  </button>
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
            <button type="button" className="dashboard-nav-item active">
              <span className="nav-glyph" aria-hidden="true">
                <Icon name="mic" />
              </span>
              My interview
            </button>
          </nav>
        </aside>

        <section className="dashboard-content">
          <DashboardHeader title="My interview" copy="Your invited AI interview and its current status." />
          {renderInterviewCard()}
        </section>
      </div>

      {isInterviewOpen ? (
        <InterviewWorkspace
          candidateName={firstName}
          onClose={() => {
            setIsInterviewOpen(false)
            setReloadKey((key) => key + 1) // refresh the status card
          }}
        />
      ) : null}
    </main>
  )
}
