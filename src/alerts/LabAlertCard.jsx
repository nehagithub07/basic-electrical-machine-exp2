import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '../walkthrough/hooks/useFocusTrap.js'

const EXIT_DURATION = 180
const AUDIO_COMPLETE_HOLD_DURATION = 10000

const isConfiguredAudioSource = (audioSource) => (
  typeof audioSource === 'string' && audioSource.trim() !== '' && audioSource.trim() !== '#'
)

const hasSpeechText = (speechText) => (
  typeof speechText === 'string' && speechText.trim() !== ''
)

const dispatchLabAlertEvent = (eventName, detail) => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(eventName, { detail }))
}

const LabAlertCard = ({ alert, onDismiss }) => {
  const [isClosing, setIsClosing] = useState(false)
  const dismissTimerRef = useRef(null)
  const cardRef = useRef(null)
  const {
    canGoNext,
    canGoPrevious,
    confirmLabel = 'OK',
    description,
    duration,
    guideNarration,
    icon,
    id,
    onConfirm,
    onNarration,
    onNext,
    onPrevious,
    placement,
    requiresConfirmation,
    stepNumber,
    title,
    tutorialMode,
    type,
  } = alert
  const audioSource = alert.audio ?? alert.audioSource
  const followUpAudio = alert.followUpAudio ?? alert.audioAfter
  const audioSpeech = alert.audioSpeech ?? alert.speech
  const waitsForAudio = !requiresConfirmation && (
    Boolean(guideNarration)
    || isConfiguredAudioSource(audioSource)
    || isConfiguredAudioSource(followUpAudio)
    || hasSpeechText(audioSpeech)
  )
  const [audioPlaybackComplete, setAudioPlaybackComplete] = useState(!waitsForAudio)
  const hasProgressTimer = !requiresConfirmation && Number.isFinite(duration) && duration > 0
  const timerDuration = waitsForAudio ? AUDIO_COMPLETE_HOLD_DURATION : duration
  const showProgressTimer = hasProgressTimer && (!waitsForAudio || audioPlaybackComplete)
  const titleId = `lab-alert-title-${id}`
  const descriptionId = `lab-alert-description-${id}`
  const displayedDescription = description?.replace(
    /^(?:Connections Verified|Resistance Values Selected Successfully|Duplicate Readings|Report Generated):\s*/,
    '',
  )
  const role = requiresConfirmation ? 'alertdialog' : type === 'error' || type === 'warning' ? 'alert' : 'status'
  const showNarration = Boolean(alert.audioNarration || alert.narration || onNarration)
  const showTutorialControls = Boolean(tutorialMode || onNext || onPrevious)
  useFocusTrap(cardRef, requiresConfirmation)

  const dismiss = useCallback((reason = 'dismiss', callClose = true) => {
    if (isClosing) {
      return
    }

    dispatchLabAlertEvent('lab-alert:sound-stop', {
      id,
      reason,
    })
    if (reason !== 'timeout') alert.onStopNarration?.()

    setIsClosing(true)

    dismissTimerRef.current = window.setTimeout(() => {
      if (callClose) {
        alert.onClose?.(reason, alert)
      }

      onDismiss(id)
    }, EXIT_DURATION)
  }, [alert, id, isClosing, onDismiss])

  useEffect(() => {
    if (!guideNarration) return undefined
    let mounted = true
    const handleSettled = () => {
      if (mounted) setAudioPlaybackComplete(true)
    }
    Promise.resolve(guideNarration).then(handleSettled, handleSettled)
    return () => { mounted = false }
  }, [guideNarration])

  useEffect(() => {
    if (!waitsForAudio) {
      return undefined
    }

    const handleSoundEnded = (event) => {
      if (event.detail?.id === id) {
        setAudioPlaybackComplete(true)
      }
    }

    window.addEventListener('lab-alert:sound-ended', handleSoundEnded)

    return () => window.removeEventListener('lab-alert:sound-ended', handleSoundEnded)
  }, [id, waitsForAudio])

  useEffect(() => {
    dispatchLabAlertEvent('lab-alert:sound', {
      audio: audioSource,
      followUpAudio,
      id,
      sound: alert.sound ?? type,
      speech: audioSpeech,
      stepNumber,
      title,
      type,
    })
  }, [alert.sound, audioSource, audioSpeech, followUpAudio, id, stepNumber, title, type])

  useEffect(() => {
    if (!hasProgressTimer || (waitsForAudio && !audioPlaybackComplete)) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      dismiss('timeout')
    }, timerDuration)

    return () => window.clearTimeout(timer)
  }, [audioPlaybackComplete, dismiss, hasProgressTimer, timerDuration, waitsForAudio])

  useEffect(() => () => {
    dispatchLabAlertEvent('lab-alert:sound-stop', {
      id,
      reason: 'unmount',
    })

    if (dismissTimerRef.current) {
      window.clearTimeout(dismissTimerRef.current)
    }
  }, [id])

  const handleConfirm = () => {
    if (isClosing) return
    if (onConfirm?.(alert) === false) return
    dismiss('confirm', false)
  }

  const handleOk = () => {
    dismiss('ok')
  }

  const handleNarration = () => {
    onNarration?.(alert)
    dispatchLabAlertEvent('lab-alert:narration', {
      id,
      narration: alert.narration ?? `${title}. ${description ?? ''}`.trim(),
      stepNumber,
      title,
      type,
    })
  }

  return (
    <article
      aria-modal={requiresConfirmation && alert.critical ? true : undefined}
      aria-describedby={title && description ? descriptionId : undefined}
      aria-labelledby={title ? titleId : descriptionId}
      className={`lab-alert-card lab-alert-card--${type} ${isClosing ? 'lab-alert-card--closing' : ''}`}
      data-placement={placement}
      role={role}
      ref={cardRef}
      onKeyDown={(event) => {
        if (requiresConfirmation && event.key === 'Escape') dismiss('close')
      }}
      style={{ '--alert-duration': `${timerDuration ?? 0}ms` }}
    >
      <div className="lab-alert-card__glow" aria-hidden="true" />

      <div className="lab-alert-card__main">
        <div className="lab-alert-card__header">
          <span className="lab-alert-card__icon" aria-hidden="true">{icon}</span>
          {title ? <h2 id={titleId}>{title}</h2> : null}

          <div className="lab-alert-card__tools">
            {showNarration ? (
              <button
                aria-label="Play alert narration"
                className="lab-alert-card__icon-button"
                onClick={handleNarration}
                type="button"
              >
                🔊
              </button>
            ) : null}
            <button
              aria-label="Close alert"
              className="lab-alert-card__icon-button"
              onClick={() => dismiss('close')}
              type="button"
            >
              ×
            </button>
          </div>
        </div>

        {description ? (
          <div className="lab-alert-card__content" id={descriptionId}>
            {displayedDescription.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
        ) : null}
      </div>

      <div className="lab-alert-card__actions">
        {showTutorialControls ? (
          <>
            <button
              className="lab-alert-card__button lab-alert-card__button--secondary"
              disabled={canGoPrevious === false}
              onClick={onPrevious}
              type="button"
            >
              Previous
            </button>
            <button
              className="lab-alert-card__button lab-alert-card__button--secondary"
              disabled={canGoNext === false}
              onClick={onNext}
              type="button"
            >
              Next
            </button>
          </>
        ) : null}

        <button
          className="lab-alert-card__button lab-alert-card__button--primary"
          data-autofocus={requiresConfirmation ? true : undefined}
          onClick={requiresConfirmation ? handleConfirm : handleOk}
          type="button"
        >
          {requiresConfirmation ? confirmLabel : 'OK'}
        </button>
      </div>

      {showProgressTimer ? (
        <div className="lab-alert-card__timer" aria-hidden="true">
          <span />
        </div>
      ) : null}

    </article>
  )
}

export default LabAlertCard
