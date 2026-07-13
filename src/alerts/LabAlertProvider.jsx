import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import { LabAlertContext } from './LabAlertContext.js'
import LabAlertCard from './LabAlertCard.jsx'
import LabAlertSpotlight from './LabAlertSpotlight.jsx'
import { addExclusiveAudioListener, dispatchExclusiveAudioStart } from '../utils/audioCoordinator.js'
import './labAlerts.css'

const DEFAULT_DURATIONS = {
  error: 6500,
  info: 4200,
  success: 3800,
  warning: 5600,
}

const DEFAULT_ICONS = {
  error: '❌',
  info: '🎛️',
  success: '✅',
  warning: '⚠️',
}

const TOP_RIGHT_LIMIT = 3
const DEDUPE_WINDOW = 900
const ALERT_TYPES = ['success', 'warning', 'error', 'info']
const ALERT_AUDIO_SOURCE_ID = 'lab-alert'

const isConfiguredAudioSource = (audioSource) => (
  typeof audioSource === 'string' && audioSource.trim() !== '' && audioSource.trim() !== '#'
)

const hasSpeechText = (speechText) => (
  typeof speechText === 'string' && speechText.trim() !== ''
)

const canUseSpeechSynthesis = () => (
  typeof window !== 'undefined'
  && typeof window.speechSynthesis !== 'undefined'
  && typeof window.SpeechSynthesisUtterance !== 'undefined'
)

const getSpeechLang = () => (
  typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US'
)

const dispatchLabAlertEvent = (eventName, detail) => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(eventName, { detail }))
}

const getPlacement = () => 'center'

const initialAlertState = {
  centerAlert: null,
  queue: [],
  topRightAlerts: [],
}

const pumpAlertQueue = (state) => {
  let nextState = state

  while (nextState.queue.length > 0) {
    const nextAlert = nextState.queue[0]

    if (nextAlert.placement === 'center') {
      if (nextState.centerAlert) {
        break
      }

      nextState = {
        ...nextState,
        centerAlert: nextAlert,
        queue: nextState.queue.slice(1),
      }
      continue
    }

    if (nextState.topRightAlerts.length >= TOP_RIGHT_LIMIT) {
      break
    }

    nextState = {
      ...nextState,
      queue: nextState.queue.slice(1),
      topRightAlerts: [...nextState.topRightAlerts, nextAlert],
    }
  }

  return nextState
}

const alertReducer = (state, action) => {
  switch (action.type) {
    case 'clear':
      return initialAlertState
    case 'dismiss':
      return pumpAlertQueue({
        ...state,
        centerAlert: state.centerAlert?.id === action.id ? null : state.centerAlert,
        topRightAlerts: state.topRightAlerts.filter((alert) => alert.id !== action.id),
      })
    case 'enqueue':
      return pumpAlertQueue({
        ...state,
        queue: [...state.queue, action.alert],
      })
    case 'replace':
      return pumpAlertQueue({
        ...initialAlertState,
        queue: [action.alert],
      })
    default:
      return state
  }
}

const LabAlertProvider = ({ children }) => {
  const nextIdRef = useRef(0)
  const activeDedupeKeysRef = useRef(new Set())
  const alertAudioRef = useRef(null)
  const recentAlertsRef = useRef(new Map())
  const [alertState, dispatchAlert] = useReducer(alertReducer, initialAlertState)
  const alertStateRef = useRef(alertState)

  const stopAlertAudio = useCallback((reason = 'stopped') => {
    const currentPlayback = alertAudioRef.current

    if (!currentPlayback) {
      return
    }

    currentPlayback.stop(reason)
  }, [])

  useEffect(() => {
    alertStateRef.current = alertState
  }, [alertState])

  useEffect(() => {
    const handleAlertSound = (event) => {
      const audioSource = event.detail?.audio
      const alertId = event.detail?.id
      const followUpAudio = event.detail?.followUpAudio
      const speechText = event.detail?.speech

      if (
        !isConfiguredAudioSource(audioSource)
        && !isConfiguredAudioSource(followUpAudio)
        && !hasSpeechText(speechText)
      ) {
        return
      }

      dispatchExclusiveAudioStart(ALERT_AUDIO_SOURCE_ID)
      stopAlertAudio()

      const playback = {
        audio: null,
        finish: null,
        id: alertId,
        segmentStop: null,
        stop: null,
        stopped: false,
        utterance: null,
      }
      let settled = false

      const finishPlayback = (reason) => {
        if (settled) {
          return
        }

        settled = true
        playback.segmentStop = null
        playback.audio = null
        playback.utterance = null

        if (alertAudioRef.current === playback) {
          alertAudioRef.current = null
        }

        dispatchLabAlertEvent('lab-alert:sound-ended', {
          id: alertId,
          reason,
        })
      }

      const playAudioSource = (source) => new Promise((resolve, reject) => {
        if (!isConfiguredAudioSource(source) || playback.stopped) {
          resolve()
          return
        }

        const audio = new Audio(source)
        let segmentSettled = false

        function cleanup() {
          audio.removeEventListener('ended', handleEnded)
          audio.removeEventListener('error', handleError)
        }

        function settleSegment(callback) {
          if (segmentSettled) {
            return
          }

          segmentSettled = true
          cleanup()

          if (playback.audio === audio) {
            playback.audio = null
          }

          if (playback.segmentStop === stopSegment) {
            playback.segmentStop = null
          }

          callback()
        }

        function handleEnded() {
          settleSegment(resolve)
        }

        function handleError() {
          settleSegment(() => reject(new Error(`Unable to play alert audio: ${source}`)))
        }

        function stopSegment() {
          audio.pause()
          audio.currentTime = 0
          settleSegment(resolve)
        }

        playback.audio = audio
        playback.segmentStop = stopSegment
        audio.addEventListener('ended', handleEnded)
        audio.addEventListener('error', handleError)

        audio.play().catch((error) => {
          settleSegment(() => reject(error))
        })
      })

      const playSpeechText = (text) => new Promise((resolve, reject) => {
        const normalizedText = typeof text === 'string' ? text.trim() : ''

        if (!normalizedText || playback.stopped || !canUseSpeechSynthesis()) {
          resolve()
          return
        }

        window.speechSynthesis.cancel()

        const utterance = new SpeechSynthesisUtterance(normalizedText)
        let segmentSettled = false

        function cleanup() {
          utterance.onend = null
          utterance.onerror = null
        }

        function settleSegment(callback) {
          if (segmentSettled) {
            return
          }

          segmentSettled = true
          cleanup()

          if (playback.utterance === utterance) {
            playback.utterance = null
          }

          if (playback.segmentStop === stopSegment) {
            playback.segmentStop = null
          }

          callback()
        }

        function stopSegment() {
          settleSegment(resolve)
          window.speechSynthesis.cancel()
        }

        utterance.lang = getSpeechLang()
        utterance.rate = 0.95
        utterance.pitch = 1
        utterance.onend = () => settleSegment(resolve)
        utterance.onerror = (speechEvent) => {
          if (speechEvent.error === 'canceled' || speechEvent.error === 'interrupted') {
            settleSegment(resolve)
            return
          }

          settleSegment(() => reject(new Error(`Alert speech failed: ${speechEvent.error}`)))
        }

        playback.utterance = utterance
        playback.segmentStop = stopSegment
        window.speechSynthesis.speak(utterance)
      })

      playback.finish = finishPlayback
      playback.stop = (reason = 'stopped') => {
        if (playback.stopped) {
          return
        }

        playback.stopped = true
        playback.segmentStop?.()
        finishPlayback(reason)
      }
      alertAudioRef.current = playback

      const playAlertSound = async () => {
        try {
          await playAudioSource(audioSource)

          if (playback.stopped) {
            return
          }

          await playAudioSource(followUpAudio)

          if (playback.stopped) {
            return
          }

          await playSpeechText(speechText)

          if (playback.stopped) {
            return
          }

          finishPlayback('ended')
        } catch {
          finishPlayback('error')
        }
      }

      playAlertSound()
    }

    const handleAlertSoundStop = (event) => {
      const alertId = event.detail?.id
      const currentPlayback = alertAudioRef.current

      if (!currentPlayback) {
        return
      }

      if (alertId && currentPlayback.id !== alertId) {
        return
      }

      stopAlertAudio(event.detail?.reason ?? 'dismissed')
    }

    window.addEventListener('lab-alert:sound', handleAlertSound)
    window.addEventListener('lab-alert:sound-stop', handleAlertSoundStop)
    const removeExclusiveAudioListener = addExclusiveAudioListener(
      ALERT_AUDIO_SOURCE_ID,
      () => stopAlertAudio('interrupted'),
    )

    return () => {
      window.removeEventListener('lab-alert:sound', handleAlertSound)
      window.removeEventListener('lab-alert:sound-stop', handleAlertSoundStop)
      removeExclusiveAudioListener()
      stopAlertAudio()
    }
  }, [stopAlertAudio])

  const releaseDedupeKey = useCallback((alert) => {
    if (alert?.dedupeKey) {
      activeDedupeKeysRef.current.delete(alert.dedupeKey)
    }
  }, [])

  const releaseActiveAlerts = useCallback(() => {
    const currentState = alertStateRef.current

    currentState.queue.forEach(releaseDedupeKey)
    currentState.topRightAlerts.forEach(releaseDedupeKey)
    releaseDedupeKey(currentState.centerAlert)
  }, [releaseDedupeKey])

  const normalizeAlert = useCallback((alert) => {
    const type = ALERT_TYPES.includes(alert.type) ? alert.type : 'info'
    const requiresConfirmation = Boolean(alert.requiresConfirmation)
    const critical = Boolean(alert.critical)
    const id = `lab-alert-${Date.now()}-${nextIdRef.current += 1}`
    const placement = getPlacement({
      critical,
      placement: alert.placement,
      requiresConfirmation,
      type,
    })

    return {
      ...alert,
      critical,
      duration: requiresConfirmation ? null : alert.duration ?? DEFAULT_DURATIONS[type],
      icon: alert.icon ?? DEFAULT_ICONS[type],
      id,
      placement,
      requiresConfirmation,
      title: alert.title ?? 'Lab Alert',
      type,
    }
  }, [])

  const showAlert = useCallback((alert) => {
    const nextAlert = normalizeAlert(alert)
    const dedupeKey = nextAlert.dedupeKey
    const now = Date.now()

    if (nextAlert.replaceExisting) {
      releaseActiveAlerts()
    }

    if (dedupeKey) {
      const lastShownAt = recentAlertsRef.current.get(dedupeKey)
      const dedupeWindow = nextAlert.dedupeWindow ?? DEDUPE_WINDOW

      if (
        activeDedupeKeysRef.current.has(dedupeKey)
        || (lastShownAt && now - lastShownAt < dedupeWindow)
      ) {
        return null
      }

      activeDedupeKeysRef.current.add(dedupeKey)
      recentAlertsRef.current.set(dedupeKey, now)
    }

    dispatchAlert({
      alert: nextAlert,
      type: nextAlert.replaceExisting ? 'replace' : 'enqueue',
    })

    return nextAlert.id
  }, [normalizeAlert, releaseActiveAlerts])

  const showStepAlert = useCallback((preset, overrides = {}) => (
    showAlert({ ...preset, ...overrides })
  ), [showAlert])

  const confirmAlert = useCallback((alert) => new Promise((resolve) => {
    const alertId = showAlert({
      ...alert,
      onClose: () => resolve(false),
      onConfirm: () => resolve(true),
      placement: alert.placement ?? 'center',
      requiresConfirmation: true,
    })

    if (!alertId) {
      resolve(false)
    }
  }), [showAlert])

  const dismissAlert = useCallback((id) => {
    const currentState = alertStateRef.current
    const removedAlert = currentState.centerAlert?.id === id
      ? currentState.centerAlert
      : currentState.topRightAlerts.find((alert) => alert.id === id)

    releaseDedupeKey(removedAlert)
    dispatchAlert({ id, type: 'dismiss' })
  }, [releaseDedupeKey])

  const clearAlerts = useCallback(() => {
    releaseActiveAlerts()
    dispatchAlert({ type: 'clear' })
  }, [releaseActiveAlerts])

  const { centerAlert, topRightAlerts } = alertState

  const spotlightAlert = centerAlert ?? topRightAlerts.at(-1)
  const hasCriticalAlert = Boolean(centerAlert?.critical)

  const contextValue = useMemo(() => ({
    clearAlerts,
    confirmAlert,
    showAlert,
    showStepAlert,
  }), [clearAlerts, confirmAlert, showAlert, showStepAlert])

  return (
    <LabAlertContext.Provider value={contextValue}>
      {children}

      <LabAlertSpotlight target={spotlightAlert?.target} type={spotlightAlert?.type ?? 'info'} />

      {hasCriticalAlert ? <div aria-hidden="true" className="lab-alert-interaction-shield" /> : null}

      <div className="lab-alert-region lab-alert-region--top-right" aria-live="polite">
        {topRightAlerts.map((alert) => (
          <LabAlertCard alert={alert} key={alert.id} onDismiss={dismissAlert} />
        ))}
      </div>

      {centerAlert ? (
        <div
          aria-live={centerAlert.type === 'error' || centerAlert.type === 'warning' ? 'assertive' : 'polite'}
          className="lab-alert-region lab-alert-region--center"
        >
          <LabAlertCard alert={centerAlert} onDismiss={dismissAlert} />
        </div>
      ) : null}
    </LabAlertContext.Provider>
  )
}

export default LabAlertProvider
