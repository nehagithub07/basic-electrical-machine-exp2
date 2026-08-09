import { memo, useMemo, useState } from 'react'
import { formatCurrent } from '../utils/circuitMath.js'

const MIN_GRAPH_READINGS = 3
const VOLTAGE_MAX = 15
const CHART_VIEWBOX = {
  height: 320,
  width: 960,
}
const CHART = {
  height: 242,
  left: 88,
  top: 24,
  width: 784,
}
const X_TICKS = [0, 3, 6, 9, 12, 15]
const Y_TICK_COUNT = 5
// Tune labelLeft and labelTop to manually adjust graph labels in SVG units.
const SERIES = [
  { className: 'i1', key: 'i1', labelIndex: '1', labelLeft: 0, labelOffset: -1, labelTop: 0, pointRadius: 1.9 },
  { className: 'i2', key: 'i2', labelIndex: '2', labelLeft: 0, labelOffset: 0, labelTop: 0, pointRadius: 1.8 },
  { className: 'i3', key: 'i3', labelIndex: '3', labelLeft: 0, labelOffset: -3, labelTop: 0, pointRadius: 2 },
]
const SERIES_LABEL = {
  height: 10,
  width: 18,
}
const SERIES_LABEL_GAP = 5

const getMaxCurrent = (observations) => {
  const maxCurrent = observations.reduce(
    (currentMax, row) => Math.max(currentMax, row.i1, row.i2, row.i3),
    0,
  )
  const paddedCurrent = Math.max(maxCurrent * 1.08, 0.1)
  const roughStep = paddedCurrent / (Y_TICK_COUNT - 1)
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const normalizedStep = roughStep / magnitude
  const niceStep = (
    normalizedStep <= 1 ? 1
      : normalizedStep <= 2 ? 2
        : normalizedStep <= 2.5 ? 2.5
          : normalizedStep <= 5 ? 5
            : 10
  ) * magnitude

  return niceStep * (Y_TICK_COUNT - 1)
}

const getPoint = (row, current, maxCurrent) => {
  return {
    x: getXFromVoltage(row.voltage),
    y: getYFromCurrent(current, maxCurrent),
  }
}

const getXFromVoltage = (voltage) => {
  const ratio = Math.min(Math.max(voltage / VOLTAGE_MAX, 0), 1)

  return CHART.left + ratio * CHART.width
}

const getYFromCurrent = (current, maxCurrent) => {
  const ratio = Math.min(Math.max(current / maxCurrent, 0), 1)

  return CHART.top + CHART.height - ratio * CHART.height
}

const formatCurrentTick = (value) => {
  if (value === 0) {
    return '0'
  }

  return formatCurrent(value)
}

const getYTicks = (maxCurrent) => (
  Array.from({ length: Y_TICK_COUNT }, (_, index) => (
    (maxCurrent / (Y_TICK_COUNT - 1)) * index
  ))
)

const getLinePath = (observations, currentKey, maxCurrent) => (
  observations
    .map((row, index) => {
      const point = getPoint(row, row[currentKey], maxCurrent)
      const command = index === 0 ? 'M' : 'L'

      return `${command}${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    })
    .join(' ')
)

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getSeriesLabelPoint = (observations, currentKey, maxCurrent, offset) => {
  const row = observations.at(-1)
  const point = getPoint(row, row[currentKey], maxCurrent)
  const minY = CHART.top + SERIES_LABEL.height / 2 + 2
  const maxY = CHART.top + CHART.height - SERIES_LABEL.height / 2 - 2

  return {
    point,
    x: Math.min(point.x + 14, CHART_VIEWBOX.width - SERIES_LABEL.width - 8),
    y: clamp(point.y + offset, minY, maxY),
  }
}

const getSeriesLabelPoints = (observations, maxCurrent) => {
  const minY = CHART.top + SERIES_LABEL.height / 2 + 2
  const maxY = CHART.top + CHART.height - SERIES_LABEL.height / 2 - 2
  const minGap = SERIES_LABEL.height + SERIES_LABEL_GAP
  const labels = SERIES
    .map((series) => ({
      ...getSeriesLabelPoint(observations, series.key, maxCurrent, series.labelOffset),
      series,
    }))
    .sort((current, next) => current.y - next.y)

  labels.forEach((label, index) => {
    if (index === 0) {
      label.y = Math.max(label.y, minY)
      return
    }

    label.y = Math.max(label.y, labels[index - 1].y + minGap)
  })

  if (labels.at(-1)?.y > maxY) {
    labels[labels.length - 1].y = maxY

    for (let index = labels.length - 2; index >= 0; index -= 1) {
      labels[index].y = Math.min(labels[index].y, labels[index + 1].y - minGap)
    }
  }

  if (labels[0]?.y < minY) {
    const shift = minY - labels[0].y

    labels.forEach((label) => {
      label.y += shift
    })
  }

  return labels.map((label) => ({
    ...label,
    x: label.x + (label.series.labelLeft ?? 0),
    y: label.y + (label.series.labelTop ?? 0),
  }))
}

const SvgCurrentLabel = ({ index }) => (
  <>
    I<tspan className="graph-panel__series-label-sub" dx="1">{index}</tspan>
  </>
)

const VerificationInput = ({ label, name, onChange, unit, value }) => (
  <label className="verification-panel__input-wrap">
    <span className="sr-only">{label}</span>
    <input
      aria-label={label}
      className="verification-panel__input"
      inputMode="decimal"
      min="0"
      name={name}
      onChange={onChange}
      step="any"
      type="number"
      value={value}
    />
    {unit && <span className="verification-panel__unit">{unit}</span>}
  </label>
)

const EMPTY_ANSWERS = {
  equivalentResistance: '', voltage: '', resistance: '', i1Result: '', i1ForI2: '', r3Numerator: '',
  r2ForI2: '', r3ForI2: '', i2Result: '', i1ForI3: '', r2Numerator: '', r2ForI3: '', r3ForI3: '', i3Result: '',
}

const VerificationPanel = ({ observations, onVerificationChange }) => {
  const [readingId, setReadingId] = useState('')
  const [answers, setAnswers] = useState(EMPTY_ANSWERS)
  const [result, setResult] = useState(null)
  const reading = observations.find((row) => String(row.id) === readingId)
  const field = (name, label, unit) => (
    <VerificationInput label={label} name={name} onChange={(event) => {
      setAnswers((current) => ({ ...current, [name]: event.target.value }))
      setResult(null)
    }} unit={unit} value={answers[name]} />
  )
  const verify = () => {
    if (!reading) {
      setResult({ correct: false, message: 'Select a reading first.' })
      return
    }

    const expected = {
      equivalentResistance: reading.totalResistance / 1000, voltage: reading.voltage, resistance: reading.totalResistance / 1000,
      i1Result: reading.i1, i1ForI2: reading.i1, r3Numerator: reading.r3 / 1000, r2ForI2: reading.r2 / 1000,
      r3ForI2: reading.r3 / 1000, i2Result: reading.i2, i1ForI3: reading.i1, r2Numerator: reading.r2 / 1000,
      r2ForI3: reading.r2 / 1000, r3ForI3: reading.r3 / 1000, i3Result: reading.i3,
    }
    const correct = Object.entries(expected).every(([key, value]) => (
      answers[key] !== '' && Math.abs(Number(answers[key]) - value) <= Math.max(Math.abs(value) * 0.001, 0.001)
    ))
    const verificationResult = { correct, message: correct ? 'Correct! All calculations are verified.' : 'Some values are incorrect. Check the selected reading and try again.' }
    setResult(verificationResult)
    onVerificationChange?.({ answers, expected, readingId: reading.id, result: verificationResult, voltage: reading.voltage })
  }

  return (
    <div className="verification-panel" aria-label="Calculated current verification">
      <div className="verification-panel__toolbar">
        <h3>THEORETICAL VERIFICATION</h3>
        <select aria-label="Select reading to verify" onChange={(event) => { setReadingId(event.target.value); setAnswers(EMPTY_ANSWERS); setResult(null) }} value={readingId}>
          <option value="">Select reading</option>
          {observations.map((row) => <option key={row.id} value={row.id}>Reading {row.id} — {row.voltage.toFixed(1)} V</option>)}
        </select>
      </div>
      <div className="verification-panel__equation verification-panel__equation--total">
        <strong>Equivalent Resistance (R)</strong><span>=</span>{field('equivalentResistance', 'Equivalent resistance', 'kΩ')}
      </div>
      <div className="verification-panel__equation">
        <strong>I<sub>1</sub></strong><span>=</span><span className="verification-panel__fraction"><span>V {field('voltage', 'Voltage for I1')}</span><span>R {field('resistance', 'Resistance for I1', 'kΩ')}</span></span><span>=</span>{field('i1Result', 'Calculated I1', 'mA')}
      </div>
      <div className="verification-panel__equation">
        <strong>I<sub>2</sub></strong><span>= I<sub>1</sub> {field('i1ForI2', 'I1 value for I2')} ×</span><span className="verification-panel__fraction"><span>R<sub>3</sub> {field('r3Numerator', 'R3 numerator for I2 in kilo-ohms')}</span><span>R<sub>2</sub> {field('r2ForI2', 'R2 denominator for I2 in kilo-ohms')} + R<sub>3</sub> {field('r3ForI2', 'R3 denominator for I2 in kilo-ohms')}</span></span><span>=</span>{field('i2Result', 'Calculated I2', 'mA')}
      </div>
      <div className="verification-panel__equation">
        <strong>I<sub>3</sub></strong><span>= I<sub>1</sub> {field('i1ForI3', 'I1 value for I3')} ×</span><span className="verification-panel__fraction"><span>R<sub>2</sub> {field('r2Numerator', 'R2 numerator for I3 in kilo-ohms')}</span><span>R<sub>2</sub> {field('r2ForI3', 'R2 denominator for I3 in kilo-ohms')} + R<sub>3</sub> {field('r3ForI3', 'R3 denominator for I3 in kilo-ohms')}</span></span><span>=</span>{field('i3Result', 'Calculated I3', 'mA')}
      </div>
      <div className="verification-panel__actions"><button onClick={verify} type="button">Verify</button>{result && <span className={result.correct ? 'is-correct' : 'is-wrong'} role="status">{result.message}</span>}</div>
    </div>
  )
}

const GraphPanel = ({ className = '', id, observations = [], onVerificationChange, plotted = false }) => {
  const shouldPlot = plotted && observations.length >= MIN_GRAPH_READINGS
  const plottedObservations = useMemo(
    () => [...observations].sort((current, next) => current.voltage - next.voltage),
    [observations],
  )
  const maxCurrent = getMaxCurrent(plottedObservations)
  const yTicks = getYTicks(maxCurrent)
  const chartBottom = CHART.top + CHART.height
  const chartRight = CHART.left + CHART.width
  const yAxisTitleX = 27
  const yAxisTitleY = CHART.top + CHART.height / 2
  const seriesLabelPoints = shouldPlot ? getSeriesLabelPoints(plottedObservations, maxCurrent) : []

  return (
    <section className={`graph-panel ${shouldPlot ? 'graph-panel--plotted' : ''} ${className}`} id={id} aria-label="Observation graph">
      <div className="graph-panel__heading">
        <div>
          
          <h2>GRAPH AND THEORETICAL VERIFICATION</h2>
        </div>

        {/* <div className="graph-panel__legend" aria-label="Current lines">
          <span><i className="graph-panel__dot graph-panel__dot--i1" /><CurrentLabel index="1" /></span>
          <span><i className="graph-panel__dot graph-panel__dot--i2" /><CurrentLabel index="2" /></span>
          <span><i className="graph-panel__dot graph-panel__dot--i3" /><CurrentLabel index="3" /></span>
        </div> */}
      </div>

      <div className="graph-panel__content">
        <VerificationPanel observations={observations} onVerificationChange={onVerificationChange} />
        <div className="graph-panel__body">
        <svg
          className="graph-panel__chart"
          preserveAspectRatio="none"
          role="img"
          aria-label="Line graph of current in milliamperes against voltage in volts"
          viewBox={`0 0 ${CHART_VIEWBOX.width} ${CHART_VIEWBOX.height}`}
        >
          <defs>
            <marker id="graph-axis-arrow" markerHeight="6" markerWidth="7" orient="auto" refX="6" refY="3">
              <path d="M0 0 6 3 0 6z" />
            </marker>
            <clipPath id="graph-plot-clip">
              <rect height={CHART.height} width={CHART.width} x={CHART.left} y={CHART.top} />
            </clipPath>
          </defs>

          <rect className="graph-panel__plot-bg" height={CHART.height} width={CHART.width} x={CHART.left} y={CHART.top} />
          {yTicks.slice(0, -1).map((tick, index) => {
            const nextTick = yTicks[index + 1]
            const y = getYFromCurrent(nextTick, maxCurrent)
            const height = getYFromCurrent(tick, maxCurrent) - y

            return <rect className="graph-panel__band" height={height} key={`band-${tick}`} width={CHART.width} x={CHART.left} y={y} />
          })}

          {X_TICKS.map((tick) => {
            const x = getXFromVoltage(tick)

            return (
              <g key={`x-${tick}`}>
                <line className="graph-panel__grid-line graph-panel__grid-line--vertical" x1={x} x2={x} y1={CHART.top} y2={chartBottom} />
                <line className="graph-panel__tick-line" x1={x} x2={x} y1={chartBottom} y2={chartBottom + 6} />
                <text className="graph-panel__tick-label" textAnchor="middle" x={x} y={chartBottom + 22}>{tick}</text>
              </g>
            )
          })}

          {yTicks.map((tick) => {
            const y = getYFromCurrent(tick, maxCurrent)

            return (
              <g key={`y-${tick}`}>
                <line className="graph-panel__grid-line graph-panel__grid-line--horizontal" x1={CHART.left} x2={chartRight} y1={y} y2={y} />
                <line className="graph-panel__tick-line" x1={CHART.left - 6} x2={CHART.left} y1={y} y2={y} />
                <text className="graph-panel__tick-label graph-panel__tick-label--y" textAnchor="end" x={CHART.left - 11} y={y + 4}>{formatCurrentTick(tick)}</text>
              </g>
            )
          })}

          <path className="graph-panel__axis-line graph-panel__axis-line--x" d={`M${CHART.left} ${chartBottom}H${chartRight + 15}`} markerEnd="url(#graph-axis-arrow)" />
          <path className="graph-panel__axis-line graph-panel__axis-line--y" d={`M${CHART.left} ${chartBottom}V${CHART.top - 12}`} markerEnd="url(#graph-axis-arrow)" />

          <text className="graph-panel__axis-title graph-panel__axis-title--x" textAnchor="middle" x={CHART.left + CHART.width / 2} y={CHART_VIEWBOX.height - 12}>
            Voltage (V)
          </text>
          <text
            className="graph-panel__axis-title graph-panel__axis-title--y"
            textAnchor="middle"
            transform={`rotate(-90 ${yAxisTitleX} ${yAxisTitleY})`}
            x={yAxisTitleX}
            y={yAxisTitleY}
          >
            Current (mA)
          </text>

          {!shouldPlot && (
            <text className="graph-panel__message" textAnchor="middle" x={CHART.left + CHART.width / 2} y={CHART.top + CHART.height / 2} />
          )}

          {shouldPlot && (
            <g className="graph-panel__plot">
              <g clipPath="url(#graph-plot-clip)">
                {SERIES.map((series) => (
                  <path
                    className={`graph-panel__line graph-panel__line--${series.className}`}
                    d={getLinePath(plottedObservations, series.key, maxCurrent)}
                    key={series.key}
                  />
                ))}
              </g>

              {SERIES.map((series) => (
                <g key={`${series.key}-points`}>
                  {plottedObservations.map((row) => {
                    const point = getPoint(row, row[series.key], maxCurrent)

                    return (
                      <circle
                        className={`graph-panel__point graph-panel__point--${series.className}`}
                        cx={point.x}
                        cy={point.y}
                        key={`${series.key}-${row.id}`}
                        r={series.pointRadius}
                      />
                    )
                  })}
                </g>
              ))}

              {seriesLabelPoints.map(({ point, series, x, y }) => {
                return (
                  <g className="graph-panel__series-label-group" key={`${series.key}-label`}>
                    <path
                      className={`graph-panel__series-label-leader graph-panel__series-label-leader--${series.className}`}
                      d={`M${point.x + 5} ${point.y}L${x - 8} ${y}`}
                    />
                    <rect
                      className={`graph-panel__series-label-bg graph-panel__series-label-bg--${series.className}`}
                      height={SERIES_LABEL.height}
                      rx="5"
                      width={SERIES_LABEL.width}
                      x={x - 6}
                      y={y - SERIES_LABEL.height / 2}
                    />
                    <text
                      className={`graph-panel__series-label graph-panel__series-label--${series.className}`}
                      x={x}
                      y={y}
                    >
                      <SvgCurrentLabel index={series.labelIndex} />
                    </text>
                  </g>
                )
              })}
            </g>
          )}
        </svg>
        </div>
      </div>
    </section>
  )
}

export default memo(GraphPanel)
