import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './ConnectionEndpoints.css'
import ConnectionLab from './components/ConnectionLab.jsx'
import ActionButtons from './components/ActionButtons.jsx'
import ControlPanel from './components/ControlPanel.jsx'
import GraphPanel from './components/GraphPanel.jsx'
import HeaderBoard from './components/HeaderBoard.jsx'
import ReportControls from './components/ReportControls.jsx'
import WalkthroughStartButton from './walkthrough/components/WalkthroughStartButton.jsx'
import { useWalkthrough } from './walkthrough/useWalkthrough.js'
import { ALERT_AUDIO, ALERT_AUDIO_PLACEHOLDER, EXPERIMENT_ALERTS } from './alerts/experimentStepAlerts.js'
import { useLabAlerts } from './alerts/useLabAlerts.js'
import { useAiGuideNarration } from './aiGuide/useAiGuideNarration.js'
// import StatusBar from './components/StatusBar.jsx'
 
import { calculateReadings } from './utils/circuitMath.js'
import { generateKclReport } from './utils/reportGenerator.js'
 
const BASE_WIDTH = 1440
const BASE_HEIGHT = 960
const GRAPH_SECTION_GAP = 28
const GRAPH_SECTION_HEIGHT = 430
const FOOTER_SECTION_GAP = 16
const FOOTER_HEIGHT = 48
const CONTENT_HEIGHT = BASE_HEIGHT + GRAPH_SECTION_GAP + GRAPH_SECTION_HEIGHT + FOOTER_SECTION_GAP + FOOTER_HEIGHT
const PANEL_MAX_SCALE = 1
const PANEL_VIEWPORT_MARGIN = 24
const MIN_GRAPH_READINGS = 6
const MAX_OBSERVATIONS = 10
const INITIAL_RESISTANCE = 1.0
const INITIAL_VOLTAGE = 1.0

const getTerminalPairKey = (connection) => {
  if (!connection?.sourceId || !connection?.targetId) {
    return null
  }

  return [connection.sourceId, connection.targetId].sort().join('|')
}

const NEXT_CONNECTION_AUDIO_BY_PAIR = {
  '1-endpoint|9-endpoint': ALERT_AUDIO.connect2To10,
  '10-endpoint|2-endpoint': ALERT_AUDIO.connect3To11,
  '11-endpoint|3-endpoint': ALERT_AUDIO.connect4To12,
  '12-endpoint|4-endpoint': ALERT_AUDIO.connect5To13,
  '13-endpoint|5-endpoint': ALERT_AUDIO.connect6To14,
  '14-endpoint|6-endpoint': ALERT_AUDIO.connect7To15,
  '15-endpoint|7-endpoint': ALERT_AUDIO.connect8To16,
}

const CONNECTION_PROMPT_AUDIO_BY_PAIR = {
  '1-endpoint|9-endpoint': ALERT_AUDIO.connect1To9,
  '10-endpoint|2-endpoint': ALERT_AUDIO.connect2To10,
  '11-endpoint|3-endpoint': ALERT_AUDIO.connect3To11,
  '12-endpoint|4-endpoint': ALERT_AUDIO.connect4To12,
  '13-endpoint|5-endpoint': ALERT_AUDIO.connect5To13,
  '14-endpoint|6-endpoint': ALERT_AUDIO.connect6To14,
  '15-endpoint|7-endpoint': ALERT_AUDIO.connect7To15,
  '16-endpoint|8-endpoint': ALERT_AUDIO.connect8To16,
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

const AI_GUIDE_TARGET_SELECTORS_BY_STEP_ID = {
  1: ['#walkthrough-start-button'],
  2: ['#auto-connect-button', '#circuit-panel'],
  3: ['#circuit-panel'],
  4: ['#circuit-panel'],
  5: ['#circuit-panel'],
  6: ['#circuit-panel'],
  7: ['#circuit-panel'],
  8: ['#circuit-panel'],
  9: ['#circuit-panel'],
  10: ['#circuit-panel'],
  11: ['#check-button'],
  12: ['#circuit-panel'],
  13: ['#circuit-panel'],
  14: ['#circuit-panel'],
  15: ['#check-button'],
  16: ['#observation-table-panel'],
  17: ['#observation-table-panel'],
  18: ['#check-button', '#power-toggle-button'],
  19: ['#resistance-controls'],
  20: ['#resistance-controls', '#power-toggle-button'],
  21: ['#power-toggle-button'],
  22: ['#voltage-control'],
  23: ['#ammeter-bank', '#add-reading-button'],
  24: ['#voltage-control', '#add-reading-button'],
  25: ['#voltage-control'],
  26: ['#voltage-control', '#add-reading-button'],
  27: ['#plot-button'],
  28: ['#plot-button', '#generate-report-button'],
  29: ['#plot-button'],
  30: ['#generate-report-button', '#print-button', '#reset-button'],
  31: ['#circuit-panel'],
  32: ['#print-button'],
  33: ['#generate-report-button'],
}

const getTerminalNumber = (terminalId) => terminalId?.replace('-endpoint', '') ?? ''

const getTerminalPairKeyFromIds = (terminalIds) => (
  Array.isArray(terminalIds) && terminalIds.length === 2
    ? [...terminalIds].sort().join('|')
    : null
)

const getAiGuideConnectionStepId = (terminalIds) => {
  const pairKey = getTerminalPairKeyFromIds(terminalIds)

  return pairKey ? AI_GUIDE_CONNECTION_STEP_BY_PAIR[pairKey] : null
}

const getConnectionPromptAudio = (terminalIds) => {
  const pairKey = getTerminalPairKeyFromIds(terminalIds)

  return pairKey ? CONNECTION_PROMPT_AUDIO_BY_PAIR[pairKey] : null
}

const isAiGuideConnectionStep = (stepId) => {
  const numericStepId = Number(stepId)

  return numericStepId >= 3 && numericStepId <= 10
}

const getAiGuideTargetSelectors = (stepId) => (
  AI_GUIDE_TARGET_SELECTORS_BY_STEP_ID[Number(stepId)] ?? []
)

const getConnectionPromptText = (terminalIds) => {
  if (!Array.isArray(terminalIds) || terminalIds.length !== 2) {
    return 'Follow the highlighted terminals to complete the next connection.'
  }

  const [sourceId, targetId] = terminalIds

  return `Connect terminal ${getTerminalNumber(sourceId)} to terminal ${getTerminalNumber(targetId)}.`
}

const playLabAlertAudio = (audio) => {
  if (typeof window === 'undefined' || !audio || audio === '#') {
    return
  }

  window.dispatchEvent(new CustomEvent('lab-alert:sound', {
    detail: { audio },
  }))
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
  const heightScale = (window.innerHeight - PANEL_VIEWPORT_MARGIN) / BASE_HEIGHT

  return Math.max(Math.min(widthScale, heightScale, PANEL_MAX_SCALE), 0.1)
}

const App = () => {
  const { clearAlerts, showStepAlert } = useLabAlerts()
  const { isOpen: walkthroughOpen } = useWalkthrough()
  const [scale, setScale] = useState(getScale)
  const [r1, setR1] = useState(INITIAL_RESISTANCE)
  const [r2, setR2] = useState(INITIAL_RESISTANCE)
  const [r3, setR3] = useState(INITIAL_RESISTANCE)
  const [voltage, setVoltage] = useState(INITIAL_VOLTAGE)
  const [powerOn, setPowerOn] = useState(false)
  const [observations, setObservations] = useState([])
  const [graphGenerated, setGraphGenerated] = useState(false)
  const [reportGenerated, setReportGenerated] = useState(false)
  const [status, setStatus] = useState('Make the connections, click CHECK, then set the resistance values.')

  const [autoConnectRequest, setAutoConnectRequest] = useState(0)
  const [checkRequest, setCheckRequest] = useState(0)
  const [resetRequest, setResetRequest] = useState(0)
  const [connectionsReadyForCheck, setConnectionsReadyForCheck] = useState(false)
  const [connectionsVerified, setConnectionsVerified] = useState(false)
  const [resistanceAdjusted, setResistanceAdjusted] = useState(getInitialResistanceAdjusted)
  const [voltageAdjusted, setVoltageAdjusted] = useState(false)
  const [sessionStart, setSessionStart] = useState(() => Date.now())
  const allConnectionsAlertShownRef = useRef(false)
  const lastConnectionInstructionAudioKeyRef = useRef(null)
  const resistanceValuesAlertShownRef = useRef(false)
  const interfaceIntroPlayedRef = useRef(false)
  const voltageSetAudioPlayedRef = useRef(false)
  const walkthroughWasOpenRef = useRef(false)

  useEffect(() => {
    const handleResize = () => setScale(getScale())

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
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
  const allResistanceValuesAdjusted = resistanceAdjusted.r1 && resistanceAdjusted.r2 && resistanceAdjusted.r3
  const activeInstructionStep = useMemo(() => {
    if (reportGenerated) {
      return 10
    }

    if (graphGenerated) {
      return 9
    }

    if (readingCount >= MIN_GRAPH_READINGS) {
      return 8
    }

    if (!powerOn && allResistanceValuesAdjusted) {
      return 4
    }

    if (powerOn && readingCount > 0) {
      return 7
    }

    if (powerOn && voltageAdjusted) {
      return 6
    }

    if (powerOn) {
      return 5
    }

    if (connectionsVerified) {
      return 3
    }

    if (connectionsReadyForCheck) {
      return 2
    }

    return 1
  }, [
    allResistanceValuesAdjusted,
    connectionsReadyForCheck,
    connectionsVerified,
    graphGenerated,
    powerOn,
    readingCount,
    reportGenerated,
    voltageAdjusted,
  ])

  useEffect(() => {
    if (!connectionsVerified || !allResistanceValuesAdjusted || powerOn) {
      return
    }

    if (resistanceValuesAlertShownRef.current) {
      return
    }

    resistanceValuesAlertShownRef.current = true
    showStepAlert(EXPERIMENT_ALERTS.resistanceValuesSelected)
  }, [allResistanceValuesAdjusted, connectionsVerified, powerOn, showStepAlert])

  const handleAiGuideStart = useCallback(() => {
    setStatus('AI Guide narration started.')
  }, [])

  const handleAiGuideFinish = useCallback(() => {
    setStatus('AI Guide narration completed.')
  }, [])

  const handleAiGuideError = useCallback(() => {
    setStatus('AI Guide narration could not start. Add audio files or use a browser with speech synthesis.')
  }, [])

  const {
    activeStepId: activeAiGuideStepId,
    isPlaying: aiGuidePlaying,
    playAudioSource: playAiGuideAudio,
    playText: playAiGuideText,
    playStepsById: playAiGuideSteps,
    start: startAiGuide,
    stop: stopAiGuide,
  } = useAiGuideNarration({
    onError: handleAiGuideError,
    onFinish: handleAiGuideFinish,
    onStart: handleAiGuideStart,
  })

  const playWrongConnectionCorrection = useCallback(async (terminalIds) => {
    const correctionAudio = getConnectionPromptAudio(terminalIds)
    const correctionText = getConnectionPromptText(terminalIds)

    await playAiGuideSteps([12])

    if (correctionAudio && correctionAudio !== ALERT_AUDIO_PLACEHOLDER) {
      await playAiGuideAudio(
        correctionAudio,
        {
          activeStepId: getAiGuideConnectionStepId(terminalIds),
          fallbackText: correctionText,
        },
      )
      return
    }

    await playAiGuideText(correctionText, {
      activeStepId: getAiGuideConnectionStepId(terminalIds),
    })
  }, [playAiGuideAudio, playAiGuideSteps, playAiGuideText])

  useEffect(() => {
    const highlightedElements = getAiGuideTargetSelectors(activeAiGuideStepId)
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))

    highlightedElements.forEach((element) => {
      element.classList.add('ai-guide-active-target')
    })

    return () => {
      highlightedElements.forEach((element) => {
        element.classList.remove('ai-guide-active-target')
      })
    }
  }, [activeAiGuideStepId])

  const handleAiGuide = useCallback(() => {
    if (aiGuidePlaying) {
      stopAiGuide()
      interfaceIntroPlayedRef.current = false
      walkthroughWasOpenRef.current = false
      setStatus('AI Guide narration stopped.')
      return
    }

    interfaceIntroPlayedRef.current = false
    walkthroughWasOpenRef.current = false
    startAiGuide()
  }, [aiGuidePlaying, startAiGuide, stopAiGuide])

  useEffect(() => {
    if (walkthroughOpen) {
      walkthroughWasOpenRef.current = true
      return
    }

    if (
      !aiGuidePlaying
      || !walkthroughWasOpenRef.current
      || interfaceIntroPlayedRef.current
    ) {
      return
    }

    interfaceIntroPlayedRef.current = true
    playAiGuideSteps([2, 3])
  }, [aiGuidePlaying, playAiGuideSteps, walkthroughOpen])

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

  const recordObservation = () => {
    if (!connectionsVerified) {
      setStatus('Check the circuit connections before adding readings.')
      showStepAlert(EXPERIMENT_ALERTS.connectionErrorFound, {
        description: 'Verify the wiring before storing current readings.',
        stepNumber: 6,
        target: '#check-button',
        type: 'warning',
      })
      return
    }

    if (!powerOn) {
      setStatus('Switch on the power supply before adding readings.')
      showStepAlert(EXPERIMENT_ALERTS.cannotStartPower, {
        description: 'Switch on the verified power supply before adding readings.',
        stepNumber: 6,
        target: '#power-toggle-button',
      })
      return
    }

    if (normalizedVoltage <= 0) {
      setStatus('Set the power supply voltage before adding a reading.')
      showStepAlert(EXPERIMENT_ALERTS.adjustVoltage, {
        dedupeKey: 'step-6-zero-voltage',
        description: 'Increase the voltage above 0 V before adding a reading.',
        target: '#voltage-control',
        type: 'warning',
      })
      return
    }

    if (readingCount >= MAX_OBSERVATIONS) {
      setStatus('Ten readings are already recorded. Plot the graph or reset for a new run.')
      showStepAlert(EXPERIMENT_ALERTS.maxReadingsReached)
      return
    }

    if (hasDuplicateReading) {
      setStatus('Duplicate reading cannot be added to the observation table.')
      showStepAlert(EXPERIMENT_ALERTS.readingAlreadyExists)
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
    setStatus('Reading added to the observation table.')

    if (nextObservationCount === 1) {
      showStepAlert(EXPERIMENT_ALERTS.readingAdded)
      return
    }

    if (nextObservationCount === 2) {
      playLabAlertAudio(ALERT_AUDIO.secondReadingAdded)
      return
    }

    if (nextObservationCount === MIN_GRAPH_READINGS) {
      showStepAlert(EXPERIMENT_ALERTS.sufficientData, {
        replaceExisting: true,
      })
      return
    }

    if (nextObservationCount === MAX_OBSERVATIONS) {
      showStepAlert(EXPERIMENT_ALERTS.tenReadingsRecorded, {
        replaceExisting: true,
      })
    }
  }

  const resetSimulation = useCallback(() => {
    stopAiGuide()
    setPowerOn(false)
    setVoltage(INITIAL_VOLTAGE)
    setR1(INITIAL_RESISTANCE)
    setR2(INITIAL_RESISTANCE)
    setR3(INITIAL_RESISTANCE)
    setObservations([])
    setGraphGenerated(false)
    setReportGenerated(false)
    setAutoConnectRequest(0)
    setCheckRequest(0)
    setConnectionsReadyForCheck(false)
    setConnectionsVerified(false)
    setResistanceAdjusted(getInitialResistanceAdjusted())
    setVoltageAdjusted(false)
    setResetRequest((current) => current + 1)
    setSessionStart(Date.now())
    allConnectionsAlertShownRef.current = false
    interfaceIntroPlayedRef.current = false
    lastConnectionInstructionAudioKeyRef.current = null
    resistanceValuesAlertShownRef.current = false
    voltageSetAudioPlayedRef.current = false
    walkthroughWasOpenRef.current = false
    setStatus('Simulation reset. Make the circuit connections again.')
    showStepAlert(EXPERIMENT_ALERTS.resetSuccess)
  }, [showStepAlert, stopAiGuide])

  const handleReset = () => {
    clearAlerts()
    resetSimulation()
  }

  const handlePlot = () => {
    if (!canPlotGraph) {
      const remainingReadings = MIN_GRAPH_READINGS - readingCount

      setGraphGenerated(false)
      setReportGenerated(false)
      setStatus(`Add ${remainingReadings} more reading(s) before plotting the graph.`)
      showStepAlert(EXPERIMENT_ALERTS.insufficientGraphReadings)
      return
    }

    setGraphGenerated(true)
    setReportGenerated(false)
    setStatus('Graph is plotted. Now you can generate the report.')
    showStepAlert(EXPERIMENT_ALERTS.graphPlotted, {
      replaceExisting: true,
    })
  }

  const handlePrint = () => {
    if (!canPlotGraph) {
      showStepAlert(EXPERIMENT_ALERTS.minimumReadingsRequired, {
        description: 'Collect at least 6 readings before preparing the print layout.',
      })
      return
    }

    if (!graphGenerated) {
      setStatus('Please generate the graph first.')
      showStepAlert(EXPERIMENT_ALERTS.insufficientGraphReadings, {
        description: 'Please generate the graph first.',
        target: '#plot-button',
        title: 'Generate Graph First',
        type: 'warning',
      })
      window.alert('Please generate the graph first.')
      return
    }

    playLabAlertAudio(ALERT_AUDIO.print)
    window.print()
  }

  const handleGenerateReport = () => {
    if (readingCount < MIN_GRAPH_READINGS) {
      const remainingReadings = MIN_GRAPH_READINGS - readingCount

      setStatus(`Add ${remainingReadings} more reading(s) before generating the report.`)
      showStepAlert(EXPERIMENT_ALERTS.minimumReadingsRequired, {
        description: `Add ${remainingReadings} more reading(s), then plot the graph before generating a report.`,
        target: '#generate-report-button',
        title: 'Report Requires 6 Readings',
      })
      return
    }

    if (!graphGenerated) {
      setStatus('Please generate the graph first.')
      showStepAlert(EXPERIMENT_ALERTS.insufficientGraphReadings, {
        description: 'Please generate the graph first.',
        target: '#plot-button',
        title: 'Generate Graph First',
        type: 'warning',
      })
      window.alert('Please generate the graph first.')
      return
    }

    setStatus('Report Generated: Your report has been generated successfully. Click OK to view your report.')
    showStepAlert(EXPERIMENT_ALERTS.printLayoutGenerated, {
      onConfirm: () => {
        const generated = generateKclReport({
          observations,
          resistances: { r1, r2, r3 },
          sessionStart,
        })

        if (!generated) {
          setStatus('Unable to open the report window.')
          window.alert('Unable to open the report window. Please allow pop-ups and try again.')
          return
        }

        setReportGenerated(true)
        setStatus('Experiment report generated from the plotted graph and current observations.')
      },
      replaceExisting: true,
      requiresConfirmation: true,
    })
  }

  const scaledWidth = Math.ceil(BASE_WIDTH * scale)
  const scaledHeight = Math.ceil(CONTENT_HEIGHT * scale)
  const handleConnectionChange = useCallback((result) => {
    if (connectionsVerified) {
      return
    }

    if (result.latestConnectionIsWrong) {
      const correctionLine = getConnectionPromptText(result.nextRequiredConnection)
      const correctionAudio = getConnectionPromptAudio(result.nextRequiredConnection)
      const hasCorrectionAudio = correctionAudio && correctionAudio !== ALERT_AUDIO_PLACEHOLDER

      setConnectionsReadyForCheck(false)
      setStatus('This connection is wrong')
      showStepAlert(EXPERIMENT_ALERTS.incorrectNodeConnection, {
        audio: aiGuidePlaying ? ALERT_AUDIO_PLACEHOLDER : EXPERIMENT_ALERTS.incorrectNodeConnection.audio,
        audioSpeech: aiGuidePlaying || hasCorrectionAudio ? null : correctionLine,
        dedupeKey: null,
        description: correctionLine,
        followUpAudio: !aiGuidePlaying && hasCorrectionAudio ? correctionAudio : ALERT_AUDIO_PLACEHOLDER,
        replaceExisting: true,
        title: 'This connection is wrong.',
      })

      if (aiGuidePlaying) {
        playWrongConnectionCorrection(result.nextRequiredConnection)
      }

      return
    }

    const latestConnectionPairKey = getTerminalPairKey(result.latestConnection)
    const nextConnectionAudio = latestConnectionPairKey
      ? NEXT_CONNECTION_AUDIO_BY_PAIR[latestConnectionPairKey]
      : null
    const nextGuideStepId = getAiGuideConnectionStepId(result.nextRequiredConnection)

    if (
      nextConnectionAudio
      && lastConnectionInstructionAudioKeyRef.current !== latestConnectionPairKey
    ) {
      lastConnectionInstructionAudioKeyRef.current = latestConnectionPairKey

      if (aiGuidePlaying && nextGuideStepId) {
        playAiGuideSteps([nextGuideStepId])
      } else {
        playLabAlertAudio(nextConnectionAudio)
      }
    }

    if (!result.isCorrect) {
      setConnectionsReadyForCheck(false)
      allConnectionsAlertShownRef.current = false
      return
    }

    setConnectionsReadyForCheck(true)

    if (allConnectionsAlertShownRef.current) {
      return
    }

    allConnectionsAlertShownRef.current = true
    setStatus('All connections are completed. Click on the check button to verify the connections.')
    showStepAlert(EXPERIMENT_ALERTS.allConnectionsCompleted, {
      audio: aiGuidePlaying ? ALERT_AUDIO_PLACEHOLDER : EXPERIMENT_ALERTS.allConnectionsCompleted.audio,
      replaceExisting: true,
    })

    if (aiGuidePlaying) {
      playAiGuideSteps([11])
    }
  }, [aiGuidePlaying, connectionsVerified, playAiGuideSteps, playWrongConnectionCorrection, showStepAlert])

  const handleCheckConnections = useCallback((result) => {
    if (result.isCorrect) {
      setConnectionsVerified(true)
      setConnectionsReadyForCheck(true)
      setResistanceAdjusted(getInitialResistanceAdjusted())
      allConnectionsAlertShownRef.current = true
      resistanceValuesAlertShownRef.current = false

      setStatus(
        'Right connections! Move R1, R2, and R3 before switching on the power supply.',
      )
      showStepAlert(EXPERIMENT_ALERTS.connectionsVerified)

      return
    }

    setConnectionsVerified(false)
    setConnectionsReadyForCheck(false)
    setResistanceAdjusted(getInitialResistanceAdjusted())
    allConnectionsAlertShownRef.current = false

    if (result.totalConnections === 0) {
      const correctionStepId = getAiGuideConnectionStepId(result.nextRequiredConnection)

      setStatus('Missing connections. Please make the required connections first.')
      showStepAlert(EXPERIMENT_ALERTS.missingConnections, {
        audio: aiGuidePlaying ? ALERT_AUDIO_PLACEHOLDER : EXPERIMENT_ALERTS.missingConnections.audio,
        description: `No wires are connected yet. ${getConnectionPromptText(result.nextRequiredConnection)}`,
        replaceExisting: true,
      })

      if (aiGuidePlaying) {
        playAiGuideSteps([14, correctionStepId].filter(Boolean))
      }

      return
    }

    const correctionStepId = getAiGuideConnectionStepId(result.nextRequiredConnection)
    const connectionPrompt = getConnectionPromptText(result.nextRequiredConnection)
    const connectionPromptAudio = getConnectionPromptAudio(result.nextRequiredConnection)
    const hasConnectionPromptAudio = connectionPromptAudio && connectionPromptAudio !== ALERT_AUDIO_PLACEHOLDER

    if (result.hasInvalidConnection) {
      setStatus('This connection is wrong. Follow the suggested terminal connection.')
      showStepAlert(EXPERIMENT_ALERTS.incorrectNodeConnection, {
        audio: aiGuidePlaying ? ALERT_AUDIO_PLACEHOLDER : EXPERIMENT_ALERTS.incorrectNodeConnection.audio,
        audioSpeech: aiGuidePlaying || hasConnectionPromptAudio ? null : connectionPrompt,
        description: connectionPrompt,
        followUpAudio: !aiGuidePlaying && hasConnectionPromptAudio ? connectionPromptAudio : ALERT_AUDIO_PLACEHOLDER,
        replaceExisting: true,
        title: 'This connection is wrong.',
      })

      if (aiGuidePlaying) {
        playWrongConnectionCorrection(result.nextRequiredConnection)
      }

      return
    }

    setStatus(
      `Missing connections. Correct matched points: ${result.matchedCount}; total wires: ${result.totalConnections}.`,
    )
    showStepAlert(EXPERIMENT_ALERTS.missingConnections, {
      audio: aiGuidePlaying ? ALERT_AUDIO_PLACEHOLDER : EXPERIMENT_ALERTS.missingConnections.audio,
      description: `Some required wires are still missing. ${connectionPrompt}`,
      replaceExisting: true,
    })

    if (aiGuidePlaying) {
      playAiGuideSteps([14, correctionStepId].filter(Boolean))
    }
  }, [aiGuidePlaying, playAiGuideSteps, playWrongConnectionCorrection, showStepAlert])

  const handleCheck = () => {
    setCheckRequest((current) => current + 1)
  }
  const handleTogglePower = () => {
    if (!powerOn && !connectionsVerified) {
      setStatus('Check the circuit connections before switching on the power supply.')
      showStepAlert(EXPERIMENT_ALERTS.cannotStartPower)
      return
    }

    if (!powerOn && !allResistanceValuesAdjusted) {
      setStatus('Move R1, R2, and R3 before switching on the power supply.')
      showStepAlert(EXPERIMENT_ALERTS.adjustResistance, {
        type: 'warning',
      })
      return
    }

    if (powerOn) {
      setPowerOn(false)
      setVoltage(INITIAL_VOLTAGE)
      setVoltageAdjusted(false)
      voltageSetAudioPlayedRef.current = false
      setStatus('Power supply switched off.')
      showStepAlert(EXPERIMENT_ALERTS.powerOffDuringExperiment)
      return
    }

    setPowerOn(true)
    setVoltageAdjusted(false)
    voltageSetAudioPlayedRef.current = false
    setStatus('Power supply switched on. Adjust voltage and add the reading.')
    showStepAlert(EXPERIMENT_ALERTS.powerOn)
  }
  const handleAutoConnect = () => {
    setAutoConnectRequest((current) => current + 1)
    setConnectionsReadyForCheck(true)
    setConnectionsVerified(false)
    setResistanceAdjusted(getInitialResistanceAdjusted())
    allConnectionsAlertShownRef.current = true
    lastConnectionInstructionAudioKeyRef.current = null
    resistanceValuesAlertShownRef.current = false
    voltageSetAudioPlayedRef.current = false

    setStatus(
      'Autoconnect completed. Click on the check button to verify the connections.',
    )
    showStepAlert(EXPERIMENT_ALERTS.circuitConnectionsCompleted)
  }

  const handleVoltageChange = useCallback((nextVoltage) => {
    setVoltage(nextVoltage)

    if (powerOn && nextVoltage !== INITIAL_VOLTAGE) {
      setVoltageAdjusted(true)

      if (!voltageSetAudioPlayedRef.current) {
        voltageSetAudioPlayedRef.current = true
        playLabAlertAudio(ALERT_AUDIO.voltageSet)
      }
    }
  }, [powerOn])

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
            transform: `scale(${scale})`,
          }}
        >
          <main className="simulation-shell" id="walkthrough-demo-experiment">
            <HeaderBoard />
            <WalkthroughStartButton
              highlighted={Number(activeAiGuideStepId) === 1}
              variant="side-tab"
            />
            {/* <StatusBar status={status} /> */}
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
                    onAutoConnect: connectionsVerified || powerOn,
                    onCheck: connectionsVerified,
                    onPlot: false,
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
                  locked={!connectionsVerified || powerOn || observations.length > 0}
                  observations={observations}
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
                  guideEndpointHighlightActive={isAiGuideConnectionStep(activeAiGuideStepId)}
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

            <ReportControls
              graphGenerated={graphGenerated}
              minReadings={MIN_GRAPH_READINGS}
              onGenerateReport={handleGenerateReport}
              readingCount={readingCount}
              reportGenerated={reportGenerated}
            />

          </main>

          <GraphPanel
            className="graph-panel--separate"
            id="graph-panel"
            observations={observations}
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
