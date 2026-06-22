import { useState } from 'react'
import { FormulaIcon, PdfIcon } from './Icons.jsx'

const formulas = [
  {
    description: 'Equivalent resistance of R1 in series with parallel R2 and R3.',
    expression: (
      <>
        R = R<sub>1</sub> + (R<sub>2</sub> x R<sub>3</sub>) / (R<sub>2</sub> + R<sub>3</sub>)
      </>
    ),
    symbol: 'R',
  },
  {
    description: 'Main current through R1.',
    expression: (
      <>
        I<sub>1</sub> = V / R
      </>
    ),
    symbol: 'I1',
  },
  {
    description: 'Branch current through R2.',
    expression: (
      <>
        I<sub>2</sub> = I<sub>1</sub> x R<sub>3</sub> / (R<sub>2</sub> + R<sub>3</sub>)
      </>
    ),
    symbol: 'I2',
  },
  {
    description: 'Branch current through R3.',
    expression: (
      <>
        I<sub>3</sub> = I<sub>1</sub> x R<sub>2</sub> / (R<sub>2</sub> + R<sub>3</sub>)
      </>
    ),
    symbol: 'I3',
  },
]

const ReportControls = ({
  graphGenerated,
  minReadings,
  onGenerateReport,
  readingCount,
  reportGenerated,
}) => {
  const [formulasOpen, setFormulasOpen] = useState(false)
  const readingsReady = readingCount >= minReadings
  const buttonTitle = reportGenerated
    ? 'Report generated. Click to regenerate the report.'
    : readingsReady && !graphGenerated
      ? 'Please generate the graph first.'
      : `Generate report after ${minReadings} readings and graph plotting.`

  return (
    <div className="report-controls">
      {formulasOpen ? (
        <aside
          className="formula-panel"
          id="experiment-formula-panel"
          role="region"
          aria-labelledby="formula-panel-title"
        >
          <div className="formula-panel__header">
            <h3 id="formula-panel-title">Experiment Equations</h3>
          </div>

          <dl className="formula-panel__list">
            {formulas.map(({ description, expression, symbol }) => (
              <div className="formula-panel__item" key={symbol}>
                <dt>{symbol}</dt>
                <dd>
                  <span className="formula-panel__equation">{expression}</span>
                  <span className="formula-panel__description">{description}</span>
                </dd>
              </div>
            ))}
          </dl>

          <p className="formula-panel__note">
            KCL verification: I<sub>1</sub> = I<sub>2</sub> + I<sub>3</sub>
          </p>
        </aside>
      ) : null}

      <button
        id="formula-button"
        type="button"
        className="formula-button"
        title={formulasOpen ? 'Hide experiment formulas.' : 'Show experiment formulas.'}
        aria-controls="experiment-formula-panel"
        aria-expanded={formulasOpen}
        aria-label={formulasOpen ? 'Hide experiment formulas' : 'Show experiment formulas'}
        onClick={() => setFormulasOpen((current) => !current)}
      >
        <FormulaIcon />
        <span>Formulas</span>
      </button>

      <button
        id="generate-report-button"
        type="button"
        className="report-button"
        disabled={!readingsReady}
        title={buttonTitle}
        aria-label="Generate Report"
        data-report-generated={reportGenerated ? 'true' : 'false'}
        onClick={onGenerateReport}
      >
        <PdfIcon />
        <span>Generate Report</span>
      </button>
    </div>
  )
}

export default ReportControls
