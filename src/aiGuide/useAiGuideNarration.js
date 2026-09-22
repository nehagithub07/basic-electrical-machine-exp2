import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import defaultAiGuideConfig from './aiGuideConfig.json'
import { isConfiguredAudioSource, loadAiGuideConfig } from './aiGuideConfigLoader.js'
import { addExclusiveAudioListener, dispatchExclusiveAudioStart } from '../utils/audioCoordinator.js'

const AI_GUIDE_AUDIO_SOURCE_ID = 'ai-guide'

const canUseSpeechSynthesis = () => (
  typeof window !== 'undefined'
  && typeof window.speechSynthesis !== 'undefined'
  && typeof window.SpeechSynthesisUtterance !== 'undefined'
)

const getSpeechLang = (locale) => {
  if (!locale) {
    return 'en-US'
  }

  return locale.includes('-') ? locale : `${locale}-US`
}

export const useAiGuideNarration = ({
  config = defaultAiGuideConfig,
  locale,
  onError,
  onFinish,
  onStart,
} = {}) => {
  const guideConfig = useMemo(
    () => loadAiGuideConfig(config, locale ?? config?.defaultLocale),
    [config, locale],
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeStepId, setActiveStepId] = useState(null)
  const isActiveRef = useRef(false)
  const currentPlaybackRef = useRef(null)
  const runIdRef = useRef(0)
  const sequenceIdRef = useRef(0)

  const stopCurrentPlayback = useCallback(() => {
    const currentPlayback = currentPlaybackRef.current

    if (!currentPlayback) {
      return
    }

    currentPlaybackRef.current = null
    currentPlayback.stop()
  }, [])

  const pause = useCallback(() => {
    sequenceIdRef.current += 1
    runIdRef.current += 1
    stopCurrentPlayback()
    setActiveStepId(null)
  }, [stopCurrentPlayback])

  const stop = useCallback(() => {
    isActiveRef.current = false
    pause()
    setIsPlaying(false)
  }, [pause])

  const speakText = useCallback((text) => new Promise((resolve, reject) => {
    if (!canUseSpeechSynthesis()) {
      reject(new Error('Speech synthesis is not available in this browser.'))
      return
    }

    dispatchExclusiveAudioStart(AI_GUIDE_AUDIO_SOURCE_ID)
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    let settled = false

    const settle = (callback) => {
      if (settled) {
        return
      }

      settled = true
      utterance.onend = null
      utterance.onerror = null

      if (currentPlaybackRef.current?.utterance === utterance) {
        currentPlaybackRef.current = null
      }

      callback()
    }

    utterance.lang = getSpeechLang(guideConfig.locale)
    utterance.rate = 0.95
    utterance.pitch = 1

    utterance.onend = () => settle(resolve)
    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') {
        settle(resolve)
        return
      }

      settle(() => reject(new Error(`Speech synthesis failed: ${event.error}`)))
    }

    currentPlaybackRef.current = {
      stop: () => {
        settle(resolve)
        window.speechSynthesis.cancel()
      },
      utterance,
    }

    window.speechSynthesis.speak(utterance)
  }), [guideConfig.locale])

  const playAudio = useCallback((audioSource) => new Promise((resolve, reject) => {
    const audio = new Audio(audioSource)
    let settled = false

    const cleanup = () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }

    const settle = (callback) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()

      if (currentPlaybackRef.current?.audio === audio) {
        currentPlaybackRef.current = null
      }

      callback()
    }

    const handleEnded = () => settle(resolve)
    const handleError = () => settle(() => reject(new Error(`Unable to play AI Guide audio: ${audioSource}`)))

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    dispatchExclusiveAudioStart(AI_GUIDE_AUDIO_SOURCE_ID)

    currentPlaybackRef.current = {
      audio,
      stop: () => {
        audio.pause()
        audio.currentTime = 0
        settle(resolve)
      },
    }

    audio.play().catch((error) => {
      settle(() => reject(error))
    })
  }), [])

  const playStep = useCallback(async (step, runId) => {
    if (isConfiguredAudioSource(step.audio)) {
      try {
        await playAudio(step.audio)
        return
      } catch (error) {
        if (runIdRef.current !== runId || !isActiveRef.current) return
        if (!step.text) {
          throw error
        }
      }
    }

    if (runIdRef.current === runId && isActiveRef.current) await speakText(step.text)
  }, [playAudio, speakText])

  const playStepById = useCallback(async (stepId, sequenceId) => {
    if (sequenceId === undefined) sequenceIdRef.current += 1
    else if (sequenceId !== sequenceIdRef.current) return false
    if (guideConfig.steps.length === 0) {
      onError?.(new Error('AI Guide has no configured steps.'))
      return
    }

    if (!isActiveRef.current) {
      return
    }

    const step = guideConfig.steps.find((entry) => entry.id === String(stepId))

    if (!step) {
      return
    }

    const runId = runIdRef.current + 1
    runIdRef.current = runId
    stopCurrentPlayback()
    setActiveStepId(step.id)

    try {
      await playStep(step, runId)
      const completed = runIdRef.current === runId && isActiveRef.current

      if (completed) {
        setActiveStepId(null)
      }

      return completed
    } catch (error) {
      if (runIdRef.current === runId) {
        setActiveStepId(null)
        onError?.(error)
      }

      return false
    }
  }, [guideConfig.steps, onError, playStep, stopCurrentPlayback])

  const playText = useCallback(async (text, { activeStepId: playbackStepId = null } = {}) => {
    if (!text || !isActiveRef.current) {
      return false
    }

    sequenceIdRef.current += 1
    const runId = runIdRef.current + 1
    runIdRef.current = runId
    stopCurrentPlayback()
    setActiveStepId(playbackStepId)

    try {
      await speakText(text)
      const completed = runIdRef.current === runId

      if (completed) {
        setActiveStepId(null)
      }

      return completed
    } catch (error) {
      if (runIdRef.current === runId) {
        setActiveStepId(null)
        onError?.(error)
      }

      return false
    }
  }, [onError, speakText, stopCurrentPlayback])

  const playAudioSource = useCallback(async (
    audioSource,
    { activeStepId: playbackStepId = null, fallbackText = '' } = {},
  ) => {
    if (!isActiveRef.current) {
      return false
    }

    if (!isConfiguredAudioSource(audioSource)) {
      return fallbackText ? playText(fallbackText, { activeStepId: playbackStepId }) : false
    }

    sequenceIdRef.current += 1
    const runId = runIdRef.current + 1
    runIdRef.current = runId
    stopCurrentPlayback()
    setActiveStepId(playbackStepId)

    try {
      await playAudio(audioSource)
      const completed = runIdRef.current === runId

      if (completed) {
        setActiveStepId(null)
      }

      return completed
    } catch (error) {
      if (runIdRef.current === runId) {
        setActiveStepId(null)

        if (fallbackText) {
          return playText(fallbackText, { activeStepId: playbackStepId })
        }

        onError?.(error)
      }

      return false
    }
  }, [onError, playAudio, playText, stopCurrentPlayback])

  const playStepsById = useCallback(async (stepIds) => {
    if (!Array.isArray(stepIds) || !isActiveRef.current) {
      return false
    }

    const sequenceId = ++sequenceIdRef.current
    for (const stepId of stepIds) {
      if (!isActiveRef.current || sequenceId !== sequenceIdRef.current) {
        return false
      }

      const completed = await playStepById(stepId, sequenceId)

      if (!completed || sequenceId !== sequenceIdRef.current) {
        return false
      }
    }
    return true
  }, [playStepById])

  const start = useCallback((initialStepId = 1) => {
    pause()

    if (guideConfig.steps.length === 0) {
      isActiveRef.current = false
      setActiveStepId(null)
      setIsPlaying(false)
      onError?.(new Error('AI Guide has no configured steps.'))
      return
    }

    isActiveRef.current = true
    setIsPlaying(true)
    onStart?.(guideConfig)
    return playStepsById([initialStepId])
  }, [guideConfig, onError, onStart, playStepsById, pause])

  const finish = useCallback(() => {
    isActiveRef.current = false
    pause()
    setIsPlaying(false)
    onFinish?.(guideConfig)
  }, [guideConfig, onFinish, pause])

  useEffect(() => addExclusiveAudioListener(AI_GUIDE_AUDIO_SOURCE_ID, pause), [pause])

  useEffect(() => stop, [stop])

  return {
    config: guideConfig,
    activeStepId,
    finish,
    isPlaying,
    playAudioSource,
    playStepById,
    playStepsById,
    playText,
    pause,
    start,
    stop,
  }
}
