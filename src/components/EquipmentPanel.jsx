
import Ammeter from './Ammeter.jsx'
import PowerSupply from './PowerSupply.jsx'

const EquipmentPanel = ({
  connectedTerminalIds = [],
  highlightedTerminalIds = [],
  onTogglePower,
  powerOn,
  readings,
  setVoltage,
  voltage,
}) => (
  <section className="equipment-panel" id="equipment-panel">
    <PowerSupply
      connectedTerminalIds={connectedTerminalIds}
      highlightedTerminalIds={highlightedTerminalIds}
      onTogglePower={onTogglePower}
      powerOn={powerOn}
      setVoltage={setVoltage}
      voltage={voltage}
    />

    <div className="ammeter-bank" id="ammeter-bank" aria-label="A1, A2, and A3 ammeters">
      <Ammeter connectedTerminalIds={connectedTerminalIds} highlightedTerminalIds={highlightedTerminalIds} label="A1" value={readings.A1} />
      <Ammeter connectedTerminalIds={connectedTerminalIds} highlightedTerminalIds={highlightedTerminalIds} label="A2" value={readings.A2} />
      <Ammeter connectedTerminalIds={connectedTerminalIds} highlightedTerminalIds={highlightedTerminalIds} label="A3" value={readings.A3} />
    </div>
  </section>
)

export default EquipmentPanel
