import { useState } from 'react'
import SectionCard from './SectionCard.jsx'
import { FormulaIcon, PdfIcon } from './Icons.jsx'
import { formatCurrent } from '../utils/circuitMath.js'

const MAX_ROWS = 5
const TABLE_ROWS = Array.from({ length: MAX_ROWS })
const FORMULAS = [
  {
    symbol: 'R',
    expression: <>R = R<sub>1</sub> + (R<sub>2</sub> × R<sub>3</sub>) / (R<sub>2</sub> + R<sub>3</sub>)</>,
    description: 'Equivalent resistance of R1 in series with parallel R2 and R3.',
  },
  { symbol: 'I1', expression: <>I<sub>1</sub> = V / R</>, description: 'Main current through R1.' },
  {
    symbol: 'I2',
    expression: <>I<sub>2</sub> = I<sub>1</sub> × R<sub>3</sub> / (R<sub>2</sub> + R<sub>3</sub>)</>,
    description: 'Branch current through R2.',
  },
  {
    symbol: 'I3',
    expression: <>I<sub>3</sub> = I<sub>1</sub> × R<sub>2</sub> / (R<sub>2</sub> + R<sub>3</sub>)</>,
    description: 'Branch current through R3.',
  },
]

const ObservationTable = ({ observations, onGenerateReport, reportGenerated }) => {
  const [equationsOpen, setEquationsOpen] = useState(false)
  const rows = TABLE_ROWS

  return (
    <div className="observation-module">
      <SectionCard className="observation-card" icon="table" id="observation-table-panel" title="OBSERVATION TABLE">
        <div className="observation-table-wrap" style={{ '--observation-row-count': rows.length }}>
        <table className="observation-table">
          <thead>
            <tr>
              <th>S.No</th><th>Voltage (V)</th>
              <th>I<sub>1</sub> (mA)</th><th>I<sub>2</sub> (mA)</th><th>I<sub>3</sub> (mA)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((_, index) => {
              const row = observations[index]
              return (
                <tr key={row?.id ?? `empty-${index}`}>
                  <td>{row?.id ?? ''}</td><td>{row ? row.voltage.toFixed(1) : ''}</td>
                  <td>{row ? formatCurrent(row.i1) : ''}</td><td>{row ? formatCurrent(row.i2) : ''}</td><td>{row ? formatCurrent(row.i3) : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </SectionCard>

      {equationsOpen && (
        <aside className="formula-panel observation-formula-panel" id="experiment-formula-panel" role="region" aria-labelledby="formula-panel-title">
          <div className="formula-panel__header">
            <div className="formula-panel__title">
              <span className="formula-panel__title-icon"><FormulaIcon /></span>
              <span><h3 id="formula-panel-title">Equations</h3><small>Theoretical formulas used in this experiment</small></span>
            </div>
            <button aria-label="Close equations" className="formula-panel__close" onClick={() => setEquationsOpen(false)} type="button">×</button>
          </div>
          <dl className="formula-panel__list">
            {FORMULAS.map(({ description, expression, symbol }) => (
              <div className="formula-panel__item" key={symbol}>
                <dt>{symbol}</dt>
                <dd><span className="formula-panel__equation">{expression}</span><span className="formula-panel__description">{description}</span></dd>
              </div>
            ))}
          </dl>
          <p className="formula-panel__note">KCL verification: I<sub>1</sub> = I<sub>2</sub> + I<sub>3</sub></p>
        </aside>
      )}

      <div className="observation-actions">
        <button aria-controls="experiment-formula-panel" aria-expanded={equationsOpen} className="observation-equations-button" id="formula-button" onClick={() => setEquationsOpen((current) => !current)} type="button">
          <FormulaIcon /><span>Equations</span>
        </button>
        <button className="observation-report-button" data-report-generated={reportGenerated ? 'true' : 'false'} disabled={observations.length < 3} id="generate-report-button" onClick={onGenerateReport} type="button">
          <PdfIcon /><span>Generate Report</span>
        </button>
      </div>
    </div>
  )
}

export default ObservationTable
