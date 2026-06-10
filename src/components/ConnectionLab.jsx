import { useEffect, useRef, useState } from 'react'

import CircuitDiagram from './CircuitDiagram.jsx'
import EquipmentPanel from './EquipmentPanel.jsx'

import {
  addAllEndpoints,
  autoConnectDefaultCircuit,
  DEFAULT_AMMETER_CURRENT_KEYS,
  deleteConnectionsForTerminal,
  getAmmeterCurrentKeys,
  getConnectionStatus,
  isValidConnectionPair,
  lockJsPlumbCircuit,
  resolveJsPlumb,
  validateOldExperimentConnections,
  wireHoverPaintStyles,
  wirePaintStyles,
} from '../utils/jsPlumbWiring.js'

const getJsPlumbZoom = (scale) => (
  Number.isFinite(scale) && scale > 0 ? scale : 1
)

const ConnectionLab = ({
  autoConnectRequest,
  checkRequest,
  onConnectionChange,
  onCheckConnections,
  powerOn,
  r1,
  r2,
  r3,
  readings,
  resetRequest,
  scale = 1,
  onTogglePower,
  setVoltage,
  voltage,
}) => {
  const containerRef = useRef(null)
  const instanceRef = useRef(null)
  const onConnectionChangeRef = useRef(onConnectionChange)
  const onCheckConnectionsRef = useRef(onCheckConnections)
  const scaleRef = useRef(getJsPlumbZoom(scale))
  const suppressConnectionAlertsRef = useRef(false)

  const [isLocked, setIsLocked] = useState(false)
  const [ammeterCurrentKeys, setAmmeterCurrentKeys] = useState(DEFAULT_AMMETER_CURRENT_KEYS)

  useEffect(() => {
    onCheckConnectionsRef.current = onCheckConnections
  }, [onCheckConnections])

  useEffect(() => {
    onConnectionChangeRef.current = onConnectionChange
  }, [onConnectionChange])

  useEffect(() => {
    let cancelled = false

    const initJsPlumb = async () => {
      const jsPlumbModule = await import('jsplumb')
      const jsPlumb = resolveJsPlumb(jsPlumbModule)

      if (cancelled || !containerRef.current || !jsPlumb?.getInstance) {
        return
      }

      instanceRef.current?.reset()

      containerRef.current.classList.remove('connection-lab--locked')
      setIsLocked(false)
      setAmmeterCurrentKeys(DEFAULT_AMMETER_CURRENT_KEYS)

      const instance = jsPlumb.getInstance({
        Container: containerRef.current,
        ConnectionsDetachable: true,
        ReattachConnections: true,
        Connector: ['Bezier', { curviness: 72 }],
        PaintStyle: {
          ...wirePaintStyles.positive,
        },
        HoverPaintStyle: {
          ...wireHoverPaintStyles.positive,
        },
        Endpoint: ['Dot', { radius: 5 }],
      })

      instanceRef.current = instance
      instance.setZoom?.(scaleRef.current)

      instance.registerConnectionTypes({
        positive: {
          paintStyle: {
            ...wirePaintStyles.positive,
          },
          hoverPaintStyle: {
            ...wireHoverPaintStyles.positive,
          },
        },
        negative: {
          paintStyle: {
            ...wirePaintStyles.negative,
          },
          hoverPaintStyle: {
            ...wireHoverPaintStyles.negative,
          },
        },
      })

      instance.setSuspendDrawing(true)

      addAllEndpoints(instance)

      instance.bind?.('connection', (info) => {
        if (suppressConnectionAlertsRef.current) {
          return
        }

        const connection = info?.connection ?? info
        const sourceId = connection?.sourceId || connection?.source?.id
        const targetId = connection?.targetId || connection?.target?.id

        onConnectionChangeRef.current?.({
          ...getConnectionStatus(instance),
          latestConnection: {
            sourceId,
            targetId,
          },
          latestConnectionIsWrong: Boolean(
            sourceId && targetId && !isValidConnectionPair(sourceId, targetId),
          ),
        })
      })

      instance.setSuspendDrawing(false, true)

      window.setTimeout(() => {
        instance.repaintEverything()
      }, 100)
    }

    initJsPlumb()

    const handleResize = () => {
      window.setTimeout(() => {
        instanceRef.current?.repaintEverything()
      }, 100)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelled = true
      window.removeEventListener('resize', handleResize)

      instanceRef.current?.reset()
      instanceRef.current = null
    }
  }, [resetRequest])

  useEffect(() => {
    const instance = instanceRef.current
    const zoom = getJsPlumbZoom(scale)

    scaleRef.current = zoom

    if (!instance?.setZoom) {
      return
    }

    instance.setZoom(zoom, true)

    window.setTimeout(() => {
      instance.repaintEverything?.()
    }, 0)
  }, [scale])

  useEffect(() => {
    if (autoConnectRequest === 0 || !instanceRef.current || isLocked) {
      return
    }

    suppressConnectionAlertsRef.current = true

    try {
      autoConnectDefaultCircuit(instanceRef.current)
    } finally {
      suppressConnectionAlertsRef.current = false
    }

    window.setTimeout(() => {
      instanceRef.current?.repaintEverything()
    }, 80)
  }, [autoConnectRequest, isLocked])

  useEffect(() => {
    if (checkRequest === 0 || !instanceRef.current) {
      return
    }

    const result = validateOldExperimentConnections(instanceRef.current)

    if (result.isCorrect) {
      setAmmeterCurrentKeys(getAmmeterCurrentKeys(instanceRef.current))
      lockJsPlumbCircuit(instanceRef.current, containerRef.current)
      setIsLocked(true)
    }

    onCheckConnectionsRef.current?.(result)
  }, [checkRequest])

  const handleLabelClick = (event) => {
    const label = event.target.closest('.terminal-number-label')

    if (!label || !containerRef.current?.contains(label)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    if (isLocked) {
      return
    }

    const terminalId = label.dataset.terminalId

    if (!terminalId || !instanceRef.current) {
      return
    }

    deleteConnectionsForTerminal(instanceRef.current, terminalId)
    onConnectionChangeRef.current?.({
      ...getConnectionStatus(instanceRef.current),
      latestConnection: null,
      latestConnectionIsWrong: false,
    })
    instanceRef.current.repaintEverything?.()
  }

  const ammeterReadings = {
    A1: readings[ammeterCurrentKeys.A1] ?? 0,
    A2: readings[ammeterCurrentKeys.A2] ?? 0,
    A3: readings[ammeterCurrentKeys.A3] ?? 0,
  }

  return (
    <div className="connection-lab" onClick={handleLabelClick} ref={containerRef}>
      <EquipmentPanel
        onTogglePower={onTogglePower}
        powerOn={powerOn}
        readings={ammeterReadings}
        setVoltage={setVoltage}
        voltage={voltage}
      />

      <CircuitDiagram r1={r1} r2={r2} r3={r3} />
    </div>
  )
}

export default ConnectionLab
