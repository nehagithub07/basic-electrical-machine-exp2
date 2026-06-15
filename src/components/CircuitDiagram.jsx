import { Fragment } from 'react'

import circuitImage from '../assets/circuit.png'
const terminalLabels = [
  {
    id: '9-endpoint',
    label: '9',
    polarity: 'plus',
  },
  {
    id: '10-endpoint',
    label: '10',
    polarity: 'minus',
  },
  {
    id: '11-endpoint',
    label: '11',
    polarity: 'plus',
  },
  {
    id: '12-endpoint',
    label: '12',
    polarity: 'minus',
  },
  {
    id: '13-endpoint',
    label: '13',
    polarity: 'plus',
  },
  {
    id: '14-endpoint',
    label: '14',
    polarity: 'minus',
  },
  {
    id: '15-endpoint',
    label: '15',
    polarity: 'plus',
  },
  {
    id: '16-endpoint',
    label: '16',
    polarity: 'minus',
  },
]

const CircuitDiagram = ({ className = '', r1, r2, r3 }) => (
  <section className={`circuit-panel ${className}`} id="circuit-panel">
    <div className="circuit-panel__stage">
      <img alt="Kirchhoff current law circuit diagram" className="circuit-panel__image" src={circuitImage} />

      {terminalLabels.map(({ id, label, polarity }) => (
        <Fragment key={id}>
          <span
            id={id}
            className={`connection-terminal connection-terminal--circuit connection-terminal--endpoint-${label}`}
            data-polarity={polarity}
            aria-label={`Circuit terminal ${label}`}
            title={`Circuit terminal ${label} (${id})`}
          />
          <span
            className={`terminal-number-label terminal-number-label--circuit terminal-number-label--endpoint-${label}`}
            data-terminal-id={id}
            title={`Circuit terminal ${label}`}
          >
            {label}
          </span>
        </Fragment>
      ))}

      <span className="resistor-value left-[166px] top-[80px]">{r1} &Omega;</span>
      <span className="resistor-value left-[300px] top-[134px]">{r2} &Omega;</span>
      <span className="resistor-value left-[615px] top-[80px]">{r3} &Omega;</span>
    </div>
  </section>
)

export default CircuitDiagram
