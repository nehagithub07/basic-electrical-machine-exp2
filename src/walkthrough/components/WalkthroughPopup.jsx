import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'

import { addExclusiveAudioListener, dispatchExclusiveAudioStart } from '../../utils/audioCoordinator.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'

const EDGE_GAP = 16
const TARGET_GAP = 18
const WALKTHROUGH_AUDIO_SOURCE_ID = 'walkthrough'
const DEFAULT_POPUP_SIZE = {
  height: 280,
  width: 360,
}

const PlayIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
)

const PauseIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
  </svg>
)

const isValidAudioSource = (audio) => Boolean(audio && audio !== '#')

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getPlacementOrder = (placement) => {
  const fallbackPlacements = ['bottom', 'right', 'left', 'top']

  return [
    placement,
    ...fallbackPlacements.filter((item) => item !== placement),
  ].filter(Boolean)
}

const getCandidatePosition = (rect, size, placement) => {
  const target = rect ?? {
    height: 0,
    left: window.innerWidth / 2,
    top: window.innerHeight / 2,
    width: 0,
  }

  if (placement === 'top') {
    return {
      left: target.left + target.width / 2 - size.width / 2,
      top: target.top - size.height - TARGET_GAP,
    }
  }

  if (placement === 'left') {
    return {
      left: target.left - size.width - TARGET_GAP,
      top: target.top + target.height / 2 - size.height / 2,
    }
  }

  if (placement === 'right') {
    return {
      left: target.left + target.width + TARGET_GAP,
      top: target.top + target.height / 2 - size.height / 2,
    }
  }

  return {
    left: target.left + target.width / 2 - size.width / 2,
    top: target.top + target.height + TARGET_GAP,
  }
}

const getPopupPosition = (rect, size, preferredPlacement) => {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const maxLeft = Math.max(EDGE_GAP, viewportWidth - size.width - EDGE_GAP)
  const maxTop = Math.max(EDGE_GAP, viewportHeight - size.height - EDGE_GAP)
  const placements = getPlacementOrder(preferredPlacement)

  for (const placement of placements) {
    const candidate = getCandidatePosition(rect, size, placement)
    const fitsHorizontally = candidate.left >= EDGE_GAP && candidate.left + size.width <= viewportWidth - EDGE_GAP
    const fitsVertically = candidate.top >= EDGE_GAP && candidate.top + size.height <= viewportHeight - EDGE_GAP

    if (fitsHorizontally && fitsVertically) {
      return {
        placement,
        left: candidate.left,
        top: candidate.top,
      }
    }
  }

  const fallback = getCandidatePosition(rect, size, preferredPlacement)

  return {
    placement: preferredPlacement,
    left: clamp(fallback.left, EDGE_GAP, maxLeft),
    top: clamp(fallback.top, EDGE_GAP, maxTop),
  }
}

const WalkthroughPopup = ({
  activeStep,
  autoPlayAudio,
  canGoNext,
  canGoPrevious,
  currentStep,
  isReportStep,
  onClose,
  onNext,
  onPrevious,
  onSkip,
  targetRect,
  totalSteps,
}) => {
  const popupRef = useRef(null)
  const audioRef = useRef(null)
  const [popupSize, setPopupSize] = useState(DEFAULT_POPUP_SIZE)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioSource = isValidAudioSource(activeStep.audio) ? activeStep.audio : null
  const titleId = `walkthrough-title-${activeStep.id}`
  const descriptionId = `walkthrough-description-${activeStep.id}`
  const progressPercent = (currentStep / totalSteps) * 100
  const primaryActionLabel = canGoNext ? 'Next' : 'Finish'
  const handlePrimaryAction = canGoNext ? onNext : onClose
  const showSecondaryAction = canGoNext
  const secondaryActionLabel = isReportStep ? 'Exit' : 'Skip'
  const handleSecondaryAction = isReportStep ? onClose : onSkip

  useFocusTrap(popupRef, true)

  const stopAudio = useCallback(() => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    audio.pause()
    audio.currentTime = 0
    setIsPlaying(false)
  }, [])

  useLayoutEffect(() => {
    if (!popupRef.current) {
      return
    }

    const popupBox = popupRef.current.getBoundingClientRect()

    setPopupSize({
      height: popupBox.height,
      width: popupBox.width,
    })
  }, [activeStep.id, targetRect])

  useEffect(() => {
    const resetPlayingTimer = window.setTimeout(() => setIsPlaying(false), 0)

    if (!audioSource) {
      audioRef.current = null
      return () => window.clearTimeout(resetPlayingTimer)
    }

    const audio = new Audio(audioSource)
    audioRef.current = audio

    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('ended', handleEnded)

    if (autoPlayAudio) {
      dispatchExclusiveAudioStart(WALKTHROUGH_AUDIO_SOURCE_ID)
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false))
    }

    return () => {
      window.clearTimeout(resetPlayingTimer)
      audio.pause()
      audio.currentTime = 0
      audio.removeEventListener('ended', handleEnded)
    }
  }, [activeStep.id, audioSource, autoPlayAudio])

  useEffect(() => (
    addExclusiveAudioListener(WALKTHROUGH_AUDIO_SOURCE_ID, stopAudio)
  ), [stopAudio])

  const popupPosition = useMemo(
    () => getPopupPosition(targetRect, popupSize, activeStep.placement),
    [activeStep.placement, popupSize, targetRect],
  )

  const toggleAudio = () => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      return
    }

    dispatchExclusiveAudioStart(WALKTHROUGH_AUDIO_SOURCE_ID)
    audio.play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false))
  }

  return (
    <motion.aside
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal="true"
      className="walkthrough-popup"
      data-placement={popupPosition.placement}
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 10 }}
      ref={popupRef}
      role="dialog"
      style={{
        left: popupPosition.left,
        top: popupPosition.top,
      }}
      tabIndex={-1}
      transition={{
        duration: 0.18,
        ease: 'easeOut',
      }}
    >
      <div className="walkthrough-popup__header">
        <div>
          <p className="walkthrough-popup__eyebrow">Guided Walkthrough</p>
          <h2 id={titleId}>{activeStep.title}</h2>
        </div>
      </div>

      <p className="walkthrough-popup__description" id={descriptionId}>
        {activeStep.description}
      </p>

      <div className="walkthrough-popup__progress" aria-hidden="true">
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="walkthrough-popup__meta">
        <span aria-label={`Step ${currentStep} of ${totalSteps}`}>
          {currentStep} / {totalSteps}
        </span>

        <button
          aria-label={audioSource ? (isPlaying ? 'Pause audio narration' : 'Play audio narration') : 'Audio narration unavailable'}
          aria-pressed={audioSource ? isPlaying : undefined}
          className="walkthrough-popup__audio"
          disabled={!audioSource}
          onClick={toggleAudio}
          title={audioSource ? (isPlaying ? 'Pause audio narration' : 'Play audio narration') : 'Audio narration unavailable'}
          type="button"
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>

      <div className="walkthrough-popup__actions">
        <button
          className="walkthrough-popup__button walkthrough-popup__button--secondary"
          disabled={!canGoPrevious}
          onClick={onPrevious}
          type="button"
        >
          Previous
        </button>
        {showSecondaryAction && (
          <button
            aria-label={isReportStep ? 'Exit walkthrough' : 'Skip to Generate Report'}
            className="walkthrough-popup__button walkthrough-popup__button--secondary"
            onClick={handleSecondaryAction}
            type="button"
          >
            {secondaryActionLabel}
          </button>
        )}
        <button
          className="walkthrough-popup__button walkthrough-popup__button--primary"
          data-autofocus
          onClick={handlePrimaryAction}
          type="button"
        >
          {primaryActionLabel}
        </button>
      </div>
    </motion.aside>
  )
}

export default WalkthroughPopup
