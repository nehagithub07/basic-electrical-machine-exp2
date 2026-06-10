import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import { LabAlertContext } from './LabAlertContext.js'
import LabAlertCard from './LabAlertCard.jsx'
import LabAlertSpotlight from './LabAlertSpotlight.jsx'
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

const isConfiguredAudioSource = (audioSource) => (
  typeof audioSource === 'string' && audioSource.trim() !== '' && audioSource.trim() !== '#'
)

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

  const stopAlertAudio = useCallback(() => {
    const currentAudio = alertAudioRef.current

    if (!currentAudio) {
      return
    }

    currentAudio.pause()
    currentAudio.currentTime = 0
    alertAudioRef.current = null
  }, [])

  useEffect(() => {
    alertStateRef.current = alertState
  }, [alertState])

  useEffect(() => {
    const handleAlertSound = (event) => {
      const audioSource = event.detail?.audio

      if (!isConfiguredAudioSource(audioSource)) {
        return
      }

      stopAlertAudio()

      const audio = new Audio(audioSource)
      alertAudioRef.current = audio

      audio.play().catch(() => {
        if (alertAudioRef.current === audio) {
          alertAudioRef.current = null
        }
      })
    }

    window.addEventListener('lab-alert:sound', handleAlertSound)

    return () => {
      window.removeEventListener('lab-alert:sound', handleAlertSound)
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
