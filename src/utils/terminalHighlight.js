export const isTerminalHighlighted = (highlightedTerminalIds = [], terminalId) => (
  highlightedTerminalIds.includes(terminalId)
)

export const getTerminalHighlightClass = (highlightedTerminalIds, terminalId) => (
  isTerminalHighlighted(highlightedTerminalIds, terminalId)
    ? ' connection-terminal--guide-highlight'
    : ''
)

export const getTerminalConnectedClass = (connectedTerminalIds = [], terminalId) => (
  connectedTerminalIds.includes(terminalId) ? ' jtk-connected' : ''
)

export const getTerminalNumberHighlightClass = (highlightedTerminalIds, terminalId) => (
  isTerminalHighlighted(highlightedTerminalIds, terminalId)
    ? ' terminal-number-label--guide-highlight'
    : ''
)
