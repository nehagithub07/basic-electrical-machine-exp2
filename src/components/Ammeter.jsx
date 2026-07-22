import a1Img from '../assets/A1.png'
import a2Img from '../assets/A2.png'
import a3Img from '../assets/A3.png'
import needleImg from '../assets/needle.png'
import { getTerminalConnectedClass, getTerminalHighlightClass, getTerminalNumberHighlightClass } from '../utils/terminalHighlight.js'

const METER_MAX_CURRENT = 10
// The needle artwork points upward, so a -90 degree rotation places it on 0.
const DIAL_START_ANGLE = -90
const DIAL_SWEEP_ANGLE = 180

const ammeterImages = {
  A1: a1Img,
  A2: a2Img,
  A3: a3Img,
}

const terminalNumbers = {
  A1: { positive: 3, negative: 4 },
  A2: { positive: 5, negative: 6 },
  A3: { positive: 7, negative: 8 },
}

const Ammeter = ({ connectedTerminalIds = [], highlightedTerminalIds = [], label, value = 0 }) => {
  const terminals = terminalNumbers[label]
  const positiveTerminalId = `${terminals.positive}-endpoint`
  const negativeTerminalId = `${terminals.negative}-endpoint`
  const current = Number.isFinite(value) ? value : 0
  const ratio = Math.min(Math.max(current / METER_MAX_CURRENT, 0), 1)
  const angle = DIAL_START_ANGLE + ratio * DIAL_SWEEP_ANGLE

  return (
    <article className={`ammeter ammeter--${label}`} id={`ammeter-${label.toLowerCase()}`} aria-label={`${label} ammeter`}>
      <img
        src={ammeterImages[label]}
        alt={`${label} ammeter`}
        className="ammeter__image"
      />

      <span
        id={positiveTerminalId}
        className={`connection-terminal connection-terminal--meter connection-terminal--meter-plus connection-terminal--endpoint-${terminals.positive}${getTerminalConnectedClass(connectedTerminalIds, positiveTerminalId)}${getTerminalHighlightClass(highlightedTerminalIds, positiveTerminalId)}`}
        data-polarity="plus"
        aria-label={`${label} positive terminal ${terminals.positive}`}
        title={`${label} positive`}
      />
      <span
        className={`terminal-number-label terminal-number-label--meter-plus terminal-number-label--endpoint-${terminals.positive}${getTerminalNumberHighlightClass(highlightedTerminalIds, positiveTerminalId)}`}
        data-terminal-id={positiveTerminalId}
        title={`${label} positive`}
      >
        {terminals.positive}
      </span>

      <span
        id={negativeTerminalId}
        className={`connection-terminal connection-terminal--meter connection-terminal--meter-minus connection-terminal--endpoint-${terminals.negative}${getTerminalConnectedClass(connectedTerminalIds, negativeTerminalId)}${getTerminalHighlightClass(highlightedTerminalIds, negativeTerminalId)}`}
        data-polarity="minus"
        aria-label={`${label} negative terminal ${terminals.negative}`}
        title={`${label} negative`}
      />
      <span
        className={`terminal-number-label terminal-number-label--meter-minus terminal-number-label--endpoint-${terminals.negative}${getTerminalNumberHighlightClass(highlightedTerminalIds, negativeTerminalId)}`}
        data-terminal-id={negativeTerminalId}
        title={`${label} negative`}
      >
        {terminals.negative}
      </span>

      <div
        className="ammeter__needle"
        style={{ transform: `rotate(${angle}deg)` }}
      >
        <img
          src={needleImg}
          alt="Needle"
          className="ammeter__needle-image"
        />
      </div>
    </article>
  )
}

export default Ammeter
