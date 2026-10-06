import { useEffect, useRef, useState } from 'react'
import {
  getFollowUp,
  getInterviewStatus,
  getQuestions,
  hasSession,
  postConsent,
  postTabOut,
  uploadResponse,
} from '../api'
import Icon from '../components/Icon'

const BASE_ROUND_SECONDS = 300
const FOLLOW_UP_SECONDS = 150
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
// uploads and the AI follow-up all come from the backend - there is no offline mode.
function InterviewWorkspace({ candidateName, resumeStage = 'base', onClose }) {
  const [stage, setStage] = useState('consent')
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [baseSeconds, setBaseSeconds] = useState(BASE_ROUND_SECONDS)
  const [followUpSeconds, setFollowUpSeconds] = useState(FOLLOW_UP_SECONDS)
  const [currentBaseIndex, setCurrentBaseIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [responses, setResponses] = useState([])
  const [tabOutCount, setTabOutCount] = useState(0)
  const [processingTarget, setProcessingTarget] = useState(null)
  const [processingNote, setProcessingNote] = useState('')
  // FR-08: the one AI follow-up question, fetched from the server.
  const [followUpQuestion, setFollowUpQuestion] = useState(null)
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
  const uploadsRef = useRef([]) // in-flight uploads, awaited before asking for the follow-up
  const isTimedStage = stage === 'base' || stage === 'follow_up'
  const activeQuestion = stage === 'follow_up' ? followUpQuestion : baseQuestions[currentBaseIndex]
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

    if (apiModeRef.current && processingTarget.nextStage !== 'next_base') {
      let cancelled = false
      const startedAt = Date.now()

      ;(async () => {
        // Make sure every answer reached the server first, so the AI sees all of them.
        await Promise.allSettled(uploadsRef.current)

        if (processingTarget.nextStage !== 'follow_up') {
          if (!cancelled) {
            releaseMic()
            setStage('completed')
            setProcessingTarget(null)
          }
          return
        }

        // FR-17: poll in the background; never surface a raw timeout to the candidate.
        let failures = 0
        while (!cancelled) {
          try {
            const data = await getFollowUp()
            failures = 0
            if (data?.text && !cancelled) {
              setFollowUpQuestion({ id: 0, type: 'follow_up', prompt: data.text })
              setFollowUpSeconds(data.follow_up_seconds || FOLLOW_UP_SECONDS)
              setStage('follow_up')
              setProcessingTarget(null)
              return
            }
          } catch (error) {
            failures += 1
            if (failures >= 3 && !cancelled) {
              setProcessingNote(`We can't reach the server right now (${error.message}). Retrying automatically...`)
            }
          }

          const elapsed = (Date.now() - startedAt) / 1000
          if (!cancelled && failures < 3) {
            if (elapsed > 90) {
              setProcessingNote('This is taking longer than usual. Please keep this tab open.')
            } else if (elapsed > 15) {
              setProcessingNote('Still preparing your follow-up question...')
            }
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
    setBaseSeconds(BASE_ROUND_SECONDS)
    setFollowUpSeconds(FOLLOW_UP_SECONDS)
    setCurrentBaseIndex(0)
    setIsRecording(false)
    setResponses([])
    setProcessingNote('')
    setFollowUpQuestion(null)
    uploadsRef.current = []

    if (resumeStage === 'follow_up') {
      // Base answers were already submitted earlier: go straight to the follow-up.
      beginProcessing('Loading your follow-up question...', 'follow_up')
      return
    }
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

// --- Candidate home: the interview journey ---------------------------------------
// Everything here mirrors how the interview really works (FR-01/05/09/12/17).

const JOURNEY_STEPS = [
  { id: 'consent', title: 'Consent & mic check', detail: 'Agree to recording and check we can hear you', icon: 'shield' },
  { id: 'base', title: 'Spoken questions', detail: '4 questions, one shared 5:00 timer', icon: 'mic' },
  { id: 'follow_up', title: 'AI follow-up', detail: 'One question about your answers, 2:30', icon: 'spark' },
  { id: 'review', title: 'Hiring team review', detail: 'People review your interview', icon: 'users' },
]

// Server stage -> which journey step is current, and what the hero says.
const STAGE_VIEW = {
  consent: {
    step: 0,
    pill: 'Ready to start',
    title: 'Your AI interview is ready',
    copy: 'Answer out loud, at your own pace within the timer. There is no live interviewer and no video - just your voice.',
    action: 'Start interview',
  },
  base: {
    step: 1,
    pill: 'In progress',
    title: 'Pick up where you left off',
    copy: 'You started this interview earlier. Your questions stay the same - they start again from the first one.',
    action: 'Continue interview',
  },
  follow_up: {
    step: 2,
    pill: 'Almost done',
    title: 'One last question is waiting',
    copy: 'Your answers are in. One AI follow-up question based on what you said is waiting - you have 2:30 to answer.',
    action: 'Answer follow-up',
  },
  scoring: {
    step: 3,
    pill: 'Submitted',
    title: 'Your interview is with the hiring team',
    copy: 'All your answers were received. They are being transcribed and reviewed - the hiring team will contact you about next steps.',
  },
  completed: {
    step: 4,
    pill: 'Complete',
    title: 'Interview complete - thank you!',
    copy: 'All your answers were received. The hiring team reviews every interview and will contact you about next steps.',
  },
}

const BEFORE_YOU_START = [
  { icon: 'mic', title: 'Find a quiet spot', text: 'Background noise makes your answers harder to understand. A headset helps.' },
  { icon: 'shield', title: 'Allow the microphone', text: "When your browser asks, choose Allow. You'll see a level bar move as you speak." },
  { icon: 'flag', title: 'Stay on this tab', text: 'Switching tabs during a question is noted for the hiring team. Pasting is turned off.' },
  { icon: 'spark', title: 'Speak naturally', text: 'Real examples beat perfect wording. Short pauses and corrections are completely fine.' },
]

const GOOD_TO_KNOW = [
  {
    q: 'Can I re-record an answer?',
    a: 'Yes. While you are on a question you can press "Record again" as many times as you like - your latest take is the one that counts. The shared 5:00 timer keeps running, so keep an eye on it.',
  },
  {
    q: "What if my microphone doesn't work?",
    a: 'The microphone check before you start shows a live level bar. If it stays flat, pick another microphone from the list, or allow access via the lock icon next to the address bar.',
  },
  {
    q: 'Who sees my answers?',
    a: 'Only the hiring team for this job. Your answers are transcribed and an AI suggests scores; the hiring team can listen to your recordings, and a person makes the final decision.',
  },
  {
    q: 'What if I close the tab or lose my connection?',
    a: 'Come back to this page and press "Continue interview". If you had already answered the main questions, you go straight to the follow-up.',
  },
  {
    q: 'My sign-in link stopped working',
    a: 'Each link works once and expires after 15 minutes. Use "Request a new sign-in link" with the same email address to get a fresh one.',
  },
]

function ProgressRing({ step, total }) {
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const done = Math.min(step, total)
  const offset = circumference * (1 - done / total)
  return (
    <div className="cj-ring" role="img" aria-label={`Step ${Math.min(step + 1, total)} of ${total}`}>
      <svg viewBox="0 0 110 110" aria-hidden="true">
        <circle className="cj-ring-track" cx="55" cy="55" r={radius} />
        <circle
          className="cj-ring-value"
          cx="55"
          cy="55"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="cj-ring-label">
        {step >= total ? (
          <Icon name="check" size={30} />
        ) : (
          <>
            <strong>{step + 1}</strong>
            <span>of {total}</span>
          </>
        )}
      </div>
    </div>
  )
}

function JourneySteps({ current }) {
  return (
    <ol className="cj-steps" aria-label="Interview steps">
      {JOURNEY_STEPS.map((item, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'upcoming'
        return (
          <li className={`cj-step ${state}`} key={item.id} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="cj-step-icon" aria-hidden="true">
              <Icon name={state === 'done' ? 'check' : item.icon} size={18} />
            </span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default function CandidateDashboard({ user, onOpenLogin, onBackToLanding, onLogout }) {
  const [interview, setInterview] = useState({ loading: true, error: '', status: null })
  const [isInterviewOpen, setIsInterviewOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const profile = user || { name: 'Candidate', email: '' }
  const firstName = profile.name.split(/[ .+_-]/)[0] || 'Candidate'
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1)
  const initial = displayName.charAt(0)
  const signedIn = hasSession()

  useEffect(() => {
    if (!signedIn) {
      setInterview({ loading: false, error: '', status: null })
      return undefined
    }
    let cancelled = false
    setInterview((current) => ({ ...current, loading: true, error: '' }))
    getInterviewStatus()
      .then((status) => { if (!cancelled) setInterview({ loading: false, error: '', status }) })
      .catch((error) => { if (!cancelled) setInterview({ loading: false, error: error.message, status: null }) })
    return () => {
      cancelled = true
    }
  }, [signedIn, reloadKey])

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
  // 'processing' = all questions answered, follow-up still being prepared: resume there.
  const view = STAGE_VIEW[stage === 'processing' ? 'follow_up' : stage] || null
  const finished = view && view.step >= 3

  const renderHero = () => {
    if (!signedIn) {
      return (
        <section className="cj-hero">
          <div className="cj-hero-copy">
            <span className="cj-pill neutral">Sign in required</span>
            <h1>Open your invitation email</h1>
            <p>Your interview link arrives by email from the hiring team. Click <strong>Sign in</strong> in that email to begin.</p>
            <div className="cj-hero-actions">
              <button type="button" className="solid-button" onClick={onOpenLogin}>Request a new sign-in link</button>
            </div>
          </div>
        </section>
      )
    }
    if (interview.loading) {
      return (
        <section className="cj-hero" aria-busy="true">
          <div className="cj-hero-copy">
            <span className="cj-skeleton short" />
            <span className="cj-skeleton title" />
            <span className="cj-skeleton" />
          </div>
        </section>
      )
    }
    if (interview.error || !view) {
      return (
        <section className="cj-hero">
          <div className="cj-hero-copy">
            <span className="cj-pill warning">Something went wrong</span>
            <h1>We couldn&apos;t load your interview</h1>
            <p>{interview.error || 'No interview was found for this account.'}</p>
            <div className="cj-hero-actions">
              <button type="button" className="solid-button" onClick={() => setReloadKey((key) => key + 1)}>Try again</button>
            </div>
          </div>
        </section>
      )
    }
    return (
      <section className={finished ? 'cj-hero finished' : 'cj-hero'}>
        <div className="cj-hero-copy">
          <p className="cj-greeting">Hi {displayName},</p>
          <span className={finished ? 'cj-pill success' : 'cj-pill'}>{view.pill}</span>
          <h1>{view.title}</h1>
          <p>{view.copy}</p>
          {view.action ? (
            <div className="cj-hero-actions">
              <button type="button" className="solid-button cj-start" onClick={() => setIsInterviewOpen(true)}>
                {view.action}
                <Icon name="arrowRight" size={18} />
              </button>
              <span className="cj-meta">
                <Icon name="clock" size={16} /> About 10 minutes
              </span>
            </div>
          ) : null}
        </div>
        <ProgressRing step={view.step} total={JOURNEY_STEPS.length} />
      </section>
    )
  }

  return (
    <main className="candidate-app-page cj-page">
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
              <strong>{displayName}</strong>
              <Icon name="chevronDown" className="chevron-icon" />
            </button>
            {isProfileOpen ? (
              <section className="profile-menu" aria-label="Profile menu">
                <div className="profile-menu-head">
                  <span className="avatar large-avatar">{initial}</span>
                  <div>
                    <strong>{displayName}</strong>
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

      <div className="cj-shell">
        {renderHero()}

        {view ? (
          <section className="cj-section" aria-labelledby="cj-steps-title">
            <h2 id="cj-steps-title">How your interview works</h2>
            <JourneySteps current={view.step} />
          </section>
        ) : null}

        {view && !finished ? (
          <section className="cj-section" aria-labelledby="cj-tips-title">
            <h2 id="cj-tips-title">Before you start</h2>
            <div className="cj-tips">
              {BEFORE_YOU_START.map((tip) => (
                <article className="cj-tip" key={tip.title}>
                  <span className="cj-tip-icon" aria-hidden="true">
                    <Icon name={tip.icon} size={20} />
                  </span>
                  <h3>{tip.title}</h3>
                  <p>{tip.text}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {finished ? (
          <section className="cj-section cj-next" aria-labelledby="cj-next-title">
            <span className="cj-tip-icon" aria-hidden="true">
              <Icon name="award" size={22} />
            </span>
            <div>
              <h2 id="cj-next-title">What happens next</h2>
              <p>
                The hiring team reviews your answers with an AI-assisted summary and can listen to your
                recordings. A person makes the final decision, and they will contact you by email - there is
                nothing else you need to do here.
              </p>
            </div>
          </section>
        ) : null}

        <section className="cj-section" aria-labelledby="cj-faq-title">
          <h2 id="cj-faq-title">Good to know</h2>
          <div className="cj-faq">
            {GOOD_TO_KNOW.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <p className="cj-privacy">
          <Icon name="shield" size={16} /> Your recordings are only shared with the hiring team for this job.
        </p>
      </div>

      {isInterviewOpen ? (
        <InterviewWorkspace
          candidateName={displayName}
          resumeStage={stage === 'follow_up' || stage === 'processing' ? 'follow_up' : 'base'}
          onClose={() => {
            setIsInterviewOpen(false)
            setReloadKey((key) => key + 1) // refresh the journey
          }}
        />
      ) : null}
    </main>
  )
}
