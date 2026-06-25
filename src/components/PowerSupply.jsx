import powerSupplyOff from '../assets/PowerSupply_Off.png'
import powerSupplyOn from '../assets/PowerSupply_ON.png'

const PowerSupply = ({ onTogglePower, powerOn, setVoltage, voltage }) => {
  const displayedVoltage = powerOn ? `${voltage.toFixed(1)} V` : ''
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
        id="1-endpoint"
        className="connection-terminal connection-terminal--power connection-terminal--power-plus connection-terminal--endpoint-1"
        data-polarity="plus"
        aria-label="Power supply positive terminal 1"
        title="Power positive (1-endpoint)"
      />
      <span
        className="terminal-number-label terminal-number-label--power-plus terminal-number-label--endpoint-1"
        data-terminal-id="1-endpoint"
        title="Power positive (1-endpoint)"
      >
        1
      </span>

      <span
        id="2-endpoint"
        className="connection-terminal connection-terminal--power connection-terminal--power-minus connection-terminal--endpoint-2"
        data-polarity="minus"
        aria-label="Power supply negative terminal 2"
        title="Power negative (2-endpoint)"
      />
      <span
        className="terminal-number-label terminal-number-label--power-minus terminal-number-label--endpoint-2"
        data-terminal-id="2-endpoint"
        title="Power negative (2-endpoint)"
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
          max="12"
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
