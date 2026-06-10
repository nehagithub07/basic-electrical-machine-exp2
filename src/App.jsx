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
import { EXPERIMENT_ALERTS } from './alerts/experimentStepAlerts.js'
import { useLabAlerts } from './alerts/useLabAlerts.js'
import { useAiGuideNarration } from './aiGuide/useAiGuideNarration.js'
// import StatusBar from './components/StatusBar.jsx'
 
import { calculateReadings } from './utils/circuitMath.js'
import { generateKclReport } from './utils/reportGenerator.js'
 
const BASE_WIDTH = 1440
const BASE_HEIGHT = 960
const GRAPH_SECTION_GAP = 28
const GRAPH_SECTION_HEIGHT = 430
const CONTENT_HEIGHT = BASE_HEIGHT + GRAPH_SECTION_GAP + GRAPH_SECTION_HEIGHT
const PANEL_MAX_SCALE = 0.9
const PANEL_VIEWPORT_MARGIN = 24
const MIN_GRAPH_READINGS = 6
const MAX_OBSERVATIONS = 10
const VOLTAGE_SAFETY_LIMIT = 8.5
const VOLTAGE_SAFETY_RESET = 7.5
const INITIAL_RESISTANCE = 1.0
const INITIAL_VOLTAGE = 1.0

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
  const [connectionsVerified, setConnectionsVerified] = useState(false)
  const [resistanceAdjusted, setResistanceAdjusted] = useState(getInitialResistanceAdjusted)
  const [sessionStart, setSessionStart] = useState(() => Date.now())
  const allConnectionsAlertShownRef = useRef(false)
  const voltageLimitWarningShownRef = useRef(false)

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
    isPlaying: aiGuidePlaying,
    start: startAiGuide,
    stop: stopAiGuide,
  } = useAiGuideNarration({
    onError: handleAiGuideError,
    onFinish: handleAiGuideFinish,
    onStart: handleAiGuideStart,
  })

  const handleAiGuide = useCallback(() => {
    if (aiGuidePlaying) {
      stopAiGuide()
      setStatus('AI Guide narration stopped.')
      return
    }

    startAiGuide()
  }, [aiGuidePlaying, startAiGuide, stopAiGuide])

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
      showStepAlert(EXPERIMENT_ALERTS.minimumReadingsRequired, {
        description: 'The observation table already contains the maximum 10 readings.',
        title: 'Observation Table Is Full',
      })
      return
    }

    if (hasDuplicateReading) {
      setStatus('Duplicate reading cannot be added to the observation table.')
      showStepAlert(EXPERIMENT_ALERTS.readingAlreadyExists, {
        description: 'This reading already exists in the observation table. Change the voltage before adding another reading.',
        title: 'Duplicate Reading Not Allowed',
      })
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
    showStepAlert(EXPERIMENT_ALERTS.readingAdded, {
      description: `Reading ${nextObservationCount} has been added to the observation table.`,
    })

    if (nextObservationCount === MIN_GRAPH_READINGS) {
      showStepAlert(EXPERIMENT_ALERTS.sufficientData, {
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
    setConnectionsVerified(false)
    setResistanceAdjusted(getInitialResistanceAdjusted())
    setResetRequest((current) => current + 1)
    setSessionStart(Date.now())
    allConnectionsAlertShownRef.current = false
    voltageLimitWarningShownRef.current = false
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
      showStepAlert(EXPERIMENT_ALERTS.insufficientGraphReadings, {
        description: `Add ${remainingReadings} more reading(s) before plotting.`,
      })
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
    showStepAlert(EXPERIMENT_ALERTS.printLayoutGenerated, {
      description: 'The KCL report was generated from the plotted graph and current observations.',
      target: '#generate-report-button',
      title: 'Report Generated Successfully',
    })
  }

  const scaledWidth = Math.ceil(BASE_WIDTH * scale)
  const scaledHeight = Math.ceil(CONTENT_HEIGHT * scale)
  const handleConnectionChange = useCallback((result) => {
    if (connectionsVerified) {
      return
    }

    if (result.latestConnectionIsWrong) {
      setStatus('This connection is wrong')
      showStepAlert(EXPERIMENT_ALERTS.incorrectNodeConnection)
      return
    }

    if (!result.isCorrect) {
      allConnectionsAlertShownRef.current = false
      return
    }

    if (allConnectionsAlertShownRef.current) {
      return
    }

    allConnectionsAlertShownRef.current = true
    setStatus('All connections are completed. Click on the check button to verify the connections.')
    showStepAlert(EXPERIMENT_ALERTS.allConnectionsCompleted)
  }, [connectionsVerified, showStepAlert])

  const handleCheckConnections = useCallback((result) => {
    if (result.isCorrect) {
      setConnectionsVerified(true)
      setResistanceAdjusted(getInitialResistanceAdjusted())
      allConnectionsAlertShownRef.current = true

      setStatus(
        'Right connections! Move R1, R2, and R3 before switching on the power supply.',
      )
      showStepAlert(EXPERIMENT_ALERTS.connectionsVerified)

      return
    }

    setConnectionsVerified(false)
    setResistanceAdjusted(getInitialResistanceAdjusted())
    allConnectionsAlertShownRef.current = false

    if (result.totalConnections === 0) {
      setStatus('Please make the connections first.')
      showStepAlert(EXPERIMENT_ALERTS.connectionErrorFound, {
        description: 'No circuit wires were found. Drag node connections before checking.',
        title: 'Please make the connections first.',
        type: 'warning',
      })
      return
    }

    setStatus(
      `Invalid connections. Correct matched points: ${result.matchedCount}; total wires: ${result.totalConnections}.`,
    )
    showStepAlert(EXPERIMENT_ALERTS.incorrectNodeConnection, {
      description: `Matched ${result.matchedCount} of 8 required wire pairs from ${result.totalConnections} total wires.`,
    })
  }, [showStepAlert])

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
      voltageLimitWarningShownRef.current = false
      setStatus('Power supply switched off.')
      showStepAlert(EXPERIMENT_ALERTS.powerOffDuringExperiment)
      return
    }

    setPowerOn(true)
    setStatus('Power supply switched on. Adjust voltage and add the reading.')
    showStepAlert(EXPERIMENT_ALERTS.powerOn)
  }
  const handleAutoConnect = () => {
    setAutoConnectRequest((current) => current + 1)
    setConnectionsVerified(false)
    setResistanceAdjusted(getInitialResistanceAdjusted())
    allConnectionsAlertShownRef.current = true

    setStatus(
      'Autoconnect completed. Click on the check button to verify the connections.',
    )
    showStepAlert(EXPERIMENT_ALERTS.circuitConnectionsCompleted)
  }

  const handleVoltageChange = useCallback((nextVoltage) => {
    setVoltage(nextVoltage)

    if (!powerOn || nextVoltage <= 0) {
      if (nextVoltage < VOLTAGE_SAFETY_RESET) {
        voltageLimitWarningShownRef.current = false
      }

      return
    }

    if (nextVoltage >= VOLTAGE_SAFETY_LIMIT && !voltageLimitWarningShownRef.current) {
      voltageLimitWarningShownRef.current = true
      showStepAlert(EXPERIMENT_ALERTS.voltageSafetyLimit, {
        description: `${nextVoltage.toFixed(1)} V is close to the 10 V supply limit.`,
      })
      return
    }

    if (nextVoltage < VOLTAGE_SAFETY_RESET) {
      voltageLimitWarningShownRef.current = false
    }
  }, [powerOn, showStepAlert])

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
            <WalkthroughStartButton variant="side-tab" />
            {/* <StatusBar status={status} /> */}
            <span className="sr-only" role="status" aria-live="polite">{status}</span>

            <section className="workspace-grid">
              <aside className="left-panel">
                <ActionButtons
                  activeButtons={{
                    onAiGuide: aiGuidePlaying,
                  }}
                  disabledButtons={{
                    onAdd: false,
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
        </div>
      </div>
    </div>
  )
}

export default App
