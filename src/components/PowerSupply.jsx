import powerSupplyOff from '../assets/PowerSupply_Off.png'
import powerSupplyOn from '../assets/PowerSupply_ON.png'
import { getTerminalConnectedClass, getTerminalHighlightClass, getTerminalNumberHighlightClass } from '../utils/terminalHighlight.js'

const PowerSupply = ({ connectedTerminalIds = [], highlightedTerminalIds = [], onTogglePower, powerOn, setVoltage, voltage }) => {
  const displayedVoltage = powerOn ? `${voltage.toFixed(1)} V` : ''
  const positiveTerminalId = '1-endpoint'
  const negativeTerminalId = '2-endpoint'
  const handleVoltageChange = (event) => {
    setVoltage(Number(Number(event.target.value).toFixed(1)))
  }

  return (
    <article className={`power-supply${powerOn ? ' power-supply--on' : ''}`} id="power-supply">
      <img
        alt={powerOn ? 'Power supply switched on' : 'Power supply switched off'}
        className="power-supply__image"
        src={powerOn ? powerSupplyOn : powerSupplyOff}
      />

      <div className="power-supply__display">{displayedVoltage}</div>
      <span
        id={positiveTerminalId}
        className={`connection-terminal connection-terminal--power connection-terminal--power-plus connection-terminal--endpoint-1${getTerminalConnectedClass(connectedTerminalIds, positiveTerminalId)}${getTerminalHighlightClass(highlightedTerminalIds, positiveTerminalId)}`}
        data-polarity="plus"
        aria-label="Power supply positive terminal 1"
        title="Power positive"
      />
      <span
        className={`terminal-number-label terminal-number-label--power-plus terminal-number-label--endpoint-1${getTerminalNumberHighlightClass(highlightedTerminalIds, positiveTerminalId)}`}
        data-terminal-id={positiveTerminalId}
        title="Power positive"
      >
        1
      </span>

      <span
        id={negativeTerminalId}
        className={`connection-terminal connection-terminal--power connection-terminal--power-minus connection-terminal--endpoint-2${getTerminalConnectedClass(connectedTerminalIds, negativeTerminalId)}${getTerminalHighlightClass(highlightedTerminalIds, negativeTerminalId)}`}
        data-polarity="minus"
        aria-label="Power supply negative terminal 2"
        title="Power negative"
      />
      <span
        className={`terminal-number-label terminal-number-label--power-minus terminal-number-label--endpoint-2${getTerminalNumberHighlightClass(highlightedTerminalIds, negativeTerminalId)}`}
        data-terminal-id={negativeTerminalId}
        title="Power negative"
      >
        2
      </span>
      <button
        id="power-toggle-button"
        aria-label={powerOn ? 'Switch power supply off' : 'Switch power supply on'}
        aria-pressed={powerOn}
        className="power-supply__button"
        onClick={onTogglePower}
        type="button"
      />

      <label className="power-supply__control" id="voltage-control">
        <span className="sr-only">Voltage</span>
        <input
          aria-label="Voltage"
          className="voltage-range"
          disabled={!powerOn}
          id="voltage-slider"
          max="10"
          min="1"
          onChange={handleVoltageChange}
          step="0.1"
          type="range"
          value={voltage}
        />
      </label>
    </article>
  )
}

export default PowerSupply
