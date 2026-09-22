import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './ConnectionEndpoints.css'
import ConnectionLab from './components/ConnectionLab.jsx'
import ActionButtons from './components/ActionButtons.jsx'
import ControlPanel from './components/ControlPanel.jsx'
import GraphPanel from './components/GraphPanel.jsx'
import HeaderBoard from './components/HeaderBoard.jsx'
import WalkthroughStartButton from './walkthrough/components/WalkthroughStartButton.jsx'
import { useWalkthrough } from './walkthrough/useWalkthrough.js'
import { ALERT_AUDIO, ALERT_AUDIO_PLACEHOLDER, EXPERIMENT_ALERTS, getInstructionStep } from './alerts/experimentStepAlerts.js'
import { useLabAlerts } from './alerts/useLabAlerts.js'
import { useAiGuideNarration } from './aiGuide/useAiGuideNarration.js'
 
import { calculateReadings } from './utils/circuitMath.js'
import { prepareKclReport } from './utils/reportGenerator.js'
import { hasVerifiedReading } from './utils/verification.js'
 
const BASE_WIDTH = 1440
const BASE_HEIGHT = 960
const GRAPH_SECTION_GAP = 28
const GRAPH_SECTION_HEIGHT = 620
const FOOTER_SECTION_GAP = 16
const FOOTER_HEIGHT = 48
const CONTENT_HEIGHT = BASE_HEIGHT + GRAPH_SECTION_GAP + GRAPH_SECTION_HEIGHT + FOOTER_SECTION_GAP + FOOTER_HEIGHT
const PANEL_MAX_SCALE = 1.25
const PANEL_VIEWPORT_MARGIN = 24
const MIN_GRAPH_READINGS = 5
const MAX_OBSERVATIONS = 5
const INITIAL_RESISTANCE = 1000
const INITIAL_VOLTAGE = 1.0

const getTerminalPairKey = (connection) => {
  if (!connection?.sourceId || !connection?.targetId) {
    return null
  }

  return [connection.sourceId, connection.targetId].sort().join('|')
}

const AI_GUIDE_CONNECTION_STEP_BY_PAIR = {
  '1-endpoint|9-endpoint': 3,
  '10-endpoint|2-endpoint': 4,
  '11-endpoint|3-endpoint': 5,
  '12-endpoint|4-endpoint': 6,
  '13-endpoint|5-endpoint': 7,
  '14-endpoint|6-endpoint': 8,
  '15-endpoint|7-endpoint': 9,
  '16-endpoint|8-endpoint': 10,
}

const getTerminalPairKeyFromIds = (terminalIds) => (
  Array.isArray(terminalIds) && terminalIds.length === 2
    ? [...terminalIds].sort().join('|')
    : null
)

const getAiGuideConnectionStepId = (terminalIds) => {
  const pairKey = getTerminalPairKeyFromIds(terminalIds)

  return pairKey ? AI_GUIDE_CONNECTION_STEP_BY_PAIR[pairKey] : null
}

const isAiGuideConnectionStep = (stepId) => {
  const numericStepId = Number(stepId)

  return numericStepId >= 3 && numericStepId <= 10
}

const getActiveInstructionStep = ({
  allResistanceValuesAdjusted,
  connectionsReadyForCheck,
  connectionsVerified,
  graphGenerated,
  powerOn,
  readingCount,
  reportGenerated,
  voltageAdjusted,
}) => {
  if (!connectionsReadyForCheck && !connectionsVerified) {
    return 1
  }

  if (!connectionsVerified) {
    return 2
  }

  if (!allResistanceValuesAdjusted) {
    return 3
  }

  if (!powerOn) {
    return 4
  }

  if (readingCount >= MIN_GRAPH_READINGS) {
    if (!graphGenerated) {
      return 8
    }

    return reportGenerated ? 10 : 9
  }

  if (readingCount > 0) {
    return 7
  }

  return voltageAdjusted ? 6 : 5
}

const getInitialResistanceAdjusted = () => ({
  r1: false,
  r2: false,
  r3: false,
})

const getObservationSignature = ({ i1, i2, i3, voltage }) => (
  [
    Number(voltage).toFixed(1),
    Number(i1).toFixed(3),
    Number(i2).toFixed(3),
    Number(i3).toFixed(3),
  ].join('|')
)

const getScale = () => {
  if (typeof window === 'undefined') {
    return 1
  }

  const widthScale = (window.innerWidth - PANEL_VIEWPORT_MARGIN) / BASE_WIDTH
  return Math.max(Math.min(widthScale, PANEL_MAX_SCALE), 0.1)
}

const App = () => {
  const { clearAlerts, showStepAlert } = useLabAlerts()
  const { isOpen: walkthroughOpen, hasCompleted: walkthroughCompleted } = useWalkthrough()
  const [scale, setScale] = useState(getScale)
  const [r1, setR1] = useState(INITIAL_RESISTANCE)
  const [r2, setR2] = useState(INITIAL_RESISTANCE)
  const [r3, setR3] = useState(INITIAL_RESISTANCE)
  const [voltage, setVoltage] = useState(INITIAL_VOLTAGE)
  const [powerOn, setPowerOn] = useState(false)
  const [observations, setObservations] = useState([])
  const [graphGenerated, setGraphGenerated] = useState(false)
  const [reportGenerated, setReportGenerated] = useState(false)
  const [verificationReport, setVerificationReport] = useState({})
  const [status, setStatus] = useState('')

  const [autoConnectRequest, setAutoConnectRequest] = useState(0)
  const [autoConnecting, setAutoConnecting] = useState(false)
  const [checkRequest, setCheckRequest] = useState(0)
  const [resetRequest, setResetRequest] = useState(0)
  const [connectionsReadyForCheck, setConnectionsReadyForCheck] = useState(false)
  const [connectionsVerified, setConnectionsVerified] = useState(false)
  const [connectionGuidanceStarted, setConnectionGuidanceStarted] = useState(false)
  const [resistanceAdjusted, setResistanceAdjusted] = useState(getInitialResistanceAdjusted)
  const [voltageAdjusted, setVoltageAdjusted] = useState(false)
  const [sessionStart, setSessionStart] = useState(() => Date.now())
  const allConnectionsAlertShownRef = useRef(false)
  const lastConnectionInstructionAudioKeyRef = useRef(null)
  const resistanceValuesAlertShownRef = useRef(false)
  const voltageSetAudioPlayedRef = useRef(false)
  const walkthroughWasOpenRef = useRef(false)
  const nextRequiredConnectionRef = useRef(['1-endpoint', '9-endpoint'])
  const pendingReportRef = useRef(null)

  useEffect(() => {
    let frame
    const handleResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setScale(getScale()))
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const readings = useMemo(
    () => calculateReadings({ voltage: powerOn ? voltage : 0, r1, r2, r3 }),
    [powerOn, r1, r2, r3, voltage],
  )

  const normalizedVoltage = Number(voltage.toFixed(1))
  const currentReadingSignature = getObservationSignature({
    i1: readings.i1,
    i2: readings.i2,
    i3: readings.i3,
    voltage: normalizedVoltage,
  })
  const hasDuplicateReading = observations.some((row) => (
    row.voltage === normalizedVoltage
      || getObservationSignature(row) === currentReadingSignature
  ))
  const readingCount = observations.length
  const canPlotGraph = readingCount >= MIN_GRAPH_READINGS
  const canGenerateReport = hasVerifiedReading(observations, verificationReport)
  const allResistanceValuesAdjusted = resistanceAdjusted.r1 && resistanceAdjusted.r2 && resistanceAdjusted.r3
  const activeInstructionStep = useMemo(
    () => getActiveInstructionStep({
      allResistanceValuesAdjusted,
      connectionsReadyForCheck,
      connectionsVerified,
      graphGenerated,
      powerOn,
      readingCount,
      reportGenerated,
      voltageAdjusted,
    }),
    [
      allResistanceValuesAdjusted,
      connectionsReadyForCheck,
      connectionsVerified,
      graphGenerated,
      powerOn,
      readingCount,
      reportGenerated,
      voltageAdjusted,
    ],
  )

  const {
    activeStepId: activeAiGuideStepId,
    isPlaying: aiGuidePlaying,
    playStepsById: playAiGuideSteps,
    start: startAiGuide,
    stop: stopAiGuide,
    pause: pauseAiGuide,
    finish: finishAiGuide,
  } = useAiGuideNarration()

  const announceStep = useCallback((preset, { nextSteps = [], ...overrides } = {}) => {
    setStatus(preset.description)
    if ([preset.guideStepId, ...nextSteps].some(isAiGuideConnectionStep)) {
      setConnectionGuidanceStarted(true)
    }
    const narration = aiGuidePlaying
      ? playAiGuideSteps([preset.guideStepId, ...nextSteps])
      : null

    if (!preset.audioOnly) {
      showStepAlert(preset, {
        audio: aiGuidePlaying ? ALERT_AUDIO_PLACEHOLDER : preset.audio,
        audioSpeech: aiGuidePlaying ? null : preset.audioSpeech,
        guideNarration: narration,
        replaceExisting: true,
        ...overrides,
      })
    }
    return narration ?? Promise.resolve(true)
  }, [aiGuidePlaying, playAiGuideSteps, showStepAlert])

  const getResumeStepId = useCallback(() => {
    if (canGenerateReport) return 37
    if (graphGenerated) return 30
    if (readingCount >= MAX_OBSERVATIONS) return 28
    if (readingCount >= 2) return 26
    if (readingCount === 1) return 24
    if (powerOn) return voltageAdjusted ? 23 : 22
    if (allResistanceValuesAdjusted) return 21
    if (connectionsVerified) return 19
    if (connectionsReadyForCheck) return 11
    return getAiGuideConnectionStepId(nextRequiredConnectionRef.current) ?? 3
  }, [allResistanceValuesAdjusted, canGenerateReport, connectionsReadyForCheck,
    connectionsVerified, graphGenerated, powerOn, readingCount, voltageAdjusted])

  const handleAiGuide = useCallback(() => {
    if (aiGuidePlaying) {
      stopAiGuide()
      return
    }
    clearAlerts()
    const hasStartedExperiment = connectionsVerified || connectionsReadyForCheck
      || lastConnectionInstructionAudioKeyRef.current !== null
    const stepId = walkthroughCompleted || hasStartedExperiment ? getResumeStepId() : 1
    setConnectionGuidanceStarted(isAiGuideConnectionStep(stepId))
    const narration = startAiGuide(stepId)
    const preset = Object.values(EXPERIMENT_ALERTS).find((entry) => entry.guideStepId === stepId)
      ?? getInstructionStep(stepId)
    setStatus(preset.description)
    if (!preset.audioOnly) {
      showStepAlert(preset, {
        audio: ALERT_AUDIO_PLACEHOLDER,
        audioSpeech: null,
        guideNarration: narration,
        replaceExisting: true,
      })
    }
  }, [aiGuidePlaying, clearAlerts, connectionsReadyForCheck, connectionsVerified,
    getResumeStepId, showStepAlert, startAiGuide, stopAiGuide, walkthroughCompleted])
useEffect(() => {
  if (
    aiGuidePlaying
    && !walkthroughOpen
    && isAiGuideConnectionStep(activeAiGuideStepId)
  ) {
    setConnectionGuidanceStarted(true)
  }
}, [
  activeAiGuideStepId,
  aiGuidePlaying,
  walkthroughOpen,
])
  useEffect(() => {
    if (walkthroughOpen) {
      if (!walkthroughWasOpenRef.current) {
        walkthroughWasOpenRef.current = true
        pauseAiGuide()
        clearAlerts()
      }
      return
    }
    if (!walkthroughWasOpenRef.current) return
    walkthroughWasOpenRef.current = false
    if (aiGuidePlaying) {
      playAiGuideSteps(walkthroughCompleted ? [2, getResumeStepId()] : [1])
    }
  }, [aiGuidePlaying, clearAlerts, getResumeStepId, pauseAiGuide,
    playAiGuideSteps, walkthroughCompleted, walkthroughOpen])

  useEffect(() => {
    if (!connectionsVerified || !allResistanceValuesAdjusted || powerOn
      || resistanceValuesAlertShownRef.current) return
    resistanceValuesAlertShownRef.current = true
    announceStep(EXPERIMENT_ALERTS.resistanceValuesSelected)
  }, [allResistanceValuesAdjusted, announceStep, connectionsVerified, powerOn])

  useEffect(() => () => pendingReportRef.current?.dispose(), [])

  const markResistanceAdjusted = useCallback((resistanceKey) => {
    setResistanceAdjusted((current) => {
      if (current[resistanceKey]) {
        return current
      }

      return {
        ...current,
        [resistanceKey]: true,
      }
    })
  }, [])

  const handleR1Change = useCallback((nextResistance) => {
    setR1(nextResistance)

    if (nextResistance !== r1) {
      markResistanceAdjusted('r1')
    }
  }, [markResistanceAdjusted, r1])

  const handleR2Change = useCallback((nextResistance) => {
    setR2(nextResistance)

    if (nextResistance !== r2) {
      markResistanceAdjusted('r2')
    }
  }, [markResistanceAdjusted, r2])

  const handleR3Change = useCallback((nextResistance) => {
    setR3(nextResistance)

    if (nextResistance !== r3) {
      markResistanceAdjusted('r3')
    }
  }, [markResistanceAdjusted, r3])

  // const recordObservation = () => {
  //   if (!connectionsVerified) {
  //     announceStep(EXPERIMENT_ALERTS.cannotStartPower)
  //     return
  //   }
  //   if (!powerOn) {
  //     announceStep(EXPERIMENT_ALERTS.resistanceValuesSelected)
  //     return
  //   }
  //   if (!voltageAdjusted || normalizedVoltage <= 0) {
  //     announceStep(EXPERIMENT_ALERTS.powerOn)
  //     return
  //   }
  //   if (readingCount >= MAX_OBSERVATIONS) {
  //     announceStep(EXPERIMENT_ALERTS.maxReadingsReached)
  //     return
  //   }
  //   if (hasDuplicateReading) {
  //     announceStep(EXPERIMENT_ALERTS.readingAlreadyExists)
  //     return
  //   }

  //   const nextObservation = {
  //     id: (observations.at(-1)?.id ?? 0) + 1,
  //     voltage: normalizedVoltage,
  //     r1,
  //     r2,
  //     r3,
  //     totalResistance: readings.totalResistance,
  //     i1: readings.i1,
  //     i2: readings.i2,
  //     i3: readings.i3,
  //   }
  //   const nextObservationCount = readingCount + 1
  //   setObservations([...observations, nextObservation])
  //   setGraphGenerated(false)
  //   setReportGenerated(false)
  //   if (nextObservationCount === 1) announceStep(EXPERIMENT_ALERTS.readingAdded)
  //   else if (nextObservationCount === 2) announceStep(EXPERIMENT_ALERTS.secondReadingAdded)
  //   else if (nextObservationCount === MAX_OBSERVATIONS) announceStep(EXPERIMENT_ALERTS.fiveReadingsRecorded)
  // }
  const recordObservation = () => {
  if (!connectionsVerified) {
    announceStep(EXPERIMENT_ALERTS.cannotStartPower)
    return
  }

  if (!powerOn) {
    announceStep(EXPERIMENT_ALERTS.resistanceValuesSelected)
    return
  }

  if (!voltageAdjusted || normalizedVoltage <= 0) {
    announceStep(EXPERIMENT_ALERTS.powerOn)
    return
  }

  if (readingCount >= MAX_OBSERVATIONS) {
    announceStep(EXPERIMENT_ALERTS.maxReadingsReached)
    return
  }

  if (hasDuplicateReading) {
    announceStep(EXPERIMENT_ALERTS.readingAlreadyExists)
    return
  }

  const nextObservation = {
    id: (observations.at(-1)?.id ?? 0) + 1,
    voltage: normalizedVoltage,
    r1,
    r2,
    r3,
    totalResistance: readings.totalResistance,
    i1: readings.i1,
    i2: readings.i2,
    i3: readings.i3,
  }

  const nextObservationCount = readingCount + 1

  setObservations([...observations, nextObservation])
  setGraphGenerated(false)
  setReportGenerated(false)

  // Disable Add again after successfully adding a reading.
  // User must set/change the power supply value before adding the next reading.
  setVoltageAdjusted(false)
  voltageSetAudioPlayedRef.current = false

  if (nextObservationCount === 1) {
    announceStep(EXPERIMENT_ALERTS.readingAdded)
  } else if (nextObservationCount === 2) {
    announceStep(EXPERIMENT_ALERTS.secondReadingAdded)
  } else if (nextObservationCount === MAX_OBSERVATIONS) {
    announceStep(EXPERIMENT_ALERTS.fiveReadingsRecorded)
  }
}
  const handleReset = () => {
    clearAlerts()
    pauseAiGuide()
    pendingReportRef.current?.dispose()
    pendingReportRef.current = null
    setPowerOn(false)
    setVoltage(INITIAL_VOLTAGE)
    setR1(INITIAL_RESISTANCE)
    setR2(INITIAL_RESISTANCE)
    setR3(INITIAL_RESISTANCE)
    setObservations([])
    setGraphGenerated(false)
    setReportGenerated(false)
    setVerificationReport({})
    setAutoConnectRequest(0)
    setAutoConnecting(false)
    setCheckRequest(0)
    setConnectionsReadyForCheck(false)
    setConnectionsVerified(false)
    setConnectionGuidanceStarted(aiGuidePlaying)
    setResistanceAdjusted(getInitialResistanceAdjusted())
    setVoltageAdjusted(false)
    setResetRequest((current) => current + 1)
    setSessionStart(Date.now())
    allConnectionsAlertShownRef.current = false
    lastConnectionInstructionAudioKeyRef.current = null
    resistanceValuesAlertShownRef.current = false
    voltageSetAudioPlayedRef.current = false
    walkthroughWasOpenRef.current = false
    nextRequiredConnectionRef.current = ['1-endpoint', '9-endpoint']
    announceStep(EXPERIMENT_ALERTS.resetSuccess, { nextSteps: [3] })
  }

  const handlePlot = () => {
    if (!canPlotGraph) return
    setGraphGenerated(true)
    setReportGenerated(false)
    announceStep(EXPERIMENT_ALERTS.graphPlotted)
  }

   const handlePrint = () => {
     const audio = new Audio(ALERT_AUDIO.print)
   
     audio.play()
       .then(() => {
         setTimeout(() => {
           window.print()
         }, 300)
       })
       .catch((error) => {
         console.warn('Unable to play print audio:', error)
         window.print()
       })
   }
  const handleGenerateReport = () => {
    if (!canGenerateReport) return
    pendingReportRef.current?.dispose()
    const report = prepareKclReport({
      observations,
      resistances: { r1, r2, r3 },
      sessionStart,
      verification: verificationReport,
    })
    pendingReportRef.current = report
    setReportGenerated(true)
    announceStep(EXPERIMENT_ALERTS.reportGenerated, {
      critical: true,
      confirmLabel: 'OK',
      requiresConfirmation: true,
      onConfirm: () => {
        if (!report.open()) return false
        pendingReportRef.current = null
        finishAiGuide()
        return true
      },
      onClose: () => {
        report.dispose()
        if (pendingReportRef.current === report) pendingReportRef.current = null
      },
    })
  }

  const playConnectionCorrection = useCallback((result) => {
    const preset = result.invalidConnectionCount > 1
      ? EXPERIMENT_ALERTS.multipleWrongConnections
      : EXPERIMENT_ALERTS.incorrectNodeConnection
    const correctionStep = getAiGuideConnectionStepId(result.nextRequiredConnection)
    announceStep(preset, { nextSteps: correctionStep ? [correctionStep] : [] })
  }, [announceStep])

  const handleConnectionChange = useCallback((result) => {
    nextRequiredConnectionRef.current = result.nextRequiredConnection
    if (connectionsVerified) return
    if (result.latestConnectionIsWrong) {
      setConnectionsReadyForCheck(false)
      allConnectionsAlertShownRef.current = false
      playConnectionCorrection(result)
      return
    }
    if (result.isCorrect) {
      setConnectionsReadyForCheck(true)
      if (!allConnectionsAlertShownRef.current) {
        allConnectionsAlertShownRef.current = true
        announceStep(EXPERIMENT_ALERTS.allConnectionsCompleted)
      }
      return
    }

    setConnectionsReadyForCheck(false)
    allConnectionsAlertShownRef.current = false
    const latestPair = getTerminalPairKey(result.latestConnection)
    const nextGuideStep = getAiGuideConnectionStepId(result.nextRequiredConnection)
    if (nextGuideStep && (!latestPair || lastConnectionInstructionAudioKeyRef.current !== latestPair)) {
      lastConnectionInstructionAudioKeyRef.current = latestPair
      announceStep(getInstructionStep(nextGuideStep))
    }
  }, [announceStep, connectionsVerified, playConnectionCorrection])

  const handleCheckConnections = useCallback((result) => {
    setAutoConnecting(false)
    nextRequiredConnectionRef.current = result.nextRequiredConnection
    if (result.isCorrect) {
      setConnectionsVerified(true)
      setConnectionsReadyForCheck(true)
      setResistanceAdjusted(getInitialResistanceAdjusted())
      allConnectionsAlertShownRef.current = true
      resistanceValuesAlertShownRef.current = false
      announceStep(result.autoConnected
        ? EXPERIMENT_ALERTS.circuitConnectionsCompleted
        : EXPERIMENT_ALERTS.connectionsVerified)
      return
    }

    setConnectionsVerified(false)
    setConnectionsReadyForCheck(false)
    setResistanceAdjusted(getInitialResistanceAdjusted())
    allConnectionsAlertShownRef.current = false
    if (result.hasInvalidConnection) {
      playConnectionCorrection(result)
      return
    }
    const correctionStep = getAiGuideConnectionStepId(result.nextRequiredConnection)
    announceStep(EXPERIMENT_ALERTS.requiredConnectionsFirst, {
      nextSteps: correctionStep ? [correctionStep] : [],
    })
  }, [announceStep, playConnectionCorrection])

  const handleCheck = () => {
    if (autoConnecting || connectionsVerified) return
    setCheckRequest((current) => current + 1)
  }

  const handleTogglePower = () => {
    if (powerOn) return
    if (!connectionsVerified) {
      announceStep(EXPERIMENT_ALERTS.cannotStartPower)
      return
    }
    if (!allResistanceValuesAdjusted) {
      announceStep(EXPERIMENT_ALERTS.adjustResistance)
      return
    }
    setPowerOn(true)
    setVoltageAdjusted(false)
    voltageSetAudioPlayedRef.current = false
    announceStep(EXPERIMENT_ALERTS.powerOn)
  }

  const handleAutoConnect = () => {
    if (autoConnecting || connectionsVerified) return
    setAutoConnecting(true)
    setAutoConnectRequest((current) => current + 1)
    setConnectionsReadyForCheck(false)
    setConnectionsVerified(false)
    setResistanceAdjusted(getInitialResistanceAdjusted())
    allConnectionsAlertShownRef.current = true
    lastConnectionInstructionAudioKeyRef.current = null
    resistanceValuesAlertShownRef.current = false
    voltageSetAudioPlayedRef.current = false
  }

  // const handleVoltageChange = useCallback((nextVoltage) => {
  //   setVoltage(nextVoltage)
  //   if (powerOn && nextVoltage !== INITIAL_VOLTAGE) {
  //     setVoltageAdjusted(true)
  //     if (!voltageSetAudioPlayedRef.current) {
  //       voltageSetAudioPlayedRef.current = true
  //       announceStep(EXPERIMENT_ALERTS.voltageSet)
  //     }
  //   }
  // }, [announceStep, powerOn])
   const handleVoltageChange = useCallback((nextVoltage) => {
  const voltageChanged = nextVoltage !== INITIAL_VOLTAGE

  setVoltage(nextVoltage)

  // A fresh voltage selection is required before each reading can be added.
  if (powerOn && voltageChanged) {
    setVoltageAdjusted(true)

    if (!voltageSetAudioPlayedRef.current) {
      voltageSetAudioPlayedRef.current = true
      announceStep(EXPERIMENT_ALERTS.voltageSet)
    }
  }
}, [announceStep, powerOn, voltage])
  const scaledWidth = Math.ceil(BASE_WIDTH * scale)
  const scaledHeight = Math.ceil(CONTENT_HEIGHT * scale)

  return (
    <div id="app-wrapper">
      <div
        id="app-viewport"
        style={{
          height: `${scaledHeight}px`,
          width: `${scaledWidth}px`,
        }}
      >
        <div
          id="app-scale"
          style={{
            height: `${CONTENT_HEIGHT}px`,
            zoom: scale,
          }}
        >
          <main className="simulation-shell" id="walkthrough-demo-experiment">
            <HeaderBoard />
            <WalkthroughStartButton highlighted={aiGuidePlaying && String(activeAiGuideStepId) === '1'} variant="side-tab" />
            <span className="sr-only" role="status" aria-live="polite">{status}</span>

            <section className="workspace-grid">
              <aside className="left-panel">
                <ActionButtons
                  activeInstructionStep={activeInstructionStep}
                  activeButtons={{
                    onAiGuide: aiGuidePlaying,
                  }}
                  disabledButtons={{
                    onAdd: !powerOn || !voltageAdjusted,
                    onAutoConnect: autoConnecting || connectionsVerified || powerOn,
                    onCheck: autoConnecting || connectionsVerified,
                    onPlot: !canPlotGraph,
                    onPrint: false,
                  }}
                  onAdd={recordObservation}
                  onCheck={handleCheck}
                  onPlot={handlePlot}
                  onPrint={handlePrint}
                  onReset={handleReset}
                  onAutoConnect={handleAutoConnect}
                  onAiGuide={handleAiGuide}
                />

                <ControlPanel
                  canGenerateReport={canGenerateReport}
                  locked={!connectionsVerified || powerOn || observations.length > 0}
                  observations={observations}
                  onGenerateReport={handleGenerateReport}
                  reportGenerated={reportGenerated}
                  r1={r1}
                  r2={r2}
                  r3={r3}
                  setR1={handleR1Change}
                  setR2={handleR2Change}
                  setR3={handleR3Change}
                />
              </aside>

              <section className="right-panel">

             
                   <ConnectionLab
                     aiGuideActive={aiGuidePlaying}
                     guideEndpointHighlightActive={
                       aiGuidePlaying
                       && !walkthroughOpen
                       && !connectionsVerified
                       && connectionGuidanceStarted
                     }
                     key={`connection-lab-${resetRequest}`}
                  autoConnectRequest={autoConnectRequest}
                  checkRequest={checkRequest}
                  onConnectionChange={handleConnectionChange}
                  onCheckConnections={handleCheckConnections}
                  powerOn={powerOn}
                  r1={r1}
                  r2={r2}
                  r3={r3}
                  readings={readings}
                  resetRequest={resetRequest}
                  scale={scale}
                  onTogglePower={handleTogglePower}
                  setVoltage={handleVoltageChange}
                  voltage={voltage}
                />
              </section>
            </section>

          </main>

          <GraphPanel
            key={`graph-panel-${resetRequest}`}
            className="graph-panel--separate"
            id="graph-panel"
            observations={observations}
            onVerificationChange={(verification) => {
              setReportGenerated(false)
              setVerificationReport((current) => ({ ...current, [verification.readingId]: verification }))
            }}
            onVerificationResult={(outcome) => announceStep(EXPERIMENT_ALERTS[outcome])}
            plotted={graphGenerated}
          />

          <footer className="app-footer" aria-label="Copyright">
            &copy; 2026 Virtual Labs IIT Roorkee
          </footer>
        </div>
      </div>
    </div>
  )
}

export default App
