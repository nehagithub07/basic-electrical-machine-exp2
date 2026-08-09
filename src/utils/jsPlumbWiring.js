export const POSITIVE_TERMINALS = ['1-endpoint', '3-endpoint', '5-endpoint', '7-endpoint']

export const NEGATIVE_TERMINALS = ['2-endpoint', '4-endpoint', '6-endpoint', '8-endpoint']

export const CIRCUIT_POSITIVE_TERMINALS = [
  '9-endpoint',
  '11-endpoint',
  '13-endpoint',
  '15-endpoint',
]

export const CIRCUIT_NEGATIVE_TERMINALS = [
  '10-endpoint',
  '12-endpoint',
  '14-endpoint',
  '16-endpoint',
]

export const VALID_CONNECTION_SEQUENCE = [
  '1-endpoint', '9-endpoint',
  '2-endpoint', '10-endpoint',

  '3-endpoint', '11-endpoint',
  '4-endpoint', '12-endpoint',

  '5-endpoint', '13-endpoint',
  '6-endpoint', '14-endpoint',

  '7-endpoint', '15-endpoint',
  '8-endpoint', '16-endpoint',

  // These extra combinations allow A1, A2, A3 to be connected
  // to different valid branches, same as your old JavaScript file.

  '3-endpoint', '13-endpoint',
  '4-endpoint', '14-endpoint',

  '3-endpoint', '15-endpoint',
  '4-endpoint', '16-endpoint',

  '5-endpoint', '11-endpoint',
  '6-endpoint', '12-endpoint',

  '5-endpoint', '15-endpoint',
  '6-endpoint', '16-endpoint',

  '7-endpoint', '11-endpoint',
  '8-endpoint', '12-endpoint',

  '7-endpoint', '13-endpoint',
  '8-endpoint', '14-endpoint',
]

const getTerminalPairKey = (firstId, secondId) => (
  [firstId, secondId].sort().join('|')
)

const VALID_CONNECTION_PAIR_KEYS = new Set()

for (let index = 0; index < VALID_CONNECTION_SEQUENCE.length - 1; index += 2) {
  VALID_CONNECTION_PAIR_KEYS.add(
    getTerminalPairKey(
      VALID_CONNECTION_SEQUENCE[index],
      VALID_CONNECTION_SEQUENCE[index + 1],
    ),
  )
}

export const DEFAULT_AUTO_CONNECTIONS = [
  ['1-endpoint', '9-endpoint'],
  ['2-endpoint', '10-endpoint'],

  ['3-endpoint', '11-endpoint'],
  ['4-endpoint', '12-endpoint'],

  ['5-endpoint', '13-endpoint'],
  ['6-endpoint', '14-endpoint'],

  ['7-endpoint', '15-endpoint'],
  ['8-endpoint', '16-endpoint'],
]

export const DEFAULT_AMMETER_CURRENT_KEYS = {
  A1: 'i1',
  A2: 'i2',
  A3: 'i3',
}

const AMMETER_BRANCH_CONNECTIONS = {
  A1: [
    {
      currentKey: 'i1',
      negativeTerminal: '4-endpoint',
      positiveTerminal: '3-endpoint',
      circuitNegativeTerminal: '12-endpoint',
      circuitPositiveTerminal: '11-endpoint',
    },
    {
      currentKey: 'i2',
      negativeTerminal: '4-endpoint',
      positiveTerminal: '3-endpoint',
      circuitNegativeTerminal: '14-endpoint',
      circuitPositiveTerminal: '13-endpoint',
    },
    {
      currentKey: 'i3',
      negativeTerminal: '4-endpoint',
      positiveTerminal: '3-endpoint',
      circuitNegativeTerminal: '16-endpoint',
      circuitPositiveTerminal: '15-endpoint',
    },
  ],
  A2: [
    {
      currentKey: 'i1',
      negativeTerminal: '6-endpoint',
      positiveTerminal: '5-endpoint',
      circuitNegativeTerminal: '12-endpoint',
      circuitPositiveTerminal: '11-endpoint',
    },
    {
      currentKey: 'i2',
      negativeTerminal: '6-endpoint',
      positiveTerminal: '5-endpoint',
      circuitNegativeTerminal: '14-endpoint',
      circuitPositiveTerminal: '13-endpoint',
    },
    {
      currentKey: 'i3',
      negativeTerminal: '6-endpoint',
      positiveTerminal: '5-endpoint',
      circuitNegativeTerminal: '16-endpoint',
      circuitPositiveTerminal: '15-endpoint',
    },
  ],
  A3: [
    {
      currentKey: 'i1',
      negativeTerminal: '8-endpoint',
      positiveTerminal: '7-endpoint',
      circuitNegativeTerminal: '12-endpoint',
      circuitPositiveTerminal: '11-endpoint',
    },
    {
      currentKey: 'i2',
      negativeTerminal: '8-endpoint',
      positiveTerminal: '7-endpoint',
      circuitNegativeTerminal: '14-endpoint',
      circuitPositiveTerminal: '13-endpoint',
    },
    {
      currentKey: 'i3',
      negativeTerminal: '8-endpoint',
      positiveTerminal: '7-endpoint',
      circuitNegativeTerminal: '16-endpoint',
      circuitPositiveTerminal: '15-endpoint',
    },
  ],
}

export const resolveJsPlumb = (module) => (
  module?.jsPlumb
  || module?.default?.jsPlumb
  || module?.default
  || window.jsPlumb
)

const getAllConnections = (instance) => {
  if (!instance) return []

  if (typeof instance.getAllConnections === 'function') {
    return instance.getAllConnections()
  }

  if (typeof instance.getConnections === 'function') {
    return instance.getConnections()
  }

  return []
}

const getConnectionEndpointIds = (connection) => ({
  sourceId: connection?.sourceId || connection?.source?.id,
  targetId: connection?.targetId || connection?.target?.id,
})

export const getConnectedTerminalIds = (instance) => (
  Array.from(new Set(
    getAllConnections(instance)
      .flatMap((connection) => {
        const { sourceId, targetId } = getConnectionEndpointIds(connection)

        return [sourceId, targetId]
      })
      .filter(Boolean),
  ))
)

export const isValidConnectionPair = (firstId, secondId) => (
  Boolean(firstId && secondId && VALID_CONNECTION_PAIR_KEYS.has(getTerminalPairKey(firstId, secondId)))
)

export const getConnectionStatus = (instance) => {
  const connections = getAllConnections(instance)
  const validation = validateOldExperimentConnections(instance)
  const invalidConnections = connections.filter((connection) => {
    const { sourceId, targetId } = getConnectionEndpointIds(connection)

    return !isValidConnectionPair(sourceId, targetId)
  })

  return {
    ...validation,
    hasInvalidConnection: invalidConnections.length > 0,
    invalidConnectionCount: invalidConnections.length,
  }
}

export const deleteConnectionsForTerminal = (instance, terminalId) => {
  const matchingConnections = getAllConnections(instance).filter((connection) => {
    const sourceId = connection.sourceId || connection.source?.id
    const targetId = connection.targetId || connection.target?.id

    return sourceId === terminalId || targetId === terminalId
  })

  matchingConnections.forEach((connection) => {
    if (typeof instance.deleteConnection === 'function') {
      instance.deleteConnection(connection)
      return
    }

    connection.detach?.()
  })

  return matchingConnections.length
}

const isNegativeTerminal = (terminalId) => (
  NEGATIVE_TERMINALS.includes(terminalId)
  || CIRCUIT_NEGATIVE_TERMINALS.includes(terminalId)
)

const terminalPaintStyles = {
  positive: {
    fill: '#ef2b2d',
    outlineStroke: '#fff2f2',
    outlineWidth: 2,
    stroke: '#991b1d',
    strokeWidth: 1.4,
  },
  negative: {
    fill: '#151515',
    outlineStroke: '#eeeeee',
    outlineWidth: 2,
    stroke: '#000000',
    strokeWidth: 1.4,
  },
}

const terminalHoverPaintStyles = {
  positive: {
    fill: '#ff4b4d',
    outlineStroke: '#ffffff',
    outlineWidth: 2.4,
    stroke: '#7f1517',
    strokeWidth: 1.6,
  },
  negative: {
    fill: '#333333',
    outlineStroke: '#ffffff',
    outlineWidth: 2.4,
    stroke: '#000000',
    strokeWidth: 1.6,
  },
}

const getTerminalNumber = (terminalId) => terminalId.replace('-endpoint', '')

const getCssValue = (styles, propertyName, fallback) => {
  const value = styles.getPropertyValue(propertyName).trim()

  return value || fallback
}

const getCssNumber = (styles, propertyName, fallback) => {
  const value = Number.parseFloat(styles.getPropertyValue(propertyName))

  return Number.isFinite(value) ? value : fallback
}

const getEndpointPaintStyle = (element, type, state = 'default') => {
  const styles = window.getComputedStyle(element)
  const prefix = state === 'hover' ? '--jtk-endpoint-hover' : '--jtk-endpoint'
  const defaults = state === 'hover'
    ? terminalHoverPaintStyles[type]
    : terminalPaintStyles[type]

  return {
    fill: getCssValue(styles, `${prefix}-fill`, defaults.fill),
    outlineStroke: getCssValue(
      styles,
      `${prefix}-outline-stroke`,
      defaults.outlineStroke,
    ),
    outlineWidth: getCssNumber(
      styles,
      `${prefix}-outline-width`,
      defaults.outlineWidth,
    ),
    stroke: getCssValue(styles, `${prefix}-stroke`, defaults.stroke),
    strokeWidth: getCssNumber(
      styles,
      `${prefix}-stroke-width`,
      defaults.strokeWidth,
    ),
  }
}

const getEndpointRadius = (element) => (
  getCssNumber(window.getComputedStyle(element), '--jtk-endpoint-radius', 5)
)

const getEndpointCssClass = (terminalId, type) => {
  const terminalNumber = getTerminalNumber(terminalId)

  return [
    'jtk-endpoint--terminal',
    `jtk-endpoint--terminal-${terminalNumber}`,
    `jtk-endpoint--${terminalId}`,
    `jtk-endpoint--${type}`,
  ].join(' ')
}

export const wirePaintStyles = {
  positive: {
    outlineStroke: '#861719',
    outlineWidth: 1.15,
    stroke: '#ef2b2d',
    strokeWidth: 4.6,
  },
  negative: {
    outlineStroke: '#000000',
    outlineWidth: 1.15,
    stroke: '#151515',
    strokeWidth: 4.6,
  },
}

export const wireHoverPaintStyles = {
  positive: {
    outlineStroke: '#731214',
    outlineWidth: 1.35,
    stroke: '#ff4b4d',
    strokeWidth: 5,
  },
  negative: {
    outlineStroke: '#000000',
    outlineWidth: 1.35,
    stroke: '#333333',
    strokeWidth: 5,
  },
}

export const getConnectionBetween = (instance, firstId, secondId) => {
  const connections = getAllConnections(instance)

  return connections.find((connection) => {
    const sourceId = connection.sourceId || connection.source?.id
    const targetId = connection.targetId || connection.target?.id

    return (
      (sourceId === firstId && targetId === secondId)
      || (sourceId === secondId && targetId === firstId)
    )
  })
}

export const hasConnectionBetween = (instance, firstId, secondId) => (
  Boolean(getConnectionBetween(instance, firstId, secondId))
)

export const getAmmeterCurrentKeys = (instance) => {
  const currentKeys = {
    ...DEFAULT_AMMETER_CURRENT_KEYS,
  }

  Object.entries(AMMETER_BRANCH_CONNECTIONS).forEach(([meterLabel, branches]) => {
    const matchedBranch = branches.find((branch) => (
      hasConnectionBetween(
        instance,
        branch.positiveTerminal,
        branch.circuitPositiveTerminal,
      )
      && hasConnectionBetween(
        instance,
        branch.negativeTerminal,
        branch.circuitNegativeTerminal,
      )
    ))

    if (matchedBranch) {
      currentKeys[meterLabel] = matchedBranch.currentKey
    }
  })

  return currentKeys
}

export const addTerminalEndpoint = (instance, terminalId, type) => {
  const element = document.getElementById(terminalId)

  if (!element) {
    return
  }

  instance.addEndpoint(element, {
    uuid: terminalId,
    endpoint: ['Dot', { radius: getEndpointRadius(element) }],
    cssClass: getEndpointCssClass(terminalId, type),
    anchor: ['Center'],
    isSource: true,
    isTarget: true,
    connectionType: type,
    connectionsDetachable: true,
    connectorStyle: wirePaintStyles[type],
    connectorHoverStyle: wireHoverPaintStyles[type],
    maxConnections: 1,
    paintStyle: getEndpointPaintStyle(element, type),
    hoverPaintStyle: getEndpointPaintStyle(element, type, 'hover'),
  })
}

export const addAllEndpoints = (instance) => {
  POSITIVE_TERMINALS.forEach((terminalId) => {
    addTerminalEndpoint(instance, terminalId, 'positive')
  })

  NEGATIVE_TERMINALS.forEach((terminalId) => {
    addTerminalEndpoint(instance, terminalId, 'negative')
  })

  CIRCUIT_POSITIVE_TERMINALS.forEach((terminalId) => {
    addTerminalEndpoint(instance, terminalId, 'positive')
  })

  CIRCUIT_NEGATIVE_TERMINALS.forEach((terminalId) => {
    addTerminalEndpoint(instance, terminalId, 'negative')
  })
}

export const autoConnectDefaultCircuit = (instance) => {
  DEFAULT_AUTO_CONNECTIONS.forEach(([source, target]) => {
    if (hasConnectionBetween(instance, source, target)) {
      return
    }

    instance.connect({
      uuids: [source, target],
      type: isNegativeTerminal(source) ? 'negative' : 'positive',
    })
  })
}

export const validateOldExperimentConnections = (instance) => {
  const matchedConnections = []

  for (let i = 0; i < VALID_CONNECTION_SEQUENCE.length - 1; i += 1) {
    const firstTerminal = VALID_CONNECTION_SEQUENCE[i]
    const secondTerminal = VALID_CONNECTION_SEQUENCE[i + 1]

    const matchedConnection = getConnectionBetween(
      instance,
      firstTerminal,
      secondTerminal,
    )

    if (!matchedConnection || i % 2 !== 0) {
      continue
    }

    matchedConnections.push(matchedConnection)

    try {
      const nextPairIsMissing = !hasConnectionBetween(
        instance,
        VALID_CONNECTION_SEQUENCE[i + 2],
        VALID_CONNECTION_SEQUENCE[i + 3],
      )

      if (nextPairIsMissing && i % 4 === 0) {
        matchedConnections.pop()
      }
    } catch {
      // Same idea as old JS:
      // if the next pair does not exist, just continue.
    }
  }

  const totalConnections = getAllConnections(instance).length

  return {
    isCorrect: matchedConnections.length === 8 && totalConnections === 8,
    matchedCount: matchedConnections.length,
    totalConnections,
  }
}

export const lockJsPlumbCircuit = (instance, containerElement) => {
  getAllConnections(instance).forEach((connection) => {
    connection.setDetachable?.(false)

    connection.endpoints?.forEach((endpoint) => {
      endpoint.setEnabled?.(false)
    })
  })

  containerElement?.classList.add('connection-lab--locked')
}
